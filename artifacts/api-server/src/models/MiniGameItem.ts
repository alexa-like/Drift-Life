/**
 * MiniGameItem — catalog of all combat items (weapons, armor, consumables, ammo).
 * These are item DEFINITIONS, not player-owned instances.
 * Player inventory is tracked in PlayerMiniGameInventory.
 */
import mongoose, { Document, Schema } from "mongoose";

export type MGItemCategory = "weapon" | "armor" | "consumable" | "ammo";
export type MGItemTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface IMiniGameItem extends Document {
  itemId: string;           // unique slug, e.g. "assault_rifle_rare"
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
    // Special effect description (fire, shock, toxic, AP, etc.)
    specialEffect?: string;
    specialChance?: number;   // 0–100 percent
  };
  imageCard: string;          // asset path or URL
  flavorText: string;
  isActive: boolean;
}

const MiniGameItemSchema = new Schema<IMiniGameItem>(
  {
    itemId:    { type: String, required: true, unique: true },
    name:      { type: String, required: true },
    category:  { type: String, enum: ["weapon", "armor", "consumable", "ammo"], required: true },
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
    imageCard:   { type: String, default: "/assets/items/placeholder.webp" },
    flavorText:  { type: String, default: "" },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true },
);

MiniGameItemSchema.index({ category: 1, tier: 1 });

export default mongoose.model<IMiniGameItem>("MiniGameItem", MiniGameItemSchema);
