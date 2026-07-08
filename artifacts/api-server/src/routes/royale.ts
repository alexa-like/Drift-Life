/**
 * Royale — spin engine for General, Shooting, and Racing wheels.
 * Three spin types, three currency options, pity system, full reward granting.
 */
import { Router } from "express";
import type { RoyaleType } from "../models/RoyaleItem";
import mongoose from "mongoose";
import User, { levelUp } from "../models/User";
import RoyaleItem, { RoyaleTier } from "../models/RoyaleItem";
import PlayerRoyaleLog from "../models/PlayerRoyaleLog";
import PlayerPityCounter from "../models/PlayerPityCounter";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import PlayerGarage from "../models/PlayerGarage";
import MiniGameItem from "../models/MiniGameItem";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// ── Pricing ──────────────────────────────────────────────────────────────────
const SPIN_COSTS: Record<string, Record<string, number>> = {
  general:  { dc: 300, nc: 20,  key: 1 },
  shooting: { dc: 500, nc: 30,  key: 1 },
  racing:   { dc: 500, nc: 30,  key: 1 },
};

// ── Pity thresholds ───────────────────────────────────────────────────────────
const PITY_RARE = 15;   // spins without Rare+ → guarantee Rare+
const PITY_EPIC = 50;   // spins without Epic+ → guarantee Epic+

// ── Tier weights for weighted random ─────────────────────────────────────────
const TIER_WEIGHTS: Record<RoyaleTier, number> = {
  common:    60,
  uncommon:  25,
  rare:      10,
  epic:       4,
  legendary:  1,
};
const TOTAL_WEIGHT = Object.values(TIER_WEIGHTS).reduce((a, b) => a + b, 0); // 100

function rollTier(forceMinTier?: "rare" | "epic"): RoyaleTier {
  if (forceMinTier === "epic") {
    // Must be epic or legendary
    const pool: RoyaleTier[] = ["epic", "legendary"];
    const weights = [TIER_WEIGHTS.epic, TIER_WEIGHTS.legendary];
    const total = weights.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < pool.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return pool[i];
    }
    return "epic";
  }
  if (forceMinTier === "rare") {
    // Must be rare, epic, or legendary
    const pool: RoyaleTier[] = ["rare", "epic", "legendary"];
    const weights = [TIER_WEIGHTS.rare, TIER_WEIGHTS.epic, TIER_WEIGHTS.legendary];
    const total = weights.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < pool.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return pool[i];
    }
    return "rare";
  }

  // Normal roll
  const roll = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  const tiers = Object.entries(TIER_WEIGHTS) as [RoyaleTier, number][];
  for (const [tier, weight] of tiers) {
    cumulative += weight;
    if (roll < cumulative) return tier;
  }
  return "common";
}

