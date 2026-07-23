/**
 * CarPart — catalog of all car tuning parts.
 * Part DEFINITIONS, not player-owned instances.
 * Player parts are tracked in PlayerGarage.
 */
import mongoose, { Document, Schema } from "mongoose";

export type CarPartType = "engine" | "tires" | "nitro" | "bodyKit" | "spoiler";
export type CarPartTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface ICarPart extends Document {
  partId: string;        // unique slug, e.g. "v8_engine_rare"
  name: string;
  partType: CarPartType;
  tier: CarPartTier;
  statBoost: {
    topSpeed?: number;      // additive bonus to car base stat
    acceleration?: number;
    handling?: number;
    nitro?: number;
  };
  imageCard: string;
  flavorText: string;
  isActive: boolean;
}

const CarPartSchema = new Schema<ICarPart>(
  {
    partId:   { type: String, required: true, unique: true },
    name:     { type: String, required: true },
    partType: { type: String, enum: ["engine", "tires", "nitro", "bodyKit", "spoiler"], required: true },
    tier:     { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },
    statBoost: {
      topSpeed:     { type: Number, default: 0 },
      acceleration: { type: Number, default: 0 },
      handling:     { type: Number, default: 0 },
      nitro:        { type: Number, default: 0 },
    },
    imageCard:  { type: String, default: "/assets/parts/placeholder.webp" },
    flavorText: { type: String, default: "" },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true },
);

CarPartSchema.index({ partType: 1, tier: 1 });

export default mongoose.model<ICarPart>("CarPart", CarPartSchema);
