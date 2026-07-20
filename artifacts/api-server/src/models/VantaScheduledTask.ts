import mongoose, { Document, Schema } from "mongoose";

export type TaskType =
  | "scan_cheaters"
  | "mass_currency"
  | "mass_ban_check"
  | "reset_event"
  | "wipe_test_accounts"
  | "custom_action";

export type TaskStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export interface IVantaScheduledTask extends Document {
  _id: mongoose.Types.ObjectId;
  type: TaskType;
  label: string;          // human-readable description
  payload: Record<string, unknown>;
  runAt: Date;
  status: TaskStatus;
  result?: string;
  errorMessage?: string;
  createdBy: string;
  createdAt: Date;
  executedAt?: Date;
}

const VantaScheduledTaskSchema = new Schema<IVantaScheduledTask>(
  {
    type:         { type: String, required: true },
    label:        { type: String, required: true },
    payload:      { type: Schema.Types.Mixed, default: {} },
    runAt:        { type: Date, required: true, index: true },
    status:       { type: String, enum: ["pending", "running", "done", "failed", "cancelled"], default: "pending" },
    result:       { type: String },
    errorMessage: { type: String },
    createdBy:    { type: String, required: true },
    executedAt:   { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-expire completed/cancelled tasks after 7 days
VantaScheduledTaskSchema.index(
  { executedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: { $in: ["done", "failed", "cancelled"] } } }
);

export default mongoose.model<IVantaScheduledTask>("VantaScheduledTask", VantaScheduledTaskSchema);
