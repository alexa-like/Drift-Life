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
}
