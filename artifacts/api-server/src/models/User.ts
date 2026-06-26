import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  tag: string;
  email: string;
  passwordHash: string;
  avatar: string;
  avatarUrl: string | null;
  bio: string;
  faction: "suits" | "street" | "grid" | null;
  level: number;
  xp: number;
  xpToNext: number;
  prestige: number;
  skillPoints: number;
  dc: number;
  nc: number;
  bankBalance: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  nerve: number;
  maxNerve: number;
  energyRegenAt: Date;
  nerveRegenAt: Date;
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
  district: string;
  job: string | null;
  rank: string;
  wantedLevel: number;
  wantedDecayAt: Date;
  totalCrimes: number;
  successfulCrimes: number;
  totalFights: number;
  wins: number;
  losses: number;
  attacksToday: number;
  attackResetAt: Date;
  attackCooldowns: Array<{ targetId: string; until: Date }>;
  hospitalizedUntil: Date | null;
  jailUntil: Date | null;
  lastLogin: Date;
  lastDailyReward: Date | null;
  dailyStreak: number;
  telegramId: string | null;
  isEmailVerified: boolean;
  emailOtp: string | null;
  emailOtpExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  role: "player" | "admin" | "owner";
  banned: boolean;
  banReason: string | null;
  mutedUntil: Date | null;
  devMode: boolean;
  equippedWeapon: mongoose.Types.ObjectId | null;
  equippedArmor: mongoose.Types.ObjectId | null;
  equippedClothing: mongoose.Types.ObjectId | null;
  equippedVehicle: mongoose.Types.ObjectId | null;
  equippedFrame: string | null;
  equippedTitle: string | null;
  titles: string[];
  gang: string | null;
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  jobCooldowns: Record<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    tag: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: "1" },
    avatarUrl: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 300 },
    faction: { type: String, enum: ["suits", "street", "grid", null], default: null },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0 },
    xpToNext: { type: Number, default: 500 },
    prestige: { type: Number, default: 0 },
    skillPoints: { type: Number, default: 0 },
    dc: { type: Number, default: 750 },
    nc: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    energy: { type: Number, default: 100 },
    maxEnergy: { type: Number, default: 100 },
    nerve: { type: Number, default: 50 },
    maxNerve: { type: Number, default: 50 },
    energyRegenAt: { type: Date, default: Date.now },
    nerveRegenAt: { type: Date, default: Date.now },
    strength: { type: Number, default: 10 },
    charisma: { type: Number, default: 5 },
    intelligence: { type: Number, default: 5 },
    streetCred: { type: Number, default: 0 },
    district: { type: String, default: "residential-north" },
    job: { type: String, default: null },
    rank: { type: String, default: "New in Town" },
    wantedLevel: { type: Number, default: 0, min: 0, max: 5 },
    wantedDecayAt: { type: Date, default: Date.now },
    totalCrimes: { type: Number, default: 0 },
    successfulCrimes: { type: Number, default: 0 },
    totalFights: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    attacksToday: { type: Number, default: 0 },
    attackResetAt: { type: Date, default: Date.now },
    attackCooldowns: [{ targetId: String, until: Date }],
    hospitalizedUntil: { type: Date, default: null },
    jailUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: Date.now },
    lastDailyReward: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
    telegramId: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, default: null },
    emailOtpExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    role: { type: String, enum: ["player", "admin", "owner"], default: "player" },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    mutedUntil: { type: Date, default: null },
    devMode: { type: Boolean, default: false },
    equippedWeapon: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedArmor: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedClothing: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedVehicle: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedFrame: { type: String, default: "ghostFrame" },
    equippedTitle: { type: String, default: "New in Town" },
    titles: [{ type: String }],
    gang: { type: String, default: null },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    jobCooldowns: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

export function xpForLevel(level: number): number {
  if (level <= 9) return 500 + (level - 1) * Math.floor(1500 / 8);
  if (level <= 24) return 3000 + (level - 10) * Math.floor(5000 / 14);
  if (level <= 49) return 10000 + (level - 25) * Math.floor(15000 / 24);
  if (level <= 74) return 30000 + (level - 50) * Math.floor(30000 / 24);
  return 75000 + (level - 75) * Math.floor(75000 / 24);
}

export function applyRegen(user: IUser): void {
  const now = Date.now();
  const energyMinutes = (now - user.energyRegenAt.getTime()) / 60000;
  const energyGain = Math.floor(energyMinutes * (1 / 3));
  if (energyGain > 0 && user.energy < user.maxEnergy) {
    user.energy = Math.min(user.maxEnergy, user.energy + energyGain);
    user.energyRegenAt = new Date(now);
  }
  const nerveMinutes = (now - user.nerveRegenAt.getTime()) / 60000;
  const nerveGain = Math.floor(nerveMinutes * (1 / 5));
  if (nerveGain > 0 && user.nerve < user.maxNerve) {
    user.nerve = Math.min(user.maxNerve, user.nerve + nerveGain);
    user.nerveRegenAt = new Date(now);
  }
  // Wanted level decay (1 star per 30 min inactivity)
  if (user.wantedLevel > 0) {
    const wantedMinutes = (now - user.wantedDecayAt.getTime()) / 60000;
    const decay = Math.floor(wantedMinutes / 30);
    if (decay > 0) {
      user.wantedLevel = Math.max(0, user.wantedLevel - decay);
      user.wantedDecayAt = new Date(now);
    }
  }
}

export function levelUp(user: IUser): boolean {
  let leveled = false;
  while (user.xp >= user.xpToNext) {
    user.xp -= user.xpToNext;
    user.level += 1;
    user.xpToNext = xpForLevel(user.level);
    user.maxHealth = Math.floor(100 + user.level * 5);
    user.maxEnergy = Math.min(200, Math.floor(100 + user.level * 0.5));
    user.maxNerve = Math.min(100, Math.floor(50 + user.level * 0.3));
    if (user.level >= 10 && (user.level - 10) % 5 === 0) user.skillPoints += 1;
    leveled = true;
  }
  if (leveled) {
    // Update rank
    if (user.level >= 50) user.rank = "Legend";
    else if (user.level >= 30) user.rank = "Ghost";
    else if (user.level >= 20) user.rank = "Enforcer";
    else if (user.level >= 10) user.rank = "Runner";
    else if (user.level >= 5) user.rank = "Drifter";
  }
  return leveled;
}

export function isHospitalized(user: IUser): boolean {
  return user.hospitalizedUntil !== null && user.hospitalizedUntil > new Date();
}

export function isJailed(user: IUser): boolean {
  return user.jailUntil !== null && user.jailUntil > new Date();
}

export function generateTag(username: string): string {
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${username}#${num}`;
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default mongoose.model<IUser>("User", UserSchema);
