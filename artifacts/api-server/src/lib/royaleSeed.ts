/**
 * royaleSeed.ts — Seeds RoyaleItem documents for all 11 categories × 2 spinTypes.
 * Uses upsert to avoid duplicates on repeated calls.
 */
import RoyaleItem from "../models/RoyaleItem";

interface SeedItem {
  name: string;
  itemRef: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  dropWeight: number;
  itemType: "weapon" | "armor" | "consumable" | "ammo" | "car" | "car_part";
  royaleCategory: string;
  spinType: "dc_spin" | "master_royale";
}

async function upsertItem(item: SeedItem) {
  await RoyaleItem.findOneAndUpdate(
    {
      royaleCategory: item.royaleCategory as any,
      spinType: item.spinType as any,
      itemRef: item.itemRef,
      name: item.name,
    },
    {
      $set: {
        royaleCategory: item.royaleCategory,
        spinType: item.spinType,
        itemRef: item.itemRef,
        name: item.name,
        tier: item.tier,
        dropWeight: item.dropWeight,
        itemType: item.itemType,
        royaleType: "shooting",
        isActive: true,
        "reward.miniGameItemId": item.itemRef,
      },
    },
    { upsert: true, new: true },
  );
}

export async function seedRoyalePools(): Promise<void> {
  const items: SeedItem[] = [];

  // ── PISTOLS ──────────────────────────────────────────────────────────────────
  const pistolDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["Glock 17 (Common)", "glock17_common", "common", 40],
    ["Glock 17 (Uncommon)", "glock17_uncommon", "uncommon", 25],
    ["Glock 17 (Rare)", "glock17_rare", "rare", 8],
    ["Desert Eagle (Common)", "deagle_common", "common", 40],
    ["Desert Eagle (Uncommon)", "deagle_uncommon", "uncommon", 25],
    ["Desert Eagle (Rare)", "deagle_rare", "rare", 8],
    ["Beretta (Common)", "beretta_common", "common", 40],
    ["Beretta (Uncommon)", "beretta_uncommon", "uncommon", 25],
    ["Beretta (Rare)", "beretta_rare", "rare", 8],
    ["USP-S (Common)", "usps_common", "common", 40],
    ["USP-S (Uncommon)", "usps_uncommon", "uncommon", 25],
    ["USP-S (Rare)", "usps_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of pistolDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "pistols", spinType: "dc_spin" });
  }

  const pistolMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["Glock 17 (Rare)", "glock17_rare", "rare", 30],
    ["Glock 17 (Epic)", "glock17_epic", "epic", 15],
    ["Glock 17 (Legendary)", "glock17_legendary", "legendary", 5],
    ["Desert Eagle (Rare)", "deagle_rare", "rare", 30],
    ["Desert Eagle (Epic)", "deagle_epic", "epic", 15],
    ["Desert Eagle (Legendary)", "deagle_legendary", "legendary", 5],
    ["Beretta (Rare)", "beretta_rare", "rare", 30],
    ["Beretta (Epic)", "beretta_epic", "epic", 15],
    ["Beretta (Legendary)", "beretta_legendary", "legendary", 5],
    ["USP-S (Rare)", "usps_rare", "rare", 30],
    ["USP-S (Epic)", "usps_epic", "epic", 15],
    ["USP-S (Legendary)", "usps_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of pistolMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "pistols", spinType: "master_royale" });
  }

  // ── SMGs ─────────────────────────────────────────────────────────────────────
  const smgDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["MP5 (Common)", "mp5_common", "common", 40],
    ["MP5 (Uncommon)", "mp5_uncommon", "uncommon", 25],
    ["MP5 (Rare)", "mp5_rare", "rare", 8],
    ["Uzi (Common)", "uzi_common", "common", 40],
    ["Uzi (Uncommon)", "uzi_uncommon", "uncommon", 25],
    ["Uzi (Rare)", "uzi_rare", "rare", 8],
    ["MAC-10 (Common)", "mac10_common", "common", 40],
    ["MAC-10 (Uncommon)", "mac10_uncommon", "uncommon", 25],
    ["MAC-10 (Rare)", "mac10_rare", "rare", 8],
    ["P90 (Common)", "p90_common", "common", 40],
    ["P90 (Uncommon)", "p90_uncommon", "uncommon", 25],
    ["P90 (Rare)", "p90_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of smgDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "smgs", spinType: "dc_spin" });
  }

  const smgMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["MP5 (Rare)", "mp5_rare", "rare", 30],
    ["MP5 (Epic)", "mp5_epic", "epic", 15],
    ["MP5 (Legendary)", "mp5_legendary", "legendary", 5],
    ["Uzi (Rare)", "uzi_rare", "rare", 30],
    ["Uzi (Epic)", "uzi_epic", "epic", 15],
    ["Uzi (Legendary)", "uzi_legendary", "legendary", 5],
    ["MAC-10 (Rare)", "mac10_rare", "rare", 30],
    ["MAC-10 (Epic)", "mac10_epic", "epic", 15],
    ["MAC-10 (Legendary)", "mac10_legendary", "legendary", 5],
    ["P90 (Rare)", "p90_rare", "rare", 30],
    ["P90 (Epic)", "p90_epic", "epic", 15],
    ["P90 (Legendary)", "p90_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of smgMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "smgs", spinType: "master_royale" });
  }

  // ── ASSAULT RIFLES ───────────────────────────────────────────────────────────
  const arDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["AK-47 (Common)", "ak47_common", "common", 40],
    ["AK-47 (Uncommon)", "ak47_uncommon", "uncommon", 25],
    ["AK-47 (Rare)", "ak47_rare", "rare", 8],
    ["M4A1 (Common)", "m4a1_common", "common", 40],
    ["M4A1 (Uncommon)", "m4a1_uncommon", "uncommon", 25],
    ["M4A1 (Rare)", "m4a1_rare", "rare", 8],
    ["SCAR-H (Common)", "scarh_common", "common", 40],
    ["SCAR-H (Uncommon)", "scarh_uncommon", "uncommon", 25],
    ["SCAR-H (Rare)", "scarh_rare", "rare", 8],
    ["HK416 (Common)", "hk416_common", "common", 40],
    ["HK416 (Uncommon)", "hk416_uncommon", "uncommon", 25],
    ["HK416 (Rare)", "hk416_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of arDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "assault_rifles", spinType: "dc_spin" });
  }

  const arMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["AK-47 (Rare)", "ak47_rare", "rare", 30],
    ["AK-47 (Epic)", "ak47_epic", "epic", 15],
    ["AK-47 (Legendary)", "ak47_legendary", "legendary", 5],
    ["M4A1 (Rare)", "m4a1_rare", "rare", 30],
    ["M4A1 (Epic)", "m4a1_epic", "epic", 15],
    ["M4A1 (Legendary)", "m4a1_legendary", "legendary", 5],
    ["SCAR-H (Rare)", "scarh_rare", "rare", 30],
    ["SCAR-H (Epic)", "scarh_epic", "epic", 15],
    ["SCAR-H (Legendary)", "scarh_legendary", "legendary", 5],
    ["HK416 (Rare)", "hk416_rare", "rare", 30],
    ["HK416 (Epic)", "hk416_epic", "epic", 15],
    ["HK416 (Legendary)", "hk416_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of arMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "assault_rifles", spinType: "master_royale" });
  }

  // ── SHOTGUNS ─────────────────────────────────────────────────────────────────
  const sgDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["Mossberg (Common)", "mossberg_common", "common", 40],
    ["Mossberg (Uncommon)", "mossberg_uncommon", "uncommon", 25],
    ["Mossberg (Rare)", "mossberg_rare", "rare", 8],
    ["SPAS-12 (Common)", "spas12_common", "common", 40],
    ["SPAS-12 (Uncommon)", "spas12_uncommon", "uncommon", 25],
    ["SPAS-12 (Rare)", "spas12_rare", "rare", 8],
    ["AA-12 (Common)", "aa12_common", "common", 40],
    ["AA-12 (Uncommon)", "aa12_uncommon", "uncommon", 25],
    ["AA-12 (Rare)", "aa12_rare", "rare", 8],
    ["Benelli (Common)", "benelli_common", "common", 40],
    ["Benelli (Uncommon)", "benelli_uncommon", "uncommon", 25],
    ["Benelli (Rare)", "benelli_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of sgDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "shotguns", spinType: "dc_spin" });
  }

  const sgMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["Mossberg (Rare)", "mossberg_rare", "rare", 30],
    ["Mossberg (Epic)", "mossberg_epic", "epic", 15],
    ["Mossberg (Legendary)", "mossberg_legendary", "legendary", 5],
    ["SPAS-12 (Rare)", "spas12_rare", "rare", 30],
    ["SPAS-12 (Epic)", "spas12_epic", "epic", 15],
    ["SPAS-12 (Legendary)", "spas12_legendary", "legendary", 5],
    ["AA-12 (Rare)", "aa12_rare", "rare", 30],
    ["AA-12 (Epic)", "aa12_epic", "epic", 15],
    ["AA-12 (Legendary)", "aa12_legendary", "legendary", 5],
    ["Benelli (Rare)", "benelli_rare", "rare", 30],
    ["Benelli (Epic)", "benelli_epic", "epic", 15],
    ["Benelli (Legendary)", "benelli_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of sgMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "shotguns", spinType: "master_royale" });
  }

  // ── SNIPER RIFLES ────────────────────────────────────────────────────────────
  const srDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["Barrett (Common)", "barrett_common", "common", 40],
    ["Barrett (Uncommon)", "barrett_uncommon", "uncommon", 25],
    ["Barrett (Rare)", "barrett_rare", "rare", 8],
    ["AWP (Common)", "awp_common", "common", 40],
    ["AWP (Uncommon)", "awp_uncommon", "uncommon", 25],
    ["AWP (Rare)", "awp_rare", "rare", 8],
    ["Dragunov (Common)", "dragunov_common", "common", 40],
    ["Dragunov (Uncommon)", "dragunov_uncommon", "uncommon", 25],
    ["Dragunov (Rare)", "dragunov_rare", "rare", 8],
    ["Intervention (Common)", "intervention_common", "common", 40],
    ["Intervention (Uncommon)", "intervention_uncommon", "uncommon", 25],
    ["Intervention (Rare)", "intervention_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of srDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "sniper_rifles", spinType: "dc_spin" });
  }

  const srMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["Barrett (Rare)", "barrett_rare", "rare", 30],
    ["Barrett (Epic)", "barrett_epic", "epic", 15],
    ["Barrett (Legendary)", "barrett_legendary", "legendary", 5],
    ["AWP (Rare)", "awp_rare", "rare", 30],
    ["AWP (Epic)", "awp_epic", "epic", 15],
    ["AWP (Legendary)", "awp_legendary", "legendary", 5],
    ["Dragunov (Rare)", "dragunov_rare", "rare", 30],
    ["Dragunov (Epic)", "dragunov_epic", "epic", 15],
    ["Dragunov (Legendary)", "dragunov_legendary", "legendary", 5],
    ["Intervention (Rare)", "intervention_rare", "rare", 30],
    ["Intervention (Epic)", "intervention_epic", "epic", 15],
    ["Intervention (Legendary)", "intervention_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of srMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "sniper_rifles", spinType: "master_royale" });
  }

  // ── LMGs ─────────────────────────────────────────────────────────────────────
  const lmgDcSpin: [string, string, "common"|"uncommon"|"rare", number][] = [
    ["M249 (Common)", "m249_common", "common", 40],
    ["M249 (Uncommon)", "m249_uncommon", "uncommon", 25],
    ["M249 (Rare)", "m249_rare", "rare", 8],
    ["RPK (Common)", "rpk_common", "common", 40],
    ["RPK (Uncommon)", "rpk_uncommon", "uncommon", 25],
    ["RPK (Rare)", "rpk_rare", "rare", 8],
    ["Minigun (Common)", "minigun_common", "common", 40],
    ["Minigun (Uncommon)", "minigun_uncommon", "uncommon", 25],
    ["Minigun (Rare)", "minigun_rare", "rare", 8],
    ["MG4 (Common)", "mg4_common", "common", 40],
    ["MG4 (Uncommon)", "mg4_uncommon", "uncommon", 25],
    ["MG4 (Rare)", "mg4_rare", "rare", 8],
  ];
  for (const [name, itemRef, tier, dropWeight] of lmgDcSpin) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "lmgs", spinType: "dc_spin" });
  }

  const lmgMaster: [string, string, "rare"|"epic"|"legendary", number][] = [
    ["M249 (Rare)", "m249_rare", "rare", 30],
    ["M249 (Epic)", "m249_epic", "epic", 15],
    ["M249 (Legendary)", "m249_legendary", "legendary", 5],
    ["RPK (Rare)", "rpk_rare", "rare", 30],
    ["RPK (Epic)", "rpk_epic", "epic", 15],
    ["RPK (Legendary)", "rpk_legendary", "legendary", 5],
    ["Minigun (Rare)", "minigun_rare", "rare", 30],
    ["Minigun (Epic)", "minigun_epic", "epic", 15],
    ["Minigun (Legendary)", "minigun_legendary", "legendary", 5],
    ["MG4 (Rare)", "mg4_rare", "rare", 30],
    ["MG4 (Epic)", "mg4_epic", "epic", 15],
    ["MG4 (Legendary)", "mg4_legendary", "legendary", 5],
  ];
  for (const [name, itemRef, tier, dropWeight] of lmgMaster) {
    items.push({ name, itemRef, tier, dropWeight, itemType: "weapon", royaleCategory: "lmgs", spinType: "master_royale" });
  }

  // ── BODY ARMOR ───────────────────────────────────────────────────────────────
  items.push(
    { name: "Street Vest", itemRef: "street_vest", tier: "common", dropWeight: 40, itemType: "armor", royaleCategory: "body_armor", spinType: "dc_spin" },
    { name: "Tactical Vest", itemRef: "tactical_vest", tier: "uncommon", dropWeight: 25, itemType: "armor", royaleCategory: "body_armor", spinType: "dc_spin" },
    { name: "Combat Plate", itemRef: "combat_plate", tier: "rare", dropWeight: 8, itemType: "armor", royaleCategory: "body_armor", spinType: "dc_spin" },
    { name: "Combat Plate", itemRef: "combat_plate", tier: "rare", dropWeight: 30, itemType: "armor", royaleCategory: "body_armor", spinType: "master_royale" },
    { name: "Ballistic Rig", itemRef: "ballistic_rig", tier: "epic", dropWeight: 15, itemType: "armor", royaleCategory: "body_armor", spinType: "master_royale" },
    { name: "Exo Armor", itemRef: "exo_armor", tier: "legendary", dropWeight: 5, itemType: "armor", royaleCategory: "body_armor", spinType: "master_royale" },
  );

  // ── CONSUMABLES ──────────────────────────────────────────────────────────────
  items.push(
    { name: "Small Medkit", itemRef: "small_medkit", tier: "common", dropWeight: 40, itemType: "consumable", royaleCategory: "consumables", spinType: "dc_spin" },
    { name: "Smoke Grenade", itemRef: "smoke_grenade", tier: "common", dropWeight: 40, itemType: "consumable", royaleCategory: "consumables", spinType: "dc_spin" },
    { name: "Frag Grenade", itemRef: "frag_grenade", tier: "uncommon", dropWeight: 25, itemType: "consumable", royaleCategory: "consumables", spinType: "dc_spin" },
    { name: "Stim Shot", itemRef: "stim_shot", tier: "uncommon", dropWeight: 25, itemType: "consumable", royaleCategory: "consumables", spinType: "dc_spin" },
    { name: "Stimpack", itemRef: "stimpack", tier: "rare", dropWeight: 8, itemType: "consumable", royaleCategory: "consumables", spinType: "dc_spin" },
    { name: "Large Medkit", itemRef: "large_medkit", tier: "rare", dropWeight: 30, itemType: "consumable", royaleCategory: "consumables", spinType: "master_royale" },
    { name: "Mega Medkit", itemRef: "mega_medkit", tier: "epic", dropWeight: 15, itemType: "consumable", royaleCategory: "consumables", spinType: "master_royale" },
    { name: "Cyber Grenade", itemRef: "cyber_grenade", tier: "epic", dropWeight: 15, itemType: "consumable", royaleCategory: "consumables", spinType: "master_royale" },
    { name: "Nano Shield", itemRef: "nano_shield", tier: "epic", dropWeight: 15, itemType: "consumable", royaleCategory: "consumables", spinType: "master_royale" },
    { name: "Berserker Dose", itemRef: "berserker_dose", tier: "legendary", dropWeight: 5, itemType: "consumable", royaleCategory: "consumables", spinType: "master_royale" },
  );

  // ── AMMO ─────────────────────────────────────────────────────────────────────
  items.push(
    { name: "Pistol Rounds (Common)", itemRef: "pistol_rounds_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Pistol Rounds (Uncommon)", itemRef: "pistol_rounds_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "SMG Rounds (Common)", itemRef: "smg_rounds_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "SMG Rounds (Uncommon)", itemRef: "smg_rounds_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Rifle Rounds (Common)", itemRef: "rifle_rounds_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Rifle Rounds (Uncommon)", itemRef: "rifle_rounds_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Shotgun Shells (Common)", itemRef: "shotgun_shells_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Shotgun Shells (Uncommon)", itemRef: "shotgun_shells_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Sniper Rounds (Common)", itemRef: "sniper_rounds_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Sniper Rounds (Uncommon)", itemRef: "sniper_rounds_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "LMG Rounds (Common)", itemRef: "lmg_rounds_common", tier: "common", dropWeight: 40, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "LMG Rounds (Uncommon)", itemRef: "lmg_rounds_uncommon", tier: "uncommon", dropWeight: 25, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Pistol Rounds (Rare)", itemRef: "pistol_rounds_rare", tier: "rare", dropWeight: 8, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    { name: "Rifle Rounds (Rare)", itemRef: "rifle_rounds_rare", tier: "rare", dropWeight: 8, itemType: "ammo", royaleCategory: "ammo", spinType: "dc_spin" },
    // master_royale
    { name: "Pistol Rounds (Rare)", itemRef: "pistol_rounds_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "SMG Rounds (Rare)", itemRef: "smg_rounds_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Rifle Rounds (Rare)", itemRef: "rifle_rounds_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Shotgun Shells (Rare)", itemRef: "shotgun_shells_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Sniper Rounds (Rare)", itemRef: "sniper_rounds_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "LMG Rounds (Rare)", itemRef: "lmg_rounds_rare", tier: "rare", dropWeight: 30, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Pistol Rounds (Epic)", itemRef: "pistol_rounds_epic", tier: "epic", dropWeight: 15, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Rifle Rounds (Epic)", itemRef: "rifle_rounds_epic", tier: "epic", dropWeight: 15, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Pistol Rounds (Legendary)", itemRef: "pistol_rounds_legendary", tier: "legendary", dropWeight: 5, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
    { name: "Rifle Rounds (Legendary)", itemRef: "rifle_rounds_legendary", tier: "legendary", dropWeight: 5, itemType: "ammo", royaleCategory: "ammo", spinType: "master_royale" },
  );

  // ── RACE CARS ────────────────────────────────────────────────────────────────
  items.push(
    { name: "Street Racer (Common)", itemRef: "streetracer_common", tier: "common", dropWeight: 40, itemType: "car", royaleCategory: "race_cars", spinType: "dc_spin" },
    { name: "Street Racer (Uncommon)", itemRef: "streetracer_uncommon", tier: "uncommon", dropWeight: 25, itemType: "car", royaleCategory: "race_cars", spinType: "dc_spin" },
    { name: "Muscle Car (Rare)", itemRef: "muscle_car_rare", tier: "rare", dropWeight: 8, itemType: "car", royaleCategory: "race_cars", spinType: "dc_spin" },
    { name: "Muscle Car (Rare)", itemRef: "muscle_car_rare", tier: "rare", dropWeight: 30, itemType: "car", royaleCategory: "race_cars", spinType: "master_royale" },
    { name: "Cyber Jet (Epic)", itemRef: "cyberjet_epic", tier: "epic", dropWeight: 15, itemType: "car", royaleCategory: "race_cars", spinType: "master_royale" },
    { name: "Cyber Jet (Legendary)", itemRef: "cyberjet_legendary", tier: "legendary", dropWeight: 5, itemType: "car", royaleCategory: "race_cars", spinType: "master_royale" },
  );

  // ── CAR PARTS ────────────────────────────────────────────────────────────────
  items.push(
    { name: "Engine (Common)", itemRef: "engine_common", tier: "common", dropWeight: 40, itemType: "car_part", royaleCategory: "car_parts", spinType: "dc_spin" },
    { name: "Engine (Uncommon)", itemRef: "engine_uncommon", tier: "uncommon", dropWeight: 25, itemType: "car_part", royaleCategory: "car_parts", spinType: "dc_spin" },
    { name: "Tires (Common)", itemRef: "tires_common", tier: "common", dropWeight: 40, itemType: "car_part", royaleCategory: "car_parts", spinType: "dc_spin" },
    { name: "Tires (Uncommon)", itemRef: "tires_uncommon", tier: "uncommon", dropWeight: 25, itemType: "car_part", royaleCategory: "car_parts", spinType: "dc_spin" },
    { name: "Engine (Rare)", itemRef: "engine_rare", tier: "rare", dropWeight: 30, itemType: "car_part", royaleCategory: "car_parts", spinType: "master_royale" },
    { name: "Tires (Rare)", itemRef: "tires_rare", tier: "rare", dropWeight: 30, itemType: "car_part", royaleCategory: "car_parts", spinType: "master_royale" },
    { name: "Nitro (Epic)", itemRef: "nitro_epic", tier: "epic", dropWeight: 15, itemType: "car_part", royaleCategory: "car_parts", spinType: "master_royale" },
    { name: "Engine (Legendary)", itemRef: "engine_legendary", tier: "legendary", dropWeight: 5, itemType: "car_part", royaleCategory: "car_parts", spinType: "master_royale" },
  );

  // Upsert all items
  await Promise.all(items.map(upsertItem));
  console.log(`[royaleSeed] Seeded ${items.length} royale pool items.`);
}
