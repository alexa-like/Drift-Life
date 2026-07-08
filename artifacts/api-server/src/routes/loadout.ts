/**
 * Loadout — save and retrieve the player's combat loadout.
 * GET  /api/loadout/combat
 * POST /api/loadout/combat
 */
import { Router } from "express";
import PlayerLoadout from "../models/PlayerLoadout";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import MiniGameItem from "../models/MiniGameItem";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── GET /api/loadout/combat ───────────────────────────────────────────────────
router.get("/combat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const loadout = await PlayerLoadout.findOne({ userId: req.userId }).lean();
    const inv     = await PlayerMiniGameInventory.findOne({ userId: req.userId }).lean();

    if (!loadout) {
      res.json({
        loadout: { weapon: null, armor: null, consumable1: null, consumable2: null, ammoType: null },
        inventory: inv ?? { weapons: [], armor: [], consumables: [], ammo: [] },
      });
      return;
    }

    // Resolve item details for each slot
    const slotIds = [loadout.weapon, loadout.armor, loadout.consumable1, loadout.consumable2, loadout.ammoType].filter(Boolean) as string[];
    const itemDefs = slotIds.length
      ? await MiniGameItem.find({ itemId: { $in: slotIds } }).lean()
      : [];
    const defMap = Object.fromEntries(itemDefs.map(i => [i.itemId, i]));

    res.json({
      loadout: {
        weapon:      loadout.weapon,
        armor:       loadout.armor,
        consumable1: loadout.consumable1,
        consumable2: loadout.consumable2,
        ammoType:    loadout.ammoType,
      },
      resolvedSlots: {
        weapon:      loadout.weapon      ? defMap[loadout.weapon]      ?? null : null,
        armor:       loadout.armor       ? defMap[loadout.armor]       ?? null : null,
        consumable1: loadout.consumable1 ? defMap[loadout.consumable1] ?? null : null,
        consumable2: loadout.consumable2 ? defMap[loadout.consumable2] ?? null : null,
        ammoType:    loadout.ammoType    ? defMap[loadout.ammoType]    ?? null : null,
      },
      inventory: inv ?? { weapons: [], armor: [], consumables: [], ammo: [] },
    });
  } catch (err) {
    req.log.error({ err }, "loadout get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/loadout/combat ──────────────────────────────────────────────────
router.post("/combat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { weapon = null, armor = null, consumable1 = null, consumable2 = null, ammoType = null } = req.body as {
      weapon?: string | null;
      armor?: string | null;
      consumable1?: string | null;
      consumable2?: string | null;
      ammoType?: string | null;
    };

    // Validate that items exist in player's inventory
    const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId }).lean();
    if (!inv && (weapon || armor || consumable1 || consumable2 || ammoType)) {
      res.status(400).json({ message: "You don't own any combat items yet" });
      return;
    }

    function owns(itemId: string | null, category: string): boolean {
      if (!itemId || !inv) return itemId === null;
      const arr = (inv as any)[category] as Array<{ itemId: string; quantity: number }>;
      return arr.some(e => e.itemId === itemId && e.quantity > 0);
    }

    if (weapon      && !owns(weapon,      "weapons"))     { res.status(400).json({ message: `You don't own weapon: ${weapon}` }); return; }
    if (armor       && !owns(armor,        "armor"))       { res.status(400).json({ message: `You don't own armor: ${armor}` }); return; }
    if (consumable1 && !owns(consumable1, "consumables")) { res.status(400).json({ message: `You don't own consumable: ${consumable1}` }); return; }
    if (consumable2 && !owns(consumable2, "consumables")) { res.status(400).json({ message: `You don't own consumable: ${consumable2}` }); return; }
    if (ammoType    && !owns(ammoType,    "ammo"))         { res.status(400).json({ message: `You don't own ammo: ${ammoType}` }); return; }

    const updated = await PlayerLoadout.findOneAndUpdate(
      { userId: req.userId },
      { weapon, armor, consumable1, consumable2, ammoType },
      { upsert: true, new: true },
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
      res.json({ weapons: [], armor: [], consumables: [], ammo: [] });
      return;
    }

    // Resolve all item details
    const allIds = [
      ...inv.weapons.map(w => w.itemId),
      ...inv.armor.map(a => a.itemId),
      ...inv.consumables.map(c => c.itemId),
      ...inv.ammo.map(a => a.itemId),
    ];
    const defs = allIds.length ? await MiniGameItem.find({ itemId: { $in: allIds } }).lean() : [];
    const defMap = Object.fromEntries(defs.map(d => [d.itemId, d]));

    function enrichStack(stack: { itemId: string; quantity: number }[]) {
      return stack.map(s => ({ ...s, def: defMap[s.itemId] ?? null }));
    }

    res.json({
      weapons:     enrichStack(inv.weapons),
      armor:       enrichStack(inv.armor),
      consumables: enrichStack(inv.consumables),
      ammo:        enrichStack(inv.ammo),
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
    const categories = ["weapons", "armor", "consumables", "ammo"] as const;
    let foundCategory: (typeof categories)[number] | null = null;
    for (const cat of categories) {
      if ((inv as any)[cat].some((e: { itemId: string; quantity: number }) => e.itemId === itemId && e.quantity > 0)) {
        foundCategory = cat;
        break;
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

    // Remove one from inventory
    const arr = (inv as any)[foundCategory] as Array<{ itemId: string; quantity: number }>;
    const idx = arr.findIndex(e => e.itemId === itemId);
    if (idx === -1) {
      res.status(400).json({ message: "Item not found in inventory" });
      return;
    }
    if (arr[idx].quantity <= 1) {
      arr.splice(idx, 1);
    } else {
      arr[idx].quantity -= 1;
    }
    await inv.save();

    // Grant DC to player
    const User = (await import("../models/User")).default;
    await User.findByIdAndUpdate(req.userId, { $inc: { dc: dcGained } });

    res.json({ message: `Sold ${itemDef.name} for ${dcGained} DC`, dcGained });
  } catch (err) {
    req.log.error({ err }, "loadout sell error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
