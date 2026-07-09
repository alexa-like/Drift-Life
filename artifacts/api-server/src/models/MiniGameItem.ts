/**
 * MiniGameItem — catalog of all combat items (weapons, armor, consumables, ammo).
 * These are item DEFINITIONS, not player-owned instances.
 * Player inventory is tracked in PlayerMiniGameInventory.
 */
import mongoose, { Document, Schema } from "mongoose";

export type MGItemCategory =
  | "pistol" | "smg" | "assault_rifle" | "shotgun" | "sniper_rifle" | "lmg"
  | "body_armor" | "consumable"
  | "pistol_rounds" | "smg_rounds" | "rifle_rounds" | "shotgun_shells" | "sniper_rounds" | "lmg_rounds";
export type MGItemTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface IMiniGameItem extends Document {
  itemId: string;           // unique slug, e.g. "ak47_rare"
  name: string;
  category: MGItemCategory;
  tier: MGItemTier;
  stats: {
    // Weapon stats
    damageMin?: number;
    damageMax?: number;
    accuracy?: number;
    // Armor stats
    defense?: number;
    hp?: number;
    // Consumable stats
    healAmount?: number;
    shieldAmount?: number;
    // Ammo stats
    damageMultiplier?: number;
    // Special effect
    specialEffect?: string;
    specialChance?: number;   // 0–100 percent
  };
  imageCard: string;          // asset path or URL
  flavorText: string;
  stackable: boolean;         // true = multiple can be held; false = one at a time
  maxStack: number;           // max quantity per inventory slot (1 for non-stackable)
  isActive: boolean;
  // New fields for Tier 2
  weaponSlot: "primary" | "secondary" | null;
  magazineSize: number | null;
  ammoCategory: string | null;
  armorHp: number | null;
  maxDurability: number | null;
}

const MiniGameItemSchema = new Schema<IMiniGameItem>(
  {
    itemId:    { type: String, required: true, unique: true },
    name:      { type: String, required: true },
    category:  {
      type: String,
      enum: [
        "pistol", "smg", "assault_rifle", "shotgun", "sniper_rifle", "lmg",
        "body_armor", "consumable",
        "pistol_rounds", "smg_rounds", "rifle_rounds", "shotgun_shells", "sniper_rounds", "lmg_rounds",
      ],
      required: true,
    },
    tier:      { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },
    stats: {
      damageMin:        { type: Number, default: 0 },
      damageMax:        { type: Number, default: 0 },
      accuracy:         { type: Number, default: 100 },
      defense:          { type: Number, default: 0 },
      hp:               { type: Number, default: 0 },
      healAmount:       { type: Number, default: 0 },
      shieldAmount:     { type: Number, default: 0 },
      damageMultiplier: { type: Number, default: 1 },
      specialEffect:    { type: String, default: null },
      specialChance:    { type: Number, default: 0 },
    },
    imageCard:      { type: String, default: "/assets/items/placeholder.webp" },
    flavorText:     { type: String, default: "" },
    stackable:      { type: Boolean, default: true },
    maxStack:       { type: Number, default: 99 },
    isActive:       { type: Boolean, default: true },
    weaponSlot:     { type: String, enum: ["primary", "secondary", null], default: null },
    magazineSize:   { type: Number, default: null },
    ammoCategory:   { type: String, default: null },
    armorHp:        { type: Number, default: null },
    maxDurability:  { type: Number, default: null },
  },
  { timestamps: true },
);

MiniGameItemSchema.index({ category: 1, tier: 1 });

export default mongoose.model<IMiniGameItem>("MiniGameItem", MiniGameItemSchema);
