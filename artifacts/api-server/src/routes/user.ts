import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { safeUser } from "./auth";
import bcrypt from "bcryptjs";

function stripHtml(raw: unknown): string {
  return sanitizeHtml(String(raw ?? ""), { allowedTags: [], allowedAttributes: {} });
}

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
    const { avatar, avatarUrl, bio, equippedTitle } = req.body;
    if (avatar !== undefined) user.avatar = String(avatar);
    if (avatarUrl !== undefined) {
      if (avatarUrl === null || avatarUrl === "") {
        user.avatarUrl = null;
      } else if (typeof avatarUrl === "string" && avatarUrl.startsWith("https://image.pollinations.ai/")) {
        user.avatarUrl = avatarUrl;
      } else {
        return res.status(400).json({ message: "Avatar URL must be from image.pollinations.ai" });
      }
    }
    if (bio !== undefined) user.bio = stripHtml(bio).slice(0, 300);
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
      .select("username avatar faction level rank district tag")
      .limit(10)
      .lean();
    res.json(users.map(u => ({ id: u._id, username: u.username, avatar: u.avatar, faction: (u as any).faction, level: u.level, rank: u.rank, district: u.district, tag: (u as any).tag })));
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
      equippedTitle: user.equippedTitle,
      titles: user.titles,
      equippedItems,
      onlineStatus: (() => {
        if (user.appearOffline) return "offline";
        const ms = Date.now() - new Date(user.lastActiveAt || 0).getTime();
        if (ms < 5 * 60 * 1000) return "online";
        if (ms < 30 * 60 * 1000) return "away";
        return "offline";
      })(),
    });
  } catch (err: any) {
    req.log.error({ err }, "get profile by id error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/profile — own profile summary
router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const equippedItems = await Item.find({
      _id: { $in: [user.equippedWeapon, user.equippedArmor, user.equippedClothing, user.equippedVehicle].filter(Boolean) },
      owner: user._id,
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
      prestige: user.prestige,
      rank: user.rank,
      district: user.district,
      equippedTitle: user.equippedTitle,
      titles: user.titles,
      equippedItems,
      wins: user.wins,
      losses: user.losses,
      totalCrimes: user.totalCrimes,
      successfulCrimes: user.successfulCrimes,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "get own profile error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/garage — own vehicles
router.get("/garage", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("_id equippedVehicle");
    if (!user) return res.status(404).json({ message: "User not found" });
    const vehicles = await Item.find({ owner: user._id, type: "vehicle" }).lean();
    res.json({
      vehicles,
      equippedVehicle: user.equippedVehicle ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "get garage error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/inventory — own items (all types)
router.get("/inventory", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("_id equippedWeapon equippedArmor equippedClothing equippedVehicle");
    if (!user) return res.status(404).json({ message: "User not found" });
    const items = await Item.find({ owner: user._id }).sort({ createdAt: -1 }).lean();
    res.json({
      items,
      equipped: {
        weapon: user.equippedWeapon ?? null,
        armor: user.equippedArmor ?? null,
        clothing: user.equippedClothing ?? null,
        vehicle: user.equippedVehicle ?? null,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "get inventory error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/wallet — own financial data
router.get("/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("dc nc bankBalance");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      dc: user.dc,
      nc: user.nc,
      bankBalance: user.bankBalance,
      total: user.dc + user.bankBalance,
    });
  } catch (err: any) {
    req.log.error({ err }, "get wallet error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/user/stats — own combat/crime stats
router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "strength charisma intelligence streetCred wins losses totalFights totalCrimes successfulCrimes wantedLevel level rank prestige merit skillPoints"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      strength: user.strength,
      charisma: user.charisma,
      intelligence: user.intelligence,
      streetCred: user.streetCred,
      wins: user.wins,
      losses: user.losses,
      totalFights: user.totalFights,
      totalCrimes: user.totalCrimes,
      successfulCrimes: user.successfulCrimes,
      wantedLevel: user.wantedLevel,
      level: user.level,
      rank: user.rank,
      prestige: user.prestige,
      merit: user.merit,
      skillPoints: user.skillPoints,
      winRate: user.totalFights > 0 ? Math.round((user.wins / user.totalFights) * 100) : 0,
      crimeSuccessRate: user.totalCrimes > 0 ? Math.round((user.successfulCrimes / user.totalCrimes) * 100) : 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "get stats error");
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
