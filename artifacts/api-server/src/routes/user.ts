import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { safeUser } from "./auth";

const router = Router();

// GET /api/user/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "get me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/user/me
router.patch("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { avatar } = req.body;
    if (avatar) user.avatar = avatar;
    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "patch me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/:username
router.get("/:username", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "Player not found" });
    res.json({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      rank: user.rank,
      district: user.district,
      wins: user.wins,
      losses: user.losses,
      totalCrimes: user.totalCrimes,
      gang: user.gang,
      wantedLevel: user.wantedLevel,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "get user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
