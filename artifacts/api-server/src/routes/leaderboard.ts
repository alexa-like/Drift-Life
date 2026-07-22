import { Router } from "express";
import User from "../models/User";
import ServerConfig from "../models/ServerConfig";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { postToSystemFeed } from "../lib/systemFeed";

const router = Router();

type LBCategory = "wealth" | "level" | "arena" | "racing" | "crimes" |
  "weekly_dc" | "weekly_arena" | "weekly_races" | "prestige";

function getSortAndField(category: LBCategory) {
  switch (category) {
    case "wealth":       return { sort: { dc: -1, bankBalance: -1 } as any, metric: "totalWealth" };
    case "level":        return { sort: { level: -1, xp: -1 } as any, metric: "level" };
    case "arena":        return { sort: { wins: -1 } as any, metric: "wins" };
    case "racing":       return { sort: { raceWins: -1 } as any, metric: "raceWins" };
    case "crimes":       return { sort: { totalCrimes: -1 } as any, metric: "totalCrimes" };
    case "weekly_dc":    return { sort: { weeklyDc: -1 } as any, metric: "weeklyDc" };
    case "weekly_arena": return { sort: { weeklyArenaWins: -1 } as any, metric: "weeklyArenaWins" };
    case "weekly_races": return { sort: { weeklyRaceWins: -1 } as any, metric: "weeklyRaceWins" };
    case "prestige":     return { sort: { prestige: -1, level: -1 } as any, metric: "prestige" };
    default:             return { sort: { level: -1, xp: -1 } as any, metric: "level" };
  }
}

const BASE_SELECT = "username tag avatar avatarUrl faction level rank dc bankBalance wins losses totalFights totalCrimes raceWins reputation district equippedTitle prestige weeklyDc weeklyArenaWins weeklyRaceWins";

function formatPlayer(p: any, i: number, category: LBCategory) {
  return {
    rank: i + 1,
    id: p._id,
    username: p.username,
    tag: p.tag,
    avatar: p.avatar,
    avatarUrl: p.avatarUrl,
    faction: p.faction,
    level: p.level,
    rankTitle: p.rank,
    equippedTitle: p.equippedTitle,
    dc: p.dc,
    bankBalance: p.bankBalance,
    totalWealth: (p.dc || 0) + (p.bankBalance || 0),
    wins: p.wins,
    losses: p.losses,
    totalFights: p.totalFights,
    crimes: p.totalCrimes,
    raceWins: p.raceWins ?? 0,
    reputation: p.reputation ?? 0,
    prestige: p.prestige ?? 0,
    weeklyDc: p.weeklyDc ?? 0,
    weeklyArenaWins: p.weeklyArenaWins ?? 0,
    weeklyRaceWins: p.weeklyRaceWins ?? 0,
    district: p.district,
    metric: category,
  };
}

