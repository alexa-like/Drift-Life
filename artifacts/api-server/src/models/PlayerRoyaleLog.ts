/**
 * PlayerRoyaleLog — audit trail of every royale spin.
 * One document per spin session (1× or 10× is one document).
 */
import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerRoyaleLog extends Document {
  userId:     mongoose.Types.ObjectId;
  royaleType: "general" | "shooting" | "racing";
  currency:   "dc" | "nc" | "key";
  spinsCount: 1 | 10;
  costPaid:   number;         // total DC / UC / keys spent
  results:    string[];       // array of RoyaleItem names won
  createdAt:  Date;
}

const PlayerRoyaleLogSchema = new Schema<IPlayerRoyaleLog>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    royaleType: { type: String, enum: ["general", "shooting", "racing"], required: true },
    currency:   { type: String, enum: ["dc", "nc", "key"], required: true },
    spinsCount: { type: Number, enum: [1, 10], required: true },
    costPaid:   { type: Number, required: true },
    results:    [{ type: String }],
  },
  { timestamps: true },
);

export default mongoose.model<IPlayerRoyaleLog>("PlayerRoyaleLog", PlayerRoyaleLogSchema);
