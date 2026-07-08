/**
 * Seed — combat items for the Shooting Royale and combat loadout.
 * 50 items total: 10 per tier × 5 tiers.
 * Run once at startup if MiniGameItem collection is empty.
 */
import MiniGameItem from "../models/MiniGameItem";
import { logger } from "../lib/logger";

const COMBAT_ITEMS = [
  // ── COMMON (10) ────────────────────────────────────────────────────────────
  { itemId: "pistol_common",        name: "Pistol",          category: "weapon",     tier: "common",    stats: { damageMin: 15, damageMax: 25, accuracy: 85 },                                     flavorText: "Standard-issue sidearm. Reliable, if unimpressive." },
  { itemId: "knife_common",         name: "Knife",           category: "weapon",     tier: "common",    stats: { damageMin: 10, damageMax: 20, accuracy: 95, specialEffect: "bleed", specialChance: 10 }, flavorText: "Close range. Very close range." },
  { itemId: "baseball_bat_common",  name: "Baseball Bat",    category: "weapon",     tier: "common",    stats: { damageMin: 12, damageMax: 22, accuracy: 90 },                                     flavorText: "America's favorite problem-solver." },
  { itemId: "light_vest_common",    name: "Light Vest",      category: "armor",      tier: "common",    stats: { defense: 8,  hp: 10 },                                                            flavorText: "Better than nothing. Barely." },
  { itemId: "bandage_common",       name: "Bandage",         category: "consumable", tier: "common",    stats: { healAmount: 20 },                                                                  flavorText: "Stop the bleeding. That's step one." },
  { itemId: "smoke_grenade_common", name: "Smoke Grenade",   category: "consumable", tier: "common",    stats: { specialEffect: "blind", specialChance: 100 },                                     flavorText: "Reduces enemy accuracy for 2 turns." },
  { itemId: "std_ammo_common",      name: "Standard Ammo",   category: "ammo",       tier: "common",    stats: { damageMultiplier: 1.0 },                                                           flavorText: "Plain rounds. They still kill." },
  { itemId: "tact_gloves_common",   name: "Tactical Gloves", category: "armor",      tier: "common",    stats: { defense: 3, accuracy: 5 },                                                        flavorText: "+5% accuracy. Grip matters." },
  { itemId: "beanie_helm_common",   name: "Beanie Helmet",   category: "armor",      tier: "common",    stats: { defense: 5,  hp: 5 },                                                             flavorText: "It's a start." },
  { itemId: "flashlight_common",    name: "Flashlight",      category: "consumable", tier: "common",    stats: { specialEffect: "daze", specialChance: 30 },                                       flavorText: "30% chance to daze opponent for 1 turn." },

  // ── UNCOMMON (10) ──────────────────────────────────────────────────────────
  { itemId: "smg_uncommon",         name: "SMG",             category: "weapon",     tier: "uncommon",  stats: { damageMin: 20, damageMax: 35, accuracy: 80, specialEffect: "double_fire", specialChance: 20 }, flavorText: "Double fire chance: 20%. Spray and pray." },
  { itemId: "combat_knife_uncommon",name: "Combat Knife",    category: "weapon",     tier: "uncommon",  stats: { damageMin: 18, damageMax: 28, accuracy: 95, specialEffect: "bleed", specialChance: 20 }, flavorText: "Military-grade. Stays sharp longer than you do." },
  { itemId: "med_vest_uncommon",    name: "Medium Vest",     category: "armor",      tier: "uncommon",  stats: { defense: 18, hp: 20 },                                                            flavorText: "Front and back coverage. Progress." },
  { itemId: "medkit_uncommon",      name: "Medkit",          category: "consumable", tier: "uncommon",  stats: { healAmount: 40 },                                                                  flavorText: "Field-grade trauma kit. Works on most injuries." },
  { itemId: "frag_nade_uncommon",   name: "Frag Grenade",    category: "consumable", tier: "uncommon",  stats: { damageMin: 25, damageMax: 45, specialEffect: "stun", specialChance: 25 },         flavorText: "25% stun chance. Boom." },
  { itemId: "hp_ammo_uncommon",     name: "Hollow Point Ammo",category: "ammo",      tier: "uncommon",  stats: { damageMultiplier: 1.15 },                                                         flavorText: "+15% damage. Expands on impact." },
  { itemId: "tact_boots_uncommon",  name: "Tactical Boots",  category: "armor",      tier: "uncommon",  stats: { defense: 5, specialEffect: "dodge", specialChance: 8 },                           flavorText: "8% dodge chance per turn." },
  { itemId: "ear_prot_uncommon",    name: "Ear Protection",  category: "armor",      tier: "uncommon",  stats: { defense: 4, specialEffect: "anti_stun", specialChance: 30 },                      flavorText: "30% resistance to stun effects." },
  { itemId: "combat_mask_uncommon", name: "Combat Mask",     category: "armor",      tier: "uncommon",  stats: { defense: 7, hp: 10 },                                                             flavorText: "Fear is a weapon too." },
  { itemId: "suppressor_uncommon",  name: "Suppressor",      category: "ammo",       tier: "uncommon",  stats: { damageMultiplier: 1.05, specialEffect: "silence", specialChance: 100 },           flavorText: "Slightly less lethal, extremely quieter." },

  // ── RARE (10) ──────────────────────────────────────────────────────────────
  { itemId: "ar_rare",              name: "Assault Rifle",   category: "weapon",     tier: "rare",      stats: { damageMin: 35, damageMax: 55, accuracy: 88 },                                     flavorText: "Mid-range precision. The backbone of any loadout." },
  { itemId: "shotgun_rare",         name: "Shotgun",         category: "weapon",     tier: "rare",      stats: { damageMin: 40, damageMax: 70, accuracy: 60 },                                     flavorText: "What it lacks in range, it makes up for in consequences." },
  { itemId: "heavy_vest_rare",      name: "Heavy Vest",      category: "armor",      tier: "rare",      stats: { defense: 30, hp: 30 },                                                            flavorText: "Takes a hit. Takes another one." },
  { itemId: "adv_medkit_rare",      name: "Advanced Medkit", category: "consumable", tier: "rare",      stats: { healAmount: 70 },                                                                  flavorText: "Military-grade trauma response." },
  { itemId: "stun_nade_rare",       name: "Stun Grenade",    category: "consumable", tier: "rare",      stats: { specialEffect: "stun", specialChance: 70 },                                       flavorText: "70% stun for 1 turn. Non-lethal. Mostly." },
  { itemId: "ap_ammo_rare",         name: "Armor Piercing Ammo",category: "ammo",    tier: "rare",      stats: { damageMultiplier: 1.0, specialEffect: "pierce_armor", specialChance: 100 },       flavorText: "Ignores 40% of armor defense." },
  { itemId: "nv_rare",              name: "Night Vision",    category: "armor",      tier: "rare",      stats: { defense: 5, accuracy: 15 },                                                       flavorText: "+15% accuracy. Darkness is no longer a problem." },
  { itemId: "combat_helm_rare",     name: "Combat Helmet",   category: "armor",      tier: "rare",      stats: { defense: 20, hp: 15, specialEffect: "anti_crit", specialChance: 25 },             flavorText: "25% chance to negate critical hits." },
  { itemId: "quick_mag_rare",       name: "Quick Mag",       category: "ammo",       tier: "rare",      stats: { damageMultiplier: 1.0, specialEffect: "fast_reload", specialChance: 100 },        flavorText: "Skip reload actions entirely. Time is HP." },
  { itemId: "scope_rare",           name: "Scope",           category: "ammo",       tier: "rare",      stats: { damageMultiplier: 1.1, accuracy: 20 },                                            flavorText: "+10% damage, +20% accuracy. Distance is your friend." },

  // ── EPIC (10) ──────────────────────────────────────────────────────────────
  { itemId: "sniper_epic",          name: "Sniper Rifle",    category: "weapon",     tier: "epic",      stats: { damageMin: 60, damageMax: 100, accuracy: 70, specialEffect: "headshot", specialChance: 25 }, flavorText: "25% headshot chance: +50% bonus damage." },
  { itemId: "energy_smg_epic",      name: "Energy SMG",      category: "weapon",     tier: "epic",      stats: { damageMin: 30, damageMax: 50, accuracy: 82, specialEffect: "shock", specialChance: 30 },    flavorText: "30% shock chance: skip opponent's next action." },
  { itemId: "riot_shield_epic",     name: "Riot Shield",     category: "armor",      tier: "epic",      stats: { defense: 45, hp: 20, specialEffect: "block", specialChance: 30 },                 flavorText: "30% chance to fully block incoming damage." },
  { itemId: "nano_medkit_epic",     name: "Nano Medkit",     category: "consumable", tier: "epic",      stats: { healAmount: 80, specialEffect: "regen", specialChance: 100 },                     flavorText: "Heals 80 HP now + 15 HP per turn for 2 turns." },
  { itemId: "emp_nade_epic",        name: "EMP Grenade",     category: "consumable", tier: "epic",      stats: { specialEffect: "disable", specialChance: 80 },                                    flavorText: "80% chance to disable opponent's special for 2 turns." },
  { itemId: "incend_ammo_epic",     name: "Incendiary Ammo", category: "ammo",       tier: "epic",      stats: { damageMultiplier: 1.05, specialEffect: "burn", specialChance: 60 },               flavorText: "60% burn: 10 damage per turn for 3 turns." },
  { itemId: "exo_gloves_epic",      name: "Exoskeleton Gloves",category: "armor",    tier: "epic",      stats: { defense: 10, damageMin: 10 },                                                     flavorText: "+10 to minimum weapon damage. Punch harder." },
  { itemId: "smart_visor_epic",     name: "Smart Visor",     category: "armor",      tier: "epic",      stats: { defense: 8, accuracy: 25, specialEffect: "scan", specialChance: 100 },            flavorText: "Reveals opponent's HP and next action." },
  { itemId: "ext_barrel_epic",      name: "Extended Barrel", category: "ammo",       tier: "epic",      stats: { damageMultiplier: 1.20, accuracy: -5 },                                           flavorText: "+20% damage. Slightly harder to control." },
  { itemId: "recon_drone_epic",     name: "Recon Drone",     category: "consumable", tier: "epic",      stats: { specialEffect: "dodge_boost", specialChance: 100 },                               flavorText: "+25% dodge chance for 3 turns." },

  // ── LEGENDARY (10) ─────────────────────────────────────────────────────────
  { itemId: "plasma_rifle_leg",     name: "Plasma Rifle",    category: "weapon",     tier: "legendary", stats: { damageMin: 80, damageMax: 130, accuracy: 85, specialEffect: "burn", specialChance: 50 }, flavorText: "50% burn. The future is violent." },
  { itemId: "katana_leg",           name: "Legendary Katana",category: "weapon",     tier: "legendary", stats: { damageMin: 70, damageMax: 120, accuracy: 95, specialEffect: "pierce_armor", specialChance: 100 }, flavorText: "Ignores 50% armor. Forged in silence." },
  { itemId: "titan_armor_leg",      name: "Titan Armor",     category: "armor",      tier: "legendary", stats: { defense: 60, hp: 50, specialEffect: "retaliate", specialChance: 20 },             flavorText: "20% chance to deal 30 damage back on hit." },
  { itemId: "regen_field_leg",      name: "Regen Field Kit", category: "consumable", tier: "legendary", stats: { healAmount: 50, specialEffect: "regen", specialChance: 100 },                     flavorText: "Heals 50 HP + 20 HP per turn for entire remaining match." },
  { itemId: "bh_nade_leg",          name: "Black Hole Grenade",category: "consumable",tier: "legendary",stats: { damageMin: 60, damageMax: 100, specialEffect: "stun", specialChance: 90 },        flavorText: "90% stun + massive damage. Handle with care." },
  { itemId: "quantum_ammo_leg",     name: "Quantum Ammo",    category: "ammo",       tier: "legendary", stats: { damageMultiplier: 1.35, specialEffect: "pierce_armor", specialChance: 100 },      flavorText: "+35% damage, ignores all armor." },
  { itemId: "pred_mask_leg",        name: "Predator Mask",   category: "armor",      tier: "legendary", stats: { defense: 20, accuracy: 20, specialEffect: "fear", specialChance: 15 },            flavorText: "15% chance to make opponent skip their action." },
  { itemId: "holo_decoy_leg",       name: "Hologram Decoy",  category: "consumable", tier: "legendary", stats: { specialEffect: "invincible", specialChance: 100 },                                flavorText: "Become untargetable for 1 full turn." },
  { itemId: "omega_pistol_leg",     name: "Omega Pistol",    category: "weapon",     tier: "legendary", stats: { damageMin: 90, damageMax: 140, accuracy: 90, specialEffect: "pierce_armor", specialChance: 100 }, flavorText: "Pierces all shields. One shot, one story." },
  { itemId: "wingsuit_leg",         name: "Wingsuit",        category: "armor",      tier: "legendary", stats: { defense: 15, specialEffect: "dodge", specialChance: 35 },                         flavorText: "35% dodge. You can't hit what isn't there." },
];

export async function seedMiniGameItems(): Promise<void> {
  const count = await MiniGameItem.countDocuments();
  if (count > 0) return; // Already seeded

  logger.info("Seeding mini-game combat items…");
  await MiniGameItem.insertMany(
    COMBAT_ITEMS.map(item => ({
      ...item,
      imageCard:  `/assets/items/${item.itemId}.png`,
      // Weapons & armor: one equipped at a time; consumables & ammo: stackable
      stackable: item.category === "consumable" || item.category === "ammo",
      maxStack:  item.category === "consumable" || item.category === "ammo" ? 99 : 1,
    })),
  );
  logger.info(`Seeded ${COMBAT_ITEMS.length} combat items`);
}