// Monday reset helper
function getMondayMidnightUTC(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// Lazy weekly reset — reset weekly fields for players whose weeklyReset < this Monday
async function maybeResetWeekly() {
  const monday = getMondayMidnightUTC();
  await User.updateMany(
    { $or: [{ weeklyReset: { $lt: monday } }, { weeklyReset: null }] },
    { $set: { weeklyDc: 0, weeklyArenaWins: 0, weeklyRaceWins: 0, weeklyReset: monday } }
  );
}

const WEEKLY_RECAP_KEY = "leaderboard:lastWeeklyRecap";

// Posts a top-3 recap for each weekly category to the system feed, then resets
// weekly stats. Must run BEFORE maybeResetWeekly zeroes the fields it reads.
// Idempotent per Monday — guarded by a persisted marker so re-running the
// interval (or multiple server instances) never double-posts.
// Keep the system feed to a bounded size (newest 500 non-pinned events) between
// the 30-day hard-TTL passes on FeedEvent — see models/FeedEvent.ts. Pinned
// events (e.g. weekly recap) are exempt from both the count and the cap.
export async function pruneFeed(): Promise<void> {
  const FEED_CAP = 500;
  const nonPinnedFilter = { pinned: { $ne: true } };
  const count = await FeedEvent.countDocuments(nonPinnedFilter);
  if (count <= FEED_CAP) return;
  // Find the boundary document (the FEED_CAP-th newest non-pinned event) and
  // delete everything strictly older than it — using (createdAt, _id) as a
  // stable tiebreaker. Deleting by an absolute boundary (rather than an ID
  // keep-set) means events inserted after this query runs are always newer
  // than the boundary and are never caught by the delete.
  const boundary = await FeedEvent.find(nonPinnedFilter)
    .sort({ createdAt: -1, _id: -1 })
    .skip(FEED_CAP - 1)
    .limit(1)
    .select("_id createdAt")
    .lean();
  if (boundary.length === 0) return;
  const { _id: boundaryId, createdAt: boundaryCreatedAt } = boundary[0];
  await FeedEvent.deleteMany({
    ...nonPinnedFilter,
    $or: [
      { createdAt: { $lt: boundaryCreatedAt } },
      { createdAt: boundaryCreatedAt, _id: { $lt: boundaryId } },
    ],
  });
}

export async function postWeeklyRecap(): Promise<boolean> {
  const monday = getMondayMidnightUTC();
  const marker = await ServerConfig.findOne({ key: WEEKLY_RECAP_KEY }).lean();
  const lastRecap = marker ? new Date((marker.value as any).at) : null;
  if (lastRecap && lastRecap.getTime() >= monday.getTime()) {
    return false; // already posted for this week
  }

  const categories: Array<{ field: string; label: string; emoji: string; format: (v: number) => string }> = [
    { field: "weeklyDc", label: "Top Earners", emoji: ":moneybag:", format: (v) => `${v.toLocaleString()} DC` },
    { field: "weeklyArenaWins", label: "Arena Champions", emoji: ":crossed_swords:", format: (v) => `${v} wins` },
    { field: "weeklyRaceWins", label: "Street Racing Kings", emoji: ":checkered_flag:", format: (v) => `${v} wins` },
  ];

  for (const cat of categories) {
    const top3 = await User.find({ banned: false, [cat.field]: { $gt: 0 } })
      .sort({ [cat.field]: -1 })
      .limit(3)
      .select(`username ${cat.field}`)
      .lean();
    if (top3.length === 0) continue;

    const lines = top3.map((p, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      return `${medal} @${p.username} — ${cat.format((p as any)[cat.field] ?? 0)}`;
    });
    await postToSystemFeed(
      "leaderboard_recap",
      `${cat.emoji} WEEKLY RECAP — ${cat.label}\n${lines.join("\n")}`,
      top3.map((p) => p.username),
    );
  }

  await ServerConfig.findOneAndUpdate(
    { key: WEEKLY_RECAP_KEY },
    { $set: { value: { at: new Date() } } },
    { upsert: true },
  );
  return true;
}

// GET /api/leaderboard?category=...&limit=50
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const category = ((req.query.category as string) || (req.query.type as string) || "level") as LBCategory;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    if (category.startsWith("weekly_")) {
      await maybeResetWeekly();
    }

    const { sort, metric: _m } = getSortAndField(category);

    let players: any[];
    if (category === "wealth") {
      players = await User.aggregate([
        { $match: { banned: false } },
        { $addFields: { totalWealth: { $add: ["$dc", "$bankBalance"] } } },
        { $sort: { totalWealth: -1 } },
        { $limit: limit },
      ]);
    } else {
      players = await User.find({ banned: false })
        .sort(sort)
        .limit(limit)
        .select(BASE_SELECT)
        .lean();
    }

    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(players.map((p, i) => formatPlayer(p, i, category)));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/my-rank?category=...
router.get("/my-rank", requireAuth, async (req: AuthRequest, res) => {
  try {
    const category = ((req.query.category as string) || "level") as LBCategory;

    if (category.startsWith("weekly_")) {
      await maybeResetWeekly();
    }

    const me = await User.findById(req.userId).select(BASE_SELECT).lean();
    if (!me) return res.status(404).json({ message: "User not found" });

    const { sort } = getSortAndField(category);

    // Count players ranked above me
    let query: Record<string, any> = { banned: false };
    const sortField = Object.keys(sort)[0];
    const myVal = (me as any)[sortField] ?? 0;
    query[sortField] = { $gt: myVal };

    const above = await User.countDocuments(query);
    res.json({ category, ...formatPlayer(me, above, category) });
  } catch (err: any) {
    req.log.error({ err }, "my-rank error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Legacy endpoints kept for backward compat
router.get("/level", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false }).sort({ level: -1, xp: -1 }).limit(100).select(BASE_SELECT).lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "level")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/level error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/wealth", requireAuth, async (req, res) => {
  try {
    const players = await User.aggregate([
      { $match: { banned: false } },
      { $addFields: { totalWealth: { $add: ["$dc", "$bankBalance"] } } },
      { $sort: { totalWealth: -1 } },
      { $limit: 100 },
    ]);
    res.json(players.map((p, i) => formatPlayer(p, i, "wealth")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/wealth error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pvp", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false }).sort({ wins: -1 }).limit(100).select(BASE_SELECT).lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "arena")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/pvp error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/crime", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false }).sort({ totalCrimes: -1 }).limit(100).select(BASE_SELECT).lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "crimes")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/crime error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/faction", requireAuth, async (req, res) => {
  try {
    // Dynamically import to avoid circular deps
    const { default: Faction } = await import("../models/Faction");
    const factions = await Faction.find().sort({ respect: -1, level: -1 }).limit(20).lean();
    const factionIds = factions.map(f => f._id);

    const userStats = await User.aggregate([
      { $match: { banned: false, factionId: { $in: factionIds } } },
      {
        $group: {
          _id:         "$factionId",
          players:     { $sum: 1 },
          totalLevel:  { $sum: "$level" },
          totalWins:   { $sum: "$wins" },
          totalCrimes: { $sum: "$totalCrimes" },
          totalDc:     { $sum: { $add: ["$dc", "$bankBalance"] } },
        },
      },
    ]);

    const statsMap: Record<string, { players: number; totalLevel: number; totalWins: number; totalCrimes: number; totalDc: number }> =
      Object.fromEntries(userStats.map(s => [s._id.toString(), s]));

    res.json(factions.map((f, i) => {
      const s = statsMap[f._id.toString()] ?? { players: 0, totalLevel: 0, totalWins: 0, totalCrimes: 0, totalDc: 0 };
      return {
        rank:        i + 1,
        factionId:   f._id,
        faction:     f.name,
        tag:         f.tag,
        color:       f.color,
        emblem:      f.emblem,
        players:     s.players,
        totalLevel:  s.totalLevel,
        totalWins:   s.totalWins,
        totalCrimes: s.totalCrimes,
        totalWealth: s.totalDc,
        influence:   f.respect + s.totalWins * 5 + s.totalCrimes * 2,
      };
    }));
  } catch (err: unknown) {
    req.log.error({ err }, "leaderboard/faction error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
