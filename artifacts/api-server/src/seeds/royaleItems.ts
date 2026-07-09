/**
 * Seed — royale wheel drop tables for all three legacy royales PLUS the 22
 * new category × spinType pools (11 categories × 2 spin types).
 *
 * Legacy pools:  seeded once when RoyaleItem collection is completely empty.
 * Category pools: seeded once when no items with royaleCategory are present.
 */
import RoyaleItem from "../models/RoyaleItem";
import { logger } from "../lib/logger";

// ── Legacy drop weights ───────────────────────────────────────────────────────
const W = { common: 600, uncommon: 250, rare: 100, epic: 40, legendary: 10 };

// ── Category pool drop weights (spec) ────────────────────────────────────────
const CW = {
  common:    100,
  uncommon:  40,
  rare_dc:   8,    // dc_spin rare
  rare_mr:   30,   // master_royale rare
  epic:      3,
  legendary: 1,
};

const GENERAL_ROYALE_ITEMS = [
  // ── COMMON (10) ────────────────────────────────────────────────────────────
  { name: "+50 DC",                  tier: "common",    itemType: "currency_dc",        reward: { dc: 50 },              dropWeight: W.common },
  { name: "+100 XP",                 tier: "common",    itemType: "xp_boost",           reward: { xp: 100 },             dropWeight: W.common },
  { name: "2 Key Shards",            tier: "common",    itemType: "currency_shards",    reward: { keyShards: 2 },        dropWeight: W.common },
  { name: "Small Energy Drink",      tier: "common",    itemType: "energy_drink",       reward: { energyAmount: 10 },    dropWeight: W.common },
  { name: "Common Title",            tier: "common",    itemType: "title",              reward: { titleId: "nv_local" }, dropWeight: W.common },
  { name: "Basic Avatar Background", tier: "common",    itemType: "avatar_background",  reward: { backgroundId: "bg_basic_grid" }, dropWeight: W.common },
  { name: "Energy Regen Boost",      tier: "common",    itemType: "energy_drink",       reward: { energyAmount: 5 },     dropWeight: W.common },
  { name: "1 Spin Token",            tier: "common",    itemType: "spin_token",         reward: { spinTokens: 1 },       dropWeight: W.common },
  { name: "DC Booster (2× next match)", tier: "common", itemType: "currency_dc",       reward: { dc: 75 },              dropWeight: W.common },
  { name: "Common Loot Crate",       tier: "common",    itemType: "loot_crate",         reward: { lootCrateTier: "common" }, dropWeight: W.common },

  // ── UNCOMMON (10) ──────────────────────────────────────────────────────────
  { name: "+150 DC",                 tier: "uncommon",  itemType: "currency_dc",        reward: { dc: 150 },             dropWeight: W.uncommon },
  { name: "+300 XP",                 tier: "uncommon",  itemType: "xp_boost",           reward: { xp: 300 },             dropWeight: W.uncommon },
  { name: "5 Key Shards",            tier: "uncommon",  itemType: "currency_shards",    reward: { keyShards: 5 },        dropWeight: W.uncommon },
  { name: "Medium Energy Drink",     tier: "uncommon",  itemType: "energy_drink",       reward: { energyAmount: 25 },    dropWeight: W.uncommon },
  { name: "Uncommon Title",          tier: "uncommon",  itemType: "title",              reward: { titleId: "street_runner_title" }, dropWeight: W.uncommon },
  { name: "Avatar Background",       tier: "uncommon",  itemType: "avatar_background",  reward: { backgroundId: "bg_neon_city" }, dropWeight: W.uncommon },
  { name: "Energy Regen Boost 30min",tier: "uncommon",  itemType: "energy_drink",       reward: { energyAmount: 20 },    dropWeight: W.uncommon },
  { name: "2 Spin Tokens",           tier: "uncommon",  itemType: "spin_token",         reward: { spinTokens: 2 },       dropWeight: W.uncommon },
  { name: "Uncommon Loot Crate",     tier: "uncommon",  itemType: "loot_crate",         reward: { lootCrateTier: "uncommon" }, dropWeight: W.uncommon },
  { name: "1 Key",                   tier: "uncommon",  itemType: "currency_keys",      reward: { keys: 1 },             dropWeight: W.uncommon },

  // ── RARE (10) ──────────────────────────────────────────────────────────────
  { name: "+500 DC",                 tier: "rare",      itemType: "currency_dc",        reward: { dc: 500 },             dropWeight: W.rare },
  { name: "+1,000 XP",              tier: "rare",      itemType: "xp_boost",           reward: { xp: 1000 },            dropWeight: W.rare },
  { name: "1 Key",                   tier: "rare",      itemType: "currency_keys",      reward: { keys: 1 },             dropWeight: W.rare },
  { name: "Large Energy Drink",      tier: "rare",      itemType: "energy_drink",       reward: { energyAmount: 60 },    dropWeight: W.rare },
  { name: "Rare Title",              tier: "rare",      itemType: "title",              reward: { titleId: "shadow_runner" }, dropWeight: W.rare },
  { name: "Premium Avatar Background",tier: "rare",     itemType: "avatar_background",  reward: { backgroundId: "bg_neon_rain" }, dropWeight: W.rare },
  { name: "Energy Max +5",           tier: "rare",      itemType: "energy_max_boost",   reward: { energyMaxBoost: 5 },   dropWeight: W.rare },
  { name: "3 Spin Tokens",           tier: "rare",      itemType: "spin_token",         reward: { spinTokens: 3 },       dropWeight: W.rare },
  { name: "Rare Loot Crate",         tier: "rare",      itemType: "loot_crate",         reward: { lootCrateTier: "rare" }, dropWeight: W.rare },
  { name: "8 Key Shards",            tier: "rare",      itemType: "currency_shards",    reward: { keyShards: 8 },        dropWeight: W.rare },

  // ── EPIC (10) ──────────────────────────────────────────────────────────────
  { name: "+1,500 DC",              tier: "epic",      itemType: "currency_dc",        reward: { dc: 1500 },            dropWeight: W.epic },
  { name: "+3,000 XP",             tier: "epic",      itemType: "xp_boost",           reward: { xp: 3000 },            dropWeight: W.epic },
  { name: "3 Keys",                 tier: "epic",      itemType: "currency_keys",      reward: { keys: 3 },             dropWeight: W.epic },
  { name: "Mega Energy Cell",        tier: "epic",      itemType: "energy_drink",       reward: { energyAmount: 150 },   dropWeight: W.epic },
  { name: "Epic Title",              tier: "epic",      itemType: "title",              reward: { titleId: "neon_ghost" }, dropWeight: W.epic },
  { name: "Animated Avatar Background",tier: "epic",    itemType: "avatar_background",  reward: { backgroundId: "bg_anim_matrix" }, dropWeight: W.epic },
  { name: "Energy Max +10",          tier: "epic",      itemType: "energy_max_boost",   reward: { energyMaxBoost: 10 },  dropWeight: W.epic },
  { name: "Golden Spin Token",       tier: "epic",      itemType: "spin_token",         reward: { spinTokens: 5 },       dropWeight: W.epic },
  { name: "Epic Loot Crate",         tier: "epic",      itemType: "loot_crate",         reward: { lootCrateTier: "epic" }, dropWeight: W.epic },
  { name: "15 Key Shards",           tier: "epic",      itemType: "currency_shards",    reward: { keyShards: 15 },       dropWeight: W.epic },

  // ── LEGENDARY (10) ─────────────────────────────────────────────────────────
  { name: "+5,000 DC",              tier: "legendary", itemType: "currency_dc",        reward: { dc: 5000 },            dropWeight: W.legendary },
  { name: "+10,000 XP",            tier: "legendary", itemType: "xp_boost",           reward: { xp: 10000 },           dropWeight: W.legendary },
  { name: "10 Keys",                tier: "legendary", itemType: "currency_keys",      reward: { keys: 10 },            dropWeight: W.legendary },
  { name: "Ultimate Energy Pack",   tier: "legendary", itemType: "energy_drink",       reward: { energyAmount: 200 },   dropWeight: W.legendary },
  { name: "Legendary Title",        tier: "legendary", itemType: "title",              reward: { titleId: "apex_sovereign_title" }, dropWeight: W.legendary },
  { name: "Exclusive Animated Background", tier: "legendary", itemType: "avatar_background", reward: { backgroundId: "bg_anim_apex" }, dropWeight: W.legendary },
  { name: "Energy Max +20",         tier: "legendary", itemType: "energy_max_boost",   reward: { energyMaxBoost: 20 },  dropWeight: W.legendary },
  { name: "Mythic Key",             tier: "legendary", itemType: "currency_keys",      reward: { keys: 1 },             dropWeight: W.legendary },
  { name: "Legendary Loot Crate",   tier: "legendary", itemType: "loot_crate",         reward: { lootCrateTier: "legendary" }, dropWeight: W.legendary },
  { name: "30 Key Shards",          tier: "legendary", itemType: "currency_shards",    reward: { keyShards: 30 },       dropWeight: W.legendary },
];

