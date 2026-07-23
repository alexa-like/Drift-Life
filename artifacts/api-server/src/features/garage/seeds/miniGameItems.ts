/**
 * Seed — combat items for the Shooting Royale and combat loadout.
 * Uses upsert pattern keyed on itemId so re-running is safe.
 */
import MiniGameItem from "../models/MiniGameItem";
import { logger } from "../../../lib/logger";

// ─── PISTOLS ────────────────────────────────────────────────────────────────
const PISTOL_ITEMS = [
  // Glock 17
  { itemId: "glock17_common",    name: "Glock 17",           category: "pistol", tier: "common",    weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 12, damageMax: 18, accuracy: 82 },                                          maxDurability: 80,  magazineSize: 15, flavorText: "Standard-issue. Never jams." },
  { itemId: "glock17_uncommon",  name: "Glock 17 Mk.II",     category: "pistol", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 16, damageMax: 24, accuracy: 82 },                                          maxDurability: 120, magazineSize: 17, flavorText: "Refined trigger. Tighter groupings." },
  { itemId: "glock17_rare",      name: "Glock 17 Custom",    category: "pistol", tier: "rare",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 22, damageMax: 32, accuracy: 82 },                                          maxDurability: 160, magazineSize: 19, flavorText: "Custom work. Somebody cared." },
  { itemId: "glock17_epic",      name: "Glock 17 Cyber",     category: "pistol", tier: "epic",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 30, damageMax: 44, accuracy: 82, specialEffect: "double_tap",  specialChance: 18 }, maxDurability: 220, magazineSize: 21, flavorText: "Neural-linked trigger. Fires twice." },
  { itemId: "glock17_legendary", name: "Glock 17 Phantom",   category: "pistol", tier: "legendary", weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 42, damageMax: 60, accuracy: 82, specialEffect: "double_tap",  specialChance: 25 }, maxDurability: 300, magazineSize: 23, flavorText: "You hear it twice before you feel it once." },
  // Desert Eagle
  { itemId: "deagle_common",     name: "Desert Eagle",       category: "pistol", tier: "common",    weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 20, damageMax: 28, accuracy: 82 },                                          maxDurability: 80,  magazineSize: 7,  flavorText: "Heavy. Loud. Effective." },
  { itemId: "deagle_uncommon",   name: "Desert Eagle Mk.II", category: "pistol", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 26, damageMax: 36, accuracy: 82 },                                          maxDurability: 120, magazineSize: 8,  flavorText: "Improved gas system. Still loud." },
  { itemId: "deagle_rare",       name: "Desert Eagle Custom",category: "pistol", tier: "rare",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 34, damageMax: 48, accuracy: 82, specialEffect: "stun",        specialChance: 12 }, maxDurability: 160, magazineSize: 9,  flavorText: "Concussive round. Think fast." },
  { itemId: "deagle_epic",       name: "Desert Eagle Cyber", category: "pistol", tier: "epic",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 46, damageMax: 64, accuracy: 82, specialEffect: "stun",        specialChance: 20 }, maxDurability: 220, magazineSize: 10, flavorText: "Smart rounds. They find the weak spot." },
  { itemId: "deagle_legendary",  name: "Desert Eagle Phantom",category:"pistol", tier: "legendary", weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 62, damageMax: 86, accuracy: 82, specialEffect: "stun",        specialChance: 28 }, maxDurability: 300, magazineSize: 11, flavorText: "One shot of this and you stop thinking." },
  // Beretta M9
  { itemId: "beretta_common",    name: "Beretta M9",         category: "pistol", tier: "common",    weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 11, damageMax: 17, accuracy: 82 },                                          maxDurability: 80,  magazineSize: 15, flavorText: "Military sideline. Proven performer." },
  { itemId: "beretta_uncommon",  name: "Beretta M9 Mk.II",   category: "pistol", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 15, damageMax: 22, accuracy: 82 },                                          maxDurability: 120, magazineSize: 17, flavorText: "Heavier slide, softer recoil." },
  { itemId: "beretta_rare",      name: "Beretta M9 Custom",  category: "pistol", tier: "rare",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 20, damageMax: 30, accuracy: 82 },                                          maxDurability: 160, magazineSize: 19, flavorText: "Stippled grip. Trigger job done right." },
  { itemId: "beretta_epic",      name: "Beretta M9 Cyber",   category: "pistol", tier: "epic",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 28, damageMax: 40, accuracy: 82, specialEffect: "bleed",       specialChance: 15 }, maxDurability: 220, magazineSize: 21, flavorText: "Serrated cyber-rounds leave a mark." },
  { itemId: "beretta_legendary", name: "Beretta M9 Phantom", category: "pistol", tier: "legendary", weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 38, damageMax: 56, accuracy: 82, specialEffect: "bleed",       specialChance: 22 }, maxDurability: 300, magazineSize: 23, flavorText: "Phantom rounds. They bleed before they hit." },
  // USP-S
  { itemId: "usps_common",       name: "USP-S",              category: "pistol", tier: "common",    weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 13, damageMax: 19, accuracy: 82 },                                          maxDurability: 80,  magazineSize: 12, flavorText: "Suppressed from the factory." },
  { itemId: "usps_uncommon",     name: "USP-S Mk.II",        category: "pistol", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 17, damageMax: 25, accuracy: 82 },                                          maxDurability: 120, magazineSize: 13, flavorText: "Threaded barrel. Extra quiet." },
  { itemId: "usps_rare",         name: "USP-S Custom",       category: "pistol", tier: "rare",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 23, damageMax: 34, accuracy: 82 },                                          maxDurability: 160, magazineSize: 15, flavorText: "Sub-sonic rounds. You won't hear it coming." },
  { itemId: "usps_epic",         name: "USP-S Cyber",        category: "pistol", tier: "epic",      weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 32, damageMax: 46, accuracy: 82, specialEffect: "armor_pierce", specialChance: 20 }, maxDurability: 220, magazineSize: 17, flavorText: "Nano-tip rounds. Armor is a suggestion." },
  { itemId: "usps_legendary",    name: "USP-S Phantom",      category: "pistol", tier: "legendary", weaponSlot: "secondary", ammoCategory: "pistol_rounds", stats: { damageMin: 44, damageMax: 62, accuracy: 82, specialEffect: "armor_pierce", specialChance: 30 }, maxDurability: 300, magazineSize: 19, flavorText: "Ghost rounds. Your armor never knew." },
];

