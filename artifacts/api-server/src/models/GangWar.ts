import mongoose, { Document, Schema } from "mongoose";

export type GangWarStatus = "pending" | "active" | "completed" | "declined";

export interface IGangWar extends Document {
  _id: mongoose.Types.ObjectId;
  challengerGuildId: mongoose.Types.ObjectId;
  defenderGuildId:   mongoose.Types.ObjectId;
  status: GangWarStatus;
  challengerPoints: number;
  defenderPoints:   number;
  startedAt:  Date | null;
  endsAt:     Date | null;
  expiresAt:  Date;           // challenger invite expires after 24h if not accepted
  winnerId:   mongoose.Types.ObjectId | null;
  loserTreasuryTransfer: number; // DC taken from loser treasury on settlement
  settled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GangWarSchema = new Schema<IGangWar>(
  {
    challengerGuildId: { type: Schema.Types.ObjectId, ref: "Guild", required: true },
    defenderGuildId:   { type: Schema.Types.ObjectId, ref: "Guild", required: true },
    status:            { type: String, enum: ["pending","active","completed","declined"], default: "pending" },
    challengerPoints:  { type: Number, default: 0 },
    defenderPoints:    { type: Number, default: 0 },
    startedAt:         { type: Date, default: null },
    endsAt:            { type: Date, default: null },
    expiresAt:         { type: Date, required: true },
    winnerId:          { type: Schema.Types.ObjectId, ref: "Guild", default: null },
    loserTreasuryTransfer: { type: Number, default: 0 },
    settled:           { type: Boolean, default: false },
  },
  { timestamps: true }
);

GangWarSchema.index({ challengerGuildId: 1, status: 1 });
GangWarSchema.index({ defenderGuildId:   1, status: 1 });
GangWarSchema.index({ endsAt: 1, status: 1 });

export default mongoose.model<IGangWar>("GangWar", GangWarSchema);
