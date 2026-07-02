import mongoose, { Document, Schema } from "mongoose";

export type CarPartType = "turbo_kit" | "sport_suspension" | "racing_slicks" | "nos_canister" | "intercooler" | "wide_body" | "roll_cage" | "nitrous";
export type PartQuality = "common" | "rare" | "legendary";

export interface ICarPart {
  partId: string;
  type: CarPartType;
  quality: PartQuality;
  statAffected: "power" | "handling" | "grip" | "nitro" | "durability";
  bonus: number;
  installedAt: Date;
}

export interface IBuildEntry {
  stat: "power" | "handling" | "grip" | "nitro" | "durability";
  gain: number;
  energyCost: number;
  cashCost: number;
  at: Date;
}

export interface ICar extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  make: string;
  carModel: string;
  year: number;
  // Core tunable stats
  power: number;
  handling: number;
  grip: number;
  nitro: number;
  durability: number;
  maxDurability: number;
  // Cosmetics
  paintId: string;
  decalIds: string[];
  stance: string;
  plateText: string;
  vin: string;
  // Parts
  parts: ICarPart[];
  buildHistory: IBuildEntry[];
  // Status
  impoundedUntil: Date | null;
  isStolen: boolean;
  // Race record
  raceWins: number;
  raceLosses: number;
  pinkSlipWins: number;
  createdAt: Date;
  updatedAt: Date;
}

const CarPartSchema = new Schema<ICarPart>({
  partId:       { type: String, required: true },
  type:         { type: String, required: true },
  quality:      { type: String, enum: ["common", "rare", "legendary"], default: "common" },
  statAffected: { type: String, required: true },
  bonus:        { type: Number, default: 0 },
  installedAt:  { type: Date, default: Date.now },
}, { _id: false });

const BuildEntrySchema = new Schema<IBuildEntry>({
  stat:        { type: String, required: true },
  gain:        { type: Number, required: true },
  energyCost:  { type: Number, default: 0 },
  cashCost:    { type: Number, default: 0 },
  at:          { type: Date, default: Date.now },
}, { _id: false });

const CarSchema = new Schema<ICar>(
  {
    ownerId:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:          { type: String, required: true, maxlength: 40 },
    make:          { type: String, default: "Unknown" },
    carModel:      { type: String, default: "Unknown" },
    year:          { type: Number, default: 2040 },
    power:         { type: Number, default: 10, min: 0 },
    handling:      { type: Number, default: 10, min: 0 },
    grip:          { type: Number, default: 10, min: 0 },
    nitro:         { type: Number, default: 0, min: 0 },
    durability:    { type: Number, default: 100, min: 0 },
    maxDurability: { type: Number, default: 100 },
    paintId:       { type: String, default: "stock_silver" },
    decalIds:      [{ type: String }],
    stance:        { type: String, default: "stock" },
    plateText:     { type: String, default: "", maxlength: 8 },
    vin:           { type: String, unique: true, sparse: true },
    parts:         [CarPartSchema],
    buildHistory:  [BuildEntrySchema],
    impoundedUntil:{ type: Date, default: null },
    isStolen:      { type: Boolean, default: false },
    raceWins:      { type: Number, default: 0 },
    raceLosses:    { type: Number, default: 0 },
    pinkSlipWins:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

CarSchema.index({ ownerId: 1 });

/**
 * Diminishing-returns tuning gain formula.
 * gain = (energySpent * baseTuneRate * qualityMultiplier) / (1 + currentStat/25)^1.5
 */
export function tuningStat(
  energySpent: number,
  currentStat: number,
  quality: PartQuality = "common"
): number {
  const BASE_TUNE_RATE = 0.5;
  const QUALITY_MULT: Record<PartQuality, number> = { common: 1, rare: 1.5, legendary: 2.2 };
  const mult = QUALITY_MULT[quality];
  const denom = Math.pow(1 + currentStat / 25, 1.5);
  return (energySpent * BASE_TUNE_RATE * mult) / denom;
}

/** Generate a random VIN */
export function generateVin(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  return Array.from({ length: 17 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default mongoose.model<ICar>("Car", CarSchema);
