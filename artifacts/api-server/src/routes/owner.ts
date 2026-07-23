import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireStaff, requireOwner, AuthRequest } from "../middlewares/auth";
import { levelUp, xpForLevel } from "../models/User";
import { SHOP_ITEMS, PRICE_OVERRIDES } from "./market";
import ServerConfig from "../models/ServerConfig";
import AdminAuditLog, { logAdminAction } from "../models/AdminAuditLog";
import ChatReport from "../models/ChatReport";
import Item from "../models/Item";
import PlayerReport from "../models/PlayerReport";
import BanAppeal from "../models/BanAppeal";
import VantaLog from "../models/VantaLog";
import { STAFF_TIERS, STAFF_TASKS, getSubscriptionExpiry } from "../lib/staffTiers";
// Deep-delete imports
import ChatMessage from "../models/ChatMessage";
import Notification from "../models/Notification";
import CrimeLog from "../models/CrimeLog";
import PlayerGarage from "../features/garage/models/PlayerGarage";
import PlayerLoadout from "../models/PlayerLoadout";
import PlayerMiniGameInventory from "../features/garage/models/PlayerMiniGameInventory";
import FriendRequest from "../models/FriendRequest";
import Achievement from "../models/Achievement";
import SupportTicket from "../models/SupportTicket";
import PushSubscription from "../models/PushSubscription";
import AuctionListing from "../models/AuctionListing";
import CombatMatch from "../features/arena/models/CombatMatch";
import RaceMatch from "../features/race/models/RaceMatch";
import Guild from "../models/Guild";
import Faction from "../models/Faction";
import EconomyLog from "../models/EconomyLog";

const router = Router();
router.use(requireStaff as any);

interface PatchNote { id: string; title: string; content: string; publishedAt: string; scheduledFor: string | null; }
const patchNotes: PatchNote[] = [];

