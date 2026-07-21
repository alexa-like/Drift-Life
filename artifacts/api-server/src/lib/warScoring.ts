/**
 * War scoring helpers — called from arena and crimes routes to award
 * gang-war points without coupling those routes to the gang-wars router.
 */
import mongoose from "mongoose";
import GangWar from "../models/GangWar";
import Guild from "../models/Guild";
import User from "../models/User";
import { logger } from "./logger";

/**
 * Called after a successful arena win. Awards 200 war points to the
 * winner's guild if they are in an active war against the loser's guild,
 * and also awards event points for war tie-in if an event is active.
 */
export async function awardArenaWarPoints(
  winnerUserId: string,
  loserUserId: string,
  io?: unknown,
): Promise<void> {
  try {
    const [winner, loser] = await Promise.all([
      User.findById(winnerUserId).select("guildId username").lean(),
      User.findById(loserUserId).select("guildId").lean(),
    ]);
    if (!winner?.guildId || !loser?.guildId) return;
    if ((winner.guildId as mongoose.Types.ObjectId).equals(loser.guildId as mongoose.Types.ObjectId)) return;

    const war = await GangWar.findOne({
      status: "active",
      $or: [
        { challengerGuildId: winner.guildId, defenderGuildId: loser.guildId },
        { challengerGuildId: loser.guildId,  defenderGuildId: winner.guildId },
      ],
    });
    if (!war) return;

    const ARENA_WIN_POINTS = 200;
    const isChallenger = (war.challengerGuildId as mongoose.Types.ObjectId).equals(winner.guildId as mongoose.Types.ObjectId);

    if (isChallenger) {
      war.challengerPoints += ARENA_WIN_POINTS;
    } else {
      war.defenderPoints += ARENA_WIN_POINTS;
    }

    // Track per-member contribution
    const winnerGuildId = winner.guildId as mongoose.Types.ObjectId;
    const contrib = war.contributions.find(
      c => (c.userId as mongoose.Types.ObjectId).equals(winnerUserId)
    );
    if (contrib) {
      contrib.points += ARENA_WIN_POINTS;
    } else {
      war.contributions.push({
        userId: new mongoose.Types.ObjectId(winnerUserId),
        username: winner.username,
        guildId: winnerGuildId,
        points: ARENA_WIN_POINTS,
      });
    }
    war.markModified("contributions");

    // Check if war has expired
    if (war.endsAt && Date.now() >= war.endsAt.getTime()) {
      await resolveExpiredWar(war);
    } else {
      await war.save();
      // Real-time score broadcast
      if (io) {
        (io as any).to(`guild:${war.challengerGuildId}`).emit("war_score_update", {
          warId: war._id,
          challengerPoints: war.challengerPoints,
          defenderPoints: war.defenderPoints,
        });
        (io as any).to(`guild:${war.defenderGuildId}`).emit("war_score_update", {
          warId: war._id,
          challengerPoints: war.challengerPoints,
          defenderPoints: war.defenderPoints,
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "warScoring: awardArenaWarPoints failed");
  }
}

/**
 * Called after a successful crime. Awards 20 war points (any district) or
 * 50 war points (enemy-controlled territory) to the player's guild.
 */
export async function awardCrimeWarPoints(
  userId: string,
  username: string,
  district: string,
  io?: unknown,
): Promise<void> {
  try {
    const user = await User.findById(userId).select("guildId").lean();
    if (!user?.guildId) return;

    const war = await GangWar.findOne({
      status: "active",
      $or: [
        { challengerGuildId: user.guildId },
        { defenderGuildId: user.guildId },
      ],
    });
    if (!war) return;

    const isChallenger = (war.challengerGuildId as mongoose.Types.ObjectId).equals(user.guildId as mongoose.Types.ObjectId);
    const enemyGuildId = isChallenger ? war.defenderGuildId : war.challengerGuildId;

    // Check if crime is in enemy-controlled territory
    const enemyGuild = await Guild.findById(enemyGuildId).select("controlledDistricts").lean();
    const inEnemyTerritory = enemyGuild?.controlledDistricts?.includes(district) ?? false;
    const points = inEnemyTerritory ? 50 : 20;

    if (isChallenger) {
      war.challengerPoints += points;
    } else {
      war.defenderPoints += points;
    }

    // Track per-member contribution
    const guildId = user.guildId as mongoose.Types.ObjectId;
    const contrib = war.contributions.find(
      c => (c.userId as mongoose.Types.ObjectId).equals(userId)
    );
    if (contrib) {
      contrib.points += points;
    } else {
      war.contributions.push({
        userId: new mongoose.Types.ObjectId(userId),
        username,
        guildId,
        points,
      });
    }
    war.markModified("contributions");

    if (war.endsAt && Date.now() >= war.endsAt.getTime()) {
      await resolveExpiredWar(war);
    } else {
      await war.save();
      if (io) {
        (io as any).to(`guild:${war.challengerGuildId}`).emit("war_score_update", {
          warId: war._id,
          challengerPoints: war.challengerPoints,
          defenderPoints: war.defenderPoints,
        });
        (io as any).to(`guild:${war.defenderGuildId}`).emit("war_score_update", {
          warId: war._id,
          challengerPoints: war.challengerPoints,
          defenderPoints: war.defenderPoints,
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "warScoring: awardCrimeWarPoints failed");
  }
}

/**
 * Resolves an expired active war. Called from warScoring helpers when they
 * detect endsAt has passed, and also from the index.ts scheduler.
 */
export async function resolveExpiredWar(war: InstanceType<typeof GangWar>): Promise<void> {
  const { postToSystemFeed } = await import("./systemFeed");
  const { notifyUser } = await import("./notifyUser");

  const isDraw = war.challengerPoints === war.defenderPoints;
  const challengerWon = war.challengerPoints > war.defenderPoints;
  const winnerId = isDraw ? null : (challengerWon ? war.challengerGuildId : war.defenderGuildId);
  const loserId  = isDraw ? null : (challengerWon ? war.defenderGuildId  : war.challengerGuildId);

  if (!isDraw && winnerId && loserId) {
    const transfer = war.loserTreasuryTransfer;
    if (transfer > 0) {
      await Guild.findOneAndUpdate(
        { _id: loserId, treasury: { $gte: transfer } },
        { $inc: { treasury: -transfer } }
      );
      await Guild.findByIdAndUpdate(winnerId, { $inc: { treasury: transfer } });
    }

    // 24h territory crime bonus for winning guild (via activePerks)
    const bonusExpiry = new Date(Date.now() + 24 * 3_600_000);
    await Guild.findByIdAndUpdate(winnerId, {
      $push: { activePerks: { perkId: "war_crime_bonus", expiresAt: bonusExpiry } },
    });

    war.winnerId = winnerId;
  }

  war.status = "completed";
  war.settled = true;
  await war.save();

  // Feed post
  const [challengerGuild, defenderGuild] = await Promise.all([
    Guild.findById(war.challengerGuildId).select("name tag leaderId officers members recruits"),
    Guild.findById(war.defenderGuildId).select("name tag leaderId officers members recruits"),
  ]);

  const resultMsg = isDraw
    ? `[⚔️ WAR OVER] ${challengerGuild?.name} and ${defenderGuild?.name} fought to a DRAW. The streets remain divided.`
    : `[⚔️ WAR OVER] ${winnerId?.equals(war.challengerGuildId) ? challengerGuild?.name : defenderGuild?.name} defeated ${winnerId?.equals(war.challengerGuildId) ? defenderGuild?.name : challengerGuild?.name} in the war. Victory belongs to the streets.`;

  postToSystemFeed("gang_war", resultMsg).catch(() => {});

  // Notify all members
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
        message: resultMsg,
        link: "/guilds",
        push: { title: "⚔️ Gang War Over", body: resultMsg.slice(0, 120) },
      })
    )
  );
}
