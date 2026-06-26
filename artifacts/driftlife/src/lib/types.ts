export interface User {
  id: string;
  username: string;
  email: string;
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
  hospitalizedUntil: string | null;
  jailUntil: string | null;
  lastDailyReward: string | null;
  dailyStreak: number;
  role: "player" | "admin" | "owner";
  bankBalance: number;
  gang: string | null;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface FeedEvent {
  id: string;
  type: string;
  actor: string;
  target: string | null;
  message: string;
  dc: number;
  xp: number;
  createdAt: string;
}

export interface Crime {
  id: string;
  name: string;
  nerveCost: number;
  minLevel: number;
  successRate: number;
  dcRange: [number, number];
  xp: number;
  description: string;
}

export interface Job {
  id: string;
  name: string;
  minLevel: number;
  energyCost: number;
  dcMin: number;
  dcMax: number;
  xp: number;
  description: string;
}

export interface District {
  id: string;
  name: string;
  description: string;
  dangerLevel: number;
  minLevel: number;
  color: string;
  npcs: string[];
}

export interface Item {
  id: string;
  name: string;
  type: "weapon" | "armor" | "consumable" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  damage: number;
  defense: number;
  effect: string | null;
  description: string;
  equipped: boolean;
  slot: "weapon" | "armor" | null;
  marketListed: boolean;
  price?: number;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatar: string;
  level: number;
  rankTitle: string;
  dc: number;
  wins: number;
  losses: number;
  crimes: number;
  district: string;
}
