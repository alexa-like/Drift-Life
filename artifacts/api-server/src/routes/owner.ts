import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireStaff, requireOwner, AuthRequest } from "../middlewares/auth";
import { levelUp, xpForLevel } from "../models/User";
import { SHOP_ITEMS, PRICE_OVERRIDES } from "./market";
import Frame from "../models/Frame";
import ServerConfig from "../models/ServerConfig";

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
    res.json({ message: `${user.username} set to level ${lvl}`, level: lvl });
  } catch (err: any) {
    req.log.error({ err }, "owner set-level error");
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
    req.log.info({ userId, delta }, "owner granted xp");
    res.json({ message: `${delta >= 0 ? "+" : ""}${delta} XP granted to ${user.username}${leveled ? " (leveled up!)" : ""}`, xp: user.xp, level: user.level });
  } catch (err: any) {
    req.log.error({ err }, "grant xp error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/owner/frames — list ALL frames (admin view)
router.get("/frames", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const frames = await Frame.find({}).sort({ rarity: 1, price: 1 }).lean();
    const allUsers = await User.find({}).select("ownedFrames").lean();
    const ownedCounts: Record<string, number> = {};
    for (const u of allUsers) {
      for (const fid of (u.ownedFrames || [])) {
        ownedCounts[fid] = (ownedCounts[fid] || 0) + 1;
      }
    }
    res.json(frames.map((f: any) => ({
      frameId: f.frameId,
      displayName: f.displayName,
      rarity: f.rarity,
      currency: f.currency,
      price: f.price,
      salePrice: f.salePrice,
      saleExpiry: f.saleExpiry,
      isFree: f.isFree,
      isWeeklyFree: f.isWeeklyFree,
      isFeatured: f.isFeatured,
      isVisible: f.isVisible,
      isCustom: f.isCustom,
      glowColor: f.glowColor,
      description: f.description,
      ownedByCount: ownedCounts[f.frameId] || 0,
    })));
  } catch (err: any) {
    req.log.error({ err }, "owner get frames error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/owner/frames/:frameId — update a frame's price, sale, or visibility
router.patch("/frames/:frameId", requireOwner as any, async (req: AuthRequest, res) => {
  try {
    const frame = await Frame.findOne({ frameId: req.params.frameId });
    if (!frame) return res.status(404).json({ message: "Frame not found" });

    const { price, salePrice, isFeatured, isWeeklyFree, isVisible } = req.body;
    if (price !== undefined) frame.price = Math.max(0, Math.floor(Number(price)));
    if (salePrice !== undefined) frame.salePrice = salePrice === null ? null : Math.max(0, Math.floor(Number(salePrice)));
    if (isFeatured !== undefined) frame.isFeatured = Boolean(isFeatured);
    if (isWeeklyFree !== undefined) {
      if (isWeeklyFree) {
        await Frame.updateMany({ isWeeklyFree: true }, { isWeeklyFree: false });
      }
      frame.isWeeklyFree = Boolean(isWeeklyFree);
    }
    if (isVisible !== undefined) frame.isVisible = Boolean(isVisible);

    await frame.save();
    req.log.info({ frameId: frame.frameId }, "owner updated frame");
    res.json({ message: `${frame.displayName} updated`, frame });
  } catch (err: any) {
    req.log.error({ err }, "owner patch frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
