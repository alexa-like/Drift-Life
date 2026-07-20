import mongoose, { Document, Schema } from "mongoose";

export interface ICosmeticItem extends Document {
  id: string;           // slug e.g. "hero-gold"
  name: string;         // display name e.g. "Hero Gold"
  type: "name_flair" | "message_card";
  color: string;        // hex, for name_flair
  animation: "none" | "pulse" | "glow" | "rainbow" | "glitch" | "gradient";
  cssKey: string;       // CSS class key applied to username/card
  priceNC: number;      // 0 = not purchasable in store
  purchasable: boolean; // shows in cosmetics store
  eventRewardable: boolean; // can be given as event reward
  rarity: "common" | "rare" | "epic" | "legendary" | "event";
  previewDescription: string; // shown in store card
  seasonExclusive: boolean;   // if true: only obtainable during its specific season
}

const CosmeticItemSchema = new Schema<ICosmeticItem>({
  id:                 { type: String, required: true, unique: true },
  name:               { type: String, required: true },
  type:               { type: String, enum: ["name_flair", "message_card"], required: true },
  color:              { type: String, default: "" },
  animation:          { type: String, enum: ["none", "pulse", "glow", "rainbow", "glitch", "gradient"], default: "none" },
  cssKey:             { type: String, required: true },
  priceNC:            { type: Number, default: 0 },
  purchasable:        { type: Boolean, default: false },
  eventRewardable:    { type: Boolean, default: false },
  rarity:             { type: String, enum: ["common", "rare", "epic", "legendary", "event"], default: "common" },
  previewDescription: { type: String, default: "" },
  seasonExclusive:    { type: Boolean, default: false },
}, { timestamps: true });

export interface CosmeticSeed {
  id: string;
  name: string;
  type: "name_flair" | "message_card";
  color: string;
  animation: "none" | "pulse" | "glow" | "rainbow" | "glitch" | "gradient";
  cssKey: string;
  priceNC: number;
  purchasable: boolean;
  eventRewardable: boolean;
  rarity: "common" | "rare" | "epic" | "legendary" | "event";
  previewDescription: string;
  seasonExclusive: boolean;
}

export const INITIAL_COSMETIC_CATALOG: CosmeticSeed[] = [
  {
    id: "cyan-pulse",
    name: "Cyan Pulse",
    type: "name_flair",
    color: "#00E0FF",
    animation: "pulse",
    cssKey: "flair-pulse-cyan",
    priceNC: 400,
    purchasable: true,
    eventRewardable: false,
    rarity: "common",
    previewDescription: "A steady cyan heartbeat that pulses through your name.",
    seasonExclusive: false,
  },
  {
    id: "magenta-drift",
    name: "Magenta Drift",
    type: "name_flair",
    color: "#FF00CC",
    animation: "gradient",
    cssKey: "flair-gradient-magenta",
    priceNC: 800,
    purchasable: true,
    eventRewardable: false,
    rarity: "rare",
    previewDescription: "A sweeping magenta gradient that drifts across your name.",
    seasonExclusive: false,
  },
  {
    id: "glitch-flicker",
    name: "Glitch Flicker",
    type: "name_flair",
    color: "#FFFFFF",
    animation: "glitch",
    cssKey: "flair-glitch",
    priceNC: 1200,
    purchasable: true,
    eventRewardable: false,
    rarity: "epic",
    previewDescription: "Your name corrupts and glitches — signal lost.",
    seasonExclusive: false,
  },
  {
    id: "neon-green",
    name: "Neon Green",
    type: "name_flair",
    color: "#39FF14",
    animation: "glow",
    cssKey: "flair-glow-green",
    priceNC: 600,
    purchasable: true,
    eventRewardable: false,
    rarity: "rare",
    previewDescription: "Toxic neon green that bleeds light into the dark.",
    seasonExclusive: false,
  },
  {
    id: "default-card",
    name: "Default Card",
    type: "message_card",
    color: "",
    animation: "none",
    cssKey: "card-default",
    priceNC: 0,
    purchasable: false,
    eventRewardable: false,
    rarity: "common",
    previewDescription: "The standard chat card.",
    seasonExclusive: false,
  },
  {
    id: "subscriber-card",
    name: "Subscriber Card",
    type: "message_card",
    color: "#00E0FF",
    animation: "glow",
    cssKey: "card-subscriber",
    priceNC: 0,
    purchasable: false,
    eventRewardable: false,
    rarity: "rare",
    previewDescription: "A glowing cyan card for subscribers.",
    seasonExclusive: false,
  },
  {
    id: "event-card",
    name: "Event Card",
    type: "message_card",
    color: "#FFD700",
    animation: "pulse",
    cssKey: "card-event",
    priceNC: 0,
    purchasable: false,
    eventRewardable: true,
    rarity: "event",
    previewDescription: "Awarded during special events. A golden card for participants.",
    seasonExclusive: false,
  },
  {
    id: "staff-card",
    name: "Staff Card",
    type: "message_card",
    color: "#FF4444",
    animation: "none",
    cssKey: "card-staff",
    priceNC: 0,
    purchasable: false,
    eventRewardable: false,
    rarity: "legendary",
    previewDescription: "Staff and admin only. Commands respect.",
    seasonExclusive: false,
  },
];

export async function seedCosmeticItems(): Promise<void> {
  const CosmeticItem = mongoose.model<ICosmeticItem>("CosmeticItem", CosmeticItemSchema);
  const count = await CosmeticItem.countDocuments();
  if (count > 0) return;

  await CosmeticItem.insertMany(INITIAL_COSMETIC_CATALOG);
}

export default mongoose.model<ICosmeticItem>("CosmeticItem", CosmeticItemSchema);
