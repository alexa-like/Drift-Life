import mongoose, { Document, Schema } from "mongoose";

export interface IPriceOverride extends Document {
  itemId: string;
  price: number;
}

const PriceOverrideSchema = new Schema<IPriceOverride>({
  itemId: { type: String, required: true, unique: true },
  price:  { type: Number, required: true, min: 0 },
});

export default mongoose.model<IPriceOverride>("PriceOverride", PriceOverrideSchema);
