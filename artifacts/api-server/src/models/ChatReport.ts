import mongoose, { Schema, Document } from "mongoose";

export interface IChatReport extends Document {
  _id: mongoose.Types.ObjectId;
  messageId: mongoose.Types.ObjectId;
  messageContent: string;
  messageChannel: string;
  reportedUserId: mongoose.Types.ObjectId;
  reportedUsername: string;
  reporterId: mongoose.Types.ObjectId;
  reporterUsername: string;
  reason: string | null;
  status: "pending" | "reviewed" | "dismissed";
  reviewedBy: string | null;
  createdAt: Date;
}

const ChatReportSchema = new Schema<IChatReport>(
  {
    messageId:        { type: Schema.Types.ObjectId, ref: "ChatMessage", required: true },
    messageContent:   { type: String, required: true },
    messageChannel:   { type: String, required: true },
    reportedUserId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUsername: { type: String, required: true },
    reporterId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterUsername: { type: String, required: true },
    reason:           { type: String, default: null },
    status:           { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending" },
    reviewedBy:       { type: String, default: null },
  },
  { timestamps: true }
);

ChatReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IChatReport>("ChatReport", ChatReportSchema);
