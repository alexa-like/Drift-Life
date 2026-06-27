import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { safeUser } from "./auth";
import bcrypt from "bcryptjs";

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
    const { avatar, avatarUrl, bio, equippedFrame, equippedTitle } = req.body;
    if (avatar !== undefined) user.avatar = String(avatar);
    if (avatarUrl !== undefined) {
      // Only allow Pollinations AI URLs or null
      if (avatarUrl === null || avatarUrl === "") {
        user.avatarUrl = null;
      } else if (typeof avatarUrl === "string" && avatarUrl.startsWith("https://image.pollinations.ai/")) {
        user.avatarUrl = avatarUrl;
      } else {
        return res.status(400).json({ message: "Avatar URL must be from image.pollinations.ai" });
      }
    }
    if (bio !== undefined) user.bio = String(bio).slice(0, 300);
    if (equippedFrame !== undefined) user.equippedFrame = equippedFrame;
    if (equippedTitle !== undefined && user.titles.includes(equippedTitle)) user.equippedTitle = equippedTitle;
    await user.save();
    res.json(safeUser(user));
  } catch (err: any) {
    req.log.error({ err }, "patch me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/change-password
router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "currentPassword and newPassword required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: "Password updated" });
  } catch (err: any) {
    req.log.error({ err }, "change-password error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/search?q=username
router.get("/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) return res.status(400).json({ message: "Query must be at least 2 characters" });
    const users = await User.find({
      username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      banned: false,
      isEmailVerified: true,
    })
      .select("username avatar faction level rank district equippedFrame tag")
      .limit(10)
      .lean();
    res.json(users.map(u => ({ id: u._id, username: u.username, avatar: u.avatar, faction: (u as any).faction, level: u.level, rank: u.rank, district: u.district, equippedFrame: (u as any).equippedFrame, tag: (u as any).tag })));
  } catch (err: any) {
    req.log.error({ err }, "search error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/profile/:id — by ObjectId (for PlayerInspectModal)
router.get("/profile/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.params.id).where({ banned: false });
    if (!user) return res.status(404).json({ message: "Player not found" });
    const equippedItems = await Item.find({ owner: user._id, equipped: true }).lean();
    res.json({
      id: user._id,
      username: user.username,
      tag: user.tag,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      faction: user.faction,
      level: user.level,
      xp: user.xp,
      xpToNext: user.xpToNext,
      prestige: user.prestige,
      rank: user.rank,
      district: user.district,
      strength: user.strength,
      charisma: user.charisma,
      intelligence: user.intelligence,
      streetCred: user.streetCred,
      wins: user.wins,
      losses: user.losses,
      totalCrimes: user.totalCrimes,
      successfulCrimes: user.successfulCrimes,
      equippedFrame: user.equippedFrame,
      equippedTitle: user.equippedTitle,
      titles: user.titles,
      equippedItems,
    });
  } catch (err: any) {
    req.log.error({ err }, "get profile by id error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/equip-frame
router.post("/equip-frame", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { frameId } = req.body;
    if (frameId !== null && frameId !== undefined) {
      if (!(user as any).ownedFrames?.includes(frameId)) {
        return res.status(403).json({ message: "You don't own that frame" });
      }
    }
    (user as any).equippedFrame = frameId ?? null;
    if (frameId) {
      const { FRAME_CATALOG } = await import("./frames");
      const frame = FRAME_CATALOG.find((f: any) => f.frameId === frameId);
      if (frame) (user as any).equippedFrameRarity = frame.rarity;
    } else {
      (user as any).equippedFrameRarity = null;
    }
    await user.save();
    res.json({ equippedFrame: (user as any).equippedFrame, equippedFrameRarity: (user as any).equippedFrameRarity });
  } catch (err: any) {
    req.log.error({ err }, "equip frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/:username
router.get("/:username", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ username: req.params.username, banned: false });
    if (!user) return res.status(404).json({ message: "Player not found" });

    // Get equipped items
    const equippedItems = await Item.find({
      owner: user._id,
      equipped: true,
    }).lean();

    res.json({
      id: user._id,
      username: user.username,
      tag: user.tag,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      faction: user.faction,
      level: user.level,
      xp: user.xp,
      xpToNext: user.xpToNext,
      rank: user.rank,
      district: user.district,
      strength: user.strength,
      charisma: user.charisma,
      intelligence: user.intelligence,
      streetCred: user.streetCred,
      wins: user.wins,
      losses: user.losses,
      totalCrimes: user.totalCrimes,
      successfulCrimes: user.successfulCrimes,
      wantedLevel: user.wantedLevel,
      gang: user.gang,
      equippedFrame: user.equippedFrame,
      equippedTitle: user.equippedTitle,
      titles: user.titles,
      equippedItems,
      isHospitalized: !!(user.hospitalizedUntil && user.hospitalizedUntil > new Date()),
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "get user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
