import mongoose, { Document, Schema } from "mongoose";

export type BusinessType =
  | "chop_shop"
  | "data_broker"
  | "street_pharmacy"
  | "fixer_office"
  | "combat_gym";

export interface IBusinessEmployee {
  userId:      mongoose.Types.ObjectId;
  hiredAt:     Date;
  lastShiftAt: Date | null;
  totalShifts: number;
  totalEarned: number;  // DC earned across all shifts
  status:      "active" | "fired" | "resigned";
}

export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId:    mongoose.Types.ObjectId;
  name:       string;
  type:       BusinessType;
  starLevel:  number;    // 1–10, upgraded with DC
  isOpen:     boolean;
  wagePerShift: number;  // DC paid to employee per shift (set by owner)
  maxEmployees: number;  // base 5, +2 per star above 1
  employees:  IBusinessEmployee[];
  accumulatedIncome: number;  // passive income waiting to be collected
  lastIncomeAt: Date | null;
  totalEverEarned: number;
  description: string;
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
    status:      { type: String, enum: ["active","fired","resigned"], default: "active" },
  },
  { _id: false }
);

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:        { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    type:        { type: String, enum: ["chop_shop","data_broker","street_pharmacy","fixer_office","combat_gym"], required: true },
    starLevel:   { type: Number, default: 1, min: 1, max: 10 },
    isOpen:      { type: Boolean, default: true },
    wagePerShift:{ type: Number, default: 500, min: 100, max: 50_000 },
    maxEmployees:{ type: Number, default: 5 },
    employees:   { type: [EmployeeSchema], default: [] },
    accumulatedIncome: { type: Number, default: 0 },
    lastIncomeAt: { type: Date, default: null },
    totalEverEarned: { type: Number, default: 0 },
    description: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

BusinessSchema.index({ ownerId: 1 });
BusinessSchema.index({ type: 1, isOpen: 1 });

export default mongoose.model<IBusiness>("Business", BusinessSchema);

// ── Business definitions ─────────────────────────────────────────────────────
export const BUSINESS_DEFS: Record<BusinessType, {
  label: string;
  icon: string;
  description: string;
  employeeBonus: string;  // displayed benefit for workers
  ownerBaseIncome: number;  // DC/hour at star 1 per active employee
  shiftEnergyCost: number;
  shiftCooldownMin: number;
  perk3star: string;
  perk10star: string;
  upgradeCost: (star: number) => number;  // cost to go from star → star+1
}> = {
  chop_shop: {
    label: "Chop Shop",
    icon: "🔧",
    description: "Strip stolen rides for parts. Mess is the method.",
    employeeBonus: "Crime cooldowns -10%",
    ownerBaseIncome: 400,
    shiftEnergyCost: 3,
    shiftCooldownMin: 30,
    perk3star:  "Crime cooldowns -10% for all employees",
    perk10star: "Stolen car crimes give +500 DC bonus per employee",
    upgradeCost: (s) => 25_000 * Math.pow(2, s - 1),
  },
  data_broker: {
    label: "Data Broker",
    icon: "💾",
    description: "Move information for those who can afford it. Data is the new drug.",
    employeeBonus: "Hacking cooldown -15%",
    ownerBaseIncome: 500,
    shiftEnergyCost: 3,
    shiftCooldownMin: 30,
    perk3star:  "Hacking cooldown -15% for all employees",
    perk10star: "Net passive income +25% for all employees",
    upgradeCost: (s) => 30_000 * Math.pow(2, s - 1),
  },
  street_pharmacy: {
    label: "Street Pharmacy",
    icon: "💊",
    description: "Supply what the city craves. Keep the product moving.",
    employeeBonus: "+5 max nerve",
    ownerBaseIncome: 450,
    shiftEnergyCost: 2,
    shiftCooldownMin: 25,
    perk3star:  "+5 max nerve for all employees",
    perk10star: "Free nerve restore once per day for all employees",
    upgradeCost: (s) => 20_000 * Math.pow(2, s - 1),
  },
  fixer_office: {
    label: "Fixer Office",
    icon: "🤝",
    description: "Connect runners with jobs. You're the middle man — the most dangerous position.",
    employeeBonus: "Job DC rewards +10%",
    ownerBaseIncome: 600,
    shiftEnergyCost: 2,
    shiftCooldownMin: 20,
    perk3star:  "Job energy cost -1 for all employees",
    perk10star: "Job DC rewards +20% for all employees",
    upgradeCost: (s) => 35_000 * Math.pow(2, s - 1),
  },
  combat_gym: {
    label: "Combat Gym",
    icon: "🥊",
    description: "Train fighters. Build weapons out of people.",
    employeeBonus: "Gym stat gains +10%",
    ownerBaseIncome: 350,
    shiftEnergyCost: 4,
    shiftCooldownMin: 40,
    perk3star:  "Gym stat gains +10% for all employees",
    perk10star: "+1 max adrenaline for all employees",
    upgradeCost: (s) => 20_000 * Math.pow(2, s - 1),
  },
};

export const BUSINESS_CREATE_COST = 100_000;
export const BUSINESS_CREATE_LEVEL = 20;