// GET /api/owner/stats
router.get("/stats", async (req, res) => {
  try {
    const [total, online, banned, economyResult] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }),
      User.countDocuments({ banned: true }),
      User.aggregate([{ $group: { _id: null, totalDc: { $sum: { $add: ["$dc", "$bankBalance"] } } } }]),
    ]);
    res.json({
      totalPlayers: total,
      onlinePlayers: online,
      bannedPlayers: banned,
      totalDcInEconomy: economyResult[0]?.totalDc ?? 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "owner stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/users
router.get("/users", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const q = req.query.q as string;

    const filter: Record<string, unknown> = {};
    if (q) {
      filter["$or"] = [
        { username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { tag: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("username tag email level dc nc bankBalance role banned banReason mutedUntil createdAt lastLogin faction district")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "owner users error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/users/:id — get full player data
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: any) {
    req.log.error({ err }, "owner get user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/ban
router.post("/ban", async (req: AuthRequest, res) => {
  try {
    const { userId, reason } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "owner") return res.status(403).json({ message: "Cannot ban owner" });
    user.banned = true;
    user.banReason = reason ?? "No reason given";
    user.bannedAt = new Date(); // Tier 8 §8.3 — feeds the anonymized weekly ban-count recap
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "ban", targetId: user.id, targetUsername: user.username, details: { reason: user.banReason } });
    res.json({ message: `${user.username} banned` });
  } catch (err: any) {
    req.log.error({ err }, "ban error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/notifications/summary — staff: counts to power the nav bell
router.get("/notifications/summary", async (req: AuthRequest, res) => {
  try {
    const [openReports, openAppeals, vantaHigh, vantaCritical] = await Promise.all([
      PlayerReport.countDocuments({ status: { $in: ["open", "under_review"] } }),
      BanAppeal.countDocuments({ status: "open" }),
      VantaLog.countDocuments({ dismissed: false, severity: "high" }),
      VantaLog.countDocuments({ dismissed: false, severity: "critical" }),
    ]);
    const vantaFlags = vantaHigh + vantaCritical;
    res.json({
      openReports,
      openAppeals,
      vantaFlags,
      vantaCritical,
      total: openReports + openAppeals + vantaFlags,
    });
  } catch (err: any) {
    req.log.error({ err }, "notifications summary error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/owner/players/:id — owner only: deep-delete a player account and all related data
router.delete("/players/:id", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role === "owner") return res.status(403).json({ message: "Cannot delete an owner account" });
    if (String(target._id) === req.userId) return res.status(400).json({ message: "Cannot delete your own account" });

    const { username } = target;
    const userId = target._id as mongoose.Types.ObjectId;

    // Deep delete across all collections in parallel
    const results = await Promise.allSettled([
      Item.deleteMany({ $or: [{ owner: userId }, { ownerId: userId }] }),
      ChatMessage.deleteMany({ senderId: userId }),
      FeedEvent.deleteMany({ actorId: userId }),
      Notification.deleteMany({ userId }),
      CrimeLog.deleteMany({ userId }),
      PlayerGarage.deleteMany({ userId }),
      PlayerLoadout.deleteMany({ userId }),
      PlayerMiniGameInventory.deleteMany({ userId }),
      FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
      Achievement.deleteMany({ userId }),
      VantaLog.deleteMany({ playerId: String(userId) }),
      BanAppeal.deleteMany({ userId }),
      SupportTicket.deleteMany({ playerId: userId }),
      PushSubscription.deleteMany({ userId }),
      CombatMatch.deleteMany({ $or: [{ player1Id: userId }, { player2Id: userId }] }),
      RaceMatch.deleteMany({ $or: [{ "participants.userId": userId }, { winnerId: userId }] }),
      // Remove from guild/faction arrays
      Guild.updateMany({}, { $pull: { members: userId, officers: userId, recruits: userId } }),
      Faction.updateMany({}, { $pull: { members: { userId } } }),
    ]);

    function getCount(r: PromiseSettledResult<any>): number {
      return r.status === "fulfilled" ? (r.value?.deletedCount ?? r.value?.modifiedCount ?? 0) : 0;
    }

    const [items, chat, feed, notifs, crimes, garage, loadout, arena, friends, achievements,
      vanta, appeals, tickets, push, combat, races] = results;

    const summary = {
      items: getCount(items), chatMessages: getCount(chat), feedEvents: getCount(feed),
      notifications: getCount(notifs), crimeLogs: getCount(crimes),
      garageRecords: getCount(garage), loadout: getCount(loadout), arenaInventory: getCount(arena),
      friendRequests: getCount(friends), achievements: getCount(achievements),
      vantaFlags: getCount(vanta), banAppeals: getCount(appeals), supportTickets: getCount(tickets),
      pushSubscriptions: getCount(push), combatMatches: getCount(combat), raceMatches: getCount(races),
    };

    await User.deleteOne({ _id: userId });

    logAdminAction({
      actorId: req.userId!, actorUsername: req.username || "unknown",
      action: "delete-account-deep", targetId: String(userId), targetUsername: username,
      details: summary,
    });

    res.json({ message: `${username} permanently and deeply deleted`, deleted: summary });
  } catch (err: any) {
    req.log.error({ err }, "delete account error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/new-account-defaults
router.get("/new-account-defaults", requireOwner as any, async (_req, res) => {
  try {
    const config = await ServerConfig.findOne({ key: "newAccountDefaults" });
    const defaults = config?.value ?? { uiScale: 0.85, navOrder: [], defaultPage: "dashboard" };
    res.json({ defaults });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/new-account-defaults
router.patch("/new-account-defaults", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { uiScale, navOrder, defaultPage } = req.body as { uiScale?: number; navOrder?: string[]; defaultPage?: string };
    const current = await ServerConfig.findOne({ key: "newAccountDefaults" });
    const existing = (current?.value ?? {}) as Record<string, unknown>;
    const updated: Record<string, unknown> = { ...existing };
    if (uiScale !== undefined) {
      if (typeof uiScale !== "number" || uiScale < 0.6 || uiScale > 1.2)
        return res.status(400).json({ message: "uiScale must be 0.6–1.2" });
      updated["uiScale"] = uiScale;
    }
    if (navOrder !== undefined) {
      if (!Array.isArray(navOrder)) return res.status(400).json({ message: "navOrder must be an array" });
      updated["navOrder"] = navOrder;
    }
    if (defaultPage !== undefined) {
      updated["defaultPage"] = defaultPage;
    }
    await ServerConfig.findOneAndUpdate(
      { key: "newAccountDefaults" },
      { value: updated, updatedAt: new Date() },
      { upsert: true }
    );
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "update-new-account-defaults", details: updated });
    res.json({ message: "New account defaults updated", defaults: updated });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/unban
router.post("/unban", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.banned = false;
    user.banReason = null;
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "unban", targetId: user.id, targetUsername: user.username });
    res.json({ message: `${user.username} unbanned` });
  } catch (err: any) {
    req.log.error({ err }, "unban error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/mute — mute a player for N minutes
router.post("/mute", async (req: AuthRequest, res) => {
  try {
    const { userId, minutes } = req.body;
    const mins = Math.max(1, Number(minutes) || 60);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "owner") return res.status(403).json({ message: "Cannot mute owner" });
    user.mutedUntil = new Date(Date.now() + mins * 60 * 1000);
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "mute", targetId: user.id, targetUsername: user.username, details: { minutes: mins } });
    res.json({ message: `${user.username} muted for ${mins} minutes`, mutedUntil: user.mutedUntil });
  } catch (err: any) {
    req.log.error({ err }, "mute error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/unmute
router.post("/unmute", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.mutedUntil = null;
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "unmute", targetId: user.id, targetUsername: user.username });
    res.json({ message: `${user.username} unmuted` });
  } catch (err: any) {
    req.log.error({ err }, "unmute error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/set-role
router.post("/set-role", async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.body;
    if (!["player", "admin", "owner"].includes(role))
      return res.status(400).json({ message: "Invalid role" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.role = role;
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-role", targetId: user.id, targetUsername: user.username, details: { role } });
    res.json({ message: `${user.username} role set to ${role}` });
  } catch (err: any) {
    req.log.error({ err }, "set-role error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/adjust-dc — add or subtract DC from any player
router.post("/adjust-dc", async (req: AuthRequest, res) => {
  try {
    const { userId, amount } = req.body;
    const delta = Math.floor(Number(amount));
    if (!userId || isNaN(delta)) return res.status(400).json({ message: "userId and amount required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.dc = Math.max(0, user.dc + delta);
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "adjust-dc", targetId: user.id, targetUsername: user.username, details: { delta } });
    const io = req.app.locals["io"];
    if (io) io.to(`user:${user._id}`).emit("balance_update", { dc: user.dc, nc: user.nc });
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} DC applied to ${user.username}`, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "adjust-dc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/adjust-nc — add or subtract NC from any player
router.post("/adjust-nc", async (req: AuthRequest, res) => {
  try {
    const { userId, amount } = req.body;
    const delta = Math.floor(Number(amount));
    if (!userId || isNaN(delta)) return res.status(400).json({ message: "userId and amount required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.nc = Math.max(0, user.nc + delta);
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "adjust-nc", targetId: user.id, targetUsername: user.username, details: { delta } });
    const io = req.app.locals["io"];
    if (io) io.to(`user:${user._id}`).emit("balance_update", { dc: user.dc, nc: user.nc });
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} NC applied to ${user.username}`, nc: user.nc });
  } catch (err: any) {
    req.log.error({ err }, "adjust-nc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/set-level — set a player's level
router.post("/set-level", async (req: AuthRequest, res) => {
  try {
    const { userId, level } = req.body;
    const lvl = Math.min(100, Math.max(1, Number(level) || 1));
    if (!userId) return res.status(400).json({ message: "userId required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.level = lvl;
    user.xp = 0;
    user.xpToNext = xpForLevel(lvl);
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-level", targetId: user.id, targetUsername: user.username, details: { level: lvl } });
    res.json({ message: `${user.username} set to level ${lvl}`, level: lvl });
  } catch (err: any) {
    req.log.error({ err }, "owner set-level error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/audit-log — recent admin actions
router.get("/audit-log", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const [logs, total] = await Promise.all([
      AdminAuditLog.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments({}),
    ]);
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "owner audit-log error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/feed/recent — recent game events
router.get("/feed/recent", async (req, res) => {
  try {
    const events = await FeedEvent.find({ type: { $in: ["crime", "fight"] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(events);
  } catch (err: any) {
    req.log.error({ err }, "owner feed error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/patch-notes — list all patch notes
router.get("/patch-notes", async (_req, res) => {
  res.json([...patchNotes].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
});

// POST /api/owner/patch-notes — create and publish (or schedule) a patch note
router.post("/patch-notes", async (req: AuthRequest, res) => {
  try {
    const { title, content, scheduledFor } = req.body;
    if (!title || !content) return res.status(400).json({ message: "title and content required" });
    const note: PatchNote = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: String(title).slice(0, 120),
      content: String(content).slice(0, 5000),
      publishedAt: new Date().toISOString(),
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    };
    patchNotes.push(note);
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "patch-note-create", details: { title: note.title } });
    res.status(201).json(note);
  } catch (err: any) {
    req.log.error({ err }, "patch-notes create error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/owner/patch-notes/:id — remove a patch note
router.delete("/patch-notes/:id", requireOwner as any, async (req, res) => {
  const idx = patchNotes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Patch note not found" });
  patchNotes.splice(idx, 1);
  res.json({ message: "Deleted" });
});

// GET /api/owner/shop-items — list all shop items with current (possibly overridden) prices
router.get("/shop-items", async (_req, res) => {
  res.json(SHOP_ITEMS.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    rarity: i.rarity,
    basePrice: i.basePrice,
    currentPrice: PRICE_OVERRIDES.get(i.id) ?? i.basePrice,
    overridden: PRICE_OVERRIDES.has(i.id),
    description: i.description,
  })));
});

// POST /api/owner/shop-items/:id/price — owner sets a new price for a shop item
router.post("/shop-items/:id/price", requireOwner as any, async (req: AuthRequest, res) => {
  const item = SHOP_ITEMS.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Item not found" });
  const price = Math.floor(Number(req.body.price));
  if (isNaN(price) || price < 0) return res.status(400).json({ message: "Invalid price" });
  if (price === 0 && item.basePrice !== 0) {
    PRICE_OVERRIDES.delete(item.id); // reset to default
    return res.json({ message: `${item.name} price reset to default (${item.basePrice.toLocaleString()} DC)`, price: item.basePrice });
  }
  PRICE_OVERRIDES.set(item.id, price);
  logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-shop-price", details: { itemId: item.id, oldPrice: item.basePrice, newPrice: price } });
  req.log.info({ itemId: item.id, oldPrice: item.basePrice, newPrice: price }, "owner set item price");
  res.json({ message: `${item.name} price set to ${price.toLocaleString()} DC`, price });
});

// DELETE /api/owner/shop-items/:id/price — reset item price to default
router.delete("/shop-items/:id/price", requireOwner as any, async (req: AuthRequest, res) => {
  const item = SHOP_ITEMS.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Item not found" });
  PRICE_OVERRIDES.delete(item.id);
  res.json({ message: `${item.name} price reset to default (${item.basePrice.toLocaleString()} DC)`, price: item.basePrice });
});

// GET /api/owner/xp-boost — get current XP boost status
router.get("/xp-boost", async (_req, res) => {
  try {
    const config = await ServerConfig.findOne({ key: "xpBoost" }).lean();
    if (!config || !config.value || new Date(config.value["expiresAt"] as string) <= new Date()) {
      return res.json({ active: false, multiplier: 1 });
    }
    res.json({ active: true, multiplier: config.value["multiplier"], expiresAt: config.value["expiresAt"] });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/xp-boost — activate server-wide XP multiplier
router.post("/xp-boost", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { multiplier, durationHours } = req.body;
    const mult = Number(multiplier);
    const hours = Number(durationHours);
    if (![1, 1.5, 2, 3].includes(mult) || isNaN(hours) || hours <= 0 || hours > 168) {
      return res.status(400).json({ message: "multiplier must be 1/1.5/2/3, durationHours 1-168" });
    }
    const expiresAt = mult === 1 ? new Date(0) : new Date(Date.now() + hours * 3600 * 1000);
    await ServerConfig.findOneAndUpdate(
      { key: "xpBoost" },
      { value: { multiplier: mult, expiresAt }, updatedAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
    const msg = mult === 1
      ? "XP boost cancelled"
      : `${mult}x XP boost active for ${hours}h`;
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "xp-boost", details: { multiplier: mult, hours } });
    req.log.info({ multiplier: mult, hours }, "owner set xp boost");
    res.json({ message: msg, multiplier: mult, expiresAt });
  } catch (err: any) {
    req.log.error({ err }, "xp-boost error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/grant/merit — grant Merit to a player
router.post("/grant/merit", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { userId, amount } = req.body;
    const delta = Math.floor(Number(amount));
    if (!userId || isNaN(delta) || delta === 0) return res.status(400).json({ message: "userId and non-zero amount required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.merit = Math.max(0, (user.merit || 0) + delta);
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "grant-merit", targetId: user.id, targetUsername: user.username, details: { delta } });
    req.log.info({ userId, delta }, "owner granted merit");
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} M granted to ${user.username}`, merit: user.merit });
  } catch (err: any) {
    req.log.error({ err }, "grant merit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/grant/xp — grant XP to a player
router.post("/grant/xp", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { userId, amount } = req.body;
    const delta = Math.floor(Number(amount));
    if (!userId || isNaN(delta) || delta === 0) return res.status(400).json({ message: "userId and non-zero amount required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.xp = Math.max(0, user.xp + delta);
    const leveled = delta > 0 ? levelUp(user) : false;
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "grant-xp", targetId: user.id, targetUsername: user.username, details: { delta, leveled } });
    req.log.info({ userId, delta }, "owner granted xp");
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} XP granted to ${user.username}${leveled ? " (leveled up!)" : ""}`, xp: user.xp, level: user.level });
  } catch (err: any) {
    req.log.error({ err }, "grant xp error");
    res.status(500).json({ message: "Internal server error" });
  }
});


// ── Subscription management ────────────────────────────────────────────────────

// GET /api/owner/payment-logs — paginated list of all Telegram payments
router.get("/payment-logs", requireStaff, async (req: AuthRequest, res) => {
  try {
    const TelegramPayment = (await import("../models/TelegramPayment")).default;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const total = await TelegramPayment.countDocuments();
    const logs = await TelegramPayment.find()
      .sort({ grantedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "payment-logs error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/grant-subscription — manually grant a subscription tier
router.post("/grant-subscription", requireStaff, async (req: AuthRequest, res) => {
  try {
    const { userId, tier, days } = req.body as { userId?: string; tier?: string; days?: number };
    const validTiers = ["street_runner", "neon_syndicate", "apex_sovereign"];
    if (!userId || !tier || !validTiers.includes(tier)) {
      return res.status(400).json({ message: "userId, and valid tier required" });
    }
    const durationDays = Math.min(365, Math.max(1, Number(days) || 30));
    const { TIER_CONFIG } = await import("../lib/subscription");
    const tierCfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

    const expiresAt = new Date(Date.now() + durationDays * 86_400_000);
    await User.updateOne(
      { _id: userId },
      {
        $set: { subscriptionTier: tier, subscriptionExpiresAt: expiresAt },
      }
    );
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "grant-subscription", targetId: userId, targetUsername: "?", details: { tier, durationDays } });
    res.json({ message: `${tierCfg.name} granted for ${durationDays} days`, expiresAt });
  } catch (err: any) {
    req.log.error({ err }, "grant-subscription error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/revoke-subscription — remove an active subscription
router.post("/revoke-subscription", requireStaff, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ message: "userId required" });
    await User.updateOne({ _id: userId }, { $set: { subscriptionTier: null, subscriptionExpiresAt: null } });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "revoke-subscription", targetId: userId, targetUsername: "?", details: {} });
    res.json({ message: "Subscription revoked" });
  } catch (err: any) {
    req.log.error({ err }, "revoke-subscription error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/adjust-nc — add or subtract NC (Nova Credits) from any player
router.post("/adjust-nc", requireStaff, async (req: AuthRequest, res) => {
  try {
    const { userId, amount } = req.body;
    const delta = Math.floor(Number(amount));
    if (!userId || isNaN(delta)) return res.status(400).json({ message: "userId and amount required" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    await User.updateOne({ _id: userId }, { $inc: { nc: delta } });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "adjust-nc", targetId: user.id, targetUsername: user.username, details: { delta } });
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} NC applied to ${user.username}` });
  } catch (err: any) {
    req.log.error({ err }, "adjust-nc error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/owner/grant/keys — grant Keys + Key Shards ──────────────────────
router.post("/grant/keys", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { userId, keys = 0, keyShards = 0 } = req.body;
    const k  = Math.floor(Number(keys));
    const ks = Math.floor(Number(keyShards));
    if (!userId || (k === 0 && ks === 0)) {
      return res.status(400).json({ message: "userId and at least one of keys/keyShards required" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const inc: Record<string, number> = {};
    if (k  !== 0) inc["keys"]      = k;
    if (ks !== 0) inc["keyShards"] = ks;
    await User.findByIdAndUpdate(userId, { $inc: inc });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "grant-keys", targetId: user.id, targetUsername: user.username, details: { keys: k, keyShards: ks } });
    res.json({ message: `Granted${k ? ` +${k} Keys` : ""}${ks ? ` +${ks} Shards` : ""} to ${user.username}` });
  } catch (err: any) {
    req.log.error({ err }, "grant-keys error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/owner/royale-logs — paginated royale spin history ─────────────────
router.get("/royale-logs", async (req: AuthRequest, res) => {
  try {
    const royaleLogPath = "../models/PlayerRoyaleLog";
    const PlayerRoyaleLog = (await import(royaleLogPath)).default;
    const page     = Math.max(1, Number(req.query.page) || 1);
    const limit    = Math.min(50, Number(req.query.limit) || 20);
    const userId   = req.query.userId as string | undefined;
    const filter: Record<string, unknown> = userId ? { userId } : {};
    const [logs, total] = await Promise.all([
      PlayerRoyaleLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PlayerRoyaleLog.countDocuments(filter),
    ]);
    // Attach username to each log
    const userIds = [...new Set(logs.map((l: any) => l.userId?.toString()))];
    const users   = await User.find({ _id: { $in: userIds as any[] } }).select("username").lean();
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.username]));
    res.json({
      logs: logs.map((l: any) => ({ ...l, username: userMap[l.userId?.toString()] ?? "?" })),
      total, page, pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    req.log.error({ err }, "royale-logs error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/owner/combat-history — paginated combat match history ─────────────
router.get("/combat-history", async (req: AuthRequest, res) => {
  try {
    const CombatMatch = (await import("../features/arena/models/CombatMatch")).default;
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Number(req.query.limit) || 20);
    const userId = req.query.userId as string | undefined;
    const filter: Record<string, unknown> = { status: "complete" };
    if (userId) filter["$or"] = [{ player1Id: userId }, { player2Id: userId }];
    const [matches, total] = await Promise.all([
      CombatMatch.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select("matchId player1Id player2Id isPlayer2AI aiName winnerId player1HP player2HP currentTurn energyCost rewardsGranted createdAt").lean(),
      CombatMatch.countDocuments(filter),
    ]);
    const allIds = [...new Set(
      matches.flatMap((m: any) => [m.player1Id?.toString(), m.player2Id?.toString()].filter(Boolean))
    )];
    const users   = await User.find({ _id: { $in: allIds } }).select("username").lean();
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.username]));
    res.json({
      matches: matches.map((m: any) => ({
        ...m,
        player1Name: userMap[m.player1Id?.toString()] ?? "?",
        player2Name: m.isPlayer2AI ? (m.aiName ?? "AI") : (userMap[m.player2Id?.toString()] ?? "?"),
      })),
      total, page, pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    req.log.error({ err }, "combat-history error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/owner/race-history — paginated race match history ─────────────────
router.get("/race-history", async (req: AuthRequest, res) => {
  try {
    const RaceMatch = (await import("../features/race/models/RaceMatch")).default;
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Number(req.query.limit) || 20);
    const userId = req.query.userId as string | undefined;
    const filter: Record<string, unknown> = { status: "complete" };
    if (userId) filter["players.userId"] = userId;
    const [matches, total] = await Promise.all([
      RaceMatch.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select("matchId mode players status energyCost createdAt").lean(),
      RaceMatch.countDocuments(filter),
    ]);
    res.json({ matches, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "race-history error");
    res.status(500).json({ message: "Internal server error" });
  }
});


// ── GET /api/owner/special-event — get current special event status ────────────
router.get("/special-event", requireOwner as any, async (_req, res) => {
  try {
    const cfg = await ServerConfig.findOne({ key: "specialEvent" }).lean();
    if (!cfg?.value) {
      res.json({ active: false, type: null, expiresAt: null });
      return;
    }
    const ev = cfg.value as { active?: boolean; type?: string; expiresAt?: string };
    // Auto-expire
    const expired = ev.expiresAt && new Date(ev.expiresAt) < new Date();
    res.json({ active: !!ev.active && !expired, type: ev.type ?? null, expiresAt: ev.expiresAt ?? null });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/owner/special-event — activate or deactivate a special event ────
// Body: { type: "nc_royale_drop", durationHours: number } to activate
//       { active: false } to deactivate
router.post("/special-event", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { active, type, durationHours } = req.body as {
      active?: boolean;
      type?: string;
      durationHours?: number;
    };

    if (active === false) {
      // Deactivate
      await ServerConfig.findOneAndUpdate(
        { key: "specialEvent" },
        { $set: { value: { active: false, type: null, expiresAt: null }, updatedAt: new Date() } },
        { upsert: true },
      );
      logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "deactivate-special-event", details: {} });
      res.json({ message: "Special event deactivated", active: false });
      return;
    }

    if (!type) {
      res.status(400).json({ message: "type is required to activate an event" });
      return;
    }
    const VALID_TYPES = ["nc_royale_drop"];
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ message: `Invalid event type. Valid: ${VALID_TYPES.join(", ")}` });
      return;
    }

    const rawHours = Number(durationHours);
    if (!isFinite(rawHours) || rawHours <= 0) {
      res.status(400).json({ message: "durationHours must be a positive number (max 168)" });
      return;
    }
    const hours = Math.max(0.5, Math.min(168, rawHours));
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();

    await ServerConfig.findOneAndUpdate(
      { key: "specialEvent" },
      { $set: { value: { active: true, type, expiresAt }, updatedAt: new Date() } },
      { upsert: true },
    );
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "activate-special-event", details: { type, hours, expiresAt } });
    res.json({ message: `Special event "${type}" activated for ${hours}h`, active: true, type, expiresAt });
  } catch (err: any) {
    req.log.error({ err }, "special-event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/owner/announcement — current banner config (staff view) ──────────
router.get("/announcement", async (_req, res) => {
  try {
    const cfg = await ServerConfig.findOne({ key: "announcement" }).lean();
    const val = (cfg?.value ?? {}) as { active?: boolean; message?: string; expiresAt?: string | null };
    res.json({ active: !!val.active, message: val.message ?? "", expiresAt: val.expiresAt ?? null });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/owner/announcement — set or clear the global banner ─────────────
// Body: { message: string, durationHours?: number } to activate
//       { active: false } to deactivate
router.post("/announcement", async (req: AuthRequest, res) => {
  try {
    const { active, message, durationHours } = req.body as {
      active?: boolean;
      message?: string;
      durationHours?: number;
    };

    if (active === false) {
      await ServerConfig.findOneAndUpdate(
        { key: "announcement" },
        { $set: { value: { active: false, message: "", expiresAt: null }, updatedAt: new Date() } },
        { upsert: true },
      );
      logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "deactivate-announcement", details: {} });
      res.json({ message: "Announcement cleared", active: false });
      return;
    }

    const text = String(message ?? "").trim();
    if (!text) {
      res.status(400).json({ message: "message is required to activate an announcement" });
      return;
    }
    if (text.length > 240) {
      res.status(400).json({ message: "message must be 240 characters or fewer" });
      return;
    }

    let expiresAt: string | null = null;
    if (durationHours !== undefined) {
      const rawHours = Number(durationHours);
      if (!isFinite(rawHours) || rawHours <= 0) {
        res.status(400).json({ message: "durationHours must be a positive number (max 168)" });
        return;
      }
      const hours = Math.max(0.25, Math.min(168, rawHours));
      expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    }

    await ServerConfig.findOneAndUpdate(
      { key: "announcement" },
      { $set: { value: { active: true, message: text, expiresAt }, updatedAt: new Date() } },
      { upsert: true },
    );
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-announcement", details: { text, expiresAt } });
    res.json({ active: true, message: text, expiresAt });
  } catch (err: any) {
    req.log.error({ err }, "announcement error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── CHAT REPORTS ───────────────────────────────────────────────────────────────

// GET /api/owner/chat-reports — list chat reports for staff review
router.get("/chat-reports", async (req: AuthRequest, res) => {
  try {
    const status = (req.query.status as string) || "pending";
    const filter: Record<string, unknown> = {};
    if (status !== "all") filter.status = status;

    const reports = await ChatReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(reports);
  } catch (err: any) {
    req.log.error({ err }, "get chat reports error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/chat-reports/:id — mark a report reviewed/dismissed
router.patch("/chat-reports/:id", async (req: AuthRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !["reviewed", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "status must be 'reviewed' or 'dismissed'" });
    }
    const report = await ChatReport.findByIdAndUpdate(
      req.params.id,
      { status, reviewedBy: req.username || "unknown" },
      { returnDocument: 'after' }
    );
    if (!report) return res.status(404).json({ message: "Report not found" });

    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "chat-report-review",
      targetId: String(report.reportedUserId),
      targetUsername: report.reportedUsername,
      details: { status, messageId: String(report.messageId) },
    });

    res.json({ message: "Report updated", report });
  } catch (err: any) {
    req.log.error({ err }, "update chat report error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// STAFF TIER SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/owner/staff — list all staff members with their tiers
router.get("/staff", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const staffUsers = await User.find({
      role: { $in: ["staff", "admin", "owner"] },
    })
      .select("_id username email role staffTier staffTierAssignedAt staffEarningsLastClaimedAt staffEarningsTotalDc staffTaskProgress staffTaskResetAt lastLogin subscriptionTier")
      .sort({ staffTier: -1, createdAt: 1 })
      .lean();
    res.json({ staff: staffUsers });
  } catch (err: any) {
    req.log.error({ err }, "get-staff error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/staff/set-tier — assign or remove staff tier
router.post("/staff/set-tier", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { userId, tier } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const t = tier === null || tier === 0 ? null : Math.min(5, Math.max(1, Number(tier)));
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.staffTier = t as any;
    user.staffTierAssignedAt = t ? new Date() : null;
    user.staffTaskProgress = {};
    user.staffTaskResetAt = null;

    if (t) {
      const tierDef = STAFF_TIERS[t];
      const expiry = getSubscriptionExpiry(1);
      user.subscriptionTier = tierDef.subscription as any;
      user.subscriptionExpiresAt = expiry;
      if ((user as any).role === "player") user.role = "staff";
    } else {
      if ((user as any).role === "staff") user.role = "player";
    }

    await user.save();
    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "set-staff-tier",
      targetId: user.id,
      targetUsername: user.username,
      details: { tier: t, subscription: t ? STAFF_TIERS[t].subscription : null },
    });
    res.json({ message: `${user.username} staff tier set to ${t ?? "none"}`, user: { id: user.id, staffTier: t } });
  } catch (err: any) {
    req.log.error({ err }, "set-staff-tier error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/staff/logs — audit logs filtered by optional staffId/tier
router.get("/staff/logs", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { actorId, limit: lim = 50, page: pg = 1 } = req.query;
    const limit  = Math.min(100, Number(lim));
    const skip   = (Number(pg) - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (actorId) filter.actorId = actorId;
    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAuditLog.countDocuments(filter),
    ]);
    const actorIds = [...new Set(logs.map((l: any) => l.actorId))];
    const actors = await User.find({ _id: { $in: actorIds } })
      .select("_id username staffTier role")
      .lean();
    const actorMap = Object.fromEntries(actors.map(a => [String(a._id), a]));
    const enriched = logs.map((l: any) => ({
      ...l,
      actorTier: actorMap[l.actorId]?.staffTier ?? null,
      actorRole: actorMap[l.actorId]?.role ?? "player",
    }));
    res.json({ logs: enriched, total, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "staff-logs error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/staff/me — staff member views their own tier + earnings + tasks
router.get("/staff/me", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const tier = (user as any).staffTier as number | null;
    if (!tier) return res.status(403).json({ message: "You are not a staff member" });
    const tierDef = STAFF_TIERS[tier];
    const tasks   = STAFF_TASKS[tier] ?? [];
    const progress = (user as any).staffTaskProgress ?? {};
    const now = new Date();
    const lastClaim = (user as any).staffEarningsLastClaimedAt
      ? new Date((user as any).staffEarningsLastClaimedAt)
      : null;
    const canClaim = !lastClaim || (now.getTime() - lastClaim.getTime()) >= 24 * 60 * 60 * 1000;
    res.json({
      tier,
      tierDef: { ...tierDef },
      tasks: tasks.map(t => ({ ...t, progress: progress[t.id] ?? 0 })),
      totalEarned: (user as any).staffEarningsTotalDc ?? 0,
      lastClaimedAt: lastClaim,
      canClaimNow: canClaim,
      nextClaimAt: lastClaim ? new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000) : null,
      subscription: (user as any).subscriptionTier,
      subscriptionExpiresAt: (user as any).subscriptionExpiresAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "staff-me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/staff/earnings/claim — claim today's DC earnings
router.post("/staff/earnings/claim", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const tier = (user as any).staffTier as number | null;
    if (!tier) return res.status(403).json({ message: "You are not a staff member" });
    const now = new Date();
    const lastClaim = (user as any).staffEarningsLastClaimedAt
      ? new Date((user as any).staffEarningsLastClaimedAt)
      : null;
    if (lastClaim && (now.getTime() - lastClaim.getTime()) < 24 * 60 * 60 * 1000) {
      const nextAt = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
      return res.status(400).json({ message: "Already claimed today", nextClaimAt: nextAt });
    }
    const dc = STAFF_TIERS[tier].dailyDc;
    (user as any).staffEarningsLastClaimedAt = now;
    (user as any).staffEarningsTotalDc = ((user as any).staffEarningsTotalDc ?? 0) + dc;
    user.dc += dc;
    await user.save();
    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "staff-earnings-claim",
      details: { tier, dc },
    });
    res.json({ message: `+${dc.toLocaleString()} DC claimed`, dc: user.dc, totalEarned: (user as any).staffEarningsTotalDc });
  } catch (err: any) {
    req.log.error({ err }, "staff-earnings-claim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/staff/tasks/complete — increment task progress
router.post("/staff/tasks/complete", async (req: AuthRequest, res) => {
  try {
    const { taskId, increment = 1 } = req.body;
    if (!taskId) return res.status(400).json({ message: "taskId required" });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const tier = (user as any).staffTier as number | null;
    if (!tier) return res.status(403).json({ message: "Not a staff member" });
    const tasks = STAFF_TASKS[tier] ?? [];
    const task  = tasks.find(t => t.id === taskId);
    if (!task) return res.status(400).json({ message: "Invalid task for your tier" });
    const progress = (user as any).staffTaskProgress ?? {};
    progress[taskId] = Math.min(task.target, (progress[taskId] ?? 0) + Number(increment));
    (user as any).staffTaskProgress = progress;
    user.markModified("staffTaskProgress");
    await user.save();
    res.json({ taskId, progress: progress[taskId], target: task.target });
  } catch (err: any) {
    req.log.error({ err }, "staff-tasks-complete error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/mass-grant — broadcast DC / NC / keys to ALL active players
router.post("/mass-grant", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { dc = 0, nc = 0, keys = 0, reason = "" } = req.body;
    const dDc   = Math.floor(Number(dc));
    const dNc   = Math.floor(Number(nc));
    const dKeys = Math.floor(Number(keys));
    if (dDc === 0 && dNc === 0 && dKeys === 0) {
      return res.status(400).json({ message: "At least one of dc / nc / keys must be non-zero" });
    }
    const inc: Record<string, number> = {};
    if (dDc   !== 0) inc["dc"]   = dDc;
    if (dNc   !== 0) inc["nc"]   = dNc;
    if (dKeys !== 0) inc["keys"] = dKeys;
    const result = await User.updateMany({ banned: false, role: "player" }, { $inc: inc });
    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "mass-grant",
      details: { dc: dDc, nc: dNc, keys: dKeys, reason, affected: result.modifiedCount },
    });
    res.json({
      message: `Mass grant applied to ${result.modifiedCount} players`,
      affected: result.modifiedCount,
      granted: { dc: dDc, nc: dNc, keys: dKeys },
    });
  } catch (err: any) {
    req.log.error({ err }, "mass-grant error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DATABASE MANAGEMENT ───────────────────────────────────────────────────────

/** Collections that hold core game state — never allow clearing/dropping from the UI */
const DB_PROTECTED = new Set([
  "users", "items", "factions", "guilds", "serverconfigs", "gameconfigs",
  "worldstates", "businesses", "properties", "racecars", "companions",
  "playergarages", "playerloadouts", "actionmasteries", "playerminigameinventories",
  "playerpitycounters", "userachievements",
]);

// GET /api/owner/db-stats — live storage breakdown
router.get("/db-stats", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ message: "DB not connected" });
    const raw = await db.command({ dbStats: 1, scale: 1 });
    const colls = await db.listCollections().toArray();
    const collections: any[] = [];
    for (const c of colls) {
      try {
        const cs = await db.command({ collStats: c.name, scale: 1 });
        collections.push({
          name: c.name,
          docs: cs.count ?? 0,
          dataBytes: cs.size ?? 0,
          storageBytes: cs.storageSize ?? 0,
          indexBytes: cs.totalIndexSize ?? 0,
          protected: DB_PROTECTED.has(c.name),
        });
      } catch { /* skip unreadable collections */ }
    }
    collections.sort((a, b) => b.dataBytes - a.dataBytes);
    res.json({
      dataBytes:    raw.dataSize    ?? 0,
      indexBytes:   raw.indexSize   ?? 0,
      storageBytes: raw.storageSize ?? 0,
      totalBytes:   (raw.dataSize ?? 0) + (raw.indexSize ?? 0),
      objects:      raw.objects     ?? 0,
      collections,
    });
  } catch (err: any) {
    req.log.error({ err }, "db-stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/db-smart-cleanup — remove expired / stale documents across known collections
router.post("/db-smart-cleanup", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ message: "DB not connected" });
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const results: Record<string, number> = {};
    const sweep = async (col: string, filter: Record<string, unknown>) => {
      try { results[col] = (await db.collection(col).deleteMany(filter as any)).deletedCount; }
      catch { results[col] = 0; }
    };

    await sweep("notifications",   { createdAt: { $lt: ago(30) } });
    await sweep("crimelogs",       { createdAt: { $lt: ago(30) } });
    await sweep("adminauditlogs",  { createdAt: { $lt: ago(90) } });
    await sweep("vantalogs",       { createdAt: { $lt: ago(30) } });
    await sweep("feedevents",      { createdAt: { $lt: ago(60) } });
    await sweep("ncpurchaselogs",  { createdAt: { $lt: ago(60) } });
    await sweep("ucpurchaselogs",  { createdAt: { $lt: ago(60) } });
    await sweep("factionbanklogs", { createdAt: { $lt: ago(60) } });
    await sweep("racematches",     { status: { $in: ["finished","cancelled","timeout"] }, createdAt: { $lt: ago(7) } });
    await sweep("combatmatches",   { status: { $in: ["finished","forfeit","timeout"] },  createdAt: { $lt: ago(7) } });
    await sweep("hacksessions",    { expiresAt: { $lt: now } });
    // Giveaway entries for already-resolved giveaways
    const resolvedIds = await db.collection("giveaways").distinct("_id", { status: "resolved" });
    if (resolvedIds.length) await sweep("giveawayentries", { giveawayId: { $in: resolvedIds } });

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "db-smart-cleanup", details: { totalDeleted, results } });
    req.log.info({ totalDeleted }, "smart cleanup complete");
    res.json({ message: "Smart cleanup complete", totalDeleted, breakdown: results });
  } catch (err: any) {
    req.log.error({ err }, "db-smart-cleanup error");
    res.status(500).json({ message: err.message ?? "Internal server error" });
  }
});

// DELETE /api/owner/db-clear/:collection — wipe all documents (keeps collection + indexes)
router.delete("/db-clear/:collection", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const collection = req.params.collection as string;
    if (DB_PROTECTED.has(collection))
      return res.status(403).json({ message: `'${collection}' is protected and cannot be cleared` });
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ message: "DB not connected" });
    if (!(await db.listCollections({ name: collection }).hasNext()))
      return res.status(404).json({ message: "Collection not found" });
    const r = await db.collection(collection).deleteMany({});
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "db-clear-collection", details: { collection, deleted: r.deletedCount } });
    res.json({ message: `Cleared ${r.deletedCount} document(s) from '${collection}'`, deleted: r.deletedCount });
  } catch (err: any) {
    req.log.error({ err }, "db-clear error");
    res.status(500).json({ message: err.message ?? "Internal server error" });
  }
});

// GET /api/owner/db-limit — fetch the persisted Atlas storage cap (MB)
router.get("/db-limit", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const cfg = await ServerConfig.findOne({ key: "db_atlas_limit_mb" }).lean();
    const limitMB = (cfg?.value as { limitMB?: number } | null)?.limitMB ?? 512;
    res.json({ limitMB });
  } catch (err: any) {
    req.log.error({ err }, "db-limit get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/db-limit — persist the Atlas storage cap (MB) so it survives redeploys
router.patch("/db-limit", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { limitMB } = req.body as { limitMB?: unknown };
    const mb = Number(limitMB);
    if (!Number.isFinite(mb) || mb < 1) return res.status(400).json({ message: "limitMB must be a positive number" });
    await ServerConfig.findOneAndUpdate(
      { key: "db_atlas_limit_mb" },
      { $set: { value: { limitMB: mb }, updatedAt: new Date() } },
      { upsert: true }
    );
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-db-limit", details: { limitMB: mb } });
    res.json({ limitMB: mb });
  } catch (err: any) {
    req.log.error({ err }, "db-limit patch error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/db-drop/:collection — permanently drop collection (requires owner code)
router.post("/db-drop/:collection", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const collection = req.params.collection as string;
    const { confirmCode } = req.body as { confirmCode?: string };
    if (confirmCode !== "Hayatulahi3222")
      return res.status(403).json({ message: "Invalid confirmation code — collection not dropped" });
    if (DB_PROTECTED.has(collection))
      return res.status(403).json({ message: `'${collection}' is protected and cannot be dropped` });
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ message: "DB not connected" });
    if (!(await db.listCollections({ name: collection }).hasNext()))
      return res.status(404).json({ message: "Collection not found" });
    await db.collection(collection).drop();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "db-drop-collection", details: { collection } });
    res.json({ message: `Collection '${collection}' permanently dropped` });
  } catch (err: any) {
    req.log.error({ err }, "db-drop error");
    res.status(500).json({ message: err.message ?? "Internal server error" });
  }
});

// ── GAME CONFIG ────────────────────────────────────────────────────────────────

// GET /api/owner/game-config — full config + hardcoded catalogs for UI
router.get("/game-config", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { getGameConfig, DEFAULT_GAME_CONFIG } = await import("../lib/gameConfig");
    const { RUNS } = await import("./crimes");
    const { JOBS } = await import("./jobs");
    const config = await getGameConfig();
    res.json({
      config,
      defaults: DEFAULT_GAME_CONFIG,
      catalog: {
        runs: RUNS.map((r: any) => ({
          id: r.id, name: r.name, tier: r.tier,
          energyCost: r.energyCost, dcMin: r.dcMin, dcMax: r.dcMax,
          xp: r.xp, baseSuccess: r.baseSuccess, minLevel: r.minLevel, riskLevel: r.riskLevel,
        })),
        jobs: JOBS.map((j: any) => ({
          id: j.id, name: j.name, district: j.district, minLevel: j.minLevel,
          energyCost: j.energyCost, dcMin: j.dcMin, dcMax: j.dcMax,
          xpPerJob: j.xpPerJob, cooldownMin: j.cooldownMin,
        })),
        staffTiers: Object.fromEntries(
          Object.entries(STAFF_TIERS).map(([k, v]) => [k, { name: v.name, color: v.color, dailyDc: v.dailyDc }])
        ),
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "game-config get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/game-config — update one or more config sections
router.patch("/game-config", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { patchGameConfig } = await import("../lib/gameConfig");
    const patch = req.body as Record<string, unknown>;
    const gm = patch.globalMultipliers as Record<string, number> | undefined;
    const rc = patch.resourceCaps as Record<string, number> | undefined;
    const cc = patch.crimeConfig as Record<string, unknown> | undefined;
    const jc = patch.jobConfig as Record<string, unknown> | undefined;
    if (gm?.dcRewardMult !== undefined && (Number(gm.dcRewardMult) < 0.1 || Number(gm.dcRewardMult) > 100))
      return res.status(400).json({ message: "dcRewardMult must be 0.1–100" });
    if (gm?.xpRewardMult !== undefined && (Number(gm.xpRewardMult) < 0.1 || Number(gm.xpRewardMult) > 100))
      return res.status(400).json({ message: "xpRewardMult must be 0.1–100" });
    if (rc?.walletCap !== undefined && (Number(rc.walletCap) < 1_000 || Number(rc.walletCap) > 10_000_000_000))
      return res.status(400).json({ message: "walletCap must be 1,000–10,000,000,000" });
    if (rc?.bankCap !== undefined && (Number(rc.bankCap) < 1_000 || Number(rc.bankCap) > 100_000_000_000))
      return res.status(400).json({ message: "bankCap must be 1,000–100,000,000,000" });
    if (cc?.runsPerHourCap !== undefined && (Number(cc.runsPerHourCap) < 1 || Number(cc.runsPerHourCap) > 1_000))
      return res.status(400).json({ message: "runsPerHourCap must be 1–1000" });
    if (jc?.minigameTriggerChance !== undefined && (Number(jc.minigameTriggerChance) < 0 || Number(jc.minigameTriggerChance) > 1))
      return res.status(400).json({ message: "minigameTriggerChance must be 0–1" });

    const newConfig = await patchGameConfig(patch as any);
    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "update-game-config",
      details: { sections: Object.keys(patch) },
    });
    req.log.info({ sections: Object.keys(patch) }, "owner updated game config");
    res.json({ message: "Game config updated", config: newConfig });
  } catch (err: any) {
    req.log.error({ err }, "game-config patch error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Cosmetics: owner routes ───────────────────────────────────────────────────
import CosmeticItemModel from "../models/CosmeticItem";

// POST /api/owner/cosmetics/grant — grant a cosmetic to a player
router.post("/cosmetics/grant", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { userId, cosmeticId, expiresAt } = req.body as { userId: string; cosmeticId: string; expiresAt?: string | null };
    if (!userId || !cosmeticId) return res.status(400).json({ message: "userId and cosmeticId required" });

    const item = await CosmeticItemModel.findOne({ id: cosmeticId }).lean();
    if (!item) return res.status(404).json({ message: "Cosmetic not found" });

    const expiry = expiresAt ? new Date(expiresAt) : null;

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: { ownedCosmetics: cosmeticId },
        $push: {
          cosmeticInventory: {
            cosmeticId,
            acquiredAt: new Date(),
            expiresAt: expiry,
            source: "owner_grant",
          },
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Player not found" });

    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "grant-cosmetic",
      details: { targetId: userId, cosmeticId, expiresAt: expiry },
    });

    res.json({ message: `${item.name} granted to player` });
  } catch (err: any) {
    req.log.error({ err }, "owner grant-cosmetic error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/cosmetics/catalog — add a new cosmetic to the catalog
router.post("/cosmetics/catalog", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { id, name, type, color, animation, cssKey, priceNC, purchasable, eventRewardable, rarity, previewDescription, seasonExclusive } = req.body;
    if (!id || !name || !type || !cssKey) {
      return res.status(400).json({ message: "id, name, type, and cssKey are required" });
    }

    const existing = await CosmeticItemModel.findOne({ id }).lean();
    if (existing) return res.status(409).json({ message: "A cosmetic with that id already exists" });

    const item = await CosmeticItemModel.create({
      id, name, type, color: color ?? "", animation: animation ?? "none",
      cssKey, priceNC: priceNC ?? 0, purchasable: purchasable ?? false,
      eventRewardable: eventRewardable ?? false, rarity: rarity ?? "common",
      previewDescription: previewDescription ?? "", seasonExclusive: seasonExclusive ?? false,
    });

    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "create-cosmetic",
      details: { cosmeticId: id, name, type },
    });

    res.status(201).json(item);
  } catch (err: any) {
    req.log.error({ err }, "owner create-cosmetic error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/cosmetics/:id — edit an existing cosmetic
router.patch("/cosmetics/:id", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ["name", "color", "animation", "cssKey", "priceNC", "purchasable", "eventRewardable", "rarity", "previewDescription", "seasonExclusive"];
    const patch: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) patch[field] = req.body[field];
    }

    const updated = await CosmeticItemModel.findOneAndUpdate({ id }, { $set: patch }, { new: true });
    if (!updated) return res.status(404).json({ message: "Cosmetic not found" });

    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "edit-cosmetic",
      details: { cosmeticId: id, changes: patch },
    });

    res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "owner edit-cosmetic error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/cosmetics — list all cosmetics sorted by type then name
router.get("/cosmetics", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const items = await CosmeticItemModel.find().sort({ type: 1, name: 1 }).lean();
    res.json(items);
  } catch (err: any) {
    req.log.error({ err }, "owner list-cosmetics error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/owner/cosmetics/:id — hard delete a cosmetic
router.delete("/cosmetics/:id", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const deleted = await CosmeticItemModel.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ message: "Cosmetic not found" });
    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "delete-cosmetic",
      details: { cosmeticId: id, name: deleted.name },
    });
    res.json({ message: `${deleted.name} deleted` });
  } catch (err: any) {
    req.log.error({ err }, "owner delete-cosmetic error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/cosmetics/grant-by-username — grant cosmetic by username
router.post("/cosmetics/grant-by-username", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { cosmeticId, username } = req.body as { cosmeticId: string; username: string };
    if (!cosmeticId || !username) return res.status(400).json({ message: "cosmeticId and username required" });

    const item = await CosmeticItemModel.findOne({ id: cosmeticId }).lean();
    if (!item) return res.status(404).json({ message: "Cosmetic not found" });

    const player = await User.findOne({ username: new RegExp(`^${username.trim()}$`, "i") }).select("_id username").lean();
    if (!player) return res.status(404).json({ message: `Player "${username}" not found` });

    await User.findByIdAndUpdate(
      player._id,
      {
        $addToSet: { ownedCosmetics: cosmeticId },
        $push: {
          cosmeticInventory: {
            cosmeticId,
            acquiredAt: new Date(),
            expiresAt: null,
            source: "owner_grant",
          },
        },
      }
    );

    logAdminAction({
      actorId: req.userId!,
      actorUsername: req.username || "unknown",
      action: "grant-cosmetic",
      targetId: String(player._id),
      targetUsername: player.username as string,
      details: { cosmeticId, cosmeticName: item.name },
    });

    res.json({ message: `${item.name} granted to ${player.username}` });
  } catch (err: any) {
    req.log.error({ err }, "owner grant-by-username error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── EVENT MANAGEMENT (Owner) ──────────────────────────────────────────────────
import Event from "../models/Event";
import EventProgress from "../models/EventProgress";
import { activateEvent, endEvent, invalidateFlashCache } from "../lib/eventEngine";

// GET /api/owner/events — list all events in all statuses
router.get("/events", async (_req, res) => {
  try {
    const events = await Event.find({})
      .sort({ startsAt: -1 })
      .lean();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/events/flash — trigger a flash event (register BEFORE /:id)
router.post("/events/flash", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { label, effect, durationHours } = req.body as { label: string; effect: string; durationHours: number };
    if (!label || !effect || !durationHours) {
      return res.status(400).json({ message: "label, effect, and durationHours required" });
    }
    const validEffects = ["2x_crime_payout", "2x_arena_rewards", "3x_boss_damage", "2x_event_points", "free_boss_strikes", "2x_race_prizes"];
    if (!validEffects.includes(effect)) {
      return res.status(400).json({ message: `effect must be one of: ${validEffects.join(", ")}` });
    }
    const hours = Math.max(0.25, Math.min(24, Number(durationHours)));
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    await ServerConfig.findOneAndUpdate(
      { key: "flashEvent" },
      { key: "flashEvent", value: { label, effect, expiresAt }, updatedAt: new Date() },
      { upsert: true }
    );
    invalidateFlashCache();
    const io = req.app.locals["io"];
    if (io) io.emit("flash_event_started", { label, effect, expiresAt });
    await FeedEvent.create({
      type: "system", actor: "System", actorId: null, dc: 0, xp: 0, actorLevel: 0,
      message: `[⚡ FLASH EVENT] ${label} — active for the next ${hours} hour${hours !== 1 ? "s" : ""}!`,
    });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "flash-event", details: { label, effect, hours } });
    res.json({ message: "Flash event started", label, effect, expiresAt });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/broadcast — send message to all online players via WebSocket + feed
router.post("/broadcast", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body as { message: string };
    if (!message?.trim()) return res.status(400).json({ message: "message required" });
    const text = String(message).trim().slice(0, 500);
    const io = req.app.locals["io"];
    if (io) io.emit("owner_broadcast", { message: text, sentAt: new Date() });
    await FeedEvent.create({
      type: "system", actor: "System", actorId: null, dc: 0, xp: 0, actorLevel: 0,
      message: `[BROADCAST] ${text}`,
    });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "broadcast", details: { message: text } });
    res.json({ message: "Broadcast sent" });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/events — create a new event (status: draft)
router.post("/events", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const { name, slug, type, description, startsAt, endsAt, theme, pointSources, boss, collectible, milestones, teams, lottery, leaderboardRewards, oneTimeRewards } = req.body;
    if (!name || !slug || !type || !startsAt || !endsAt) {
      return res.status(400).json({ message: "name, slug, type, startsAt, endsAt required" });
    }
    const existing = await Event.findOne({ slug });
    if (existing) return res.status(409).json({ message: "Slug already in use" });
    const event = await Event.create({
      name, slug, type,
      description: description || "",
      status: "draft",
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdBy: req.username || "owner",
      lastEditedAt: new Date(),
      theme: theme || {},
      pointSources: pointSources || [],
      boss: boss || undefined,
      collectible: collectible || undefined,
      milestones: milestones || undefined,
      teams: teams || undefined,
      lottery: lottery || undefined,
      leaderboardRewards: leaderboardRewards || [],
      oneTimeRewards: oneTimeRewards || [],
    });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "create-event", details: { eventId: String(event._id), name, type } });
    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/events/:id — edit any field (status changes go through dedicated endpoints)
router.patch("/events/:id", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params["id"]);
    if (!event) return res.status(404).json({ message: "Event not found" });
    const patch = { ...req.body, lastEditedAt: new Date() };
    delete patch.status;
    Object.assign(event, patch);
    await event.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "edit-event", details: { eventId: String(event._id), changes: Object.keys(req.body) } });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/events/:id/activate
router.post("/events/:id/activate", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params["id"]);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status === "active") return res.status(409).json({ message: "Event is already active" });
    const io = req.app.locals["io"];
    await activateEvent(event, io);
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "activate-event", details: { eventId: String(event._id), name: event.name } });
    res.json({ message: `Event "${event.name}" activated` });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/events/:id/end — manually end event + distribute rewards
router.post("/events/:id/end", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params["id"]);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status !== "active") return res.status(409).json({ message: "Event is not active" });
    const io = req.app.locals["io"];
    await endEvent(event, io);
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "end-event", details: { eventId: String(event._id), name: event.name } });
    res.json({ message: `Event "${event.name}" ended and rewards distributed` });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/owner/events/:id/archive
router.post("/events/:id/archive", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params["id"]);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status !== "ended") return res.status(409).json({ message: "Only ended events can be archived" });
    await Event.findByIdAndUpdate(event._id, { status: "archived" });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "archive-event", details: { eventId: String(event._id), name: event.name } });
    res.json({ message: `Event "${event.name}" archived` });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/economy-dashboard — live economy metrics
router.get("/economy-dashboard", requireOwner as any, async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const day14Start = new Date(now); day14Start.setDate(now.getDate() - 14);

    const [
      circulationResult,
      ncResult,
      dcInToday,
      dcOutToday,
      ncInToday,
      ncOutToday,
      top10DcEarners,
      top10NcSpenders,
      activeAuctions,
      auctionEscrow,
      eventStats,
      bountyPool,
      registrationsRaw,
      retentionNow,
      retention7dAgo,
    ] = await Promise.all([
      // Total DC in circulation (wallet + bank)
      User.aggregate([{ $group: { _id: null, total: { $sum: { $add: ["$dc", "$bankBalance"] } } } }]),
      // Total NC in circulation
      User.aggregate([{ $group: { _id: null, total: { $sum: "$nc" } } }]),
      // DC in today
      EconomyLog.aggregate([
        { $match: { type: "dc_in", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // DC out today
      EconomyLog.aggregate([
        { $match: { type: "dc_out", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // NC in today
      EconomyLog.aggregate([
        { $match: { type: "nc_in", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // NC out today
      EconomyLog.aggregate([
        { $match: { type: "nc_out", createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Top 10 DC earners this week
      User.find({ weeklyDc: { $gt: 0 } })
        .select("username weeklyDc level")
        .sort({ weeklyDc: -1 })
        .limit(10)
        .lean(),
      // Top 10 NC spenders — approximate via users with lowest NC who had any NC
      User.find({})
        .select("username nc level")
        .sort({ nc: 1 })
        .limit(10)
        .lean(),
      // Active auctions count
      AuctionListing.countDocuments({ status: "active" }),
      // Total DC in auction escrow
      AuctionListing.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, total: { $sum: "$currentBid" } } },
      ]),
      // Event stats: total event participants vs premium pass holders (last 7 days)
      (async () => {
        const EventProgress = (await import("../models/EventProgress")).default;
        const Event        = (await import("../models/Event")).default;
        const activeEvent  = await Event.findOne({ status: "active" }).lean();
        if (!activeEvent) return { eventId: null, totalParticipants: 0, premiumHolders: 0, activePlayers: 0 };
        const [totalParticipants, premiumHolders, activePlayers] = await Promise.all([
          EventProgress.countDocuments({ eventId: (activeEvent as any)._id }),
          User.countDocuments({ premiumPassEventId: String((activeEvent as any)._id) }),
          User.countDocuments({ lastLogin: { $gte: weekStart } }),
        ]);
        return { eventId: String((activeEvent as any)._id), totalParticipants, premiumHolders, activePlayers };
      })(),
      // Bounty pool
      (async () => {
        const Bounty = (await import("../models/Bounty")).default;
        const result = await Bounty.aggregate([
          { $match: { status: "active" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return result[0]?.total ?? 0;
      })(),
      // New registrations per day — last 14 days
      User.aggregate([
        { $match: { createdAt: { $gte: day14Start } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
      ]),
      // Retention: players who logged in TODAY
      User.countDocuments({ lastLogin: { $gte: todayStart } }),
      // Retention: players who logged in 7 days ago (within that day)
      (async () => {
        const d7 = new Date(todayStart); d7.setDate(d7.getDate() - 7);
        const d7end = new Date(d7); d7end.setDate(d7end.getDate() + 1);
        return User.countDocuments({ lastLogin: { $gte: d7, $lt: d7end } });
      })(),
    ]);

    // Top 10 market items by source from EconomyLog
    const topItems = await EconomyLog.aggregate([
      { $match: { source: "market_purchase", createdAt: { $gte: weekStart } } },
      { $group: { _id: "$username", count: { $sum: 1 }, dcSpent: { $sum: "$amount" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const participationRate = eventStats.activePlayers > 0
      ? Math.round((eventStats.totalParticipants / eventStats.activePlayers) * 100)
      : 0;
    const conversionRate = eventStats.totalParticipants > 0
      ? Math.round((eventStats.premiumHolders / eventStats.totalParticipants) * 100)
      : 0;

    res.json({
      totalDcCirculation:   circulationResult[0]?.total ?? 0,
      totalNcCirculation:   ncResult[0]?.total ?? 0,
      dcCreatedToday:       dcInToday[0]?.total ?? 0,
      dcDestroyedToday:     dcOutToday[0]?.total ?? 0,
      ncCreatedToday:       ncInToday[0]?.total ?? 0,
      ncDestroyedToday:     ncOutToday[0]?.total ?? 0,
      top10DcEarners,
      top10NcSpenders,
      activeAuctionCount:   activeAuctions,
      totalAuctionEscrow:   auctionEscrow[0]?.total ?? 0,
      eventParticipationRate: participationRate,
      battlePassConversionRate: conversionRate,
      bountyPoolTotal:      bountyPool,
      registrationsPerDay:  registrationsRaw,
      playersOnlineToday:   retentionNow,
      retentionRate:        retention7dAgo > 0
        ? Math.round((retentionNow / retention7dAgo) * 100)
        : 0,
      topMarketSpenders:    topItems,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/owner/events/:id — draft events only
router.delete("/events/:id", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const event = await Event.findById(req.params["id"]);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status !== "draft") return res.status(409).json({ message: "Only draft events can be deleted" });
    await Event.findByIdAndDelete(event._id);
    await EventProgress.deleteMany({ eventId: event._id });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "owner", action: "delete-event", details: { eventId: String(event._id), name: event.name } });
    res.json({ message: `Event "${event.name}" deleted` });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
