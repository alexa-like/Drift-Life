import { Router } from "express";
import User from "../models/User";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function formatPlayer(p: any, i: number, metric: string) {
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
    crimes: p.successfulCrimes,
    reputation: p.reputation ?? 0,
    district: p.district,
    metric,
  };
}

// GET /api/leaderboard — generic with type query
router.get("/", requireAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || "level";
    const limit = Math.min(Number(req.query.limit) || 100, 100);
    let sort: Record<string, -1 | 1> = { level: -1, xp: -1 };
    if (type === "wealth" || type === "dc") sort = { dc: -1, bankBalance: -1 };
    else if (type === "pvp" || type === "wins") sort = { wins: -1 };
    else if (type === "crime" || type === "crimes") sort = { successfulCrimes: -1 };

    const players = await User.find({ banned: false })
      .sort(sort as any)
      .limit(limit)
      .select("username tag avatar avatarUrl faction level rank dc bankBalance wins losses totalFights successfulCrimes reputation district equippedTitle")
      .lean();

    res.json(players.map((p, i) => formatPlayer(p, i, type)));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/level — top 100 by level then XP
router.get("/level", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false })
      .sort({ level: -1, xp: -1 })
      .limit(100)
      .select("username tag avatar avatarUrl faction level rank dc bankBalance wins losses totalFights successfulCrimes reputation district equippedTitle")
      .lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "level")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/level error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/wealth — top 100 by total DC (wallet + bank)
router.get("/wealth", requireAuth, async (req, res) => {
  try {
    const players = await User.aggregate([
      { $match: { banned: false } },
      { $addFields: { totalWealth: { $add: ["$dc", "$bankBalance"] } } },
      { $sort: { totalWealth: -1 } },
      { $limit: 100 },
      { $project: { username: 1, tag: 1, avatar: 1, avatarUrl: 1, faction: 1, level: 1, rank: 1, dc: 1, bankBalance: 1, totalWealth: 1, wins: 1, losses: 1, totalFights: 1, successfulCrimes: 1, reputation: 1, district: 1, equippedTitle: 1 } },
    ]);
    res.json(players.map((p, i) => formatPlayer(p, i, "wealth")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/wealth error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/pvp — top 100 PvP wins
router.get("/pvp", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false })
      .sort({ wins: -1 })
      .limit(100)
      .select("username tag avatar avatarUrl faction level rank dc bankBalance wins losses totalFights successfulCrimes reputation district equippedTitle")
      .lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "pvp")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/pvp error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/crime — top 100 total crimes
router.get("/crime", requireAuth, async (req, res) => {
  try {
    const players = await User.find({ banned: false })
      .sort({ successfulCrimes: -1 })
      .limit(100)
      .select("username tag avatar avatarUrl faction level rank dc bankBalance wins losses totalFights successfulCrimes reputation district equippedTitle")
      .lean();
    res.json(players.map((p, i) => formatPlayer(p, i, "crime")));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/crime error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/leaderboard/faction — faction influence by district control
router.get("/faction", requireAuth, async (req, res) => {
  try {
    const factionStats = await User.aggregate([
      { $match: { banned: false, faction: { $ne: null } } },
      { $group: {
        _id: "$faction",
        players: { $sum: 1 },
        totalLevel: { $sum: "$level" },
        totalWins: { $sum: "$wins" },
        totalCrimes: { $sum: "$successfulCrimes" },
        totalDc: { $sum: { $add: ["$dc", "$bankBalance"] } },
      }},
      { $sort: { totalLevel: -1 } },
    ]);
    res.json(factionStats.map((f, i) => ({
      rank: i + 1,
      faction: f._id,
      players: f.players,
      totalLevel: f.totalLevel,
      totalWins: f.totalWins,
      totalCrimes: f.totalCrimes,
      totalWealth: f.totalDc,
      influence: f.totalLevel + f.totalWins * 2 + f.totalCrimes,
    })));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard/faction error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
