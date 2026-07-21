import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";
import { rollEncounter, resolveEncounter, EncounterKind } from "../lib/npcEncounters";
import EventModel from "../models/Event";

const router = Router();

export const DISTRICTS = [
  { id: "neon_strip", name: "Neon Strip",       faction: "neutral",      dangerLevel: 1, travelEnergyCost: 5,  minLevel: 5,  color: "#ff00cc", primaryActivity: "Entertainment district. Clubs, gambling dens, underground pharmacy.", description: "Neon lights, music, and deals that look legitimate. Easy pickings if you know where to look.", npcs: ["Club Promoter", "Gig Worker", "Underground Dealer"] },
  { id: "docks",      name: "The Docks",        faction: "street",       dangerLevel: 2, travelEnergyCost: 8,  minLevel: 10, color: "#00aaff", primaryActivity: "Smugglers and import brokers. Things fall off ships here.",           description: "Things fall off ships here. Everyone looks the other way.",                     npcs: ["Sal the Broker", "Dock Enforcer", "Harbor Rat"] },
  { id: "slums",      name: "The Slums",        faction: "street",       dangerLevel: 3, travelEnergyCost: 10, minLevel: 15, color: "#ff6b35", primaryActivity: "Poverty and desperation. Cheap goods, street crime, gang territory.", description: "Poverty breeds danger. The gangs run everything and nobody asks questions.",    npcs: ["Gang Captain", "Street Doc", "Fence"] },
  { id: "corp_zone",  name: "Corporate Zone",   faction: "suits",        dangerLevel: 2, travelEnergyCost: 12, minLevel: 20, color: "#f59e0b", primaryActivity: "Glass towers and private security. Expensive, clean, dangerous in a different way.", description: "Glass towers and private security. Everything here costs more than you think.", npcs: ["Corporate Fixer", "Security Guard", "Data Broker"] },
  { id: "industrial", name: "Industrial Sector",faction: "neutral",      dangerLevel: 4, travelEnergyCost: 15, minLevel: 25, color: "#888888", primaryActivity: "Factories and workshops. Black market parts, dirty jobs.",            description: "Factories and workshops. Black market parts and dirty jobs for those who ask.", npcs: ["Chop Shop Owner", "Arms Dealer", "Mechanic"] },
  { id: "outskirts",  name: "The Outskirts",    faction: "uncontrolled", dangerLevel: 5, travelEnergyCost: 20, minLevel: 35, color: "#ff2d55", primaryActivity: "City's edge. Lawless. Best loot, worst odds.",                        description: "Beyond the walls. No laws. No safety nets. Only predators.",                   npcs: ["Syndicate Boss", "Rogue AI Unit", "Wasteland Raider"] },
];

