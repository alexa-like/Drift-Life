import mongoose, { Document, Schema } from "mongoose";

export type PropertyType = "apartment" | "safehouse" | "warehouse" | "nightclub" | "casino";

export interface IProperty extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  type: PropertyType;
  name: string;
  upgradeLevel: number;
  lastCollectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const PROPERTY_CATALOG: Record<PropertyType, {
  name: string;
  cost: number;
  baseIncome: number;
  description: string;
  minLevel: number;
  storageSlots: number;
}> = {
  apartment: {
    name: "Small Apartment",
    cost: 50_000,
    baseIncome: 100,
    description: "A small unit in Residential North. Nothing fancy, but it pays the rent.",
    minLevel: 1,
    storageSlots: 5,
  },
  safehouse: {
    name: "Safehouse",
    cost: 250_000,
    baseIncome: 500,
    description: "An off-grid property used by runners. Comes with extra storage.",
    minLevel: 10,
    storageSlots: 10,
  },
  warehouse: {
    name: "Warehouse",
    cost: 1_000_000,
    baseIncome: 2_000,
    description: "An Industrial East warehouse. Good for moving product and storing gear.",
    minLevel: 20,
    storageSlots: 25,
  },
  nightclub: {
    name: "Nightclub",
    cost: 5_000_000,
    baseIncome: 10_000,
    description: "A Boulevard institution. Packed every night. DC flows like synth-wine.",
    minLevel: 35,
    storageSlots: 15,
  },
  casino: {
    name: "Casino",
    cost: 10_000_000,
    baseIncome: 20_000,
    description: "The house always wins. Now you are the house.",
    minLevel: 50,
    storageSlots: 20,
  },
};

const PropertySchema = new Schema<IProperty>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["apartment", "safehouse", "warehouse", "nightclub", "casino"], required: true },
    name: { type: String, required: true },
    upgradeLevel: { type: Number, default: 0, min: 0, max: 5 },
    lastCollectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PropertySchema.index({ ownerId: 1 });

export function calcPropertyIncome(type: PropertyType, upgradeLevel: number, lastCollectedAt: Date): number {
  const catalog = PROPERTY_CATALOG[type];
  const hoursElapsed = Math.min(168, (Date.now() - lastCollectedAt.getTime()) / 3_600_000);
  return Math.floor(hoursElapsed * catalog.baseIncome * (1 + upgradeLevel * 0.2));
}

export function upgradeCost(type: PropertyType, currentLevel: number): number {
  const base = PROPERTY_CATALOG[type].cost;
  return Math.floor(base * 0.3 * (currentLevel + 1));
}

export default mongoose.model<IProperty>("Property", PropertySchema);
