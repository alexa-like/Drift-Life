import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import User from "../models/User";
import CosmeticItem from "../models/CosmeticItem";
import AdminAuditLog, { logAdminAction } from "../models/AdminAuditLog";

const router = Router();
router.use(requireAuth as any);

// ── GET /api/cosmetics — full catalog + per-item ownership status ──────────

router.get("/", async (req: AuthRequest, res) => {
  try {
    const [catalog, user] = await Promise.all([
      CosmeticItem.find().lean(),
      User.findById(req.userId).select("ownedCosmetics cosmeticInventory equippedNameFlair equippedMessageCard").lean(),
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });

    const owned: string[] = (user as any).ownedCosmetics ?? [];
    const inventory: Array<{ cosmeticId: string; expiresAt: Date | null }> = (user as any).cosmeticInventory ?? [];
    const equippedFlair: string | null = (user as any).equippedNameFlair ?? null;
    const equippedCard: string | null = (user as any).equippedMessageCard ?? null;

    const items = catalog.map(item => {
      const entry = inventory.find(i => i.cosmeticId === item.id);
      return {
        ...item,
        owned: owned.includes(item.id),
        equipped: item.type === "name_flair" ? equippedFlair === item.id : equippedCard === item.id,
        expiresAt: entry?.expiresAt ?? null,
      };
    });

    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(items);
  } catch (err: any) {
    req.log.error({ err }, "cosmetics GET error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/cosmetics/:id/buy ────────────────────────────────────────────

router.post("/:id/buy", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const item = await CosmeticItem.findOne({ id }).lean();
    if (!item) return res.status(404).json({ message: "Cosmetic not found" });
    if (!item.purchasable) return res.status(400).json({ message: "This cosmetic is not available for purchase" });
    if (item.priceNC <= 0) return res.status(400).json({ message: "This cosmetic cannot be purchased" });

    // Check if already owned
    const alreadyOwned = await User.findOne({ _id: req.userId, ownedCosmetics: id }).lean();
    if (alreadyOwned) return res.status(409).json({ message: "You already own this cosmetic" });

    // Atomic NC deduction + add to inventory
    const updated = await User.findOneAndUpdate(
      { _id: req.userId, nc: { $gte: item.priceNC } },
      {
        $inc: { nc: -item.priceNC },
        $addToSet: { ownedCosmetics: id },
        $push: {
          cosmeticInventory: {
            cosmeticId: id,
            acquiredAt: new Date(),
            expiresAt: null,
            source: "purchase",
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ message: "Not enough NC to purchase this cosmetic" });
    }

    res.json({ message: `${item.name} purchased`, nc: updated.nc });
  } catch (err: any) {
    req.log.error({ err }, "cosmetics buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/cosmetics/:id/equip ─────────────────────────────────────────

router.post("/:id/equip", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { equip = true } = req.body as { equip?: boolean };

    if (!equip) {
      // Unequip: find the item to know its type
      const item = await CosmeticItem.findOne({ id }).lean();
      if (!item) return res.status(404).json({ message: "Cosmetic not found" });

      const field = item.type === "name_flair" ? "equippedNameFlair" : "equippedMessageCard";
      await User.findByIdAndUpdate(req.userId, { $set: { [field]: null } });
      return res.json({ message: `${item.name} unequipped` });
    }

    const item = await CosmeticItem.findOne({ id }).lean();
    if (!item) return res.status(404).json({ message: "Cosmetic not found" });

    // Validate ownership
    const user = await User.findOne({ _id: req.userId, ownedCosmetics: id }).lean();
    if (!user) return res.status(403).json({ message: "You don't own this cosmetic" });

    const field = item.type === "name_flair" ? "equippedNameFlair" : "equippedMessageCard";
    await User.findByIdAndUpdate(req.userId, { $set: { [field]: id } });

    res.json({ message: `${item.name} equipped` });
  } catch (err: any) {
    req.log.error({ err }, "cosmetics equip error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/cosmetics/check-expired — remove expired cosmetics ───────────
// Called by auth middleware on login

router.get("/check-expired", async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const user = await User.findById(req.userId).select(
      "cosmeticInventory ownedCosmetics equippedNameFlair equippedMessageCard"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const expired = ((user as any).cosmeticInventory ?? []).filter(
      (entry: { cosmeticId: string; expiresAt: Date | null }) =>
        entry.expiresAt !== null && entry.expiresAt <= now
    );

    if (expired.length === 0) return res.json({ removed: 0 });

    const expiredIds: string[] = expired.map((e: { cosmeticId: string }) => e.cosmeticId);

    // Remove from inventory and ownedCosmetics
    (user as any).cosmeticInventory = ((user as any).cosmeticInventory ?? []).filter(
      (entry: { cosmeticId: string; expiresAt: Date | null }) =>
        !(entry.expiresAt !== null && entry.expiresAt <= now)
    );
    (user as any).ownedCosmetics = ((user as any).ownedCosmetics ?? []).filter(
      (id: string) => !expiredIds.includes(id)
    );

    // Unequip if currently equipped
    if (expiredIds.includes((user as any).equippedNameFlair)) {
      (user as any).equippedNameFlair = null;
    }
    if (expiredIds.includes((user as any).equippedMessageCard)) {
      (user as any).equippedMessageCard = null;
    }

    await (user as any).save();
    res.json({ removed: expiredIds.length });
  } catch (err: any) {
    req.log.error({ err }, "cosmetics check-expired error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
