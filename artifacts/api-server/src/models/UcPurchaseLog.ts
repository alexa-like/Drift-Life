/**
 * Audit log for in-game UC subscription purchases.
 * Separate from TelegramPayment (which tracks Stars payments).
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IUcPurchaseLog extends Document {
  userId: mongoose.Types.ObjectId;
  tierId: string;
  tierName: string;
  ucSpent: number;
  frameGranted: string | null;
  ncGranted: number;
  purchasedAt: Date;
}

const UcPurchaseLogSchema = new Schema<IUcPurchaseLog>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tierId:      { type: String, required: true },
    tierName:    { type: String, required: true },
    ucSpent:     { type: Number, required: true },
    frameGranted:{ type: String, default: null },
    ncGranted:   { type: Number, default: 0 },
    purchasedAt: { type: Date,   default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.model<IUcPurchaseLog>("UcPurchaseLog", UcPurchaseLogSchema);
