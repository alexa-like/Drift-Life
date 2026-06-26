import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const STREAK_REWARDS = [
  { dc: 200, xp: 20 },  // Day 1
  { dc: 300, xp: 30 },  // Day 2
  { dc: 400, xp: 40 },  // Day 3
  { dc: 500, xp: 50 },  // Day 4
  { dc: 600, xp: 60 },  // Day 5
  { dc: 750, xp: 75 },  // Day 6
  { dc: 1000, xp: 100 }, // Day 7
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
    user.dc += reward.dc;
    user.xp += reward.xp;
    user.lastDailyReward = now;
    await user.save();

    await FeedEvent.create({
      type: "system",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} claimed their day ${user.dailyStreak} daily reward: +${reward.dc} DC`,
      dc: reward.dc,
      xp: reward.xp,
    });

    res.json({
      claimed: true,
      streak: user.dailyStreak,
      dcGained: reward.dc,
      xpGained: reward.xp,
      dc: user.dc,
      xp: user.xp,
    });
  } catch (err: any) {
    req.log.error({ err }, "daily claim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
