import mongoose, { Document, Schema } from "mongoose";

export interface IFactionBankLog extends Document {
  _id: mongoose.Types.ObjectId;
  factionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  amount: number;
  type: "deposit" | "withdraw";
  createdAt: Date;
}

const FactionBankLogSchema = new Schema<IFactionBankLog>(
  {
    factionId: { type: Schema.Types.ObjectId, ref: "Guild", required: true, index: true },
    userId:    { type: Schema.Types.ObjectId, ref: "User",  required: true },
    username:  { type: String, required: true },
    amount:    { type: Number, required: true },
    type:      { type: String, enum: ["deposit", "withdraw"], required: true },
  },
  { timestamps: true }
);

FactionBankLogSchema.index({ factionId: 1, createdAt: -1 });
// 60-day TTL — old faction bank logs auto-purge
FactionBankLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export default mongoose.model<IFactionBankLog>("FactionBankLog", FactionBankLogSchema);
