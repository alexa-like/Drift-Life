/**
 * Mini-Game Leaderboard — Tier 6
 * Weekly leaderboards for combat and racing.
 * Resets every Monday 00:00 UTC. Top 3 get rewards.
 *
 * GET  /api/mini-leaderboard/:type
 * GET  /api/mini-leaderboard/me
 * POST /api/mini-leaderboard/reset  (owner only — manual trigger)
 */
import { Router } from "express";
import MiniGameLeaderboard, { LeaderboardType } from "../models/MiniGameLeaderboard";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, requireOwner, AuthRequest } from "../middlewares/auth";

const router = Router();

const LEADERBOARD_TYPES: LeaderboardType[] = [
  "combat_wins", "combat_streak", "race_wins", "race_fastest_2p", "race_fastest_4p",
];

const LEADERBOARD_LABELS: Record<LeaderboardType, string> = {
  combat_wins:      "Combat Wins (Weekly)",
  combat_streak:    "Combat Win Streak (Weekly)",
  race_wins:        "Race Wins (Weekly)",
  race_fastest_2p:  "Fastest Race — 2-Player",
  race_fastest_4p:  "Fastest Race — 4-Player",
};

// Lower is better for time-based boards
const ASCENDING: LeaderboardType[] = ["race_fastest_2p", "race_fastest_4p"];

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── GET /api/mini-leaderboard/:type ──────────────────────────────────────────
router.get("/:type", requireAuth, async (req: AuthRequest, res) => {
  try {
    const type = req.params["type"] as LeaderboardType;
    if (!LEADERBOARD_TYPES.includes(type)) {
      res.status(400).json({ message: "Invalid leaderboard type" });
      return;
    }

    const weekStart = getWeekStart();
    const sortDir = ASCENDING.includes(type) ? 1 : -1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const entries = await MiniGameLeaderboard.find({ leaderboardType: type, weekStart })
      .sort({ score: sortDir })
      .limit(limit)
      .lean();

    // Add rank
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));

    // Find current user's position
    const myEntry = await MiniGameLeaderboard.findOne({ leaderboardType: type, userId: req.userId, weekStart }).lean();
    let myRank: number | null = null;
    if (myEntry) {
      const count = ASCENDING.includes(type)
        ? await MiniGameLeaderboard.countDocuments({ leaderboardType: type, weekStart, score: { $lt: myEntry.score } })
        : await MiniGameLeaderboard.countDocuments({ leaderboardType: type, weekStart, score: { $gt: myEntry.score } });
      myRank = count + 1;
    }

    // Weekly reset time
    const nextReset = new Date(weekStart);
    nextReset.setUTCDate(nextReset.getUTCDate() + 7);

    res.json({
      type,
      label: LEADERBOARD_LABELS[type],
      weekStart,
      nextReset,
      entries: ranked,
      myEntry: myEntry ? { ...myEntry, rank: myRank } : null,
    });
  } catch (err) {
    req.log.error({ err }, "mini-leaderboard get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/mini-leaderboard/me — all my positions ──────────────────────────
router.get("/me/all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const weekStart = getWeekStart();
    const myEntries = await MiniGameLeaderboard.find({ userId: req.userId, weekStart }).lean();
    const result: Record<string, unknown> = {};
    for (const e of myEntries) {
      result[e.leaderboardType] = e;
    }
    res.json({ positions: result });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Weekly reset + reward job ─────────────────────────────────────────────────
// weekStart = the Monday that JUST ended (previous week).
// Uses an atomic claim (findOneAndUpdate rewardGranted: false → true) before
// granting currency, so concurrent runners or a manual + scheduled overlap
// cannot double-pay the same entry.
async function runWeeklyReset(weekStart: Date) {
  const REWARDS: Record<number, { keys: number; dc: number }> = {
    1: { keys: 5, dc: 5_000 },
    2: { keys: 3, dc: 2_000 },
    3: { keys: 1, dc: 1_000 },
  };

  for (const type of LEADERBOARD_TYPES) {
    const sortDir = ASCENDING.includes(type) ? 1 : -1;
    // Fetch top 3 candidates (may include already-claimed entries from a
    // previous concurrent run — we guard against that with atomic claim below)
    const top3 = await MiniGameLeaderboard.find({ leaderboardType: type, weekStart })
      .sort({ score: sortDir })
      .limit(3)
      .lean();

    for (let i = 0; i < top3.length; i++) {
      const entry = top3[i];
      const rank = i + 1;
      const reward = REWARDS[rank];
      if (!reward) continue;

      // Atomic claim: only proceeds if rewardGranted is still false.
      // If another runner already claimed this entry, modifiedCount === 0 → skip.
      const claim = await MiniGameLeaderboard.updateOne(
        { _id: entry._id, rewardGranted: { $ne: true } },
        { $set: { rewardGranted: true } },
      );
      if (claim.modifiedCount === 0) continue; // already claimed — skip

      await User.updateOne({ _id: entry.userId }, { $inc: { keys: reward.keys, dc: reward.dc } });

      await Notification.create({
        userId: entry.userId,
        type:   "system",
        message: `Leaderboard #${rank} (${LEADERBOARD_LABELS[type]}): claimed +${reward.keys} Keys + ${reward.dc.toLocaleString()} DC`,
        read:    false,
        createdAt: new Date(),
      });
    }
  }
}

// Returns the start of the previous (just-ended) week — used by both the
// scheduled job and the manual owner endpoint so they target the same data.
function getPreviousWeekStart(): Date {
  const d = getWeekStart();
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

// ── POST /api/mini-leaderboard/reset (owner) ─────────────────────────────────
router.post("/reset", requireOwner, async (req: AuthRequest, res) => {
  try {
    const weekStart = getPreviousWeekStart();
    await runWeeklyReset(weekStart);
    res.json({ message: "Weekly reset complete" });
  } catch (err) {
    req.log.error({ err }, "mini-leaderboard reset error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Auto-run weekly reset on Monday 00:00 UTC ─────────────────────────────────
function scheduleWeeklyReset() {
  const now = new Date();
  const nextMonday = getWeekStart();
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const delay = nextMonday.getTime() - now.getTime();

  setTimeout(async () => {
    await runWeeklyReset(getPreviousWeekStart()).catch(console.error);
    scheduleWeeklyReset();
  }, delay);
}
scheduleWeeklyReset();

export default router;
