/**
 * CombatMatch — state for a single 1v1 turn-based combat match.
 * Player 2 can be a real user or a hidden AI opponent.
 * Turns are stored as an array; the latest entry is the current state.
 */
import mongoose, { Document, Schema } from "mongoose";

export type CombatAction = "attack" | "defend" | "use_item" | "reload" | "special" | "auto_attack"
  | "fire_primary" | "fire_secondary" | "use_consumable" | "melee";
export type CombatStatus = "waiting" | "active" | "complete" | "abandoned";

interface TurnRecord {
  turnNumber:      number;
  player1Action:   CombatAction;
  player2Action:   CombatAction;
  player1HpAfter:  number;
  player2HpAfter:  number;
  player1Effect:   string | null;
  player2Effect:   string | null;
  narrative:       string;
  resolvedAt:      Date;
}

interface LoadoutSnapshot {
  // Legacy fields (backward compat)
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
  // Element effects (optional — absent on matches created before this feature)
  weaponEffect?:       string | null;
  weaponEffectChance?: number;
  armorEffect?:        string | null;
  armorEffectChance?:  number;
  ammoArmorPierce?:    number;
  ammoEffect?:         string | null;
  ammoEffectChance?:   number;
  // New Tier 2 fields
  primaryWeaponId:   string | null;
  secondaryWeaponId: string | null;
  bodyArmorId:       string | null;
  consumableItemId:  string | null;
  consumableCount:   number;
  damageMin:         number;
  damageMax:         number;
  weaponAccuracy:    number;
  specialEffect:     string | null;
  specialChance:     number;
  armorHp:           number;
  strengthBonus:     number;
}

export interface ActiveEffect {
  effect:    string;  // "burn" | "bleed" | "toxic" | "shock" | "stun" | "regen" | "regen_field"
  turnsLeft: number;
  value:     number;  // dmg per turn (DoT) or hp per turn (regen); 0 for stun
}

export interface ITauntRecord {
  senderId: string;
  tauntId:  string;
  round:    number;
  sentAt:   Date;
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
  // Track which consumable itemIds have been used during match
  player1ConsumablesUsed: string[];
  player2ConsumablesUsed: string[];
  // Active status effects (DoT, stun, regen, etc.)
  player1ActiveEffects: ActiveEffect[];
  player2ActiveEffects: ActiveEffect[];
  // New Tier 2 fields
  player1CurrentArmorHp:       number;
  player2CurrentArmorHp:       number;
  player1RoundsFiredPrimary:   number;
  player1RoundsFiredSecondary: number;
  player2RoundsFiredPrimary:   number;
  player2RoundsFiredSecondary: number;
  player1StunNextTurn:         boolean;
  player2StunNextTurn:         boolean;
  player1KnockedBack:          boolean;
  player2KnockedBack:          boolean;
  // Taunts
  taunts: ITauntRecord[];
  // Injected by { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

const LoadoutSnapshotSchema = new Schema<LoadoutSnapshot>(
  {
    // Legacy fields
    weapon:      { type: String, default: null },
    armor:       { type: String, default: null },
    consumable1: { type: String, default: null },
    consumable2: { type: String, default: null },
    ammoType:    { type: String, default: null },
    hp:          { type: Number, default: 100 },
    damage:      { type: Number, default: 15 },
    defense:     { type: Number, default: 0 },
    accuracy:    { type: Number, default: 100 },
    weaponEffect:       { type: String, default: null },
    weaponEffectChance: { type: Number, default: 0 },
    armorEffect:        { type: String, default: null },
    armorEffectChance:  { type: Number, default: 0 },
    ammoArmorPierce:    { type: Number, default: 0 },
    ammoEffect:         { type: String, default: null },
    ammoEffectChance:   { type: Number, default: 0 },
    // New Tier 2 fields
    primaryWeaponId:   { type: String, default: null },
    secondaryWeaponId: { type: String, default: null },
    bodyArmorId:       { type: String, default: null },
    consumableItemId:  { type: String, default: null },
    consumableCount:   { type: Number, default: 0 },
    damageMin:         { type: Number, default: 10 },
    damageMax:         { type: Number, default: 20 },
    weaponAccuracy:    { type: Number, default: 75 },
    specialEffect:     { type: String, default: null },
    specialChance:     { type: Number, default: 0 },
    armorHp:           { type: Number, default: 0 },
    strengthBonus:     { type: Number, default: 0 },
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
    player1ConsumablesUsed: { type: [String], default: [] },
    player2ConsumablesUsed: { type: [String], default: [] },
    player1ActiveEffects:   { type: Schema.Types.Mixed, default: [] },
    player2ActiveEffects:   { type: Schema.Types.Mixed, default: [] },
    // New Tier 2 fields
    player1CurrentArmorHp:       { type: Number, default: 0 },
    player2CurrentArmorHp:       { type: Number, default: 0 },
    player1RoundsFiredPrimary:   { type: Number, default: 0 },
    player1RoundsFiredSecondary: { type: Number, default: 0 },
    player2RoundsFiredPrimary:   { type: Number, default: 0 },
    player2RoundsFiredSecondary: { type: Number, default: 0 },
    player1StunNextTurn:         { type: Boolean, default: false },
    player2StunNextTurn:         { type: Boolean, default: false },
    player1KnockedBack:          { type: Boolean, default: false },
    player2KnockedBack:          { type: Boolean, default: false },
    taunts: {
      type: [{
        senderId: { type: String, required: true },
        tauntId:  { type: String, required: true },
        round:    { type: Number, required: true },
        sentAt:   { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true },
);

CombatMatchSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<ICombatMatch>("CombatMatch", CombatMatchSchema);
