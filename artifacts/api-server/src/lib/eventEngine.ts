/**
 * eventEngine — shared logic for event lifecycle, rewards, and flash events.
 *
 * Used by: scheduler (index.ts), events.ts routes, and owner.ts routes.
 */
import mongoose from "mongoose";
import Event, { IEvent } from "../models/Event";
import EventProgress from "../models/EventProgress";
import User from "../models/User";
import CosmeticItem from "../models/CosmeticItem";
import FeedEvent from "../models/FeedEvent";
import Notification from "../models/Notification";
import ServerConfig from "../models/ServerConfig";
import { logger } from "./logger";
import { sendPushToUser } from "./sendPushToUser";
import { isWebPushConfigured, sendPushNotification, type PushPayload } from "./webPush";
import PushSubscription from "../models/PushSubscription";
import { broadcastTelegramToLinkedUsers } from "./telegram";

/**
 * Fan-out a push notification to every player who has an active push subscription.
 * Fire-and-forget — failures per subscription are silently swallowed.
 */
async function broadcastPushToAll(payload: PushPayload): Promise<void> {
  if (!isWebPushConfigured()) return;
  try {
    const subs = await PushSubscription.find({}).lean();
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await sendPushNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        } catch (err: any) {
          if (err.expired) {
            PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          }
        }
      }),
    );
  } catch (err) {
    logger.warn({ err }, "broadcastPushToAll failed");
  }
}

// ── Flash event cache (30-second TTL) ────────────────────────────────────────

interface FlashEvent {
  label: string;
  effect: string;
  expiresAt: Date;
}

let _flashCache: FlashEvent | null = null;
let _flashCacheAt = 0;
const FLASH_CACHE_TTL = 30_000;

export async function getActiveFlashEvent(): Promise<FlashEvent | null> {
  const now = Date.now();
  if (_flashCache !== null && now - _flashCacheAt < FLASH_CACHE_TTL) {
    if (_flashCache.expiresAt > new Date()) return _flashCache;
    return null;
  }
  try {
    const doc = await ServerConfig.findOne({ key: "flashEvent" }).lean();
    if (!doc?.value) { _flashCache = null; _flashCacheAt = now; return null; }
    const f = doc.value as FlashEvent;
    _flashCache = f;
    _flashCacheAt = now;
    if (new Date(f.expiresAt) > new Date()) return f;
  } catch {
    // DB unavailable — return null
  }
  return null;
}

export function invalidateFlashCache() {
  _flashCache = null;
  _flashCacheAt = 0;
}

// ── Active event cache (15-second TTL) ───────────────────────────────────────

let _activeEventCache: IEvent | null = null;
let _activeEventCacheAt = 0;
const ACTIVE_EVENT_CACHE_TTL = 15_000;

export async function getActiveEvent(): Promise<IEvent | null> {
  const now = Date.now();
  if (_activeEventCacheAt && now - _activeEventCacheAt < ACTIVE_EVENT_CACHE_TTL) {
    return _activeEventCache;
  }
  const event = await Event.findOne({ status: "active" }).lean() as IEvent | null;
  _activeEventCache = event;
  _activeEventCacheAt = now;
  return event;
}

export function invalidateActiveEventCache() {
  _activeEventCache = null;
  _activeEventCacheAt = 0;
}

// ── Reward distribution (called at event end) ────────────────────────────────

