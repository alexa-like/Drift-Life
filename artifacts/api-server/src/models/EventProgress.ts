import mongoose, { Document, Schema } from "mongoose";

export interface IEventProgress extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  points: number;
  bossDamageDealt: number;
  collectiblesFound: number;
  ticketsEarned: number;
  teamId?: string;
  oneTimeRewardsClaimed: string[];
  lastStrikeAt?: Date;
  lastActionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventProgressSchema = new Schema<IEventProgress>({
  eventId:  { type: Schema.Types.ObjectId, ref: "Event", required: true },
  userId:   { type: Schema.Types.ObjectId, ref: "User",  required: true },
  username: { type: String, required: true },
  points:   { type: Number, default: 0 },
  bossDamageDealt:   { type: Number, default: 0 },
  collectiblesFound: { type: Number, default: 0 },
  ticketsEarned:     { type: Number, default: 0 },
  teamId: { type: String },
  oneTimeRewardsClaimed: [{ type: String }],
  lastStrikeAt:  { type: Date },
  lastActionAt:  { type: Date, default: Date.now },
}, { timestamps: true });

EventProgressSchema.index({ eventId: 1, points: -1 }); // leaderboard
EventProgressSchema.index({ eventId: 1, userId: 1 }, { unique: true }); // upsert guard

export default mongoose.model<IEventProgress>("EventProgress", EventProgressSchema);