// ─── SMGs ────────────────────────────────────────────────────────────────────
const SMG_ITEMS = [
  // MP5
  { itemId: "mp5_common",     name: "MP5",           category: "smg", tier: "common",    weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 10, damageMax: 15, accuracy: 72 },                                          maxDurability: 80,  magazineSize: 30, flavorText: "Classic room-clearer." },
  { itemId: "mp5_uncommon",   name: "MP5 Mk.II",     category: "smg", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 13, damageMax: 19, accuracy: 72 },                                          maxDurability: 120, magazineSize: 32, flavorText: "Extended barrel, extended reach." },
  { itemId: "mp5_rare",       name: "MP5 Custom",    category: "smg", tier: "rare",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 18, damageMax: 26, accuracy: 72 },                                          maxDurability: 160, magazineSize: 35, flavorText: "Custom bolt. Pulls faster." },
  { itemId: "mp5_epic",       name: "MP5 Cyber",     category: "smg", tier: "epic",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 25, damageMax: 36, accuracy: 72, specialEffect: "double_tap", specialChance: 22 }, maxDurability: 220, magazineSize: 38, flavorText: "Electronic fire-control. Every trigger pull counts twice." },
  { itemId: "mp5_legendary",  name: "MP5 Phantom",   category: "smg", tier: "legendary", weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 34, damageMax: 50, accuracy: 72, specialEffect: "double_tap", specialChance: 30 }, maxDurability: 300, magazineSize: 40, flavorText: "Ghost fire. They feel it before they see it." },
  // Uzi
  { itemId: "uzi_common",     name: "Uzi",           category: "smg", tier: "common",    weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 9,  damageMax: 14, accuracy: 72 },                                          maxDurability: 80,  magazineSize: 32, flavorText: "Compact chaos." },
  { itemId: "uzi_uncommon",   name: "Uzi Mk.II",     category: "smg", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 12, damageMax: 18, accuracy: 72 },                                          maxDurability: 120, magazineSize: 35, flavorText: "Tighter cyclic rate." },
  { itemId: "uzi_rare",       name: "Uzi Custom",    category: "smg", tier: "rare",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 16, damageMax: 24, accuracy: 72 },                                          maxDurability: 160, magazineSize: 38, flavorText: "Custom receiver. Still compact." },
  { itemId: "uzi_epic",       name: "Uzi Cyber",     category: "smg", tier: "epic",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 23, damageMax: 34, accuracy: 72, specialEffect: "bleed",      specialChance: 18 }, maxDurability: 220, magazineSize: 40, flavorText: "Serrated rounds tear through." },
  { itemId: "uzi_legendary",  name: "Uzi Phantom",   category: "smg", tier: "legendary", weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 32, damageMax: 46, accuracy: 72, specialEffect: "bleed",      specialChance: 25 }, maxDurability: 300, magazineSize: 42, flavorText: "Bleeds and stuns. You won't walk away." },
  // MAC-10
  { itemId: "mac10_common",    name: "MAC-10",        category: "smg", tier: "common",    weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 11, damageMax: 16, accuracy: 72 },                                          maxDurability: 80,  magazineSize: 30, flavorText: "Ugly. Fast. Yours." },
  { itemId: "mac10_uncommon",  name: "MAC-10 Mk.II",  category: "smg", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 14, damageMax: 21, accuracy: 72 },                                          maxDurability: 120, magazineSize: 32, flavorText: "Added foregrip. Slightly less ugly." },
  { itemId: "mac10_rare",      name: "MAC-10 Custom", category: "smg", tier: "rare",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 19, damageMax: 28, accuracy: 72 },                                          maxDurability: 160, magazineSize: 35, flavorText: "Tuned cyclic. Still a handful." },
  { itemId: "mac10_epic",      name: "MAC-10 Cyber",  category: "smg", tier: "epic",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 26, damageMax: 38, accuracy: 72, specialEffect: "knockback",  specialChance: 20 }, maxDurability: 220, magazineSize: 38, flavorText: "Impact rounds push back hard." },
  { itemId: "mac10_legendary", name: "MAC-10 Phantom",category: "smg", tier: "legendary", weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 36, damageMax: 52, accuracy: 72, specialEffect: "knockback",  specialChance: 28 }, maxDurability: 300, magazineSize: 40, flavorText: "Sends them flying. Stuns on the way down." },
  // P90
  { itemId: "p90_common",     name: "P90",            category: "smg", tier: "common",    weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 10, damageMax: 15, accuracy: 72 },                                          maxDurability: 80,  magazineSize: 50, flavorText: "50 rounds. That's a conversation." },
  { itemId: "p90_uncommon",   name: "P90 Mk.II",      category: "smg", tier: "uncommon",  weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 13, damageMax: 20, accuracy: 72 },                                          maxDurability: 120, magazineSize: 50, flavorText: "Refined internals. The conversation continues." },
  { itemId: "p90_rare",       name: "P90 Custom",     category: "smg", tier: "rare",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 18, damageMax: 27, accuracy: 72 },                                          maxDurability: 160, magazineSize: 50, flavorText: "Custom trigger group. Fifty reasons to keep firing." },
  { itemId: "p90_epic",       name: "P90 Cyber",      category: "smg", tier: "epic",      weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 25, damageMax: 37, accuracy: 72, specialEffect: "bleed",      specialChance: 16 }, maxDurability: 220, magazineSize: 50, flavorText: "Bio-rounds. Each one leaves a trail." },
  { itemId: "p90_legendary",  name: "P90 Phantom",    category: "smg", tier: "legendary", weaponSlot: "secondary", ammoCategory: "smg_rounds", stats: { damageMin: 35, damageMax: 51, accuracy: 72, specialEffect: "bleed",      specialChance: 24 }, maxDurability: 300, magazineSize: 50, flavorText: "Phantom load. Bleeds. Fires twice." },
];

