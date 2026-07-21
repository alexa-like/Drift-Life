import { Router } from "express";
import mongoose from "mongoose";
import GangWar from "../models/GangWar";
import Guild from "../models/Guild";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { notifyUser } from "../lib/notifyUser";
import { postToSystemFeed } from "../lib/systemFeed";
import { resolveExpiredWar } from "../lib/warScoring";

const router = Router();

// ── GET /api/gang-wars — active + recent wars for user's guild ───────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guildId = user.guildId;
    const [challengerGuild, defenderGuild] = await Promise.all([
      Guild.findById(guildId).select("name tag"),
    ]).then(([g]) => [g, null]);

    const wars = await GangWar.find({
      $or: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
      status: { $ne: "declined" },
    }).sort({ createdAt: -1 }).limit(20);

    // Enrich with guild names
    const guildIds = new Set<string>();
    wars.forEach(w => {
      guildIds.add(w.challengerGuildId.toString());
      guildIds.add(w.defenderGuildId.toString());
    });
    const guilds = await Guild.find({ _id: { $in: [...guildIds] } }).select("name tag").lean();
    const guildMap = Object.fromEntries(guilds.map(g => [g._id.toString(), { name: g.name, tag: g.tag }]));

    res.json(wars.map(w => ({
      id: w._id,
      attackerGuildId: w.challengerGuildId,
      defenderGuildId: w.defenderGuildId,
      attackerGuildName: guildMap[w.challengerGuildId.toString()]?.name ?? "Unknown",
      defenderGuildName: guildMap[w.defenderGuildId.toString()]?.name ?? "Unknown",
      attackerPoints: w.challengerPoints,
      defenderPoints: w.defenderPoints,
      status: w.status,
      startedAt: w.startedAt,
      endsAt: w.endsAt,
      winnerId: w.winnerId,
      loserTreasuryTransfer: w.loserTreasuryTransfer,
      isAttacker: w.challengerGuildId.equals(guildId),
      contributions: w.contributions,
    })));
  } catch (err) {
    logger.error({ err }, "gang-wars GET /");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/gang-wars/active — active war status for my guild ───────────────
router.get("/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.json({ active: false, war: null });

    const guildId = user.guildId;
    const war = await GangWar.findOne({
      $or: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
      status: "active",
    });
    if (!war) return res.json({ active: false, war: null, myGuildId: guildId });

    // Check if war has expired
    if (war.endsAt && Date.now() >= war.endsAt.getTime()) {
      await resolveExpiredWar(war);
      return res.json({ active: false, war: null, myGuildId: guildId });
    }

    const guildIds = [war.challengerGuildId.toString(), war.defenderGuildId.toString()];
    const guilds = await Guild.find({ _id: { $in: guildIds } }).select("name tag").lean();
    const guildMap = Object.fromEntries(guilds.map(g => [g._id.toString(), { name: g.name, tag: g.tag }]));

    res.json({
      active: true,
      myGuildId: guildId,
      war: {
        id: war._id,
        attackerGuildId: war.challengerGuildId,
        defenderGuildId: war.defenderGuildId,
        attackerGuildName: guildMap[war.challengerGuildId.toString()]?.name ?? "Unknown",
        defenderGuildName: guildMap[war.defenderGuildId.toString()]?.name ?? "Unknown",
        attackerPoints: war.challengerPoints,
        defenderPoints: war.defenderPoints,
        status: war.status,
        endsAt: war.endsAt,
        winnerId: war.winnerId,
        isAttacker: war.challengerGuildId.equals(guildId),
        contributions: war.contributions,
      },
    });
  } catch (err) {
    logger.error({ err }, "gang-wars GET /active");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/gang-wars/history — completed wars for my guild ─────────────────
router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("guildId");
    if (!user || !user.guildId) return res.status(400).json({ message: "Not in a guild" });

    const guildId = user.guildId;
    const wars = await GangWar.find({
      $or: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
      status: "completed",
    }).sort({ updatedAt: -1 }).limit(20);

    const guildIds = new Set<string>();
    wars.forEach(w => {
      guildIds.add(w.challengerGuildId.toString());
      guildIds.add(w.defenderGuildId.toString());
    });
    const guilds = await Guild.find({ _id: { $in: [...guildIds] } }).select("name tag").lean();
    const guildMap = Object.fromEntries(guilds.map(g => [g._id.toString(), { name: g.name, tag: g.tag }]));

    res.json(wars.map(w => ({
      id: w._id,
      attackerGuildId: w.challengerGuildId,
      defenderGuildId: w.defenderGuildId,
      attackerGuildName: guildMap[w.challengerGuildId.toString()]?.name ?? "Unknown",
      defenderGuildName: guildMap[w.defenderGuildId.toString()]?.name ?? "Unknown",
      attackerPoints: w.challengerPoints,
      defenderPoints: w.defenderPoints,
      winnerId: w.winnerId,
      loserTreasuryTransfer: w.loserTreasuryTransfer,
      isAttacker: w.challengerGuildId.equals(guildId),
      weWon: w.winnerId ? w.winnerId.equals(guildId) : false,
      endedAt: w.updatedAt,
    })));
  } catch (err) {
    logger.error({ err }, "gang-wars GET /history");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/gang-wars/declare — declare war on another guild ───────────────
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

    const myMemberCount = 1 + myGuild.officers.length + myGuild.members.length + myGuild.recruits.length;
    if (myMemberCount < 3) return res.status(400).json({ message: "Your guild must have at least 3 members to declare war" });

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
    await Promise.allSettled(
      targetMemberIds.map(uid =>
        notifyUser({
          userId: uid,
          type: "faction",
          message: `[${myGuild.tag}] ${myGuild.name} has declared war on your gang! Your leader has 24h to accept or decline.`,
          link: "/guilds",
          push: { title: `⚔️ War Declared — [${myGuild.tag}]`, body: `${myGuild.name} declared war on your gang!` },
        })
      )
    );

    postToSystemFeed(
      "gang_war",
      `[⚔️ WAR DECLARED] [${myGuild.tag}] ${myGuild.name} has challenged [${targetGuild.tag}] ${targetGuild.name}! The city watches.`
    ).catch(() => {});

    res.status(201).json({ message: "War declared — awaiting their response", war });
  } catch (err) {
    logger.error({ err }, "gang-wars POST /declare");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/gang-wars/:id/accept — defender leader accepts ─────────────────
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
      Guild.findById(war.challengerGuildId).select("name tag leaderId officers members recruits"),
      Guild.findById(war.defenderGuildId).select("name tag leaderId officers members recruits"),
    ]);

    const startMsg = `[⚔️ WAR ACTIVE] [${challengerGuild?.tag}] ${challengerGuild?.name} vs [${defenderGuild?.tag}] ${defenderGuild?.name}! 48 hours on the clock. Winner takes ${war.loserTreasuryTransfer.toLocaleString()} DC.`;
    postToSystemFeed("gang_war", startMsg).catch(() => {});

    const allMemberIds: mongoose.Types.ObjectId[] = [];
    for (const guild of [challengerGuild, defenderGuild]) {
      if (!guild) continue;
      allMemberIds.push(guild.leaderId, ...guild.officers, ...guild.members, ...guild.recruits);
    }
    await Promise.allSettled(
      allMemberIds.map(uid =>
        notifyUser({
          userId: uid,
          type: "faction",
          message: startMsg,
          link: "/guilds",
          push: { title: "⚔️ War is Active!", body: `${challengerGuild?.name} vs ${defenderGuild?.name}` },
        })
      )
    );

    res.json({ message: "War accepted — battle begins!", war });
  } catch (err) {
    logger.error({ err }, "gang-wars POST /:id/accept");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/gang-wars/:id/decline — defender leader declines ───────────────
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

// ── POST /api/gang-wars/:id/add-points — internal endpoint (arena/crimes) ────
// Called internally with x-internal header; awards points and tracks contributions.
router.post("/:id/add-points", async (req, res) => {
  try {
    if (req.headers["x-internal"] !== "neonoir-internal") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { winnerUserId, points = 200 } = req.body as { winnerUserId: string; points?: number };

    const war = await GangWar.findById(req.params.id);
    if (!war) return res.status(404).json({ message: "War not found" });
    if (war.status !== "active") return res.status(400).json({ message: "War is not active" });

    const winner = await User.findById(winnerUserId).select("guildId username").lean();
    if (!winner?.guildId) return res.status(400).json({ message: "User not in a guild" });

    const isChallenger = (war.challengerGuildId as mongoose.Types.ObjectId).equals(winner.guildId as mongoose.Types.ObjectId);
    if (isChallenger) {
      war.challengerPoints += points;
    } else if ((war.defenderGuildId as mongoose.Types.ObjectId).equals(winner.guildId as mongoose.Types.ObjectId)) {
      war.defenderPoints += points;
    } else {
      return res.status(400).json({ message: "User is not in either warring guild" });
    }

    // Track individual contribution
    const contrib = war.contributions.find(c =>
      (c.userId as mongoose.Types.ObjectId).equals(winnerUserId)
    );
    if (contrib) {
      contrib.points += points;
    } else {
      war.contributions.push({
        userId: new mongoose.Types.ObjectId(winnerUserId),
        username: winner.username,
        guildId: winner.guildId as mongoose.Types.ObjectId,
        points,
      });
    }
    war.markModified("contributions");

    if (war.endsAt && Date.now() >= war.endsAt.getTime()) {
      await resolveExpiredWar(war);
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
