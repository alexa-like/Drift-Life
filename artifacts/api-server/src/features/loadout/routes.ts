/**
 * Loadout — save and retrieve the player's combat loadout.
 * GET  /api/loadout/combat
 * POST /api/loadout/combat
 */
import { Router } from "express";
import PlayerLoadout from "../../models/PlayerLoadout";
import PlayerMiniGameInventory from "../garage/models/PlayerMiniGameInventory";
import MiniGameItem from "../garage/models/MiniGameItem";
import { requireAuth, AuthRequest } from "../../middlewares/auth";

const router = Router();

// ── GET /api/loadout/combat ───────────────────────────────────────────────────
// Returns the player's current loadout + fully-enriched inventory (with item def
// fields resolved from MiniGameItem).  The raw lean doc is NOT returned directly
// because old documents may be missing array fields (e.g. secondaryWeapons added
// later), which caused a crash in the frontend when a weapon was equipped but the
// array was undefined.
router.get("/combat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [loadoutDoc, inv] = await Promise.all([
      PlayerLoadout.findOne({ userId: req.userId }).lean(),
      PlayerMiniGameInventory.findOne({ userId: req.userId }).lean(),
    ]);

    const emptyLoadout = {
      primaryWeaponId: null, secondaryWeaponId: null,
      bodyArmorId: null, consumableItemId: null, consumableCount: 0,
    };
    const emptyAmmo = {
      pistol_rounds: 0, smg_rounds: 0, rifle_rounds: 0,
      shotgun_shells: 0, sniper_rounds: 0, lmg_rounds: 0,
    };

    // Build enriched inventory — always returns arrays (never undefined)
    let enrichedInventory: {
      primaryWeapons: any[]; secondaryWeapons: any[]; bodyArmors: any[];
      consumables: any[]; ammo: typeof emptyAmmo;
    };

    if (inv) {
      // Resolve def fields from MiniGameItem for all owned items
      const primaryWeapons   = Array.isArray(inv.primaryWeapons)   ? inv.primaryWeapons   : [];
      const secondaryWeapons = Array.isArray(inv.secondaryWeapons) ? inv.secondaryWeapons : [];
      const bodyArmors       = Array.isArray(inv.bodyArmors)       ? inv.bodyArmors       : [];
      const consumables      = Array.isArray(inv.consumables)      ? inv.consumables      : [];

      const allItemIds = [
        ...primaryWeapons.map((w: any) => w.itemId),
        ...secondaryWeapons.map((w: any) => w.itemId),
        ...bodyArmors.map((w: any) => w.itemId),
        ...consumables.map((c: any) => c.itemId),
      ];
      const defs = allItemIds.length
        ? await MiniGameItem.find({ itemId: { $in: allItemIds } }).lean()
        : [];
      const defMap = Object.fromEntries(defs.map((d: any) => [d.itemId, d]));

      enrichedInventory = {
        primaryWeapons:   primaryWeapons.map((w: any) => ({ ...w, def: defMap[w.itemId] ?? null })),
        secondaryWeapons: secondaryWeapons.map((w: any) => ({ ...w, def: defMap[w.itemId] ?? null })),
        bodyArmors:       bodyArmors.map((w: any) => ({ ...w, def: defMap[w.itemId] ?? null })),
        consumables:      consumables.map((c: any) => ({ ...c, def: defMap[c.itemId] ?? null })),
        ammo:             (inv.ammo ?? emptyAmmo) as typeof emptyAmmo,
      };
    } else {
      enrichedInventory = {
        primaryWeapons: [], secondaryWeapons: [], bodyArmors: [], consumables: [],
        ammo: emptyAmmo,
      };
    }

    const loadout = loadoutDoc
      ? {
          primaryWeaponId:   loadoutDoc.primaryWeaponId,
          secondaryWeaponId: loadoutDoc.secondaryWeaponId,
          bodyArmorId:       loadoutDoc.bodyArmorId,
          consumableItemId:  loadoutDoc.consumableItemId,
          consumableCount:   loadoutDoc.consumableCount,
        }
      : emptyLoadout;

    res.json({ loadout, inventory: enrichedInventory });
  } catch (err) {
    req.log.error({ err }, "loadout get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/loadout/combat ──────────────────────────────────────────────────
router.post("/combat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      primaryWeaponId   = null,
      secondaryWeaponId = null,
      bodyArmorId       = null,
      consumableItemId  = null,
      consumableCount   = 0,
    } = req.body as {
      primaryWeaponId?:   string | null;
      secondaryWeaponId?: string | null;
      bodyArmorId?:       string | null;
      consumableItemId?:  string | null;
      consumableCount?:   number;
    };

    // Validate consumableCount
    const count = Math.max(0, Math.min(3, Math.floor(Number(consumableCount) || 0)));

    // Validate that items exist in player's inventory
    const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId }).lean();
    if (!inv && (primaryWeaponId || secondaryWeaponId || bodyArmorId || consumableItemId)) {
      res.status(400).json({ message: "You don't own any combat items yet" });
      return;
    }

    // Validate primary weapon (guard against old docs missing array fields)
    if (primaryWeaponId) {
      const pw = Array.isArray(inv?.primaryWeapons) ? inv!.primaryWeapons : [];
      const entry = pw.find(w => w.itemId === primaryWeaponId);
      if (!entry || entry.durability <= 0) {
        res.status(400).json({ message: `Primary weapon not available or destroyed: ${primaryWeaponId}` });
        return;
      }
    }

    // Validate secondary weapon
    if (secondaryWeaponId) {
      const sw = Array.isArray(inv?.secondaryWeapons) ? inv!.secondaryWeapons : [];
      const entry = sw.find(w => w.itemId === secondaryWeaponId);
      if (!entry || entry.durability <= 0) {
        res.status(400).json({ message: `Secondary weapon not available or destroyed: ${secondaryWeaponId}` });
        return;
      }
    }

    // Validate body armor
    if (bodyArmorId) {
      const ba = Array.isArray(inv?.bodyArmors) ? inv!.bodyArmors : [];
      const entry = ba.find(w => w.itemId === bodyArmorId);
      if (!entry) {
        res.status(400).json({ message: `Body armor not in inventory: ${bodyArmorId}` });
        return;
      }
    }

    // Validate consumable
    if (consumableItemId) {
      const cs = Array.isArray(inv?.consumables) ? inv!.consumables : [];
      const entry = cs.find(c => c.itemId === consumableItemId);
      if (!entry || entry.quantity < count) {
        res.status(400).json({ message: `Consumable not available or insufficient quantity: ${consumableItemId}` });
        return;
      }
    }

    const updated = await PlayerLoadout.findOneAndUpdate(
      { userId: req.userId },
      { primaryWeaponId, secondaryWeaponId, bodyArmorId, consumableItemId, consumableCount: count },
      { upsert: true, returnDocument: 'after' },
    );

    res.json({ message: "Loadout saved", loadout: updated });
  } catch (err) {
    req.log.error({ err }, "loadout save error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/loadout/inventory — full mini-game item inventory ─────────────────
router.get("/inventory", requireAuth, async (req: AuthRequest, res) => {
  try {
    const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId }).lean();
    if (!inv) {
      res.json({ primaryWeapons: [], secondaryWeapons: [], bodyArmors: [], consumables: [], ammo: { pistol_rounds: 0, smg_rounds: 0, rifle_rounds: 0, shotgun_shells: 0, sniper_rounds: 0, lmg_rounds: 0 } });
      return;
    }

    // Resolve all item details (guard against old docs missing array fields)
    const _pw = Array.isArray(inv.primaryWeapons)   ? inv.primaryWeapons   : [];
    const _sw = Array.isArray(inv.secondaryWeapons) ? inv.secondaryWeapons : [];
    const _ba = Array.isArray(inv.bodyArmors)       ? inv.bodyArmors       : [];
    const _cs = Array.isArray(inv.consumables)      ? inv.consumables      : [];
    const weaponIds = [
      ..._pw.map(w => w.itemId),
      ..._sw.map(w => w.itemId),
      ..._ba.map(w => w.itemId),
      ..._cs.map(c => c.itemId),
    ];
    const defs = weaponIds.length ? await MiniGameItem.find({ itemId: { $in: weaponIds } }).lean() : [];
    const defMap = Object.fromEntries(defs.map(d => [d.itemId, d]));

    function enrichWeaponStack(stack: { itemId: string; durability: number }[]) {
      return stack.map(s => ({ ...s, def: defMap[s.itemId] ?? null }));
    }
    function enrichConsumableStack(stack: { itemId: string; quantity: number }[]) {
      return stack.map(s => ({ ...s, def: defMap[s.itemId] ?? null }));
    }

    res.json({
      primaryWeapons:   enrichWeaponStack(_pw),
      secondaryWeapons: enrichWeaponStack(_sw),
      bodyArmors:       enrichWeaponStack(_ba),
      consumables:      enrichConsumableStack(_cs),
      ammo:             inv.ammo,
    });
  } catch (err) {
    req.log.error({ err }, "inventory get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/loadout/sell — sell one MiniGameItem for DC ─────────────────────
router.post("/sell", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId } = req.body as { itemId?: string };
    if (!itemId) {
      res.status(400).json({ message: "itemId is required" });
      return;
    }

    const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId });
    if (!inv) {
      res.status(400).json({ message: "You have no combat items to sell" });
      return;
    }

    // Find the item across all stacks
    type WeaponCat = "primaryWeapons" | "secondaryWeapons" | "bodyArmors";
    type ConsumableCat = "consumables";
    type AnyCategory = WeaponCat | ConsumableCat;

    const weaponCategories: WeaponCat[] = ["primaryWeapons", "secondaryWeapons", "bodyArmors"];
    let foundCategory: AnyCategory | null = null;
    let isWeapon = false;

    for (const cat of weaponCategories) {
      if (inv[cat].some((e: { itemId: string; durability: number }) => e.itemId === itemId)) {
        foundCategory = cat;
        isWeapon = true;
        break;
      }
    }
    if (!foundCategory) {
      if (inv.consumables.some((e: { itemId: string; quantity: number }) => e.itemId === itemId && e.quantity > 0)) {
        foundCategory = "consumables";
      }
    }

    if (!foundCategory) {
      res.status(400).json({ message: "You don't own that item" });
      return;
    }

    // Resolve DC value from tier
    const itemDef = await MiniGameItem.findOne({ itemId }).lean();
    if (!itemDef) {
      res.status(400).json({ message: "Item definition not found" });
      return;
    }

    const SELL_DC: Record<string, number> = {
      common: 50, uncommon: 150, rare: 500, epic: 1500, legendary: 5000,
    };
    const dcGained = SELL_DC[itemDef.tier] ?? 50;

    const User = (await import("../../models/User")).default;

    if (isWeapon) {
      // Pull weapon stack entry
      const pulled = await PlayerMiniGameInventory.findOneAndUpdate(
        { userId: req.userId, [`${foundCategory}.itemId`]: itemId },
        { $pull: { [foundCategory]: { itemId } } },
        { returnDocument: 'after' },
      );
      if (!pulled) {
        res.status(409).json({ message: "Item was already sold or not found" });
        return;
      }
    } else {
      // Consumable: decrement or pull
      const decremented = await PlayerMiniGameInventory.findOneAndUpdate(
        { userId: req.userId, "consumables.itemId": itemId, "consumables.$.quantity": { $gt: 1 } },
        { $inc: { "consumables.$.quantity": -1 } },
        { returnDocument: 'after' },
      );
      if (!decremented) {
        const pulled = await PlayerMiniGameInventory.findOneAndUpdate(
          { userId: req.userId, "consumables.itemId": itemId, "consumables.$.quantity": 1 },
          { $pull: { consumables: { itemId } } },
          { returnDocument: 'after' },
        );
        if (!pulled) {
          res.status(409).json({ message: "Item was already sold or not found" });
          return;
        }
      }
    }

    // Grant DC atomically
    await User.findByIdAndUpdate(req.userId, { $inc: { dc: dcGained } });

    // Clear any loadout slots that held this specific itemId (non-fatal)
    const currentLoadout = await PlayerLoadout.findOne({ userId: req.userId }).lean();
    if (currentLoadout) {
      const clearFields: Record<string, null> = {};
      for (const slot of ["primaryWeaponId", "secondaryWeaponId", "bodyArmorId", "consumableItemId"] as const) {
        if ((currentLoadout as any)[slot] === itemId) clearFields[slot] = null;
      }
      if (Object.keys(clearFields).length > 0) {
        await PlayerLoadout.updateOne({ userId: req.userId }, { $set: clearFields });
      }
    }

    res.json({ message: `Sold ${itemDef.name} for ${dcGained} DC`, dcGained });
  } catch (err) {
    req.log.error({ err }, "loadout sell error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
