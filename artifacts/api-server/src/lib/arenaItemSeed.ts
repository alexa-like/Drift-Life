/**
 * arenaItemSeed — seeds all arena MiniGameItem definitions.
 * Idempotent: uses findOneAndUpdate with upsert.
 */
import MiniGameItem from "../models/MiniGameItem";
import { logger } from "./logger";

interface ItemSeed {
  itemId: string;
  name: string;
  category: string;
  tier: string;
  stackable?: boolean;
  maxStack?: number;
  weaponSlot?: string | null;
  magazineSize?: number | null;
  ammoCategory?: string | null;
  armorHp?: number | null;
  maxDurability?: number | null;
  stats?: Record<string, any>;
}

async function upsertItem(item: ItemSeed): Promise<void> {
  await MiniGameItem.findOneAndUpdate(
    { itemId: item.itemId },
    {
      $set: {
        name:         item.name,
        category:     item.category,
        tier:         item.tier,
        stackable:    item.stackable ?? false,
        maxStack:     item.maxStack ?? 1,
        weaponSlot:   item.weaponSlot ?? null,
        magazineSize: item.magazineSize ?? null,
        ammoCategory: item.ammoCategory ?? null,
        armorHp:      item.armorHp ?? null,
        maxDurability:item.maxDurability ?? null,
        stats:        item.stats ?? {},
        isActive:     true,
      },
    },
    { upsert: true, new: true },
  );
}

