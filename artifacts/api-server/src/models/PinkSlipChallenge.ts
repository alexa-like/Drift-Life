import mongoose, { Document, Schema } from "mongoose";

export interface IPinkSlipChallenge extends Document {
  _id: mongoose.Types.ObjectId;
  challengerId: mongoose.Types.ObjectId;
  defenderId: mongoose.Types.ObjectId;
  challengerCarId: mongoose.Types.ObjectId;
  defenderCarId: mongoose.Types.ObjectId;
  raceType: "drag" | "circuit" | "drift";
  expiresAt: Date;
}

const PinkSlipChallengeSchema = new Schema<IPinkSlipChallenge>({
  challengerId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
  defenderId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
  challengerCarId:{ type: Schema.Types.ObjectId, ref: "Car",  required: true },
  defenderCarId:  { type: Schema.Types.ObjectId, ref: "Car",  required: true },
  raceType:       { type: String, enum: ["drag", "circuit", "drift"], required: true },
  expiresAt:      { type: Date, required: true },
});

// TTL index — MongoDB auto-deletes expired challenges
PinkSlipChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PinkSlipChallengeSchema.index({ defenderId: 1 });

export default mongoose.model<IPinkSlipChallenge>("PinkSlipChallenge", PinkSlipChallengeSchema);