export async function distributeEventRewards(eventId: string): Promise<void> {
  const event = await Event.findById(eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  // Get all participants sorted by points for ranking
  const participants = await EventProgress.find({ eventId }).sort({ points: -1 });
  if (participants.length === 0) return;

  const totalParticipants = participants.length;

  for (let i = 0; i < participants.length; i++) {
    const rank = i + 1;
    const participant = participants[i];

    // Find the matching leaderboard reward bracket
    const bracket = event.leaderboardRewards.find(
      b => rank >= b.rankFrom && rank <= b.rankTo
    );

    if (!bracket) continue;

    const { reward } = bracket;
    const updates: Record<string, unknown> = {};
    const notifParts: string[] = [];

    if (reward.dc > 0) {
      updates["$inc"] = { ...(updates["$inc"] as object ?? {}), dc: reward.dc };
      notifParts.push(`${reward.dc.toLocaleString()} DC`);
    }
    if (reward.nc > 0) {
      updates["$inc"] = { ...(updates["$inc"] as object ?? {}), nc: reward.nc };
      notifParts.push(`${reward.nc.toLocaleString()} NC`);
    }

    // Apply all updates atomically
    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(participant.userId, updates);
    }

    // Track event rank 1 for achievements (checked next time player acts)
    if (rank === 1) {
      User.findByIdAndUpdate(participant.userId, { $inc: { eventRank1Count: 1 } }).catch(() => {});
    }

    // Grant cosmetics (via ownedCosmetics + cosmeticInventory)
    if (reward.cosmetics && reward.cosmetics.length > 0) {
      for (const c of reward.cosmetics) {
        const expiresAt = c.durationDays > 0
          ? new Date(Date.now() + c.durationDays * 86_400_000)
          : null;
        await User.findByIdAndUpdate(participant.userId, {
          $addToSet: { ownedCosmetics: c.id },
          $push: {
            cosmeticInventory: {
              cosmeticId: c.id,
              acquiredAt: new Date(),
              expiresAt,
              source: "event_reward",
            },
          },
        });
        const cosItem = await CosmeticItem.findOne({ id: c.id }).lean();
        if (cosItem) notifParts.push(`cosmetic: ${cosItem.name}`);
      }
    }

    // Grant titles
    if (reward.titles && reward.titles.length > 0) {
      await User.findByIdAndUpdate(participant.userId, {
        $addToSet: { titles: { $each: reward.titles } },
      });
      notifParts.push(...reward.titles.map(t => `title: ${t}`));
    }

    // Send notification
    if (notifParts.length > 0) {
      await Notification.create({
        userId: participant.userId,
        type: "achievement",
        message: `The ${event.name} event has ended. You ranked #${rank} and earned: ${notifParts.join(", ")}.`,
        read: false,
      });
      // Push notification for event reward
      sendPushToUser(participant.userId, {
        title: `🏆 Event Rewards — #${rank}`,
        body: `${event.name} ended. You earned: ${notifParts.join(", ")}.`,
        link: "/events",
        tag: "achievements",
      }, "achievements").catch(() => {});
    }
  }

  // Handle boss kill bonus (boss_raid): grant extra rewards to ALL who dealt damage
  if (event.type === "boss_raid" && event.boss && event.boss.currentHp <= 0) {
    const damageDealt = participants.filter(p => p.bossDamageDealt > 0);
    for (const p of damageDealt) {
      await Notification.create({
        userId: p.userId,
        type: "achievement",
        message: `The ${event.boss.name} has been defeated! As a participant, you share in the victory.`,
        read: false,
      });
    }
  }

  // Handle lottery: weighted random draw from ticketsEarned
  if (event.type === "lottery" && event.lottery && event.lottery.winnersCount > 0) {
    const pool = participants.filter(p => (p.ticketsEarned ?? 0) > 0);
    if (pool.length > 0) {
      const totalTickets = pool.reduce((sum, p) => sum + (p.ticketsEarned ?? 0), 0);
      const winnerBracket = event.leaderboardRewards.find(b => b.rankFrom === 1 && b.rankTo === 1);
      const drawn = new Set<number>();

      for (let w = 0; w < Math.min(event.lottery.winnersCount, pool.length); w++) {
        let roll = Math.random() * totalTickets;
        for (let i = 0; i < pool.length; i++) {
          if (drawn.has(i)) continue;
          roll -= pool[i].ticketsEarned ?? 0;
          if (roll <= 0) {
            drawn.add(i);
            const winner = pool[i];
            if (winnerBracket) {
              const { reward } = winnerBracket;
              const inc: Record<string, number> = {};
              if (reward.dc > 0) inc.dc = reward.dc;
              if (reward.nc > 0) inc.nc = reward.nc;
              if (Object.keys(inc).length) await User.findByIdAndUpdate(winner.userId, { $inc: inc });
            }
            await Notification.create({
              userId: winner.userId,
              type: "achievement",
              message: `🎰 You won the ${event.name} lottery! You earned ${winner.ticketsEarned} ticket${winner.ticketsEarned === 1 ? "" : "s"} and beat the odds.`,
              read: false,
            });
            await FeedEvent.create({
              type: "system", actor: "System", actorId: null,
              message: `[LOTTERY] ${winner.username} wins the ${event.name} lottery! 🎰`,
              dc: 0, xp: 0, actorLevel: 0,
            });
            break;
          }
        }
      }
    }
  }

  // Handle sports: announce winning team + bonus notification
  if (event.type === "sports" && event.teams?.length) {
    const teamScoreDoc = await ServerConfig.findOne({ key: "eventTeamScores" }).lean();
    if (teamScoreDoc?.value) {
      const scores = teamScoreDoc.value as Record<string, number>;
      let winningTeamId = "";
      let highScore = -1;
      for (const [teamId, score] of Object.entries(scores)) {
        if ((score as number) > highScore) { highScore = score as number; winningTeamId = teamId; }
      }
      if (winningTeamId) {
        const winningTeam = event.teams.find(t => t.id === winningTeamId);
        const teamWinners = participants.filter(p => p.teamId === winningTeamId);
        for (const winner of teamWinners) {
          await Notification.create({
            userId: winner.userId,
            type: "achievement",
            message: `Your team (${winningTeam?.name ?? winningTeamId}) won the ${event.name} sports event! Team victory bonus applied. 🏆`,
            read: false,
          });
        }
        await FeedEvent.create({
          type: "system", actor: "System", actorId: null,
          message: `[EVENT] Team ${winningTeam?.name ?? winningTeamId} wins the ${event.name} sports event! 🏆`,
          dc: 0, xp: 0, actorLevel: 0,
        });
      }
    }
  }

  // Freeze archive
  const finalLeaderboard = participants.slice(0, 100).map((p, i) => ({
    rank: i + 1,
    userId: String(p.userId),
    username: p.username,
    points: p.points,
  }));

  const totalDamage = participants.reduce((sum, p) => sum + p.bossDamageDealt, 0);

  await Event.findByIdAndUpdate(eventId, {
    "archive.finalLeaderboard":  finalLeaderboard,
    "archive.totalParticipants": totalParticipants,
    "archive.totalDamageDealt":  totalDamage,
    "archive.bossKilled":        !!(event.boss && event.boss.currentHp <= 0),
    "archive.bossKilledAt":      event.boss && event.boss.currentHp <= 0 ? new Date() : undefined,
  });

  logger.info({ eventId, totalParticipants }, "Event rewards distributed");
}

