/**
 * MiniGameLeaderboard — weekly leaderboard entries for combat and racing.
 * One document per (userId, leaderboardType, weekStart).
 * Resets every Monday at 00:00 UTC. Top 3 receive rewards on reset.
 */
import mongoose, { Document, Schema } from "mongoose";

export type LeaderboardType =
  | "combat_wins"
  | "combat_streak"
  | "race_wins"
  | "race_fastest_2p"
  | "race_fastest_4p";

export interface IMiniGameLeaderboard extends Document {
  leaderboardType: LeaderboardType;
  userId:          mongoose.Types.ObjectId;
  username:        string;   // denormalized for fast query
  avatar:          string;
  score:           number;   // wins count, streak count, or finish time (ms, lower = better for fastest)
  weekStart:       Date;     // ISO Monday 00:00 UTC
  rewardGranted:   boolean;
  lastAnnouncedRank: number | null; // Tier 8 §8.1 — best rank already posted to the system feed this week
}

const MiniGameLeaderboardSchema = new Schema<IMiniGameLeaderboard>(
  {
    leaderboardType: {
      type:     String,
      enum:     ["combat_wins", "combat_streak", "race_wins", "race_fastest_2p", "race_fastest_4p"],
      required: true,
    },
    userId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    username:     { type: String, required: true },
    avatar:       { type: String, default: "1" },
    score:        { type: Number, required: true, default: 0 },
    weekStart:    { type: Date, required: true },
    rewardGranted:{ type: Boolean, default: false },
    lastAnnouncedRank: { type: Number, default: null },
  },
  { timestamps: true },
);

MiniGameLeaderboardSchema.index({ leaderboardType: 1, weekStart: 1, score: -1 });
MiniGameLeaderboardSchema.index({ userId: 1, leaderboardType: 1, weekStart: 1 }, { unique: true });

export default mongoose.model<IMiniGameLeaderboard>("MiniGameLeaderboard", MiniGameLeaderboardSchema);