// ─── ASSAULT RIFLES ──────────────────────────────────────────────────────────
const AR_ITEMS = [
  // AK-47
  { itemId: "ak47_common",     name: "AK-47",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 18, damageMax: 25, accuracy: 78 },                                                      maxDurability: 90,  magazineSize: 20, flavorText: "Kalashnikov's gift to the world." },
  { itemId: "ak47_uncommon",   name: "AK-47 Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 24, damageMax: 34, accuracy: 78 },                                                      maxDurability: 130, magazineSize: 25, flavorText: "Improved muzzle brake. Slightly more manageable." },
  { itemId: "ak47_rare",       name: "AK-47 Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 32, damageMax: 46, accuracy: 78, specialEffect: "bleed",       specialChance: 15 },      maxDurability: 175, magazineSize: 30, flavorText: "Custom bolt. Rounds leave a mark." },
  { itemId: "ak47_epic",       name: "AK-47 Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 44, damageMax: 62, accuracy: 78, specialEffect: "bleed",       specialChance: 22 },      maxDurability: 240, magazineSize: 35, flavorText: "Cyber receiver. Smart rounds bleed." },
  { itemId: "ak47_legendary",  name: "AK-47 Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 58, damageMax: 82, accuracy: 78, specialEffect: "bleed",       specialChance: 30 },      maxDurability: 320, magazineSize: 40, flavorText: "Phantom load. Bleeds and stuns." },
  // M4A1
  { itemId: "m4a1_common",     name: "M4A1",          category: "assault_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 16, damageMax: 23, accuracy: 78 },                                                      maxDurability: 90,  magazineSize: 30, flavorText: "Mil-spec. Works every time." },
  { itemId: "m4a1_uncommon",   name: "M4A1 Mk.II",    category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 22, damageMax: 32, accuracy: 78 },                                                      maxDurability: 130, magazineSize: 30, flavorText: "Free-floated barrel. Tighter groups." },
  { itemId: "m4a1_rare",       name: "M4A1 Custom",   category: "assault_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 30, damageMax: 44, accuracy: 78 },                                                      maxDurability: 175, magazineSize: 30, flavorText: "Match-grade trigger. Every round counts." },
  { itemId: "m4a1_epic",       name: "M4A1 Cyber",    category: "assault_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 42, damageMax: 60, accuracy: 78, specialEffect: "armor_pierce", specialChance: 20 },      maxDurability: 240, magazineSize: 30, flavorText: "Penetrator rounds. Armor means nothing." },
  { itemId: "m4a1_legendary",  name: "M4A1 Phantom",  category: "assault_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 56, damageMax: 80, accuracy: 78, specialEffect: "armor_pierce", specialChance: 28 },      maxDurability: 320, magazineSize: 30, flavorText: "Phantom rounds pierce and repeat." },
  // SCAR-H
  { itemId: "scarh_common",    name: "SCAR-H",        category: "assault_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 20, damageMax: 28, accuracy: 78 },                                                      maxDurability: 90,  magazineSize: 20, flavorText: "Heavy caliber. Heavy consequences." },
  { itemId: "scarh_uncommon",  name: "SCAR-H Mk.II",  category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 26, damageMax: 38, accuracy: 78 },                                                      maxDurability: 130, magazineSize: 20, flavorText: "Improved recoil system. Hits harder." },
  { itemId: "scarh_rare",      name: "SCAR-H Custom", category: "assault_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 36, damageMax: 52, accuracy: 78 },                                                      maxDurability: 175, magazineSize: 20, flavorText: "Custom gas block. Devastating at range." },
  { itemId: "scarh_epic",      name: "SCAR-H Cyber",  category: "assault_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 48, damageMax: 68, accuracy: 78, specialEffect: "knockback",    specialChance: 25 },      maxDurability: 240, magazineSize: 20, flavorText: "Impulse rounds push the target back." },
  { itemId: "scarh_legendary", name: "SCAR-H Phantom",category: "assault_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 64, damageMax: 90, accuracy: 78, specialEffect: "knockback",    specialChance: 32 },      maxDurability: 320, magazineSize: 20, flavorText: "Phantom load. Knocks back. Then bleeds." },
  // HK416
  { itemId: "hk416_common",    name: "HK416",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 17, damageMax: 24, accuracy: 78 },                                                      maxDurability: 90,  magazineSize: 30, flavorText: "German precision. No excuses." },
  { itemId: "hk416_uncommon",  name: "HK416 Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 23, damageMax: 33, accuracy: 78 },                                                      maxDurability: 130, magazineSize: 30, flavorText: "Enhanced gas piston. Runs cleaner." },
  { itemId: "hk416_rare",      name: "HK416 Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 31, damageMax: 45, accuracy: 78 },                                                      maxDurability: 175, magazineSize: 30, flavorText: "Target-grade barrel. Punishes mistakes." },
  { itemId: "hk416_epic",      name: "HK416 Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 43, damageMax: 61, accuracy: 78, specialEffect: "stun",         specialChance: 20 },      maxDurability: 240, magazineSize: 30, flavorText: "Shock rounds. They stop thinking mid-sprint." },
  { itemId: "hk416_legendary", name: "HK416 Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "rifle_rounds", stats: { damageMin: 57, damageMax: 81, accuracy: 78, specialEffect: "stun",         specialChance: 28 },      maxDurability: 320, magazineSize: 30, flavorText: "Phantom load stuns. Then bleeds." },
];

// ─── SHOTGUNS ────────────────────────────────────────────────────────────────
const SHOTGUN_ITEMS = [
  // Mossberg 500
  { itemId: "mossberg_common",    name: "Mossberg 500",        category: "shotgun", tier: "common",    weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 30, damageMax: 45,  accuracy: 68 },                                          maxDurability: 85,  magazineSize: 6, flavorText: "Home defense. Arena offense." },
  { itemId: "mossberg_uncommon",  name: "Mossberg 500 Mk.II",  category: "shotgun", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 40, damageMax: 58,  accuracy: 68 },                                          maxDurability: 125, magazineSize: 7, flavorText: "Extended tube. More doors opened." },
  { itemId: "mossberg_rare",      name: "Mossberg 500 Custom", category: "shotgun", tier: "rare",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 54, damageMax: 76,  accuracy: 68 },                                          maxDurability: 165, magazineSize: 7, flavorText: "Ported barrel. Pattern tightened." },
  { itemId: "mossberg_epic",      name: "Mossberg 500 Cyber",  category: "shotgun", tier: "epic",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 72, damageMax: 100, accuracy: 68, specialEffect: "knockback", specialChance: 30 }, maxDurability: 230, magazineSize: 8, flavorText: "Impact shells send them airborne." },
  { itemId: "mossberg_legendary", name: "Mossberg 500 Phantom",category: "shotgun", tier: "legendary", weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 95, damageMax: 135, accuracy: 68, specialEffect: "knockback", specialChance: 38 }, maxDurability: 310, magazineSize: 8, flavorText: "Phantom shells knock back and stun." },
  // SPAS-12
  { itemId: "spas12_common",    name: "SPAS-12",        category: "shotgun", tier: "common",    weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 28, damageMax: 42,  accuracy: 68 },                                          maxDurability: 85,  magazineSize: 8, flavorText: "Semi-auto or pump. Your call." },
  { itemId: "spas12_uncommon",  name: "SPAS-12 Mk.II",  category: "shotgun", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 38, damageMax: 55,  accuracy: 68 },                                          maxDurability: 125, magazineSize: 8, flavorText: "Improved cycle. Twice the destruction rate." },
  { itemId: "spas12_rare",      name: "SPAS-12 Custom", category: "shotgun", tier: "rare",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 51, damageMax: 72,  accuracy: 68, specialEffect: "knockback", specialChance: 20 }, maxDurability: 165, magazineSize: 8, flavorText: "Custom choke. Tighter, harder." },
  { itemId: "spas12_epic",      name: "SPAS-12 Cyber",  category: "shotgun", tier: "epic",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 68, damageMax: 96,  accuracy: 68, specialEffect: "knockback", specialChance: 28 }, maxDurability: 230, magazineSize: 8, flavorText: "Wave rounds. Wall-to-wall devastation." },
  { itemId: "spas12_legendary", name: "SPAS-12 Phantom",category: "shotgun", tier: "legendary", weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 90, damageMax: 128, accuracy: 68, specialEffect: "knockback", specialChance: 35 }, maxDurability: 310, magazineSize: 8, flavorText: "Phantom shells knock back and bleed." },
  // AA-12
  { itemId: "aa12_common",    name: "AA-12",        category: "shotgun", tier: "common",    weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 22, damageMax: 34,  accuracy: 68 },                                                         maxDurability: 85,  magazineSize: 20, flavorText: "Full-auto shotgun. The future is messy." },
  { itemId: "aa12_uncommon",  name: "AA-12 Mk.II",  category: "shotgun", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 30, damageMax: 44,  accuracy: 68 },                                                         maxDurability: 125, magazineSize: 20, flavorText: "Drum feed improved. The future is messier." },
  { itemId: "aa12_rare",      name: "AA-12 Custom", category: "shotgun", tier: "rare",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 40, damageMax: 58,  accuracy: 68, specialEffect: "knockback", specialChance: 20 },            maxDurability: 165, magazineSize: 20, flavorText: "Heavy loads. They stagger." },
  { itemId: "aa12_epic",      name: "AA-12 Cyber",  category: "shotgun", tier: "epic",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 54, damageMax: 76,  accuracy: 68, specialEffect: "knockback", specialChance: 28 },            maxDurability: 230, magazineSize: 20, flavorText: "Smart cluster rounds. Knock back and bleed." },
  { itemId: "aa12_legendary", name: "AA-12 Phantom",category: "shotgun", tier: "legendary", weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 72, damageMax: 102, accuracy: 68, specialEffect: "knockback", specialChance: 35 },            maxDurability: 310, magazineSize: 20, flavorText: "Phantom rounds scatter and bleed." },
  // Benelli M4
  { itemId: "benelli_common",    name: "Benelli M4",        category: "shotgun", tier: "common",    weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 25, damageMax: 38,  accuracy: 68 },                                          maxDurability: 85,  magazineSize: 7, flavorText: "INERTIA system. Smooth operator." },
  { itemId: "benelli_uncommon",  name: "Benelli M4 Mk.II",  category: "shotgun", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 34, damageMax: 50,  accuracy: 68 },                                          maxDurability: 125, magazineSize: 7, flavorText: "Ghost-ring sights. Point and devastate." },
  { itemId: "benelli_rare",      name: "Benelli M4 Custom", category: "shotgun", tier: "rare",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 46, damageMax: 66,  accuracy: 68 },                                          maxDurability: 165, magazineSize: 8, flavorText: "Custom choke set. Spread on demand." },
  { itemId: "benelli_epic",      name: "Benelli M4 Cyber",  category: "shotgun", tier: "epic",      weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 62, damageMax: 88,  accuracy: 68, specialEffect: "stun",      specialChance: 25 }, maxDurability: 230, magazineSize: 8, flavorText: "Concussive rounds. Lights out." },
  { itemId: "benelli_legendary", name: "Benelli M4 Phantom",category: "shotgun", tier: "legendary", weaponSlot: "primary", ammoCategory: "shotgun_shells", stats: { damageMin: 82, damageMax: 118, accuracy: 68, specialEffect: "stun",      specialChance: 32 }, maxDurability: 310, magazineSize: 8, flavorText: "Phantom shells stun and knock back." },
];

