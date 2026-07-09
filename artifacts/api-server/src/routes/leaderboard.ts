import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

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
    res.json({ rank: above + 1, category, ...formatPlayer(me, above, category) });
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
    const factionStats = await User.aggregate([
      { $match: { banned: false, faction: { $ne: null } } },
      { $group: {
        _id: "$faction",
        players: { $sum: 1 },
        totalLevel: { $sum: "$level" },
        totalWins: { $sum: "$wins" },
        totalCrimes: { $sum: "$totalCrimes" },
        totalDc: { $sum: { $add: ["$dc", "$bankBalance"] } },
      }},
      { $sort: { totalLevel: -1 } },
    ]);
    res.json(factionStats.map((f, i) => ({
      rank: i + 1, faction: f._id, players: f.players,
      totalLevel: f.totalLevel, totalWins: f.totalWins,
      totalCrimes: f.totalCrimes, totalWealth: f.totalDc,
      influence: f.totalLevel + f.totalWins * 2 + f.totalCrimes,
    })));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/faction error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
