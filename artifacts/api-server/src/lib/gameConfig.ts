/**
 * gameConfig — cached accessor for live-tunable game economy parameters.
 *
 * Reads from MongoDB once per CACHE_TTL_MS (60 seconds), then serves from
 * an in-memory snapshot. Call invalidateGameConfig() after a write to flush
 * the cache immediately.
 */
import GameConfigModel from "../models/GameConfig";
import type { GameConfigData } from "../models/GameConfig";

export type { GameConfigData, RunOverride, JobOverride } from "../models/GameConfig";

// ── Defaults ──────────────────────────────────────────────────────────────────
export const DEFAULT_GAME_CONFIG: GameConfigData = {
  globalMultipliers: {
    dcRewardMult:  1.0,
    xpRewardMult:  1.0,
  },
  resourceCaps: {
    walletCap: 100_000_000,
    bankCap:   1_000_000_000,
  },
  crimeConfig: {
    runsPerHourCap: 30,
    runOverrides:   {},
  },
  jobConfig: {
    minigameTriggerChance: 0.30,
    jobOverrides:          {},
  },
  staffConfig: {
    tierDailyDc: { "1": 500, "2": 1_000, "3": 2_500, "4": 5_000, "5": 10_000 },
  },
};

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000; // 1 minute
let _cache: GameConfigData | null = null;
let _cacheAt = 0;

export async function getGameConfig(): Promise<GameConfigData> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;

  try {
    const doc = await GameConfigModel.findOne({ key: "main" }).lean();
    if (!doc?.value) {
      _cache = DEFAULT_GAME_CONFIG;
    } else {
      const v = doc.value as Partial<GameConfigData>;
      _cache = {
        globalMultipliers: {
          ...DEFAULT_GAME_CONFIG.globalMultipliers,
          ...(v.globalMultipliers ?? {}),
        },
        resourceCaps: {
          ...DEFAULT_GAME_CONFIG.resourceCaps,
          ...(v.resourceCaps ?? {}),
        },
        crimeConfig: {
          runsPerHourCap: v.crimeConfig?.runsPerHourCap ?? DEFAULT_GAME_CONFIG.crimeConfig.runsPerHourCap,
          runOverrides:   v.crimeConfig?.runOverrides   ?? {},
        },
        jobConfig: {
          minigameTriggerChance: v.jobConfig?.minigameTriggerChance ?? DEFAULT_GAME_CONFIG.jobConfig.minigameTriggerChance,
          jobOverrides:          v.jobConfig?.jobOverrides          ?? {},
        },
        staffConfig: {
          tierDailyDc: {
            ...DEFAULT_GAME_CONFIG.staffConfig.tierDailyDc,
            ...(v.staffConfig?.tierDailyDc ?? {}),
          },
        },
      };
    }
  } catch {
    // DB unavailable — fall back to defaults
    _cache = DEFAULT_GAME_CONFIG;
  }

  _cacheAt = Date.now();
  return _cache!;
}

/** Force the next getGameConfig() call to re-read from MongoDB. */
export function invalidateGameConfig(): void {
  _cache = null;
  _cacheAt = 0;
}

/** Persist a full or partial update to one or more top-level sections. */
export async function patchGameConfig(patch: Partial<GameConfigData>): Promise<GameConfigData> {
  const current = await getGameConfig();

  const merged: GameConfigData = {
    globalMultipliers: { ...current.globalMultipliers, ...(patch.globalMultipliers ?? {}) },
    resourceCaps:      { ...current.resourceCaps,      ...(patch.resourceCaps      ?? {}) },
    crimeConfig: {
      runsPerHourCap: patch.crimeConfig?.runsPerHourCap ?? current.crimeConfig.runsPerHourCap,
      runOverrides:   patch.crimeConfig?.runOverrides   ?? current.crimeConfig.runOverrides,
    },
    jobConfig: {
      minigameTriggerChance: patch.jobConfig?.minigameTriggerChance ?? current.jobConfig.minigameTriggerChance,
      jobOverrides:          patch.jobConfig?.jobOverrides          ?? current.jobConfig.jobOverrides,
    },
    staffConfig: {
      tierDailyDc: {
        ...current.staffConfig.tierDailyDc,
        ...(patch.staffConfig?.tierDailyDc ?? {}),
      },
    },
  };

  await GameConfigModel.findOneAndUpdate(
    { key: "main" },
    { $set: { value: merged, updatedAt: new Date() } },
    { upsert: true },
  );

  invalidateGameConfig();
  return merged;
}