// ─── SNIPERS ─────────────────────────────────────────────────────────────────
const SNIPER_ITEMS = [
  // Barrett M82
  { itemId: "barrett_common",    name: "Barrett M82",        category: "sniper_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 55,  damageMax: 75,  accuracy: 90 },                                           maxDurability: 70,  magazineSize: 5, flavorText: "Anti-material. Pro-violence." },
  { itemId: "barrett_uncommon",  name: "Barrett M82 Mk.II",  category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 72,  damageMax: 98,  accuracy: 90 },                                           maxDurability: 110, magazineSize: 5, flavorText: "Refined muzzle brake. More manageable." },
  { itemId: "barrett_rare",      name: "Barrett M82 Custom", category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 96,  damageMax: 130, accuracy: 90 },                                           maxDurability: 150, magazineSize: 5, flavorText: "Match-grade barrel. Every inch counts." },
  { itemId: "barrett_epic",      name: "Barrett M82 Cyber",  category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 126, damageMax: 170, accuracy: 90, specialEffect: "armor_pierce", specialChance: 25 }, maxDurability: 210, magazineSize: 5, flavorText: "Penetrator rounds. Armor is irrelevant." },
  { itemId: "barrett_legendary", name: "Barrett M82 Phantom",category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 165, damageMax: 225, accuracy: 90, specialEffect: "armor_pierce", specialChance: 35 }, maxDurability: 290, magazineSize: 5, flavorText: "Phantom rounds pierce and stun. Forever." },
  // AWP
  { itemId: "awp_common",     name: "AWP",         category: "sniper_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 60,  damageMax: 80,  accuracy: 90 },                                            maxDurability: 70,  magazineSize: 5, flavorText: "One shot. One story." },
  { itemId: "awp_uncommon",   name: "AWP Mk.II",   category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 78,  damageMax: 105, accuracy: 90 },                                            maxDurability: 110, magazineSize: 5, flavorText: "Improved optics. The story is clearer." },
  { itemId: "awp_rare",       name: "AWP Custom",  category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 105, damageMax: 142, accuracy: 90, specialEffect: "armor_pierce", specialChance: 10 }, maxDurability: 150, magazineSize: 5, flavorText: "AP rounds. Armor is optional for them." },
  { itemId: "awp_epic",       name: "AWP Cyber",   category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 138, damageMax: 188, accuracy: 90, specialEffect: "armor_pierce", specialChance: 22 }, maxDurability: 210, magazineSize: 5, flavorText: "Cyber-guided rounds. Armor is a rumor." },
  { itemId: "awp_legendary",  name: "AWP Phantom", category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 180, damageMax: 246, accuracy: 90, specialEffect: "armor_pierce", specialChance: 30 }, maxDurability: 290, magazineSize: 5, flavorText: "Phantom shot. Pierces and stuns." },
  // Dragunov
  { itemId: "dragunov_common",    name: "Dragunov",        category: "sniper_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 48,  damageMax: 68,  accuracy: 90 },                                         maxDurability: 70,  magazineSize: 10, flavorText: "Soviet precision. Cold and deliberate." },
  { itemId: "dragunov_uncommon",  name: "Dragunov Mk.II",  category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 63,  damageMax: 90,  accuracy: 90 },                                         maxDurability: 110, magazineSize: 10, flavorText: "Enhanced barrel. Colder and more deliberate." },
  { itemId: "dragunov_rare",      name: "Dragunov Custom", category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 85,  damageMax: 120, accuracy: 90 },                                         maxDurability: 150, magazineSize: 10, flavorText: "Custom gas port. Feeds faster, hits harder." },
  { itemId: "dragunov_epic",      name: "Dragunov Cyber",  category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 112, damageMax: 158, accuracy: 90, specialEffect: "bleed", specialChance: 20 }, maxDurability: 210, magazineSize: 10, flavorText: "Bio-tip rounds open wounds at range." },
  { itemId: "dragunov_legendary", name: "Dragunov Phantom",category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 148, damageMax: 210, accuracy: 90, specialEffect: "bleed", specialChance: 28 }, maxDurability: 290, magazineSize: 10, flavorText: "Phantom rounds bleed and pierce armor." },
  // Intervention
  { itemId: "intervention_common",    name: "Intervention",        category: "sniper_rifle", tier: "common",    weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 65,  damageMax: 88,  accuracy: 90 },                                        maxDurability: 70,  magazineSize: 5, flavorText: "Bolt-action perfection." },
  { itemId: "intervention_uncommon",  name: "Intervention Mk.II",  category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 85,  damageMax: 115, accuracy: 90 },                                        maxDurability: 110, magazineSize: 5, flavorText: "Threaded barrel. Suppressed perfection." },
  { itemId: "intervention_rare",      name: "Intervention Custom", category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 115, damageMax: 156, accuracy: 90 },                                        maxDurability: 150, magazineSize: 5, flavorText: "Match trigger. Breaks like glass." },
  { itemId: "intervention_epic",      name: "Intervention Cyber",  category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 152, damageMax: 206, accuracy: 90, specialEffect: "stun",        specialChance: 22 }, maxDurability: 210, magazineSize: 5, flavorText: "Concussive tip. Down before they know it." },
  { itemId: "intervention_legendary", name: "Intervention Phantom",category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", ammoCategory: "sniper_rounds", stats: { damageMin: 200, damageMax: 272, accuracy: 90, specialEffect: "stun",        specialChance: 30 }, maxDurability: 290, magazineSize: 5, flavorText: "Phantom load stuns and pierces armor." },
];

