/**
 * CombatMatch — state for a single 1v1 turn-based combat match.
 * Player 2 can be a real user or a hidden AI opponent.
 * Turns are stored as an array; the latest entry is the current state.
 */
import mongoose, { Document, Schema } from "mongoose";

export type CombatAction = "attack" | "defend" | "use_item" | "reload" | "special" | "auto_attack";
export type CombatStatus = "waiting" | "active" | "complete" | "abandoned";

interface TurnRecord {
  turnNumber:      number;
  player1Action:   CombatAction;
  player2Action:   CombatAction;
  player1HpAfter:  number;
  player2HpAfter:  number;
  player1Effect:   string | null;   // e.g. "poisoned", "stunned", "shielded"
  player2Effect:   string | null;
  narrative:       string;
  resolvedAt:      Date;
}

interface LoadoutSnapshot {
  weapon:      string | null;
  armor:       string | null;
  consumable1: string | null;
  consumable2: string | null;
  ammoType:    string | null;
  // Resolved stats at match start
  hp:          number;
  damage:      number;
  defense:     number;
  accuracy:    number;
}

export interface ICombatMatch extends Document {
  matchId:              string;   // uuid
  player1Id:            mongoose.Types.ObjectId;
  player2Id:            mongoose.Types.ObjectId | null;
  isPlayer2AI:          boolean;
  aiName:               string | null;
  player1Loadout:       LoadoutSnapshot;
  player2Loadout:       LoadoutSnapshot;
  turns:                TurnRecord[];
  status:               CombatStatus;
  winnerId:             mongoose.Types.ObjectId | null;
  player1HP:            number;
  player2HP:            number;
  currentTurn:          number;
  currentTurnDeadline:  Date | null;
  energyCost:           number;
  rewardsGranted:       boolean;
  // Track consumable uses during match
  player1ConsumablesUsed: number;
  player2ConsumablesUsed: number;
}

const LoadoutSnapshotSchema = new Schema<LoadoutSnapshot>(
  {
    weapon:      { type: String, default: null },
    armor:       { type: String, default: null },
    consumable1: { type: String, default: null },
    consumable2: { type: String, default: null },
    ammoType:    { type: String, default: null },
    hp:          { type: Number, default: 100 },
    damage:      { type: Number, default: 15 },
    defense:     { type: Number, default: 0 },
    accuracy:    { type: Number, default: 100 },
  },
  { _id: false },
);

const TurnRecordSchema = new Schema<TurnRecord>(
  {
    turnNumber:     { type: Number, required: true },
    player1Action:  { type: String, required: true },
    player2Action:  { type: String, required: true },
    player1HpAfter: { type: Number, required: true },
    player2HpAfter: { type: Number, required: true },
    player1Effect:  { type: String, default: null },
    player2Effect:  { type: String, default: null },
    narrative:      { type: String, default: "" },
    resolvedAt:     { type: Date, default: Date.now },
  },
  { _id: false },
);

const CombatMatchSchema = new Schema<ICombatMatch>(
  {
    matchId:              { type: String, required: true, unique: true, index: true },
    player1Id:            { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    player2Id:            { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isPlayer2AI:          { type: Boolean, default: false },
    aiName:               { type: String, default: null },
    player1Loadout:       { type: LoadoutSnapshotSchema, default: () => ({}) },
    player2Loadout:       { type: LoadoutSnapshotSchema, default: () => ({}) },
    turns:                { type: [TurnRecordSchema], default: [] },
    status:               { type: String, enum: ["waiting", "active", "complete", "abandoned"], default: "waiting" },
    winnerId:             { type: Schema.Types.ObjectId, ref: "User", default: null },
    player1HP:            { type: Number, default: 100 },
    player2HP:            { type: Number, default: 100 },
    currentTurn:          { type: Number, default: 1 },
    currentTurnDeadline:  { type: Date, default: null },
    energyCost:           { type: Number, default: 10 },
    rewardsGranted:       { type: Boolean, default: false },
    player1ConsumablesUsed: { type: Number, default: 0 },
    player2ConsumablesUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CombatMatchSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<ICombatMatch>("CombatMatch", CombatMatchSchema);
