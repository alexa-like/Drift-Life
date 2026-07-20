import mongoose, { Document, Schema } from "mongoose";

export interface IEventPhase {
  name: string;
  triggerAtHpPercent: number;
  description: string;
  abilityEffect?: string;
}

export interface IEventBoss {
  name: string;
  imageUrl: string;
  totalHp: number;
  currentHp: number;
  phases: IEventPhase[];
  strikeEnergyCost: number;
  strikeCooldownSeconds: number;
  strikeBaseDamage: { min: number; max: number };
  bossRetaliationDamage: { min: number; max: number };
}

export interface IEventTheme {
  gameDisplayName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  bannerImageUrl: string;
  chatBadgeText: string;
  chatBadgeColor: string;
}

export interface ILeaderboardReward {
  rankFrom: number;
  rankTo: number;
  reward: {
    dc: number;
    nc: number;
    cosmetics: Array<{ id: string; durationDays: number }>;
    titles: string[];
    eventPoints?: number;
  };
}

export interface IOneTimeReward {
  id: string;
  label: string;
  condition: { type: string; value: number };
  reward: {
    dc: number;
    nc: number;
    cosmetics: Array<{ id: string; durationDays: number }>;
    titles: string[];
  };
  claimLimit: "once_per_player" | "once_per_event";
}

export interface IPveNpc {
  tier: "minion" | "lieutenant" | "boss" | "final";
  name: string;
  stats: { hp: number; attack: number; defense: number };
  eventPoints: number;
  loot?: { dc?: number; itemId?: string; label?: string };
}

export interface IEvent extends Document {
  name: string;
  slug: string;
  type: "boss_raid" | "leaderboard_grind" | "collection_hunt" | "milestone" | "sports" | "lottery";
  description: string;
  status: "draft" | "scheduled" | "active" | "ended" | "archived";

  startsAt: Date;
  endsAt: Date;
  createdBy: string;
  lastEditedAt: Date;

  theme: IEventTheme;

  pointSources: Array<{ action: string; points: number }>;

  boss?: IEventBoss;

  collectible?: {
    name: string;
    dropSources: string[];
    dropChance: number;
    setSize: number;
  };

  milestones?: Array<{
    label: string;
    target: number;
    action: string;
    rewardAll: { dc: number; nc: number; cosmeticId?: string; title?: string };
  }>;

  teams?: Array<{ id: string; name: string; color: string }>;

  pveNpcs?: IPveNpc[];

  lottery?: {
    ticketSource: string;
    ticketsPerAction: number;
    winnersCount: number;
  };

  leaderboardRewards: ILeaderboardReward[];
  oneTimeRewards: IOneTimeReward[];

