/**
 * PlayerPityCounter — tracks pity progress per player per royale wheel.
 * Pity system:
 *   - After 15 spins without Rare+: next spin guaranteed Rare+
 *   - After 50 spins without Epic+: next spin guaranteed Epic+
 * One document per (userId, royaleType) pair.
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerPityCounter extends Document {
  userId:              mongoose.Types.ObjectId;
  royaleType:          "general" | "shooting" | "racing";
  spinsSinceLastRare:  number;   // resets on Rare, Epic, or Legendary win
  spinsSinceLastEpic:  number;   // resets on Epic or Legendary win
}

const PlayerPityCounterSchema = new Schema<IPlayerPityCounter>(
  {
    userId:             { type: Schema.Types.ObjectId, ref: "User", required: true },
    royaleType:         { type: String, enum: ["general", "shooting", "racing"], required: true },
    spinsSinceLastRare: { type: Number, default: 0 },
    spinsSinceLastEpic: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PlayerPityCounterSchema.index({ userId: 1, royaleType: 1 }, { unique: true });

export default mongoose.model<IPlayerPityCounter>("PlayerPityCounter", PlayerPityCounterSchema);