// ── Activate event ────────────────────────────────────────────────────────────

export async function activateEvent(event: IEvent, io?: unknown): Promise<void> {
  await Event.findByIdAndUpdate(event._id, { status: "active" });
  invalidateActiveEventCache();

  // Store active event theme in ServerConfig
  await ServerConfig.findOneAndUpdate(
    { key: "activeEventTheme" },
    {
      key: "activeEventTheme",
      value: {
        eventId:         String(event._id),
        eventName:       event.name,
        eventType:       event.type,
        endsAt:          event.endsAt,
        ...event.theme,
      },
      updatedAt: new Date(),
    },
    { upsert: true }
  );

  // Post feed event
  await FeedEvent.create({
    type: "system",
    actor: "System",
    actorId: null,
    message: `[EVENT] ${event.name} has begun! Type: ${event.type.replace(/_/g, " ")}.`,
    dc: 0, xp: 0,
    actorLevel: 0,
  });

  // Broadcast to all connected clients
  if (io) {
    (io as any).emit("event_activated", {
      eventName: event.name,
      type: event.type,
      theme: event.theme,
      endsAt: event.endsAt,
    });
  }

  // Push notification to all subscribed players
  broadcastPushToAll({
    title: `⚡ Event Started: ${event.name}`,
    body: `A new event is live in New Vanta. Jump in now!`,
    link: "/events",
    tag: "general",
  }).catch(() => {});

  // Telegram notification to all linked players
  broadcastTelegramToLinkedUsers(
    `⚡ <b>Event Started: ${event.name}</b>\n\nA new event is live in New Vanta! Jump in now at /events`,
  ).catch(() => {});

  logger.info({ eventId: event._id, name: event.name }, "Event activated");
}

