import mongoose, { Document, Schema } from "mongoose";

export type BusinessType = "laundromat" | "chop_shop" | "restaurant" | "nightclub" | "tech_firm" | "auto_shop";

export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  type: BusinessType;
  level: number;
  // Income accrues lazily (compute elapsed time on visit)
  dailyIncome: number;
  lastCollectedAt: Date;
  pendingIncome: number;    // accrued but uncollected (lazy)
  maxHolding: number;       // max income that can accumulate before collection required
  // Laundering
  launderCapacityPerDay: number;  // max dirty DC that can be laundered per day
  launderRate: number;            // loss rate: 0.3 at level 1, 0.10 at max
  launderCooldownHours: number;   // processing delay
  pendingLaunder: number;         // dirty DC queued for laundering
  launderStartedAt: Date | null;  // when current batch started
  launderCompletesAt: Date | null;
  launderedToday: number;         // how much laundered today (resets daily)
  launderResetAt: Date;
  // Upgrade
  upgradeCost: number;
  maxLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId:               { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:                  { type: String, required: true, maxlength: 40 },
    type:                  { type: String, enum: ["laundromat","chop_shop","restaurant","nightclub","tech_firm","auto_shop"], required: true },
    level:                 { type: Number, default: 1, min: 1 },
    dailyIncome:           { type: Number, default: 500 },
    lastCollectedAt:       { type: Date, default: Date.now },
    pendingIncome:         { type: Number, default: 0 },
    maxHolding:            { type: Number, default: 50_000 },
    launderCapacityPerDay: { type: Number, default: 10_000 },
    launderRate:           { type: Number, default: 0.30 },
    launderCooldownHours:  { type: Number, default: 4 },
    pendingLaunder:        { type: Number, default: 0 },
    launderStartedAt:      { type: Date, default: null },
    launderCompletesAt:    { type: Date, default: null },
    launderedToday:        { type: Number, default: 0 },
    launderResetAt:        { type: Date, default: Date.now },
    upgradeCost:           { type: Number, default: 25_000 },
    maxLevel:              { type: Number, default: 10 },
  },
  { timestamps: true }
);

BusinessSchema.index({ ownerId: 1 });

/** Returns accrued income since last collection, capped at maxHolding */
export function accruedIncome(biz: IBusiness): number {
  const now = Date.now();
  const elapsed = (now - biz.lastCollectedAt.getTime()) / (24 * 60 * 60 * 1000); // days
  const accrued = biz.pendingIncome + elapsed * biz.dailyIncome;
  return Math.min(biz.maxHolding, accrued);
}

/** Launder rate by level: 0.30 at lv1, 0.10 at max */
export function launderRateForLevel(level: number, maxLevel: number): number {
  const t = (level - 1) / Math.max(1, maxLevel - 1);
  return 0.30 - t * 0.20; // 0.30 → 0.10
}

/** Base stats per business type at level 1 */
export const BUSINESS_BLUEPRINTS: Record<BusinessType, {
  name: string; dailyIncome: number; launderCapacity: number; maxHolding: number; purchaseCost: number;
}> = {
  laundromat: { name: "Laundromat",     dailyIncome: 800,   launderCapacity: 15_000,  maxHolding: 40_000,    purchaseCost: 50_000 },
  chop_shop:  { name: "Chop Shop",      dailyIncome: 1_200, launderCapacity: 25_000,  maxHolding: 60_000,    purchaseCost: 80_000 },
  restaurant: { name: "Restaurant",     dailyIncome: 600,   launderCapacity: 8_000,   maxHolding: 30_000,    purchaseCost: 40_000 },
  nightclub:  { name: "Nightclub",      dailyIncome: 2_000, launderCapacity: 40_000,  maxHolding: 100_000,   purchaseCost: 150_000 },
  tech_firm:  { name: "Tech Firm",      dailyIncome: 3_000, launderCapacity: 60_000,  maxHolding: 200_000,   purchaseCost: 300_000 },
  auto_shop:  { name: "Auto Shop",      dailyIncome: 1_500, launderCapacity: 30_000,  maxHolding: 80_000,    purchaseCost: 100_000 },
};

export default mongoose.model<IBusiness>("Business", BusinessSchema);
