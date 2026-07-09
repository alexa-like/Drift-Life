import mongoose, { Document, Schema } from "mongoose";

export interface IGameEmoji extends Document {
  slug: string;
  displayName: string;
  emoji: string;       // native emoji char used as placeholder graphic
  theme: "action" | "economy" | "urban" | "tech";
}

const GameEmojiSchema = new Schema<IGameEmoji>(
  {
    slug:        { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true },
    emoji:       { type: String, required: true },
    theme:       { type: String, enum: ["action", "economy", "urban", "tech"], required: true },
  },
  { timestamps: false },
);

export default mongoose.model<IGameEmoji>("GameEmoji", GameEmojiSchema);

// ── Static catalog (also used in seed) ───────────────────────────────────────
export const EMOJI_CATALOG: Omit<IGameEmoji, keyof Document>[] = [
  // action
  { slug: "driftcar",      displayName: "Drift Car",      emoji: "🚗", theme: "action" },
  { slug: "swordclash",    displayName: "Sword Clash",    emoji: "⚔️", theme: "action" },
  { slug: "stimshot",      displayName: "Stim Shot",      emoji: "💉", theme: "action" },
  { slug: "nitroflame",    displayName: "Nitro Flame",    emoji: "🔥", theme: "action" },
  { slug: "smokepistol",   displayName: "Smoke Pistol",   emoji: "🔫", theme: "action" },
  { slug: "barriershield", displayName: "Barrier Shield", emoji: "🛡️", theme: "action" },
  // economy
  { slug: "goldtrophy",    displayName: "Gold Trophy",    emoji: "🏆", theme: "economy" },
  { slug: "cashspill",     displayName: "Cash Spill",     emoji: "💰", theme: "economy" },
  { slug: "jackpot",       displayName: "Jackpot",        emoji: "🎰", theme: "economy" },
  // urban
  { slug: "neonskull",     displayName: "Neon Skull",     emoji: "💀", theme: "urban" },
  { slug: "voltbolt",      displayName: "Volt Bolt",      emoji: "⚡", theme: "urban" },
  { slug: "neoncity",      displayName: "Neon City",      emoji: "🏙️", theme: "urban" },
  { slug: "chainlock",     displayName: "Chain Lock",     emoji: "🔗", theme: "urban" },
  // tech
  { slug: "medcross",      displayName: "Med Cross",      emoji: "➕", theme: "tech" },
  { slug: "cybereye",      displayName: "Cyber Eye",      emoji: "👁️", theme: "tech" },
  { slug: "botscan",       displayName: "Bot Scan",       emoji: "🤖", theme: "tech" },
];
