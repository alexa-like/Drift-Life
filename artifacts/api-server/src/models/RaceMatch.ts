/**
 * RaceMatch — state for a single racing match (2-player or 4-player).
 * Each player races in parallel (parallel solo architecture).
 * Server holds pre-generated AI finish times; player progress is validated server-side.
 * Winner = first to reach finishLine distance.
 */
import mongoose, { Document, Schema } from "mongoose";

export type RaceMode   = "2player" | "4player";
export type RaceStatus = "waiting" | "active" | "complete" | "abandoned";

export interface RacePlayer {
  userId:       mongoose.Types.ObjectId | null;
  isAI:         boolean;
  aiName:       string | null;
  placement:    number | null;      // 1–4 on finish, null while racing
  finishTime:   number | null;      // ms from race start to finish (server-calculated for AI, validated for humans)
  distancePct:  number;             // 0–100 progress % (updated on each shift action)
  nitroUsed:    number;             // total nitro boosts used
  crashCount:   number;             // total crashes this race
  lastShiftAt:  number | null;      // ms timestamp of last shift (anti-cheat: reject impossible cadences)
  shiftCount:   number;             // total shifts submitted (anti-cheat: cap max shifts)
  carSnapshot: {
    carId:     string;
    topSpeed:  number;
    accel:     number;
    handling:  number;
    nitro:     number;
  };
}

export interface IRaceMatch extends Document {
  matchId:     string;   // uuid
  mode:        RaceMode;
  players:     RacePlayer[];
  status:      RaceStatus;
  trackSeed:   number;   // random seed for obstacle/track generation (same seed = same track)
  energyCost:  number;
  startedAt:   Date | null;
  finishedAt:  Date | null;
  rewardsGranted: boolean;
  // Queue info
  queueExpiry: Date;     // if not filled by this time, fill with AI
}

const RacePlayerSchema = new Schema<RacePlayer>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", default: null },
    isAI:        { type: Boolean, default: false },
    aiName:      { type: String, default: null },
    placement:   { type: Number, default: null },
    finishTime:  { type: Number, default: null },
    distancePct: { type: Number, default: 0, min: 0, max: 100 },
    nitroUsed:   { type: Number, default: 0 },
    crashCount:  { type: Number, default: 0 },
    lastShiftAt: { type: Number, default: null },
    shiftCount:  { type: Number, default: 0 },
    carSnapshot: {
      carId:    { type: String, default: "rustbucket_common" },
      topSpeed: { type: Number, default: 40 },
      accel:    { type: Number, default: 30 },
      handling: { type: Number, default: 30 },
      nitro:    { type: Number, default: 20 },
    },
  },
  { _id: false },
);

const RaceMatchSchema = new Schema<IRaceMatch>(
  {
    matchId:        { type: String, required: true, unique: true, index: true },
    mode:           { type: String, enum: ["2player", "4player"], required: true },
    players:        { type: [RacePlayerSchema], default: [] },
    status:         { type: String, enum: ["waiting", "active", "complete", "abandoned"], default: "waiting" },
    trackSeed:      { type: Number, required: true },
    energyCost:     { type: Number, default: 15 },
    startedAt:      { type: Date, default: null },
    finishedAt:     { type: Date, default: null },
    rewardsGranted: { type: Boolean, default: false },
    queueExpiry:    { type: Date, required: true },
  },
  { timestamps: true },
);

RaceMatchSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IRaceMatch>("RaceMatch", RaceMatchSchema);
