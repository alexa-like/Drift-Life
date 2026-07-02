import mongoose, { Document, Schema } from "mongoose";

/** Immutable audit log entry for guild treasury deposits/withdrawals */
export interface IGuildTreasuryEntry extends Document {
  guildId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorUsername: string;
  amount: number;       // positive = deposit, negative = withdrawal
  reason: string;
  balanceAfter: number;
  createdAt: Date;
}

const GuildTreasuryEntrySchema = new Schema<IGuildTreasuryEntry>(
  {
    guildId:        { type: Schema.Types.ObjectId, ref: "Guild", required: true },
    actorId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorUsername:  { type: String, required: true },
    amount:         { type: Number, required: true },
    reason:         { type: String, default: "" },
    balanceAfter:   { type: Number, required: true },
  },
  { timestamps: true }
);

GuildTreasuryEntrySchema.index({ guildId: 1, createdAt: -1 });

export default mongoose.model<IGuildTreasuryEntry>("GuildTreasuryEntry", GuildTreasuryEntrySchema);
