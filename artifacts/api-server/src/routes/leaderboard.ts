import { Router } from "express";
import User from "../models/User";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/leaderboard
router.get("/", requireAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || "level";
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    let sort: Record<string, -1> = { level: -1, xp: -1 };
    if (type === "dc") sort = { dc: -1 };
    else if (type === "wins") sort = { wins: -1 };
    else if (type === "crimes") sort = { successfulCrimes: -1 };

    const players = await User.find({ banned: false })
      .sort(sort)
      .limit(limit)
      .select("username avatar level rank dc wins losses successfulCrimes district")
      .lean();

    res.json(players.map((p, i) => ({
      rank: i + 1,
      id: p._id,
      username: p.username,
      avatar: p.avatar,
      level: p.level,
      rankTitle: p.rank,
      dc: p.dc,
      wins: p.wins,
      losses: p.losses,
      crimes: p.successfulCrimes,
      district: p.district,
    })));
  } catch (err: any) {
    req.log.error({ err }, "leaderboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
