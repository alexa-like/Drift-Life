import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireStaff, requireOwner, AuthRequest } from "../middlewares/auth";
import { levelUp, xpForLevel } from "../models/User";
import { SHOP_ITEMS, PRICE_OVERRIDES } from "./market";
import ServerConfig from "../models/ServerConfig";
import AdminAuditLog, { logAdminAction } from "../models/AdminAuditLog";

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
    await user.save();
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "ban", targetId: user.id, targetUsername: user.username, details: { reason: user.banReason } });
    res.json({ message: `${user.username} banned` });
  } catch (err: any) {
    req.log.error({ err }, "ban error");
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
    user.skillPoints = lvl >= 10 ? Math.floor((lvl - 10) / 5) + 1 : 0;
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
      { upsert: true, new: true }
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
        $addToSet: { ownedChatFrames: tierCfg.frameId },
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
    const PlayerRoyaleLog = (await import("../models/PlayerRoyaleLog")).default;
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
    const users   = await User.find({ _id: { $in: userIds } }).select("username").lean();
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
    const CombatMatch = (await import("../models/CombatMatch")).default;
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
    const RaceMatch = (await import("../models/RaceMatch")).default;
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

// ── PATCH /api/owner/royale-items/:id/dropweight — adjust drop weight in DB ────
router.patch("/royale-items/:id/dropweight", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const RoyaleItem = (await import("../models/RoyaleItem")).default;
    const weight = Math.max(0, Number(req.body.dropWeight));
    if (isNaN(weight)) return res.status(400).json({ message: "Invalid dropWeight" });
    const item = await RoyaleItem.findByIdAndUpdate(
      req.params.id,
      { $set: { dropWeight: weight } },
      { new: true }
    ).lean();
    if (!item) return res.status(404).json({ message: "Item not found" });
    logAdminAction({ actorId: req.userId!, actorUsername: req.username || "unknown", action: "set-royale-dropweight", details: { itemId: req.params.id, dropWeight: weight } });
    res.json({ message: `Drop weight set to ${weight}`, item });
  } catch (err: any) {
    req.log.error({ err }, "royale-dropweight error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/owner/royale-items — list all royale items with current drop weights
router.get("/royale-items", async (_req, res) => {
  try {
    const RoyaleItem = (await import("../models/RoyaleItem")).default;
    const items = await RoyaleItem.find().sort({ royaleType: 1, tier: 1, name: 1 }).lean();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
