/**
 * RoyaleItem — catalog of all items that can drop from any royale wheel.
 * Each document is one possible spin outcome.
 * The `reward` object describes exactly what the player receives.
 */
import mongoose, { Document, Schema } from "mongoose";

export type RoyaleType  = "general" | "shooting" | "racing";
export type RoyaleTier  = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type RoyaleItemType =
  | "currency_dc"
  | "currency_keys"
  | "currency_shards"
  | "energy_drink"
  | "energy_max_boost"
  | "xp_boost"
  | "title"
  | "badge"
  | "avatar_background"
  | "spin_token"
  | "loot_crate"
  | "weapon"
  | "armor"
  | "consumable"
  | "ammo"
  | "car"
  | "car_part";

export interface IRoyaleItem extends Document {
  royaleType: RoyaleType;
  itemType:   RoyaleItemType;
  tier:       RoyaleTier;
  name:       string;
  imageCard:  string;
  reward: {
    dc?:              number;
    keys?:            number;
    keyShards?:       number;
    xp?:              number;
    energyAmount?:    number;   // flat energy restore
    energyMaxBoost?:  number;   // permanent max energy increase
    titleId?:         string;
    badgeId?:         string;
    backgroundId?:    string;
    spinTokens?:      number;
    lootCrateTier?:   RoyaleTier;
    miniGameItemId?:  string;   // MiniGameItem.itemId
    carId?:           string;   // RaceCar.carId
    carPartId?:       string;   // CarPart.partId
  };
  dropWeight: number;   // relative weight; higher = more common
  isActive:   boolean;
}

const RoyaleItemSchema = new Schema<IRoyaleItem>(
  {
    royaleType: { type: String, enum: ["general", "shooting", "racing"], required: true },
    itemType:   { type: String, required: true },
    tier:       { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },
    name:       { type: String, required: true },
    imageCard:  { type: String, default: "/assets/royale/placeholder.webp" },
    reward: {
      dc:             { type: Number, default: 0 },
      keys:           { type: Number, default: 0 },
      keyShards:      { type: Number, default: 0 },
      xp:             { type: Number, default: 0 },
      energyAmount:   { type: Number, default: 0 },
      energyMaxBoost: { type: Number, default: 0 },
      titleId:        { type: String, default: null },
      badgeId:        { type: String, default: null },
      backgroundId:   { type: String, default: null },
      spinTokens:     { type: Number, default: 0 },
      lootCrateTier:  { type: String, default: null },
      miniGameItemId: { type: String, default: null },
      carId:          { type: String, default: null },
      carPartId:      { type: String, default: null },
    },
    dropWeight: { type: Number, required: true, default: 1 },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true },
);

RoyaleItemSchema.index({ royaleType: 1, tier: 1, isActive: 1 });

export default mongoose.model<IRoyaleItem>("RoyaleItem", RoyaleItemSchema);