const SHOOTING_ROYALE_ITEMS = [
  // Common
  { name: "Pistol",          tier: "common",    itemType: "weapon",     reward: { miniGameItemId: "pistol_common" },        dropWeight: W.common },
  { name: "Knife",           tier: "common",    itemType: "weapon",     reward: { miniGameItemId: "knife_common" },         dropWeight: W.common },
  { name: "Baseball Bat",    tier: "common",    itemType: "weapon",     reward: { miniGameItemId: "baseball_bat_common" },  dropWeight: W.common },
  { name: "Light Vest",      tier: "common",    itemType: "armor",      reward: { miniGameItemId: "light_vest_common" },    dropWeight: W.common },
  { name: "Bandage",         tier: "common",    itemType: "consumable", reward: { miniGameItemId: "bandage_common" },       dropWeight: W.common },
  { name: "Smoke Grenade",   tier: "common",    itemType: "consumable", reward: { miniGameItemId: "smoke_grenade_common" }, dropWeight: W.common },
  { name: "Standard Ammo",   tier: "common",    itemType: "ammo",       reward: { miniGameItemId: "std_ammo_common" },      dropWeight: W.common },
  { name: "Tactical Gloves", tier: "common",    itemType: "armor",      reward: { miniGameItemId: "tact_gloves_common" },   dropWeight: W.common },
  { name: "Beanie Helmet",   tier: "common",    itemType: "armor",      reward: { miniGameItemId: "beanie_helm_common" },   dropWeight: W.common },
  { name: "Flashlight",      tier: "common",    itemType: "consumable", reward: { miniGameItemId: "flashlight_common" },    dropWeight: W.common },
  // Uncommon
  { name: "SMG",             tier: "uncommon",  itemType: "weapon",     reward: { miniGameItemId: "smg_uncommon" },         dropWeight: W.uncommon },
  { name: "Combat Knife",    tier: "uncommon",  itemType: "weapon",     reward: { miniGameItemId: "combat_knife_uncommon" },dropWeight: W.uncommon },
  { name: "Medium Vest",     tier: "uncommon",  itemType: "armor",      reward: { miniGameItemId: "med_vest_uncommon" },    dropWeight: W.uncommon },
  { name: "Medkit",          tier: "uncommon",  itemType: "consumable", reward: { miniGameItemId: "medkit_uncommon" },      dropWeight: W.uncommon },
  { name: "Frag Grenade",    tier: "uncommon",  itemType: "consumable", reward: { miniGameItemId: "frag_nade_uncommon" },   dropWeight: W.uncommon },
  { name: "Hollow Point Ammo",tier:"uncommon",  itemType: "ammo",       reward: { miniGameItemId: "hp_ammo_uncommon" },     dropWeight: W.uncommon },
  { name: "Tactical Boots",  tier: "uncommon",  itemType: "armor",      reward: { miniGameItemId: "tact_boots_uncommon" },  dropWeight: W.uncommon },
  { name: "Ear Protection",  tier: "uncommon",  itemType: "armor",      reward: { miniGameItemId: "ear_prot_uncommon" },    dropWeight: W.uncommon },
  { name: "Combat Mask",     tier: "uncommon",  itemType: "armor",      reward: { miniGameItemId: "combat_mask_uncommon" }, dropWeight: W.uncommon },
  { name: "Suppressor",      tier: "uncommon",  itemType: "ammo",       reward: { miniGameItemId: "suppressor_uncommon" },  dropWeight: W.uncommon },
  // Rare
  { name: "Assault Rifle",   tier: "rare",      itemType: "weapon",     reward: { miniGameItemId: "ar_rare" },              dropWeight: W.rare },
  { name: "Shotgun",         tier: "rare",      itemType: "weapon",     reward: { miniGameItemId: "shotgun_rare" },         dropWeight: W.rare },
  { name: "Heavy Vest",      tier: "rare",      itemType: "armor",      reward: { miniGameItemId: "heavy_vest_rare" },      dropWeight: W.rare },
  { name: "Advanced Medkit", tier: "rare",      itemType: "consumable", reward: { miniGameItemId: "adv_medkit_rare" },      dropWeight: W.rare },
  { name: "Stun Grenade",    tier: "rare",      itemType: "consumable", reward: { miniGameItemId: "stun_nade_rare" },       dropWeight: W.rare },
  { name: "Armor Piercing Ammo",tier:"rare",    itemType: "ammo",       reward: { miniGameItemId: "ap_ammo_rare" },         dropWeight: W.rare },
  { name: "Night Vision",    tier: "rare",      itemType: "armor",      reward: { miniGameItemId: "nv_rare" },              dropWeight: W.rare },
  { name: "Combat Helmet",   tier: "rare",      itemType: "armor",      reward: { miniGameItemId: "combat_helm_rare" },     dropWeight: W.rare },
  { name: "Quick Mag",       tier: "rare",      itemType: "ammo",       reward: { miniGameItemId: "quick_mag_rare" },       dropWeight: W.rare },
  { name: "Scope",           tier: "rare",      itemType: "ammo",       reward: { miniGameItemId: "scope_rare" },           dropWeight: W.rare },
  // Epic
  { name: "Sniper Rifle",    tier: "epic",      itemType: "weapon",     reward: { miniGameItemId: "sniper_epic" },          dropWeight: W.epic },
  { name: "Energy SMG",      tier: "epic",      itemType: "weapon",     reward: { miniGameItemId: "energy_smg_epic" },      dropWeight: W.epic },
  { name: "Riot Shield",     tier: "epic",      itemType: "armor",      reward: { miniGameItemId: "riot_shield_epic" },     dropWeight: W.epic },
  { name: "Nano Medkit",     tier: "epic",      itemType: "consumable", reward: { miniGameItemId: "nano_medkit_epic" },     dropWeight: W.epic },
  { name: "EMP Grenade",     tier: "epic",      itemType: "consumable", reward: { miniGameItemId: "emp_nade_epic" },        dropWeight: W.epic },
  { name: "Incendiary Ammo", tier: "epic",      itemType: "ammo",       reward: { miniGameItemId: "incend_ammo_epic" },     dropWeight: W.epic },
  { name: "Exo Gloves",      tier: "epic",      itemType: "armor",      reward: { miniGameItemId: "exo_gloves_epic" },      dropWeight: W.epic },
  { name: "Smart Visor",     tier: "epic",      itemType: "armor",      reward: { miniGameItemId: "smart_visor_epic" },     dropWeight: W.epic },
  { name: "Extended Barrel", tier: "epic",      itemType: "ammo",       reward: { miniGameItemId: "ext_barrel_epic" },      dropWeight: W.epic },
  { name: "Recon Drone",     tier: "epic",      itemType: "consumable", reward: { miniGameItemId: "recon_drone_epic" },     dropWeight: W.epic },
  // Legendary
  { name: "Plasma Rifle",    tier: "legendary", itemType: "weapon",     reward: { miniGameItemId: "plasma_rifle_leg" },     dropWeight: W.legendary },
  { name: "Legendary Katana",tier: "legendary", itemType: "weapon",     reward: { miniGameItemId: "katana_leg" },           dropWeight: W.legendary },
  { name: "Titan Armor",     tier: "legendary", itemType: "armor",      reward: { miniGameItemId: "titan_armor_leg" },      dropWeight: W.legendary },
  { name: "Regen Field Kit", tier: "legendary", itemType: "consumable", reward: { miniGameItemId: "regen_field_leg" },      dropWeight: W.legendary },
  { name: "Black Hole Grenade",tier:"legendary", itemType: "consumable", reward: { miniGameItemId: "bh_nade_leg" },          dropWeight: W.legendary },
  { name: "Quantum Ammo",    tier: "legendary", itemType: "ammo",       reward: { miniGameItemId: "quantum_ammo_leg" },     dropWeight: W.legendary },
  { name: "Predator Mask",   tier: "legendary", itemType: "armor",      reward: { miniGameItemId: "pred_mask_leg" },        dropWeight: W.legendary },
  { name: "Hologram Decoy",  tier: "legendary", itemType: "consumable", reward: { miniGameItemId: "holo_decoy_leg" },       dropWeight: W.legendary },
  { name: "Omega Pistol",    tier: "legendary", itemType: "weapon",     reward: { miniGameItemId: "omega_pistol_leg" },     dropWeight: W.legendary },
  { name: "Wingsuit",        tier: "legendary", itemType: "armor",      reward: { miniGameItemId: "wingsuit_leg" },         dropWeight: W.legendary },
];

