import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import User, { computeMaxHp, levelUp } from "../models/User";
import Item from "../models/Item";
import UserAchievement from "../models/Achievement";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { safeUser } from "./auth";
import bcrypt from "bcryptjs";
import { postToSystemFeed } from "../lib/systemFeed";
import Notification from "../models/Notification";

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

// All valid travel destinations and their min levels
const DISTRICT_MIN_LEVELS: Record<string, number> = {
  downtown:    1,
  neon_strip:  5,
  docks:       10,
  slums:       15,
  corp_zone:   20,
  industrial:  25,
  outskirts:   35,
};
const DISTRICTS = Object.keys(DISTRICT_MIN_LEVELS);
const BASE_TRAVEL_MS = 10 * 60 * 1000; // 10 minutes base travel time

// POST /api/user/travel — start traveling to a new district; vehicle reduces travel time
router.post("/travel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { destination } = req.body as { destination?: string };
    if (!destination || !DISTRICTS.includes(destination)) {
      return res.status(400).json({ message: `Invalid destination. Choose one of: ${DISTRICTS.join(", ")}` });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);

    // Level gate
    const minLevel = DISTRICT_MIN_LEVELS[destination] ?? 1;
    if (user.level < minLevel) {
      return res.status(403).json({ message: `Requires level ${minLevel} to travel to ${destination}`, minLevel });
    }

    if (user.status === 'hospitalized') return res.status(400).json({ message: "You are hospitalized" });
    if (user.status === 'jailed') return res.status(400).json({ message: "You are in jail" });

    if (user.travelingTo) {
      return res.status(400).json({ message: `Already traveling to ${user.travelingTo}` });
    }
    const currentLoc = user.currentLocation ?? 'downtown';
    if (currentLoc === destination) {
      return res.status(400).json({ message: "You are already there" });
    }

    let reductionPct = 0;
    if (user.equippedVehicle) {
      const vehicle = await Item.findById(user.equippedVehicle).lean();
      if (vehicle) reductionPct = vehicle.travelTimeReduction || 0;
    }
    const travelMs = Math.round(BASE_TRAVEL_MS * (1 - reductionPct / 100));

    user.travelingTo = destination;
    user.travelArrivesAt = new Date(Date.now() + travelMs);
    user.status = 'traveling';
    await user.save();

    res.json({
      message: `Traveling to ${destination} — arriving in ${Math.ceil(travelMs / 1000)}s`,
      travelingTo: user.travelingTo,
      travelArrivesAt: user.travelArrivesAt,
      status: user.status,
    });
  } catch (err: any) {
    req.log.error({ err }, "travel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/travel/cancel — cancel an in-progress travel
router.post("/travel/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status !== 'traveling') return res.status(400).json({ message: "Not currently traveling" });
    user.travelingTo = null;
    user.travelArrivesAt = null;
    user.status = user.currentLocation === 'downtown' ? 'normal' : 'abroad';
    await user.save();
    res.json({ message: "Travel cancelled", status: user.status });
  } catch (err: any) {
    req.log.error({ err }, "travel cancel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/hospital/pay-release — pay DC to leave hospital early
router.post("/hospital/pay-release", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.hospitalizedUntil || user.hospitalizedUntil <= new Date()) {
      return res.status(400).json({ message: "You are not hospitalized" });
    }
    const minutesRemaining = Math.ceil((user.hospitalizedUntil.getTime() - Date.now()) / 60000);
    const cost = Math.floor(minutesRemaining * 50);
    if (user.dc < cost) {
      return res.status(400).json({ message: `Requires ${cost} DC to release early`, cost });
    }
    user.dc -= cost;
    user.hospitalizedUntil = null;
    user.status = (user.currentLocation && user.currentLocation !== 'downtown') ? 'abroad' : 'normal';
    await user.save();
    res.json({ message: `Released from hospital. Cost: ${cost} DC`, cost, status: user.status, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "hospital pay-release error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/jail/pay-bail — pay DC to post bail
router.post("/jail/pay-bail", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const jailedUntil = user.jailedUntil ?? user.jailUntil;
    if (!jailedUntil || jailedUntil <= new Date()) {
      return res.status(400).json({ message: "You are not in jail" });
    }
    const minutesRemaining = Math.ceil((jailedUntil.getTime() - Date.now()) / 60000);
    const cost = Math.floor(minutesRemaining * 80);
    if (user.dc < cost) {
      return res.status(400).json({ message: `Requires ${cost} DC for bail`, cost });
    }
    user.dc -= cost;
    user.jailedUntil = null;
    user.jailUntil = null;
    user.jailDuration = 0;
    user.status = (user.currentLocation && user.currentLocation !== 'downtown') ? 'abroad' : 'normal';
    await user.save();
    res.json({ message: `Bail posted. Cost: ${cost} DC`, cost, status: user.status, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "jail pay-bail error");
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
      _id: { $in: [user.equippedEnhancement, user.equippedClothing, user.equippedVehicle].filter(Boolean) },
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
    const user = await User.findById(req.userId).select("_id equippedEnhancement equippedClothing equippedVehicle");
    if (!user) return res.status(404).json({ message: "User not found" });
    const items = await Item.find({ owner: user._id }).sort({ createdAt: -1 }).lean();
    res.json({
      items,
      equipped: {
        enhancement: user.equippedEnhancement ?? null,
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
      "strength charisma intelligence streetCred wins losses totalFights totalCrimes successfulCrimes wantedLevel level rank prestige merit"
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
      winRate: user.totalFights > 0 ? Math.round((user.wins / user.totalFights) * 100) : 0,
      crimeSuccessRate: user.totalCrimes > 0 ? Math.round((user.successfulCrimes / user.totalCrimes) * 100) : 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "get stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/prestige
router.post("/prestige", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    if (user.level < 100) {
      res.status(400).json({ message: "You must reach level 100 to prestige." }); return;
    }
    const combatMatchesDone = user.combatMatchesCompleted ?? 0;
    if (combatMatchesDone < 50) {
      res.status(400).json({ message: "You need to complete at least 50 arena matches to prestige" }); return;
    }

    const newPrestige = (user.prestige ?? 0) + 1;
    user.prestige = newPrestige;
    user.level = 1;
    user.xp = 0;
    user.xpToNext = 100;
    user.prestigeXpBoost = (user.prestigeXpBoost ?? 0) + 10;
    user.health = computeMaxHp(1, newPrestige);

    const badgeId = "prestige_badge_P" + newPrestige;
    // Note: Prestige frames are no longer auto-granted for free — they're
    // purchasable with NC from the Frame Store (mythic rarity), consistent
    // with the "no free frames" rule. Only the title/badge is granted here.
    if (!Array.isArray(user.titles)) user.titles = [];
    if (!user.titles.includes(badgeId)) user.titles.push(badgeId);

    await user.save();

    const prestigeMessages: Record<number, string> = {
      1: `@${user.username} reached Prestige 1! The city takes notice.`,
      2: `@${user.username} reached Prestige 2! Rising fast.`,
      3: `@${user.username} reached Prestige 3! A legend walks among us.`,
      4: `@${user.username} reached Prestige 4! Elite tier.`,
    };
    const prestigeMsg = prestigeMessages[newPrestige] ?? `@${user.username} reached Prestige ${newPrestige}! The city is in awe.`;
    await postToSystemFeed("prestige", prestigeMsg, [user.username]);

    res.json({
      message: "Prestige " + newPrestige + " achieved! Welcome back to level 1.",
      prestige: newPrestige,
      level: 1,
      xp: 0,
      health: user.health,
      maxHealth: computeMaxHp(1, newPrestige),
      prestigeXpBoost: user.prestigeXpBoost,
      badgeGranted: badgeId,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/player/:id/revive
router.post("/player/:id/revive", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: "You cannot revive yourself" });
    }
    const [requester, target] = await Promise.all([
      User.findById(req.userId),
      User.findById(req.params.id),
    ]);
    if (!requester) return res.status(404).json({ message: "User not found" });
    if (!target) return res.status(404).json({ message: "Target player not found" });

    if (target.status !== "hospitalized" || !target.hospitalizedUntil || target.hospitalizedUntil <= new Date()) {
      return res.status(400).json({ message: "Target player is not hospitalized" });
    }

    const remaining = target.hospitalizedUntil.getTime() - Date.now();
    if (remaining < 30_000) {
      return res.status(400).json({ message: "This player barely needs help" });
    }

    const REVIVE_COST = 200;
    if (requester.dc < REVIVE_COST) {
      return res.status(400).json({ message: `Insufficient DC — need ${REVIVE_COST} DC to revive` });
    }

    const revivesReceived = (target as any).revivesReceived ?? 0;
    if (revivesReceived >= 2) {
      return res.status(400).json({ message: "This player has already received the maximum revives for this hospital stay" });
    }

    requester.dc -= REVIVE_COST;
    requester.xp += 10;
    levelUp(requester);
    await requester.save();

    target.hospitalizedUntil = new Date(Date.now() + Math.floor(remaining * 0.5));
    (target as any).revivesReceived = revivesReceived + 1;
    await target.save();

    await Notification.create({
      userId: target._id,
      type: "system",
      message: `@${requester.username} revived you — your hospital time has been cut in half!`,
      read: false,
    });

    return res.json({ message: "Revive applied", newReleaseTime: target.hospitalizedUntil });
  } catch (err: any) {
    req.log.error({ err }, "revive error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/player/:id/bail
router.post("/player/:id/bail", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: "You cannot bail yourself" });
    }
    const [requester, target] = await Promise.all([
      User.findById(req.userId),
      User.findById(req.params.id),
    ]);
    if (!requester) return res.status(404).json({ message: "User not found" });
    if (!target) return res.status(404).json({ message: "Target player not found" });

    if (target.status !== "jailed") {
      return res.status(400).json({ message: "Target player is not jailed" });
    }

    const jailedUntil = target.jailedUntil ?? target.jailUntil;
    if (!jailedUntil || jailedUntil <= new Date()) {
      return res.status(400).json({ message: "Target player is not jailed" });
    }

    const minutesRemaining = (jailedUntil.getTime() - Date.now()) / 60000;
    const cost = Math.floor(minutesRemaining * 80);

    if (requester.dc < cost) {
      return res.status(400).json({ message: `Insufficient DC — bail costs ${cost} DC`, cost });
    }

    requester.dc -= cost;
    await requester.save();

    target.status = "normal";
    target.jailedUntil = null;
    target.jailUntil = null;
    target.jailDuration = 0;
    await target.save();

    await Notification.create({
      userId: target._id,
      type: "system",
      message: `@${requester.username} paid your bail of ${cost} DC. You are free.`,
      read: false,
    });

    return res.json({ message: "Bail paid", cost });
  } catch (err: any) {
    req.log.error({ err }, "bail error");
    return res.status(500).json({ message: "Internal server error" });
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

// ── 10.15 Achievement Badge Pinning ──────────────────────────────────────────

// POST /api/user/badges/pin — pin a completed achievement badge to profile (max 3)
router.post("/badges/pin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { achievementId } = req.body;
    if (!achievementId || typeof achievementId !== "string") {
      return res.status(400).json({ message: "achievementId required" });
    }

    const [user, ua] = await Promise.all([
      User.findById(req.userId),
      UserAchievement.findOne({ userId: req.userId, achievementId, completed: true }).lean(),
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!ua) return res.status(403).json({ message: "Achievement not yet completed" });

    const pinned: string[] = (user as any).pinnedBadges ?? [];
    if (!pinned.includes(achievementId)) {
      if (pinned.length >= 3) pinned.shift(); // remove oldest to make room
      pinned.push(achievementId);
      (user as any).pinnedBadges = pinned;
      await user.save();
    }

    res.json({ pinnedBadges: (user as any).pinnedBadges });
  } catch (err: any) {
    req.log.error({ err }, "badge pin error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/user/badges/unpin — remove a pinned badge
router.post("/badges/unpin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { achievementId } = req.body;
    if (!achievementId || typeof achievementId !== "string") {
      return res.status(400).json({ message: "achievementId required" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    (user as any).pinnedBadges = ((user as any).pinnedBadges ?? []).filter(
      (id: string) => id !== achievementId,
    );
    await user.save();

    res.json({ pinnedBadges: (user as any).pinnedBadges });
  } catch (err: any) {
    req.log.error({ err }, "badge unpin error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
