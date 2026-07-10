import mongoose, { Document, Schema } from "mongoose";

export type TicketCategory = "account" | "bug" | "payment" | "appeal" | "suggestion" | "other";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface ITicketReply {
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  isStaff: boolean;
  content: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  playerName: string;
  category: TicketCategory;
  subject: string;
  body: string;
  status: TicketStatus;
  assignedTo: string | null;
  replies: ITicketReply[];
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema<ITicketReply>(
  {
    authorId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    isStaff:    { type: Boolean, default: false },
    content:    { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    playerId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    playerName: { type: String, required: true },
    category:   {
      type: String,
      enum: ["account", "bug", "payment", "appeal", "suggestion", "other"],
      required: true,
    },
    subject:    { type: String, required: true, maxlength: 120 },
    body:       { type: String, required: true, maxlength: 2000 },
    status:     { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
    assignedTo: { type: String, default: null },
    replies:    { type: [ReplySchema], default: [] },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ status: 1, createdAt: -1 });
SupportTicketSchema.index({ playerId: 1, createdAt: -1 });

export default mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
