import mongoose, { Document, Schema } from "mongoose";

export type ReportCategory =
  | "cheating"
  | "harassment"
  | "hate_speech"
  | "spam"
  | "multi_account"
  | "impersonation"
  | "nsfw"
  | "other";

export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";

export interface IPlayerReport extends Document {
  _id: mongoose.Types.ObjectId;
  reporterId: mongoose.Types.ObjectId;
  reporterName: string;
  targetId: mongoose.Types.ObjectId;
  targetName: string;
  category: ReportCategory;
  description: string;
  evidence: string | null;          // optional screenshot URL or chat log snippet
  status: ReportStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerReportSchema = new Schema<IPlayerReport>(
  {
    reporterId:  { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterName: { type: String, required: true },
    targetId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetName:  { type: String, required: true },
    category:    {
      type: String,
      enum: ["cheating", "harassment", "hate_speech", "spam", "multi_account", "impersonation", "nsfw", "other"],
      required: true,
    },
    description: { type: String, required: true, maxlength: 1000 },
    evidence:    { type: String, default: null, maxlength: 500 },
    status:      { type: String, enum: ["open", "under_review", "resolved", "dismissed"], default: "open" },
    reviewedBy:  { type: String, default: null },
    reviewNote:  { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

PlayerReportSchema.index({ status: 1, createdAt: -1 });
PlayerReportSchema.index({ targetId: 1, createdAt: -1 });
PlayerReportSchema.index({ reporterId: 1, targetId: 1, createdAt: -1 });

export default mongoose.model<IPlayerReport>("PlayerReport", PlayerReportSchema);
