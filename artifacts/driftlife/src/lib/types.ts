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
  dirtyDc: number;
  sim: number;
  credits: number;
  bankBalance: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  nerve: number;
  maxNerve: number;
  // Wire Cartel vitals
  heat: number;
  stress: number;
  mood: number;
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
  humanityLoss: number;
  firewallLevel: number;
  followers: number;
  onboardingStage: number;
  district: string;
  job: string | null;
  rank: string;
  wantedLevel: number;
  totalCrimes: number;
  successfulCrimes: number;
  totalRaces: number;
  raceWins: number;
  totalFights: number;
  wins: number;
  losses: number;
  attacksToday: number;
  hospitalizedUntil: string | null;
  jailUntil: string | null;
  pursuiteActive: boolean;
  lastDailyReward: string | null;
  dailyStreak: number;
  role: "player" | "admin" | "staff" | "owner";
  mutedUntil?: string | null;
  gang: string | null;
  guildId?: string | null;
  guildRole?: "leader" | "officer" | "member" | "recruit" | null;
  isEmailVerified: boolean;
  equippedTitle: string | null;
  titles: string[];
  merit: number;
  appearOffline: boolean;
  dmPrivacy: "anyone" | "nobody";
  liteModeEnabled: boolean;
  notificationPrefs: {
    achievements: boolean;
    dms: boolean;
    xpBoost: boolean;
  };
  devMode: boolean;
  battlePassPremium: boolean;
  telegramNotifications: boolean;
  unlockedSkills: string[];
  skillTree: string | null;
  secondarySkill: string | null;
  seasonXp: number;
  seasonPoints: number;
  craftingXp: number;
  mutedUsers: string[];
  blockedUsers: string[];
  following: string[];
  referralCode: string;
  createdAt: string;
  alterEgoName: string | null;
  implants?: Array<{ id: string; name: string; slot: string; installedAt: string }>;
  cars?: string[];
  activeCar?: string | null;
  businesses?: string[];
  ownedChatFrames: string[];
  equippedChatFrame: string | null;
  // ── Monetization ──────────────────────────────────────────────────────────
  subscriptionTier: "street_runner" | "neon_syndicate" | "apex_sovereign" | null;
  subscriptionExpiresAt: string | null;
  ncDailyClaimedAt: string | null;
  ncClaimStreak: number;
  telegramLinked: boolean;
  telegramUsername: string | null;
  gameTheme: string;
  // ── Mini-game currencies (Tier 2+) ─────────────────────────────────────────
  keys: number;
  keyShards: number;
  spinTokens: number;
  // ── Arena / Combat (Tier 4) ────────────────────────────────────────────────
  combatWinStreak: number;
}

export interface FeedEvent {
  id: string;
  type: string;
  actor: string;
  actorId?: string;
  actorAvatarUrl?: string | null;
  actorChatFrame?: string | null;
  actorLevel?: number;
  target: string | null;
  message: string;
  dc: number;
  xp: number;
  reactions: { like: number; laugh: number; shock: number; respect: number };
  comments: Array<{ username: string; content: string; at: string }>;
  createdAt: string;
}

export interface Run {
  id: string;
  name: string;
  tier: number;
  flavour: string;
  energyCost: number;
  nerveCost: number; // legacy alias for energyCost
  minLevel: number;
  baseSuccess: number;
  dcRange: [number, number];
  xp: number;
  heatGain: number;
  wantedIncrease: number;
  hospitalRisk: number;
  description: string;
  riskLevel: string;
  relevantStat: string;
}

/** Legacy alias for backward-compat with older UI code */
export type Crime = Run;

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
  imageUrl?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: "combat" | "crime" | "wealth" | "social" | "exploration" | "collection";
  dcReward: number;
  progress: number;
  target: number;
  completed: boolean;
  completedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  faction: string | null;
  title: string | null;
  level?: number;
  tag?: string | null;
  content: string;
  at: string;
  channel?: string;
  districtId?: string;
  chatFrame?: string | null;
  subscriptionTier?: "street_runner" | "neon_syndicate" | "apex_sovereign" | null;
}

export interface Conversation {
  userId: string;
  username: string;
  avatar: string;
  avatarUrl?: string | null;
  faction: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
  onlineStatus?: "online" | "away" | "offline";
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
  equippedTitle?: string | null;
  dc: number;
  bankBalance: number;
  totalWealth?: number;
  wins: number;
  losses: number;
  totalFights: number;
  crimes: number;
  reputation: number;
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

// ── Mini-game Garage (Tier 3C) — RaceCar/CarPart catalog + PlayerGarage ────────
export type RaceCarTier = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type CarPartType = "engine" | "tires" | "nitro" | "bodyKit" | "spoiler";

export interface CarStats {
  topSpeed: number;
  acceleration: number;
  handling: number;
  nitro: number;
}

export interface RaceCarDef {
  carId: string;
  name: string;
  tier: RaceCarTier;
  baseStats: CarStats;
  imageCard: string;
  flavorText: string;
}

export interface CarPartDef {
  partId: string;
  name: string;
  partType: CarPartType;
  tier: RaceCarTier;
  statBoost: Partial<CarStats>;
  imageCard: string;
  flavorText: string;
}

export interface EquippedParts {
  engine: string | null;
  tires: string | null;
  nitro: string | null;
  bodyKit: string | null;
  spoiler: string | null;
}

export interface CarCustomization {
  paint: string;
  underglow: string;
  decals: string;
  rims: string;
}

export interface OwnedCar {
  carId: string;
  equippedParts: EquippedParts;
  customization: CarCustomization;
  acquiredAt: string;
  def: RaceCarDef | null;
  totalStats: CarStats | null;
}

export interface OwnedCarPartStack {
  partId: string;
  quantity: number;
  def: CarPartDef | null;
}

export interface PlayerGarage {
  cars: OwnedCar[];
  parts: OwnedCarPartStack[];
  activeCar: string | null;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  level: number;
  dailyIncome: number;
  launderRate: number;
  launderCapacityPerDay: number;
  launderedToday: number;
  maxHolding: number;
  upgradeCost: number;
  maxLevel: number;
  pendingCollection?: number;
  launderCompletesAt?: string | null;
}

export interface WorldState {
  timeOfDay: "day" | "night";
  weather: "clear" | "rain";
  seasonId: string;
  seasonName: string;
  seasonStartsAt: string;
  seasonEndsAt: string;
  simPrice: number;
  activeEvents: WorldEvent[];
  nightBonus?: { runPayout: string; heatGain: string } | null;
  rainPenalty?: { grip: string } | null;
}

export interface WorldEvent {
  id: string;
  name: string;
  type: string;
  startsAt: string;
  endsAt: string;
  effectModifiers: Record<string, number>;
}
