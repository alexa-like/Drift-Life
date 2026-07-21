import mongoose, { Document, Schema } from "mongoose";

export interface IBounty extends Document {
  placerId:      mongoose.Types.ObjectId;
  placerName:    string;
  targetId:      mongoose.Types.ObjectId;
  targetName:    string;
  amount:        number;
  claimedById:   mongoose.Types.ObjectId | null;
  claimedByName: string | null;
  claimedAt:     Date | null;
  status:        "active" | "claimed" | "expired" | "cancelled";
  expiresAt:     Date;
  createdAt:     Date;
  updatedAt:     Date;
}

const BountySchema = new Schema<IBounty>(
  {
    placerId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    placerName:    { type: String, required: true },
    targetId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetName:    { type: String, required: true },
    amount:        { type: Number, required: true, min: 1000 },
    claimedById:   { type: Schema.Types.ObjectId, ref: "User", default: null },
    claimedByName: { type: String, default: null },
    claimedAt:     { type: Date, default: null },
    status:        { type: String, enum: ["active", "claimed", "expired", "cancelled"], default: "active" },
    expiresAt:     { type: Date, required: true },
  },
  { timestamps: true },
);

BountySchema.index({ targetId: 1, status: 1 });
BountySchema.index({ placerId: 1, status: 1 });
BountySchema.index({ status: 1, expiresAt: 1 });
BountySchema.index({ status: 1, amount: -1 });

export default mongoose.model<IBounty>("Bounty", BountySchema);