// ── Reward granting ───────────────────────────────────────────────────────────
async function grantReward(
  userId: mongoose.Types.ObjectId,
  item: Awaited<ReturnType<typeof RoyaleItem.findOne>>,
  session?: mongoose.ClientSession,
): Promise<void> {
  if (!item) return;
  const r = item.reward;

  // Build user update
  const $inc: Record<string, number> = {};
  const $push: Record<string, unknown> = {};
  const $addToSet: Record<string, unknown> = {};

  if (r.dc && r.dc > 0)               $inc["dc"]         = r.dc;
  if (r.keys && r.keys > 0)           $inc["keys"]       = r.keys;
  if (r.keyShards && r.keyShards > 0) $inc["keyShards"]  = r.keyShards;
  if (r.xp && r.xp > 0)              $inc["xp"]         = r.xp;
  if (r.spinTokens && r.spinTokens > 0) $inc["spinTokens"] = r.spinTokens;

  if (r.energyAmount && r.energyAmount > 0) {
    // Use MongoDB $min to cap at maxEnergy — done below separately
    // We add via updateOne with aggregation pipeline
  }
  if (r.energyMaxBoost && r.energyMaxBoost > 0) {
    // Cap at 300 — done via aggregation pipeline update
  }

  // Collect all cosmetic unlocks into one $addToSet/$each call so multiple
  // types on the same item don't overwrite each other.
  const cosmeticIds: string[] = [];
  if (r.titleId)      cosmeticIds.push(r.titleId);
  if (r.badgeId)      cosmeticIds.push(r.badgeId);
  if (r.backgroundId) cosmeticIds.push(r.backgroundId);
  if (cosmeticIds.length > 0) $addToSet["titles"] = { $each: cosmeticIds };

  if (Object.keys($inc).length > 0 || Object.keys($addToSet).length > 0) {
    const update: Record<string, unknown> = {};
    if (Object.keys($inc).length > 0)      update["$inc"]      = $inc;
    if (Object.keys($addToSet).length > 0) update["$addToSet"] = $addToSet;
    await User.updateOne({ _id: userId }, update, { session });
  }

  // Energy and energyMaxBoost require aggregation pipeline updates (to clamp)
  if (r.energyAmount && r.energyAmount > 0) {
    await User.updateOne(
      { _id: userId },
      [
        {
          $set: {
            energy: { $min: ["$maxEnergy", { $add: ["$energy", r.energyAmount] }] },
          },
        },
      ],
      { session },
    );
  }
  if (r.energyMaxBoost && r.energyMaxBoost > 0) {
    await User.updateOne(
      { _id: userId },
      [
        {
          $set: {
            maxEnergy: { $min: [300, { $add: ["$maxEnergy", r.energyMaxBoost] }] },
          },
        },
      ],
      { session },
    );
  }

  // XP → check level up
  if (r.xp && r.xp > 0) {
    const u = await User.findById(userId).session(session ?? null);
    if (u) {
      levelUp(u);
      await u.save({ session });
    }
  }

  // Mini-game item
  if (r.miniGameItemId) {
    const catalogItem = await MiniGameItem.findOne({ itemId: r.miniGameItemId }).lean();
    if (catalogItem) {
      const categoryField = categoryToField(catalogItem.category);
      await PlayerMiniGameInventory.updateOne(
        { userId },
        {
          $inc: { [`${categoryField}.$[elem].quantity`]: 1 },
        },
        {
          arrayFilters: [{ "elem.itemId": r.miniGameItemId }],
          upsert: false,
          session,
        },
      );
      // Upsert: add new entry if not present
      const inv = await PlayerMiniGameInventory.findOne({ userId }).session(session ?? null);
      if (inv) {
        const arr = (inv as any)[categoryField] as Array<{ itemId: string; quantity: number }>;
        if (!arr.find((e) => e.itemId === r.miniGameItemId)) {
          arr.push({ itemId: r.miniGameItemId!, quantity: 1 });
          await inv.save({ session });
        }
      } else {
        const doc: any = { userId };
        doc[categoryField] = [{ itemId: r.miniGameItemId, quantity: 1 }];
        await PlayerMiniGameInventory.create([doc], { session });
      }
    }
  }

  // Car
  if (r.carId) {
    await PlayerGarage.updateOne(
      { userId },
      {
        $push: {
          cars: {
            carId: r.carId,
            equippedParts: { engine: null, tires: null, nitro: null, bodyKit: null, spoiler: null },
            customization: { paint: "#1a1a2e", underglow: "#00d4ff", decals: "none", rims: "standard" },
            acquiredAt: new Date(),
          },
        },
      },
      { upsert: true, session },
    );
  }

  // Loot crate — stored as a consumable stack in PlayerMiniGameInventory
  // itemId convention: "loot_crate_<tier>" (e.g. "loot_crate_common")
  if (r.lootCrateTier) {
    const crateItemId = `loot_crate_${r.lootCrateTier}`;
    const inv = await PlayerMiniGameInventory.findOne({ userId }).session(session ?? null);
    if (inv) {
      const existing = inv.consumables.find((e) => e.itemId === crateItemId);
      if (existing) {
        existing.quantity += 1;
      } else {
        inv.consumables.push({ itemId: crateItemId, quantity: 1 });
      }
      await inv.save({ session });
    } else {
      await PlayerMiniGameInventory.create(
        [{ userId, weapons: [], armor: [], consumables: [{ itemId: crateItemId, quantity: 1 }], ammo: [] }],
        { session },
      );
    }
  }

  // Car part
  if (r.carPartId) {
    const garage = await PlayerGarage.findOne({ userId }).session(session ?? null);
    if (garage) {
      const existing = garage.parts.find((p) => p.partId === r.carPartId);
      if (existing) {
        existing.quantity += 1;
      } else {
        garage.parts.push({ partId: r.carPartId!, quantity: 1 });
      }
      await garage.save({ session });
    } else {
      await PlayerGarage.create([{ userId, cars: [], parts: [{ partId: r.carPartId, quantity: 1 }], activeCar: null }], { session });
    }
  }
}

