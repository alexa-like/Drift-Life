import mongoose, { Document, Schema } from "mongoose";

export interface IDarkListing extends Document {
  _id: mongoose.Types.ObjectId;
  pseudoHandle: string;
  itemName: string;
  price: number;
  currency: "dc" | "sim";
  stingRisk: number;
  sellerId: mongoose.Types.ObjectId;
  expiresAt: Date;
}

const DarkListingSchema = new Schema<IDarkListing>({
  pseudoHandle: { type: String, required: true },
  itemName:     { type: String, required: true },
  price:        { type: Number, required: true, min: 1 },
  currency:     { type: String, enum: ["dc", "sim"], default: "dc" },
  stingRisk:    { type: Number, default: 0.03 },
  sellerId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt:    { type: Date, required: true },
});

// TTL index — MongoDB auto-deletes listings after 48h
DarkListingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DarkListingSchema.index({ sellerId: 1 });

export default mongoose.model<IDarkListing>("DarkListing", DarkListingSchema);
