/**
 * Mentor System — Tier 9.3
 * Player-to-player mentorship: registration, request/accept, XP bonus, DC bonuses on level milestones.
 */
import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notifyUser";

const router = Router();

const MENTOR_MIN_LEVEL = 20;
const MENTOR_MAX_MENTEES = 3;

// ── GET /api/mentor/status — caller's mentorship state ───────────────────────
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("isMentor mentorId menteeIds mentorRating mentorRatingCount level")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const [mentorData, menteesData] = await Promise.all([
      user.mentorId
        ? User.findById(user.mentorId).select("username level mentorRating").lean()
        : null,
      (user.menteeIds ?? []).length > 0
        ? User.find({ _id: { $in: user.menteeIds } }).select("username level").lean()
        : Promise.resolve([]),
    ]);

    res.json({
      isMentor: user.isMentor ?? false,
      canRegister: !user.isMentor && !user.mentorId && user.level >= MENTOR_MIN_LEVEL,
      mentor: mentorData
        ? { id: mentorData._id, username: mentorData.username, level: mentorData.level, rating: mentorData.mentorRating }
        : null,
      mentees: (menteesData as any[]).map(m => ({ id: m._id, username: m.username, level: m.level })),
      rating: user.mentorRating ?? 0,
      ratingCount: user.mentorRatingCount ?? 0,
      xpBonusActive: !!(user.mentorId || (user.menteeIds ?? []).length > 0),
    });
  } catch (err: any) {
    logger.error({ err }, "mentor GET /status");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/mentor/register — register as a mentor ────────────────────────
router.post("/register", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("level isMentor mentorId")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < MENTOR_MIN_LEVEL) {
      return res.status(400).json({
        message: `Reach Level ${MENTOR_MIN_LEVEL} before registering as a mentor.`,
      });
    }
    if (user.isMentor) {
      return res.status(400).json({ message: "Already registered as a mentor." });
    }
    if (user.mentorId) {
      return res.status(400).json({
        message: "You currently have an active mentor. End that relationship first.",
      });
    }

    await User.findByIdAndUpdate(req.userId, {
      $set: { isMentor: true },
      $addToSet: { titles: "Mentor" },
    });

    res.json({ message: "Registered as a mentor. Your profile is now visible to new players seeking guidance." });
  } catch (err: any) {
    logger.error({ err }, "mentor POST /register");
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/mentor/available — list open mentor slots ───────────────────────
router.get("/available", requireAuth, async (_req, res) => {
  try {
    const mentors = await User.find({
      isMentor: true,
      banned: false,
      isGhostAccount: false,
    })
      .select("username level mentorRating mentorRatingCount menteeIds faction district")
      .lean();

    res.json(
      mentors.map(m => ({
        id: m._id,
        username: m.username,
        level: m.level,
        rating: m.mentorRating ?? 0,
        ratingCount: m.mentorRatingCount ?? 0,
        activeMentees: (m.menteeIds ?? []).length,
        availableSlots: Math.max(0, MENTOR_MAX_MENTEES - (m.menteeIds ?? []).length),
        faction: m.faction,
        district: m.district,
      })),
    );
  } catch (err: any) {
    logger.error({ err }, "mentor GET /available");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/mentor/request/:mentorId — request a mentor ────────────────────
router.post("/request/:mentorId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { mentorId } = req.params;

    const [requester, mentor] = await Promise.all([
      User.findById(req.userId).select("level mentorId isMentor username").lean(),
      User.findById(mentorId).select("isMentor menteeIds username level").lean(),
    ]);

    if (!requester || !mentor) return res.status(404).json({ message: "User not found" });
    if (requester.isMentor) {
      return res.status(400).json({ message: "Active mentors cannot request a mentor." });
    }
    if (requester.mentorId) {
      return res.status(400).json({ message: "You already have an active mentor." });
    }
    if (String(req.userId) === mentorId) {
      return res.status(400).json({ message: "Cannot request yourself as a mentor." });
    }
    if (!mentor.isMentor) {
      return res.status(400).json({ message: "That player is not a registered mentor." });
    }
    if ((mentor.menteeIds ?? []).length >= MENTOR_MAX_MENTEES) {
      return res.status(400).json({ message: `${mentor.username} has no open mentor slots right now.` });
    }

    await notifyUser({
      userId: String(mentorId),
      type: "general",
      message: `${requester.username} (Level ${requester.level}) is requesting you as their mentor. Accept in the Mentor panel.`,
      link: "/mentor",
      push: { title: "🎓 Mentor Request!", body: `${requester.username} wants to be your mentee.` },
    });

    res.json({ message: `Mentor request sent to ${mentor.username}. You'll be notified when they respond.` });
  } catch (err: any) {
    logger.error({ err }, "mentor POST /request/:mentorId");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/mentor/accept/:menteeId — mentor accepts a mentee ──────────────
router.post("/accept/:menteeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { menteeId } = req.params;

    const [mentor, mentee] = await Promise.all([
      User.findById(req.userId).select("isMentor menteeIds username level"),
      User.findById(menteeId).select("mentorId username level isMentor"),
    ]);

    if (!mentor || !mentee) return res.status(404).json({ message: "User not found" });
    if (!mentor.isMentor) {
      return res.status(400).json({ message: "You are not registered as a mentor." });
    }
    if ((mentor.menteeIds ?? []).length >= MENTOR_MAX_MENTEES) {
      return res.status(400).json({ message: "Mentee slots full." });
    }
    if (mentee.mentorId) {
      return res.status(400).json({ message: `${mentee.username} already has an active mentor.` });
    }
    if (mentee.isMentor) {
      return res.status(400).json({ message: "Active mentors cannot be mentees." });
    }

    await Promise.all([
      User.findByIdAndUpdate(req.userId, { $addToSet: { menteeIds: mentee._id } }),
      User.findByIdAndUpdate(menteeId, { $set: { mentorId: req.userId } }),
    ]);

    await notifyUser({
      userId: String(menteeId),
      type: "general",
      message: `${mentor.username} accepted you as their mentee! You both now earn +15% battle pass XP on all actions.`,
      link: "/mentor",
      push: { title: "🎓 Mentorship Active!", body: "+15% Battle Pass XP activated." },
    });

    res.json({
      message: `Now mentoring ${mentee.username}. Both of you earn +15% battle pass XP.`,
    });
  } catch (err: any) {
    logger.error({ err }, "mentor POST /accept/:menteeId");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/mentor/end — end an active mentorship (either party) ───────────
router.post("/end", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("mentorId menteeIds isMentor username");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.mentorId) {
      // User is a mentee
      const mentor = await User.findById(user.mentorId).select("username").lean();
      await Promise.all([
        User.findByIdAndUpdate(user.mentorId, { $pull: { menteeIds: user._id } }),
        User.findByIdAndUpdate(req.userId, { $set: { mentorId: null } }),
      ]);
      return res.json({ message: `Mentorship with ${mentor?.username ?? "your mentor"} ended.` });
    }

    if ((user.menteeIds ?? []).length > 0) {
      // User is a mentor
      const { menteeId } = req.body as { menteeId?: string };

      if (menteeId) {
        const mentee = await User.findById(menteeId).select("username").lean();
        await Promise.all([
          User.findByIdAndUpdate(req.userId, { $pull: { menteeIds: menteeId } }),
          User.findByIdAndUpdate(menteeId, { $set: { mentorId: null } }),
        ]);
        return res.json({ message: `Ended mentorship with ${mentee?.username ?? "mentee"}.` });
      }

      // End all
      const ids = user.menteeIds ?? [];
      await Promise.all([
        User.findByIdAndUpdate(req.userId, { $set: { menteeIds: [] } }),
        User.updateMany({ _id: { $in: ids } }, { $set: { mentorId: null } }),
      ]);
      return res.json({ message: "All mentorships ended." });
    }

    return res.status(400).json({ message: "No active mentorship to end." });
  } catch (err: any) {
    logger.error({ err }, "mentor POST /end");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/mentor/rate/:mentorId — rate a mentor 1–5 ─────────────────────
router.post("/rate/:mentorId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { mentorId } = req.params;
    const { rating } = req.body as { rating?: number };

    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be an integer from 1 to 5." });
    }

    const mentor = await User.findById(mentorId)
      .select("username mentorRating mentorRatingCount isMentor")
      .lean();
    if (!mentor) return res.status(404).json({ message: "Mentor not found" });
    if (!mentor.isMentor) {
      return res.status(400).json({ message: "That player is not a registered mentor." });
    }

    const oldRating = mentor.mentorRating ?? 0;
    const oldCount  = mentor.mentorRatingCount ?? 0;
    const newCount  = oldCount + 1;
    const newRating = parseFloat(((oldRating * oldCount + rating) / newCount).toFixed(2));

    await User.findByIdAndUpdate(mentorId, {
      $set: { mentorRating: newRating },
      $inc: { mentorRatingCount: 1 },
    });

    res.json({
      message: `Rated ${mentor.username} ${rating}/5 stars.`,
      newRating,
    });
  } catch (err: any) {
    logger.error({ err }, "mentor POST /rate/:mentorId");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