// ── End event ─────────────────────────────────────────────────────────────────

export async function endEvent(event: IEvent, io?: unknown): Promise<void> {
  await Event.findByIdAndUpdate(event._id, { status: "ended" });
  invalidateActiveEventCache();

  // Remove active event theme from ServerConfig
  await ServerConfig.findOneAndUpdate(
    { key: "activeEventTheme" },
    { key: "activeEventTheme", value: null, updatedAt: new Date() },
    { upsert: true }
  );

  // Post feed event
  await FeedEvent.create({
    type: "system",
    actor: "System",
    actorId: null,
    message: `[EVENT] ${event.name} has ended. Rewards are being distributed.`,
    dc: 0, xp: 0,
    actorLevel: 0,
  });

  // Broadcast
  if (io) {
    (io as any).emit("event_ended", { eventName: event.name });
  }

  // Push notification to all subscribed players
  broadcastPushToAll({
    title: `🏁 Event Ended: ${event.name}`,
    body: `The event is over. Check your rewards!`,
    link: "/events",
    tag: "general",
  }).catch(() => {});

  // Telegram notification to all linked players
  broadcastTelegramToLinkedUsers(
    `🏁 <b>Event Ended: ${event.name}</b>\n\nThe event is over — check your rewards in Neonoir!`,
  ).catch(() => {});

  // Distribute rewards in background (don't block the response)
  distributeEventRewards(String(event._id)).catch(err => {
    logger.error({ err, eventId: event._id }, "Event reward distribution error");
  });

  logger.info({ eventId: event._id, name: event.name }, "Event ended");
}

// ── Scheduler tick (called every 60 seconds from index.ts) ───────────────────

export async function tickEventScheduler(io?: unknown): Promise<void> {
  const now = new Date();

  // Auto-activate scheduled events
  const toActivate = await Event.find({ status: "scheduled", startsAt: { $lte: now } });
  for (const event of toActivate) {
    await activateEvent(event, io).catch(err =>
      logger.error({ err, eventId: event._id }, "Failed to auto-activate event")
    );
  }

  // Auto-end active events
  const toEnd = await Event.find({ status: "active", endsAt: { $lte: now } });
  for (const event of toEnd) {
    await endEvent(event, io).catch(err =>
      logger.error({ err, eventId: event._id }, "Failed to auto-end event")
    );
  }

  // Clean up expired flash events
  const flashDoc = await ServerConfig.findOne({ key: "flashEvent" }).lean();
  if (flashDoc?.value) {
    const flash = flashDoc.value as { expiresAt: string | Date };
    if (new Date(flash.expiresAt) <= now) {
      await ServerConfig.findOneAndUpdate(
        { key: "flashEvent" },
        { value: null, updatedAt: new Date() }
      );
      invalidateFlashCache();
      logger.info("Flash event expired and cleaned up");
    }
  }

  // Milestone checking: distribute rewards when thresholds are crossed
  const milestoneEvent = await Event.findOne({ status: "active", type: "milestone" }).lean() as IEvent | null;
  if (milestoneEvent?.milestones?.length) {
    const progressDoc = await ServerConfig.findOne({ key: "eventMilestoneProgress" }).lean();
    const currentTotal: number = (progressDoc?.value as any)?.total ?? 0;

    const reachedDoc = await ServerConfig.findOne({ key: "eventMilestonesReached" }).lean();
    const reachedSet = new Set<number>(((reachedDoc?.value as any)?.reached ?? []) as number[]);

    let anyNewlyReached = false;
    for (let idx = 0; idx < milestoneEvent.milestones.length; idx++) {
      const milestone = milestoneEvent.milestones[idx];
      if (currentTotal >= milestone.target && !reachedSet.has(idx)) {
        reachedSet.add(idx);
        anyNewlyReached = true;

        const allParticipants = await EventProgress.find({ eventId: milestoneEvent._id });
        for (const p of allParticipants) {
          const inc: Record<string, number> = {};
          if (milestone.rewardAll.dc > 0) inc["dc"] = milestone.rewardAll.dc;
          if (milestone.rewardAll.nc > 0) inc["nc"] = milestone.rewardAll.nc;
          if (Object.keys(inc).length > 0) await User.findByIdAndUpdate(p.userId, { $inc: inc });
          if (milestone.rewardAll.title) {
            await User.findByIdAndUpdate(p.userId, { $addToSet: { titles: milestone.rewardAll.title } });
          }
          await Notification.create({
            userId: p.userId,
            type: "achievement",
            message: `[MILESTONE] "${milestone.label}" reached! You earn: ${[
              milestone.rewardAll.dc  > 0 ? `${milestone.rewardAll.dc} DC`  : "",
              milestone.rewardAll.nc  > 0 ? `${milestone.rewardAll.nc} NC`  : "",
              milestone.rewardAll.title ? `title: ${milestone.rewardAll.title}` : "",
            ].filter(Boolean).join(", ")}.`,
            read: false,
          });
        }

        await FeedEvent.create({
          type: "system", actor: "System", actorId: null,
          message: `[MILESTONE] "${milestone.label}" achieved! All ${allParticipants.length} participants are rewarded!`,
          dc: 0, xp: 0, actorLevel: 0,
        });
        logger.info({ milestoneLabel: milestone.label, eventId: milestoneEvent._id }, "Milestone reached");
      }
    }

    if (anyNewlyReached) {
      await ServerConfig.findOneAndUpdate(
        { key: "eventMilestonesReached" },
        { key: "eventMilestonesReached", value: { reached: Array.from(reachedSet) }, updatedAt: now },
        { upsert: true }
      );
    }
  }
}

