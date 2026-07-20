import mongoose, { Document, Schema } from "mongoose";

export interface IVantaMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  timestamp: Date;
}

export interface IVantaAISession extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: string;
  aiModel: string;
  messages: IVantaMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const VantaMessageSchema = new Schema<IVantaMessage>({
  role:       { type: String, enum: ["user", "assistant", "tool"], required: true },
  content:    { type: String, required: true },
  toolCallId: { type: String },
  toolName:   { type: String },
  timestamp:  { type: Date, default: Date.now },
}, { _id: false });

const VantaAISessionSchema = new Schema<IVantaAISession>({
  ownerId:  { type: String, required: true, index: true },
  aiModel:  { type: String, required: true },
  messages: { type: [VantaMessageSchema], default: [] },
}, { timestamps: true });

// Only keep the last 30 days of sessions
VantaAISessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<IVantaAISession>("VantaAISession", VantaAISessionSchema);
