export interface User {
  id: string;
  username: string;
  tag: string;
  email: string;
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
  credits: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  nerve: number;
  maxNerve: number;
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
  district: string;
  job: string | null;
  rank: string;
  wantedLevel: number;
  totalCrimes: number;
  successfulCrimes: number;
  totalFights: number;
  wins: number;
  losses: number;
  attacksToday: number;
  hospitalizedUntil: string | null;
  jailUntil: string | null;
  lastDailyReward: string | null;
  dailyStreak: number;
  role: "player" | "admin" | "staff" | "owner";
  mutedUntil?: string | null;
  bankBalance: number;
  gang: string | null;
  isEmailVerified: boolean;
  equippedFrame: string | null;
  equippedFrameRarity: string | null;
  equippedFrameColor: string | null;
  equippedTitle: string | null;
  titles: string[];
  ownedFrames: string[];
  devMode: boolean;
  battlePassPremium: boolean;
  telegramNotifications: boolean;
  unlockedSkills: string[];
  skillTree: string | null;
  secondarySkill: string | null;
  seasonXp: number;
  craftingXp: number;
  mutedUsers: string[];
  blockedUsers: string[];
  following: string[];
  referralCode: string;
  createdAt: string;
}

export interface FeedEvent {
  id: string;
  type: string;
  actor: string;
  actorId?: string;
  actorFrame?: string | null;
  actorFrameColor?: string | null;
  actorAvatarUrl?: string | null;
  target: string | null;
  message: string;
  dc: number;
  xp: number;
  reactions: { like: number; laugh: number; shock: number; respect: number };
  comments: Array<{ username: string; content: string; at: string }>;
  createdAt: string;
}

export interface Crime {
  id: string;
  name: string;
  flavour: string;
  nerveCost: number;
  minLevel: number;
  baseSuccess: number;
  dcRange: [number, number];
  xp: number;
  wantedIncrease: number;
  hospitalRisk: number;
  description: string;
  riskLevel: string;
}

export interface Job {
  id: string;
  name: string;
  district: string;
  minLevel: number;
  energyCost: number;
  dcMin: number;
  dcMax: number;
  xpPerJob: number;
  cooldownMin: number;
  description: string;
  miniGame: "typing" | "pattern" | "timing" | "rhythm";
  available: boolean;
  onCooldown: boolean;
  cooldownUntil: string | null;
  districtMatch: boolean;
}

export interface District {
  id: string;
  name: string;
  faction: string;
  description: string;
  dangerLevel: number;
  minLevel: number;
  travelEnergyCost: number;
  color: string;
  primaryActivity: string;
  npcs: string[];
  population?: number;
}

export interface Item {
  id: string;
  name: string;
  type: "weapon" | "armor" | "clothing" | "vehicle" | "consumable" | "material" | "badge" | "card" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "event";
  strengthBonus: number;
  charismaBonus: number;
  intelligenceBonus: number;
  streetCredBonus: number;
  defenseBonus: number;
  travelEnergyReduction: number;
  effect: string | null;
  description: string;
  basePrice: number;
  quantity: number;
  equipped: boolean;
  slot: "weapon" | "armor" | "clothing" | "vehicle" | null;
  marketListed: boolean;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface Frame {
  frameId: string;
  displayName: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  glowColor: string;
  animationType: "static" | "shimmer" | "pulse" | "rotate" | "flicker" | "matrix";
  price: number;
  currency: "dc" | "nc";
  isFree: boolean;
  description: string;
  earnedBy?: string;
  owned: boolean;
  equipped: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  tag?: string;
  avatar: string;
  avatarUrl?: string | null;
  faction: string | null;
  level: number;
  rankTitle: string;
  equippedFrame?: string | null;
  equippedFrameRarity?: string | null;
  equippedTitle?: string | null;
  dc: number;
  bankBalance: number;
  totalWealth?: number;
  wins: number;
  losses: number;
  crimes: number;
  district: string;
  metric?: string;
}

export interface NPC {
  id: string;
  name: string;
  district: string;
  level: number;
  hp: number;
  strength: number;
  dcMin: number;
  dcMax: number;
  xp: number;
  dropRarity: string;
  description: string;
}
