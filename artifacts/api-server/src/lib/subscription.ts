// ─── Subscription Tier Config ────────────────────────────────────────────────
// Single source of truth for all tier perks — never store these values on the
// user document. Always derive perks from the tier enum at runtime.

export type SubscriptionTier = 'street_runner' | 'neon_syndicate' | 'apex_sovereign';

export interface TierConfig {
  name: string;
  starsPerMonth: number;
  /** UC cost when purchasing subscription directly in-game (not via Telegram Stars).
   *  Priced at 6 UC per Star — mildly favourable vs the starter pack rate (5 UC/Star)
   *  but not so cheap it trivialises Stars purchases. */
  ucPrice: number;
  dailyUc: number;              // UC granted per daily claim
  jobXpMult: number;            // applied to xpGained in jobs
  crimeRewardMult: number;      // applied to dcGained in crimes
  extraCrimeSlots: number;      // added to RUNS_PER_HOUR_CAP
  hospitalSpeedPct: number;     // % reduction in hospitalization duration
  extraGymSessions: number;     // added to TRAINS_PER_HOUR_CAP
  bankInterestBonus: number;    // extra % interest on bank balance (not currently used)
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
    ucPrice: 1500,   // 250 Stars × 6 UC/Star
    dailyUc: 60,
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
    ucPrice: 3000,   // 500 Stars × 6 UC/Star
    dailyUc: 130,
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
    ucPrice: 6000,   // 1000 Stars × 6 UC/Star
    dailyUc: 275,
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

export const UC_PACKS = [
  { id: 'uc_500',  uc: 500,  stars: 100,  bonusPct: 0,  label: 'Starter Pack'   },
  { id: 'uc_1200', uc: 1200, stars: 220,  bonusPct: 10, label: 'Runner Pack'    },
  { id: 'uc_3000', uc: 3000, stars: 500,  bonusPct: 20, label: 'Syndicate Pack' },
  { id: 'uc_7500', uc: 7500, stars: 1100, bonusPct: 30, label: 'Sovereign Pack' },
] as const;

export type UcPackId = typeof UC_PACKS[number]['id'];

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
