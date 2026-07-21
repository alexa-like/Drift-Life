import mongoose, { Document, Schema } from "mongoose";

// ── Reward shape (shared) ──────────────────────────────────────────────────────
interface PassReward {
  dc: number;
  nc: number;
  cosmeticId?: string;
  title?: string;
  badge?: string;
}

// ── TypeScript interface ───────────────────────────────────────────────────────
export interface IBattlePass extends Document {
  eventId: mongoose.Types.ObjectId;
  seasonName: string;
  ncCost: number;
  totalLevels: number;
  levels: Array<{
    level: number;
    xpRequired: number;   // cumulative XP needed to reach this level
    freeReward: PassReward;
    premiumReward: PassReward;
    isMilestone: boolean; // levels 10, 25, 50 get milestone treatment
  }>;
  xpSources: Array<{ action: string; xp: number }>;
  xpMultiplier: number;  // default 1.0, owner bumps to 2.0 for weekends
  status: "draft" | "active" | "ended";
  startsAt: Date;
  endsAt: Date;
  hallOfFame: Array<{
    rank: number;
    userId: string;
    username: string;
    points: number;
    seasonLevel: number;
    teamId?: string;
  }>;
}

// ── Schema ─────────────────────────────────────────────────────────────────────
const PassRewardSchema = new Schema<PassReward>(
  {
    dc:          { type: Number, default: 0 },
    nc:          { type: Number, default: 0 },
    cosmeticId:  { type: String, default: null },
    title:       { type: String, default: null },
    badge:       { type: String, default: null },
  },
  { _id: false }
);

const LevelSchema = new Schema(
  {
    level:         { type: Number, required: true },
    xpRequired:    { type: Number, required: true },
    freeReward:    { type: PassRewardSchema, default: () => ({}) },
    premiumReward: { type: PassRewardSchema, default: () => ({}) },
    isMilestone:   { type: Boolean, default: false },
  },
  { _id: false }
);

const BattlePassSchema = new Schema<IBattlePass>(
  {
    eventId:        { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    seasonName:     { type: String, required: true, default: "Season" },
    ncCost:         { type: Number, required: true, default: 500 },
    totalLevels:    { type: Number, default: 50 },
    levels:         { type: [LevelSchema], default: [] },
    xpSources:      {
      type: [{ action: { type: String }, xp: { type: Number } }],
      default: () => [
        { action: "crime_success",  xp: 25 },
        { action: "arena_win",      xp: 60 },
        { action: "arena_loss",     xp: 20 },
        { action: "arena_draw",     xp: 30 },
        { action: "race_1st",       xp: 80 },
        { action: "race_finish",    xp: 30 },
        { action: "daily_quest",    xp: 150 },
        { action: "weekly_quest",   xp: 500 },
        { action: "boss_strike",    xp: 40 },
        { action: "event_collect",  xp: 50 },
        { action: "job_shift",      xp: 15 },
        { action: "gym_train",      xp: 20 },
      ],
    },
    xpMultiplier:   { type: Number, default: 1.0 },
    status:         { type: String, enum: ["draft", "active", "ended"], default: "draft" },
    startsAt:       { type: Date, required: true },
    endsAt:         { type: Date, required: true },
    hallOfFame: {
      type: [{
        rank:        { type: Number, required: true },
        userId:      { type: String, required: true },
        username:    { type: String, required: true },
        points:      { type: Number, default: 0 },
        seasonLevel: { type: Number, default: 0 },
        teamId:      { type: String, default: null },
        _id: false,
      }],
      default: () => [],
    },
  },
  { timestamps: true }
);

// Convenience index for "find the currently active pass"
BattlePassSchema.index({ status: 1, startsAt: 1, endsAt: 1 });

export const BattlePass = mongoose.model<IBattlePass>("BattlePass", BattlePassSchema);
