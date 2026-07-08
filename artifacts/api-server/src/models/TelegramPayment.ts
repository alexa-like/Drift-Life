import mongoose, { Document, Schema } from "mongoose";

export interface ITelegramPayment extends Document {
  chargeId: string;          // provider_payment_charge_id — unique per Telegram payment
  userId: mongoose.Types.ObjectId;
  productId: string;
  productType: "nc_pack" | "subscription";
  tier: string | null;       // subscription tier, null for NC packs
  starsAmount: number;
  ncGranted: number;
  grantedAt: Date;
}

const TelegramPaymentSchema = new Schema<ITelegramPayment>(
  {
    chargeId:    { type: String, required: true, unique: true },   // replay-attack guard
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId:   { type: String, required: true },
    productType: { type: String, enum: ["nc_pack", "subscription"], required: true },
    tier:        { type: String, default: null },
    starsAmount: { type: Number, required: true },
    ncGranted:   { type: Number, default: 0 },
    grantedAt:   { type: Date, default: Date.now },
  },
  { timestamps: false }
);

TelegramPaymentSchema.index({ userId: 1, grantedAt: -1 });

export default mongoose.model<ITelegramPayment>("TelegramPayment", TelegramPaymentSchema);
