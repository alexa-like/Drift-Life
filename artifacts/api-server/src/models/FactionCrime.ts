import mongoose, { Document, Schema } from "mongoose";

export type FactionCrimeType =
  | "midnight_carjacking"
  | "data_center_breach"
  | "protection_racket"
  | "syndicate_heist"
  | "corporate_blackmail";

export type FactionCrimeStatus = "gathering" | "in_progress" | "completed" | "failed";

export interface IFactionCrimeParticipant {
  userId:    mongoose.Types.ObjectId;
  committed: boolean;
  energyCost: number;
  dcShare:   number;
  xpShare:   number;
  respectShare: number;
}

export interface IFactionCrime extends Document {
  _id:          mongoose.Types.ObjectId;
  factionId:    mongoose.Types.ObjectId;
  crimeType:    FactionCrimeType;
  status:       FactionCrimeStatus;
  initiatorId:  mongoose.Types.ObjectId;
  participants: IFactionCrimeParticipant[];
  minMembers:   number;
  maxMembers:   number;
  durationMs:   number;
  startedAt:    Date | null;
  completedAt:  Date | null;
  totalPayout:  number;
  failureReason: string | null;
  createdAt:    Date;
  updatedAt:    Date;
}

const ParticipantSchema = new Schema<IFactionCrimeParticipant>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    committed:    { type: Boolean, default: false },
    energyCost:   { type: Number, required: true },
    dcShare:      { type: Number, default: 0 },
    xpShare:      { type: Number, default: 0 },
    respectShare: { type: Number, default: 0 },
  },
  { _id: false }
);

