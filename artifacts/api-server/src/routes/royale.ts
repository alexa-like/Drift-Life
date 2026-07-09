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
import { fireMissionEvent } from "../lib/missionEvents";
import { checkAchievements } from "./achievements";
import { postToSystemFeed } from "../lib/systemFeed";

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

// ── Tier weights — defaults + runtime-adjustable cache ───────────────────────
import ServerConfig from "../models/ServerConfig";

const DEFAULT_TIER_WEIGHTS: Record<RoyaleTier, number> = {
  common:    60,
  uncommon:  25,
  rare:      10,
  epic:       4,
  legendary:  1,
};

let _activeTierWeights: Record<RoyaleTier, number> = { ...DEFAULT_TIER_WEIGHTS };
let _tierWeightsCacheTs = 0;
const TIER_WEIGHTS_TTL = 30_000; // 30 seconds

/** Refresh tier weights from ServerConfig if cache is stale. */
async function refreshTierWeights(): Promise<void> {
  const now = Date.now();
  if (now - _tierWeightsCacheTs < TIER_WEIGHTS_TTL) return;
  try {
    const cfg = await ServerConfig.findOne({ key: "royaleTierWeights" }).lean();
    if (cfg?.value && typeof cfg.value === "object") {
      _activeTierWeights = { ...DEFAULT_TIER_WEIGHTS, ...(cfg.value as Record<RoyaleTier, number>) };
    } else {
      _activeTierWeights = { ...DEFAULT_TIER_WEIGHTS };
    }
  } catch { /* keep existing cache on DB error */ }
  _tierWeightsCacheTs = now;
}

/** Check if the NC royale-drop special event is currently active. */
async function isNcEventActive(): Promise<boolean> {
  try {
    const cfg = await ServerConfig.findOne({ key: "specialEvent" }).lean();
    if (!cfg?.value) return false;
    const ev = cfg.value as { active?: boolean; type?: string; expiresAt?: string };
    if (!ev.active || ev.type !== "nc_royale_drop") return false;
    if (ev.expiresAt && new Date(ev.expiresAt) < new Date()) return false;
    return true;
  } catch { return false; }
}

function rollTier(weights: Record<RoyaleTier, number>, forceMinTier?: "rare" | "epic"): RoyaleTier {
  if (forceMinTier === "epic") {
    const pool: RoyaleTier[] = ["epic", "legendary"];
    const ws = [weights.epic, weights.legendary];
    const total = ws.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < pool.length; i++) {
      cumulative += ws[i];
      if (roll < cumulative) return pool[i];
    }
    return "epic";
  }
  if (forceMinTier === "rare") {
    const pool: RoyaleTier[] = ["rare", "epic", "legendary"];
    const ws = [weights.rare, weights.epic, weights.legendary];
    const total = ws.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < pool.length; i++) {
      cumulative += ws[i];
      if (roll < cumulative) return pool[i];
    }
    return "rare";
  }

  // Normal roll
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  const tiers = Object.entries(weights) as [RoyaleTier, number][];
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

// ── GET /api/royale/pools/:category — pool contents with probabilities ────────
router.get("/pools/:category", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category } = req.params;
    const [dcItems, masterItems] = await Promise.all([
      RoyaleItem.find({ royaleCategory: category as any, spinType: "dc_spin" as any, isActive: true }).lean(),
      RoyaleItem.find({ royaleCategory: category as any, spinType: "master_royale" as any, isActive: true }).lean(),
    ]);

    function addProbabilities(items: any[]) {
      const total = items.reduce((s, i) => s + (i.dropWeight ?? 1), 0);
      return items.map(i => ({ ...i, probability: total > 0 ? (i.dropWeight / total) * 100 : 0 }));
    }

    res.json({ dcSpin: addProbabilities(dcItems), masterRoyale: addProbabilities(masterItems) });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/royale/spin ────────────────────────────────────────────────────