  archive?: {
    finalLeaderboard: Array<{ rank: number; userId: string; username: string; points: number }>;
    bossKilled: boolean;
    bossKilledAt?: Date;
    milestoneReached?: number;
    totalParticipants: number;
    totalDamageDealt?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const EventPhaseSchema = new Schema<IEventPhase>({
  name:                { type: String, required: true },
  triggerAtHpPercent:  { type: Number, required: true },
  description:         { type: String, default: "" },
  abilityEffect:       { type: String },
}, { _id: false });

const EventBossSchema = new Schema<IEventBoss>({
  name:                    { type: String, required: true },
  imageUrl:                { type: String, default: "" },
  totalHp:                 { type: Number, required: true },
  currentHp:               { type: Number, required: true },
  phases:                  [EventPhaseSchema],
  strikeEnergyCost:        { type: Number, default: 5 },
  strikeCooldownSeconds:   { type: Number, default: 30 },
  strikeBaseDamage:        { min: { type: Number, default: 100 }, max: { type: Number, default: 500 } },
  bossRetaliationDamage:   { min: { type: Number, default: 0 }, max: { type: Number, default: 0 } },
}, { _id: false });

const EventThemeSchema = new Schema<IEventTheme>({
  gameDisplayName: { type: String, default: "Neonoir" },
  primaryColor:    { type: String, default: "#00E0FF" },
  accentColor:     { type: String, default: "#FF2D55" },
  backgroundColor: { type: String, default: "#070710" },
  bannerImageUrl:  { type: String, default: "" },
  chatBadgeText:   { type: String, default: "" },
  chatBadgeColor:  { type: String, default: "#00E0FF" },
}, { _id: false });

const EventSchema = new Schema<IEvent>({
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true },
  type:        { type: String, enum: ["boss_raid", "leaderboard_grind", "collection_hunt", "milestone", "sports", "lottery"], required: true },
  description: { type: String, default: "" },
  status:      { type: String, enum: ["draft", "scheduled", "active", "ended", "archived"], default: "draft" },

  startsAt:     { type: Date, required: true },
  endsAt:       { type: Date, required: true },
  createdBy:    { type: String, required: true },
  lastEditedAt: { type: Date, default: Date.now },

  theme: { type: EventThemeSchema, default: {} },

  pointSources: [{
    action: { type: String, required: true },
    points: { type: Number, required: true },
    _id: false,
  }],

  boss:        { type: EventBossSchema },
  collectible: {
    name:        { type: String },
    dropSources: [{ type: String }],
    dropChance:  { type: Number, default: 0.1 },
    setSize:     { type: Number, default: 5 },
  },
  milestones: [{
    label:  { type: String, required: true },
    target: { type: Number, required: true },
    action: { type: String, required: true },
    rewardAll: {
      dc: { type: Number, default: 0 },
      nc: { type: Number, default: 0 },
      cosmeticId: { type: String },
      title: { type: String },
    },
  }],
  teams: [{
    id:    { type: String, required: true },
    name:  { type: String, required: true },
    color: { type: String, default: "#00E0FF" },
  }],
  pveNpcs: [{
    tier:   { type: String, enum: ["minion", "lieutenant", "boss", "final"], required: true },
    name:   { type: String, required: true },
    stats: {
      hp:      { type: Number, default: 500 },
      attack:  { type: Number, default: 50 },
      defense: { type: Number, default: 20 },
    },
    eventPoints: { type: Number, default: 50 },
    loot: {
      dc:     { type: Number },
      itemId: { type: String },
      label:  { type: String },
    },
  }],
  lottery: {
    ticketSource:     { type: String },
    ticketsPerAction: { type: Number, default: 1 },
    winnersCount:     { type: Number, default: 1 },
  },

  leaderboardRewards: [{
    rankFrom: { type: Number, required: true },
    rankTo:   { type: Number, required: true },
    reward: {
      dc: { type: Number, default: 0 },
      nc: { type: Number, default: 0 },
      cosmetics: [{
        id:          { type: String, required: true },
        durationDays: { type: Number, default: 0 },
        _id: false,
      }],
      titles: [{ type: String }],
      eventPoints: { type: Number },
    },
    _id: false,
  }],

  oneTimeRewards: [{
    id:    { type: String, required: true },
    label: { type: String, required: true },
    condition: {
      type:  { type: String, required: true },
      value: { type: Number, required: true },
    },
    reward: {
      dc: { type: Number, default: 0 },
      nc: { type: Number, default: 0 },
      cosmetics: [{
        id:          { type: String, required: true },
        durationDays: { type: Number, default: 0 },
        _id: false,
      }],
      titles: [{ type: String }],
    },
    claimLimit: { type: String, enum: ["once_per_player", "once_per_event"], default: "once_per_player" },
  }],

  archive: {
    finalLeaderboard: [{
      rank: Number, userId: String, username: String, points: Number,
      _id: false,
    }],
    bossKilled:        { type: Boolean, default: false },
    bossKilledAt:      { type: Date },
    milestoneReached:  { type: Number },
    totalParticipants: { type: Number, default: 0 },
    totalDamageDealt:  { type: Number, default: 0 },
  },
}, { timestamps: true });

EventSchema.index({ status: 1, startsAt: 1 });
EventSchema.index({ status: 1, endsAt:   1 });

export default mongoose.model<IEvent>("Event", EventSchema);
