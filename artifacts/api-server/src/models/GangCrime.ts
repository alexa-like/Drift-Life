import mongoose, { Document, Schema } from "mongoose";

export type GangCrimeType =
  | "armored_car_heist"
  | "corporate_data_breach"
  | "district_shakedown"
  | "black_site_raid";

export type GangCrimeStatus = "gathering" | "in_progress" | "completed" | "failed";

export interface IGangCrimeParticipant {
  userId: mongoose.Types.ObjectId;
  committed: boolean;
  energyCost: number;
  dcShare: number;
  xpShare: number;
}

export interface IGangCrime extends Document {
  _id: mongoose.Types.ObjectId;
  guildId: mongoose.Types.ObjectId;
  crimeType: GangCrimeType;
  status: GangCrimeStatus;
  initiatorId: mongoose.Types.ObjectId;
  participants: IGangCrimeParticipant[];
  minMembers: number;
  maxMembers: number;
  durationMs: number;
  startedAt: Date | null;
  completedAt: Date | null;
  totalPayout: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IGangCrimeParticipant>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    committed:  { type: Boolean, default: false },
    energyCost: { type: Number, required: true },
    dcShare:    { type: Number, default: 0 },
    xpShare:    { type: Number, default: 0 },
  },
  { _id: false }
);

const GangCrimeSchema = new Schema<IGangCrime>(
  {
    guildId:       { type: Schema.Types.ObjectId, ref: "Guild", required: true },
    crimeType:     { type: String, enum: ["armored_car_heist","corporate_data_breach","district_shakedown","black_site_raid"], required: true },
    status:        { type: String, enum: ["gathering","in_progress","completed","failed"], default: "gathering" },
    initiatorId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants:  { type: [ParticipantSchema], default: [] },
    minMembers:    { type: Number, required: true },
    maxMembers:    { type: Number, required: true },
    durationMs:    { type: Number, required: true },
    startedAt:     { type: Date, default: null },
    completedAt:   { type: Date, default: null },
    totalPayout:   { type: Number, default: 0 },
    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

GangCrimeSchema.index({ guildId: 1, status: 1 });
GangCrimeSchema.index({ startedAt: 1, status: 1 });

export default mongoose.model<IGangCrime>("GangCrime", GangCrimeSchema);

// ── Crime definitions ────────────────────────────────────────────────────────
export const GANG_CRIME_DEFS: Record<GangCrimeType, {
  label: string;
  flavour: string;
  minMembers: number;
  maxMembers: number;
  durationMs: number;
  dcMin: number;
  dcMax: number;
  xpBase: number;
  energyCost: number;
  jailRisk: number;   // 0–1, chance each participant gets jailed on failure
  minGuildLevel: number;
}> = {
  armored_car_heist: {
    label: "Armored Car Heist",
    flavour: "Hit the convoy on the Neon Strip. Fast in, fast out.",
    minMembers: 2, maxMembers: 3,
    durationMs: 30 * 60 * 1000,
    dcMin: 15_000, dcMax: 40_000,
    xpBase: 500,
    energyCost: 4,
    jailRisk: 0.30,
    minGuildLevel: 1,
  },
  corporate_data_breach: {
    label: "Corporate Data Breach",
    flavour: "Infiltrate OmegaCorp servers. Extract the data, ghost out.",
    minMembers: 2, maxMembers: 4,
    durationMs: 45 * 60 * 1000,
    dcMin: 20_000, dcMax: 60_000,
    xpBase: 750,
    energyCost: 5,
    jailRisk: 0.25,
    minGuildLevel: 2,
  },
  district_shakedown: {
    label: "District Shakedown",
    flavour: "Tax every street operation in the district. Fear is the product.",
    minMembers: 3, maxMembers: 5,
    durationMs: 60 * 60 * 1000,
    dcMin: 30_000, dcMax: 80_000,
    xpBase: 1000,
    energyCost: 5,
    jailRisk: 0.35,
    minGuildLevel: 3,
  },
  black_site_raid: {
    label: "Black Site Raid",
    flavour: "Storm a government black site. Maximum risk, maximum reward.",
    minMembers: 4, maxMembers: 5,
    durationMs: 90 * 60 * 1000,
    dcMin: 50_000, dcMax: 150_000,
    xpBase: 2000,
    energyCost: 8,
    jailRisk: 0.50,
    minGuildLevel: 4,
  },
};
