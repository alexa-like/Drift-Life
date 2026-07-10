import { Router } from "express";
import FeedEvent, { IFeedEvent } from "../models/FeedEvent";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// System-generated event types — these are the only ones shown on the broadcast feed.
// "post" is excluded: players cannot self-post to the system feed.
const SYSTEM_EVENT_TYPES: IFeedEvent["type"][] = [
  "crime", "fight", "job", "level_up", "market", "bank",
  "system", "hospital", "travel", "daily", "achievement",
  "race", "hack", "garage",
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
      id:        e._id,
      type:      e.type,
      actor:     e.actor,
      actorId:   e.actorId,
      target:    e.target,
      message:   e.message,
      dc:        e.dc,
      xp:        e.xp,
      pinned:    (e as any).pinned ?? false,
      createdAt: e.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "feed error");
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