router.post("/spin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { royaleType, category, spinType, currency, count } = req.body as {
      royaleType: "general" | "shooting" | "racing";
      category?: string;
      spinType?: string;
      currency: "dc" | "nc" | "key";
      count: 1 | 10;
    };

    // ── New-style category+spinType spin ──────────────────────────────────────
    if (category && spinType) {
      const validCategories = ["pistols","smgs","assault_rifles","shotguns","sniper_rifles","lmgs","body_armor","consumables","ammo","race_cars","car_parts"];
      const validSpinTypes = ["dc_spin","master_royale"];
      if (!validCategories.includes(category)) { res.status(400).json({ message: "Invalid category" }); return; }
      if (!validSpinTypes.includes(spinType)) { res.status(400).json({ message: "Invalid spinType" }); return; }

      // Cost check
      const user = await User.findById(req.userId).select("dc nc keys keyShards");
      if (!user) { res.status(404).json({ message: "User not found" }); return; }

      if (spinType === "dc_spin") {
        if (user.dc < 500) { res.status(400).json({ message: "Not enough DC. DC Spin costs 500 DC." }); return; }
        await User.findByIdAndUpdate(req.userId, { $inc: { dc: -500 } });
      } else {
        if (user.nc < 20 || user.keys < 1) { res.status(400).json({ message: "Not enough NC or Keys. Master Royale costs 20 NC + 1 Key." }); return; }
        await User.findByIdAndUpdate(req.userId, { $inc: { nc: -20, keys: -1 } });
      }

      // Fetch pool
      const pool = await RoyaleItem.find({ royaleCategory: category as any, spinType: spinType as any, isActive: true }).lean();
      if (!pool || pool.length === 0) {
        const refund = spinType === "dc_spin" ? { dc: 500 } : { nc: 20, keys: 1 };
        await User.findByIdAndUpdate(req.userId, { $inc: refund });
        res.status(400).json({ message: "Royale pool not seeded yet for this category. Please try again later." }); return;
      }

      // Weighted random selection
      const totalWeight = pool.reduce((sum, item) => sum + (item.dropWeight ?? 1), 0);
      let roll = Math.random() * totalWeight;
      let won = pool[pool.length - 1];
      for (const item of pool) {
        roll -= item.dropWeight ?? 1;
        if (roll <= 0) { won = item; break; }
      }

      // Grant item to arena inventory
      const MiniGameItemModel = (await import("../models/MiniGameItem")).default;
      const PlayerMiniGameInventoryModel = (await import("../models/PlayerMiniGameInventory")).default;

      const itemDef = won.itemRef ? await MiniGameItemModel.findOne({ itemId: won.itemRef }).lean() : null;

      if (itemDef) {
        await PlayerMiniGameInventoryModel.findOneAndUpdate(
          { userId: req.userId },
          { $setOnInsert: { userId: req.userId } },
          { upsert: true, new: true }
        );

        const cat = (itemDef as any).category;
        const isPrimary = ["assault_rifle","shotgun","sniper_rifle","lmg"].includes(cat);
        const isSecondary = ["pistol","smg"].includes(cat);
        const isArmor = cat === "body_armor";
        const isConsumable = cat === "consumable";
        const isAmmo = cat?.endsWith("_rounds") || cat === "shotgun_shells";

        if (isPrimary || isSecondary) {
          const slot = isPrimary ? "primaryWeapons" : "secondaryWeapons";
          await PlayerMiniGameInventoryModel.findOneAndUpdate(
            { userId: req.userId },
            { $push: { [slot]: { itemId: won.itemRef, durability: (itemDef as any).maxDurability ?? 100 } } }
          );
        } else if (isArmor) {
          await PlayerMiniGameInventoryModel.findOneAndUpdate(
            { userId: req.userId },
            { $push: { bodyArmors: { itemId: won.itemRef, durability: (itemDef as any).maxDurability ?? 100 } } }
          );
        } else if (isConsumable) {
          const inv = await PlayerMiniGameInventoryModel.findOne({ userId: req.userId }).lean();
          const existing = (inv as any)?.consumables?.find((c: any) => c.itemId === won.itemRef);
          if (existing) {
            await PlayerMiniGameInventoryModel.findOneAndUpdate(
              { userId: req.userId, "consumables.itemId": won.itemRef },
              { $inc: { "consumables.$.quantity": 1 } }
            );
          } else {
            await PlayerMiniGameInventoryModel.findOneAndUpdate(
              { userId: req.userId },
              { $push: { consumables: { itemId: won.itemRef, quantity: 1 } } }
            );
          }
        } else if (isAmmo) {
          const ammoCategory = (itemDef as any).ammoCategory ?? cat;
          const magazineSize = (itemDef as any).magazineSize ?? 10;
          await PlayerMiniGameInventoryModel.findOneAndUpdate(
            { userId: req.userId },
            { $inc: { ["ammo." + ammoCategory]: magazineSize } }
          );
        }
      }

      // Grant car or car part (for race_cars / car_parts category pools)
      // itemRef is null for these; rewards are carried in won.reward.carId / .carPartId
      if (!itemDef) {
        const carId = (won.reward as any)?.carId as string | undefined;
        const carPartId = (won.reward as any)?.carPartId as string | undefined;

        if (carId) {
          await PlayerGarage.updateOne(
            { userId: req.userId },
            {
              $push: {
                cars: {
                  carId,
                  equippedParts: { engine: null, tires: null, nitro: null, bodyKit: null, spoiler: null },
                  customization: { paint: "#1a1a2e", underglow: "#00d4ff", decals: "none", rims: "standard" },
                  acquiredAt: new Date(),
                },
              },
            },
            { upsert: true },
          );
        } else if (carPartId) {
          const garage = await PlayerGarage.findOne({ userId: req.userId });
          if (garage) {
            const existingPart = garage.parts.find((p: any) => p.partId === carPartId);
            if (existingPart) {
              existingPart.quantity += 1;
            } else {
              garage.parts.push({ partId: carPartId, quantity: 1 });
            }
            await garage.save();
          } else {
            await PlayerGarage.create({
              userId: req.userId,
              cars: [],
              parts: [{ partId: carPartId, quantity: 1 }],
              activeCar: null,
            });
          }
        }
      }

      // Auto key-shard conversion
      const updatedUser = await User.findById(req.userId).select("keyShards keys dc nc username");
      if (updatedUser && updatedUser.keyShards >= 20) {
        const keysToAdd = Math.floor(updatedUser.keyShards / 20);
        await User.findByIdAndUpdate(req.userId, {
          $inc: { keyShards: -(keysToAdd * 20), keys: keysToAdd }
        });
      }

      // System feed post for epic/legendary wins from master_royale only
      if (spinType === "master_royale" && (won.tier === "epic" || won.tier === "legendary") && updatedUser) {
        await postToSystemFeed(
          "royale",
          `@${updatedUser.username} pulled a ${won.tier === "legendary" ? "Legendary" : "Rare Epic"} ${won.name} from the ${category} Master Royale! :jackpot:`,
          [updatedUser.username],
        );
      }

      const finalUser = await User.findById(req.userId).select("dc nc keys keyShards");

      res.json({
        won: {
          itemId: won.itemRef,
          name: won.name,
          tier: won.tier,
          category: category,
          itemType: won.itemType,
        },
        updatedBalances: {
          dc: finalUser?.dc,
          nc: finalUser?.nc,
          keys: finalUser?.keys,
          keyShards: finalUser?.keyShards,
        }
      });
      return;
    }
    // ── End new-style spin ────────────────────────────────────────────────────

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

    // Refresh dynamic tier weights + check NC event (non-blocking on failure)
    await refreshTierWeights();
    const ncEventActive = await isNcEventActive();

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

      const tier = rollTier(_activeTierWeights, forceMinTier);

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

    // ── Special event: NC royale drop (5% chance per spin when active) ────────
    if (ncEventActive) {
      const ncBonus = wonItems.reduce((bonus) => {
        return bonus + (Math.random() < 0.05 ? 10 : 0);
      }, 0);
      if (ncBonus > 0) {
        await User.updateOne({ _id: req.userId }, { $inc: { nc: ncBonus } });
        wonItems.push({
          name: `+${ncBonus} NC (Event Bonus)`,
          tier: "rare",
          itemType: "currency",
          imageCard: "",
          reward: { type: "nc", amount: ncBonus },
        });
      }
    }

    // System feed post for epic/legendary wins from master_royale (old-style spin)
    // Old-style spin uses royaleType+currency — treat key-currency as master_royale equivalent
    if (currency === "key") {
      for (const w of wonItems) {
        if (w.tier === "epic" || w.tier === "legendary") {
          await postToSystemFeed(
            "royale",
            `@${deducted.username} pulled a ${w.tier === "legendary" ? "Legendary" : "Rare Epic"} ${w.name} from the ${royaleType} Master Royale! :jackpot:`,
            [deducted.username],
          );
        }
      }
    }

    // Log spin + track total spins on user
    await Promise.all([
      PlayerRoyaleLog.create({
        userId: req.userId,
        royaleType,
        currency,
        spinsCount: count,
        costPaid: totalCost,
        results: wonItems.map((w) => w.name),
      }),
      User.updateOne({ _id: req.userId }, { $inc: { totalRoyaleSpins: count } }),
    ]);

    // Fire mission event (non-fatal)
    fireMissionEvent(String(req.userId), "royale_spin", count).catch(() => {});
    checkAchievements(String(req.userId)).catch(() => {});

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