// ─── LMGs ────────────────────────────────────────────────────────────────────
const LMG_ITEMS = [
  // M249 SAW
  { itemId: "m249_common",    name: "M249 SAW",        category: "lmg", tier: "common",    weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 14, damageMax: 20, accuracy: 62 },                                          maxDurability: 100, magazineSize: 100, flavorText: "Squad automatic. Emphasis on automatic." },
  { itemId: "m249_uncommon",  name: "M249 SAW Mk.II",  category: "lmg", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 18, damageMax: 26, accuracy: 62 },                                          maxDurability: 150, magazineSize: 100, flavorText: "Bipod improved. Spray better." },
  { itemId: "m249_rare",      name: "M249 SAW Custom", category: "lmg", tier: "rare",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 25, damageMax: 36, accuracy: 62 },                                          maxDurability: 200, magazineSize: 100, flavorText: "Custom barrel. Cool under fire." },
  { itemId: "m249_epic",      name: "M249 SAW Cyber",  category: "lmg", tier: "epic",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 34, damageMax: 48, accuracy: 62, specialEffect: "bleed",     specialChance: 18 }, maxDurability: 270, magazineSize: 100, flavorText: "Bio-rounds. Every hit bleeds." },
  { itemId: "m249_legendary", name: "M249 SAW Phantom",category: "lmg", tier: "legendary", weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 45, damageMax: 65, accuracy: 62, specialEffect: "bleed",     specialChance: 25 }, maxDurability: 360, magazineSize: 100, flavorText: "Phantom feed. Bleeds and knocks back." },
  // RPK
  { itemId: "rpk_common",    name: "RPK",        category: "lmg", tier: "common",    weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 16, damageMax: 22, accuracy: 62 },                                          maxDurability: 100, magazineSize: 75, flavorText: "Heavier AK. Heavier consequences." },
  { itemId: "rpk_uncommon",  name: "RPK Mk.II",  category: "lmg", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 21, damageMax: 30, accuracy: 62 },                                          maxDurability: 150, magazineSize: 75, flavorText: "Drum feed upgrade. Keep firing." },
  { itemId: "rpk_rare",      name: "RPK Custom", category: "lmg", tier: "rare",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 28, damageMax: 40, accuracy: 62 },                                          maxDurability: 200, magazineSize: 75, flavorText: "Custom bolt group. Runs clean." },
  { itemId: "rpk_epic",      name: "RPK Cyber",  category: "lmg", tier: "epic",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 38, damageMax: 54, accuracy: 62, specialEffect: "knockback", specialChance: 20 }, maxDurability: 270, magazineSize: 75, flavorText: "Impact rounds. They don't stand still." },
  { itemId: "rpk_legendary", name: "RPK Phantom",category: "lmg", tier: "legendary", weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 50, damageMax: 72, accuracy: 62, specialEffect: "knockback", specialChance: 28 }, maxDurability: 360, magazineSize: 75, flavorText: "Phantom drum. Knocks back and bleeds." },
  // Minigun
  { itemId: "minigun_common",    name: "Minigun",        category: "lmg", tier: "common",    weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 10, damageMax: 16, accuracy: 62 },                                         maxDurability: 100, magazineSize: 200, flavorText: "Six barrels. Zero mercy." },
  { itemId: "minigun_uncommon",  name: "Minigun Mk.II",  category: "lmg", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 13, damageMax: 20, accuracy: 62 },                                         maxDurability: 150, magazineSize: 200, flavorText: "Spin-up time reduced. More zero mercy." },
  { itemId: "minigun_rare",      name: "Minigun Custom", category: "lmg", tier: "rare",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 18, damageMax: 28, accuracy: 62 },                                         maxDurability: 200, magazineSize: 200, flavorText: "Custom barrels. Even less mercy." },
  { itemId: "minigun_epic",      name: "Minigun Cyber",  category: "lmg", tier: "epic",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 24, damageMax: 38, accuracy: 62, specialEffect: "stun",  specialChance: 22 }, maxDurability: 270, magazineSize: 200, flavorText: "Shock rounds laced in every burst." },
  { itemId: "minigun_legendary", name: "Minigun Phantom",category: "lmg", tier: "legendary", weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 32, damageMax: 50, accuracy: 62, specialEffect: "stun",  specialChance: 30 }, maxDurability: 360, magazineSize: 200, flavorText: "Phantom spin. Stuns and bleeds non-stop." },
  // MG4
  { itemId: "mg4_common",    name: "MG4",        category: "lmg", tier: "common",    weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 15, damageMax: 21, accuracy: 62 },                                          maxDurability: 100, magazineSize: 100, flavorText: "German sustained fire. Efficient misery." },
  { itemId: "mg4_uncommon",  name: "MG4 Mk.II",  category: "lmg", tier: "uncommon",  weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 20, damageMax: 29, accuracy: 62 },                                          maxDurability: 150, magazineSize: 100, flavorText: "Improved feed ramp. Uninterrupted." },
  { itemId: "mg4_rare",      name: "MG4 Custom", category: "lmg", tier: "rare",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 27, damageMax: 39, accuracy: 62 },                                          maxDurability: 200, magazineSize: 100, flavorText: "Match barrel. Precise and relentless." },
  { itemId: "mg4_epic",      name: "MG4 Cyber",  category: "lmg", tier: "epic",      weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 37, damageMax: 52, accuracy: 62, specialEffect: "bleed",     specialChance: 18 }, maxDurability: 270, magazineSize: 100, flavorText: "Bio-tip rounds. Each one bleeds slow." },
  { itemId: "mg4_legendary", name: "MG4 Phantom",category: "lmg", tier: "legendary", weaponSlot: "primary", ammoCategory: "lmg_rounds", stats: { damageMin: 49, damageMax: 70, accuracy: 62, specialEffect: "bleed",     specialChance: 26 }, maxDurability: 360, magazineSize: 100, flavorText: "Phantom feed. Bleeds and fires twice." },
];

