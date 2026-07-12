/**
 * Player Reports
 * POST   /api/reports              — file a report against another player
 * GET    /api/reports/mine         — reporter: see my submitted reports (+ thread)
 * POST   /api/reports/mine/:id/reply — reporter: reply on my own report's thread
 * GET    /api/reports              — staff: list all reports (filterable)
 * GET    /api/reports/:id          — staff: full report detail + thread
 * POST   /api/reports/:id/reply    — staff: reply on a report's thread
 * POST   /api/reports/:id/status   — staff: update status + review note
 */
import { Router } from "express";
import PlayerReport from "../models/PlayerReport";
import User from "../models/User";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// POST /api/reports — file a report
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId, category, description, evidence } = req.body as {
      targetId: string; category: string; description: string; evidence?: string;
    };

    if (!targetId || !category || !description)
      return res.status(400).json({ message: "targetId, category, description required" });
    if (description.length > 1000)
      return res.status(400).json({ message: "Description too long (max 1000 chars)" });

    const VALID_CATEGORIES = ["cheating","harassment","hate_speech","spam","multi_account","impersonation","nsfw","other"];
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ message: "Invalid category" });

    if (String(targetId) === String(req.userId))
      return res.status(400).json({ message: "Cannot report yourself" });

    const target = await User.findById(targetId).select("username").lean();
    if (!target) return res.status(404).json({ message: "Target player not found" });

    const reporter = await User.findById(req.userId).select("username").lean();
    if (!reporter) return res.status(404).json({ message: "Reporter not found" });

    // Rate limit: max 5 reports per hour per reporter
    const hourAgo = new Date(Date.now() - 3_600_000);
    const recentCount = await PlayerReport.countDocuments({ reporterId: req.userId, createdAt: { $gte: hourAgo } });
    if (recentCount >= 5)
      return res.status(429).json({ message: "You have submitted too many reports recently. Please wait." });

    // Deduplicate: same reporter → same target in last 24 h
    const dayAgo = new Date(Date.now() - 86_400_000);
    const dupCheck = await PlayerReport.exists({ reporterId: req.userId, targetId, createdAt: { $gte: dayAgo } });
    if (dupCheck)
      return res.status(409).json({ message: "You have already filed a report against this player recently." });

    const report = await PlayerReport.create({
      reporterId: req.userId,
      reporterName: (reporter as any).username,
      targetId,
      targetName: (target as any).username,
      category,
      description: description.trim(),
      evidence: evidence?.trim() || null,
    });

    res.status(201).json({ message: "Report submitted. Our moderation team will review it.", id: report._id });
  } catch (err: any) {
    req.log.error({ err }, "create report error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reports/mine — reporter's own reports
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const reports = await PlayerReport.find({ reporterId: req.userId })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json(reports.map(r => ({
      id: r._id,
      target: r.targetName,
      category: r.category,
      description: r.description,
      status: r.status,
      reviewNote: r.reviewNote,
      messages: r.messages ?? [],
      createdAt: r.createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get my reports error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reports/mine/:id/reply — reporter replies on their own report thread
router.post("/mine/:id/reply", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) return res.status(400).json({ message: "Message required" });
    if (text.length > 1000) return res.status(400).json({ message: "Message too long (max 1000 chars)" });

    const report = await PlayerReport.findOne({ _id: req.params.id, reporterId: req.userId });
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.messages.push({
      sender: "reporter",
      senderName: req.username ?? "player",
      text: text.trim(),
      createdAt: new Date(),
    } as any);
    await report.save();
    res.json({ message: "Reply sent" });
  } catch (err: any) {
    req.log.error({ err }, "reporter reply error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reports — staff: list all (filter by status, category)
router.get("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, category, page: p } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const PAGE = Math.max(1, parseInt(p ?? "1"));
    const LIMIT = 40;

    const [reports, total] = await Promise.all([
      PlayerReport.find(filter).sort({ createdAt: -1 }).skip((PAGE - 1) * LIMIT).limit(LIMIT).lean(),
      PlayerReport.countDocuments(filter),
    ]);

    res.json({
      reports: reports.map(r => ({
        id: r._id,
        reporter: { id: r.reporterId, name: r.reporterName },
        target: { id: r.targetId, name: r.targetName },
        category: r.category,
        description: r.description,
        evidence: r.evidence,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      })),
      total,
      pages: Math.ceil(total / LIMIT),
      page: PAGE,
    });
  } catch (err: any) {
    req.log.error({ err }, "list reports error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/reports/:id — staff: full report detail + thread
router.get("/:id", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const r = await PlayerReport.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ message: "Report not found" });
    res.json({
      id: r._id,
      reporter: { id: r.reporterId, name: r.reporterName },
      target: { id: r.targetId, name: r.targetName },
      category: r.category,
      description: r.description,
      evidence: r.evidence,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewNote: r.reviewNote,
      messages: r.messages ?? [],
      createdAt: r.createdAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "get report detail error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reports/:id/reply — staff: reply on a report's thread (visible to reporter)
router.post("/:id/reply", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) return res.status(400).json({ message: "Message required" });
    if (text.length > 1000) return res.status(400).json({ message: "Message too long (max 1000 chars)" });

    const report = await PlayerReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.messages.push({
      sender: "staff",
      senderName: req.username ?? "staff",
      text: text.trim(),
      createdAt: new Date(),
    } as any);
    if (report.status === "open") report.status = "under_review" as any;
    report.reviewedBy = req.username ?? "staff";
    await report.save();
    res.json({ message: "Reply sent" });
  } catch (err: any) {
    req.log.error({ err }, "staff reply error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/reports/:id/status — staff: update status
router.post("/:id/status", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, reviewNote } = req.body as { status: string; reviewNote?: string };
    const VALID = ["open", "under_review", "resolved", "dismissed"];
    if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const report = await PlayerReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status as any;
    report.reviewedBy = req.username ?? "staff";
    if (reviewNote) report.reviewNote = reviewNote.trim().slice(0, 500);
    await report.save();
    res.json({ message: "Report updated" });
  } catch (err: any) {
    req.log.error({ err }, "update report error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