const RACING_ROYALE_ITEMS = [
  // Common — cars
  { name: "Rustbucket",        tier: "common",    itemType: "car",      reward: { carId: "rustbucket_common" },    dropWeight: W.common },
  { name: "Scooter",           tier: "common",    itemType: "car",      reward: { carId: "scooter_common" },       dropWeight: W.common },
  { name: "City Bike",         tier: "common",    itemType: "car",      reward: { carId: "city_bike_common" },     dropWeight: W.common },
  { name: "Standard Engine",   tier: "common",    itemType: "car_part", reward: { carPartId: "std_engine_common" },dropWeight: W.common },
  { name: "Basic Tires",       tier: "common",    itemType: "car_part", reward: { carPartId: "basic_tires_common" },dropWeight: W.common },
  { name: "Basic Spoiler",     tier: "common",    itemType: "car_part", reward: { carPartId: "basic_spoiler_common" },dropWeight: W.common },
  { name: "Standard Brakes",   tier: "common",    itemType: "car_part", reward: { carPartId: "std_brakes_common" },dropWeight: W.common },
  { name: "Oil Can",           tier: "common",    itemType: "car_part", reward: { carPartId: "oil_can_common" },   dropWeight: W.common },
  { name: "+100 DC (Race)",    tier: "common",    itemType: "currency_dc", reward: { dc: 100 },                   dropWeight: W.common },
  { name: "2 Key Shards",      tier: "common",    itemType: "currency_shards", reward: { keyShards: 2 },          dropWeight: W.common },
  // Uncommon
  { name: "Hatchback",         tier: "uncommon",  itemType: "car",      reward: { carId: "hatchback_uncommon" },   dropWeight: W.uncommon },
  { name: "Muscle Car",        tier: "uncommon",  itemType: "car",      reward: { carId: "muscle_car_uncommon" },  dropWeight: W.uncommon },
  { name: "Sport Bike",        tier: "uncommon",  itemType: "car",      reward: { carId: "sport_bike_uncommon" },  dropWeight: W.uncommon },
  { name: "V6 Engine",         tier: "uncommon",  itemType: "car_part", reward: { carPartId: "v6_engine_uncommon" },dropWeight: W.uncommon },
  { name: "Racing Tires",      tier: "uncommon",  itemType: "car_part", reward: { carPartId: "race_tires_uncommon" },dropWeight: W.uncommon },
  { name: "Small Spoiler",     tier: "uncommon",  itemType: "car_part", reward: { carPartId: "sm_spoiler_uncommon" },dropWeight: W.uncommon },
  { name: "Disc Brakes",       tier: "uncommon",  itemType: "car_part", reward: { carPartId: "disc_brakes_uncommon" },dropWeight: W.uncommon },
  { name: "Repair Kit",        tier: "uncommon",  itemType: "car_part", reward: { carPartId: "repair_kit_uncommon" },dropWeight: W.uncommon },
  { name: "+300 DC (Race)",    tier: "uncommon",  itemType: "currency_dc", reward: { dc: 300 },                   dropWeight: W.uncommon },
  { name: "1 Key",             tier: "uncommon",  itemType: "currency_keys", reward: { keys: 1 },                 dropWeight: W.uncommon },
  // Rare
  { name: "Sports Car",        tier: "rare",      itemType: "car",      reward: { carId: "sports_car_rare" },      dropWeight: W.rare },
  { name: "Drift Coupe",       tier: "rare",      itemType: "car",      reward: { carId: "drift_coupe_rare" },     dropWeight: W.rare },
  { name: "Racing Motorcycle", tier: "rare",      itemType: "car",      reward: { carId: "race_moto_rare" },       dropWeight: W.rare },
  { name: "V8 Engine",         tier: "rare",      itemType: "car_part", reward: { carPartId: "v8_engine_rare" },   dropWeight: W.rare },
  { name: "Slick Tires",       tier: "rare",      itemType: "car_part", reward: { carPartId: "slick_tires_rare" }, dropWeight: W.rare },
  { name: "Racing Spoiler",    tier: "rare",      itemType: "car_part", reward: { carPartId: "race_spoiler_rare" },dropWeight: W.rare },
  { name: "Nitro Tank",        tier: "rare",      itemType: "car_part", reward: { carPartId: "nitro_tank_rare" },  dropWeight: W.rare },
  { name: "Adv. Repair Kit",   tier: "rare",      itemType: "car_part", reward: { carPartId: "adv_repair_rare" },  dropWeight: W.rare },
  { name: "+750 DC (Race)",    tier: "rare",      itemType: "currency_dc", reward: { dc: 750 },                   dropWeight: W.rare },
  { name: "2 Keys",            tier: "rare",      itemType: "currency_keys", reward: { keys: 2 },                 dropWeight: W.rare },
  // Epic
  { name: "Supercar",          tier: "epic",      itemType: "car",      reward: { carId: "supercar_epic" },        dropWeight: W.epic },
  { name: "Hyperbike",         tier: "epic",      itemType: "car",      reward: { carId: "hyperbike_epic" },       dropWeight: W.epic },
  { name: "Electric Racer",    tier: "epic",      itemType: "car",      reward: { carId: "elec_racer_epic" },      dropWeight: W.epic },
  { name: "Electric Engine",   tier: "epic",      itemType: "car_part", reward: { carPartId: "elec_engine_epic" }, dropWeight: W.epic },
  { name: "Performance Tires", tier: "epic",      itemType: "car_part", reward: { carPartId: "perf_tires_epic" },  dropWeight: W.epic },
  { name: "Carbon Spoiler",    tier: "epic",      itemType: "car_part", reward: { carPartId: "carbon_spoiler_epic" },dropWeight: W.epic },
  { name: "Double Nitro",      tier: "epic",      itemType: "car_part", reward: { carPartId: "double_nitro_epic" },dropWeight: W.epic },
  { name: "Supercharger",      tier: "epic",      itemType: "car_part", reward: { carPartId: "supercharger_epic" },dropWeight: W.epic },
  { name: "+2,000 DC (Race)",  tier: "epic",      itemType: "currency_dc", reward: { dc: 2000 },                  dropWeight: W.epic },
  { name: "4 Keys",            tier: "epic",      itemType: "currency_keys", reward: { keys: 4 },                 dropWeight: W.epic },
  // Legendary
  { name: "Cyberjet",          tier: "legendary", itemType: "car",      reward: { carId: "cyberjet_legendary" },   dropWeight: W.legendary },
  { name: "Neon Beast",        tier: "legendary", itemType: "car",      reward: { carId: "neon_beast_legendary" }, dropWeight: W.legendary },
  { name: "Hovercar",          tier: "legendary", itemType: "car",      reward: { carId: "hovercar_legendary" },   dropWeight: W.legendary },
  { name: "Fusion Engine",     tier: "legendary", itemType: "car_part", reward: { carPartId: "fusion_engine_leg" },dropWeight: W.legendary },
  { name: "Holographic Tires", tier: "legendary", itemType: "car_part", reward: { carPartId: "holo_tires_leg" },   dropWeight: W.legendary },
  { name: "Quantum Brakes",    tier: "legendary", itemType: "car_part", reward: { carPartId: "quantum_brakes_leg" },dropWeight: W.legendary },
  { name: "Infinite Nitro",    tier: "legendary", itemType: "car_part", reward: { carPartId: "inf_nitro_leg" },    dropWeight: W.legendary },
  { name: "Time Warp Module",  tier: "legendary", itemType: "car_part", reward: { carPartId: "time_warp_leg" },    dropWeight: W.legendary },
  { name: "+8,000 DC (Race)",  tier: "legendary", itemType: "currency_dc", reward: { dc: 8000 },                  dropWeight: W.legendary },
  { name: "8 Keys",            tier: "legendary", itemType: "currency_keys", reward: { keys: 8 },                 dropWeight: W.legendary },
];

