import { Router } from "express";
import mongoose from "mongoose";
import GangCrime, { GangCrimeType, GANG_CRIME_DEFS } from "../models/GangCrime";
import Guild from "../models/Guild";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/gang-crimes — active + last 10 completed crimes for user's guild
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const active = await GangCrime.find({
      guildId: user.guildId,
      status: { $in: ["gathering", "in_progress"] },
    });

    const recent = await GangCrime.find({
      guildId: user.guildId,
      status: { $in: ["completed", "failed"] },
    })
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({ active, recent });
  } catch (err) {
    logger.error({ err }, "gang-crimes GET /");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-crimes/start — start a gang crime
router.post("/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { crimeType } = req.body as { crimeType: GangCrimeType };

    const def = GANG_CRIME_DEFS[crimeType];
    if (!def) return res.status(400).json({ message: "Invalid crime type" });

    const user = await User.findById(req.userId).select("guildId guildRole jailUntil jailedUntil hospitalizedUntil energy");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const role = user.guildRole;
    if (role !== "leader" && role !== "officer")
      return res.status(403).json({ message: "Only leaders and officers can start gang crimes" });

    const now = new Date();
    const jailUntil = user.jailUntil ?? (user as any).jailedUntil;
    if (jailUntil && new Date(jailUntil) > now)
      return res.status(400).json({ message: "You are in jail" });
    if (user.hospitalizedUntil && new Date(user.hospitalizedUntil) > now)
      return res.status(400).json({ message: "You are hospitalized" });

    const guild = await Guild.findById(user.guildId).select("level");
    if (!guild) return res.status(404).json({ message: "Guild not found" });

    if (guild.level < def.minGuildLevel)
      return res.status(400).json({ message: `Guild must be level ${def.minGuildLevel} for this crime` });

    const existing = await GangCrime.findOne({
      guildId: user.guildId,
      status: { $in: ["gathering", "in_progress"] },
    });
    if (existing) return res.status(400).json({ message: "Your guild already has an active crime operation" });

    const crime = await GangCrime.create({
      guildId: user.guildId,
      crimeType,
      status: "gathering",
      initiatorId: user._id,
      participants: [{ userId: user._id, committed: false, energyCost: def.energyCost, dcShare: 0, xpShare: 0 }],
      minMembers: def.minMembers,
      maxMembers: def.maxMembers,
      durationMs: def.durationMs,
      startedAt: null,
      completedAt: null,
      totalPayout: 0,
      failureReason: null,
    });

    res.status(201).json(crime);
  } catch (err) {
    logger.error({ err }, "gang-crimes POST /start");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-crimes/:id/join — join a gathering crime
router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const crime = await GangCrime.findById(req.params.id);
    if (!crime) return res.status(404).json({ message: "Crime not found" });
    if (!crime.guildId.equals(user.guildId)) return res.status(403).json({ message: "Not your guild's crime" });
    if (crime.status !== "gathering") return res.status(400).json({ message: "Crime is not in gathering phase" });
    if (crime.participants.length >= crime.maxMembers) return res.status(400).json({ message: "Crime is full" });

    const alreadyIn = crime.participants.some((p) => p.userId.toString() === user._id.toString());
    if (alreadyIn) return res.status(400).json({ message: "Already in this crime" });

    const def = GANG_CRIME_DEFS[crime.crimeType];
    crime.participants.push({ userId: user._id, committed: false, energyCost: def.energyCost, dcShare: 0, xpShare: 0 });
    await crime.save();

    res.json(crime);
  } catch (err) {
    logger.error({ err }, "gang-crimes POST /:id/join");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-crimes/:id/commit — commit energy to the crime
router.post("/:id/commit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const crime = await GangCrime.findById(req.params.id);
    if (!crime) return res.status(404).json({ message: "Crime not found" });
    if (crime.status !== "gathering") return res.status(400).json({ message: "Crime is not in gathering phase" });

    const userId = req.userId as string;
    const participant = crime.participants.find((p) => p.userId.toString() === userId);
    if (!participant) return res.status(403).json({ message: "You are not a participant in this crime" });
    if (participant.committed) return res.status(400).json({ message: "Already committed" });

    const energyCost = participant.energyCost;

    // Atomically deduct energy
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, energy: { $gte: energyCost } },
      { $inc: { energy: -energyCost } },
      { returnDocument: 'after' }
    );
    if (!updatedUser) return res.status(400).json({ message: "Not enough energy" });

    participant.committed = true;

    const allCommitted = crime.participants.every((p) => p.committed);
    const enoughMembers = crime.participants.length >= crime.minMembers;

    if (allCommitted && enoughMembers) {
      const def = GANG_CRIME_DEFS[crime.crimeType];
      const now = new Date();
      crime.status = "in_progress";
      crime.startedAt = now;
      crime.totalPayout = Math.floor(def.dcMin + Math.random() * (def.dcMax - def.dcMin));
      crime.completedAt = new Date(now.getTime() + crime.durationMs);
    }

    await crime.save();
    res.json(crime);
  } catch (err) {
    logger.error({ err }, "gang-crimes POST /:id/commit");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-crimes/:id/resolve — resolve a completed crime
router.post("/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId as mongoose.Types.ObjectId;
    const crime = await GangCrime.findById(req.params.id);
    if (!crime) return res.status(404).json({ message: "Crime not found" });
    if (crime.status !== "in_progress") return res.status(400).json({ message: "Crime is not in progress" });
    if (!crime.completedAt || Date.now() < crime.completedAt.getTime())
      return res.status(400).json({ message: "Crime timer has not elapsed yet" });

    const isParticipant = crime.participants.some((p) => p.userId.equals(userId));
    if (!isParticipant) return res.status(403).json({ message: "You are not a participant in this crime" });

    const def = GANG_CRIME_DEFS[crime.crimeType];
    const failed = Math.random() < 0.30;

    if (failed) {
      crime.status = "failed";
      crime.failureReason = "Operation blown. Heat brought the law down on your crew.";

      const JAIL_DURATION_MS = 5 * 60 * 1000;
      const notifications: Promise<any>[] = [];

      for (const p of crime.participants) {
        const jailed = Math.random() < def.jailRisk;
        if (jailed) {
          const jailUntil = new Date(Date.now() + JAIL_DURATION_MS);
          await User.findByIdAndUpdate(p.userId, { jailUntil, status: "jailed" });
        }
        notifications.push(
          Notification.create({
            userId: p.userId,
            type: "gang_crime",
            message: `Gang crime failed! ${crime.failureReason}${jailed ? " You were arrested." : ""}`,
          })
        );
      }

      await crime.save();
      await Promise.all(notifications);
    } else {
      const committedParticipants = crime.participants.filter((p) => p.committed);
      const dcShare = Math.floor(crime.totalPayout / committedParticipants.length);
      const xpShare = Math.floor(def.xpBase / committedParticipants.length);

      for (const p of crime.participants) {
        if (p.committed) {
          p.dcShare = dcShare;
          p.xpShare = xpShare;
          await User.findByIdAndUpdate(p.userId, { $inc: { dc: dcShare, xp: xpShare } });
        }
      }

      crime.status = "completed";

      await crime.save();

      await Promise.all(
        crime.participants.map((p) =>
          Notification.create({
            userId: p.userId,
            type: "gang_crime",
            message: p.committed
              ? `Gang crime succeeded! You earned ${dcShare.toLocaleString()} DC and ${xpShare} XP.`
              : `Gang crime succeeded but you hadn't committed energy — no payout this time.`,
          })
        )
      );
    }

    res.json(crime);
  } catch (err) {
    logger.error({ err }, "gang-crimes POST /:id/resolve");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/gang-crimes/:id/cancel — cancel a gathering crime
router.delete("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId as mongoose.Types.ObjectId;
    const user = await User.findById(userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const crime = await GangCrime.findById(req.params.id);
    if (!crime) return res.status(404).json({ message: "Crime not found" });
    if (!crime.guildId.equals(user.guildId)) return res.status(403).json({ message: "Not your guild's crime" });
    if (crime.status !== "gathering") return res.status(400).json({ message: "Can only cancel a gathering crime" });

    const isInitiator = crime.initiatorId.equals(userId);
    const isLeader = user.guildRole === "leader";
    if (!isInitiator && !isLeader)
      return res.status(403).json({ message: "Only the initiator or guild leader can cancel" });

    await GangCrime.findByIdAndDelete(crime._id);
    res.json({ message: "Crime operation cancelled" });
  } catch (err) {
    logger.error({ err }, "gang-crimes DELETE /:id/cancel");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
