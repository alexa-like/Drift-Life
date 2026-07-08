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
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

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
router.get("/", requireAuth, async (req: AuthRequest, res) => {
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
router.post("/train", requireAuth, async (req: AuthRequest, res) => {
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

    await user.save();

    res.json({
      message:     `${cfg.label} complete! +${(cfg.gainPerRep * 100).toFixed(1)}% bonus`,
      newBonus:    (user as any)[cfg.stat],
      energyLeft:  user.energy,
      sessionsLeft: cfg.dailyLimit - (todayCount + 1),
    });
  } catch (err) {
    req.log.error({ err }, "training train error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
