/**
 * Support Tickets
 * POST  /api/support            — open a new ticket
 * GET   /api/support/mine       — player: see my tickets + replies
 * POST  /api/support/:id/reply  — player or staff: add a reply
 * GET   /api/support            — staff: list all tickets (filterable)
 * POST  /api/support/:id/status — staff: update ticket status
 */
import { Router } from "express";
import SupportTicket from "../models/SupportTicket";
import User from "../models/User";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";

const router = Router();

// POST /api/support — open ticket
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, subject, body } = req.body as { category: string; subject: string; body: string };
    if (!category || !subject || !body)
      return res.status(400).json({ message: "category, subject, and body are required" });
    if (subject.length > 120)
      return res.status(400).json({ message: "Subject too long (max 120 chars)" });
    if (body.length > 2000)
      return res.status(400).json({ message: "Body too long (max 2000 chars)" });

    const VALID = ["account", "bug", "payment", "appeal", "suggestion", "other"];
    if (!VALID.includes(category))
      return res.status(400).json({ message: "Invalid category" });

    const user = await User.findById(req.userId).select("username").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Rate limit: max 3 open tickets at a time
    const openCount = await SupportTicket.countDocuments({ playerId: req.userId, status: { $in: ["open", "in_progress"] } });
    if (openCount >= 3)
      return res.status(429).json({ message: "You already have 3 open tickets. Please wait for them to be resolved." });

    const ticket = await (SupportTicket.create as Function)({
      playerId: req.userId,
      playerName: (user as any).username,
      category,
      subject: subject.trim(),
      body: body.trim(),
    }) as InstanceType<typeof SupportTicket>;

    res.status(201).json({ message: "Ticket created. Our team will respond soon.", id: ticket._id });
  } catch (err: any) {
    req.log.error({ err }, "create ticket error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/support/mine — player: my tickets
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tickets = await SupportTicket.find({ playerId: req.userId })
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json(tickets.map(t => ({
      id: t._id,
      category: t.category,
      subject: t.subject,
      body: t.body,
      status: t.status,
      replies: (t.replies ?? []).map(r => ({
        authorName: r.authorName,
        isStaff: r.isStaff,
        content: r.content,
        createdAt: (r as any).createdAt,
      })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get my tickets error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/support/:id/reply — add reply
router.post("/:id/reply", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body as { content: string };
    if (!content || content.trim().length === 0)
      return res.status(400).json({ message: "content required" });
    if (content.length > 2000)
      return res.status(400).json({ message: "Reply too long (max 2000 chars)" });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const isStaff = ["owner","admin","staff"].includes(req.role ?? "");

    // Non-staff can only reply to their own tickets
    if (!isStaff && String(ticket.playerId) !== String(req.userId))
      return res.status(403).json({ message: "Not your ticket" });

    if (ticket.status === "closed")
      return res.status(400).json({ message: "This ticket is closed" });

    const user = await User.findById(req.userId).select("username").lean();
    ticket.replies.push({
      authorId: req.userId as any,
      authorName: (user as any)?.username ?? "Unknown",
      isStaff,
      content: content.trim(),
    } as any);

    // Move to in_progress when staff replies to an open ticket
    if (isStaff && ticket.status === "open") ticket.status = "in_progress";
    // Reopen if player replies to resolved ticket
    if (!isStaff && ticket.status === "resolved") ticket.status = "open";

    await ticket.save();
    res.json({ message: "Reply added" });
  } catch (err: any) {
    req.log.error({ err }, "reply ticket error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/support — staff: list all tickets
router.get("/", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, category, page: p } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const PAGE = Math.max(1, parseInt(p ?? "1"));
    const LIMIT = 40;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip((PAGE - 1) * LIMIT).limit(LIMIT).lean(),
      SupportTicket.countDocuments(filter),
    ]);

    res.json({
      tickets: tickets.map(t => ({
        id: t._id,
        player: { id: t.playerId, name: t.playerName },
        category: t.category,
        subject: t.subject,
        body: t.body,
        status: t.status,
        assignedTo: t.assignedTo,
        replyCount: t.replies?.length ?? 0,
        lastReplyAt: t.updatedAt,
        createdAt: t.createdAt,
      })),
      total,
      pages: Math.ceil(total / LIMIT),
      page: PAGE,
    });
  } catch (err: any) {
    req.log.error({ err }, "list tickets error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/support/:id/status — staff: change status
router.post("/:id/status", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const { status, assignedTo } = req.body as { status: string; assignedTo?: string };
    const VALID = ["open", "in_progress", "resolved", "closed"];
    if (!VALID.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.status = status as any;
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo || null;
    await ticket.save();
    res.json({ message: "Ticket updated" });
  } catch (err: any) {
    req.log.error({ err }, "update ticket error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/support/:id — staff OR owner: get full ticket with replies
router.get("/:id", requireAuth, requireStaff, async (req: AuthRequest, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).lean();
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json({
      id: ticket._id,
      player: { id: ticket.playerId, name: ticket.playerName },
      category: ticket.category,
      subject: ticket.subject,
      body: ticket.body,
      status: ticket.status,
      assignedTo: ticket.assignedTo,
      replies: (ticket.replies ?? []).map(r => ({
        authorName: r.authorName,
        isStaff: r.isStaff,
        content: r.content,
        createdAt: (r as any).createdAt,
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
  } catch (err: any) {
    req.log.error({ err }, "get ticket error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
