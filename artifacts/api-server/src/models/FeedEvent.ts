import mongoose, { Document, Schema } from "mongoose";

export interface IFeedEvent extends Document {
  _id: mongoose.Types.ObjectId;
  type: "crime" | "fight" | "job" | "level_up" | "market" | "bank" | "system" | "hospital";
  actor: string;
  actorId: mongoose.Types.ObjectId;
  target: string | null;
  targetId: mongoose.Types.ObjectId | null;
  message: string;
  dc: number;
  xp: number;
  createdAt: Date;
}

const FeedEventSchema = new Schema<IFeedEvent>(
  {
    type: {
      type: String,
      enum: ["crime", "fight", "job", "level_up", "market", "bank", "system", "hospital"],
      required: true,
    },
    actor: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    target: { type: String, default: null },
    targetId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String, required: true },
    dc: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FeedEventSchema.index({ createdAt: -1 });

export default mongoose.model<IFeedEvent>("FeedEvent", FeedEventSchema);
