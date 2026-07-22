import mongoose, { Schema, Document } from "mongoose";

export interface IEconomyLog extends Document {
  type: "dc_in" | "dc_out" | "nc_in" | "nc_out";
  amount: number;
  source: string;        // e.g. "crime_reward", "arena_reward", "nc_store_purchase", "auction_buy"
  userId?: string;       // optional — for per-user flows
  username?: string;     // snapshot at time of log
  createdAt: Date;
}

const EconomyLogSchema = new Schema<IEconomyLog>(
  {
    type:     { type: String, required: true, enum: ["dc_in", "dc_out", "nc_in", "nc_out"] },
    amount:   { type: Number, required: true, min: 0 },
    source:   { type: String, required: true },
    userId:   { type: String, default: null },
    username: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Index for dashboard queries — TTL auto-deletes logs older than 90 days
EconomyLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
EconomyLogSchema.index({ type: 1, createdAt: -1 });
EconomyLogSchema.index({ source: 1, createdAt: -1 });

const EconomyLog = mongoose.model<IEconomyLog>("EconomyLog", EconomyLogSchema);
export default EconomyLog;
