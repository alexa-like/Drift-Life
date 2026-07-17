import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";

import { requireAuth, AuthRequest } from "../middlewares/auth";
import { checkAchievements } from "./achievements";
import { levelUp } from "../lib/regen";
import { fireMissionEvent } from "../lib/missionEvents";

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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const DROP_POOLS: Record<string, string[]> = {
  common:   ["Bandage", "Street Food", "Energy Drink", "Painkillers", "Fabric", "Scrap Metal"],
  uncommon: ["First Aid Kit", "Nerve Tonic", "Stimulant Pack", "Leather Jacket", "Pistol"],
  rare:     ["Medical Kit", "Super Stimulant", "Katana", "Tactical Vest", "Sports Car"],
  epic:     ["Nano Repair", "Plasma Pistol", "Nano Suit"],
};

/** Grant a daily item drop — stacks quantity for consumables/materials (no duplicates). */
async function grantDailyItem(userId: string, rarity: "common" | "uncommon" | "rare" | "epic"): Promise<string | null> {
  const pool = DROP_POOLS[rarity];
  if (!pool?.length) return null;
  const name = pool[Math.floor(Math.random() * pool.length)];
  // Upsert: stack consumables instead of creating duplicate documents
  await Item.findOneAndUpdate(
    { owner: userId, name, type: "consumable", rarity },
    {
      $inc: { quantity: 1 },
      $setOnInsert: {
        owner: userId,
        name,
        type: "consumable",
        rarity,
        strengthBonus: 0,
        charismaBonus: 0,
        intelligenceBonus: 0,
        streetCredBonus: 0,
        basePrice: 0,
      },
    },
    { upsert: true },
  );
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
    const now = new Date();
    const todayStart = startOfToday();

    // ATOMIC: claim gate — only succeeds if lastDailyReward is null or before today
    // Returns the OLD document (before: true is NOT used) so we can compute streak from previous state
    const oldUser = await User.findOneAndUpdate(
      {
        _id: req.userId,
        $or: [
          { lastDailyReward: null },
          { lastDailyReward: { $lt: todayStart } },
        ],
      },
      { $set: { lastDailyReward: now } }, // Mark claimed immediately to block concurrent requests
      { new: false },                      // Return OLD doc to read previous lastDailyReward
    );

    if (!oldUser) {
      return res.status(400).json({ message: "Already claimed today" });
    }

    // Compute new streak from previous claim date
    let newStreak: number;
    if (oldUser.lastDailyReward && isYesterday(oldUser.lastDailyReward)) {
      newStreak = (oldUser.dailyStreak || 0) + 1;
    } else {
      newStreak = 1;
    }

    const reward = getDayReward(newStreak);
    // Apply DC (capped), XP, streak — aggregation pipeline enforces wallet cap atomically
    // Use oldUser._id (ObjectId) — consistent with crimes/jobs; avoids Mongoose 9 string-cast edge cases
    const updated = await User.findByIdAndUpdate(
      oldUser._id,
      [{ $set: {
        dc:          { $min: [{ $add: ["$dc", reward.dc] }, 100_000_000] },
        xp:          { $add: ["$xp", reward.xp] },
        dailyStreak: newStreak,
      }}],
      { returnDocument: 'after', updatePipeline: true },
    );
    if (!updated) return res.status(500).json({ message: "Internal server error" });

    // Level-up check — use findByIdAndUpdate instead of .save() to avoid stale-document
    // conflicts in Mongoose 9 (doc was already touched by the first findOneAndUpdate)
    const leveled = levelUp(updated);
    if (leveled) {
      await User.findByIdAndUpdate(oldUser._id, {
        $set: {
          xp: updated.xp,
          level: updated.level,
          xpToNext: updated.xpToNext,
          rank: updated.rank,
          maxEnergy: updated.maxEnergy,
          maxNerve: updated.maxNerve,
          skillPoints: updated.skillPoints,
        },
      });
    }

    // Item drop — isolated so a failed grant on milestone days never aborts the whole claim
    let itemGranted: string | null = null;
    if (reward.itemRarity) {
      try {
        itemGranted = await grantDailyItem(String(oldUser._id), reward.itemRarity);
      } catch (itemErr: any) {
        req.log.warn({ itemErr }, "daily item grant failed — reward still applied");
      }
    }

    checkAchievements(String(req.userId)).catch(() => {});
    fireMissionEvent(String(req.userId), "login").catch(() => {});

    // daily rewards are private — no feed post

    const nextClaimAt = new Date();
    nextClaimAt.setHours(24, 0, 0, 0);

    res.json({
      claimed: true,
      streak: newStreak,
      dcGained: reward.dc,
      xpGained: reward.xp,
      bonus: reward.bonus ?? null,
      itemGranted,
      dc: updated.dc,
      xp: updated.xp,
      leveled,
      newLevel: leveled ? updated.level : undefined,
      nextClaimAt: nextClaimAt.toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "daily claim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
