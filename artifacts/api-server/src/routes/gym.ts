/**
 * Gym — Wire Cartel Section 1b
 * Player stat training with diminishing returns, mood multiplier, and anti-abuse rate limiting.
 */
import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import ActionMastery from "../models/ActionMastery";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed, moodMultiplier } from "../models/User";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";

const router = Router();

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
router.get("/", requireAuth, async (req: AuthRequest, res) => {
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
router.post("/:gymId/train", requireAuth, async (req: AuthRequest, res) => {
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
    const subTier = (await import("../lib/subscription")).getActiveTier(user as any);
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
      { new: true },
    );
    if (!gated) return res.status(400).json({ message: `Not enough energy (need ${gym.energyCostPerTrain})` });

    const gymMult = gym.multipliers[stat];
    const moodMult = moodMultiplier(gated);
    const currentStat = (gated as any)[stat] as number;
    const rawGain = computeGain(gym.energyCostPerTrain, gymMult, moodMult, currentStat);
    const statGain = Math.max(0.01, rawGain);

    // Deduct gym fee
    gated.dc -= gym.costPerUse;

    // Apply stat gain (accumulate fractional gains)
    const newStatRaw = currentStat + statGain;
    (gated as any)[stat] = Math.floor(newStatRaw); // floor for displayed value

    // Stress interaction: training reduces stress slightly
    gated.stress = Math.max(0, gated.stress - 2);
    gated.mood = Math.max(0, 100 - gated.stress);

    await gated.save();

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
    });
  } catch (err: any) {
    req.log.error({ err }, "train error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
