import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import Notification from "../models/Notification";

const router = Router();

const MIN_MENTOR_LEVEL = 30;
const MAX_MENTEES      = 3;
const MENTEE_MAX_LEVEL = 15;
const MENTEE_AUTO_END_LEVEL = 20;

// GET /api/mentor/status — current mentor/mentee relationship for the caller
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("level isMentor mentorId menteeIds username")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const [mentor, mentees] = await Promise.all([
      (user as any).mentorId
        ? User.findById((user as any).mentorId).select("username level").lean()
        : Promise.resolve(null),
      (user as any).menteeIds?.length
        ? User.find({ _id: { $in: (user as any).menteeIds } }).select("username level").lean()
        : Promise.resolve([]),
    ]);

    res.json({
      isMentor:  (user as any).isMentor ?? false,
      mentorId:  (user as any).mentorId ?? null,
      mentor:    mentor ? { id: mentor._id, username: mentor.username, level: mentor.level } : null,
      mentees:   (mentees as any[]).map(m => ({ id: m._id, username: m.username, level: m.level })),
      maxMentees: MAX_MENTEES,
    });
  } catch (err: any) {
    req.log.error({ err }, "mentor status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/mentor/register — opt into the mentor pool (level 30+)
router.post("/register", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < MIN_MENTOR_LEVEL) {
      return res.status(403).json({
        message: `You must be at least level ${MIN_MENTOR_LEVEL} to become a mentor.`,
      });
    }

    if ((user as any).isMentor) {
      return res.status(400).json({ message: "You are already registered as a mentor." });
    }

    (user as any).isMentor = true;
    await user.save();

    res.json({ message: "You are now registered as a mentor. New players can request you as their guide." });
  } catch (err: any) {
    req.log.error({ err }, "mentor register error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/mentor/unregister — leave the mentor pool
router.post("/unregister", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!(user as any).isMentor) {
      return res.status(400).json({ message: "You are not registered as a mentor." });
    }

    (user as any).isMentor = false;
    await user.save();

    res.json({ message: "You have left the mentor pool." });
  } catch (err: any) {
    req.log.error({ err }, "mentor unregister error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/mentor/request — mentee requests a mentor (level 1-15, no current mentor)
router.post("/request", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level > MENTEE_MAX_LEVEL) {
      return res.status(403).json({
        message: `Only players at level ${MENTEE_MAX_LEVEL} or below can request a mentor.`,
      });
    }

    if ((user as any).mentorId) {
      return res.status(400).json({ message: "You already have a mentor." });
    }

    // Find an available mentor (registered, has room for more mentees)
    const mentor = await User.findOne({
      isMentor: true,
      _id: { $ne: user._id },
      $expr: { $lt: [{ $size: { $ifNull: ["$menteeIds", []] } }, MAX_MENTEES] },
    }).sort({ level: -1 }).select("_id username menteeIds");

    if (!mentor) {
      return res.status(404).json({ message: "No available mentors at the moment. Check back later!" });
    }

    // Link the relationship
    (user as any).mentorId = mentor._id;
    if (!(mentor as any).menteeIds) (mentor as any).menteeIds = [];
    (mentor as any).menteeIds.push(user._id);

    await Promise.all([user.save(), mentor.save()]);

    // Notify mentor
    Notification.create({
      userId: mentor._id,
      type: "system",
      message: `${user.username} has chosen you as their mentor. Guide them well!`,
      read: false,
      createdAt: new Date(),
    }).catch(() => {});

    res.json({
      message: `${mentor.username} is now your mentor. You'll receive +10% XP until level 20.`,
      mentor: { id: mentor._id, username: mentor.username },
    });
  } catch (err: any) {
    req.log.error({ err }, "mentor request error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/mentor/end/:targetUserId — end the relationship (either party can call)
router.post("/end/:targetUserId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId   = String(req.userId);
    const targetId   = req.params.targetUserId;

    const [caller, target] = await Promise.all([
      User.findById(callerId),
      User.findById(targetId),
    ]);

    if (!caller || !target) return res.status(404).json({ message: "User not found" });

    const callerMentorId  = String((caller as any).mentorId ?? "");
    const callerMenteeIds: string[] = ((caller as any).menteeIds ?? []).map(String);
    const targetMentorId  = String((target as any).mentorId ?? "");
    const targetMenteeIds: string[] = ((target as any).menteeIds ?? []).map(String);

    // Determine who is mentor and who is mentee
    let mentorDoc: InstanceType<typeof User> | null = null;
    let menteeDoc: InstanceType<typeof User> | null = null;

    if (callerMentorId === targetId && targetMenteeIds.includes(callerId)) {
      // Caller is the mentee
      mentorDoc = target; menteeDoc = caller;
    } else if (callerMenteeIds.includes(targetId) && targetMentorId === callerId) {
      // Caller is the mentor
      mentorDoc = caller; menteeDoc = target;
    } else {
      return res.status(400).json({ message: "No active mentor relationship with that user." });
    }

    // Unlink
    (menteeDoc as any).mentorId = null;
    (mentorDoc as any).menteeIds = ((mentorDoc as any).menteeIds ?? []).filter(
      (id: any) => String(id) !== String(menteeDoc!._id),
    );

    await Promise.all([mentorDoc.save(), menteeDoc.save()]);

    // Notify the other party
    const notifyId = callerId === String(menteeDoc._id) ? mentorDoc._id : menteeDoc._id;
    const notifyMsg = callerId === String(menteeDoc._id)
      ? `${menteeDoc.username} has left your mentorship.`
      : `Your mentorship with ${menteeDoc.username} has ended.`;

    Notification.create({
      userId: notifyId,
      type: "system",
      message: notifyMsg,
      read: false,
      createdAt: new Date(),
    }).catch(() => {});

    res.json({ message: "Mentor relationship ended." });
  } catch (err: any) {
    req.log.error({ err }, "mentor end error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Auto-end mentor relationship when mentee reaches level 20
// Called internally from levelUp handler side-effects or a cron
export async function autoEndMentorOnGraduation(userId: string, newLevel: number): Promise<void> {
  if (newLevel < MENTEE_AUTO_END_LEVEL) return;
  try {
    const user = await User.findById(userId).select("mentorId username");
    if (!user || !(user as any).mentorId) return;

    const mentor = await User.findById((user as any).mentorId).select("menteeIds username");
    if (mentor) {
      (mentor as any).menteeIds = ((mentor as any).menteeIds ?? []).filter(
        (id: any) => String(id) !== userId,
      );
      await mentor.save();

      Notification.create({
        userId: mentor._id,
        type: "system",
        message: `${user.username} has reached level ${newLevel} and graduated from your mentorship!`,
        read: false,
        createdAt: new Date(),
      }).catch(() => {});
    }

    (user as any).mentorId = null;
    await user.save();
  } catch { /* silent */ }
}

export default router;
