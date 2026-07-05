import mongoose, { Document, Schema } from "mongoose";

export interface IChatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  channel: "global" | "district" | "dm" | `faction:${string}`;
  districtId: string | null;
  dmKey: string | null;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderFaction: string | null;
  senderTitle: string | null;
  content: string;
  deleted: boolean;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    channel:         { type: String, required: true },
    districtId:      { type: String, default: null },
    dmKey:           { type: String, default: null },
    senderId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName:      { type: String, required: true },
    senderFaction:   { type: String, default: null },
    senderTitle:     { type: String, default: null },
    content:         { type: String, required: true, maxlength: 256 },
    deleted:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ channel: 1, districtId: 1, createdAt: -1 });
ChatMessageSchema.index({ channel: 1, dmKey: 1, createdAt: -1 });
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30-day TTL

export function dmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

export default mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