// ─── AMMO ────────────────────────────────────────────────────────────────────
const AMMO_ITEMS = [
  // pistol_rounds
  { itemId: "pistol_rounds_common",    name: "Pistol Rounds (Common)",    category: "pistol_rounds",   tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 15,  flavorText: "Standard pistol loads." },
  { itemId: "pistol_rounds_uncommon",  name: "Pistol Rounds (Uncommon)",  category: "pistol_rounds",   tier: "uncommon",  stats: { damageMultiplier: 1.05 }, magazineSize: 17,  flavorText: "Slightly hotter loads." },
  { itemId: "pistol_rounds_rare",      name: "Pistol Rounds (Rare)",      category: "pistol_rounds",   tier: "rare",      stats: { damageMultiplier: 1.10 }, magazineSize: 19,  flavorText: "Match-grade rounds." },
  { itemId: "pistol_rounds_epic",      name: "Pistol Rounds (Epic)",      category: "pistol_rounds",   tier: "epic",      stats: { damageMultiplier: 1.15 }, magazineSize: 21,  flavorText: "Cyber-tip rounds." },
  { itemId: "pistol_rounds_legendary", name: "Pistol Rounds (Legendary)", category: "pistol_rounds",   tier: "legendary", stats: { damageMultiplier: 1.20 }, magazineSize: 23,  flavorText: "Phantom-core rounds." },
  // smg_rounds
  { itemId: "smg_rounds_common",    name: "SMG Rounds (Common)",    category: "smg_rounds", tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 30,  flavorText: "Standard SMG loads." },
  { itemId: "smg_rounds_uncommon",  name: "SMG Rounds (Uncommon)",  category: "smg_rounds", tier: "uncommon",  stats: { damageMultiplier: 1.05 }, magazineSize: 33,  flavorText: "Slightly hotter." },
  { itemId: "smg_rounds_rare",      name: "SMG Rounds (Rare)",      category: "smg_rounds", tier: "rare",      stats: { damageMultiplier: 1.10 }, magazineSize: 37,  flavorText: "Match-grade." },
  { itemId: "smg_rounds_epic",      name: "SMG Rounds (Epic)",      category: "smg_rounds", tier: "epic",      stats: { damageMultiplier: 1.15 }, magazineSize: 41,  flavorText: "Cyber-tip." },
  { itemId: "smg_rounds_legendary", name: "SMG Rounds (Legendary)", category: "smg_rounds", tier: "legendary", stats: { damageMultiplier: 1.20 }, magazineSize: 45,  flavorText: "Phantom-core." },
  // rifle_rounds
  { itemId: "rifle_rounds_common",    name: "Rifle Rounds (Common)",    category: "rifle_rounds", tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 25,  flavorText: "Standard rifle loads." },
  { itemId: "rifle_rounds_uncommon",  name: "Rifle Rounds (Uncommon)",  category: "rifle_rounds", tier: "uncommon",  stats: { damageMultiplier: 1.05 }, magazineSize: 28,  flavorText: "Slightly hotter." },
  { itemId: "rifle_rounds_rare",      name: "Rifle Rounds (Rare)",      category: "rifle_rounds", tier: "rare",      stats: { damageMultiplier: 1.10 }, magazineSize: 32,  flavorText: "Match-grade." },
  { itemId: "rifle_rounds_epic",      name: "Rifle Rounds (Epic)",      category: "rifle_rounds", tier: "epic",      stats: { damageMultiplier: 1.15 }, magazineSize: 36,  flavorText: "Cyber-tip." },
  { itemId: "rifle_rounds_legendary", name: "Rifle Rounds (Legendary)", category: "rifle_rounds", tier: "legendary", stats: { damageMultiplier: 1.20 }, magazineSize: 40,  flavorText: "Phantom-core." },
  // shotgun_shells
  { itemId: "shotgun_shells_common",    name: "Shotgun Shells (Common)",    category: "shotgun_shells", tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 7,   flavorText: "Standard buckshot." },
  { itemId: "shotgun_shells_uncommon",  name: "Shotgun Shells (Uncommon)",  category: "shotgun_shells", tier: "uncommon",  stats: { damageMultiplier: 1.05 }, magazineSize: 8,   flavorText: "Magnum loads." },
  { itemId: "shotgun_shells_rare",      name: "Shotgun Shells (Rare)",      category: "shotgun_shells", tier: "rare",      stats: { damageMultiplier: 1.08 }, magazineSize: 9,   flavorText: "Sabot slugs." },
  { itemId: "shotgun_shells_epic",      name: "Shotgun Shells (Epic)",      category: "shotgun_shells", tier: "epic",      stats: { damageMultiplier: 1.12 }, magazineSize: 10,  flavorText: "Cyber-flechette shells." },
  { itemId: "shotgun_shells_legendary", name: "Shotgun Shells (Legendary)", category: "shotgun_shells", tier: "legendary", stats: { damageMultiplier: 1.18 }, magazineSize: 11,  flavorText: "Phantom-scatter shells." },
  // sniper_rounds
  { itemId: "sniper_rounds_common",    name: "Sniper Rounds (Common)",    category: "sniper_rounds", tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 5,   flavorText: "Standard long-range loads." },
  { itemId: "sniper_rounds_uncommon",  name: "Sniper Rounds (Uncommon)",  category: "sniper_rounds", tier: "uncommon",  stats: { damageMultiplier: 1.05 }, magazineSize: 5,   flavorText: "Match-grade tips." },
  { itemId: "sniper_rounds_rare",      name: "Sniper Rounds (Rare)",      category: "sniper_rounds", tier: "rare",      stats: { damageMultiplier: 1.10 }, magazineSize: 6,   flavorText: "AP tips." },
  { itemId: "sniper_rounds_epic",      name: "Sniper Rounds (Epic)",      category: "sniper_rounds", tier: "epic",      stats: { damageMultiplier: 1.15 }, magazineSize: 7,   flavorText: "Cyber-guided tips." },
  { itemId: "sniper_rounds_legendary", name: "Sniper Rounds (Legendary)", category: "sniper_rounds", tier: "legendary", stats: { damageMultiplier: 1.22 }, magazineSize: 8,   flavorText: "Phantom-core tips." },
  // lmg_rounds
  { itemId: "lmg_rounds_common",    name: "LMG Rounds (Common)",    category: "lmg_rounds", tier: "common",    stats: { damageMultiplier: 1.00 }, magazineSize: 100, flavorText: "Belt-fed standard loads." },
  { itemId: "lmg_rounds_uncommon",  name: "LMG Rounds (Uncommon)",  category: "lmg_rounds", tier: "uncommon",  stats: { damageMultiplier: 1.04 }, magazineSize: 100, flavorText: "Slightly hotter belt loads." },
  { itemId: "lmg_rounds_rare",      name: "LMG Rounds (Rare)",      category: "lmg_rounds", tier: "rare",      stats: { damageMultiplier: 1.08 }, magazineSize: 120, flavorText: "Match-grade belt." },
  { itemId: "lmg_rounds_epic",      name: "LMG Rounds (Epic)",      category: "lmg_rounds", tier: "epic",      stats: { damageMultiplier: 1.12 }, magazineSize: 150, flavorText: "Cyber-tip belt." },
  { itemId: "lmg_rounds_legendary", name: "LMG Rounds (Legendary)", category: "lmg_rounds", tier: "legendary", stats: { damageMultiplier: 1.18 }, magazineSize: 200, flavorText: "Phantom-core belt." },
];