// District shop inventories — static catalog, restocks every 8 hours
// ABSOLUTE RULE: No Epic or Legendary items. Rare only in Docks (rotation), Industrial, Outskirts.
const DISTRICT_SHOPS: Record<string, {
  shopName: string;
  keeper: string;
  tagline: string;
  restockHours: number;
  items: Array<{ id: string; name: string; price: number; rarity: "common" | "uncommon" | "rare"; effect: string; notes?: string }>;
  rotatingPool?: Array<{ id: string; name: string; price: number; rarity: "common" | "uncommon" | "rare"; effect: string; notes?: string }>;
  rotationCount?: number;
}> = {
  neon_strip: {
    shopName: "Underground Pharmacy",
    keeper: "Doc Reyes",
    tagline: "The strip runs 24/7.",
    restockHours: 8,
    items: [
      { id: "synthetic_stimpack", name: "Synthetic Stimpack", price: 1200, rarity: "common",   effect: "energy:30",    notes: "+30 Energy instantly" },
      { id: "black_market_stim",    name: "Black Market Stim",    price: 2500, rarity: "uncommon", effect: "energy:50",    notes: "+50 Energy" },
      { id: "designer_nitro",       name: "Designer Nitro",       price: 1200, rarity: "common",   effect: "nitro:+3",         notes: "+3 Nitro instantly" },
      { id: "euphoria_pill",        name: "Euphoria Pill",        price:  800, rarity: "common",   effect: "xp_bonus:15",      notes: "+15% XP gain for next crime" },
      { id: "inhibitor_patch",      name: "Inhibitor Patch",      price:  600, rarity: "common",   effect: "prevent_hosp:1",   notes: "Prevents hospitalization from next danger roll (1 use)" },
    ],
  },
  docks: {
    shopName: "Smuggler's Manifest",
    keeper: "Sal the Broker",
    tagline: "Rotating stock. Not everything is available.",
    restockHours: 8,
    items: [],
    rotatingPool: [
      { id: "dockside_pistol",    name: "Dockside Pistol",    price: 3000, rarity: "uncommon", effect: "arena_weapon",      notes: "Arena weapon — requires arena loadout" },
      { id: "cargo_armor_plates", name: "Cargo Armor Plates", price: 4500, rarity: "uncommon", effect: "arena_armor",       notes: "Arena body armor" },
      { id: "contraband_stim",    name: "Contraband Stim",    price: 1800, rarity: "common",   effect: "energy:30",     notes: "+30 Energy" },
      { id: "imported_nitro_can", name: "Imported Nitro Can", price: 1800, rarity: "common",   effect: "nitro:+3",          notes: "+3 Nitro" },
      { id: "grey_market_parts",  name: "Grey Market Parts",  price: 2000, rarity: "uncommon", effect: "car_repair",        notes: "Car part for Garage repair" },
      { id: "dock_pass",          name: "Dock Pass",          price:  500, rarity: "common",   effect: "travel_discount:80:docks", notes: "Reduces travel time to Docks by 80% on next trip" },
    ],
    rotationCount: 4,
  },
  slums: {
    shopName: "Scrap Market",
    keeper: "Reya",
    tagline: "Cheap, low-quality. Volume goods.",
    restockHours: 8,
    items: [
      { id: "street_stim",         name: "Street Stim",         price:  400, rarity: "common", effect: "energy:10",          notes: "+10 Energy" },
      { id: "scrap_nitro",         name: "Scrap Nitro",          price:  400, rarity: "common", effect: "nitro:+1",               notes: "+1 Nitro" },
      { id: "junkyard_part",       name: "Junkyard Part",        price:  800, rarity: "common", effect: "car_repair:5",           notes: "Car part (restores 5% car condition)" },
      { id: "dirty_energy_drink",  name: "Dirty Energy Drink",   price:  300, rarity: "common", effect: "energy:+2;hosp_risk:10", notes: "+2 Energy — 10% chance of 3min hospitalization" },
      { id: "throwaway_phone",     name: "Throwaway Phone",      price: 1000, rarity: "common", effect: "jail_reduction:30",      notes: "Next crime failure has 30% less jail time" },
    ],
  },
  corp_zone: {
    shopName: "Apex Imports",
    keeper: "Miriam Chen",
    tagline: "Premium items. Security checks apply.",
    restockHours: 8,
    items: [
      { id: "apex_med_suite",    name: "Apex Med Suite",    price: 6000, rarity: "uncommon", effect: "clear_hospital",         notes: "Instantly leave hospital (DC-based full early release)" },
      { id: "executive_stim",    name: "Executive Stim",    price: 4000, rarity: "uncommon", effect: "energy:50;xp_bonus_arena:5:2", notes: "+50 Energy + +5% XP for next 2 arena matches" },
      { id: "premium_nitro",     name: "Premium Nitro",     price: 4000, rarity: "uncommon", effect: "nitro:+5;xp_bonus_race:5:2",       notes: "+5 Nitro + +5% XP for next 2 races" },
      { id: "security_implant",  name: "Security Implant",  price: 8000, rarity: "uncommon", effect: "mug_reduction:10",       notes: "Permanent −10% mug chance when equipped (enhancement slot)" },
      { id: "corp_data_chip",    name: "Corp Data Chip",    price: 3000, rarity: "uncommon", effect: "espionage_job:1",         notes: "1 Corp espionage job attempt (special high-reward job, abroad only)" },
    ],
  },
  industrial: {
    shopName: "The Workshop",
    keeper: "Vik Mends",
    tagline: "Parts and weapons. He doesn't ask questions.",
    restockHours: 8,
    items: [
      { id: "reinforced_barrel",  name: "Reinforced Barrel",  price: 12000, rarity: "rare",     effect: "arena_attachment:damage", notes: "Arena weapon attachment (boosts damage)" },
      { id: "titanium_frame",     name: "Titanium Frame",     price: 14000, rarity: "rare",     effect: "arena_armor_reinforce",   notes: "Arena body armor reinforcement" },
      { id: "industrial_fuel_cell", name: "Industrial Fuel Cell", price: 2500, rarity: "uncommon", effect: "nitro:+5;travel_time:-50:next", notes: "+5 Nitro + vehicle travel time −50% for next trip" },
      { id: "combat_injector",    name: "Combat Injector",    price:  2000, rarity: "common",   effect: "energy:40",           notes: "+40 Energy" },
      { id: "salvage_kit",        name: "Salvage Kit",        price:  3000, rarity: "uncommon", effect: "arena_repair:20",         notes: "Repairs arena weapon/armor durability +20 points" },
    ],
  },
  outskirts: {
    shopName: "Black Veil",
    keeper: "Anonymous",
    tagline: "Payment in DC. No receipts. No names.",
    restockHours: 8,
    items: [
      { id: "ghost_pistol",        name: "Ghost Pistol",        price: 18000, rarity: "rare", effect: "arena_weapon:top",     notes: "Top-tier arena pistol" },
      { id: "exo_chest_fragment",  name: "Exo Chest Fragment",  price: 20000, rarity: "rare", effect: "arena_armor:high",     notes: "High-tier arena armor" },
      { id: "overload_stim",       name: "Overload Stim",       price:  6000, rarity: "rare", effect: "energy:50;stun_immune:1", notes: "+50 Energy + stun immunity for first round of next match" },
      { id: "outskirts_nitro",     name: "Outskirts Nitro",     price:  5000, rarity: "rare", effect: "nitro:+5;travel_time:-60000", notes: "+5 Nitro + −1 min from next travel" },
      { id: "void_key_shards",     name: "Void Key Shard ×5",   price:  8000, rarity: "rare", effect: "key_shards:5",         notes: "Bonus key shards — shortcut toward Master Royale" },
    ],
  },
};

