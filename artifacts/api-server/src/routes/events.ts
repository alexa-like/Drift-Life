/**
 * events.ts — Player-facing event routes.
 *
 * Mounted at /api/events in routes/index.ts.
 */
import { Router } from "express";
import { requireAuth, requireOwner, AuthRequest } from "../middlewares/auth";
import Event from "../models/Event";
import EventProgress from "../models/EventProgress";
import User from "../models/User";
import FeedEvent from "../models/FeedEvent";
import Notification from "../models/Notification";
import CosmeticItem from "../models/CosmeticItem";
import ServerConfig from "../models/ServerConfig";
import { getActiveEvent, invalidateActiveEventCache, endEvent, activateEvent, distributeEventRewards, getActiveFlashEvent, invalidateFlashCache } from "../lib/eventEngine";

const router = Router();

// ── GET /api/events/active ─────────────────────────────────────────────────────
// Returns the active event with player's progress and boss current HP.

router.get("/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await getActiveEvent();
    if (!event) return res.json(null);

    const progress = await EventProgress.findOne({
      eventId: event._id,
      userId: req.userId,
    }).lean();

    res.json({
      event: {
        id: event._id,
        name: event.name,
        slug: event.slug,
        type: event.type,
        description: event.description,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        theme: event.theme,
        pointSources: event.pointSources,
        boss: event.boss
          ? {
              name: event.boss.name,
              imageUrl: event.boss.imageUrl,
              totalHp: event.boss.totalHp,
              currentHp: event.boss.currentHp,
              phases: event.boss.phases,
              strikeEnergyCost: event.boss.strikeEnergyCost,
              strikeCooldownSeconds: event.boss.strikeCooldownSeconds,
            }
          : null,
        collectible: event.collectible ?? null,
        milestones: event.milestones ?? [],
        leaderboardRewards: event.leaderboardRewards,
        oneTimeRewards: event.oneTimeRewards,
      },
      playerProgress: progress
        ? {
            points: progress.points,
            bossDamageDealt: progress.bossDamageDealt,
            collectiblesFound: progress.collectiblesFound,
            ticketsEarned: progress.ticketsEarned,
            oneTimeRewardsClaimed: progress.oneTimeRewardsClaimed,
            lastStrikeAt: progress.lastStrikeAt,
          }
        : null,
    });
  } catch (err: any) {
    req.log.error({ err }, "get active event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/events/upcoming ───────────────────────────────────────────────────

router.get("/upcoming", requireAuth, async (req: AuthRequest, res) => {
  try {
    const events = await Event.find({ status: "scheduled" })
      .sort({ startsAt: 1 })
      .select("name slug type description startsAt endsAt theme leaderboardRewards")
      .lean();
    res.json(events);
  } catch (err: any) {
    req.log.error({ err }, "get upcoming events error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/events/archive ───────────────────────────────────────────────────

router.get("/archive", requireAuth, async (req: AuthRequest, res) => {
  try {
    const events = await Event.find({ status: { $in: ["ended", "archived"] } })
      .sort({ endsAt: -1 })
      .select("name slug type description startsAt endsAt theme archive.totalParticipants archive.bossKilled archive.totalDamageDealt")
      .limit(50)
      .lean();
    res.json(events);
  } catch (err: any) {
    req.log.error({ err }, "get event archive error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/events/archive/:slug ─────────────────────────────────────────────

router.get("/archive/:slug", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { slug } = req.params;
    const event = await Event.findOne({ slug, status: { $in: ["ended", "archived"] } }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err: any) {
    req.log.error({ err }, "get archived event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/events/leaderboard ───────────────────────────────────────────────

router.get("/leaderboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await getActiveEvent();
    if (!event) return res.json({ event: null, top: [], myRank: null });

    const [top, myEntry] = await Promise.all([
      EventProgress.find({ eventId: event._id })
        .sort({ points: -1 })
        .limit(100)
        .select("username points bossDamageDealt collectiblesFound teamId")
        .lean(),
      EventProgress.findOne({ eventId: event._id, userId: req.userId }).lean(),
    ]);

    let myRank: number | null = null;
    if (myEntry) {
      myRank = await EventProgress.countDocuments({
        eventId: event._id,
        points: { $gt: myEntry.points },
      }) + 1;
    }

    res.json({
      eventId: event._id,
      eventName: event.name,
      top: top.map((e, i) => ({
        rank: i + 1,
        username: e.username,
        points: e.points,
        bossDamageDealt: e.bossDamageDealt,
        collectiblesFound: e.collectiblesFound,
        teamId: e.teamId,
      })),
      myRank,
      myPoints: myEntry?.points ?? 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "event leaderboard error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/events/strike-boss ──────────────────────────────────────────────

router.post("/strike-boss", requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await getActiveEvent();
    if (!event || event.type !== "boss_raid" || !event.boss) {
      return res.status(400).json({ message: "No active boss raid event" });
    }
    if (event.boss.currentHp <= 0) {
      return res.status(400).json({ message: "The boss has already been defeated" });
    }

    // Check cooldown
    const progress = await EventProgress.findOne({ eventId: event._id, userId: req.userId });
    if (progress?.lastStrikeAt) {
      const cooldownMs = (event.boss.strikeCooldownSeconds ?? 30) * 1000;
      const elapsed = Date.now() - progress.lastStrikeAt.getTime();
      if (elapsed < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - elapsed) / 1000);
        return res.status(429).json({ message: `Cooldown — wait ${waitSec}s`, waitSeconds: waitSec });
      }
    }

    // Check and deduct energy
    const user = await User.findById(req.userId).select("username energy maxEnergy energyRegenAt").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const energyCost = event.boss.strikeEnergyCost ?? 5;
    const now = new Date();
    const ENERGY_TICK_MS = 600_000;
    const regenTicks = Math.floor((now.getTime() - new Date((user as any).energyRegenAt ?? now).getTime()) / ENERGY_TICK_MS);
    const effectiveEnergy = Math.min((user as any).maxEnergy ?? 100, (user as any).energy + regenTicks);

    if (effectiveEnergy < energyCost) {
      return res.status(400).json({ message: `Not enough energy — need ${energyCost}, have ${effectiveEnergy}` });
    }

    // Deduct energy
    await User.findByIdAndUpdate(req.userId, {
      $inc: { energy: -energyCost },
      energyRegenAt: now,
    });

    // Calculate damage
    const { min: dMin, max: dMax } = event.boss.strikeBaseDamage;
    let damage = Math.floor(Math.random() * (dMax - dMin + 1)) + dMin;

    // Flash event multiplier
    const flash = await getActiveFlashEvent();
    const hasFlash3x = flash?.effect === "3x_boss_damage";
    if (hasFlash3x) damage = damage * 3;

    // Apply damage atomically — don't go below 0
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: event._id, "boss.currentHp": { $gt: 0 } },
      { $inc: { "boss.currentHp": -damage } },
      { new: true }
    );

    const newHp = updatedEvent ? Math.max(0, updatedEvent.boss!.currentHp) : 0;

    // Check for phase transition
    let phaseChange: string | null = null;
    if (updatedEvent?.boss) {
      const totalHp = updatedEvent.boss.totalHp;
      const prevHpPct = ((newHp + damage) / totalHp) * 100;
      const newHpPct = (newHp / totalHp) * 100;
      for (const phase of updatedEvent.boss.phases ?? []) {
        if (prevHpPct > phase.triggerAtHpPercent && newHpPct <= phase.triggerAtHpPercent) {
          phaseChange = phase.name;
          break;
        }
      }
    }

    // Update player progress
    const username = (user as any).username;
    const pointsForStrike = (event.pointSources.find(p => p.action === "boss_strike")?.points ?? 1) * (hasFlash3x ? 2 : 1);
    await EventProgress.findOneAndUpdate(
      { eventId: event._id, userId: req.userId },
      {
        $inc: { bossDamageDealt: damage, points: pointsForStrike },
        $set: { username, lastStrikeAt: now, lastActionAt: now },
        $setOnInsert: { eventId: event._id, userId: req.userId },
      },
      { upsert: true }
    );

    // Boss retaliation damage (HP loss for the player)
    let retaliationHpLoss = 0;
    if (event.boss.bossRetaliationDamage?.max > 0) {
      const { min: rMin, max: rMax } = event.boss.bossRetaliationDamage;
      retaliationHpLoss = Math.floor(Math.random() * (rMax - rMin + 1)) + rMin;
      if (retaliationHpLoss > 0) {
        await User.findByIdAndUpdate(req.userId, { $inc: { health: -retaliationHpLoss } });
      }
    }

    // Broadcast boss HP update via WebSocket
    const io = req.app.locals["io"];
    if (io) {
      io.emit("boss_hp_update", {
        eventId: String(event._id),
        currentHp: newHp,
        totalHp: event.boss.totalHp,
        bossKilled: newHp <= 0,
        phaseChange,
      });
    }

    // Handle boss death
    if (newHp <= 0 && updatedEvent) {
      await endEvent(updatedEvent as any, io);
    }

    invalidateActiveEventCache();

    res.json({
      damage,
      bossHpRemaining: newHp,
      bossKilled: newHp <= 0,
      phaseChange,
      retaliationHpLoss,
      pointsEarned: pointsForStrike,
      flashMultiplier: hasFlash3x ? "3x" : null,
    });
  } catch (err: any) {
    req.log.error({ err }, "boss strike error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/events/collect ──────────────────────────────────────────────────

router.post("/collect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await getActiveEvent();
    if (!event || event.type !== "collection_hunt" || !event.collectible) {
      return res.status(400).json({ message: "No active collection hunt event" });
    }

    const user = await User.findById(req.userId).select("username").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const dropChance = event.collectible.dropChance ?? 0.1;
    const found = Math.random() < dropChance;

    if (!found) return res.json({ found: false, message: "Nothing found this time." });

    const username = (user as any).username;
    let pointsForCollect = event.pointSources.find(p => p.action === "collection_find")?.points ?? 5;
    const collectFlash = await getActiveFlashEvent();
    if (collectFlash?.effect === "2x_event_points") pointsForCollect *= 2;

    await EventProgress.findOneAndUpdate(
      { eventId: event._id, userId: req.userId },
      {
        $inc: { collectiblesFound: 1, points: pointsForCollect },
        $set: { username, lastActionAt: new Date() },
        $setOnInsert: { eventId: event._id, userId: req.userId },
      },
      { upsert: true }
    );

    const myProgress = await EventProgress.findOne({ eventId: event._id, userId: req.userId }).lean();
    const setComplete = myProgress && myProgress.collectiblesFound >= event.collectible.setSize;

    res.json({
      found: true,
      itemName: event.collectible.name,
      totalFound: myProgress?.collectiblesFound ?? 1,
      setSize: event.collectible.setSize,
      setComplete,
      pointsEarned: pointsForCollect,
    });
  } catch (err: any) {
    req.log.error({ err }, "event collect error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/events/flash ─────────────────────────────────────────────────────

router.get("/flash", requireAuth, async (req: AuthRequest, res) => {
  try {
    const flash = await getActiveFlashEvent();
    res.json(flash ?? null);
  } catch (err: any) {
    req.log.error({ err }, "get flash event error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
