import mongoose, { Document, Schema } from "mongoose";

export type BusinessType =
  | "chop_shop"
  | "data_broker"
  | "street_pharmacy"
  | "fixer_office"
  | "combat_gym";

/**
 * Job positions — Neonoir-themed labels displayed in UI,
 * but enum values stay lowercase for backward compatibility.
 *
 * runner     → the default street-level worker
 * lieutenant → boosts effectiveness (like Torn's Manager)
 * ghost      → boosts environment (like Torn's Cleaner)
 * handler    → generates daily intel reports + secures perks (like Torn's Secretary)
 * marketer   → amplifies advertising campaigns (like Torn's Marketer)
 */
export type JobPosition =
  | "runner"
  | "lieutenant"
  | "ghost"
  | "handler"
  | "marketer";

/** Display label for each position */
export const JOB_POSITION_LABELS: Record<JobPosition, string> = {
  runner:     "Runner",
  lieutenant: "Lieutenant",
  ghost:      "Ghost",
  handler:    "Handler",
  marketer:   "Marketer",
};

/** Neon icon for each position */
export const JOB_POSITION_ICONS: Record<JobPosition, string> = {
  runner:     "🔩",
  lieutenant: "🎖️",
  ghost:      "👻",
  handler:    "🗂️",
  marketer:   "📡",
};

/** Colour accent hex for each position */
export const JOB_POSITION_COLORS: Record<JobPosition, string> = {
  runner:     "#64748b",
  lieutenant: "#00d4ff",
  ghost:      "#39d353",
  handler:    "#a855f7",
  marketer:   "#f59e0b",
};

/** Max count of each special position per business */
export const JOB_POSITION_LIMITS: Record<JobPosition, number> = {
  runner:     Infinity,
  lieutenant: 2,
  ghost:      2,
  handler:    1,
  marketer:   2,
};

export interface IBusinessEmployee {
  userId:      mongoose.Types.ObjectId;
  hiredAt:     Date;
  lastShiftAt: Date | null;
  totalShifts: number;
  totalEarned: number;   // DC earned across all shifts
  jobPoints:   number;   // cumulative points for perk unlocking
  status:      "active" | "fired" | "resigned" | "pending";
  jobPosition: JobPosition;
}

export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId:    mongoose.Types.ObjectId;
  name:       string;
  type:       BusinessType;
  starLevel:  number;      // 1–10, upgraded with DC
  isOpen:     boolean;
  wagePerShift: number;    // DC paid per shift (set by owner)
  maxEmployees: number;    // base 5, +2 per star above 1
  employees:  IBusinessEmployee[];
  accumulatedIncome: number;
  lastIncomeAt: Date | null;
  lastDailyReportAt: Date | null;  // when secretary last generated a report
  totalEverEarned: number;
  description: string;
  /** 0–100: % of crew who worked within 3× shift cooldown */
  effectiveness: number;
  /** 0–100: ad-driven reputation; decays ~3 pts/hr */
  popularity: number;
  /** 0–100: workplace quality; affects income by up to ±33% */
  environment: number;
  /** When the owner last ran an advertising campaign */
  lastAdvertAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IBusinessEmployee>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    hiredAt:     { type: Date, default: Date.now },
    lastShiftAt: { type: Date, default: null },
    totalShifts: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    jobPoints:   { type: Number, default: 0 },
    status:      {
      type:    String,
      enum:    ["active", "fired", "resigned", "pending"],
      default: "pending",
    },
    jobPosition: {
      type:    String,
      enum:    ["runner", "lieutenant", "ghost", "handler", "marketer", "production", "manager", "cleaner", "secretary"],
      default: "runner",
    },
  },
  { _id: false }
);

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:        { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    type:        {
      type:     String,
      enum:     ["chop_shop", "data_broker", "street_pharmacy", "fixer_office", "combat_gym"],
      required: true,
    },
    starLevel:   { type: Number, default: 1, min: 1, max: 10 },
    isOpen:      { type: Boolean, default: true },
    wagePerShift:{ type: Number, default: 500, min: 100, max: 50_000 },
    maxEmployees:{ type: Number, default: 5 },
    employees:   { type: [EmployeeSchema], default: [] },
    accumulatedIncome:   { type: Number, default: 0 },
    lastIncomeAt:        { type: Date, default: null },
    lastDailyReportAt:   { type: Date, default: null },
    totalEverEarned:     { type: Number, default: 0 },
    description:         { type: String, default: "", maxlength: 200 },
    effectiveness:       { type: Number, default: 100, min: 0, max: 100 },
    popularity:          { type: Number, default: 50,  min: 0, max: 100 },
    environment:         { type: Number, default: 100, min: 0, max: 100 },
    lastAdvertAt:        { type: Date, default: null },
  },
  { timestamps: true }
);

