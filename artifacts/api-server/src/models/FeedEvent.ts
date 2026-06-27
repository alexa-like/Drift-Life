import mongoose, { Document, Schema } from "mongoose";

export interface IFeedEvent extends Document {
  _id: mongoose.Types.ObjectId;
  type: "crime" | "fight" | "job" | "level_up" | "market" | "bank" | "system" | "hospital" | "post" | "travel" | "daily";
  actor: string;
  actorId: mongoose.Types.ObjectId | null;
  target: string | null;
  targetId: mongoose.Types.ObjectId | null;
  message: string;
  dc: number;
  xp: number;
  reactions: { like: number; laugh: number; shock: number; respect: number };
  comments: Array<{ username: string; content: string; at: Date }>;
  createdAt: Date;
}

const FeedEventSchema = new Schema<IFeedEvent>(
  {
    type: {
      type: String,
      enum: ["crime", "fight", "job", "level_up", "market", "bank", "system", "hospital", "post", "travel", "daily"],
      required: true,
    },
    actor: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    target: { type: String, default: null },
    targetId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String, required: true },
    dc: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    reactions: {
      like: { type: Number, default: 0 },
      laugh: { type: Number, default: 0 },
      shock: { type: Number, default: 0 },
      respect: { type: Number, default: 0 },
    },
    comments: [{
      username: String,
      content: String,
      at: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

FeedEventSchema.index({ createdAt: -1 });

export default mongoose.model<IFeedEvent>("FeedEvent", FeedEventSchema);