// ─── BODY ARMOR ──────────────────────────────────────────────────────────────
const ARMOR_ITEMS = [
  { itemId: "street_vest",    name: "Street Vest",    category: "body_armor", tier: "common",    armorHp: 50,  maxDurability: 100, stats: {},                                                                        flavorText: "Better than a t-shirt. Barely." },
  { itemId: "tactical_vest", name: "Tactical Vest",  category: "body_armor", tier: "uncommon",  armorHp: 85,  maxDurability: 150, stats: {},                                                                        flavorText: "MOLLE webbing. Carries the weight." },
  { itemId: "combat_plate",  name: "Combat Plate",   category: "body_armor", tier: "rare",      armorHp: 130, maxDurability: 200, stats: { specialEffect: "absorb", specialChance: 10 },                           flavorText: "10% chance to absorb incoming hit entirely." },
  { itemId: "ballistic_rig", name: "Ballistic Rig",  category: "body_armor", tier: "epic",      armorHp: 195, maxDurability: 280, stats: { specialEffect: "absorb", specialChance: 20 },                           flavorText: "20% chance to absorb incoming hit entirely." },
  { itemId: "exo_armor",     name: "Exo-Armor",      category: "body_armor", tier: "legendary", armorHp: 275, maxDurability: 400, stats: { specialEffect: "absorb", specialChance: 30 },                           flavorText: "30% chance to absorb incoming hit entirely. The future is bulletproof." },
];

