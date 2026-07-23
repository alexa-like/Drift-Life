/**
 * Training — Tier 1 (merged)
 * Combines the Training Center (skill bonuses) and the Gym (stat training).
 *   trainingRouter → mounted at /api/training
 *   gymRouter      → mounted at /api/gym
 */

/**
 * Training Center — Tier 7
 * Replaces old stat gym with skill-based mini-game training.
 * Three training types:
 *   - combat_drills:     costs energy, gives small permanent accuracy bonus
 *   - racing_practice:   costs energy, improves gear-shift timing window
 *   - endurance_training:costs energy, gives small energy regen speed bonus
 *
 * Daily training limit prevents instant max-out.
 */
import { Router } from "express";
import User from "../../models/User";
import { requireAuth, AuthRequest } from "../../middlewares/auth";
import { rollCityEncounter } from "../crimes/routes";

const trainingRouter = Router();

// ── Training config ───────────────────────────────────────────────────────────
const TRAINING_TYPES = {
  combat_drills: {
    label:       "Combat Drills",
    description: "Sharpen your aim. Gives a small permanent accuracy bonus.",
    energyCost:  15,
    dailyLimit:  5,
    stat:        "combatAccuracyBonus",
    gainPerRep:  0.01,   // +1% accuracy per session
    maxStat:     0.25,   // cap at +25%
    xpGain:      80,
    icon:        "🎯",
  },
  racing_practice: {
    label:       "Racing Practice",
    description: "Practice your gear shifts. Widens the green zone on the gear panel.",
    energyCost:  15,
    dailyLimit:  5,
    stat:        "raceGearBonus",
    gainPerRep:  0.01,
    maxStat:     0.25,
    xpGain:      80,
    icon:        "🏎️",
  },
  endurance_training: {
    label:       "Endurance Training",
    description: "Push your limits. Small permanent boost to energy regeneration speed.",
    energyCost:  20,
    dailyLimit:  3,
    stat:        "energyRegenBonus",
    gainPerRep:  0.005,
    maxStat:     0.15,
    xpGain:      100,
    icon:        "⚡",
  },
} as const;

type TrainingType = keyof typeof TRAINING_TYPES;

const DAILY_KEY = "trainingSessionsToday";
const RESET_KEY = "trainingResetAt";

