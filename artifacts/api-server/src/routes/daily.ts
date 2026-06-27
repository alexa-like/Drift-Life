import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const STREAK_REWARDS = [
  { dc: 1000, xp: 50, bonus: null },   // Day 1
  { dc: 2000, xp: 100, bonus: null },  // Day 2
  { dc: 3000, xp: 150, bonus: "10 Energy" }, // Day 3
  { dc: 5000, xp: 250, bonus: "5 Nerve" },   // Day 4
  { dc: 8000, xp: 400, bonus: "HP Full" },   // Day 5
  { dc: 12000, xp: 600, bonus: "2x DC Bonus" }, // Day 6
  { dc: 20000, xp: 1000, bonus: "Rare Loot Drop" }, // Day 7
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isYesterday(date: Date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

// GET /api/daily/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("lastDailyReward dailyStreak").lean();
  if (!user) return res.status(404).json({ message: "Not found" });

  const claimed = user.lastDailyReward && isSameDay(user.lastDailyReward, new Date());
  const nextReward = STREAK_REWARDS[Math.min((user.dailyStreak) % 7, 6)];

  res.json({
    claimed: !!claimed,
    streak: user.dailyStreak,
    nextReward,
    nextClaimAt: claimed
      ? new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      : null,
  });
});

// POST /api/daily/claim
router.post("/claim", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Not found" });

    const now = new Date();
    if (user.lastDailyReward && isSameDay(user.lastDailyReward, now))
      return res.status(400).json({ message: "Already claimed today" });

    // Check streak continuity
    if (user.lastDailyReward && isYesterday(user.lastDailyReward)) {
      user.dailyStreak += 1;
    } else {
      user.dailyStreak = 1;
    }

    const rewardIdx = Math.min((user.dailyStreak - 1) % 7, 6);
    const reward = STREAK_REWARDS[rewardIdx];

    // Day 5: full heal bonus
    if (reward.bonus === "HP Full") {
      user.health = user.maxHealth;
    }
    // Day 3: energy bonus
    if (reward.bonus === "10 Energy") {
      user.energy = Math.min(user.maxEnergy, user.energy + 10);
    }
    // Day 4: nerve bonus
    if (reward.bonus === "5 Nerve") {
      user.nerve = Math.min(user.maxNerve, user.nerve + 5);
    }
    // Day 6: 2x DC bonus (already doubled in the reward table, just flag it)

    let totalDc = reward.dc;
    // Day 7: rare loot drop - extra DC as placeholder
    if (reward.bonus === "Rare Loot Drop") {
      totalDc += 5000;
    }

    user.dc += totalDc;
    user.xp += reward.xp;
    user.lastDailyReward = now;
    await user.save();

    await FeedEvent.create({
      type: "daily",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} claimed Day ${user.dailyStreak} daily reward: +${totalDc.toLocaleString()} DC`,
      dc: totalDc,
      xp: reward.xp,
    });

    const nextClaimAt = new Date();
    nextClaimAt.setHours(24, 0, 0, 0);

    res.json({
      claimed: true,
      streak: user.dailyStreak,
      dcGained: totalDc,
      xpGained: reward.xp,
      bonus: reward.bonus,
      dc: user.dc,
      xp: user.xp,
      nextClaimAt: nextClaimAt.toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "daily claim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
