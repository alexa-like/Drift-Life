import { Router } from "express";
import FeedEvent from "../models/FeedEvent";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/feed
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const skip = Number(req.query.skip) || 0;
    const events = await FeedEvent.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Batch-fetch actor frame data for events that have an actorId
    const actorIds = [...new Set(events.map(e => e.actorId).filter(Boolean))];
    const actorMap: Record<string, { equippedFrame?: string | null; equippedFrameColor?: string | null; avatarUrl?: string | null }> = {};
    if (actorIds.length > 0) {
      const actors = await User.find({ _id: { $in: actorIds } })
        .select("_id equippedFrame equippedFrameColor avatarUrl")
        .lean();
      for (const a of actors) {
        actorMap[String(a._id)] = {
          equippedFrame: (a as any).equippedFrame ?? null,
          equippedFrameColor: (a as any).equippedFrameColor ?? null,
          avatarUrl: (a as any).avatarUrl ?? null,
        };
      }
    }

    res.json(events.map(e => {
      const actorData = e.actorId ? actorMap[String(e.actorId)] : undefined;
      return {
        id: e._id,
        type: e.type,
        actor: e.actor,
        actorId: e.actorId,
        actorFrame: actorData?.equippedFrame ?? (e as any).actorFrame ?? null,
        actorFrameColor: actorData?.equippedFrameColor ?? (e as any).actorFrameColor ?? null,
        actorAvatarUrl: actorData?.avatarUrl ?? (e as any).actorAvatarUrl ?? null,
        target: e.target,
        message: e.message,
        dc: e.dc,
        xp: e.xp,
        reactions: (e as any).reactions || { like: 0, laugh: 0, shock: 0, respect: 0 },
        comments: (e as any).comments || [],
        createdAt: e.createdAt,
      };
    }));
  } catch (err: any) {
    req.log.error({ err }, "feed error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/feed — create manual post
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string") return res.status(400).json({ message: "content required" });
    const trimmed = content.trim().slice(0, 280);
    if (!trimmed) return res.status(400).json({ message: "Content cannot be empty" });

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const event = await FeedEvent.create({
      type: "post",
      actor: user.username,
      actorId: user._id,
      message: trimmed,
    });

    res.status(201).json({ id: event._id, message: trimmed, createdAt: event.createdAt });
  } catch (err: any) {
    req.log.error({ err }, "create post error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/feed/:id — owner or staff/admin/owner role can delete
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await FeedEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Post not found" });

    const user = await User.findById(req.userId).select("role").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const isOwner = event.actorId && String(event.actorId) === String(req.userId);
    const isMod = ["admin", "staff", "owner"].includes((user as any).role);
    if (!isOwner && !isMod) return res.status(403).json({ message: "Cannot delete this post" });

    await FeedEvent.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err: any) {
    req.log.error({ err }, "delete feed event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/feed/:id/react
router.post("/:id/react", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reaction } = req.body;
    const validReactions = ["like", "laugh", "shock", "respect"];
    if (!validReactions.includes(reaction)) return res.status(400).json({ message: "Invalid reaction" });

    const event = await FeedEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Post not found" });

    const reactions = (event as any).reactions || { like: 0, laugh: 0, shock: 0, respect: 0 };
    reactions[reaction] = (reactions[reaction] || 0) + 1;
    (event as any).reactions = reactions;
    await event.save();

    res.json({ reactions });
  } catch (err: any) {
    req.log.error({ err }, "react error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/feed/:id/comment
router.post("/:id/comment", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "content required" });
    const event = await FeedEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Post not found" });
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const comment = { username: user.username, content: String(content).slice(0, 280), at: new Date() };
    if (!(event as any).comments) (event as any).comments = [];
    (event as any).comments.push(comment);
    await event.save();

    res.status(201).json({ comment });
  } catch (err: any) {
    req.log.error({ err }, "comment error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
