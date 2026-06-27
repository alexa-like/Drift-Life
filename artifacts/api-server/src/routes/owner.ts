import { Router } from "express";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import { requireStaff, requireOwner, AuthRequest } from "../middlewares/auth";
import { levelUp, xpForLevel } from "../models/User";
import { SHOP_ITEMS, PRICE_OVERRIDES } from "./market";
import { FRAME_CATALOG, FRAME_PRICE_OVERRIDES } from "./frames";

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

// GET /api/owner/frames — list all frames with current (possibly overridden) prices
router.get("/frames", async (_req, res) => {
  res.json(FRAME_CATALOG.map(f => ({
    frameId: f.frameId,
    displayName: f.displayName,
    rarity: f.rarity,
    currency: f.currency,
    basePrice: f.price,
    currentPrice: FRAME_PRICE_OVERRIDES.get(f.frameId) ?? f.price,
    overridden: FRAME_PRICE_OVERRIDES.has(f.frameId),
    isFree: f.isFree,
    description: f.description,
  })));
});

// POST /api/owner/frames/:frameId/price — set a custom frame price
router.post("/frames/:frameId/price", requireOwner as any, async (req: AuthRequest, res) => {
  const frame = FRAME_CATALOG.find(f => f.frameId === req.params.frameId);
  if (!frame) return res.status(404).json({ message: "Frame not found" });
  const price = Math.floor(Number(req.body.price));
  if (isNaN(price) || price < 0) return res.status(400).json({ message: "Invalid price" });
  if (price === 0 && frame.price !== 0) {
    FRAME_PRICE_OVERRIDES.delete(frame.frameId);
    return res.json({ message: `${frame.displayName} price reset to default (${frame.price} ${frame.currency.toUpperCase()})`, price: frame.price });
  }
  FRAME_PRICE_OVERRIDES.set(frame.frameId, price);
  req.log.info({ frameId: frame.frameId, oldPrice: frame.price, newPrice: price }, "owner set frame price");
  res.json({ message: `${frame.displayName} price set to ${price} ${frame.currency.toUpperCase()}`, price });
});

// DELETE /api/owner/frames/:frameId/price — reset frame price to default
router.delete("/frames/:frameId/price", requireOwner as any, async (req: AuthRequest, res) => {
  const frame = FRAME_CATALOG.find(f => f.frameId === req.params.frameId);
  if (!frame) return res.status(404).json({ message: "Frame not found" });
  FRAME_PRICE_OVERRIDES.delete(frame.frameId);
  res.json({ message: `${frame.displayName} price reset to default (${frame.price} ${frame.currency.toUpperCase()})`, price: frame.price });
});

export default router;
