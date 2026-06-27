import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

interface DayReward {
  dc: number;
  xp: number;
  itemRarity?: "common" | "uncommon" | "rare" | "epic";
  bonus?: string;
}

const STREAK_REWARDS: Record<number, DayReward> = {
  1:  { dc: 100,  xp: 20 },
  2:  { dc: 150,  xp: 30 },
  3:  { dc: 200,  xp: 40 },
  4:  { dc: 250,  xp: 50 },
  5:  { dc: 300,  xp: 60 },
  6:  { dc: 400,  xp: 80 },
  7:  { dc: 500,  xp: 100, itemRarity: "common",   bonus: "Common Item Drop" },
  14: { dc: 1000, xp: 200, itemRarity: "uncommon", bonus: "Uncommon Item Drop" },
  21: { dc: 1500, xp: 300, itemRarity: "rare",     bonus: "Rare Item Drop" },
  30: { dc: 2000, xp: 500, itemRarity: "epic",     bonus: "Epic Item Drop" },
};

function getDayReward(streak: number): DayReward {
  if (streak >= 30 && streak % 30 === 0) return STREAK_REWARDS[30];
  if (streak >= 21 && streak % 21 === 0) return STREAK_REWARDS[21];
  if (streak >= 14 && streak % 14 === 0) return STREAK_REWARDS[14];
  if (streak >= 7 && streak % 7 === 0) return STREAK_REWARDS[7];
  const dayInCycle = ((streak - 1) % 7) + 1;
  return STREAK_REWARDS[dayInCycle] || STREAK_REWARDS[1];
}

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

const DROP_POOLS: Record<string, string[]> = {
  common:   ["Bandage", "Street Food", "Energy Drink", "Painkillers", "Fabric", "Scrap Metal"],
  uncommon: ["First Aid Kit", "Nerve Tonic", "Stimulant Pack", "Leather Jacket", "Pistol"],
  rare:     ["Medical Kit", "Super Stimulant", "Katana", "Tactical Vest", "Sports Car"],
  epic:     ["Nano Repair", "Plasma Pistol", "Nano Suit"],
};

async function grantDailyItem(userId: string, rarity: "common" | "uncommon" | "rare" | "epic"): Promise<string | null> {
  const pool = DROP_POOLS[rarity];
  if (!pool?.length) return null;
  const name = pool[Math.floor(Math.random() * pool.length)];
  await Item.create({
    owner: userId,
    name,
    type: "consumable",
    rarity,
    strengthBonus: 0,
    charismaBonus: 0,
    intelligenceBonus: 0,
    streetCredBonus: 0,
    defenseBonus: 0,
    basePrice: 0,
    quantity: 1,
  });
  return name;
}

// GET /api/daily/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId).select("lastDailyReward dailyStreak").lean();
  if (!user) return res.status(404).json({ message: "Not found" });

  const claimed = user.lastDailyReward && isSameDay(user.lastDailyReward, new Date());
  const nextStreak = (user.dailyStreak || 0) + 1;
  const nextReward = getDayReward(nextStreak);

  res.json({
    claimed: !!claimed,
    streak: user.dailyStreak,
    nextReward,
    nextClaimAt: claimed
      ? new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      : null,
    rewardSchedule: [1, 2, 3, 4, 5, 6, 7].map(d => ({ day: d, ...STREAK_REWARDS[d] })),
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

    if (user.lastDailyReward && isYesterday(user.lastDailyReward)) {
      user.dailyStreak += 1;
    } else {
      user.dailyStreak = 1;
    }

    const reward = getDayReward(user.dailyStreak);

    user.dc += reward.dc;
    user.xp += reward.xp;
    user.lastDailyReward = now;

    let itemGranted: string | null = null;
    if (reward.itemRarity) {
      itemGranted = await grantDailyItem(String(user._id), reward.itemRarity);
    }

    await user.save();

    await FeedEvent.create({
      type: "daily",
      actor: user.username,
      actorId: user._id,
      message: `${user.username} claimed Day ${user.dailyStreak} daily reward: +${reward.dc.toLocaleString()} DC${itemGranted ? ` + ${itemGranted}` : ""}`,
      dc: reward.dc,
      xp: reward.xp,
    }).catch(() => {});

    const nextClaimAt = new Date();
    nextClaimAt.setHours(24, 0, 0, 0);

    res.json({
      claimed: true,
      streak: user.dailyStreak,
      dcGained: reward.dc,
      xpGained: reward.xp,
      bonus: reward.bonus ?? null,
      itemGranted,
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
