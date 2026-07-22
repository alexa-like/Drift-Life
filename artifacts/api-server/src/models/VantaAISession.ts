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
  /** For player sessions: the player's userId. Null for owner sessions. */
  playerId: string | null;
  /** Distinguishes owner panel sessions from player tutor sessions. */
  sessionType: "owner" | "player";
  aiModel: string;
  messages: IVantaMessage[];
  /** Auto-generated summary of older messages trimmed from the front of the array.
   *  Prepended to Vanta's system prompt so she never truly forgets important context. */
  contextSummary: string | null;
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
  ownerId:        { type: String, required: true, index: true },
  playerId:       { type: String, default: null },
  sessionType:    { type: String, enum: ["owner", "player"], default: "owner" },
  aiModel:        { type: String, required: true },
  messages:       { type: [VantaMessageSchema], default: [] },
  contextSummary: { type: String, default: null },
}, { timestamps: true });

// Keep sessions for 90 days
VantaAISessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IVantaAISession>("VantaAISession", VantaAISessionSchema);