// ── New-style category pools — 11 categories × 2 spin types = 22 pools ────────
// itemRef → MiniGameItem.itemId (for arena grants); null for cars/car_parts
// reward.carId / reward.carPartId used by the spin handler for garage grants
// All new-style items use royaleType:"general" to satisfy the required field

type CatPoolItem = {
  royaleCategory: string;
  spinType: string;
  royaleType: string;
  tier: string;
  name: string;
  itemType: string;
  itemRef: string | null;
  reward: Record<string, unknown>;
  dropWeight: number;
  imageCard: string;
};

function weaponItem(
  cat: string, st: string, tier: string, name: string, itemId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: cat, spinType: st, royaleType: "general",
    tier, name, itemType: "weapon", itemRef: itemId, reward: {},
    dropWeight: dw, imageCard: `/assets/items/${itemId}.png`,
  };
}

function armorItem(
  cat: string, st: string, tier: string, name: string, itemId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: cat, spinType: st, royaleType: "general",
    tier, name, itemType: "armor", itemRef: itemId, reward: {},
    dropWeight: dw, imageCard: `/assets/items/${itemId}.png`,
  };
}

function consumableItem(
  cat: string, st: string, tier: string, name: string, itemId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: cat, spinType: st, royaleType: "general",
    tier, name, itemType: "consumable", itemRef: itemId, reward: {},
    dropWeight: dw, imageCard: `/assets/items/${itemId}.png`,
  };
}

