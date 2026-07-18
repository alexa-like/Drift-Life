import mongoose, { Schema, Document } from "mongoose";

/**
 * GameConfig — single-document store for all live-tunable economy parameters.
 * One document with key "main" holds the entire game config.
 * Routes read via lib/gameConfig.ts (60-second in-memory cache).
 */

export interface RunOverride {
  dcMin?: number;
  dcMax?: number;
  xp?: number;
  energyCost?: number;
  baseSuccess?: number;
}

export interface JobOverride {
  dcMin?: number;
  dcMax?: number;
  xpPerJob?: number;
  energyCost?: number;
  cooldownMin?: number;
}

export interface GameConfigData {
  globalMultipliers: {
    /** Permanent multiplier applied to all crime & job DC payouts (default 1.0). */
    dcRewardMult: number;
    /** Permanent multiplier applied to all crime & job XP payouts (default 1.0). */
    xpRewardMult: number;
  };
  resourceCaps: {
    /** Maximum DC a player can hold in their wallet (default 100,000,000). */
    walletCap: number;
    /** Maximum DC a player can hold in their bank (default 1,000,000,000). */
    bankCap: number;
  };
  crimeConfig: {
    /** Maximum run attempts per player per hour (default 30). */
    runsPerHourCap: number;
    /** Per-run overrides keyed by run id. Empty object = use hardcoded defaults. */
    runOverrides: Record<string, RunOverride>;
  };
  jobConfig: {
    /** Probability that a completed job triggers a minigame bonus (default 0.30). */
    minigameTriggerChance: number;
    /** Per-job overrides keyed by job id. Empty object = use hardcoded defaults. */
    jobOverrides: Record<string, JobOverride>;
  };
  staffConfig: {
    /** Daily DC earnings per staff tier (keys: "1"–"5"). Defaults: 500/1000/2500/5000/10000. */
    tierDailyDc: Record<string, number>;
  };
}

export interface IGameConfig extends Document {
  key: string;
  value: GameConfigData;
  updatedAt: Date;
}

const GameConfigSchema = new Schema<IGameConfig>({
  key:       { type: String, required: true, unique: true },
  value:     { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IGameConfig>("GameConfig", GameConfigSchema);
