/**
 * Audit log for in-game NC subscription purchases.
 * "NC" = Nova Credits (the premium currency).
 * Separate from TelegramPayment (which tracks Stars payments).
 * File kept as UcPurchaseLog.ts to avoid breaking existing imports; collection renamed.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IUcPurchaseLog extends Document {
  userId: mongoose.Types.ObjectId;
  tierId: string;
  tierName: string;
  ncSpent: number;
  ncGranted: number;
  purchasedAt: Date;
}

const UcPurchaseLogSchema = new Schema<IUcPurchaseLog>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tierId:      { type: String, required: true },
    tierName:    { type: String, required: true },
    ncSpent:     { type: Number, required: true },
    ncGranted:   { type: Number, default: 0 },
    purchasedAt: { type: Date,   default: Date.now },
  },
  { timestamps: false }
);

// 90-day TTL — purchase logs auto-purge after 3 months
UcPurchaseLogSchema.index({ purchasedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IUcPurchaseLog>("NcPurchaseLog", UcPurchaseLogSchema);
