import mongoose, { Document, Schema } from "mongoose";

export type CompanionType = "driver" | "hacking_bot" | "guard_dog" | "lawyer" | "informant";

export interface ICompanion extends Document {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  type: CompanionType;
  name: string;
  level: number;
  upkeepPerDay: number;       // DC cost per day
  lastUpkeepAt: Date;
  isActive: boolean;
  skinId: string | null;
  // Effects per type
  raceTimingBonus: number;    // driver: forgiveness on timing window
  hackAutoCompleteLevel: number; // hacking_bot: auto-completes hacks up to this difficulty
  raiderReduction: number;    // guard_dog: % reduction in raid chance
  sentenceReduction: number;  // lawyer: % reduction in jail time
  createdAt: Date;
}

const CompanionSchema = new Schema<ICompanion>(
  {
    ownerId:               { type: Schema.Types.ObjectId, ref: "User", required: true },
    type:                  { type: String, enum: ["driver","hacking_bot","guard_dog","lawyer","informant"], required: true },
    name:                  { type: String, required: true },
    level:                 { type: Number, default: 1, min: 1 },
    upkeepPerDay:          { type: Number, default: 500 },
    lastUpkeepAt:          { type: Date, default: Date.now },
    isActive:              { type: Boolean, default: true },
    skinId:                { type: String, default: null },
    raceTimingBonus:       { type: Number, default: 0 },
    hackAutoCompleteLevel: { type: Number, default: 0 },
    raiderReduction:       { type: Number, default: 0 },
    sentenceReduction:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

CompanionSchema.index({ ownerId: 1 });

export const COMPANION_CATALOG: Record<CompanionType, {
  name: string; baseCost: number; upkeepPerDay: number; description: string;
  effect: string;
}> = {
  driver:       { name: "Street Driver",    baseCost: 25_000,  upkeepPerDay: 500,  description: "Increases race timing window forgiveness.", effect: "race_timing_bonus" },
  hacking_bot:  { name: "Hack Bot v1",      baseCost: 40_000,  upkeepPerDay: 800,  description: "Auto-completes low-tier Net puzzles at reduced reward.", effect: "hack_auto" },
  guard_dog:    { name: "Guard Dog",        baseCost: 20_000,  upkeepPerDay: 300,  description: "Reduces chance of being raided while offline.", effect: "raid_reduction" },
  lawyer:       { name: "Street Lawyer",    baseCost: 30_000,  upkeepPerDay: 600,  description: "Reduces jail sentence duration by 20%.", effect: "sentence_reduction" },
  informant:    { name: "Informant",        baseCost: 15_000,  upkeepPerDay: 400,  description: "Occasionally tips you off about rival crew moves.", effect: "intel" },
};

export default mongoose.model<ICompanion>("Companion", CompanionSchema);
