import mongoose, { Document, Schema } from "mongoose";

export interface IBlackMarketListing extends Document {
  _id: mongoose.Types.ObjectId;
  // Item fields (mirrors Item model)
  name: string;
  type: string;
  rarity: string;
  slot: string | null;
  strengthBonus: number;
  charismaBonus: number;
  intelligenceBonus: number;
  streetCredBonus: number;
  travelTimeReduction: number;
  effect: string | null;
  description: string;
  basePrice: number;
  imageUrl: string | null;
  // Black market specific
  price: number;
  sellerId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId; // reference to original Item
  status: "active" | "sold" | "expired" | "seized";
  expiresAt: Date;
  seizureCheckAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlackMarketListingSchema = new Schema<IBlackMarketListing>(
  {
    name:                  { type: String, required: true },
    type:                  { type: String, required: true },
    rarity:                { type: String, required: true },
    slot:                  { type: String, default: null },
    strengthBonus:         { type: Number, default: 0 },
    charismaBonus:         { type: Number, default: 0 },
    intelligenceBonus:     { type: Number, default: 0 },
    streetCredBonus:       { type: Number, default: 0 },
    travelTimeReduction:   { type: Number, default: 0 },
    effect:                { type: String, default: null },
    description:           { type: String, default: "" },
    basePrice:             { type: Number, default: 0 },
    imageUrl:              { type: String, default: null },
    price:                 { type: Number, required: true, min: 1 },
    sellerId:              { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemId:                { type: Schema.Types.ObjectId, ref: "Item", required: true },
    status:                { type: String, enum: ["active", "sold", "expired", "seized"], default: "active" },
    expiresAt:             { type: Date, required: true },
    seizureCheckAt:        { type: Date, required: true },
  },
  { timestamps: true }
);

BlackMarketListingSchema.index({ status: 1, seizureCheckAt: 1 });
BlackMarketListingSchema.index({ sellerId: 1 });
BlackMarketListingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IBlackMarketListing>("BlackMarketListing", BlackMarketListingSchema);
