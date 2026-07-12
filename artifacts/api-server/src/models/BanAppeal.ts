import mongoose, { Document, Schema } from "mongoose";

export type BanAppealStatus = "open" | "resolved";

export interface IBanAppealMessage {
  sender: "player" | "staff";
  senderName: string;
  text: string;
  createdAt: Date;
}

export interface IBanAppeal extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  banReason: string | null;
  status: BanAppealStatus;
  messages: IBanAppealMessage[];
  lastStaffReplyAt: Date | null;
  lastPlayerReplyAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BanAppealMessageSchema = new Schema<IBanAppealMessage>(
  {
    sender: { type: String, enum: ["player", "staff"], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// One appeal thread per user — subsequent bans/appeals reopen the same thread
// so staff and the player always see the full history in one place.
const BanAppealSchema = new Schema<IBanAppeal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    username: { type: String, required: true },
    banReason: { type: String, default: null },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    messages: { type: [BanAppealMessageSchema], default: [] },
    lastStaffReplyAt: { type: Date, default: null },
    lastPlayerReplyAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { timestamps: true },
);

BanAppealSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model<IBanAppeal>("BanAppeal", BanAppealSchema);
