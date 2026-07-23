import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";
import { safeUser } from "./auth";
import FeedEvent from "../models/FeedEvent";
import PlayerGarage from "../features/garage/models/PlayerGarage";
import MiniGameLeaderboard from "../features/garage/models/MiniGameLeaderboard";
import EventProgress from "../models/EventProgress";
import Event from "../models/Event";
import { BattlePass } from "../models/BattlePass";

const router = Router();

// GET /api/profile/me — own full profile
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    applyRegen(user);
    await user.save();
    const equipped = await Item.find({
      _id: { $in: [user.equippedEnhancement, user.equippedClothing, user.equippedVehicle].filter(Boolean) },
    }).lean();
    const recentActivity = await FeedEvent.find({ actorId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({ ...safeUser(user), equippedItems: equipped, recentActivity });
  } catch (err: any) {
    req.log.error({ err }, "profile/me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/profile/bio
router.patch("/bio", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { bio } = req.body;
    if (bio === undefined) return res.status(400).json({ message: "bio required" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.bio = String(bio).slice(0, 300);
    await user.save();
    res.json({ bio: user.bio });
  } catch (err: any) {
    req.log.error({ err }, "profile bio error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/profile/avatar
router.patch("/avatar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { avatar, avatarUrl } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
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
    await user.save();
    res.json({ avatar: user.avatar, avatarUrl: user.avatarUrl });
  } catch (err: any) {
    req.log.error({ err }, "profile avatar error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/profile/title
router.patch("/title", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (title && !user.titles.includes(title)) return res.status(400).json({ message: "You don't own this title" });
    user.equippedTitle = title || null;
    await user.save();
    res.json({ equippedTitle: user.equippedTitle });
  } catch (err: any) {
    req.log.error({ err }, "profile title error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/profile/follow/:userId
router.post("/follow/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetId = String(req.params.userId);
    if (targetId === req.userId) return res.status(400).json({ message: "Cannot follow yourself" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Target user not found" });
    const idx = user.following.indexOf(targetId);
    if (idx >= 0) {
      user.following.splice(idx, 1);
      await user.save();
      res.json({ following: false, message: `Unfollowed ${target.username}` });
    } else {
      user.following.push(targetId);
      await user.save();
      res.json({ following: true, message: `Following ${target.username}` });
    }
  } catch (err: any) {
    req.log.error({ err }, "follow error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/profile/:tag — public profile by tag or username
router.get("/:tag", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tag = String(req.params.tag);
    const user = await User.findOne({
      $or: [{ tag }, { username: new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }],
      banned: false,
    }).lean();
    if (!user) return res.status(404).json({ message: "Player not found" });
    const recentActivity = await FeedEvent.find({ actorId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({
      id: user._id,
      username: user.username,
      tag: user.tag,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      faction: user.faction,
      level: user.level,
      prestige: user.prestige,
      rank: user.rank,
      equippedTitle: user.equippedTitle,
      titles: user.titles,
      strength: user.strength,
      charisma: user.charisma,
      intelligence: user.intelligence,
      streetCred: user.streetCred,
      wins: user.wins,
      losses: user.losses,
      successfulCrimes: user.successfulCrimes,
      district: user.district,
      createdAt: user.createdAt,
      recentActivity,
    });
  } catch (err: any) {
    req.log.error({ err }, "profile/:tag error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/profile/event-history — last 10 events the player participated in
router.get("/event-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const progresses = await EventProgress.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    if (progresses.length === 0) return res.json([]);

    const eventIds = progresses.map(p => p.eventId);
    const events   = await Event.find({ _id: { $in: eventIds } })
      .select("name type endsAt status")
      .lean();
    const eventMap = new Map(events.map(e => [String(e._id), e]));

    const history = progresses.map(p => {
      const ev = eventMap.get(String(p.eventId));
      return {
        eventId:        p.eventId,
        eventName:      ev?.name  ?? "Unknown Event",
        eventType:      (ev as any)?.type  ?? "unknown",
        endedAt:        (ev as any)?.endsAt ?? null,
        status:         (ev as any)?.status ?? "ended",
        points:         p.points,
        bossDamageDealt: p.bossDamageDealt,
        collectiblesFound: p.collectiblesFound,
        lastActionAt:   p.lastActionAt,
      };
    });

    res.json(history);
  } catch (err: any) {
    req.log.error({ err }, "profile/event-history error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/profile/season-history — current battle pass season info
router.get("/season-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("seasonXp seasonLevel battlePassPremium premiumPassEventId")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const [activePasses, endedPasses] = await Promise.all([
      BattlePass.find({ status: "active"  }).sort({ startsAt: -1 }).limit(1).lean(),
      BattlePass.find({ status: "ended"   }).sort({ endsAt:   -1 }).limit(5).lean(),
    ]);

    const currentSeason = activePasses[0]
      ? {
          seasonName: activePasses[0].seasonName,
          level:      user.seasonLevel ?? 0,
          hasPremium: !!(user.battlePassPremium && user.premiumPassEventId === String(activePasses[0]._id)),
          endsAt:     activePasses[0].endsAt,
        }
      : null;

    res.json({ currentSeason, pastSeasons: endedPasses.map(p => ({ seasonName: p.seasonName, endsAt: p.endsAt })) });
  } catch (err: any) {
    req.log.error({ err }, "profile/season-history error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
