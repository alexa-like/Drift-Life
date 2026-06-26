import mongoose, { Document, Schema } from "mongoose";

export interface IItem extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  type: "weapon" | "armor" | "consumable" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  damage: number;
  defense: number;
  effect: string | null;
  description: string;
  price: number;
  equipped: boolean;
  slot: "weapon" | "armor" | null;
  marketListed: boolean;
  marketPrice: number | null;
  createdAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["weapon", "armor", "consumable", "misc"], required: true },
    rarity: { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], default: "common" },
    damage: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    effect: { type: String, default: null },
    description: { type: String, default: "" },
    price: { type: Number, default: 0 },
    equipped: { type: Boolean, default: false },
    slot: { type: String, enum: ["weapon", "armor", null], default: null },
    marketListed: { type: Boolean, default: false },
    marketPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IItem>("Item", ItemSchema);
