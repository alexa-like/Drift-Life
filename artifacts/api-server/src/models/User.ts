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
  unlockedSkills: string[];
  skillTree: string | null;
  secondarySkill: string | null;
  seasonXp: number;
  seasonPoints: number;
  craftingXp: number;
  dc: number;
  nc: number;
  dirtyDc: number;   // unclean cash from Runs — needs laundering
  sim: number;       // SIM coin (Net crypto currency, volatile)
  bankBalance: number;
  merit: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  nerve: number;     // legacy — kept for backward compat
  maxNerve: number;
  heat: number;      // Section 1 — rises with crime, decays passively
  stress: number;    // Section 1 — rises with losses/fails, decays via items
  mood: number;      // 0-100; 100=calm, feeds gym gain multiplier
  energyRegenAt: Date;
  nerveRegenAt: Date;
  heatDecayAt: Date;
  stressDecayAt: Date;
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
  humanityLoss: number;   // Section 8 — cyberware counter
  firewallLevel: number;  // Section 4 — Net defense
  followers: number;      // Section 8 — fame system
  onboardingStage: number; // 0=new, 1=ran first run, 2=has car, 3=has job, 4=fully unlocked
  district: string;
  job: string | null;
  rank: string;
  wantedLevel: number;
  wantedDecayAt: Date;
  totalCrimes: number;
  successfulCrimes: number;
  totalRaces: number;
  raceWins: number;
  totalFights: number;
  wins: number;
  losses: number;
  reputation: number;
  attacksToday: number;
  attackResetAt: Date;
  attackCooldowns: Array<{ targetId: string; until: Date }>;
  hospitalizedUntil: Date | null;
  jailUntil: Date | null;
  jailDuration: number;   // original sentence in ms (for bail calculation)
  pursuiteActive: boolean; // true while a pursuit minigame is pending
  alterEgoName: string | null;
  alterEgoHeat: number;
  lastLogin: Date;
  lastDailyReward: Date | null;
  dailyStreak: number;
  telegramId: string | null;
  telegramNotifications: boolean;
  isEmailVerified: boolean;
  emailOtp: string | null;
  emailOtpExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  role: "player" | "admin" | "staff" | "owner";
  banned: boolean;
  banReason: string | null;
  mutedUntil: Date | null;
  mutedUsers: string[];
  blockedUsers: string[];
  following: string[];
  devMode: boolean;
  battlePassPremium: boolean;
  equippedWeapon: mongoose.Types.ObjectId | null;
  equippedArmor: mongoose.Types.ObjectId | null;
  equippedClothing: mongoose.Types.ObjectId | null;
  equippedVehicle: mongoose.Types.ObjectId | null;
  equippedTitle: string | null;
  titles: string[];
  appearOffline: boolean;
  lastActiveAt: Date;
  lastCrimeDate: Date | null;
  dmPrivacy: "anyone" | "nobody";
  liteModeEnabled: boolean;
  notificationPrefs: {
    achievements: boolean;
    dms: boolean;
    xpBoost: boolean;
  };
  gang: string | null;
  guildId: mongoose.Types.ObjectId | null;
  guildRole: "leader" | "officer" | "member" | "recruit" | null;
  properties: mongoose.Types.ObjectId[];
  cars: mongoose.Types.ObjectId[];
  activeCar: mongoose.Types.ObjectId | null;
  businesses: mongoose.Types.ObjectId[];
  companions: mongoose.Types.ObjectId[];
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  jobCooldowns: Record<string, Date>;
  pendingMinigame: { token: string; jobId: string; expiresAt: Date } | null;
  lastNpcCombatAt: Date | null;
  friends: mongoose.Types.ObjectId[];
  pinkSlipWins: number;
  implants: Array<{ id: string; name: string; slot: string; installedAt: Date }>;
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
    unlockedSkills: [{ type: String }],
    skillTree: { type: String, default: null },
    secondarySkill: { type: String, default: null },
    seasonXp: { type: Number, default: 0 },
    seasonPoints: { type: Number, default: 0 },
    craftingXp: { type: Number, default: 0 },
    dc: { type: Number, default: 750 },
    nc: { type: Number, default: 0 },
    dirtyDc: { type: Number, default: 0 },
    sim: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    merit: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    energy: { type: Number, default: 100 },
    maxEnergy: { type: Number, default: 100 },
    nerve: { type: Number, default: 50 },
    maxNerve: { type: Number, default: 50 },
    heat: { type: Number, default: 0, min: 0, max: 100 },
    stress: { type: Number, default: 0, min: 0, max: 100 },
    mood: { type: Number, default: 100, min: 0, max: 100 },
    energyRegenAt: { type: Date, default: Date.now },
    nerveRegenAt: { type: Date, default: Date.now },
    heatDecayAt: { type: Date, default: Date.now },
    stressDecayAt: { type: Date, default: Date.now },
    strength: { type: Number, default: 10 },
    charisma: { type: Number, default: 5 },
    intelligence: { type: Number, default: 5 },
    streetCred: { type: Number, default: 0 },
    humanityLoss: { type: Number, default: 0 },
    firewallLevel: { type: Number, default: 1 },
    followers: { type: Number, default: 0 },
    onboardingStage: { type: Number, default: 0 },
    district: { type: String, default: "residential-north" },
    job: { type: String, default: null },
    rank: { type: String, default: "New in Town" },
    wantedLevel: { type: Number, default: 0, min: 0, max: 5 },
    wantedDecayAt: { type: Date, default: Date.now },
    totalCrimes: { type: Number, default: 0 },
    successfulCrimes: { type: Number, default: 0 },
    totalRaces: { type: Number, default: 0 },
    raceWins: { type: Number, default: 0 },
    totalFights: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    attacksToday: { type: Number, default: 0 },
    attackResetAt: { type: Date, default: Date.now },
    attackCooldowns: [{ targetId: String, until: Date }],
    hospitalizedUntil: { type: Date, default: null },
    jailUntil: { type: Date, default: null },
    jailDuration: { type: Number, default: 0 },
    pursuiteActive: { type: Boolean, default: false },
    alterEgoName: { type: String, default: null },
    alterEgoHeat: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now },
    lastDailyReward: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
    telegramId: { type: String, default: null },
    telegramNotifications: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, default: null },
    emailOtpExpiry: { type: Date, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    role: { type: String, enum: ["player", "admin", "staff", "owner"], default: "player" },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    mutedUntil: { type: Date, default: null },
    mutedUsers: [{ type: String }],
    blockedUsers: [{ type: String }],
    following: [{ type: String }],
    devMode: { type: Boolean, default: false },
    battlePassPremium: { type: Boolean, default: false },
    equippedWeapon: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedArmor: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedClothing: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedVehicle: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedTitle: { type: String, default: "New in Town" },
    titles: [{ type: String }],
    appearOffline: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
    lastCrimeDate: { type: Date, default: null },
    dmPrivacy: { type: String, enum: ["anyone", "nobody"], default: "anyone" },
    liteModeEnabled: { type: Boolean, default: false },
    notificationPrefs: {
      type: {
        achievements: { type: Boolean, default: true },
        dms: { type: Boolean, default: true },
        xpBoost: { type: Boolean, default: true },
      },
      default: () => ({ achievements: true, dms: true, xpBoost: true }),
    },
    gang: { type: String, default: null },
    guildId: { type: Schema.Types.ObjectId, ref: "Guild", default: null },
    guildRole: { type: String, enum: ["leader", "officer", "member", "recruit", null], default: null },
    properties: [{ type: Schema.Types.ObjectId, ref: "Property" }],
    cars: [{ type: Schema.Types.ObjectId, ref: "Car" }],
    activeCar: { type: Schema.Types.ObjectId, ref: "Car", default: null },
    businesses: [{ type: Schema.Types.ObjectId, ref: "Business" }],
    companions: [{ type: Schema.Types.ObjectId, ref: "Companion" }],
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    jobCooldowns: { type: Map, of: Date, default: {} },
    pendingMinigame: {
      type: new Schema(
        { token: String, jobId: String, expiresAt: Date },
        { _id: false },
      ),
      default: null,
    },
    lastNpcCombatAt: { type: Date, default: null },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    implants: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        slot: { type: String, required: true },
        installedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

export function xpForLevel(level: number): number {
  if (level <= 10) return Math.round(500 + (level - 1) * (1500 / 9));
  if (level <= 30) return Math.round(3000 + (level - 11) * (5000 / 19));
  if (level <= 60) return Math.round(10000 + (level - 31) * (15000 / 29));
  return Math.round(30000 + (level - 61) * (70000 / 39));
}

/** Derived max energy: 100 + (level * 2), capped at 300 */
export function derivedMaxEnergy(level: number): number {
  return Math.min(300, 100 + level * 2);
}

export function applyRegen(user: IUser): void {
  const now = Date.now();

  // Energy: +1 per 10 min (Section 1)
  const energyMinutes = (now - user.energyRegenAt.getTime()) / 60000;
  const energyGain = Math.floor(energyMinutes / 10);
  if (energyGain > 0 && user.energy < user.maxEnergy) {
    user.energy = Math.min(user.maxEnergy, user.energy + energyGain);
    user.energyRegenAt = new Date(now);
  }

  // Nerve (legacy): +1 per 5 min
  const nerveMinutes = (now - user.nerveRegenAt.getTime()) / 60000;
  const nerveGain = Math.floor(nerveMinutes * (1 / 5));
  if (nerveGain > 0 && user.nerve < user.maxNerve) {
    user.nerve = Math.min(user.maxNerve, user.nerve + nerveGain);
    user.nerveRegenAt = new Date(now);
  }

  // Heat decay: -1 per 5 min passively (Section 1)
  if (!user.heatDecayAt) user.heatDecayAt = new Date(now);
  const heatMinutes = (now - user.heatDecayAt.getTime()) / 60000;
  const heatDecay = Math.floor(heatMinutes / 5);
  if (heatDecay > 0 && user.heat > 0) {
    user.heat = Math.max(0, user.heat - heatDecay);
    user.heatDecayAt = new Date(now);
  }

  // Stress decay: -1 per 15 min passively (Section 1)
  if (!user.stressDecayAt) user.stressDecayAt = new Date(now);
  const stressMinutes = (now - user.stressDecayAt.getTime()) / 60000;
  const stressDecay = Math.floor(stressMinutes / 15);
  if (stressDecay > 0 && user.stress > 0) {
    user.stress = Math.max(0, user.stress - stressDecay);
    user.stressDecayAt = new Date(now);
  }

  // Mood: inversely tied to stress. Recompute lazily.
  user.mood = Math.max(0, 100 - user.stress);

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
    user.maxEnergy = derivedMaxEnergy(user.level);
    user.maxNerve = Math.min(100, Math.floor(50 + user.level * 0.3));
    if (user.level >= 10 && (user.level - 10) % 5 === 0) user.skillPoints += 1;
    // Stat bonuses every 5 levels — +1 to all primary stats
    if (user.level % 5 === 0) {
      user.strength     = (user.strength     ?? 1) + 1;
      user.charisma     = (user.charisma     ?? 1) + 1;
      user.intelligence = (user.intelligence ?? 1) + 1;
      user.streetCred   = (user.streetCred   ?? 1) + 1;
    }
    leveled = true;
  }
  if (leveled) {
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

/** Stress penalty: above 70 stress applies -10% success chance */
export function stressPenalty(user: IUser): number {
  return user.stress > 70 ? 0.10 : 0;
}

/** Mood multiplier for gym gains: 1.0 at 100 mood, 0.7 at 0 mood */
export function moodMultiplier(user: IUser): number {
  return 0.7 + (user.mood / 100) * 0.3;
}

export const WALLET_CAP = 100_000_000;
export const BANK_CAP   = 1_000_000_000;

UserSchema.pre("save", function () {
  if (this.dc > WALLET_CAP) this.dc = WALLET_CAP;
  if (this.bankBalance > BANK_CAP) this.bankBalance = BANK_CAP;
  // Clamp new vitals
  if (this.heat < 0) this.heat = 0;
  if (this.heat > 100) this.heat = 100;
  if (this.stress < 0) this.stress = 0;
  if (this.stress > 100) this.stress = 100;
  if (this.mood < 0) this.mood = 0;
  if (this.mood > 100) this.mood = 100;
});

export function generateTag(username: string): string {
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${username}#${num}`;
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default mongoose.model<IUser>("User", UserSchema);