// ── Boss ability effects (called from /strike-boss on phase transition) ──────

export async function applyBossAbilityEffect(effect: string, io?: unknown): Promise<void> {
  const now = new Date();

  if (effect === "all_damage_2x_10min") {
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    await ServerConfig.findOneAndUpdate(
      { key: "flashEvent" },
      { key: "flashEvent", value: { label: "Boss Enraged — 2× Damage!", effect: "all_damage_2x_10min", expiresAt }, updatedAt: now },
      { upsert: true }
    );
    invalidateFlashCache();
    if (io) (io as any).emit("flash_event", { label: "Boss Enraged — 2× Damage!", effect: "all_damage_2x_10min", expiresAt });
    await FeedEvent.create({ type: "system", actor: "System", actorId: null, message: "[BOSS] The boss is enraged — all damage doubled for 10 minutes! ⚡", dc: 0, xp: 0, actorLevel: 0 });

  } else if (effect === "freeze_strikes_5min") {
    const freezeUntil = new Date(now.getTime() + 5 * 60_000);
    await ServerConfig.findOneAndUpdate(
      { key: "bossFreezeStrikesUntil" },
      { key: "bossFreezeStrikesUntil", value: freezeUntil.toISOString(), updatedAt: now },
      { upsert: true }
    );
    if (io) (io as any).emit("boss_ability", { effect: "freeze_strikes_5min", freezeUntil });
    await FeedEvent.create({ type: "system", actor: "System", actorId: null, message: "[BOSS] The boss freezes all strikes — no hitting back for 5 minutes! ❄️", dc: 0, xp: 0, actorLevel: 0 });

  } else if (effect === "energy_drain") {
    await User.updateMany({}, [{ $set: { energy: { $max: [0, { $floor: { $multiply: ["$energy", 0.8] } }] } } }]);
    if (io) (io as any).emit("boss_ability", { effect: "energy_drain" });
    await FeedEvent.create({ type: "system", actor: "System", actorId: null, message: "[BOSS] The boss drains the energy of every fighter in the city! −20% energy. 🔋", dc: 0, xp: 0, actorLevel: 0 });
  }
}

// ── Award event points from any game action ───────────────────────────────────
// Called by crimes.ts, arena.ts, and race.ts after their action completes.
// Handles: passive boss HP damage, milestone counter, team scoring, lottery tickets,
// and leaderboard feed posts. Fire-and-forget (never throws).

