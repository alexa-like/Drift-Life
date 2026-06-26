import { Router } from "express";
import FeedEvent from "../models/FeedEvent";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/feed
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const events = await FeedEvent.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(events.map(e => ({
      id: e._id,
      type: e.type,
      actor: e.actor,
      target: e.target,
      message: e.message,
      dc: e.dc,
      xp: e.xp,
      createdAt: e.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "feed error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
