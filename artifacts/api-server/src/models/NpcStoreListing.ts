import mongoose, { Document, Schema } from "mongoose";

export interface INpcStoreListing extends Document {
  storeId: string;
  itemId: string;
  itemType: "normal" | "arena";
  itemName: string;
  itemTier: string;
  price: number;
  quantity: number;
  expiresAt: Date;
  isActive: boolean;
}

const NpcStoreListingSchema = new Schema<INpcStoreListing>({
  storeId: { type: String, required: true, index: true },
  itemId: { type: String, required: true },
  itemType: { type: String, enum: ["normal","arena"], default: "normal" },
  itemName: { type: String, required: true },
  itemTier: { type: String, default: "common" },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1, min: 0 },
  expiresAt: { type: Date, required: true, index: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

NpcStoreListingSchema.index({ storeId: 1, isActive: 1, expiresAt: 1 });
export default mongoose.model<INpcStoreListing>("NpcStoreListing", NpcStoreListingSchema);