export async function awardEventPoints(opts: {
  userId: string;
  username: string;
  action: string;
  io?: unknown;
}): Promise<void> {
  const { userId, username, action, io } = opts;

  try {
    const event = await getActiveEvent();
    if (!event) return;

    const pointSource = event.pointSources.find(p => p.action === action);
    if (!pointSource || pointSource.points <= 0) return;

    const points = pointSource.points;
    const now = new Date();

    // Snapshot previous progress for feed-post comparisons
    const prevProgress = await EventProgress.findOne({ eventId: event._id, userId }).lean();
    const prevPoints = prevProgress?.points ?? 0;

    // Build EventProgress update
    const inc: Record<string, number> = { points };
    const set: Record<string, unknown> = { username, lastActionAt: now };

    // ── Boss raid: passive damage ──────────────────────────────────────────────
    if (event.type === "boss_raid" && event.boss && event.boss.currentHp > 0) {
      inc.bossDamageDealt = points;
      const updated = await Event.findOneAndUpdate(
        { _id: event._id, "boss.currentHp": { $gt: 0 } },
        { $inc: { "boss.currentHp": -points } },
        { new: true }
      );
      invalidateActiveEventCache();
      const newHp = Math.max(0, updated?.boss?.currentHp ?? 0);
      if (io) {
        (io as any).emit("boss_hp_update", {
          eventId: String(event._id),
          currentHp: newHp,
          totalHp: event.boss.totalHp,
          bossKilled: newHp <= 0,
          phaseChange: null,
        });
      }
    }

    // ── Lottery: award tickets ──────────────────────────────────────────────────
    if (event.type === "lottery" && event.lottery) {
      inc.ticketsEarned = event.lottery.ticketsPerAction ?? 1;
    }

    // ── Sports: assign team on first action, update team scores ────────────────
    if (event.type === "sports" && event.teams?.length) {
      let teamId = prevProgress?.teamId;
      if (!teamId) {
        const teamCounts = await Promise.all(
          event.teams.map(t => EventProgress.countDocuments({ eventId: event._id, teamId: t.id }))
        );
        const minIdx = teamCounts.indexOf(Math.min(...teamCounts));
        teamId = event.teams[minIdx].id;
        set.teamId = teamId;
      }
      await ServerConfig.findOneAndUpdate(
        { key: "eventTeamScores" },
        { $inc: { [`value.${teamId}`]: points }, updatedAt: now },
        { upsert: true }
      );
    }

    // ── Milestone counter ───────────────────────────────────────────────────────
    if (event.type === "milestone" && event.milestones?.length) {
      const matches = event.milestones.filter(m => m.action === action || m.action === "any");
      if (matches.length > 0) {
        await ServerConfig.findOneAndUpdate(
          { key: "eventMilestoneProgress" },
          { $inc: { "value.total": points }, updatedAt: now },
          { upsert: true }
        );
      }
    }

    // Persist progress
    await EventProgress.findOneAndUpdate(
      { eventId: event._id, userId },
      { $inc: inc, $set: set, $setOnInsert: { eventId: event._id, userId } },
      { upsert: true }
    );

    // ── Leaderboard grind: feed posts for top-10 entry and rank-1 change ───────
    if (event.type === "leaderboard_grind") {
      const newPoints = prevPoints + points;
      if (prevPoints === 0) {
        const aboveCount = await EventProgress.countDocuments({ eventId: event._id, points: { $gt: newPoints } });
        if (aboveCount < 10) {
          FeedEvent.create({ type: "system", actor: "System", actorId: null, message: `[EVENT] ${username} has entered the Top 10 in ${event.name}! 🏆`, dc: 0, xp: 0, actorLevel: 0 }).catch(() => {});
        }
      }
      // Check if they just took the lead
      const leader = await EventProgress.findOne({ eventId: event._id, userId: { $ne: userId } }).sort({ points: -1 }).lean();
      if (leader && newPoints > leader.points) {
        FeedEvent.create({ type: "system", actor: "System", actorId: null, message: `[EVENT] ${username} has taken the lead in ${event.name}! Can anyone stop them? 🔥`, dc: 0, xp: 0, actorLevel: 0 }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err, userId, action }, "awardEventPoints error (non-fatal)");
  }
}
