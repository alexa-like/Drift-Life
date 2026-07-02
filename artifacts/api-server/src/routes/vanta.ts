import { Router } from "express";
import VantaLog from "../models/VantaLog";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/vanta — list logs (staff only)
router.get("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { dismissed, severity } = req.query as { dismissed?: string; severity?: string };

    const filter: Record<string, unknown> = {};
    if (dismissed !== undefined) filter.dismissed = dismissed === "true";
    if (severity) filter.severity = severity;

    const logs = await VantaLog.find(filter)
      .sort({ severity: -1, createdAt: -1 })
      .limit(100)
      .select("playerId playerName trigger severity details dismissed dismissedBy createdAt");

    res.json(logs.map((l) => ({
      id: l._id,
      player: { id: l.playerId, name: l.playerName },
      trigger: l.trigger,
      severity: l.severity,
      details: l.details,
      dismissed: l.dismissed,
      dismissedBy: l.dismissedBy,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/vanta/summary — count by severity
router.get("/summary", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const counts = await VantaLog.aggregate([
      { $match: { dismissed: false } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]);
    const summary: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const c of counts) summary[c._id as string] = c.count;
    res.json(summary);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/vanta/:id/dismiss — dismiss a log
router.post("/:id/dismiss", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const log = await VantaLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Log not found" });
    log.dismissed = true;
    log.dismissedBy = req.username ?? "staff";
    log.dismissedAt = new Date();
    await log.save();
    res.json({ message: "Log dismissed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/vanta/flag — manually flag a player
router.post("/flag", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { playerId, playerName, trigger, severity, details } = req.body as {
      playerId: string;
      playerName: string;
      trigger: string;
      severity: string;
      details: string;
    };

    if (!playerId || !trigger || !severity || !details)
      return res.status(400).json({ message: "playerId, trigger, severity, details required" });

    const log = await VantaLog.create({
      playerId,
      playerName: playerName ?? "Unknown",
      trigger: "manual_flag",
      severity,
      details: `[Manual by ${req.username ?? "staff"}] ${details}`,
    });

    res.status(201).json({ message: "Player flagged", id: log._id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