export async function seedArenaItems(): Promise<void> {
  const items: ItemSeed[] = [

    // ── PISTOLS ───────────────────────────────────────────────────────────────
    { itemId: "glock17_common",    name: "Glock 17",          category: "pistol", tier: "common",    weaponSlot: "secondary", magazineSize: 15, ammoCategory: "pistol_rounds", maxDurability: 80,  stats: { damageMin: 12, damageMax: 18, accuracy: 82 } },
    { itemId: "glock17_uncommon",  name: "Glock 17 Mk.II",    category: "pistol", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 17, ammoCategory: "pistol_rounds", maxDurability: 120, stats: { damageMin: 16, damageMax: 24, accuracy: 82 } },
    { itemId: "glock17_rare",      name: "Glock 17 Custom",   category: "pistol", tier: "rare",      weaponSlot: "secondary", magazineSize: 19, ammoCategory: "pistol_rounds", maxDurability: 160, stats: { damageMin: 22, damageMax: 32, accuracy: 82 } },
    { itemId: "glock17_epic",      name: "Glock 17 Cyber",    category: "pistol", tier: "epic",      weaponSlot: "secondary", magazineSize: 21, ammoCategory: "pistol_rounds", maxDurability: 220, stats: { damageMin: 30, damageMax: 44, accuracy: 82, specialEffect: "double_tap", specialChance: 18 } },
    { itemId: "glock17_legendary", name: "Glock 17 Phantom",  category: "pistol", tier: "legendary", weaponSlot: "secondary", magazineSize: 23, ammoCategory: "pistol_rounds", maxDurability: 300, stats: { damageMin: 42, damageMax: 60, accuracy: 82, specialEffect: "double_tap", specialChance: 25 } },

    { itemId: "deagle_common",    name: "Desert Eagle",          category: "pistol", tier: "common",    weaponSlot: "secondary", magazineSize: 7,  ammoCategory: "pistol_rounds", maxDurability: 80,  stats: { damageMin: 20, damageMax: 28, accuracy: 82 } },
    { itemId: "deagle_uncommon",  name: "Desert Eagle Mk.II",    category: "pistol", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 8,  ammoCategory: "pistol_rounds", maxDurability: 120, stats: { damageMin: 26, damageMax: 36, accuracy: 82 } },
    { itemId: "deagle_rare",      name: "Desert Eagle Custom",   category: "pistol", tier: "rare",      weaponSlot: "secondary", magazineSize: 9,  ammoCategory: "pistol_rounds", maxDurability: 160, stats: { damageMin: 34, damageMax: 48, accuracy: 82, specialEffect: "stun", specialChance: 12 } },
    { itemId: "deagle_epic",      name: "Desert Eagle Cyber",    category: "pistol", tier: "epic",      weaponSlot: "secondary", magazineSize: 10, ammoCategory: "pistol_rounds", maxDurability: 220, stats: { damageMin: 46, damageMax: 64, accuracy: 82, specialEffect: "stun", specialChance: 20 } },
    { itemId: "deagle_legendary", name: "Desert Eagle Phantom",  category: "pistol", tier: "legendary", weaponSlot: "secondary", magazineSize: 11, ammoCategory: "pistol_rounds", maxDurability: 300, stats: { damageMin: 62, damageMax: 86, accuracy: 82, specialEffect: "stun", specialChance: 28 } },

    { itemId: "beretta_common",    name: "Beretta M9",          category: "pistol", tier: "common",    weaponSlot: "secondary", magazineSize: 15, ammoCategory: "pistol_rounds", maxDurability: 80,  stats: { damageMin: 11, damageMax: 17, accuracy: 82 } },
    { itemId: "beretta_uncommon",  name: "Beretta M9 Mk.II",    category: "pistol", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 17, ammoCategory: "pistol_rounds", maxDurability: 120, stats: { damageMin: 15, damageMax: 22, accuracy: 82 } },
    { itemId: "beretta_rare",      name: "Beretta M9 Custom",   category: "pistol", tier: "rare",      weaponSlot: "secondary", magazineSize: 19, ammoCategory: "pistol_rounds", maxDurability: 160, stats: { damageMin: 20, damageMax: 30, accuracy: 82 } },
    { itemId: "beretta_epic",      name: "Beretta M9 Cyber",    category: "pistol", tier: "epic",      weaponSlot: "secondary", magazineSize: 21, ammoCategory: "pistol_rounds", maxDurability: 220, stats: { damageMin: 28, damageMax: 40, accuracy: 82, specialEffect: "bleed", specialChance: 15 } },
    { itemId: "beretta_legendary", name: "Beretta M9 Phantom",  category: "pistol", tier: "legendary", weaponSlot: "secondary", magazineSize: 23, ammoCategory: "pistol_rounds", maxDurability: 300, stats: { damageMin: 38, damageMax: 56, accuracy: 82, specialEffect: "bleed", specialChance: 22 } },

    { itemId: "usps_common",    name: "USP-S",         category: "pistol", tier: "common",    weaponSlot: "secondary", magazineSize: 12, ammoCategory: "pistol_rounds", maxDurability: 80,  stats: { damageMin: 13, damageMax: 19, accuracy: 82 } },
    { itemId: "usps_uncommon",  name: "USP-S Mk.II",   category: "pistol", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 13, ammoCategory: "pistol_rounds", maxDurability: 120, stats: { damageMin: 17, damageMax: 25, accuracy: 82 } },
    { itemId: "usps_rare",      name: "USP-S Custom",  category: "pistol", tier: "rare",      weaponSlot: "secondary", magazineSize: 15, ammoCategory: "pistol_rounds", maxDurability: 160, stats: { damageMin: 23, damageMax: 34, accuracy: 82 } },
    { itemId: "usps_epic",      name: "USP-S Cyber",   category: "pistol", tier: "epic",      weaponSlot: "secondary", magazineSize: 17, ammoCategory: "pistol_rounds", maxDurability: 220, stats: { damageMin: 32, damageMax: 46, accuracy: 82, specialEffect: "armor_pierce", specialChance: 20 } },
    { itemId: "usps_legendary", name: "USP-S Phantom", category: "pistol", tier: "legendary", weaponSlot: "secondary", magazineSize: 19, ammoCategory: "pistol_rounds", maxDurability: 300, stats: { damageMin: 44, damageMax: 62, accuracy: 82, specialEffect: "armor_pierce", specialChance: 30 } },

    // ── SMGs ──────────────────────────────────────────────────────────────────
    { itemId: "mp5_common",    name: "MP5",         category: "smg", tier: "common",    weaponSlot: "secondary", magazineSize: 30, ammoCategory: "smg_rounds", maxDurability: 80,  stats: { damageMin: 10, damageMax: 15, accuracy: 72 } },
    { itemId: "mp5_uncommon",  name: "MP5 Mk.II",   category: "smg", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 32, ammoCategory: "smg_rounds", maxDurability: 120, stats: { damageMin: 13, damageMax: 19, accuracy: 72 } },
    { itemId: "mp5_rare",      name: "MP5 Custom",  category: "smg", tier: "rare",      weaponSlot: "secondary", magazineSize: 35, ammoCategory: "smg_rounds", maxDurability: 160, stats: { damageMin: 18, damageMax: 26, accuracy: 72 } },
    { itemId: "mp5_epic",      name: "MP5 Cyber",   category: "smg", tier: "epic",      weaponSlot: "secondary", magazineSize: 38, ammoCategory: "smg_rounds", maxDurability: 220, stats: { damageMin: 25, damageMax: 36, accuracy: 72, specialEffect: "double_tap", specialChance: 22 } },
    { itemId: "mp5_legendary", name: "MP5 Phantom", category: "smg", tier: "legendary", weaponSlot: "secondary", magazineSize: 40, ammoCategory: "smg_rounds", maxDurability: 300, stats: { damageMin: 34, damageMax: 50, accuracy: 72, specialEffect: "double_tap", specialChance: 30 } },

    { itemId: "uzi_common",    name: "Uzi",         category: "smg", tier: "common",    weaponSlot: "secondary", magazineSize: 32, ammoCategory: "smg_rounds", maxDurability: 80,  stats: { damageMin: 9,  damageMax: 14, accuracy: 72 } },
    { itemId: "uzi_uncommon",  name: "Uzi Mk.II",   category: "smg", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 35, ammoCategory: "smg_rounds", maxDurability: 120, stats: { damageMin: 12, damageMax: 18, accuracy: 72 } },
    { itemId: "uzi_rare",      name: "Uzi Custom",  category: "smg", tier: "rare",      weaponSlot: "secondary", magazineSize: 38, ammoCategory: "smg_rounds", maxDurability: 160, stats: { damageMin: 16, damageMax: 24, accuracy: 72 } },
    { itemId: "uzi_epic",      name: "Uzi Cyber",   category: "smg", tier: "epic",      weaponSlot: "secondary", magazineSize: 40, ammoCategory: "smg_rounds", maxDurability: 220, stats: { damageMin: 23, damageMax: 34, accuracy: 72, specialEffect: "bleed", specialChance: 18 } },
    { itemId: "uzi_legendary", name: "Uzi Phantom", category: "smg", tier: "legendary", weaponSlot: "secondary", magazineSize: 42, ammoCategory: "smg_rounds", maxDurability: 300, stats: { damageMin: 32, damageMax: 46, accuracy: 72, specialEffect: "bleed", specialChance: 25 } },

    { itemId: "mac10_common",    name: "MAC-10",         category: "smg", tier: "common",    weaponSlot: "secondary", magazineSize: 30, ammoCategory: "smg_rounds", maxDurability: 80,  stats: { damageMin: 11, damageMax: 16, accuracy: 72 } },
    { itemId: "mac10_uncommon",  name: "MAC-10 Mk.II",   category: "smg", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 32, ammoCategory: "smg_rounds", maxDurability: 120, stats: { damageMin: 14, damageMax: 21, accuracy: 72 } },
    { itemId: "mac10_rare",      name: "MAC-10 Custom",  category: "smg", tier: "rare",      weaponSlot: "secondary", magazineSize: 35, ammoCategory: "smg_rounds", maxDurability: 160, stats: { damageMin: 19, damageMax: 28, accuracy: 72 } },
    { itemId: "mac10_epic",      name: "MAC-10 Cyber",   category: "smg", tier: "epic",      weaponSlot: "secondary", magazineSize: 38, ammoCategory: "smg_rounds", maxDurability: 220, stats: { damageMin: 26, damageMax: 38, accuracy: 72, specialEffect: "knockback", specialChance: 20 } },
    { itemId: "mac10_legendary", name: "MAC-10 Phantom", category: "smg", tier: "legendary", weaponSlot: "secondary", magazineSize: 40, ammoCategory: "smg_rounds", maxDurability: 300, stats: { damageMin: 36, damageMax: 52, accuracy: 72, specialEffect: "knockback", specialChance: 28 } },

    { itemId: "p90_common",    name: "P90",         category: "smg", tier: "common",    weaponSlot: "secondary", magazineSize: 50, ammoCategory: "smg_rounds", maxDurability: 80,  stats: { damageMin: 10, damageMax: 15, accuracy: 72 } },
    { itemId: "p90_uncommon",  name: "P90 Mk.II",   category: "smg", tier: "uncommon",  weaponSlot: "secondary", magazineSize: 50, ammoCategory: "smg_rounds", maxDurability: 120, stats: { damageMin: 13, damageMax: 20, accuracy: 72 } },
    { itemId: "p90_rare",      name: "P90 Custom",  category: "smg", tier: "rare",      weaponSlot: "secondary", magazineSize: 50, ammoCategory: "smg_rounds", maxDurability: 160, stats: { damageMin: 18, damageMax: 27, accuracy: 72 } },
    { itemId: "p90_epic",      name: "P90 Cyber",   category: "smg", tier: "epic",      weaponSlot: "secondary", magazineSize: 50, ammoCategory: "smg_rounds", maxDurability: 220, stats: { damageMin: 25, damageMax: 37, accuracy: 72, specialEffect: "bleed", specialChance: 16 } },
    { itemId: "p90_legendary", name: "P90 Phantom", category: "smg", tier: "legendary", weaponSlot: "secondary", magazineSize: 50, ammoCategory: "smg_rounds", maxDurability: 300, stats: { damageMin: 35, damageMax: 51, accuracy: 72, specialEffect: "bleed", specialChance: 24 } },

    // ── ASSAULT RIFLES ────────────────────────────────────────────────────────
    { itemId: "ak47_common",    name: "AK-47",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 90,  stats: { damageMin: 18, damageMax: 25, accuracy: 78 } },
    { itemId: "ak47_uncommon",  name: "AK-47 Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 25, ammoCategory: "rifle_rounds", maxDurability: 130, stats: { damageMin: 24, damageMax: 34, accuracy: 78 } },
    { itemId: "ak47_rare",      name: "AK-47 Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 175, stats: { damageMin: 32, damageMax: 46, accuracy: 78, specialEffect: "bleed", specialChance: 15 } },
    { itemId: "ak47_epic",      name: "AK-47 Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 35, ammoCategory: "rifle_rounds", maxDurability: 240, stats: { damageMin: 44, damageMax: 62, accuracy: 78, specialEffect: "bleed", specialChance: 22 } },
    { itemId: "ak47_legendary", name: "AK-47 Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 40, ammoCategory: "rifle_rounds", maxDurability: 320, stats: { damageMin: 58, damageMax: 82, accuracy: 78, specialEffect: "bleed", specialChance: 30 } },

    { itemId: "m4a1_common",    name: "M4A1",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 90,  stats: { damageMin: 16, damageMax: 23, accuracy: 78 } },
    { itemId: "m4a1_uncommon",  name: "M4A1 Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 130, stats: { damageMin: 22, damageMax: 32, accuracy: 78 } },
    { itemId: "m4a1_rare",      name: "M4A1 Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 175, stats: { damageMin: 30, damageMax: 44, accuracy: 78 } },
    { itemId: "m4a1_epic",      name: "M4A1 Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 240, stats: { damageMin: 42, damageMax: 60, accuracy: 78, specialEffect: "armor_pierce", specialChance: 20 } },
    { itemId: "m4a1_legendary", name: "M4A1 Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 320, stats: { damageMin: 56, damageMax: 80, accuracy: 78, specialEffect: "armor_pierce", specialChance: 28 } },

    { itemId: "scarh_common",    name: "SCAR-H",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 90,  stats: { damageMin: 20, damageMax: 28, accuracy: 78 } },
    { itemId: "scarh_uncommon",  name: "SCAR-H Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 130, stats: { damageMin: 26, damageMax: 38, accuracy: 78 } },
    { itemId: "scarh_rare",      name: "SCAR-H Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 175, stats: { damageMin: 36, damageMax: 52, accuracy: 78 } },
    { itemId: "scarh_epic",      name: "SCAR-H Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 240, stats: { damageMin: 48, damageMax: 68, accuracy: 78, specialEffect: "knockback", specialChance: 25 } },
    { itemId: "scarh_legendary", name: "SCAR-H Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 20, ammoCategory: "rifle_rounds", maxDurability: 320, stats: { damageMin: 64, damageMax: 90, accuracy: 78, specialEffect: "knockback", specialChance: 32 } },

    { itemId: "hk416_common",    name: "HK416",         category: "assault_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 90,  stats: { damageMin: 17, damageMax: 24, accuracy: 78 } },
    { itemId: "hk416_uncommon",  name: "HK416 Mk.II",   category: "assault_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 130, stats: { damageMin: 23, damageMax: 33, accuracy: 78 } },
    { itemId: "hk416_rare",      name: "HK416 Custom",  category: "assault_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 175, stats: { damageMin: 31, damageMax: 45, accuracy: 78 } },
    { itemId: "hk416_epic",      name: "HK416 Cyber",   category: "assault_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 240, stats: { damageMin: 43, damageMax: 61, accuracy: 78, specialEffect: "stun", specialChance: 20 } },
    { itemId: "hk416_legendary", name: "HK416 Phantom", category: "assault_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 30, ammoCategory: "rifle_rounds", maxDurability: 320, stats: { damageMin: 57, damageMax: 81, accuracy: 78, specialEffect: "stun", specialChance: 28 } },

    // ── SHOTGUNS ──────────────────────────────────────────────────────────────
    { itemId: "mossberg_common",    name: "Mossberg 500",         category: "shotgun", tier: "common",    weaponSlot: "primary", magazineSize: 6, ammoCategory: "shotgun_shells", maxDurability: 85,  stats: { damageMin: 30, damageMax: 45,  accuracy: 68 } },
    { itemId: "mossberg_uncommon",  name: "Mossberg 500 Mk.II",   category: "shotgun", tier: "uncommon",  weaponSlot: "primary", magazineSize: 7, ammoCategory: "shotgun_shells", maxDurability: 125, stats: { damageMin: 40, damageMax: 58,  accuracy: 68 } },
    { itemId: "mossberg_rare",      name: "Mossberg 500 Custom",  category: "shotgun", tier: "rare",      weaponSlot: "primary", magazineSize: 7, ammoCategory: "shotgun_shells", maxDurability: 165, stats: { damageMin: 54, damageMax: 76,  accuracy: 68 } },
    { itemId: "mossberg_epic",      name: "Mossberg 500 Cyber",   category: "shotgun", tier: "epic",      weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 230, stats: { damageMin: 72, damageMax: 100, accuracy: 68, specialEffect: "knockback", specialChance: 30 } },
    { itemId: "mossberg_legendary", name: "Mossberg 500 Phantom", category: "shotgun", tier: "legendary", weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 310, stats: { damageMin: 95, damageMax: 135, accuracy: 68, specialEffect: "knockback", specialChance: 38 } },

    { itemId: "spas12_common",    name: "SPAS-12",         category: "shotgun", tier: "common",    weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 85,  stats: { damageMin: 28, damageMax: 42,  accuracy: 68 } },
    { itemId: "spas12_uncommon",  name: "SPAS-12 Mk.II",   category: "shotgun", tier: "uncommon",  weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 125, stats: { damageMin: 38, damageMax: 55,  accuracy: 68 } },
    { itemId: "spas12_rare",      name: "SPAS-12 Custom",  category: "shotgun", tier: "rare",      weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 165, stats: { damageMin: 51, damageMax: 72,  accuracy: 68, specialEffect: "knockback", specialChance: 20 } },
    { itemId: "spas12_epic",      name: "SPAS-12 Cyber",   category: "shotgun", tier: "epic",      weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 230, stats: { damageMin: 68, damageMax: 96,  accuracy: 68, specialEffect: "knockback", specialChance: 28 } },
    { itemId: "spas12_legendary", name: "SPAS-12 Phantom", category: "shotgun", tier: "legendary", weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 310, stats: { damageMin: 90, damageMax: 128, accuracy: 68, specialEffect: "knockback", specialChance: 35 } },

    { itemId: "aa12_common",    name: "AA-12",         category: "shotgun", tier: "common",    weaponSlot: "primary", magazineSize: 20, ammoCategory: "shotgun_shells", maxDurability: 85,  stats: { damageMin: 22, damageMax: 34,  accuracy: 68 } },
    { itemId: "aa12_uncommon",  name: "AA-12 Mk.II",   category: "shotgun", tier: "uncommon",  weaponSlot: "primary", magazineSize: 20, ammoCategory: "shotgun_shells", maxDurability: 125, stats: { damageMin: 30, damageMax: 44,  accuracy: 68 } },
    { itemId: "aa12_rare",      name: "AA-12 Custom",  category: "shotgun", tier: "rare",      weaponSlot: "primary", magazineSize: 20, ammoCategory: "shotgun_shells", maxDurability: 165, stats: { damageMin: 40, damageMax: 58,  accuracy: 68, specialEffect: "knockback", specialChance: 20 } },
    { itemId: "aa12_epic",      name: "AA-12 Cyber",   category: "shotgun", tier: "epic",      weaponSlot: "primary", magazineSize: 20, ammoCategory: "shotgun_shells", maxDurability: 230, stats: { damageMin: 54, damageMax: 76,  accuracy: 68, specialEffect: "knockback", specialChance: 28 } },
    { itemId: "aa12_legendary", name: "AA-12 Phantom", category: "shotgun", tier: "legendary", weaponSlot: "primary", magazineSize: 20, ammoCategory: "shotgun_shells", maxDurability: 310, stats: { damageMin: 72, damageMax: 102, accuracy: 68, specialEffect: "knockback", specialChance: 35 } },

    { itemId: "benelli_common",    name: "Benelli M4",         category: "shotgun", tier: "common",    weaponSlot: "primary", magazineSize: 7, ammoCategory: "shotgun_shells", maxDurability: 85,  stats: { damageMin: 25, damageMax: 38,  accuracy: 68 } },
    { itemId: "benelli_uncommon",  name: "Benelli M4 Mk.II",   category: "shotgun", tier: "uncommon",  weaponSlot: "primary", magazineSize: 7, ammoCategory: "shotgun_shells", maxDurability: 125, stats: { damageMin: 34, damageMax: 50,  accuracy: 68 } },
    { itemId: "benelli_rare",      name: "Benelli M4 Custom",  category: "shotgun", tier: "rare",      weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 165, stats: { damageMin: 46, damageMax: 66,  accuracy: 68 } },
    { itemId: "benelli_epic",      name: "Benelli M4 Cyber",   category: "shotgun", tier: "epic",      weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 230, stats: { damageMin: 62, damageMax: 88,  accuracy: 68, specialEffect: "stun", specialChance: 25 } },
    { itemId: "benelli_legendary", name: "Benelli M4 Phantom", category: "shotgun", tier: "legendary", weaponSlot: "primary", magazineSize: 8, ammoCategory: "shotgun_shells", maxDurability: 310, stats: { damageMin: 82, damageMax: 118, accuracy: 68, specialEffect: "stun", specialChance: 32 } },

    // ── SNIPER RIFLES ─────────────────────────────────────────────────────────
    { itemId: "barrett_common",    name: "Barrett M82",         category: "sniper_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 70,  stats: { damageMin: 55,  damageMax: 75,  accuracy: 90 } },
    { itemId: "barrett_uncommon",  name: "Barrett M82 Mk.II",   category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 110, stats: { damageMin: 72,  damageMax: 98,  accuracy: 90 } },
    { itemId: "barrett_rare",      name: "Barrett M82 Custom",  category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 150, stats: { damageMin: 96,  damageMax: 130, accuracy: 90 } },
    { itemId: "barrett_epic",      name: "Barrett M82 Cyber",   category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 210, stats: { damageMin: 126, damageMax: 170, accuracy: 90, specialEffect: "armor_pierce", specialChance: 25 } },
    { itemId: "barrett_legendary", name: "Barrett M82 Phantom", category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 290, stats: { damageMin: 165, damageMax: 225, accuracy: 90, specialEffect: "armor_pierce", specialChance: 35 } },

    { itemId: "awp_common",    name: "AWP",         category: "sniper_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 70,  stats: { damageMin: 60,  damageMax: 80,  accuracy: 90 } },
    { itemId: "awp_uncommon",  name: "AWP Mk.II",   category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 110, stats: { damageMin: 78,  damageMax: 105, accuracy: 90 } },
    { itemId: "awp_rare",      name: "AWP Custom",  category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 150, stats: { damageMin: 105, damageMax: 142, accuracy: 90, specialEffect: "armor_pierce", specialChance: 10 } },
    { itemId: "awp_epic",      name: "AWP Cyber",   category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 210, stats: { damageMin: 138, damageMax: 188, accuracy: 90, specialEffect: "armor_pierce", specialChance: 22 } },
    { itemId: "awp_legendary", name: "AWP Phantom", category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 290, stats: { damageMin: 180, damageMax: 246, accuracy: 90, specialEffect: "armor_pierce", specialChance: 30 } },

    { itemId: "dragunov_common",    name: "Dragunov",         category: "sniper_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 10, ammoCategory: "sniper_rounds", maxDurability: 70,  stats: { damageMin: 48,  damageMax: 68,  accuracy: 90 } },
    { itemId: "dragunov_uncommon",  name: "Dragunov Mk.II",   category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 10, ammoCategory: "sniper_rounds", maxDurability: 110, stats: { damageMin: 63,  damageMax: 90,  accuracy: 90 } },
    { itemId: "dragunov_rare",      name: "Dragunov Custom",  category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 10, ammoCategory: "sniper_rounds", maxDurability: 150, stats: { damageMin: 85,  damageMax: 120, accuracy: 90 } },
    { itemId: "dragunov_epic",      name: "Dragunov Cyber",   category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 10, ammoCategory: "sniper_rounds", maxDurability: 210, stats: { damageMin: 112, damageMax: 158, accuracy: 90, specialEffect: "bleed", specialChance: 20 } },
    { itemId: "dragunov_legendary", name: "Dragunov Phantom", category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 10, ammoCategory: "sniper_rounds", maxDurability: 290, stats: { damageMin: 148, damageMax: 210, accuracy: 90, specialEffect: "bleed", specialChance: 28 } },

    { itemId: "intervention_common",    name: "Intervention",         category: "sniper_rifle", tier: "common",    weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 70,  stats: { damageMin: 65,  damageMax: 88,  accuracy: 90 } },
    { itemId: "intervention_uncommon",  name: "Intervention Mk.II",   category: "sniper_rifle", tier: "uncommon",  weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 110, stats: { damageMin: 85,  damageMax: 115, accuracy: 90 } },
    { itemId: "intervention_rare",      name: "Intervention Custom",  category: "sniper_rifle", tier: "rare",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 150, stats: { damageMin: 115, damageMax: 156, accuracy: 90 } },
    { itemId: "intervention_epic",      name: "Intervention Cyber",   category: "sniper_rifle", tier: "epic",      weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 210, stats: { damageMin: 152, damageMax: 206, accuracy: 90, specialEffect: "stun", specialChance: 22 } },
    { itemId: "intervention_legendary", name: "Intervention Phantom", category: "sniper_rifle", tier: "legendary", weaponSlot: "primary", magazineSize: 5, ammoCategory: "sniper_rounds", maxDurability: 290, stats: { damageMin: 200, damageMax: 272, accuracy: 90, specialEffect: "stun", specialChance: 30 } },

    // ── LMGs ──────────────────────────────────────────────────────────────────
    { itemId: "m249_common",    name: "M249 SAW",         category: "lmg", tier: "common",    weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 100, stats: { damageMin: 14, damageMax: 20, accuracy: 62 } },
    { itemId: "m249_uncommon",  name: "M249 SAW Mk.II",   category: "lmg", tier: "uncommon",  weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 150, stats: { damageMin: 18, damageMax: 26, accuracy: 62 } },
    { itemId: "m249_rare",      name: "M249 SAW Custom",  category: "lmg", tier: "rare",      weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 200, stats: { damageMin: 25, damageMax: 36, accuracy: 62 } },
    { itemId: "m249_epic",      name: "M249 SAW Cyber",   category: "lmg", tier: "epic",      weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 270, stats: { damageMin: 34, damageMax: 48, accuracy: 62, specialEffect: "bleed", specialChance: 18 } },
    { itemId: "m249_legendary", name: "M249 SAW Phantom", category: "lmg", tier: "legendary", weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 360, stats: { damageMin: 45, damageMax: 65, accuracy: 62, specialEffect: "bleed", specialChance: 25 } },

    { itemId: "rpk_common",    name: "RPK",         category: "lmg", tier: "common",    weaponSlot: "primary", magazineSize: 75, ammoCategory: "lmg_rounds", maxDurability: 100, stats: { damageMin: 16, damageMax: 22, accuracy: 62 } },
    { itemId: "rpk_uncommon",  name: "RPK Mk.II",   category: "lmg", tier: "uncommon",  weaponSlot: "primary", magazineSize: 75, ammoCategory: "lmg_rounds", maxDurability: 150, stats: { damageMin: 21, damageMax: 30, accuracy: 62 } },
    { itemId: "rpk_rare",      name: "RPK Custom",  category: "lmg", tier: "rare",      weaponSlot: "primary", magazineSize: 75, ammoCategory: "lmg_rounds", maxDurability: 200, stats: { damageMin: 28, damageMax: 40, accuracy: 62 } },
    { itemId: "rpk_epic",      name: "RPK Cyber",   category: "lmg", tier: "epic",      weaponSlot: "primary", magazineSize: 75, ammoCategory: "lmg_rounds", maxDurability: 270, stats: { damageMin: 38, damageMax: 54, accuracy: 62, specialEffect: "knockback", specialChance: 20 } },
    { itemId: "rpk_legendary", name: "RPK Phantom", category: "lmg", tier: "legendary", weaponSlot: "primary", magazineSize: 75, ammoCategory: "lmg_rounds", maxDurability: 360, stats: { damageMin: 50, damageMax: 72, accuracy: 62, specialEffect: "knockback", specialChance: 28 } },

    { itemId: "minigun_common",    name: "Minigun",         category: "lmg", tier: "common",    weaponSlot: "primary", magazineSize: 200, ammoCategory: "lmg_rounds", maxDurability: 100, stats: { damageMin: 10, damageMax: 16, accuracy: 62 } },
    { itemId: "minigun_uncommon",  name: "Minigun Mk.II",   category: "lmg", tier: "uncommon",  weaponSlot: "primary", magazineSize: 200, ammoCategory: "lmg_rounds", maxDurability: 150, stats: { damageMin: 13, damageMax: 20, accuracy: 62 } },
    { itemId: "minigun_rare",      name: "Minigun Custom",  category: "lmg", tier: "rare",      weaponSlot: "primary", magazineSize: 200, ammoCategory: "lmg_rounds", maxDurability: 200, stats: { damageMin: 18, damageMax: 28, accuracy: 62 } },
    { itemId: "minigun_epic",      name: "Minigun Cyber",   category: "lmg", tier: "epic",      weaponSlot: "primary", magazineSize: 200, ammoCategory: "lmg_rounds", maxDurability: 270, stats: { damageMin: 24, damageMax: 38, accuracy: 62, specialEffect: "stun", specialChance: 22 } },
    { itemId: "minigun_legendary", name: "Minigun Phantom", category: "lmg", tier: "legendary", weaponSlot: "primary", magazineSize: 200, ammoCategory: "lmg_rounds", maxDurability: 360, stats: { damageMin: 32, damageMax: 50, accuracy: 62, specialEffect: "stun", specialChance: 30 } },

    { itemId: "mg4_common",    name: "MG4",         category: "lmg", tier: "common",    weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 100, stats: { damageMin: 15, damageMax: 21, accuracy: 62 } },
    { itemId: "mg4_uncommon",  name: "MG4 Mk.II",   category: "lmg", tier: "uncommon",  weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 150, stats: { damageMin: 20, damageMax: 29, accuracy: 62 } },
    { itemId: "mg4_rare",      name: "MG4 Custom",  category: "lmg", tier: "rare",      weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 200, stats: { damageMin: 27, damageMax: 39, accuracy: 62 } },
    { itemId: "mg4_epic",      name: "MG4 Cyber",   category: "lmg", tier: "epic",      weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 270, stats: { damageMin: 37, damageMax: 52, accuracy: 62, specialEffect: "bleed", specialChance: 18 } },
    { itemId: "mg4_legendary", name: "MG4 Phantom", category: "lmg", tier: "legendary", weaponSlot: "primary", magazineSize: 100, ammoCategory: "lmg_rounds", maxDurability: 360, stats: { damageMin: 49, damageMax: 70, accuracy: 62, specialEffect: "bleed", specialChance: 26 } },

    // ── BODY ARMOR ────────────────────────────────────────────────────────────
    { itemId: "street_vest",   name: "Street Vest",   category: "body_armor", tier: "common",    stackable: false, maxStack: 1, weaponSlot: null, ammoCategory: null, armorHp: 50,  maxDurability: 100, stats: {} },
    { itemId: "tactical_vest", name: "Tactical Vest", category: "body_armor", tier: "uncommon",  stackable: false, maxStack: 1, weaponSlot: null, ammoCategory: null, armorHp: 85,  maxDurability: 150, stats: {} },
    { itemId: "combat_plate",  name: "Combat Plate",  category: "body_armor", tier: "rare",      stackable: false, maxStack: 1, weaponSlot: null, ammoCategory: null, armorHp: 130, maxDurability: 200, stats: { specialEffect: "absorb", specialChance: 10 } },
    { itemId: "ballistic_rig", name: "Ballistic Rig", category: "body_armor", tier: "epic",      stackable: false, maxStack: 1, weaponSlot: null, ammoCategory: null, armorHp: 195, maxDurability: 280, stats: { specialEffect: "absorb", specialChance: 20 } },
    { itemId: "exo_armor",     name: "Exo-Armor",     category: "body_armor", tier: "legendary", stackable: false, maxStack: 1, weaponSlot: null, ammoCategory: null, armorHp: 275, maxDurability: 400, stats: { specialEffect: "absorb", specialChance: 30 } },

    // ── AMMO ──────────────────────────────────────────────────────────────────
    { itemId: "pistol_rounds_common",    name: "Pistol Rounds",         category: "pistol_rounds",  tier: "common",    stackable: true, magazineSize: 15,  stats: { damageMultiplier: 1.00 } },
    { itemId: "pistol_rounds_uncommon",  name: "Pistol Rounds Mk.II",   category: "pistol_rounds",  tier: "uncommon",  stackable: true, magazineSize: 17,  stats: { damageMultiplier: 1.05 } },
    { itemId: "pistol_rounds_rare",      name: "Pistol Rounds Custom",  category: "pistol_rounds",  tier: "rare",      stackable: true, magazineSize: 19,  stats: { damageMultiplier: 1.10 } },
    { itemId: "pistol_rounds_epic",      name: "Pistol Rounds Cyber",   category: "pistol_rounds",  tier: "epic",      stackable: true, magazineSize: 21,  stats: { damageMultiplier: 1.15 } },
    { itemId: "pistol_rounds_legendary", name: "Pistol Rounds Phantom", category: "pistol_rounds",  tier: "legendary", stackable: true, magazineSize: 23,  stats: { damageMultiplier: 1.20 } },

    { itemId: "smg_rounds_common",    name: "SMG Rounds",         category: "smg_rounds", tier: "common",    stackable: true, magazineSize: 30,  stats: { damageMultiplier: 1.00 } },
    { itemId: "smg_rounds_uncommon",  name: "SMG Rounds Mk.II",   category: "smg_rounds", tier: "uncommon",  stackable: true, magazineSize: 33,  stats: { damageMultiplier: 1.05 } },
    { itemId: "smg_rounds_rare",      name: "SMG Rounds Custom",  category: "smg_rounds", tier: "rare",      stackable: true, magazineSize: 37,  stats: { damageMultiplier: 1.10 } },
    { itemId: "smg_rounds_epic",      name: "SMG Rounds Cyber",   category: "smg_rounds", tier: "epic",      stackable: true, magazineSize: 41,  stats: { damageMultiplier: 1.15 } },
    { itemId: "smg_rounds_legendary", name: "SMG Rounds Phantom", category: "smg_rounds", tier: "legendary", stackable: true, magazineSize: 45,  stats: { damageMultiplier: 1.20 } },

    { itemId: "rifle_rounds_common",    name: "Rifle Rounds",         category: "rifle_rounds", tier: "common",    stackable: true, magazineSize: 25,  stats: { damageMultiplier: 1.00 } },
    { itemId: "rifle_rounds_uncommon",  name: "Rifle Rounds Mk.II",   category: "rifle_rounds", tier: "uncommon",  stackable: true, magazineSize: 28,  stats: { damageMultiplier: 1.05 } },
    { itemId: "rifle_rounds_rare",      name: "Rifle Rounds Custom",  category: "rifle_rounds", tier: "rare",      stackable: true, magazineSize: 32,  stats: { damageMultiplier: 1.10 } },
    { itemId: "rifle_rounds_epic",      name: "Rifle Rounds Cyber",   category: "rifle_rounds", tier: "epic",      stackable: true, magazineSize: 36,  stats: { damageMultiplier: 1.15 } },
    { itemId: "rifle_rounds_legendary", name: "Rifle Rounds Phantom", category: "rifle_rounds", tier: "legendary", stackable: true, magazineSize: 40,  stats: { damageMultiplier: 1.20 } },

    { itemId: "shotgun_shells_common",    name: "Shotgun Shells",         category: "shotgun_shells", tier: "common",    stackable: true, magazineSize: 7,  stats: { damageMultiplier: 1.00 } },
    { itemId: "shotgun_shells_uncommon",  name: "Shotgun Shells Mk.II",   category: "shotgun_shells", tier: "uncommon",  stackable: true, magazineSize: 8,  stats: { damageMultiplier: 1.05 } },
    { itemId: "shotgun_shells_rare",      name: "Shotgun Shells Custom",  category: "shotgun_shells", tier: "rare",      stackable: true, magazineSize: 9,  stats: { damageMultiplier: 1.08 } },
    { itemId: "shotgun_shells_epic",      name: "Shotgun Shells Cyber",   category: "shotgun_shells", tier: "epic",      stackable: true, magazineSize: 10, stats: { damageMultiplier: 1.12 } },
    { itemId: "shotgun_shells_legendary", name: "Shotgun Shells Phantom", category: "shotgun_shells", tier: "legendary", stackable: true, magazineSize: 11, stats: { damageMultiplier: 1.18 } },

    { itemId: "sniper_rounds_common",    name: "Sniper Rounds",         category: "sniper_rounds", tier: "common",    stackable: true, magazineSize: 5,  stats: { damageMultiplier: 1.00 } },
    { itemId: "sniper_rounds_uncommon",  name: "Sniper Rounds Mk.II",   category: "sniper_rounds", tier: "uncommon",  stackable: true, magazineSize: 5,  stats: { damageMultiplier: 1.05 } },
    { itemId: "sniper_rounds_rare",      name: "Sniper Rounds Custom",  category: "sniper_rounds", tier: "rare",      stackable: true, magazineSize: 6,  stats: { damageMultiplier: 1.10 } },
    { itemId: "sniper_rounds_epic",      name: "Sniper Rounds Cyber",   category: "sniper_rounds", tier: "epic",      stackable: true, magazineSize: 7,  stats: { damageMultiplier: 1.15 } },
    { itemId: "sniper_rounds_legendary", name: "Sniper Rounds Phantom", category: "sniper_rounds", tier: "legendary", stackable: true, magazineSize: 8,  stats: { damageMultiplier: 1.22 } },

    { itemId: "lmg_rounds_common",    name: "LMG Rounds",         category: "lmg_rounds", tier: "common",    stackable: true, magazineSize: 100, stats: { damageMultiplier: 1.00 } },
    { itemId: "lmg_rounds_uncommon",  name: "LMG Rounds Mk.II",   category: "lmg_rounds", tier: "uncommon",  stackable: true, magazineSize: 100, stats: { damageMultiplier: 1.04 } },
    { itemId: "lmg_rounds_rare",      name: "LMG Rounds Custom",  category: "lmg_rounds", tier: "rare",      stackable: true, magazineSize: 120, stats: { damageMultiplier: 1.08 } },
    { itemId: "lmg_rounds_epic",      name: "LMG Rounds Cyber",   category: "lmg_rounds", tier: "epic",      stackable: true, magazineSize: 150, stats: { damageMultiplier: 1.12 } },
    { itemId: "lmg_rounds_legendary", name: "LMG Rounds Phantom", category: "lmg_rounds", tier: "legendary", stackable: true, magazineSize: 200, stats: { damageMultiplier: 1.18 } },

    // ── CONSUMABLES ───────────────────────────────────────────────────────────
    { itemId: "small_medkit",    name: "Small Medkit",   category: "consumable", tier: "common",    stackable: true, maxStack: 10, stats: { healAmount: 80 } },
    { itemId: "large_medkit",    name: "Large Medkit",   category: "consumable", tier: "rare",      stackable: true, maxStack: 5,  stats: { healAmount: 200 } },
    { itemId: "mega_medkit",     name: "Mega Medkit",    category: "consumable", tier: "epic",      stackable: true, maxStack: 3,  stats: { healAmount: 400, specialEffect: "clear_bleed" } },
    { itemId: "smoke_grenade",   name: "Smoke Grenade",  category: "consumable", tier: "common",    stackable: true, maxStack: 10, stats: { specialEffect: "blind" } },
    { itemId: "frag_grenade",    name: "Frag Grenade",   category: "consumable", tier: "uncommon",  stackable: true, maxStack: 5,  stats: { specialEffect: "damage",       damageMin: 50,  damageMax: 80  } },
    { itemId: "cyber_grenade",   name: "Cyber Grenade",  category: "consumable", tier: "epic",      stackable: true, maxStack: 3,  stats: { specialEffect: "damage_stun",  damageMin: 120, damageMax: 180 } },

    { itemId: "stimpack",        name: "Stimpack",       category: "consumable", tier: "rare",      stackable: true, maxStack: 3,  stats: { specialEffect: "damage_boost" } },
    { itemId: "nano_shield",     name: "Nano Shield",    category: "consumable", tier: "epic",      stackable: true, maxStack: 3,  stats: { shieldAmount: 100, specialEffect: "shield" } },
    { itemId: "stim_shot",       name: "Stim Shot",      category: "consumable", tier: "uncommon",  stackable: true, maxStack: 5,  stats: { specialEffect: "berserk" } },
    { itemId: "berserker_dose",  name: "Berserker Dose", category: "consumable", tier: "legendary", stackable: true, maxStack: 2,  stats: { specialEffect: "berserk" } },
  ];

  await Promise.all(items.map(upsertItem));
  logger.info({ count: items.length }, "Arena items seeded");
}