function categoryToField(cat: string): string {
  switch (cat) {
    case "weapon":     return "weapons";
    case "armor":      return "armor";
    case "consumable": return "consumables";
    case "ammo":       return "ammo";
    default:           return "consumables";
  }
}

function isRarePlus(tier: RoyaleTier): boolean {
  return tier === "rare" || tier === "epic" || tier === "legendary";
}
function isEpicPlus(tier: RoyaleTier): boolean {
  return tier === "epic" || tier === "legendary";
}

// ── GET /api/royale/items/:type — catalog for a wheel ─────────────────────────
router.get("/items/:type", requireAuth, async (req: AuthRequest, res) => {
  try {
    const type = req.params["type"] as string;
    if (!["general", "shooting", "racing"].includes(type)) {
      res.status(400).json({ message: "Invalid royale type" });
      return;
    }
    const royaleType = type as RoyaleType;
    const items = await RoyaleItem.find({ royaleType, isActive: true })
      .select("name tier itemType imageCard reward dropWeight")
      .lean();
    res.json({ items, costs: SPIN_COSTS[royaleType] });
  } catch (err) {
    req.log.error({ err }, "royale items error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/royale/pity — player's pity counters ────────────────────────────
router.get("/pity", requireAuth, async (req: AuthRequest, res) => {
  try {
    const counters = await PlayerPityCounter.find({ userId: req.userId }).lean();
    const result: Record<string, { spinsSinceLastRare: number; spinsSinceLastEpic: number }> = {};
    for (const c of counters) {
      result[c.royaleType] = {
        spinsSinceLastRare: c.spinsSinceLastRare,
        spinsSinceLastEpic: c.spinsSinceLastEpic,
      };
    }
    res.json({ pity: result });
  } catch (err) {
    req.log.error({ err }, "royale pity error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/royale/spin ────────────────────────────────────────────────────
router.post("/spin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { royaleType, currency, count } = req.body as {
      royaleType: "general" | "shooting" | "racing";
      currency: "dc" | "nc" | "key";
      count: 1 | 10;
    };

    if (!["general", "shooting", "racing"].includes(royaleType)) {
      res.status(400).json({ message: "Invalid royale type" });
      return;
    }
    if (!["dc", "nc", "key"].includes(currency)) {
      res.status(400).json({ message: "Invalid currency" });
      return;
    }
    if (count !== 1 && count !== 10) {
      res.status(400).json({ message: "Count must be 1 or 10" });
      return;
    }

    const singleCost = SPIN_COSTS[royaleType][currency];
    // 10× spin = 9× single cost (1 free spin)
    const totalCost = count === 10 ? singleCost * 9 : singleCost;

    // ── Validate & atomically deduct currency ─────────────────────────────────
    const currencyField = currency === "key" ? "keys" : currency;
    const deductFilter: Record<string, unknown> = {
      _id: req.userId,
      [currencyField]: { $gte: totalCost },
    };
    const deducted = await User.findOneAndUpdate(
      deductFilter,
      { $inc: { [currencyField]: -totalCost } },
      { new: false },
    );
    if (!deducted) {
      const u = await User.findById(req.userId).select(currencyField).lean();
      if (!u) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.status(400).json({ message: `Insufficient ${currency.toUpperCase()} — need ${totalCost.toLocaleString()}` });
      return;
    }

    // ── Load all active items for this wheel (keyed by tier) ──────────────────
    const allItems = await RoyaleItem.find({ royaleType, isActive: true }).lean();
    const itemsByTier: Record<RoyaleTier, typeof allItems> = {
      common: [], uncommon: [], rare: [], epic: [], legendary: [],
    };
    for (const item of allItems) {
      itemsByTier[item.tier].push(item);
    }

    // Check we actually have items
    if (allItems.length === 0) {
      // Refund and bail
      await User.updateOne({ _id: req.userId }, { $inc: { [currencyField]: totalCost } });
      res.status(503).json({ message: "Royale wheel not available yet — items not seeded" });
      return;
    }

    // ── Load / create pity counter ────────────────────────────────────────────
    let pity = await PlayerPityCounter.findOne({ userId: req.userId, royaleType });
    if (!pity) {
      pity = await PlayerPityCounter.create({
        userId: req.userId,
        royaleType,
        spinsSinceLastRare: 0,
        spinsSinceLastEpic: 0,
      });
    }

    // ── Perform spins ─────────────────────────────────────────────────────────
    const wonItems: Array<{ name: string; tier: string; itemType: string; imageCard: string; reward: Record<string, unknown> }> = [];
    let guaranteedRareUsed = count === 10; // 10× always guarantees one Rare+

    for (let i = 0; i < count; i++) {
      // Pity checks
      let forceMinTier: "rare" | "epic" | undefined;
      if (pity.spinsSinceLastEpic >= PITY_EPIC) {
        forceMinTier = "epic";
      } else if (pity.spinsSinceLastRare >= PITY_RARE) {
        forceMinTier = "rare";
      } else if (guaranteedRareUsed && i === count - 1) {
        // Last spin of 10× guarantees Rare+
        forceMinTier = "rare";
        guaranteedRareUsed = false;
      }

      const tier = rollTier(forceMinTier);

      // Pick random item from tier (by dropWeight)
      let pool = itemsByTier[tier];
      if (pool.length === 0) {
        // Fallback to common if tier is empty
        pool = itemsByTier.common.length > 0 ? itemsByTier.common : allItems;
      }
      const totalPoolWeight = pool.reduce((s, item) => s + item.dropWeight, 0);
      let pick = Math.random() * totalPoolWeight;
      let chosen = pool[0];
      for (const item of pool) {
        pick -= item.dropWeight;
        if (pick <= 0) { chosen = item; break; }
      }

      // Grant reward
      await grantReward(
        deducted._id as mongoose.Types.ObjectId,
        chosen as any,
      );

      // Update pity
      if (isEpicPlus(chosen.tier)) {
        pity.spinsSinceLastRare = 0;
        pity.spinsSinceLastEpic = 0;
      } else if (isRarePlus(chosen.tier)) {
        pity.spinsSinceLastRare = 0;
        pity.spinsSinceLastEpic += 1;
      } else {
        pity.spinsSinceLastRare += 1;
        pity.spinsSinceLastEpic += 1;
      }

      wonItems.push({
        name: chosen.name,
        tier: chosen.tier,
        itemType: chosen.itemType,
        imageCard: chosen.imageCard,
        reward: chosen.reward as any,
      });
    }

    // Save pity counter
    await pity.save();

    // Log spin
    await PlayerRoyaleLog.create({
      userId: req.userId,
      royaleType,
      currency,
      spinsCount: count,
      costPaid: totalCost,
      results: wonItems.map((w) => w.name),
    });

    // Return refreshed balances
    const refreshed = await User.findById(req.userId)
      .select("dc nc keys keyShards energy maxEnergy xp level titles")
      .lean();

    res.json({
      wonItems,
      pity: {
        spinsSinceLastRare: pity.spinsSinceLastRare,
        spinsSinceLastEpic: pity.spinsSinceLastEpic,
      },
      balances: refreshed
        ? {
            dc: refreshed.dc,
            nc: refreshed.nc,
            keys: refreshed.keys,
            keyShards: refreshed.keyShards,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "royale spin error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