// ─── CONSUMABLES ─────────────────────────────────────────────────────────────
const CONSUMABLE_ITEMS = [
  { itemId: "small_medkit",     name: "Small Medkit",     category: "consumable", tier: "common",    stats: { healAmount: 30 },                                                        flavorText: "Stops the bleeding. Mostly." },
  { itemId: "large_medkit",     name: "Large Medkit",     category: "consumable", tier: "uncommon",  stats: { healAmount: 60 },                                                        flavorText: "Field-grade trauma kit." },
  { itemId: "mega_medkit",      name: "Mega Medkit",      category: "consumable", tier: "rare",      stats: { healAmount: 100 },                                                       flavorText: "Military-grade trauma response." },
  { itemId: "smoke_grenade",    name: "Smoke Grenade",    category: "consumable", tier: "common",    stats: { specialEffect: "blind",   specialChance: 100 },                          flavorText: "Reduces enemy accuracy for 2 turns." },
  { itemId: "frag_grenade",     name: "Frag Grenade",     category: "consumable", tier: "uncommon",  stats: { damageMin: 25, damageMax: 45, specialEffect: "stun", specialChance: 25 }, flavorText: "25% stun chance. Boom." },
  { itemId: "cyber_grenade",    name: "Cyber Grenade",    category: "consumable", tier: "rare",      stats: { damageMin: 40, damageMax: 70, specialEffect: "disable", specialChance: 60 }, flavorText: "60% chance to disable opponent special for 2 turns." },
  { itemId: "stim_shot",  name: "Stim Shot",  category: "consumable", tier: "uncommon",  stats: { healAmount: 20, specialEffect: "double_tap", specialChance: 100 },       flavorText: "Fires twice next turn." },
  { itemId: "stimpack",         name: "Stimpack",         category: "consumable", tier: "rare",      stats: { healAmount: 40, specialEffect: "regen", specialChance: 100 },             flavorText: "Heals now and over time." },
  { itemId: "nano_shield",      name: "Nano Shield",      category: "consumable", tier: "epic",      stats: { shieldAmount: 80, specialEffect: "absorb", specialChance: 100 },          flavorText: "Nano-barrier absorbs next hit." },
  { itemId: "berserker_dose",   name: "Berserker Dose",   category: "consumable", tier: "legendary", stats: { specialEffect: "bleed",   specialChance: 100 },                          flavorText: "All attacks bleed for 3 turns. Risk it." },
];

// ─── Combine all item arrays ──────────────────────────────────────────────────
const ALL_ITEMS = [
  ...PISTOL_ITEMS,
  ...SMG_ITEMS,
  ...AR_ITEMS,
  ...SHOTGUN_ITEMS,
  ...SNIPER_ITEMS,
  ...LMG_ITEMS,
  ...AMMO_ITEMS,
  ...ARMOR_ITEMS,
  ...CONSUMABLE_ITEMS,
];

export async function seedMiniGameItems(): Promise<void> {
  logger.info("Upserting mini-game combat items…");

  const ops = ALL_ITEMS.map(item => {
    const isAmmo       = (item.category as string).endsWith("_rounds") || item.category === "shotgun_shells";
    const isConsumable = item.category === "consumable";
    const stackable    = isAmmo || isConsumable;

    // Base document
    const doc: Record<string, unknown> = {
      name:         item.name,
      category:     item.category,
      tier:         item.tier,
      stats:        (item as { stats: Record<string, unknown> }).stats,
      imageCard:    `/assets/items/${item.itemId}.png`,
      flavorText:   (item as { flavorText?: string }).flavorText ?? "",
      stackable,
      maxStack:     stackable ? 99 : 1,
      isActive:     true,
      weaponSlot:   (item as { weaponSlot?: string }).weaponSlot   ?? null,
      magazineSize: (item as { magazineSize?: number }).magazineSize ?? null,
      ammoCategory: (item as { ammoCategory?: string }).ammoCategory ?? null,
      armorHp:      (item as { armorHp?: number }).armorHp          ?? null,
      maxDurability:(item as { maxDurability?: number }).maxDurability ?? null,
    };

    return {
      updateOne: {
        filter: { itemId: item.itemId },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  const result = await MiniGameItem.bulkWrite(ops);
  logger.info(
    `Mini-game items upserted — inserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`,
  );
}
