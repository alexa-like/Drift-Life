import mongoose, { Document, Schema } from "mongoose";

/** Tracks per-player mastery for a specific run or gym action */
export interface IActionMastery extends Document {
  userId: mongoose.Types.ObjectId;
  actionId: string;
  actionType: "run" | "gym" | "hack";
  mastery: number;       // 0-100
  attempts: number;
  successes: number;
  lastAttemptAt: Date;
}

const ActionMasterySchema = new Schema<IActionMastery>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    actionId:      { type: String, required: true },
    actionType:    { type: String, enum: ["run", "gym", "hack"], required: true },
    mastery:       { type: Number, default: 0, min: 0, max: 100 },
    attempts:      { type: Number, default: 0 },
    successes:     { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ActionMasterySchema.index({ userId: 1, actionId: 1, actionType: 1 }, { unique: true });

/**
 * Compute the mastery gain for one attempt.
 * gain = 1 / (1 + mastery/50) — diminishing above 50
 */
export function masteryGain(currentMastery: number): number {
  return Math.max(0.1, 1 / (1 + currentMastery / 50));
}

export default mongoose.model<IActionMastery>("ActionMastery", ActionMasterySchema);
