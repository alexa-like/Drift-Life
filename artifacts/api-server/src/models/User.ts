import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  avatar: string;
  level: number;
  xp: number;
  xpToNext: number;
  dc: number;
  credits: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  nerve: number;
  maxNerve: number;
  strength: number;
  defense: number;
  speed: number;
  stealth: number;
  district: string;
  job: string | null;
  rank: string;
  wantedLevel: number;
  totalCrimes: number;
  successfulCrimes: number;
  totalFights: number;
  wins: number;
  losses: number;
  hospitalizedUntil: Date | null;
  jailUntil: Date | null;
  lastLogin: Date;
  lastEnergyRegen: Date;
  lastNerveRegen: Date;
  lastDailyReward: Date | null;
  dailyStreak: number;
  telegramId: string | null;
  isEmailVerified: boolean;
  emailOtp: string | null;
  emailOtpExpiry: Date | null;
  role: "player" | "admin" | "owner";
  banned: boolean;
  banReason: string | null;
  inventory: mongoose.Types.ObjectId[];
  equippedWeapon: mongoose.Types.ObjectId | null;
  equippedArmor: mongoose.Types.ObjectId | null;
  bankBalance: number;
  gang: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: "ghost" },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0 },
    xpToNext: { type: Number, default: 100 },
    dc: { type: Number, default: 500 },
    credits: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    energy: { type: Number, default: 100 },
    maxEnergy: { type: Number, default: 100 },
    nerve: { type: Number, default: 50 },
    maxNerve: { type: Number, default: 50 },
    strength: { type: Number, default: 10 },
    defense: { type: Number, default: 10 },
    speed: { type: Number, default: 10 },
    stealth: { type: Number, default: 10 },
    district: { type: String, default: "neon-bazaar" },
    job: { type: String, default: null },
    rank: { type: String, default: "Street Rat" },
    wantedLevel: { type: Number, default: 0, min: 0, max: 5 },
    totalCrimes: { type: Number, default: 0 },
    successfulCrimes: { type: Number, default: 0 },
    totalFights: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    hospitalizedUntil: { type: Date, default: null },
    jailUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: Date.now },
    lastEnergyRegen: { type: Date, default: Date.now },
    lastNerveRegen: { type: Date, default: Date.now },
    lastDailyReward: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
    telegramId: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, default: null },
    emailOtpExpiry: { type: Date, default: null },
    role: { type: String, enum: ["player", "admin", "owner"], default: "player" },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    inventory: [{ type: Schema.Types.ObjectId, ref: "Item" }],
    equippedWeapon: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedArmor: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    bankBalance: { type: Number, default: 0 },
    gang: { type: String, default: null },
  },
  { timestamps: true }
);

export const xpForLevel = (level: number) => Math.floor(100 * Math.pow(1.5, level - 1));

export default mongoose.model<IUser>("User", UserSchema);
