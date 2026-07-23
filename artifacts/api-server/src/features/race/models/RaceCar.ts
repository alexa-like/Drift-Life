/**
 * RaceCar — catalog of all race cars.
 * These are car DEFINITIONS (the template), not player-owned instances.
 * Player garage is tracked in PlayerGarage.
 * Named RaceCar to avoid conflict with the old Car model (which stores world cars).
 */
import mongoose, { Document, Schema } from "mongoose";

export type RaceCarTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface IRaceCar extends Document {
  carId: string;          // unique slug, e.g. "cyberjet_legendary"
  name: string;
  tier: RaceCarTier;
  baseStats: {
    topSpeed: number;       // 0–100
    acceleration: number;   // 0–100
    handling: number;       // 0–100
    nitro: number;          // 0–100
  };
  imageCard: string;
  flavorText: string;
  isActive: boolean;
}

const RaceCarSchema = new Schema<IRaceCar>(
  {
    carId:     { type: String, required: true, unique: true },
    name:      { type: String, required: true },
    tier:      { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },
    baseStats: {
      topSpeed:     { type: Number, required: true, min: 0, max: 100 },
      acceleration: { type: Number, required: true, min: 0, max: 100 },
      handling:     { type: Number, required: true, min: 0, max: 100 },
      nitro:        { type: Number, required: true, min: 0, max: 100 },
    },
    imageCard:   { type: String, default: "/assets/cars/placeholder.webp" },
    flavorText:  { type: String, default: "" },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<IRaceCar>("RaceCar", RaceCarSchema);
