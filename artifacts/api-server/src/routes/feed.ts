import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import FeedEvent, { IFeedEvent } from "../models/FeedEvent";
import User from "../models/User";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

function cleanText(raw: string): string {
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
}

// Event types shown on the broadcast feed — system-generated events plus
// player self-posts ("post").
const SYSTEM_EVENT_TYPES: IFeedEvent["type"][] = [
  "crime", "fight", "job", "level_up", "market", "bank",
  "system", "hospital", "travel", "daily", "achievement",
  "race", "hack", "garage", "post",
];

// GET /api/feed?page=1&limit=30
// Returns system-generated broadcast events only (no player self-posts).
// Pinned events (weekly recap etc.) always sort to the top.
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100);
    const page   = Math.max(Number(req.query.page)  || 1,  1);
    const skip   = (page - 1) * limit;

    const [pinned, rest] = await Promise.all([
      FeedEvent.find({ type: { $in: SYSTEM_EVENT_TYPES }, pinned: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      FeedEvent.find({ type: { $in: SYSTEM_EVENT_TYPES }, pinned: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const events = [...pinned, ...rest];

    res.json(events.map(e => ({
      id:             e._id,
      type:           e.type,
      actor:          e.actor,
      actorId:        e.actorId,
      actorChatFrame: (e as any).actorChatFrame ?? null,
      actorLevel:     (e as any).actorLevel ?? null,
      target:         e.target,
      message:        e.message,
      dc:             e.dc,
      xp:             e.xp,
      pinned:         (e as any).pinned ?? false,
      createdAt:      e.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "feed error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/feed/post — public player post, any logged-in player.
// Body: { message: string }
// Rate limited to one post per 30s per player to prevent spam.
const lastPostAt = new Map<string, number>();
router.post("/post", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "message required" });
    }
    const trimmed = cleanText(message).slice(0, 500);
    if (!trimmed) return res.status(400).json({ message: "message cannot be empty" });

    const userId = req.userId!;
    const last = lastPostAt.get(userId) ?? 0;
    const now = Date.now();
    if (now - last < 30_000) {
      return res.status(429).json({ message: "Slow down — you can post again in a few seconds" });
    }

    const user = await User.findById(userId).select("username level equippedChatFrame").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    lastPostAt.set(userId, now);

    const event = await FeedEvent.create({
      type:           "post",
      actor:          user.username,
      actorId:        userId,
      actorChatFrame: user.equippedChatFrame ?? null,
      actorLevel:     user.level ?? 1,
      message:        trimmed,
    });

    res.status(201).json({
      id: event._id, message: trimmed, createdAt: event.createdAt,
      actor: user.username, actorChatFrame: user.equippedChatFrame ?? null, actorLevel: user.level ?? 1,
    });
  } catch (err: any) {
    req.log.error({ err }, "player feed post error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/feed — manual system announcement, staff/admin/owner only.
// Body: { message: string, category?: string, district?: string }
router.post("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { message, category, district } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "message required" });
    }
    const trimmed = message.trim().slice(0, 1000);
    if (!trimmed) return res.status(400).json({ message: "message cannot be empty" });

    const event = await FeedEvent.create({
      type:    "system",
      actor:   "SYSTEM",
      actorId: null,
      message: trimmed,
      ...(district ? { target: district } : {}),
    });

    res.status(201).json({ id: event._id, message: trimmed, createdAt: event.createdAt });
  } catch (err: any) {
    req.log.error({ err }, "system feed post error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/system/feed — alias for the staff endpoint above (spec-named route).
router.post("/system", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { message, category, district } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "message required" });
    }
    const trimmed = message.trim().slice(0, 1000);
    if (!trimmed) return res.status(400).json({ message: "message cannot be empty" });

    const event = await FeedEvent.create({
      type:    "system",
      actor:   "SYSTEM",
      actorId: null,
      message: trimmed,
      ...(district ? { target: district } : {}),
    });

    res.status(201).json({ id: event._id, message: trimmed, createdAt: event.createdAt });
  } catch (err: any) {
    req.log.error({ err }, "system feed post error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/feed/:id — staff/admin/owner only.
router.delete("/:id", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const event = await FeedEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await FeedEvent.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err: any) {
    req.log.error({ err }, "delete feed event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
