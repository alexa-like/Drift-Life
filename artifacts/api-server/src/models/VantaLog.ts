import mongoose, { Document, Schema } from "mongoose";

export type VantaSeverity = "low" | "medium" | "high" | "critical";
export type VantaTrigger =
  | "repeated_failed_crimes"
  | "economy_exploit"
  | "attack_spam"
  | "alt_account"
  | "dc_spike"
  | "manual_flag";

export interface IVantaLog extends Document {
  _id: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  playerName: string;
  trigger: VantaTrigger;
  severity: VantaSeverity;
  details: string;
  dismissed: boolean;
  dismissedBy: string | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VantaLogSchema = new Schema<IVantaLog>(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    playerName: { type: String, required: true },
    trigger: {
      type: String,
      enum: ["repeated_failed_crimes", "economy_exploit", "attack_spam", "alt_account", "dc_spike", "manual_flag"],
      required: true,
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    details: { type: String, required: true, maxlength: 1000 },
    dismissed: { type: Boolean, default: false },
    dismissedBy: { type: String, default: null },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

VantaLogSchema.index({ dismissed: 1, severity: -1, createdAt: -1 });
VantaLogSchema.index({ playerId: 1, createdAt: -1 });

export default mongoose.model<IVantaLog>("VantaLog", VantaLogSchema);
