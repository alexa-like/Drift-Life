/**
 * RoyaleItem — stub model retained for royaleSeed.ts compatibility.
 * The Royale spin system uses these items as prize pool entries.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IRoyaleItem extends Document {
  name: string;
  itemRef: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  dropWeight: number;
  itemType: "weapon" | "armor" | "consumable" | "ammo" | "car" | "car_part";
  royaleCategory: string;
  spinType: "dc_spin" | "master_royale";
}

const RoyaleItemSchema = new Schema<IRoyaleItem>(
  {
    name:           { type: String, required: true },
    itemRef:        { type: String, required: true, unique: true },
    tier:           { type: String, enum: ["common","uncommon","rare","epic","legendary"], required: true },
    dropWeight:     { type: Number, required: true },
    itemType:       { type: String, enum: ["weapon","armor","consumable","ammo","car","car_part"], required: true },
    royaleCategory: { type: String, required: true },
    spinType:       { type: String, enum: ["dc_spin","master_royale"], required: true },
  },
  { timestamps: true }
);

RoyaleItemSchema.index({ spinType: 1, royaleCategory: 1 });

export default mongoose.model<IRoyaleItem>("RoyaleItem", RoyaleItemSchema);
