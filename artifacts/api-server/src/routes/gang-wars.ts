import { Router, Request } from "express";
import mongoose from "mongoose";
import GangWar, { IGangWar } from "../models/GangWar";
import Guild from "../models/Guild";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { sendPushToUser } from "../lib/sendPushToUser";

const router = Router();

// ── War resolution helper ─────────────────────────────────────────────────────
async function resolveWar(war: IGangWar): Promise<void> {
  const isDraw = war.challengerPoints === war.defenderPoints;

  if (!isDraw) {
    const challengerWon = war.challengerPoints > war.defenderPoints;
    const winnerId = challengerWon ? war.challengerGuildId : war.defenderGuildId;
    const loserId = challengerWon ? war.defenderGuildId : war.challengerGuildId;

    const transfer = war.loserTreasuryTransfer;
    if (transfer > 0) {
      await Guild.findOneAndUpdate(
        { _id: loserId, treasury: { $gte: transfer } },
        { $inc: { treasury: -transfer } }
      );
      await Guild.findByIdAndUpdate(winnerId, { $inc: { treasury: transfer } });
    }

    war.winnerId = winnerId;
  }

  war.status = "completed";
  war.settled = true;
  await war.save();

  // Notify all members of both guilds
  const [challengerGuild, defenderGuild] = await Promise.all([
    Guild.findById(war.challengerGuildId).select("name leaderId officers members recruits"),
    Guild.findById(war.defenderGuildId).select("name leaderId officers members recruits"),
  ]);

  const resultMessage = isDraw
    ? `Gang war between ${challengerGuild?.name} and ${defenderGuild?.name} ended in a DRAW! No treasury transfer.`
    : war.winnerId?.equals(war.challengerGuildId)
    ? `Gang war result: ${challengerGuild?.name} defeated ${defenderGuild?.name}! Winner takes ${war.loserTreasuryTransfer.toLocaleString()} DC.`
    : `Gang war result: ${defenderGuild?.name} defeated ${challengerGuild?.name}! Winner takes ${war.loserTreasuryTransfer.toLocaleString()} DC.`;

  const allMemberIds: mongoose.Types.ObjectId[] = [];
  for (const guild of [challengerGuild, defenderGuild]) {
    if (!guild) continue;
    allMemberIds.push(guild.leaderId, ...guild.officers, ...guild.members, ...guild.recruits);
  }

  await Promise.all(
    allMemberIds.map((uid) =>
      Notification.create({ userId: uid, type: "gang_war", message: resultMessage })
    )
  );
}

