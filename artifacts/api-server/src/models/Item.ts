import mongoose, { Document, Schema } from "mongoose";

export interface IItem extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  type: "weapon" | "armor" | "clothing" | "vehicle" | "consumable" | "material" | "badge" | "card" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "event";
  strengthBonus: number;
  charismaBonus: number;
  intelligenceBonus: number;
  streetCredBonus: number;
  defenseBonus: number;
  travelEnergyReduction: number;
  effect: string | null;
  description: string;
  basePrice: number;
  quantity: number;
  equipped: boolean;
  slot: "weapon" | "armor" | "clothing" | "vehicle" | null;
  marketListed: boolean;
  marketPrice: number | null;
  marketListedAt: Date | null;
  blackMarket: boolean;
  imageUrl: string | null;
  iconUrl: string | null;
  ownerId: mongoose.Types.ObjectId | null;
  auctionId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["weapon", "armor", "clothing", "vehicle", "consumable", "material", "badge", "card", "misc"],
      required: true,
    },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "epic", "legendary", "mythic", "event"],
      default: "common",
    },
    strengthBonus: { type: Number, default: 0 },
    charismaBonus: { type: Number, default: 0 },
    intelligenceBonus: { type: Number, default: 0 },
    streetCredBonus: { type: Number, default: 0 },
    defenseBonus: { type: Number, default: 0 },
    travelEnergyReduction: { type: Number, default: 0 },
    effect: { type: String, default: null },
    description: { type: String, default: "" },
    basePrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 1, min: 0 },
    equipped: { type: Boolean, default: false },
    slot: { type: String, enum: ["weapon", "armor", "clothing", "vehicle", null], default: null },
    marketListed: { type: Boolean, default: false },
    marketPrice: { type: Number, default: null },
    marketListedAt: { type: Date, default: null },
    blackMarket: { type: Boolean, default: false },
    imageUrl: { type: String, default: null },
    iconUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    auctionId: { type: Schema.Types.ObjectId, ref: "AuctionListing", default: null },
  },
  { timestamps: true }
);

ItemSchema.index({ owner: 1, type: 1 });
ItemSchema.index({ marketListed: 1, createdAt: -1 });
// Compound index for NPC-drop upsert deduplication (prevents race-created duplicates)
ItemSchema.index({ owner: 1, name: 1, type: 1, rarity: 1 });

export default mongoose.model<IItem>("Item", ItemSchema);
