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
  faction: string | null;
  factionId: mongoose.Types.ObjectId | null;
  factionRole: "leader" | "co-leader" | "officer" | "member" | "recruit" | null;
  level: number;
  xp: number;
  xpToNext: number;
  prestige: number;
  prestigeXpBoost: number;   // e.g. 10 means +10% XP
  seasonXp: number;
  seasonPoints: number;
  seasonLevel: number;
  premiumPassEventId: string | null;
  claimedPassRewards: string[];
  dailyQuests: Array<{ questId: string; progress: number; completed: boolean; claimedAt: Date | null; assignedAt: Date | null }>;
  weeklyQuests: Array<{ questId: string; progress: number; completed: boolean; claimedAt: Date | null; assignedWeek: string | null }>;
  dc: number;
  nc: number;
  dirtyDc: number;   // unclean cash from Runs — needs laundering
  sim: number;       // SIM coin (Net crypto currency, volatile)
  bankBalance: number;
  merit: number;
  health: number;
  maxHealth: number;   // computed at runtime via computeMaxHp() — NOT a stored field, see virtual below
  energy: number;
  maxEnergy: number;
  nitro: number;           // Tier 1.8 — racing pool, costs 1 to queue for a Race
  maxNitro: number;
  nerve: number;     // legacy — kept for backward compat
  maxNerve: number;
  activeBuffs: Array<{ buffType: string; value: number; expiresAt: Date }>;
  travelingTo: string | null;      // destination district slug, null if not traveling
  travelArrivesAt: Date | null;    // null if not traveling
  heat: number;      // Section 1 — rises with crime, decays passively
  stress: number;    // Section 1 — rises with losses/fails, decays via items
  mood: number;      // 0-100; 100=calm, feeds gym gain multiplier
  energyRegenAt: Date;
  nerveRegenAt: Date;
  nitroRegenAt: Date;
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
  status: 'normal' | 'traveling' | 'abroad' | 'hospitalized' | 'jailed';
  currentLocation: string;   // district slug — 'downtown' when at home
  hospitalizedUntil: Date | null;
  jailedUntil: Date | null;   // canonical field (jailUntil kept for compat)
  jailUntil: Date | null;
  jailDuration: number;   // original sentence in ms (for bail calculation)
  lastMuggedAt: Date | null;
  pursuiteActive: boolean; // true while a pursuit minigame is pending
  alterEgoName: string | null;
  alterEgoHeat: number;
  lastLogin: Date;
  lastDailyReward: Date | null;
  dailyStreak: number;
  telegramId: string | null;
  telegramNotifications: boolean;
  discordId: string | null;
  discordUsername: string | null;
  isEmailVerified: boolean;
  emailOtp: string | null;
  emailOtpExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  role: "player" | "admin" | "staff" | "owner";
  banned: boolean;
  bannedAt?: Date | null; // Tier 8 §8.3 — set whenever POST /api/owner/ban bans this account
  banReason: string | null;
  mutedUntil: Date | null;
  mutedUsers: string[];
  blockedUsers: string[];
  following: string[];
  devMode: boolean;
  battlePassPremium: boolean;
  equippedWeapon: mongoose.Types.ObjectId | null;
  equippedEnhancement: mongoose.Types.ObjectId | null;
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
    combat: boolean;
    crimes: boolean;
    faction: boolean;
    banking: boolean;
  };
  gang: string | null;
  guildId: mongoose.Types.ObjectId | null;
  guildRole: "leader" | "officer" | "member" | "recruit" | null;
  properties: mongoose.Types.ObjectId[];
  businesses: mongoose.Types.ObjectId[];
  companions: mongoose.Types.ObjectId[];
  referralCode: string;
  referredBy: string | null;
  referralCount: number;
  referralRewardsClaimed: number;
  jobCooldowns: Record<string, Date>;
  pendingMinigame: { token: string; jobId: string; expiresAt: Date } | null;
  lastNpcCombatAt: Date | null;
  friends: mongoose.Types.ObjectId[];
  pinkSlipWins: number;
  implants: Array<{ id: string; name: string; slot: string; installedAt: Date }>;
  // ── Mini-game currencies ──────────────────────────────────────────────────
  keys: number;               // hard currency: 1 key = 1 royale spin (guaranteed Rare+)
  keyShards: number;          // 10 shards = 1 key; softer grind path
  spinTokens: number;         // earned from royale; 1 token = 1 free spin on any wheel
  // ── Mini-game stats ───────────────────────────────────────────────────────
  combatWinStreak:      number;  // consecutive combat wins; resets on loss
  maxCombatWinStreak:   number;  // highest streak ever reached (for achievements)
  miniGameMatchesToday: number;  // matches played today (for daily reward cap)
  miniGameResetAt:      Date;    // next daily cap reset (midnight UTC)
  totalRoyaleSpins:     number;  // lifetime royale spins (for achievements)
  dailyMissionProgress: Record<string, { progress: number; completed: boolean; claimedAt: Date | null }>;
  dailyMissionDate:     string | null;  // YYYY-MM-DD key of current mission day
  // ── Training Center (Tier 7) ──────────────────────────────────────────────
  combatAccuracyBonus:    number;   // 0–0.25; +% hit chance in combat
  raceGearBonus:          number;   // 0–0.25; widens green shift zone in races
  energyRegenBonus:       number;   // 0–0.15; multiplier to speed up energy regen
  trainingSessionsToday:  Record<string, number>;  // { combat_drills: n, racing_practice: n, endurance_training: n }
  trainingResetAt:        Date | null;  // next midnight UTC reset
  // ── Monetization ─────────────────────────────────────────────────────────
  // nc (Nova Credits) is the premium currency — earned via Telegram Stars or subscriptions.
  subscriptionTier: 'street_runner' | 'neon_syndicate' | 'apex_sovereign' | null;
  subscriptionExpiresAt: Date | null;
  ncDailyClaimedAt: Date | null;       // last time daily NC was claimed
  ncClaimStreak: number;               // consecutive days claimed
  ncRolloverDays: number;              // unclaimed days rolled over (max 3)
  telegramUsername: string | null;     // @handle from Telegram
  telegramLinkCode: string | null;     // one-time 6-char link code
  telegramLinkCodeExpiry: Date | null;
  gameTheme: string;                   // active UI theme id
  uiScale: number;                     // Settings > Appearance UI zoom (0.6–1.2), synced per-account
  uiTheme: 'dark' | 'light';           // Settings > Appearance color theme, synced per-account
  navOrder: string[];                  // custom nav bar order; empty [] = use system/owner default
  defaultPage: string | null;          // preferred landing page; null = system default
  isGhostAccount: boolean;             // Vanta test account — invisible to all public endpoints
  // ── System 1: Daily Login Reward & Streak ───────────────────────────────
  loginStreak: number;
  lastLoginDate: Date | null;
  // ── System 2: Crime Cooldowns ────────────────────────────────────────────
  crimeCooldowns: Map<string, Date>;
  // ── System 3: Weekly leaderboard fields ──────────────────────────────────
  weeklyDc: number;
  weeklyArenaWins: number;
  weeklyRaceWins: number;
  weeklyReset: Date | null;
  combatMatchesCompleted: number;
  lastEncounterAt: Date | null;
  // ── Revive system ─────────────────────────────────────────────────────────
  revivesReceived: number;
  // ── Tier 7 Achievement tracking ──────────────────────────────────────────
  totalBossDamage?: number;
  eventRank1Count?: number;
  // ── 10.14 Mentor system ──────────────────────────────────────────────────
  isMentor?: boolean;
  mentorId?: string | null;
  menteeIds?: string[];
  mentorRating: number;
  mentorRatingCount: number;
  // ── Hacking system (Tier 9) ───────────────────────────────────────────
  hackDefenseLevel: number;
  lastHackedAt: Date | null;
  hackCooldowns: Map<string, Date>;
  // ── Pending NPC encounter (Tier 9) ───────────────────────────────────
  pendingEncounter: {
    kind: "mugger" | "checkpoint" | "black_market";
    data: Record<string, unknown>;
    expiresAt: Date;
  } | null;
  // ── 10.15 Pinned achievement badges ─────────────────────────────────────
  pinnedBadges?: string[];
  // ── Tier 10 NC utility ───────────────────────────────────────────────────
  purchasedLoadoutSlots: number;  // 0–3 extra loadout slots bought with NC
  // ── 11 Cosmetics system ──────────────────────────────────────────────────
  cosmeticInventory: Array<{
    cosmeticId: string;
    acquiredAt: Date;
    expiresAt: Date | null;
    source: "purchase" | "event_reward" | "subscription" | "owner_grant";
  }>;
  equippedNameFlair: string | null;
  equippedMessageCard: string | null;
  ownedCosmetics: string[];
  // ── Security / Vanta ─────────────────────────────────────────────────────
  lastLoginIp?: string | null;
  loginIpHistory?: string[];
  // ── Giveaway system ───────────────────────────────────────────────────────
  underReview: boolean;
  underReviewReason: string | null;
  // ── Staff system ──────────────────────────────────────────────────────────
  staffTier: 1 | 2 | 3 | 4 | 5 | null;
  staffTierAssignedAt: Date | null;
  staffEarningsLastClaimedAt: Date | null;
  staffEarningsTotalDc: number;
  staffTaskProgress: Record<string, number>;
  staffTaskResetAt: Date | null;
  // ── Business system ───────────────────────────────────────────────────────
  businessId: mongoose.Types.ObjectId | null;
  employerBusinessId: mongoose.Types.ObjectId | null;
  businessShiftCooldowns: Record<string, Date>;
  // ── Season system (Tier 5) ────────────────────────────────────────────────
  seasonHistory: Array<{
    seasonName: string;
    eventId: string;
    finalLevel: number;
    hasPremiumPass: boolean;
    endedAt: Date;
  }>;
  lastSeasonResetAt: Date | null;
  resetOfferExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  getEffectiveStats(): EffectiveStats;
}