// In-memory restock timestamps (resets on server restart — acceptable for 8h cadence)
const districtRestockTimes: Record<string, number> = {};

function getDistrictShopInventory(slug: string): typeof DISTRICT_SHOPS[string]["items"] {
  const shop = DISTRICT_SHOPS[slug];
  if (!shop) return [];

  // For rotating pools (e.g. docks), pick N random items on each restock window
  if (shop.rotatingPool && shop.rotationCount) {
    const now = Date.now();
    const restockMs = shop.restockHours * 60 * 60 * 1000;
    const lastRestock = districtRestockTimes[slug] ?? 0;

    if (now - lastRestock >= restockMs) {
      districtRestockTimes[slug] = now;
    }

    // Use a deterministic window seed so all players see the same rotation
    const windowSeed = Math.floor((districtRestockTimes[slug] || now) / restockMs);
    const seededPool = [...shop.rotatingPool].sort((a, b) => {
      const ha = simpleHash(a.id + windowSeed);
      const hb = simpleHash(b.id + windowSeed);
      return ha - hb;
    });
    return seededPool.slice(0, shop.rotationCount);
  }

  return shop.items;
}

function simpleHash(str: string | number): number {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

// GET /api/districts
router.get("/", requireAuth, async (_req, res) => {
  try {
    const counts = await User.aggregate([
      { $match: { banned: false, isEmailVerified: true } },
      { $group: { _id: "$district", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) if (c._id) countMap[c._id] = c.count;
    res.json(DISTRICTS.map(d => ({ ...d, population: countMap[d.id] || 0 })));
  } catch {
    res.json(DISTRICTS.map(d => ({ ...d, population: 0 })));
  }
});

// GET /api/districts/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const district = DISTRICTS.find(d => d.id === req.params.id);
  if (!district) return res.status(404).json({ message: "District not found" });
  const population = await User.countDocuments({ district: req.params.id, banned: false });
  res.json({ ...district, population });
});

// POST /api/districts/:id/travel
router.post("/:id/travel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const district = DISTRICTS.find(d => d.id === req.params.id);
    if (!district) return res.status(404).json({ message: "District not found" });

    // Read user for preliminary checks only — regen computed DB-side below
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user); // in-memory for checks only — not saved

    if (user.district === district.id) return res.status(400).json({ message: "You are already in this district" });
    // 403 for level-lock per spec 9.3
    if (user.level < district.minLevel) return res.status(403).json({ message: `You don't have the rep to survive ${district.name} yet. Come back at level ${district.minLevel}.` });
    if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) return res.status(400).json({ message: "Cannot travel while hospitalized" });

    // Wire vehicle travelTimeReduction into travel time
    let reductionPct = 0;
    if (user.equippedVehicle) {
      const vehicle = await Item.findById(user.equippedVehicle).lean();
      if (vehicle && vehicle.travelTimeReduction) {
        reductionPct = vehicle.travelTimeReduction;
      }
    }
    const BASE_TRAVEL_MS = 10 * 60 * 1000; // 10 minutes base
    const travelMs = Math.round(BASE_TRAVEL_MS * (1 - reductionPct / 100));

    // FULLY ATOMIC: regen computed server-side; $expr checks effective energy before deducting
    const updated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        ...energySufficientExpr(district.travelEnergyCost),
      },
      buildRegenPipeline({
        energyCost: district.travelEnergyCost,
        extraSet:   {
          district:        district.id,
          status:          "traveling",
          travelingTo:     district.id,
          travelArrivesAt: new Date(Date.now() + travelMs),
          currentLocation: user.currentLocation ?? "downtown",
        },
      }),
      { returnDocument: 'after', updatePipeline: true },
    );

    if (!updated) {
      return res.status(400).json({
        message: `Not enough energy. Travel to ${district.name} costs ${district.travelEnergyCost} energy.`,
      });
    }

    // ── NPC Encounter Roll (15% chance) ──────────────────────────────────────
    let encounter = null;
    try {
      const now2 = new Date();
      const activeEvent = await EventModel.findOne({ status: "active", startsAt: { $lte: now2 }, endsAt: { $gt: now2 } })
        .select("eventType").lean();
      const hasActiveBossEvent = (activeEvent as any)?.eventType === "boss_raid";

      encounter = await rollEncounter({
        userId: String(req.userId),
        level: updated.level,
        strength: updated.strength,
        intelligence: updated.intelligence,
        dc: updated.dc,
        district: district.id,
        hasActiveBossEvent,
      });

      // Store player-choice encounters so they can be resolved via the resolve-encounter endpoint
      if (encounter?.options) {
        const kindMap: Record<string, string> = {
          mugger: "mugger",
          police_checkpoint: "checkpoint",
          black_market_trader: "black_market",
        };
        const storedKind = kindMap[encounter.kind] ?? "mugger";
        await User.findByIdAndUpdate(req.userId, {
          $set: {
            pendingEncounter: {
              kind: storedKind,
              data: encounter.immediateEffects ?? {},
              expiresAt: new Date(Date.now() + (encounter.expiresInMs ?? 5 * 60_000)),
            },
            lastEncounterAt: new Date(),
          },
        });
      } else if (encounter) {
        // Immediate-effect encounter — just mark the time
        await User.findByIdAndUpdate(req.userId, { $set: { lastEncounterAt: new Date() } });
      }
    } catch {
      // Encounter roll is non-critical — travel still succeeds
      encounter = null;
    }

    res.json({
      message: `Traveling to ${district.name} — arriving in ${Math.ceil(travelMs / 1000)}s`,
      district: district.id,
      energyCost: district.travelEnergyCost,
      travelArrivesAt: updated.travelArrivesAt,
      travelTimeReductionPct: reductionPct,
      encounter,
      user: {
        energy:          updated.energy,
        maxEnergy:       updated.maxEnergy,
        district:        updated.district,
        status:          updated.status,
        currentLocation: updated.currentLocation,
        travelingTo:     updated.travelingTo,
        travelArrivesAt: updated.travelArrivesAt,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "travel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/districts/return-home — travel back to downtown from abroad (Section 9.8)
router.post("/return-home", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user); // in-memory for checks only — not saved

    if (user.status !== "abroad") {
      return res.status(400).json({ message: "You are not abroad — nothing to return home from" });
    }
    if (user.hospitalizedUntil && user.hospitalizedUntil > new Date()) {
      return res.status(400).json({ message: "Cannot travel while hospitalized" });
    }

    // Same vehicle-based travel time formula as outbound travel (Section 1.9)
    let reductionPct = 0;
    if (user.equippedVehicle) {
      const vehicle = await Item.findById(user.equippedVehicle).lean();
      if (vehicle && vehicle.travelTimeReduction) {
        reductionPct = vehicle.travelTimeReduction;
      }
    }
    const BASE_TRAVEL_MS = 10 * 60 * 1000; // 10 minutes base
    const travelMs = Math.round(BASE_TRAVEL_MS * (1 - reductionPct / 100));

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, status: "abroad" },
      {
        $set: {
          district:        "downtown",
          status:          "traveling",
          travelingTo:     "downtown",
          travelArrivesAt: new Date(Date.now() + travelMs),
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) {
      return res.status(400).json({ message: "You are not abroad — nothing to return home from" });
    }

    res.json({
      message: `Heading back to Downtown — arriving in ${Math.ceil(travelMs / 1000)}s`,
      travelArrivesAt: updated.travelArrivesAt,
      travelTimeReductionPct: reductionPct,
      user: {
        district:        updated.district,
        status:          updated.status,
        currentLocation: updated.currentLocation,
        travelingTo:     updated.travelingTo,
        travelArrivesAt: updated.travelArrivesAt,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "return-home error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/districts/:slug/shop — district shop inventory
// Requires player to be abroad in that district (status === "abroad" && currentLocation === slug)
router.get("/:slug/shop", requireAuth, async (req: AuthRequest, res) => {
  try {
    const slug = req.params["slug"] as string;
    const shop = DISTRICT_SHOPS[slug];
    if (!shop) return res.status(404).json({ message: "No shop in this district" });

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user as any).status !== "abroad") {
      return res.status(403).json({ message: "You must be in this district to browse its shop" });
    }
    if ((user as any).currentLocation !== slug) {
      return res.status(403).json({ message: `You are not in ${slug}. Travel there first.` });
    }

    const inventory = getDistrictShopInventory(slug);
    const restockMs = shop.restockHours * 60 * 60 * 1000;
    const lastRestock = districtRestockTimes[slug] ?? Date.now();
    const restocksAt = new Date(lastRestock + restockMs);

    res.json({
      slug,
      shopName: shop.shopName,
      keeper: shop.keeper,
      tagline: shop.tagline,
      restocksAt,
      restockHours: shop.restockHours,
      items: inventory,
    });
  } catch (err: any) {
    req.log.error({ err }, "district shop get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/districts/:slug/shop/buy — purchase item from district shop
router.post("/:slug/shop/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const slug = req.params["slug"] as string;
    const { itemId } = req.body as { itemId: string };

    if (!itemId) return res.status(400).json({ message: "itemId required" });

    const shop = DISTRICT_SHOPS[slug];
    if (!shop) return res.status(404).json({ message: "No shop in this district" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((user as any).status !== "abroad") {
      return res.status(403).json({ message: "You must be abroad in this district to buy" });
    }
    if ((user as any).currentLocation !== slug) {
      return res.status(403).json({ message: `You are not in ${slug}` });
    }

    const inventory = getDistrictShopInventory(slug);
    const item = inventory.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ message: "Item not available in this shop" });

    // Absolute guard: Epic/Legendary items NEVER sold in district shops
    const rarityStr: string = item.rarity;
    if (rarityStr === "epic" || rarityStr === "legendary") {
      return res.status(403).json({ message: "Item unavailable" });
    }

    if (user.dc < item.price) {
      return res.status(400).json({ message: `Not enough DC. ${item.name} costs ${item.price} DC.` });
    }

    user.dc -= item.price;
    await user.save();

    // Add item to player inventory (Item already imported at top of file)
    const existing = await Item.findOne({ owner: req.userId, name: item.name, type: "consumable" });
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
      await existing.save();
    } else {
      await Item.create({
        owner: req.userId,
        name: item.name,
        type: "consumable",
        rarity: item.rarity,
        quantity: 1,
        basePrice: item.price,
        effect: item.effect,
      });
    }

    res.json({
      message: `Purchased ${item.name} for ${item.price} DC`,
      item: { id: item.id, name: item.name, effect: item.effect },
      dc: user.dc,
    });
  } catch (err: any) {
    req.log.error({ err }, "district shop buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/districts/resolve-encounter — player resolves a pending NPC encounter choice
router.post("/resolve-encounter", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { choiceId } = req.body as { choiceId?: string };
    if (!choiceId) return res.status(400).json({ message: "choiceId required" });

    const user = await User.findById(req.userId)
      .select("pendingEncounter strength dc");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.pendingEncounter) {
      return res.status(400).json({ message: "No pending encounter" });
    }
    if (user.pendingEncounter.expiresAt < new Date()) {
      await User.findByIdAndUpdate(req.userId, { $set: { pendingEncounter: null } });
      return res.status(400).json({ message: "Encounter expired" });
    }

    // Map stored kind → EncounterKind
    const kindMap: Record<string, EncounterKind> = {
      mugger:      "mugger",
      checkpoint:  "police_checkpoint",
      black_market: "black_market_trader",
    };
    const encounterKind = kindMap[user.pendingEncounter.kind] ?? "mugger";

    const result = await resolveEncounter(
      String(req.userId),
      encounterKind,
      choiceId,
      { strength: user.strength, dc: user.dc },
    );

    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "resolve-encounter error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/districts/:id/players
router.get("/:id/players", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ district: req.params.id, banned: false, isEmailVerified: true })
      .select("username avatar faction level")
      .limit(50).lean();
    res.json(players.map(p => ({ id: p._id, username: p.username, avatar: p.avatar, faction: (p as any).faction, level: p.level })));
  } catch (err: any) {
    req.log.error({ err }, "district players error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
