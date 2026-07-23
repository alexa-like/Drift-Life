import mongoose, { Document, Schema } from "mongoose";

export interface IHackSession extends Document {
  _id: mongoose.Types.ObjectId;
  hackerId: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  sequence: string[];
  difficulty: number;
  expiresAt: Date;
}

const HackSessionSchema = new Schema<IHackSession>({
  hackerId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
  targetId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
  sequence:   [{ type: String }],
  difficulty: { type: Number, required: true },
  expiresAt:  { type: Date, required: true },
});

// TTL index — sessions expire after 30 seconds server-side too
HackSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
HackSessionSchema.index({ hackerId: 1 });

export default mongoose.model<IHackSession>("HackSession", HackSessionSchema);