// GET /api/gang-wars — active + recent wars involving user's guild
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guildId = user.guildId;
    const wars = await GangWar.find({
      $or: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(wars);
  } catch (err) {
    logger.error({ err }, "gang-wars GET /");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/gang-wars/active — check if my guild is in an active war
router.get("/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.json({ active: false, war: null });

    const guildId = user.guildId;
    const war = await GangWar.findOne({
      $or: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
      status: "active",
    });

    res.json({ active: !!war, war, myGuildId: guildId });
  } catch (err) {
    logger.error({ err }, "gang-wars GET /active");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-wars/declare — declare war on another guild
router.post("/declare", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetGuildId } = req.body as { targetGuildId: string };

    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader") return res.status(403).json({ message: "Only the guild leader can declare war" });

    const [myGuild, targetGuild] = await Promise.all([
      Guild.findById(user.guildId),
      Guild.findById(targetGuildId),
    ]);
    if (!myGuild) return res.status(404).json({ message: "Your guild not found" });
    if (!targetGuild) return res.status(404).json({ message: "Target guild not found" });
    if (myGuild._id.equals(targetGuild._id)) return res.status(400).json({ message: "Cannot declare war on your own guild" });

    const targetMemberCount = 1 + targetGuild.officers.length + targetGuild.members.length + targetGuild.recruits.length;
    if (targetMemberCount < 3) return res.status(400).json({ message: "Target guild must have at least 3 members" });

    const existingWar = await GangWar.findOne({
      $or: [
        { challengerGuildId: myGuild._id, defenderGuildId: targetGuild._id },
        { challengerGuildId: targetGuild._id, defenderGuildId: myGuild._id },
      ],
      status: { $in: ["pending", "active"] },
    });
    if (existingWar) return res.status(400).json({ message: "An active war already exists between these guilds" });

    const loserTreasuryTransfer = Math.min(Math.floor(targetGuild.treasury * 0.20), 500_000);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const war = await GangWar.create({
      challengerGuildId: myGuild._id,
      defenderGuildId: targetGuild._id,
      status: "pending",
      challengerPoints: 0,
      defenderPoints: 0,
      startedAt: null,
      endsAt: null,
      expiresAt,
      winnerId: null,
      loserTreasuryTransfer,
      settled: false,
    });

    // Notify all target guild members
    const targetMemberIds = [targetGuild.leaderId, ...targetGuild.officers, ...targetGuild.members, ...targetGuild.recruits];
    await Promise.all(
      targetMemberIds.map((uid) =>
        Notification.create({
          userId: uid,
          type: "gang_war",
          message: `[${myGuild.tag}] ${myGuild.name} has declared war on your gang! Your leader has 24h to accept or decline.`,
        })
      )
    );
    // Push notification to each target guild member
    for (const uid of targetMemberIds) {
      sendPushToUser(uid, {
        title: `⚔️ War Declared — [${myGuild.tag}]`,
        body: `${myGuild.name} has declared war on your gang! Your leader has 24h to accept or decline.`,
        link: "/guilds",
        tag: "faction",
      }, "faction").catch(() => {});
    }

    res.status(201).json(war);
  } catch (err) {
    logger.error({ err }, "gang-wars POST /declare");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-wars/:id/accept — defender leader accepts the war
router.post("/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader") return res.status(403).json({ message: "Only the guild leader can accept war" });

    const war = await GangWar.findById(req.params.id);
    if (!war) return res.status(404).json({ message: "War not found" });
    if (!war.defenderGuildId.equals(user.guildId)) return res.status(403).json({ message: "You are not the defender" });
    if (war.status !== "pending") return res.status(400).json({ message: "War is no longer pending" });
    if (war.expiresAt < new Date()) return res.status(400).json({ message: "War declaration has expired" });

    const now = new Date();
    war.status = "active";
    war.startedAt = now;
    war.endsAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    await war.save();

    const [challengerGuild, defenderGuild] = await Promise.all([
      Guild.findById(war.challengerGuildId).select("name leaderId officers members recruits"),
      Guild.findById(war.defenderGuildId).select("name leaderId officers members recruits"),
    ]);

    const allMemberIds: mongoose.Types.ObjectId[] = [];
    for (const guild of [challengerGuild, defenderGuild]) {
      if (!guild) continue;
      allMemberIds.push(guild.leaderId, ...guild.officers, ...guild.members, ...guild.recruits);
    }

    await Promise.all(
      allMemberIds.map((uid) =>
        Notification.create({
          userId: uid,
          type: "gang_war",
          message: `Gang war is now ACTIVE! [${challengerGuild?.tag}] ${challengerGuild?.name} vs [${defenderGuild?.tag}] ${defenderGuild?.name}. 48 hours on the clock.`,
        })
      )
    );

    res.json(war);
  } catch (err) {
    logger.error({ err }, "gang-wars POST /:id/accept");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-wars/:id/decline — defender leader declines
router.post("/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId guildRole");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });
    if (user.guildRole !== "leader") return res.status(403).json({ message: "Only the guild leader can decline war" });

    const war = await GangWar.findById(req.params.id);
    if (!war) return res.status(404).json({ message: "War not found" });
    if (!war.defenderGuildId.equals(user.guildId)) return res.status(403).json({ message: "You are not the defender" });
    if (war.status !== "pending") return res.status(400).json({ message: "War is no longer pending" });

    war.status = "declined";
    await war.save();

    res.json({ message: "War declaration declined", war });
  } catch (err) {
    logger.error({ err }, "gang-wars POST /:id/decline");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/gang-wars/:id/add-points — internal endpoint called from arena
router.post("/:id/add-points", async (req: Request, res) => {
  try {
    if (req.headers["x-internal"] !== "neonoir-internal")
      return res.status(403).json({ message: "Forbidden" });

    const { winnerUserId, loserUserId } = req.body as { winnerUserId: string; loserUserId: string };

    const war = await GangWar.findById(req.params.id);
    if (!war) return res.status(404).json({ message: "War not found" });
    if (war.status !== "active") return res.status(400).json({ message: "War is not active" });

    const [winner, loser] = await Promise.all([
      User.findById(winnerUserId).select("guildId"),
      User.findById(loserUserId).select("guildId"),
    ]);

    if (winner?.guildId?.equals(war.challengerGuildId)) {
      war.challengerPoints += 1;
    } else if (winner?.guildId?.equals(war.defenderGuildId)) {
      war.defenderPoints += 1;
    }

    // Check if war should end
    if (war.endsAt && Date.now() >= war.endsAt.getTime()) {
      await resolveWar(war);
    } else {
      await war.save();
    }

    res.json({ war });
  } catch (err) {
    logger.error({ err }, "gang-wars POST /:id/add-points");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