// ── GET /api/training/ — training center info ──────────────────────────────────
trainingRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("energy maxEnergy xp level combatAccuracyBonus raceGearBonus energyRegenBonus trainingSessionsToday trainingResetAt")
      .lean();
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Reset daily counters if needed
    const now = new Date();
    const resetAt = (user as any)[RESET_KEY] as Date | null;
    const emptySession = {} as Record<TrainingType, number>;
    let sessionsToday: Record<TrainingType, number> = (user as any)[DAILY_KEY] as Record<TrainingType, number> | null ?? emptySession;
    if (!resetAt || resetAt <= now) {
      sessionsToday = emptySession;
    }

    const types = Object.entries(TRAINING_TYPES).map(([id, cfg]) => ({
      id,
      label:       cfg.label,
      description: cfg.description,
      energyCost:  cfg.energyCost,
      dailyLimit:  cfg.dailyLimit,
      sessionsToday: sessionsToday[id as TrainingType] ?? 0,
      currentBonus:  (user as any)[cfg.stat] ?? 0,
      maxBonus:      cfg.maxStat,
      icon:          cfg.icon,
      xpGain:        cfg.xpGain,
    }));

    res.json({
      energy:              user.energy,
      maxEnergy:           user.maxEnergy,
      combatAccuracyBonus: (user as any).combatAccuracyBonus ?? 0,
      raceGearBonus:       (user as any).raceGearBonus ?? 0,
      energyRegenBonus:    (user as any).energyRegenBonus ?? 0,
      trainingTypes: types,
      resetAt:       resetAt && resetAt > now ? resetAt : null,
    });
  } catch (err) {
    req.log.error({ err }, "training get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/training/train — perform a training session ─────────────────────
trainingRouter.post("/train", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { trainingType } = req.body as { trainingType: TrainingType };
    const cfg = TRAINING_TYPES[trainingType];
    if (!cfg) {
      res.status(400).json({ message: "Invalid training type" });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Reset daily counters if needed
    const now = new Date();
    const resetAt = (user as any)[RESET_KEY] as Date | null;
    if (!resetAt || resetAt <= now) {
      (user as any)[DAILY_KEY] = {};
      (user as any)[RESET_KEY] = new Date(new Date().setUTCHours(24, 0, 0, 0));
    }
    const sessionsToday: Record<string, number> = (user as any)[DAILY_KEY] ?? {};
    const todayCount = sessionsToday[trainingType] ?? 0;

    if (todayCount >= cfg.dailyLimit) {
      res.status(400).json({ message: `Daily limit reached for ${cfg.label} — come back tomorrow` });
      return;
    }

    if (user.energy < cfg.energyCost) {
      res.status(400).json({ message: `Not enough energy — need ${cfg.energyCost}` });
      return;
    }

    // Check if at max
    const currentBonus: number = (user as any)[cfg.stat] ?? 0;
    if (currentBonus >= cfg.maxStat) {
      res.status(400).json({ message: `You've reached the maximum ${cfg.label} bonus` });
      return;
    }

    // Deduct energy
    user.energy -= cfg.energyCost;

    // Grant bonus
    (user as any)[cfg.stat] = Math.min(cfg.maxStat, currentBonus + cfg.gainPerRep);

    // Grant XP
    user.xp += cfg.xpGain;

    // Update daily counters
    sessionsToday[trainingType] = todayCount + 1;
    (user as any)[DAILY_KEY] = sessionsToday;
    user.markModified(DAILY_KEY);

    await user.save();

    // ── City encounter (3% chance, 2-hour cooldown) ───────────────────────────
    let encounter: { message: string } | null = null;
    encounter = await rollCityEncounter(user).catch(() => null);
    if (encounter) await user.save();

    res.json({
      message:     `${cfg.label} complete! +${(cfg.gainPerRep * 100).toFixed(1)}% bonus`,
      newBonus:    (user as any)[cfg.stat],
      energyLeft:  user.energy,
      sessionsLeft: cfg.dailyLimit - (todayCount + 1),
      ...(encounter ? { encounter } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "training train error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Gym routes (stat training with diminishing returns)
// ────────────────────────────────────────────────────────────────────────────

import FeedEvent from "../../models/FeedEvent";
import ActionMastery from "./models/ActionMastery";
import { applyRegen, isHospitalized, isJailed, moodMultiplier } from "../../models/User";
import { energySufficientExpr, buildRegenPipeline } from "../../lib/atomicRegen";
import { getEmployerPerk } from "../../lib/employeePerks";

const gymRouter = Router();

// ── Gym catalog ─────────────────────────────────────────────────────────────
// Multipliers per stat per gym tier. Better gym = better gains on specific stats.
export const GYMS = [
  {
    id: "corner_boxing_gym",
    name: "Corner Boxing Gym",
    district: "neon_strip",
    costPerUse: 200,
    energyCostPerTrain: 3,
    minLevel: 1,
    description: "A beat-up gym in the north residential block. Basic weights and a cracked mirror.",
    multipliers: { strength: 1.0, charisma: 0.6, intelligence: 0.5, streetCred: 0.8 },
  },
  {
    id: "underground_fight_club",
    name: "Underground Fight Club",
    district: "industrial",
    costPerUse: 800,
    energyCostPerTrain: 4,
    minLevel: 10,
    description: "No cameras. No rules. Real results. Best place for Strength and Street Cred.",
    multipliers: { strength: 1.6, charisma: 0.8, intelligence: 0.6, streetCred: 1.4 },
  },
  {
    id: "elite_performance_center",
    name: "Elite Performance Center",
    district: "corp_zone",
    costPerUse: 2_500,
    energyCostPerTrain: 5,
    minLevel: 25,
    description: "Corporate-grade training facility. All stats boosted, intelligence maximised.",
    multipliers: { strength: 1.4, charisma: 1.5, intelligence: 1.8, streetCred: 1.2 },
  },
  {
    id: "grid_academy",
    name: "Grid Academy",
    district: "corp_zone",
    costPerUse: 1_500,
    energyCostPerTrain: 3,
    minLevel: 15,
    description: "Neurolink-enhanced training pods. Specialises in Intelligence and Charisma.",
    multipliers: { strength: 0.7, charisma: 1.6, intelligence: 2.0, streetCred: 0.9 },
  },
  {
    id: "outskirts_dojo",
    name: "Outskirts Dojo",
    district: "outskirts",
    costPerUse: 1_200,
    energyCostPerTrain: 4,
    minLevel: 20,
    description: "No frills, maximum grit. Street Cred and Strength specialist.",
    multipliers: { strength: 1.8, charisma: 0.7, intelligence: 0.8, streetCred: 1.9 },
  },
];

export type TrainableStat = "strength" | "charisma" | "intelligence" | "streetCred";
const VALID_STATS: TrainableStat[] = ["strength", "charisma", "intelligence", "streetCred"];
const TRAINS_PER_HOUR_CAP = 20; // anti-abuse: independent of energy cost
const DIMINISHING_CONSTANT = 50;

/**
 * Stat gain formula (Section 1b):
 * gain = (energySpent * gymMultiplier * moodMult) / (1 + currentStat / diminishingConstant)^1.5
 */
function computeGain(energySpent: number, gymMult: number, moodMult: number, currentStat: number): number {
  const denom = Math.pow(1 + currentStat / DIMINISHING_CONSTANT, 1.5);
  return (energySpent * gymMult * moodMult) / denom;
}

// ── GET /api/gym — list gyms ─────────────────────────────────────────────
gymRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level district").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(GYMS.map(g => ({
      ...g,
      available: user.level >= g.minLevel,
      districtMatch: user.district === g.district,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get gyms error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/gym/:gymId/train ─────────────────────────────────────────────
gymRouter.post("/:gymId/train", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { stat } = req.body as { stat: TrainableStat };
    if (!VALID_STATS.includes(stat)) return res.status(400).json({ message: "Invalid stat. Must be strength, charisma, intelligence, or streetCred" });

    const gym = GYMS.find(g => g.id === req.params.gymId);
    if (!gym) return res.status(404).json({ message: "Gym not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);

    if (isHospitalized(user)) return res.status(400).json({ message: "You are hospitalized" });
    if (isJailed(user)) return res.status(400).json({ message: "You are in jail" });
    if (user.level < gym.minLevel) return res.status(400).json({ message: `Requires level ${gym.minLevel}` });
    if (user.dc < gym.costPerUse) return res.status(400).json({ message: `Gym fee is ${gym.costPerUse} DC` });

    // Anti-abuse: rate-limit trains per hour (independent of energy)
    // Subscribers get extra gym sessions
    const subTier = (await import("../../lib/subscription")).getActiveTier(user as any);
    const effectiveTrainCap = TRAINS_PER_HOUR_CAP + (subTier?.extraGymSessions ?? 0);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTrains = await ActionMastery.countDocuments({
      userId: req.userId, actionType: "gym", lastAttemptAt: { $gt: oneHourAgo },
    });
    if (recentTrains >= effectiveTrainCap) {
      return res.status(429).json({ message: "Training rate limit reached. Rest and come back." });
    }

    // Atomically deduct energy
    const gated = await User.findOneAndUpdate(
      { _id: req.userId, ...energySufficientExpr(gym.energyCostPerTrain) },
      buildRegenPipeline({ energyCost: gym.energyCostPerTrain }),
      { returnDocument: 'after', updatePipeline: true },
    );
    if (!gated) return res.status(400).json({ message: `Not enough energy (need ${gym.energyCostPerTrain})` });

    const gymMult = gym.multipliers[stat];
    const moodMult = moodMultiplier(gated);
    const effectiveStats = (gated as any).getEffectiveStats();
    const currentStat = (effectiveStats as any)[stat] as number;
    const rawGain = computeGain(gym.energyCostPerTrain, gymMult, moodMult, currentStat);
    // Combat Gym employee perk: +10% stat gains (base), +20% at 3★+
    const gymPerk = await getEmployerPerk(String(req.userId), (gated as any).businessId);
    const gymPerkMult = gymPerk?.type === "combat_gym"
      ? (gymPerk.starLevel >= 3 ? 1.20 : 1.10)
      : 1.0;
    const statGain = Math.max(0.01, rawGain * gymPerkMult);

    // Deduct gym fee
    gated.dc -= gym.costPerUse;

    // Apply stat gain (accumulate fractional gains)
    const newStatRaw = currentStat + statGain;
    (gated as any)[stat] = Math.floor(newStatRaw); // floor for displayed value

    // Stress interaction: training reduces stress slightly
    gated.stress = Math.max(0, gated.stress - 2);
    gated.mood = Math.max(0, 100 - gated.stress);

    await gated.save();

    // ── City encounter (3% chance, 2-hour cooldown) ───────────────────────────
    let encounter: { message: string } | null = null;
    encounter = await rollCityEncounter(gated).catch(() => null);
    if (encounter) await gated.save();

    // Update mastery (gyms also have mastery for the minigame → reward system)
    const mastKey = `${gym.id}_${stat}`;
    let mast = await ActionMastery.findOne({ userId: req.userId, actionId: mastKey, actionType: "gym" });
    if (!mast) mast = new ActionMastery({ userId: req.userId, actionId: mastKey, actionType: "gym" });
    mast.attempts += 1;
    mast.lastAttemptAt = new Date();
    await mast.save();

    // ── Mastery milestone rewards ─────────────────────────────────────────────
    // Awarded once when the attempt count hits exactly the milestone threshold.
    const MILESTONES: Array<{ at: number; dc: number; title?: string }> = [
      { at: 10,  dc: 500,    title: `${gym.name} Regular` },
      { at: 25,  dc: 1_500 },
      { at: 50,  dc: 5_000,  title: `${stat[0].toUpperCase()}${stat.slice(1)} Veteran` },
      { at: 100, dc: 15_000, title: `${stat[0].toUpperCase()}${stat.slice(1)} Master` },
    ];
    const milestone = MILESTONES.find(m => m.at === mast.attempts);
    let milestoneReward: { dc: number; title?: string } | null = null;
    if (milestone) {
      const updates: Record<string, any> = { $inc: { dc: milestone.dc } };
      if (milestone.title) updates.$addToSet = { titles: milestone.title };
      await User.findByIdAndUpdate(req.userId, updates);
      milestoneReward = { dc: milestone.dc, title: milestone.title };
    }

    res.json({
      statGain: parseFloat(statGain.toFixed(3)),
      newStat: (gated as any)[stat],
      stat,
      gym: gym.name,
      mood: gated.mood,
      moodMultiplier: parseFloat(moodMult.toFixed(3)),
      gymMultiplier: gymMult,
      energy: gated.energy,
      dc: gated.dc,
      masteryAttempts: mast.attempts,
      milestoneReward,
      ...(encounter ? { encounter } : {}),
    });
  } catch (err: any) {
    req.log.error({ err }, "train error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default trainingRouter;
export { gymRouter };
