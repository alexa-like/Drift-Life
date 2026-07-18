/**
 * Ban Appeals — the one area a banned player can still reach (see banGate).
 * POST /api/ban-appeal/mine        — player: send a message (creates the thread on first use)
 * GET  /api/ban-appeal/mine        — player: view own thread + current ban status
 * GET  /api/ban-appeal             — staff: list all appeal threads
 * GET  /api/ban-appeal/:id         — staff: full thread detail
 * POST /api/ban-appeal/:id/reply   — staff: reply on a thread
 * POST /api/ban-appeal/:id/status  — staff: resolve/reopen, optionally unban in the same action
 */
import { Router } from "express";
import BanAppeal from "../models/BanAppeal";
import User from "../models/User";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/ban-appeal/mine
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [appeal, user] = await Promise.all([
      BanAppeal.findOne({ userId: req.userId }).lean(),
      User.findById(req.userId).select("banned banReason").lean(),
    ]);
    res.json({
      banned: !!(user as any)?.banned,
      banReason: (user as any)?.banReason ?? null,
      appeal: appeal
        ? { id: appeal._id, status: appeal.status, messages: appeal.messages, createdAt: appeal.createdAt }
        : null,
    });
  } catch (err: any) {
    req.log.error({ err }, "get my ban appeal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/ban-appeal/mine
router.post("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) return res.status(400).json({ message: "Message required" });
    if (text.length > 1000) return res.status(400).json({ message: "Message too long (max 1000 chars)" });

    const user = await User.findById(req.userId).select("username banned banReason").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const message = {
      sender: "player" as const,
      senderName: (user as any).username,
      text: text.trim(),
      createdAt: new Date(),
    };

    const appeal = await BanAppeal.findOneAndUpdate(
      { userId: req.userId },
      {
        $setOnInsert: {
          userId: req.userId,
          username: (user as any).username,
          banReason: (user as any).banReason ?? null,
        },
        $push: { messages: message },
        $set: { status: "open", lastPlayerReplyAt: new Date() },
      },
      { upsert: true, returnDocument: "after" },
    );

    res.status(201).json({
      message: "Appeal message sent",
      appeal: { id: appeal!._id, status: appeal!.status, messages: appeal!.messages },
    });
  } catch (err: any) {
    req.log.error({ err }, "post ban appeal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/ban-appeal — staff list
router.get("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const appeals = await BanAppeal.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
    res.json(
      appeals.map((a) => ({
        id: a._id,
        userId: a.userId,
        username: a.username,
        banReason: a.banReason,
        status: a.status,
        messageCount: a.messages.length,
        lastMessage: a.messages[a.messages.length - 1] ?? null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );
  } catch (err: any) {
    req.log.error({ err }, "list ban appeals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/ban-appeal/:id — staff full thread
router.get("/:id", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const appeal = await BanAppeal.findById(req.params.id).lean();
    if (!appeal) return res.status(404).json({ message: "Appeal not found" });
    res.json(appeal);
  } catch (err: any) {
    req.log.error({ err }, "get ban appeal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/ban-appeal/:id/reply — staff reply
router.post("/:id/reply", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) return res.status(400).json({ message: "Message required" });
    if (text.length > 1000) return res.status(400).json({ message: "Message too long (max 1000 chars)" });

    const appeal = await BanAppeal.findById(req.params.id);
    if (!appeal) return res.status(404).json({ message: "Appeal not found" });

    appeal.messages.push({
      sender: "staff",
      senderName: req.username ?? "staff",
      text: text.trim(),
      createdAt: new Date(),
    } as any);
    appeal.lastStaffReplyAt = new Date();
    appeal.status = "open";
    await appeal.save();
    res.json({ message: "Reply sent" });
  } catch (err: any) {
    req.log.error({ err }, "reply ban appeal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/ban-appeal/:id/status — staff: resolve/reopen, optionally unban
router.post("/:id/status", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, unban } = req.body as { status: string; unban?: boolean };
    if (!["open", "resolved"].includes(status)) return res.status(400).json({ message: "Invalid status" });

    const appeal = await BanAppeal.findById(req.params.id);
    if (!appeal) return res.status(404).json({ message: "Appeal not found" });

    appeal.status = status as any;
    appeal.resolvedBy = req.username ?? "staff";
    await appeal.save();

    if (unban) {
      await User.updateOne({ _id: appeal.userId }, { $set: { banned: false, banReason: null } });
    }

    res.json({ message: "Appeal updated" });
  } catch (err: any) {
    req.log.error({ err }, "update ban appeal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
