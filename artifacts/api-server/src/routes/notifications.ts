import { Router } from "express";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notes = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json(notes.map(n => ({
      id: n._id,
      type: n.type,
      message: n.message,
      read: n.read,
      link: (n as any).link ?? null,
      createdAt: n.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "notifications error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true } }
    );
    res.json({ message: "Marked as read" });
  } catch (err: any) {
    req.log.error({ err }, "mark read error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    req.log.error({ err }, "read-all error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