export interface EffectiveStats {
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
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
    faction:     { type: String, default: null },
    factionId:   { type: Schema.Types.ObjectId, ref: "Faction", default: null },
    factionRole: { type: String, enum: ["leader", "co-leader", "officer", "member", "recruit", null], default: null },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0 },
    xpToNext: { type: Number, default: 500 },
    prestige: { type: Number, default: 0 },
    prestigeXpBoost: { type: Number, default: 0 },
    seasonXp: { type: Number, default: 0 },
    seasonPoints: { type: Number, default: 0 },
    seasonLevel: { type: Number, default: 0 },
    premiumPassEventId: { type: String, default: null },
    claimedPassRewards: [{ type: String }],
    dailyQuests: [{
      questId:    { type: String },
      progress:   { type: Number, default: 0 },
      completed:  { type: Boolean, default: false },
      claimedAt:  { type: Date, default: null },
      assignedAt: { type: Date, default: null },
      _id: false,
    }],
    weeklyQuests: [{
      questId:      { type: String },
      progress:     { type: Number, default: 0 },
      completed:    { type: Boolean, default: false },
      claimedAt:    { type: Date, default: null },
      assignedWeek: { type: String, default: null },
      _id: false,
    }],
    dc: { type: Number, default: 750 },
    nc: { type: Number, default: 0 },
    dirtyDc: { type: Number, default: 0 },
    purchasedLoadoutSlots: { type: Number, default: 0, min: 0, max: 3 },
    sim: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    merit: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    energy: { type: Number, default: 200 },
    maxEnergy: { type: Number, default: 200 },
    nitro: { type: Number, default: 5 },
    maxNitro: { type: Number, default: 5 },
    nerve: { type: Number, default: 50 },
    maxNerve: { type: Number, default: 50 },
    activeBuffs: {
      type: [{ buffType: String, value: Number, expiresAt: Date }],
      default: () => [],
    },
    travelingTo: { type: String, default: null },
    travelArrivesAt: { type: Date, default: null },
    heat: { type: Number, default: 0, min: 0, max: 100 },
    stress: { type: Number, default: 0, min: 0, max: 100 },
    mood: { type: Number, default: 100, min: 0, max: 100 },
    energyRegenAt: { type: Date, default: Date.now },
    nerveRegenAt: { type: Date, default: Date.now },
    nitroRegenAt: { type: Date, default: Date.now },
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
    district: { type: String, default: "downtown" },
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
    status: { type: String, enum: ['normal', 'traveling', 'abroad', 'hospitalized', 'jailed'], default: 'normal' },
    currentLocation: { type: String, default: 'downtown' },
    hospitalizedUntil: { type: Date, default: null },
    jailedUntil: { type: Date, default: null },
    jailUntil: { type: Date, default: null },
    jailDuration: { type: Number, default: 0 },
    lastMuggedAt: { type: Date, default: null },
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
    bannedAt: { type: Date, default: null },
    banReason: { type: String, default: null },
    mutedUntil: { type: Date, default: null },
    mutedUsers: [{ type: String }],
    blockedUsers: [{ type: String }],
    following: [{ type: String }],
    devMode: { type: Boolean, default: false },
    battlePassPremium: { type: Boolean, default: false },
    equippedWeapon: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    equippedEnhancement: { type: Schema.Types.ObjectId, ref: "Item", default: null },
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
        dms:          { type: Boolean, default: true },
        xpBoost:      { type: Boolean, default: true },
        combat:       { type: Boolean, default: true },
        crimes:       { type: Boolean, default: true },
        faction:      { type: Boolean, default: true },
        banking:      { type: Boolean, default: true },
      },
      default: () => ({
        achievements: true, dms: true, xpBoost: true,
        combat: true, crimes: true, faction: true, banking: true,
      }),
    },
    gang: { type: String, default: null },
    guildId: { type: Schema.Types.ObjectId, ref: "Guild", default: null },
    guildRole: { type: String, enum: ["leader", "officer", "member", "recruit", null], default: null },
    businesses: [{ type: Schema.Types.ObjectId, ref: "Business" }],
    companions: [{ type: Schema.Types.ObjectId, ref: "Companion" }],
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    referralRewardsClaimed: { type: Number, default: 0 },
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
    // ── Monetization ─────────────────────────────────────────────────────────
    subscriptionTier: {
      type: String,
      enum: ["street_runner", "neon_syndicate", "apex_sovereign", null],
      default: null,
    },
    subscriptionExpiresAt: { type: Date, default: null },
    ncDailyClaimedAt: { type: Date, default: null },
    ncClaimStreak: { type: Number, default: 0 },
    ncRolloverDays: { type: Number, default: 0 },
    telegramUsername: { type: String, default: null },
    telegramLinkCode: { type: String, default: null },
    telegramLinkCodeExpiry: { type: Date, default: null },
    discordId:       { type: String, default: null, index: true, sparse: true },
    discordUsername: { type: String, default: null },
    keys:               { type: Number, default: 0 },
    keyShards:          { type: Number, default: 0 },
    spinTokens:         { type: Number, default: 0 },
    combatWinStreak:      { type: Number, default: 0 },
    maxCombatWinStreak:   { type: Number, default: 0 },
    miniGameMatchesToday: { type: Number, default: 0 },
    miniGameResetAt:      { type: Date, default: () => new Date(new Date().setUTCHours(24, 0, 0, 0)) },
    totalRoyaleSpins:     { type: Number, default: 0 },
    dailyMissionProgress: { type: Schema.Types.Mixed, default: {} },
    dailyMissionDate:     { type: String, default: null },
    combatAccuracyBonus:   { type: Number, default: 0 },
    raceGearBonus:         { type: Number, default: 0 },
    energyRegenBonus:      { type: Number, default: 0 },
    trainingSessionsToday: { type: Schema.Types.Mixed, default: {} },
    trainingResetAt:       { type: Date, default: null },
    gameTheme: { type: String, default: "default" },
    uiScale: { type: Number, default: 0.85 },
    uiTheme: { type: String, enum: ["dark", "light"], default: "dark" },
    navOrder: { type: [String], default: [] },
    defaultPage: { type: String, default: null },
    isGhostAccount: { type: Boolean, default: false, index: true },
    // ── System 1: Daily Login Reward & Streak ─────────────────────────────
    loginStreak: { type: Number, default: 0 },
    lastLoginDate: { type: Date, default: null },
    // ── System 2: Crime Cooldowns ─────────────────────────────────────────
    crimeCooldowns: { type: Map, of: Date, default: {} },
    // ── System 3: Weekly leaderboard fields ──────────────────────────────
    weeklyDc: { type: Number, default: 0 },
    weeklyArenaWins: { type: Number, default: 0 },
    weeklyRaceWins: { type: Number, default: 0 },
    weeklyReset: { type: Date, default: null },
    combatMatchesCompleted: { type: Number, default: 0 },
    lastEncounterAt: { type: Date, default: null },
    revivesReceived:  { type: Number, default: 0 },
    totalBossDamage:  { type: Number, default: 0 },
    eventRank1Count:  { type: Number, default: 0 },
    implants: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        slot: { type: String, required: true },
        installedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    // ── 10.14 Mentor system ────────────────────────────────────────────────
    isMentor:          { type: Boolean, default: false },
    mentorId:          { type: Schema.Types.ObjectId, ref: "User", default: null },
    menteeIds:         [{ type: Schema.Types.ObjectId, ref: "User" }],
    mentorRating:      { type: Number, default: 0, min: 0, max: 5 },
    mentorRatingCount: { type: Number, default: 0 },
    // ── Hacking system (Tier 9) ───────────────────────────────────────────
    hackDefenseLevel: { type: Number, default: 0, min: 0 },
    lastHackedAt:     { type: Date, default: null },
    hackCooldowns:    { type: Map, of: Date, default: () => ({}) },
    // ── Pending NPC encounter (Tier 9) ───────────────────────────────────
    pendingEncounter: {
      type: new Schema(
        {
          kind:      { type: String, enum: ["mugger", "checkpoint", "black_market"], required: true },
          data:      { type: Schema.Types.Mixed, default: {} },
          expiresAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    // ── 10.15 Pinned achievement badges (max 3) ────────────────────────────
    pinnedBadges: [{ type: String }],
    // ── 11 Cosmetics system ────────────────────────────────────────────────
    cosmeticInventory: [{
      cosmeticId: { type: String, required: true },
      acquiredAt: { type: Date, default: Date.now },
      expiresAt:  { type: Date, default: null },
      source: { type: String, enum: ["purchase", "event_reward", "subscription", "owner_grant"], required: true },
    }],
    equippedNameFlair:   { type: String, default: null },
    equippedMessageCard: { type: String, default: null },
    ownedCosmetics:      [{ type: String }],
    // ── Security / Vanta ──────────────────────────────────────────────────
    lastLoginIp:    { type: String, default: null },
    loginIpHistory: [{ type: String }],
    // ── Giveaway system ────────────────────────────────────────────────────
    underReview:       { type: Boolean, default: false },
    underReviewReason: { type: String, default: null },
    // ── Staff system ───────────────────────────────────────────────────────
    staffTier:                  { type: Number, enum: [1, 2, 3, 4, 5, null], default: null },
    staffTierAssignedAt:        { type: Date, default: null },
    staffEarningsLastClaimedAt: { type: Date, default: null },
    staffEarningsTotalDc:       { type: Number, default: 0 },
    staffTaskProgress:          { type: Schema.Types.Mixed, default: {} },
    staffTaskResetAt:           { type: Date, default: null },
    // ── Business system ──────────────────────────────────────────────────────
    businessId:              { type: Schema.Types.ObjectId, ref: "Business", default: null },
    employerBusinessId:      { type: Schema.Types.ObjectId, ref: "Business", default: null },
    businessShiftCooldowns:  { type: Schema.Types.Mixed, default: {} },
    // ── Season system (Tier 5) ───────────────────────────────────────────────
    seasonHistory: {
      type: [{
        seasonName:     { type: String, required: true },
        eventId:        { type: String, required: true },
        finalLevel:     { type: Number, default: 0 },
        hasPremiumPass: { type: Boolean, default: false },
        endedAt:        { type: Date, default: Date.now },
        _id: false,
      }],
      default: () => [],
    },
    lastSeasonResetAt:   { type: Date, default: null },
    resetOfferExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Performance indexes for Leaderboards and District player lookups
UserSchema.index({ banned: 1, level: -1, xp: -1 });
UserSchema.index({ banned: 1, wins: -1 });
UserSchema.index({ banned: 1, raceWins: -1 });
UserSchema.index({ banned: 1, totalCrimes: -1 });
UserSchema.index({ banned: 1, weeklyDc: -1 });
UserSchema.index({ banned: 1, weeklyArenaWins: -1 });
UserSchema.index({ banned: 1, weeklyRaceWins: -1 });
UserSchema.index({ banned: 1, prestige: -1, level: -1 });
UserSchema.index({ district: 1, banned: 1, isEmailVerified: 1 });

UserSchema.methods.getEffectiveStats = function(this: IUser): EffectiveStats {
  const stats: EffectiveStats = {
    strength: this.strength,
    charisma: this.charisma,
    intelligence: this.intelligence,
    streetCred: this.streetCred,
  };

  const now = new Date();
  if (this.activeBuffs && Array.isArray(this.activeBuffs)) {
    for (const buff of this.activeBuffs) {
      if (buff.expiresAt > now) {
        if (buff.buffType === "all_stats") {
          stats.strength += buff.value;
          stats.charisma += buff.value;
          stats.intelligence += buff.value;
          stats.streetCred += buff.value;
        } else if (buff.buffType === "strength") {
          stats.strength += buff.value;
        } else if (buff.buffType === "charisma") {
          stats.charisma += buff.value;
        } else if (buff.buffType === "intelligence") {
          stats.intelligence += buff.value;
        } else if (buff.buffType === "streetCred") {
          stats.streetCred += buff.value;
        }
      }
    }
  }

  return stats;
};

export function xpForLevel(level: number): number {
  if (level <= 10) return Math.round(500 + (level - 1) * (1500 / 9));
  if (level <= 30) return Math.round(3000 + (level - 11) * (5000 / 19));
  if (level <= 60) return Math.round(10000 + (level - 31) * (15000 / 29));
  return Math.round(30000 + (level - 61) * (70000 / 39));
}

/** Derived max energy: base 200, capped at 300. Does not shrink below 200. */
export function derivedMaxEnergy(level: number): number {
  return Math.min(300, Math.max(200, 100 + level * 2));
}

export function applyRegen(user: IUser): void {
  const now = Date.now();

  // Energy: +1 per 3 min (mini-game energy system)
  const energyMinutes = (now - user.energyRegenAt.getTime()) / 60000;
  const energyGain = Math.floor(energyMinutes / 3);
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

  // Nitro: +1 per 12 min (Race queue fuel)
  if (!user.nitroRegenAt) user.nitroRegenAt = new Date(now);
  const nitroMinutes = (now - user.nitroRegenAt.getTime()) / 60000;
  const nitroGain = Math.floor(nitroMinutes / 12);
  if (nitroGain > 0 && user.nitro < user.maxNitro) {
    user.nitro = Math.min(user.maxNitro, user.nitro + nitroGain);
    user.nitroRegenAt = new Date(now);
  }

  // Travel arrival auto-completion
  if (user.travelingTo && user.travelArrivesAt && user.travelArrivesAt.getTime() <= now) {
    user.currentLocation = user.travelingTo;
    user.district = user.travelingTo;
    user.travelingTo = null;
    user.travelArrivesAt = null;
    if (user.status === 'traveling') {
      user.status = user.currentLocation === 'downtown' ? 'normal' : 'abroad';
    }
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

/** maxHealth is computed at runtime — never stored — so it always reflects current level/prestige. */
export function computeMaxHp(level: number, prestige: number = 0): number {
  const baseHp = 100;
  const levelHp = level * 15;
  const quadraticHp = Math.floor(level * level * 0.2);
  const prestigeBonus = prestige * 200;
  return baseHp + levelHp + quadraticHp + prestigeBonus;
}

export function levelUp(user: IUser): boolean {
  let leveled = false;
  while (user.xp >= user.xpToNext) {
    user.xp -= user.xpToNext;
    user.level += 1;
    user.xpToNext = xpForLevel(user.level);
    user.maxEnergy = derivedMaxEnergy(user.level);
    user.maxNerve = Math.min(100, Math.floor(50 + user.level * 0.3));
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
  // Support both jailUntil (legacy) and jailedUntil (new)
  const until = user.jailedUntil ?? user.jailUntil;
  return until !== null && until > new Date();
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

UserSchema.virtual("maxHealth").get(function (this: IUser) {
  return computeMaxHp(this.level, this.prestige);
});

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
  // Prune expired timed buffs
  if (this.activeBuffs && this.activeBuffs.length) {
    const now = new Date();
    this.activeBuffs = this.activeBuffs.filter(b => b.expiresAt > now);
  }
  // Clamp health to the current (computed) max — matters after a level-down/prestige reset
  const maxHp = computeMaxHp(this.level, this.prestige);
  if (this.health > maxHp) this.health = maxHp;
});

/** Sum of a given buffType's value across all currently-active (non-expired) buffs. */
export function activeBuffTotal(user: IUser, buffType: string): number {
  const now = new Date();
  return (user.activeBuffs || [])
    .filter(b => b.buffType === buffType && b.expiresAt > now)
    .reduce((sum, b) => sum + b.value, 0);
}

export function generateTag(username: string): string {
  const num = Math.floor(1000 + Math.random() * 8999);
  return `${username}#${num}`;
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default mongoose.model<IUser>("User", UserSchema);