function ammoItem(
  cat: string, st: string, tier: string, name: string, itemId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: cat, spinType: st, royaleType: "general",
    tier, name, itemType: "ammo", itemRef: itemId, reward: {},
    dropWeight: dw, imageCard: `/assets/items/${itemId}.png`,
  };
}

function carItem(
  st: string, tier: string, name: string, carId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: "race_cars", spinType: st, royaleType: "general",
    tier, name, itemType: "car", itemRef: null,
    reward: { carId },
    dropWeight: dw, imageCard: `/assets/cars/${carId}.png`,
  };
}

function carPartItem(
  st: string, tier: string, name: string, partId: string, dw: number,
): CatPoolItem {
  return {
    royaleCategory: "car_parts", spinType: st, royaleType: "general",
    tier, name, itemType: "car_part", itemRef: null,
    reward: { carPartId: partId },
    dropWeight: dw, imageCard: `/assets/parts/${partId}.png`,
  };
}

const CATEGORY_POOLS: CatPoolItem[] = [

  // ══════════════════════════════════════════════════════════════════════════════
  // PISTOLS — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("pistols","dc_spin",    "common",    "Glock 17",           "glock17_common",    CW.common),
  weaponItem("pistols","dc_spin",    "common",    "Desert Eagle",       "deagle_common",     CW.common),
  weaponItem("pistols","dc_spin",    "common",    "Beretta M9",         "beretta_common",    CW.common),
  weaponItem("pistols","dc_spin",    "uncommon",  "Glock 17 Mk.II",     "glock17_uncommon",  CW.uncommon),
  weaponItem("pistols","dc_spin",    "uncommon",  "Desert Eagle Mk.II", "deagle_uncommon",   CW.uncommon),
  weaponItem("pistols","dc_spin",    "uncommon",  "USP-S Mk.II",        "usps_uncommon",     CW.uncommon),
  weaponItem("pistols","dc_spin",    "rare",      "Glock 17 Custom",    "glock17_rare",      CW.rare_dc),
  weaponItem("pistols","dc_spin",    "rare",      "Desert Eagle Custom","deagle_rare",       CW.rare_dc),

  weaponItem("pistols","master_royale","rare",    "Beretta M9 Custom",  "beretta_rare",      CW.rare_mr),
  weaponItem("pistols","master_royale","rare",    "USP-S Custom",       "usps_rare",         CW.rare_mr),
  weaponItem("pistols","master_royale","epic",    "Glock 17 Cyber",     "glock17_epic",      CW.epic),
  weaponItem("pistols","master_royale","epic",    "Desert Eagle Cyber", "deagle_epic",       CW.epic),
  weaponItem("pistols","master_royale","legendary","Glock 17 Phantom",  "glock17_legendary", CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // SMGS — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("smgs","dc_spin",    "common",    "MP5",          "mp5_common",     CW.common),
  weaponItem("smgs","dc_spin",    "common",    "Uzi",          "uzi_common",     CW.common),
  weaponItem("smgs","dc_spin",    "common",    "MAC-10",       "mac10_common",   CW.common),
  weaponItem("smgs","dc_spin",    "uncommon",  "MP5 Mk.II",    "mp5_uncommon",   CW.uncommon),
  weaponItem("smgs","dc_spin",    "uncommon",  "Uzi Mk.II",    "uzi_uncommon",   CW.uncommon),
  weaponItem("smgs","dc_spin",    "uncommon",  "P90 Mk.II",    "p90_uncommon",   CW.uncommon),
  weaponItem("smgs","dc_spin",    "rare",      "MP5 Custom",   "mp5_rare",       CW.rare_dc),
  weaponItem("smgs","dc_spin",    "rare",      "Uzi Custom",   "uzi_rare",       CW.rare_dc),

  weaponItem("smgs","master_royale","rare",    "MAC-10 Custom","mac10_rare",     CW.rare_mr),
  weaponItem("smgs","master_royale","rare",    "P90 Custom",   "p90_rare",       CW.rare_mr),
  weaponItem("smgs","master_royale","epic",    "MP5 Cyber",    "mp5_epic",       CW.epic),
  weaponItem("smgs","master_royale","epic",    "Uzi Cyber",    "uzi_epic",       CW.epic),
  weaponItem("smgs","master_royale","legendary","MP5 Phantom", "mp5_legendary",  CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // ASSAULT RIFLES — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("assault_rifles","dc_spin",    "common",    "AK-47",         "ak47_common",     CW.common),
  weaponItem("assault_rifles","dc_spin",    "common",    "M4A1",          "m4a1_common",     CW.common),
  weaponItem("assault_rifles","dc_spin",    "common",    "SCAR-H",        "scarh_common",    CW.common),
  weaponItem("assault_rifles","dc_spin",    "uncommon",  "AK-47 Mk.II",   "ak47_uncommon",   CW.uncommon),
  weaponItem("assault_rifles","dc_spin",    "uncommon",  "M4A1 Mk.II",    "m4a1_uncommon",   CW.uncommon),
  weaponItem("assault_rifles","dc_spin",    "uncommon",  "HK416 Mk.II",   "hk416_uncommon",  CW.uncommon),
  weaponItem("assault_rifles","dc_spin",    "rare",      "AK-47 Custom",  "ak47_rare",       CW.rare_dc),
  weaponItem("assault_rifles","dc_spin",    "rare",      "M4A1 Custom",   "m4a1_rare",       CW.rare_dc),

  weaponItem("assault_rifles","master_royale","rare",    "SCAR-H Custom", "scarh_rare",      CW.rare_mr),
  weaponItem("assault_rifles","master_royale","rare",    "HK416 Custom",  "hk416_rare",      CW.rare_mr),
  weaponItem("assault_rifles","master_royale","epic",    "AK-47 Cyber",   "ak47_epic",       CW.epic),
  weaponItem("assault_rifles","master_royale","epic",    "M4A1 Cyber",    "m4a1_epic",       CW.epic),
  weaponItem("assault_rifles","master_royale","legendary","AK-47 Phantom","ak47_legendary",  CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // SHOTGUNS — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("shotguns","dc_spin",    "common",    "Mossberg 500",       "mossberg_common",   CW.common),
  weaponItem("shotguns","dc_spin",    "common",    "SPAS-12",            "spas12_common",     CW.common),
  weaponItem("shotguns","dc_spin",    "common",    "AA-12",              "aa12_common",       CW.common),
  weaponItem("shotguns","dc_spin",    "uncommon",  "Mossberg 500 Mk.II", "mossberg_uncommon", CW.uncommon),
  weaponItem("shotguns","dc_spin",    "uncommon",  "SPAS-12 Mk.II",      "spas12_uncommon",   CW.uncommon),
  weaponItem("shotguns","dc_spin",    "uncommon",  "Benelli M4 Mk.II",   "benelli_uncommon",  CW.uncommon),
  weaponItem("shotguns","dc_spin",    "rare",      "Mossberg 500 Custom","mossberg_rare",     CW.rare_dc),
  weaponItem("shotguns","dc_spin",    "rare",      "SPAS-12 Custom",     "spas12_rare",       CW.rare_dc),

  weaponItem("shotguns","master_royale","rare",    "AA-12 Custom",       "aa12_rare",         CW.rare_mr),
  weaponItem("shotguns","master_royale","rare",    "Benelli M4 Custom",  "benelli_rare",      CW.rare_mr),
  weaponItem("shotguns","master_royale","epic",    "Mossberg 500 Cyber", "mossberg_epic",     CW.epic),
  weaponItem("shotguns","master_royale","epic",    "SPAS-12 Cyber",      "spas12_epic",       CW.epic),
  weaponItem("shotguns","master_royale","legendary","Mossberg 500 Phantom","mossberg_legendary",CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // SNIPER RIFLES — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("sniper_rifles","dc_spin",    "common",    "Barrett M82",         "barrett_common",    CW.common),
  weaponItem("sniper_rifles","dc_spin",    "common",    "AWP",                 "awp_common",        CW.common),
  weaponItem("sniper_rifles","dc_spin",    "common",    "Dragunov",            "dragunov_common",   CW.common),
  weaponItem("sniper_rifles","dc_spin",    "uncommon",  "Barrett M82 Mk.II",   "barrett_uncommon",  CW.uncommon),
  weaponItem("sniper_rifles","dc_spin",    "uncommon",  "AWP Mk.II",           "awp_uncommon",      CW.uncommon),
  weaponItem("sniper_rifles","dc_spin",    "uncommon",  "Intervention Mk.II",  "intervention_uncommon", CW.uncommon),
  weaponItem("sniper_rifles","dc_spin",    "rare",      "Barrett M82 Custom",  "barrett_rare",      CW.rare_dc),
  weaponItem("sniper_rifles","dc_spin",    "rare",      "AWP Custom",          "awp_rare",          CW.rare_dc),

  weaponItem("sniper_rifles","master_royale","rare",    "Dragunov Custom",     "dragunov_rare",     CW.rare_mr),
  weaponItem("sniper_rifles","master_royale","rare",    "Intervention Custom", "intervention_rare", CW.rare_mr),
  weaponItem("sniper_rifles","master_royale","epic",    "Barrett M82 Cyber",   "barrett_epic",      CW.epic),
  weaponItem("sniper_rifles","master_royale","epic",    "AWP Cyber",           "awp_epic",          CW.epic),
  weaponItem("sniper_rifles","master_royale","legendary","Barrett M82 Phantom","barrett_legendary", CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // LMGS — dc_spin (3C + 3U + 2R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  weaponItem("lmgs","dc_spin",    "common",    "M249 SAW",      "m249_common",     CW.common),
  weaponItem("lmgs","dc_spin",    "common",    "RPK",           "rpk_common",      CW.common),
  weaponItem("lmgs","dc_spin",    "common",    "Minigun",       "minigun_common",  CW.common),
  weaponItem("lmgs","dc_spin",    "uncommon",  "M249 SAW Mk.II","m249_uncommon",   CW.uncommon),
  weaponItem("lmgs","dc_spin",    "uncommon",  "RPK Mk.II",     "rpk_uncommon",    CW.uncommon),
  weaponItem("lmgs","dc_spin",    "uncommon",  "MG4 Mk.II",     "mg4_uncommon",    CW.uncommon),
  weaponItem("lmgs","dc_spin",    "rare",      "M249 SAW Custom","m249_rare",      CW.rare_dc),
  weaponItem("lmgs","dc_spin",    "rare",      "RPK Custom",    "rpk_rare",        CW.rare_dc),

  weaponItem("lmgs","master_royale","rare",    "Minigun Custom","minigun_rare",    CW.rare_mr),
  weaponItem("lmgs","master_royale","rare",    "MG4 Custom",    "mg4_rare",        CW.rare_mr),
  weaponItem("lmgs","master_royale","epic",    "M249 SAW Cyber","m249_epic",       CW.epic),
  weaponItem("lmgs","master_royale","epic",    "RPK Cyber",     "rpk_epic",        CW.epic),
  weaponItem("lmgs","master_royale","legendary","M249 SAW Phantom","m249_legendary",CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // BODY ARMOR — dc_spin (1C + 1U + 1R) + master_royale (1R + 1E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  armorItem("body_armor","dc_spin",    "common",    "Street Vest",    "street_vest",    CW.common),
  armorItem("body_armor","dc_spin",    "uncommon",  "Tactical Vest",  "tactical_vest",  CW.uncommon),
  armorItem("body_armor","dc_spin",    "rare",      "Combat Plate",   "combat_plate",   CW.rare_dc),

  armorItem("body_armor","master_royale","rare",    "Combat Plate",   "combat_plate",   CW.rare_mr),
  armorItem("body_armor","master_royale","epic",    "Ballistic Rig",  "ballistic_rig",  CW.epic),
  armorItem("body_armor","master_royale","legendary","Exo-Armor",     "exo_armor",      CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // CONSUMABLES — dc_spin (2C + 2U + 2R) + master_royale (2R + 1E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  consumableItem("consumables","dc_spin",    "common",    "Small Medkit",   "small_medkit",   CW.common),
  consumableItem("consumables","dc_spin",    "common",    "Smoke Grenade",  "smoke_grenade",  CW.common),
  consumableItem("consumables","dc_spin",    "uncommon",  "Large Medkit",   "large_medkit",   CW.uncommon),
  consumableItem("consumables","dc_spin",    "uncommon",  "Frag Grenade",   "frag_grenade",   CW.uncommon),
  consumableItem("consumables","dc_spin",    "rare",      "Mega Medkit",    "mega_medkit",    CW.rare_dc),
  consumableItem("consumables","dc_spin",    "rare",      "Stimpack",       "stimpack",       CW.rare_dc),

  consumableItem("consumables","master_royale","rare",    "Cyber Grenade",  "cyber_grenade",  CW.rare_mr),
  consumableItem("consumables","master_royale","rare",    "Stimpack",       "stimpack",       CW.rare_mr),
  consumableItem("consumables","master_royale","epic",    "Nano Shield",    "nano_shield",    CW.epic),
  consumableItem("consumables","master_royale","legendary","Berserker Dose","berserker_dose", CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // AMMO — dc_spin (3C + 3U + 1R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  ammoItem("ammo","dc_spin",    "common",    "Pistol Rounds",       "pistol_rounds_common",    CW.common),
  ammoItem("ammo","dc_spin",    "common",    "SMG Rounds",          "smg_rounds_common",       CW.common),
  ammoItem("ammo","dc_spin",    "common",    "Rifle Rounds",        "rifle_rounds_common",     CW.common),
  ammoItem("ammo","dc_spin",    "uncommon",  "Pistol Rounds (Hot)", "pistol_rounds_uncommon",  CW.uncommon),
  ammoItem("ammo","dc_spin",    "uncommon",  "Rifle Rounds (Hot)",  "rifle_rounds_uncommon",   CW.uncommon),
  ammoItem("ammo","dc_spin",    "uncommon",  "Shotgun Shells (Mag)","shotgun_shells_uncommon", CW.uncommon),
  ammoItem("ammo","dc_spin",    "rare",      "Rifle Rounds (Match)","rifle_rounds_rare",       CW.rare_dc),

  ammoItem("ammo","master_royale","rare",    "Sniper Rounds (AP)",  "sniper_rounds_rare",      CW.rare_mr),
  ammoItem("ammo","master_royale","rare",    "LMG Rounds (Match)",  "lmg_rounds_rare",         CW.rare_mr),
  ammoItem("ammo","master_royale","epic",    "Rifle Rounds (Cyber)","rifle_rounds_epic",       CW.epic),
  ammoItem("ammo","master_royale","epic",    "Sniper Rounds (Cyber)","sniper_rounds_epic",     CW.epic),
  ammoItem("ammo","master_royale","legendary","LMG Rounds (Phantom)","lmg_rounds_legendary",  CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // RACE CARS — dc_spin (2C + 2U + 1R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  carItem("dc_spin",    "common",    "Rustbucket",      "rustbucket_common",   CW.common),
  carItem("dc_spin",    "common",    "Scooter",         "scooter_common",      CW.common),
  carItem("dc_spin",    "uncommon",  "Hatchback",       "hatchback_uncommon",  CW.uncommon),
  carItem("dc_spin",    "uncommon",  "Sport Bike",      "sport_bike_uncommon", CW.uncommon),
  carItem("dc_spin",    "rare",      "Sports Car",      "sports_car_rare",     CW.rare_dc),

  carItem("master_royale","rare",    "Drift Coupe",     "drift_coupe_rare",    CW.rare_mr),
  carItem("master_royale","rare",    "Racing Motorcycle","race_moto_rare",     CW.rare_mr),
  carItem("master_royale","epic",    "Supercar",        "supercar_epic",       CW.epic),
  carItem("master_royale","epic",    "Hyperbike",       "hyperbike_epic",      CW.epic),
  carItem("master_royale","legendary","Cyberjet",       "cyberjet_legendary",  CW.legendary),

  // ══════════════════════════════════════════════════════════════════════════════
  // CAR PARTS — dc_spin (3C + 3U + 1R) + master_royale (2R + 2E + 1L)
  // ══════════════════════════════════════════════════════════════════════════════
  carPartItem("dc_spin",    "common",    "Standard Engine", "std_engine_common",   CW.common),
  carPartItem("dc_spin",    "common",    "Basic Tires",     "basic_tires_common",  CW.common),
  carPartItem("dc_spin",    "common",    "Oil Can",         "oil_can_common",      CW.common),
  carPartItem("dc_spin",    "uncommon",  "V6 Engine",       "v6_engine_uncommon",  CW.uncommon),
  carPartItem("dc_spin",    "uncommon",  "Racing Tires",    "race_tires_uncommon", CW.uncommon),
  carPartItem("dc_spin",    "uncommon",  "Repair Kit",      "repair_kit_uncommon", CW.uncommon),
  carPartItem("dc_spin",    "rare",      "V8 Engine",       "v8_engine_rare",      CW.rare_dc),

  carPartItem("master_royale","rare",    "Slick Tires",     "slick_tires_rare",    CW.rare_mr),
  carPartItem("master_royale","rare",    "Nitro Tank",      "nitro_tank_rare",     CW.rare_mr),
  carPartItem("master_royale","epic",    "Electric Engine", "elec_engine_epic",    CW.epic),
  carPartItem("master_royale","epic",    "Double Nitro",    "double_nitro_epic",   CW.epic),
  carPartItem("master_royale","legendary","Fusion Engine",  "fusion_engine_leg",   CW.legendary),
];

export async function seedRoyaleItems(): Promise<void> {
  const count = await RoyaleItem.countDocuments();

  if (count === 0) {
    // Fresh database — seed all legacy items
    logger.info("Seeding royale items (legacy pools)…");

    const generalSlug = (name: string) =>
      name.toLowerCase().replace(/\s+/g, "_").replace(/[(),]/g, "");

    const toInsert = [
      ...GENERAL_ROYALE_ITEMS.map(i => ({
        ...i,
        royaleType: "general",
        royaleCategory: null,
        spinType: null,
        itemRef: null,
        imageCard: `/assets/royale/general/${generalSlug(i.name)}.png`,
      })),
      ...SHOOTING_ROYALE_ITEMS.map(i => ({
        ...i,
        royaleType: "shooting",
        royaleCategory: null,
        spinType: null,
        itemRef: null,
        imageCard: i.reward.miniGameItemId
          ? `/assets/items/${i.reward.miniGameItemId}.png`
          : "/assets/royale/placeholder.png",
      })),
      ...RACING_ROYALE_ITEMS.map(i => ({
        ...i,
        royaleType: "racing",
        royaleCategory: null,
        spinType: null,
        itemRef: null,
        imageCard: i.reward.carId
          ? `/assets/cars/${i.reward.carId}.png`
          : i.reward.carPartId
            ? `/assets/parts/${i.reward.carPartId}.png`
            : "/assets/royale/placeholder.png",
      })),
    ];

    await RoyaleItem.insertMany(toInsert);
    logger.info(`Seeded ${toInsert.length} legacy royale items`);
  }

  // Always check whether category pools need seeding (independent of legacy check)
  const categoryCount = await RoyaleItem.countDocuments({ royaleCategory: { $ne: null } });
  if (categoryCount === 0) {
    logger.info("Seeding royale category pools (22 pools)…");
    await RoyaleItem.insertMany(CATEGORY_POOLS);
    logger.info(`Seeded ${CATEGORY_POOLS.length} royale category pool items`);
  }
}
