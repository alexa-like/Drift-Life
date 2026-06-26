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
    res.json(events.map(e => ({
      id: e._id,
      type: e.type,
      actor: e.actor,
      actorId: e.actorId,
      target: e.target,
      message: e.message,
      dc: e.dc,
      xp: e.xp,
      reactions: (e as any).reactions || { like: 0, laugh: 0, shock: 0, respect: 0 },
      comments: (e as any).comments || [],
      createdAt: e.createdAt,
    })));
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
