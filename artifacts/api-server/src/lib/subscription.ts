// ─── Subscription Tier Config ────────────────────────────────────────────────
// Single source of truth for all tier perks — never store these values on the
// user document. Always derive perks from the tier enum at runtime.
// Premium currency is Nova Credits (NC). UltraCredits / UC does not exist.

export type SubscriptionTier = 'street_runner' | 'neon_syndicate' | 'apex_sovereign';

export interface TierConfig {
  name: string;
  starsPerMonth: number;
  /** NC cost when purchasing subscription directly in-game (not via Telegram Stars).
   *  Priced at 6 NC per Star — mildly favourable vs the starter pack rate (5 NC/Star)
   *  but not so cheap it trivialises Stars purchases. */
  ncPrice: number;
  dailyNc: number;              // NC granted per daily claim
  jobXpMult: number;            // applied to xpGained in jobs
  crimeRewardMult: number;      // applied to dcGained in crimes
  extraCrimeSlots: number;      // added to RUNS_PER_HOUR_CAP
  hospitalSpeedPct: number;     // % reduction in hospitalization duration
  extraGymSessions: number;     // added to TRAINS_PER_HOUR_CAP
  bankInterestBonus: number;    // extra % interest on bank balance
  monthlyNc: number;            // NC granted on subscription activation
  frameId: string;              // exclusive frame id granted on subscribe
  chatColor: string;            // username color in chat
  badgeStyle: 'cyan-pulse' | 'neon-flicker' | 'sovereign-rainbow';
  themes: string[];             // unlocked theme ids
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  street_runner: {
    name: 'Street Runner',
    starsPerMonth: 250,
    ncPrice: 1500,   // 250 Stars × 6 NC/Star
    dailyNc: 60,
    jobXpMult: 1.15,
    crimeRewardMult: 1.10,
    extraCrimeSlots: 1,
    hospitalSpeedPct: 0,
    extraGymSessions: 0,
    bankInterestBonus: 0,
    monthlyNc: 0,
    frameId: 'sub_street_runner',
    chatColor: '#00E0FF',
    badgeStyle: 'cyan-pulse',
    themes: ['cyber_dark'],
  },
  neon_syndicate: {
    name: 'Neon Syndicate',
    starsPerMonth: 500,
    ncPrice: 3000,   // 500 Stars × 6 NC/Star
    dailyNc: 130,
    jobXpMult: 1.25,
    crimeRewardMult: 1.25,
    extraCrimeSlots: 2,
    hospitalSpeedPct: 10,
    extraGymSessions: 2,
    bankInterestBonus: 1,
    monthlyNc: 0,
    frameId: 'sub_neon_syndicate',
    chatColor: '#FF4FA3',
    badgeStyle: 'neon-flicker',
    themes: ['cyber_dark', 'vanta_red', 'grid_blue'],
  },
  apex_sovereign: {
    name: 'Apex Sovereign',
    starsPerMonth: 1000,
    ncPrice: 6000,   // 1000 Stars × 6 NC/Star
    dailyNc: 275,
    jobXpMult: 1.50,
    crimeRewardMult: 1.50,
    extraCrimeSlots: 3,
    hospitalSpeedPct: 25,
    extraGymSessions: 3,
    bankInterestBonus: 3,
    monthlyNc: 200,
    frameId: 'sub_apex_sovereign',
    chatColor: '#FFD700',
    badgeStyle: 'sovereign-rainbow',
    themes: ['cyber_dark', 'vanta_red', 'grid_blue', 'apex_gold'],
  },
};

export const NC_PACKS = [
  { id: 'nc_500',  nc: 500,  stars: 100,  bonusPct: 0,  label: 'Starter Pack'   },
  { id: 'nc_1200', nc: 1200, stars: 220,  bonusPct: 10, label: 'Runner Pack'    },
  { id: 'nc_3000', nc: 3000, stars: 500,  bonusPct: 20, label: 'Syndicate Pack' },
  { id: 'nc_7500', nc: 7500, stars: 1100, bonusPct: 30, label: 'Sovereign Pack' },
] as const;

export type NcPackId = typeof NC_PACKS[number]['id'];

/** Get active tier config from a user object. Returns null if no active sub. */
export function getActiveTier(user: {
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: Date | null;
}): TierConfig | null {
  const tier = user.subscriptionTier as SubscriptionTier | null;
  if (!tier) return null;
  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < new Date()) return null;
  return TIER_CONFIG[tier] ?? null;
}
