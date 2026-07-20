/**
 * World — weather/time-of-day, seasons, world events, district modifiers.
 */
import { Router } from "express";
import User from "../models/User";
import { requireAuth, requireStaff, AuthRequest } from "../middlewares/auth";
import { getWorldState } from "../models/WorldState";
import ServerConfig from "../models/ServerConfig";

const router = Router();

// District modifiers table
const DISTRICT_MODIFIERS: Record<string, {
  crimePayoutMod: number; raceTypeBonus: string; itemPriceMod: number;
}> = {
  "neon_strip": { crimePayoutMod: 0.9,  raceTypeBonus: "drift",   itemPriceMod: 1.0 },
  "docks":      { crimePayoutMod: 1.2,  raceTypeBonus: "none",    itemPriceMod: 1.0 },
  "slums":      { crimePayoutMod: 1.0,  raceTypeBonus: "drag",    itemPriceMod: 0.9 },
  "corp_zone":  { crimePayoutMod: 1.1,  raceTypeBonus: "circuit", itemPriceMod: 1.3 },
  "industrial": { crimePayoutMod: 1.3,  raceTypeBonus: "drag",    itemPriceMod: 1.0 },
  "outskirts":  { crimePayoutMod: 1.5,  raceTypeBonus: "drag",    itemPriceMod: 0.8 },
};

// ── GET /api/world/online-count ──────────────────────────────────────────────
router.get("/online-count", (_req, res) => {
  const onlineUsers: Map<string, string> = (_req as any).app.locals["onlineUsers"] ?? new Map();
  res.json({ count: new Set(onlineUsers.values()).size });
});

// ── GET /api/world/state ─────────────────────────────────────────────────────
router.get("/state", requireAuth, async (req: AuthRequest, res) => {
  try {
    const world = await getWorldState();
    const now = new Date();
    const activeEvents = world.activeEvents.filter(e => e.endsAt > now);

    res.json({
      timeOfDay: world.timeOfDay,
      weather: world.weather,
      seasonId: world.seasonId,
      seasonName: world.seasonName,
      seasonStartsAt: world.seasonStartsAt,
      seasonEndsAt: world.seasonEndsAt,
      simPrice: world.simPrice,
      activeEvents,
      nightBonus: world.timeOfDay === "night" ? { runPayout: "+15%", heatGain: "+10%" } : null,
      rainPenalty: world.weather === "rain" ? { grip: "-10%" } : null,
    });
  } catch (err: any) {
    req.log.error({ err }, "world state error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/world/districts ─────────────────────────────────────────────────
router.get("/districts", requireAuth, (_req, res) => {
  res.json(DISTRICT_MODIFIERS);
});

// ── GET /api/world/announcement ──────────────────────────────────────────────
router.get("/announcement", requireAuth, async (_req, res) => {
  try {
    const cfg = await ServerConfig.findOne({ key: "announcement" }).lean();
    const val = (cfg?.value ?? {}) as { active?: boolean; message?: string; expiresAt?: string | null };
    const expired = val.expiresAt ? new Date(val.expiresAt) < new Date() : false;
    res.json({
      active: !!val.active && !expired,
      message: val.message ?? "",
      expiresAt: val.expiresAt ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ active: false, message: "", expiresAt: null });
  }
});

// ── GET /api/world/season/leaderboard ────────────────────────────────────────
router.get("/season/leaderboard", requireAuth, async (_req, res) => {
  try {
    const top = await User.find({ seasonPoints: { $gt: 0 } })
      .sort({ seasonPoints: -1 })
      .limit(50)
      .select("username level faction seasonPoints tag")
      .lean();

    const tiers = [
      { name: "Legend",      minPoints: 10_000 },
      { name: "Circuit",     minPoints: 3_000 },
      { name: "Underground", minPoints: 500 },
      { name: "Street",      minPoints: 0 },
    ];

    res.json(top.map((u, i) => ({
      rank: i + 1, username: u.username, level: u.level, faction: u.faction,
      seasonPoints: u.seasonPoints ?? 0, tag: u.tag,
      tier: tiers.find(t => (u.seasonPoints ?? 0) >= t.minPoints)?.name ?? "Street",
    })));
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/world/cycle — advance time-of-day/weather (staff only) ─────────
router.post("/cycle", requireStaff, async (req: AuthRequest, res) => {
  try {
    const world = await getWorldState();
    const hr = new Date().getHours();
    world.timeOfDay = (hr >= 6 && hr < 20) ? "day" : "night";
    world.weather = Math.random() < 0.25 ? "rain" : "clear";
    world.lastCycledAt = new Date();
    const oldPrice = world.simPrice;
    world.simPrice = Math.round(world.simPrice * (0.95 + Math.random() * 0.10));
    world.simPriceHistory.push({ price: world.simPrice, at: new Date() });
    if (world.simPriceHistory.length > 168) world.simPriceHistory.shift();
    world.simBuyVolume = 0;
    world.simSellVolume = 0;
    world.simVolumeResetAt = new Date();
    await world.save();
    res.json({ timeOfDay: world.timeOfDay, weather: world.weather, simPrice: world.simPrice, oldPrice });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/world/events — create world event (staff only) ─────────────────
router.post("/events", requireStaff, async (req: AuthRequest, res) => {
  try {
    const { name, type, durationHours, effectModifiers } = req.body as {
      name: string; type: string; durationHours: number; effectModifiers: Record<string, number>;
    };
    const world = await getWorldState();
    const ev = {
      id: `evt_${Date.now()}`, name, type: type as any,
      startsAt: new Date(), endsAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
      effectModifiers,
    };
    world.activeEvents.push(ev);
    world.activeEvents = world.activeEvents.filter(e => e.endsAt > new Date());
    await world.save();
    res.status(201).json({ message: `World event "${name}" started.`, event: ev });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
