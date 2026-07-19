import { Router } from "express";
import Notification from "../models/Notification";
import PushSubscription from "../models/PushSubscription";
import { getVapidPublicKey, isWebPushConfigured } from "../lib/webPush";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// ── In-app notifications ─────────────────────────────────────────────────────

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

// POST /api/notifications/:id/read (also PATCH for compatibility)
router.post("/:id/read", requireAuth, async (req: AuthRequest, res) => {
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

// POST /api/notifications/read-all (also PATCH)
router.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    req.log.error({ err }, "read-all error");
    res.status(500).json({ message: "Internal server error" });
  }
});
router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    req.log.error({ err }, "read-all error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Web Push ─────────────────────────────────────────────────────────────────

// GET /api/notifications/push/vapid-key — returns the VAPID public key for browser subscription
router.get("/push/vapid-key", (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    res.status(503).json({ message: "Push notifications are not configured on this server." });
    return;
  }
  res.json({ key });
});

// GET /api/notifications/push/status — whether the current user has any active subscriptions
router.get("/push/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const count = await PushSubscription.countDocuments({ userId: req.userId });
    res.json({ subscribed: count > 0, configured: isWebPushConfigured() });
  } catch (err: any) {
    req.log.error({ err }, "push status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
  userAgent: z.string().max(200).optional(),
});

// POST /api/notifications/push/subscribe — register a browser push subscription
router.post("/push/subscribe", requireAuth, async (req: AuthRequest, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid subscription payload." });
    return;
  }
  try {
    const { endpoint, keys, userAgent = null } = parsed.data;
    // Upsert by endpoint so duplicate registrations are idempotent
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { $set: { userId: req.userId, keys, userAgent } },
      { upsert: true, new: true }
    );
    res.json({ message: "Subscribed to push notifications." });
  } catch (err: any) {
    req.log.error({ err }, "push subscribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// POST /api/notifications/push/unsubscribe — remove a push subscription
router.post("/push/unsubscribe", requireAuth, async (req: AuthRequest, res) => {
  const parsed = UnsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid unsubscribe payload." });
    return;
  }
  try {
    await PushSubscription.deleteOne({ endpoint: parsed.data.endpoint, userId: req.userId });
    res.json({ message: "Unsubscribed from push notifications." });
  } catch (err: any) {
    req.log.error({ err }, "push unsubscribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