const FactionCrimeSchema = new Schema<IFactionCrime>(
  {
    factionId:    { type: Schema.Types.ObjectId, ref: "Faction", required: true },
    crimeType:    {
      type: String,
      enum: ["midnight_carjacking","data_center_breach","protection_racket","syndicate_heist","corporate_blackmail"],
      required: true,
    },
    status:       { type: String, enum: ["gathering","in_progress","completed","failed"], default: "gathering" },
    initiatorId:  { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: { type: [ParticipantSchema], default: [] },
    minMembers:   { type: Number, required: true },
    maxMembers:   { type: Number, required: true },
    durationMs:   { type: Number, required: true },
    startedAt:    { type: Date, default: null },
    completedAt:  { type: Date, default: null },
    totalPayout:  { type: Number, default: 0 },
    failureReason:{ type: String, default: null },
  },
  { timestamps: true }
);

FactionCrimeSchema.index({ factionId: 1, status: 1 });
FactionCrimeSchema.index({ completedAt: 1, status: 1 });

export default mongoose.model<IFactionCrime>("FactionCrime", FactionCrimeSchema);

// ── Crime definitions ─────────────────────────────────────────────────────────

export const FACTION_CRIME_DEFS: Record<FactionCrimeType, {
  label:        string;
  flavour:      string;
  minMembers:   number;
  maxMembers:   number;
  durationMs:   number;
  dcMin:        number;
  dcMax:        number;
  xpBase:       number;
  respectBase:  number;   // faction respect gained on success
  energyCost:   number;
  jailRisk:     number;   // 0–1 chance each participant gets jailed on failure
  minLevel:     number;   // minimum faction level required
}> = {
  midnight_carjacking: {
    label:       "Midnight Carjacking",
    flavour:     "Hit the parking garage on the Neon Strip. Fast in, fast out.",
    minMembers:  2, maxMembers: 3,
    durationMs:  20 * 60 * 1000,
    dcMin:       10_000, dcMax: 30_000,
    xpBase:      300,
    respectBase: 50,
    energyCost:  3,
    jailRisk:    0.25,
    minLevel:    1,
  },
  data_center_breach: {
    label:       "Data Center Breach",
    flavour:     "Infiltrate OmegaCorp servers. Extract the data, ghost out clean.",
    minMembers:  2, maxMembers: 4,
    durationMs:  45 * 60 * 1000,
    dcMin:       25_000, dcMax: 70_000,
    xpBase:      600,
    respectBase: 100,
    energyCost:  4,
    jailRisk:    0.20,
    minLevel:    2,
  },
  protection_racket: {
    label:       "Protection Racket",
    flavour:     "Tax every street operation in the district. Fear is the product.",
    minMembers:  3, maxMembers: 5,
    durationMs:  60 * 60 * 1000,
    dcMin:       40_000, dcMax: 100_000,
    xpBase:      900,
    respectBase: 175,
    energyCost:  5,
    jailRisk:    0.30,
    minLevel:    3,
  },
  syndicate_heist: {
    label:       "Syndicate Heist",
    flavour:     "Rob the Syndicate's weekly vault transfer. Maximum coordination required.",
    minMembers:  4, maxMembers: 6,
    durationMs:  90 * 60 * 1000,
    dcMin:       80_000, dcMax: 200_000,
    xpBase:      1_500,
    respectBase: 300,
    energyCost:  6,
    jailRisk:    0.40,
    minLevel:    5,
  },
  corporate_blackmail: {
    label:       "Corporate Blackmail",
    flavour:     "Leak damaging intel unless the corp pays. Long play, high stakes.",
    minMembers:  5, maxMembers: 6,
    durationMs:  120 * 60 * 1000,
    dcMin:       150_000, dcMax: 400_000,
    xpBase:      3_000,
    respectBase: 600,
    energyCost:  8,
    jailRisk:    0.50,
    minLevel:    8,
  },
};

// ── Faction upgrade definitions ───────────────────────────────────────────────

export interface IFactionUpgrade {
  id:           string;
  name:         string;
  description:  string;
  cost:         number;    // DC from treasury
  maxPurchases: number;
  requiredLevel: number;
  category:     "capacity" | "crime" | "training" | "intel";
  effect:       string;    // displayed effect text
}

export const FACTION_UPGRADES: IFactionUpgrade[] = [
  // ── Capacity ─────────────────────────────────────────────────────────────
  {
    id: "capacity_1", name: "Expand Roster I", category: "capacity",
    description: "Upgrade the hideout to accommodate more operatives.",
    effect: "+10 max members",
    cost: 500_000, maxPurchases: 1, requiredLevel: 1,
  },
  {
    id: "capacity_2", name: "Expand Roster II", category: "capacity",
    description: "Build additional wings. Room for a full squad.",
    effect: "+15 max members",
    cost: 2_000_000, maxPurchases: 1, requiredLevel: 3,
  },
  {
    id: "capacity_3", name: "Expand Roster III", category: "capacity",
    description: "The operation is growing. Build a compound.",
    effect: "+20 max members",
    cost: 5_000_000, maxPurchases: 1, requiredLevel: 6,
  },

  // ── Crime ─────────────────────────────────────────────────────────────────
  {
    id: "crime_payout_1", name: "Inside Contacts", category: "crime",
    description: "Better intel means bigger scores on every job.",
    effect: "OC payout +15%",
    cost: 750_000, maxPurchases: 1, requiredLevel: 2,
  },
  {
    id: "crime_payout_2", name: "Professional Network", category: "crime",
    description: "Your crew knows who to call. No money left on the table.",
    effect: "OC payout +30%",
    cost: 3_000_000, maxPurchases: 1, requiredLevel: 5,
  },
  {
    id: "crime_success_1", name: "Recon Unit", category: "crime",
    description: "Pre-job surveillance reduces the chance things go sideways.",
    effect: "OC fail rate -10%",
    cost: 1_000_000, maxPurchases: 1, requiredLevel: 3,
  },
  {
    id: "crime_cooldown_1", name: "Safe Houses", category: "crime",
    description: "Distributed safe houses cut down wait time between jobs.",
    effect: "OC cooldown -20%",
    cost: 2_500_000, maxPurchases: 1, requiredLevel: 5,
  },

  // ── Training ──────────────────────────────────────────────────────────────
  {
    id: "training_1", name: "Faction Trainer", category: "training",
    description: "A dedicated trainer pushes every member harder.",
    effect: "Gym gains +5% for all members",
    cost: 1_200_000, maxPurchases: 1, requiredLevel: 4,
  },
  {
    id: "training_2", name: "Elite Combat Program", category: "training",
    description: "Military-grade training regimen for the whole faction.",
    effect: "Gym gains +10% for all members",
    cost: 4_000_000, maxPurchases: 1, requiredLevel: 7,
  },

  // ── Intel ─────────────────────────────────────────────────────────────────
  {
    id: "intel_1", name: "Street Network", category: "intel",
    description: "Informants on every block. Nothing moves without you knowing.",
    effect: "Crime success rate +5% for all members",
    cost: 800_000, maxPurchases: 1, requiredLevel: 2,
  },
  {
    id: "intel_2", name: "Dark Web Access", category: "intel",
    description: "Access to premium hacking tools and intelligence feeds.",
    effect: "Hacking cooldown -10% for all members",
    cost: 2_000_000, maxPurchases: 1, requiredLevel: 5,
  },
];
