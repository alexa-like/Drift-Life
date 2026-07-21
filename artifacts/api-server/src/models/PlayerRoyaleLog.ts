/**
 * PlayerRoyaleLog — stub model retained for owner.ts royale-logs route.
 * Records each spin a player performs on the DC spin / master royale wheel.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerRoyaleLog extends Document {
  userId: mongoose.Types.ObjectId;
  spinType: "dc_spin" | "master_royale";
  prizeItemRef: string;
  prizeName: string;
  prizeTier: string;
  dcSpent: number;
  createdAt: Date;
}

const PlayerRoyaleLogSchema = new Schema<IPlayerRoyaleLog>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    spinType:     { type: String, enum: ["dc_spin","master_royale"], required: true },
    prizeItemRef: { type: String, required: true },
    prizeName:    { type: String, required: true },
    prizeTier:    { type: String, required: true },
    dcSpent:      { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

PlayerRoyaleLogSchema.index({ createdAt: -1 });

export default mongoose.model<IPlayerRoyaleLog>("PlayerRoyaleLog", PlayerRoyaleLogSchema);