BusinessSchema.index({ ownerId: 1 });
BusinessSchema.index({ type: 1, isOpen: 1 });
BusinessSchema.index({ "employees.userId": 1, "employees.status": 1 });

export default mongoose.model<IBusiness>("Business", BusinessSchema);

// ── Business definitions (Neonoir-themed) ────────────────────────────────────
export const BUSINESS_DEFS: Record<BusinessType, {
  label: string;
  icon: string;
  description: string;
  employeeBonus: string;
  ownerBaseIncome: number;  // DC/hour at star 1 per active employee
  shiftEnergyCost: number;
  shiftCooldownMin: number;
  /** Stat category that boosts runner effectiveness for this business type */
  primaryStat: "strength" | "intelligence" | "stealth" | "charisma";
  perk3star:  string;
  perk5star:  string;
  perk7star:  string;
  perk10star: string;
  upgradeCost: (star: number) => number;
}> = {
  chop_shop: {
    label:           "Chop Shop",
    icon:            "🔧",
    description:     "Strip stolen rides for parts. The city runs on recycled metal.",
    employeeBonus:   "Crime cooldowns −10%",
    ownerBaseIncome: 400,
    shiftEnergyCost: 3,
    shiftCooldownMin: 30,
    primaryStat:     "strength",
    perk3star:  "Crime cooldowns −10% for all crew",
    perk5star:  "Chop income +15% during night hours",
    perk7star:  "Stolen car crimes give +200 DC bonus per active Runner",
    perk10star: "Stolen car crimes give +500 DC bonus per active Runner · empire badge",
    upgradeCost: (s) => 25_000 * Math.pow(2, s - 1),
  },
  data_broker: {
    label:           "Data Broker",
    icon:            "💾",
    description:     "Move information for those who can afford it. Data is the new drug.",
    employeeBonus:   "Hacking cooldown −15%",
    ownerBaseIncome: 500,
    shiftEnergyCost: 3,
    shiftCooldownMin: 30,
    primaryStat:     "intelligence",
    perk3star:  "Hacking cooldown −15% for all crew",
    perk5star:  "Net passive income +10% for all crew",
    perk7star:  "Data heist success chance +5% for all crew",
    perk10star: "Net passive income +25% for all crew · empire badge",
    upgradeCost: (s) => 30_000 * Math.pow(2, s - 1),
  },
  street_pharmacy: {
    label:           "Street Pharmacy",
    icon:            "💊",
    description:     "Supply what the city craves. Keep the product moving.",
    employeeBonus:   "+5 max nerve",
    ownerBaseIncome: 450,
    shiftEnergyCost: 2,
    shiftCooldownMin: 25,
    primaryStat:     "stealth",
    perk3star:  "+5 max nerve for all crew",
    perk5star:  "Nerve restores 10% faster for all crew",
    perk7star:  "Free low-grade stim once per day for all crew",
    perk10star: "Free nerve restore once per day for all crew · empire badge",
    upgradeCost: (s) => 20_000 * Math.pow(2, s - 1),
  },
  fixer_office: {
    label:           "Fixer Office",
    icon:            "🤝",
    description:     "Connect runners with contracts. You are the dangerous middle.",
    employeeBonus:   "Job DC rewards +10%",
    ownerBaseIncome: 600,
    shiftEnergyCost: 2,
    shiftCooldownMin: 20,
    primaryStat:     "charisma",
    perk3star:  "Job energy cost −1 for all crew",
    perk5star:  "Contract success XP +10% for all crew",
    perk7star:  "Job DC rewards +15% for all crew",
    perk10star: "Job DC rewards +20% for all crew · empire badge",
    upgradeCost: (s) => 35_000 * Math.pow(2, s - 1),
  },
  combat_gym: {
    label:           "Combat Gym",
    icon:            "🥊",
    description:     "Train fighters. Build weapons out of people.",
    employeeBonus:   "Gym stat gains +10%",
    ownerBaseIncome: 350,
    shiftEnergyCost: 4,
    shiftCooldownMin: 40,
    primaryStat:     "strength",
    perk3star:  "Gym stat gains +10% for all crew",
    perk5star:  "Combat XP +5% for all crew",
    perk7star:  "Adrenaline cap +1 for all crew",
    perk10star: "+1 max adrenaline for all crew · empire badge",
    upgradeCost: (s) => 20_000 * Math.pow(2, s - 1),
  },
};

export const BUSINESS_CREATE_COST  = 100_000;
export const BUSINESS_CREATE_LEVEL = 20;
