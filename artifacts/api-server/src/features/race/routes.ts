/**
 * Race — Tier 5 mini-game racing queue + parallel solo race engine.
 * POST /api/race/queue/join   { mode: "2player"|"4player" }
 * POST /api/race/queue/leave
 * GET  /api/race/queue/status
 * GET  /api/race/match/:matchId
 * POST /api/race/match/:matchId/shift   { hit: boolean }
 * POST /api/race/match/:matchId/nitro
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import User from "../../models/User";
import RaceMatch from "./models/RaceMatch";
import PlayerGarage from "../garage/models/PlayerGarage";
import MiniGameLeaderboard from "../garage/models/MiniGameLeaderboard";
import Notification from "../../models/Notification";
import { requireAuth, AuthRequest } from "../../middlewares/auth";
import { fireMissionEvent } from "../../lib/missionEvents";
import { checkAchievements } from "../../routes/achievements";
import { announceLeaderboardMilestone } from "../../lib/leaderboardHighlights";
import { getActiveFlashEvent, awardEventPoints } from "../../lib/eventEngine";
import { awardBattlePassXp } from "../../lib/battlePassXp";
import { updateQuestProgress } from "../../lib/questProgress";

const router = Router();

// ── AI names (50+) ────────────────────────────────────────────────────────────
const AI_NAMES = [
  "DriftQueen","TurboNova","CyberSlick","NeonStreak","VoltRacer","PixelBurn","GridRunner","NightShift",
  "TarmacGhost","FuelCell","SpinCycle","TorqueKing","RampageX","GasThief","IronAxle","VelocityZ",
  "AsphaltAce","RoadDevil","Blacktop","BurnoutBob","ClutchKing","DragKween","EngineEater","FlashLap",
  "GearGrinder","HotTarmac","InjectaX","JunctionJ","KnockoutK","LapLord",
  // second batch — 30 more = 60 total
  "MaxOverrev","NitroNick","OvertakeO","PedalPusher","QuickShift","RedlineRex","SkidMark","ThrottleX",
  "UltraLap","VanishV","WheelSpin","XhaustFire","YellowFlag","ZeroTraction","ApexHunter","BrakeLate",
  "CurbCutter","DownforceD","EcoBoost","FullSend","GhostLine","HardLock","IronRim","JumpStart",
  "KerbKing","LaneSwitch","MidCorner","NoseDive","OilSlick","PitStop",
];

// ── Energy costs ──────────────────────────────────────────────────────────────
const NITRO_COST: Record<string, number> = { "2player": 1, "4player": 1 };

// ── In-memory queues ──────────────────────────────────────────────────────────
interface RaceQueueEntry {
  userId:    string;
  username:  string;
  level:     number;
  joinedAt:  Date;
  carSnap:   CarSnap;
  mode:      "2player" | "4player";
}

interface CarSnap {
  carId:      string;
  topSpeed:   number;
  accel:      number;
  handling:   number;
  nitro:      number;
  paint?:     string | null;
  underglow?: string | null;
}

const queue2p = new Map<string, RaceQueueEntry>();
const queue4p = new Map<string, RaceQueueEntry>();

// ── Default car snapshot ──────────────────────────────────────────────────────
const DEFAULT_CAR: CarSnap = { carId: "rustbucket_common", topSpeed: 40, accel: 30, handling: 30, nitro: 20 };

// Racing stats lookup (mirrors plan reference table)
const CAR_STATS: Record<string, CarSnap> = {
  rustbucket_common:       { carId: "rustbucket_common",       topSpeed: 40,  accel: 30,  handling: 30,  nitro: 20 },
  scooter_common:          { carId: "scooter_common",          topSpeed: 35,  accel: 45,  handling: 50,  nitro: 15 },
  city_bike_common:        { carId: "city_bike_common",        topSpeed: 38,  accel: 42,  handling: 48,  nitro: 18 },
  hatchback_uncommon:      { carId: "hatchback_uncommon",      topSpeed: 55,  accel: 45,  handling: 55,  nitro: 30 },
  muscle_car_uncommon:     { carId: "muscle_car_uncommon",     topSpeed: 65,  accel: 60,  handling: 40,  nitro: 40 },
  sport_bike_uncommon:     { carId: "sport_bike_uncommon",     topSpeed: 60,  accel: 55,  handling: 50,  nitro: 35 },
  sports_car_rare:         { carId: "sports_car_rare",         topSpeed: 75,  accel: 70,  handling: 65,  nitro: 50 },
  drift_coupe_rare:        { carId: "drift_coupe_rare",        topSpeed: 70,  accel: 65,  handling: 80,  nitro: 55 },
  racing_motorcycle_rare:  { carId: "racing_motorcycle_rare",  topSpeed: 72,  accel: 68,  handling: 72,  nitro: 52 },
  supercar_epic:           { carId: "supercar_epic",           topSpeed: 88,  accel: 82,  handling: 75,  nitro: 65 },
  hyperbike_epic:          { carId: "hyperbike_epic",          topSpeed: 92,  accel: 88,  handling: 70,  nitro: 60 },
  cyberjet_legendary:      { carId: "cyberjet_legendary",      topSpeed: 100, accel: 95,  handling: 90,  nitro: 85 },
  neon_beast_legendary:    { carId: "neon_beast_legendary",    topSpeed: 98,  accel: 92,  handling: 95,  nitro: 80 },
  hovercar_legendary:      { carId: "hovercar_legendary",      topSpeed: 95,  accel: 90,  handling: 100, nitro: 90 },
};

function getConditionMultiplier(condition: number): number {
  if (condition >= 75) return 1.0;
  if (condition >= 50) return 0.95;
  if (condition >= 25) return 0.88;
  if (condition >= 1)  return 0.80;
  return 0;
}

async function getPlayerCarSnap(userId: string): Promise<CarSnap> {
  const garage = await PlayerGarage.findOne({ userId }).lean();
  if (!garage || !garage.activeCar) return DEFAULT_CAR;
  const base = CAR_STATS[garage.activeCar] ?? DEFAULT_CAR;
  // Apply condition multiplier to topSpeed
  const ownedCar = garage.cars.find((c: any) => c.carId === garage.activeCar);
  const condition: number = (ownedCar as any)?.condition ?? 100;
  const mult = getConditionMultiplier(condition);
  const customization = (ownedCar as any)?.customization ?? null;
  return {
    ...base,
    topSpeed: Math.floor(base.topSpeed * mult),
    paint: customization?.paint ?? null,
    underglow: customization?.underglow ?? null,
  };
}

// ── POST /api/race/queue/join ─────────────────────────────────────────────────
router.post("/queue/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { mode = "2player" } = req.body as { mode?: "2player" | "4player" };
    if (!["2player","4player"].includes(mode)) {
      res.status(400).json({ message: "Invalid mode" }); return;
    }

    // Check already queued (before spending nitro)
    if (queue2p.has(req.userId!) || queue4p.has(req.userId!)) {
      res.status(400).json({ message: "Already in queue" }); return;
    }

    const cost = NITRO_COST[mode];

    // Check car condition — sidelined cars cannot race
    const garageCheck = await PlayerGarage.findOne({ userId: req.userId });
    const activeCarCheck = garageCheck?.cars.find((c: any) => c.carId === garageCheck?.activeCar);
    if (activeCarCheck && (activeCarCheck as any).condition === 0) {
      res.status(400).json({ message: "Your car is sidelined — service it before racing." });
      return;
    }

    // Atomic nitro deduction — prevents concurrent double-spend
    const user = await User.findOneAndUpdate(
      { _id: req.userId, nitro: { $gte: cost } },
      { $inc: { nitro: -cost } },
      { returnDocument: 'after', select: "username level nitro maxNitro" },
    );
    if (!user) {
      // Either user not found or insufficient nitro — check which
      const exists = await User.exists({ _id: req.userId });
      if (!exists) { res.status(404).json({ message: "User not found" }); return; }
      res.status(400).json({ message: `Not enough Nitro — need ${cost}` }); return;
    }

    const q = mode === "2player" ? queue2p : queue4p;

    const carSnap = await getPlayerCarSnap(req.userId!);
    const entry: RaceQueueEntry = {
      userId: req.userId!,
      username: user.username,
      level: user.level,
      joinedAt: new Date(),
      carSnap,
      mode,
    };
    q.set(req.userId!, entry);

    // Try to fill match immediately
    const matchId = await tryFillRace(mode);
    if (matchId) {
      res.json({ matchId, status: "matched" });
    } else {
      res.json({ status: "queued", queueSize: q.size, needed: mode === "2player" ? 2 : 4 });
    }
  } catch (err) {
    req.log.error({ err }, "race queue join error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/race/queue/leave ────────────────────────────────────────────────
router.post("/queue/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const inQ = queue2p.has(req.userId!) || queue4p.has(req.userId!);
    if (!inQ) { res.status(400).json({ message: "Not in queue" }); return; }
    const mode = queue2p.has(req.userId!) ? "2player" : "4player";
    (mode === "2player" ? queue2p : queue4p).delete(req.userId!);
    await User.updateOne({ _id: req.userId }, { $inc: { nitro: NITRO_COST[mode] } });
    res.json({ message: "Left queue — Nitro refunded" });
  } catch (err) {
    req.log.error({ err }, "race queue leave error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/race/queue/status ────────────────────────────────────────────────
router.get("/queue/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const in2p = queue2p.has(req.userId!);
    const in4p = queue4p.has(req.userId!);
    const activeMatch = await RaceMatch.findOne({
      "players.userId": req.userId,
      status: { $in: ["waiting","active"] },
    }).select("matchId status mode");
    res.json({
      inQueue: in2p || in4p,
      mode: in2p ? "2player" : in4p ? "4player" : null,
      queueSize: in2p ? queue2p.size : in4p ? queue4p.size : 0,
      activeMatch: activeMatch ? { matchId: activeMatch.matchId, status: activeMatch.status, mode: activeMatch.mode } : null,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── AI finish time generator ──────────────────────────────────────────────────
function generateAIFinishTime(carSnap: CarSnap, variance = 0.1): number {
  // Base: 30 seconds for a perfect car (100 stats), scaled down
  const perfFactor = (carSnap.topSpeed + carSnap.accel + carSnap.handling) / 300;
  const base = 50_000 - perfFactor * 25_000; // 25s–50s range
  const v = (Math.random() * 2 - 1) * variance * base;
  return Math.max(15_000, Math.round(base + v));
}

function generateAICarSnap(playerLevel: number): CarSnap {
  const tierCars = playerLevel >= 30 ? ["cyberjet_legendary","neon_beast_legendary","hovercar_legendary"] :
    playerLevel >= 20 ? ["supercar_epic","hyperbike_epic"] :
    playerLevel >= 10 ? ["sports_car_rare","drift_coupe_rare"] :
    playerLevel >= 5  ? ["hatchback_uncommon","muscle_car_uncommon"] :
    ["rustbucket_common","scooter_common"];
  const carId = tierCars[Math.floor(Math.random() * tierCars.length)];
  return CAR_STATS[carId] ?? DEFAULT_CAR;
}

async function tryFillRace(mode: "2player" | "4player"): Promise<string | null> {
  const needed = mode === "2player" ? 2 : 4;
  const q = mode === "2player" ? queue2p : queue4p;
  if (q.size < needed) return null;

  // Take the first `needed` entries
  const entries = [...q.values()].slice(0, needed);
  for (const e of entries) q.delete(e.userId);

  const players = entries.map(e => ({
    userId:      e.userId,
    isAI:        false,
    aiName:      null,
    placement:   null,
    finishTime:  null,
    distancePct: 0,
    nitroUsed:   0,
    crashCount:  0,
    lastShiftAt: null,
    shiftCount:  0,
    hitCount:    0,
    carSnapshot: e.carSnap,
  }));

  const match = await RaceMatch.create({
    matchId:   randomUUID(),
    mode,
    players,
    status:    "active",
    trackSeed: Math.floor(Math.random() * 1_000_000),
    energyCost: NITRO_COST[mode],
    startedAt:  new Date(),
    queueExpiry: new Date(Date.now() + 60_000),
    rewardsGranted: false,
  });

  return match.matchId;
}

// ── Match expiry / abandon worker (runs separately every 30s) ─────────────────
setInterval(async () => {
  const now = Date.now();

  // 1. Matches where NO human ever shifted after 60s → abandoned, refund energy.
  //    Atomically claim each match (active → abandoned) before doing any writes
  //    so concurrent worker runs / multi-instance deploys never double-refund.
  const abandonCandidates = await RaceMatch.find({
    status: "active",
    startedAt: { $lt: new Date(now - 60_000) },
  }).lean();

  for (const m of abandonCandidates) {
    const anyHumanShifted = m.players.some((p: any) => !p.isAI && (p.shiftCount ?? 0) > 0);
    if (!anyHumanShifted) {
      // Atomic claim: only proceed if we are the one that flips status to "abandoned"
      const claimed = await RaceMatch.findOneAndUpdate(
        { _id: m._id, status: "active" },
        { $set: { status: "abandoned" } },
      ).lean();
      if (!claimed) continue; // another instance already handled it

      for (const p of m.players) {
        if (!p.isAI && p.userId) {
          await User.updateOne({ _id: p.userId }, { $inc: { energy: m.energyCost } }).catch(() => {});
        }
      }
    }
  }

  // 2. Matches active > 10 minutes → force-complete with current standings, grant rewards.
  //    Atomic claim via rewardsGranted flag so rewards are issued exactly once.
  const tooLong = await RaceMatch.find({
    status: "active",
    rewardsGranted: { $ne: true },
    startedAt: { $lt: new Date(now - 10 * 60_000) },
  });

  for (const m of tooLong) {
    // Atomic claim: set rewardsGranted:true and status:complete in one op
    const claimed = await RaceMatch.findOneAndUpdate(
      { _id: m._id, status: "active", rewardsGranted: { $ne: true } },
      { $set: { status: "complete", finishedAt: new Date(), rewardsGranted: true } },
    );
    if (!claimed) continue; // another instance beat us

    // Assign placements by distancePct / finishTime on the claimed snapshot
    const sorted = [...claimed.players].sort((a: any, b: any) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return  1;
      return b.distancePct - a.distancePct;
    });
    sorted.forEach((p: any, i: number) => { p.placement = i + 1; });
    await grantRaceRewards(claimed).catch(() => {});
  }
}, 30_000);

// ── Queue worker ──────────────────────────────────────────────────────────────
// Groups all expired human players together into matches first, then AI-fills remaining seats.
setInterval(async () => {
  const now = Date.now();

  for (const mode of ["2player", "4player"] as const) {
    const q      = mode === "2player" ? queue2p : queue4p;
    const needed = mode === "2player" ? 2 : 4;

    // Collect all expired entries (waited ≥ 30s)
    const expired: RaceQueueEntry[] = [];
    for (const [userId, entry] of q.entries()) {
      if (now - entry.joinedAt.getTime() >= 30_000) {
        expired.push(entry);
        q.delete(userId);
      }
    }

    if (expired.length === 0) continue;

    // Batch expired humans into groups of `needed`, AI-fill the last partial group
    for (let i = 0; i < expired.length; i += needed) {
      const group = expired.slice(i, i + needed);
      const avgLevel = Math.round(group.reduce((s, e) => s + e.level, 0) / group.length);

      const humanPlayers = group.map(e => ({
        userId:      e.userId,
        isAI:        false,
        aiName:      null,
        placement:   null as number | null,
        finishTime:  null as number | null,
        distancePct: 0,
        nitroUsed:   0,
        crashCount:  0,
        lastShiftAt: null as number | null,
        shiftCount:  0,
        hitCount:    0,
        carSnapshot: e.carSnap,
      }));

      const aiCount   = needed - group.length;
      const aiPlayers = Array.from({ length: aiCount }, () => {
        const carSnap = generateAICarSnap(avgLevel);
        return {
          userId:      null,
          isAI:        true,
          aiName:      AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)],
          placement:   null as number | null,
          finishTime:  generateAIFinishTime(carSnap),
          distancePct: 0,
          nitroUsed:   0,
          crashCount:  0,
          lastShiftAt: null as number | null,
          shiftCount:  0,
          hitCount:    0,
          carSnapshot: carSnap,
        };
      });

      await RaceMatch.create({
        matchId:        randomUUID(),
        mode,
        players:        [...humanPlayers, ...aiPlayers],
        status:         "active",
        trackSeed:      Math.floor(Math.random() * 1_000_000),
        energyCost:     NITRO_COST[mode],
        startedAt:      new Date(),
        queueExpiry:    new Date(Date.now() + 60_000),
        rewardsGranted: false,
      }).catch(() => {});
    }
  }
}, 5_000);

// ── GET /api/race/match/:matchId ──────────────────────────────────────────────
router.get("/match/:matchId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const match = await RaceMatch.findOne({ matchId: req.params["matchId"] }).lean();
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    const isPlayer = match.players.some(p => p.userId?.toString() === req.userId);
    if (!isPlayer) { res.status(403).json({ message: "Not your match" }); return; }

    // Project AI progress in-memory for this response (not persisted) so
    // clients see smooth AI movement between their own shift actions.
    if (match.status === "active" && match.startedAt) {
      const elapsed = Date.now() - new Date(match.startedAt).getTime();
      for (const p of match.players) {
        if (p.isAI && p.finishTime !== null) {
          if (elapsed >= p.finishTime) {
            p.distancePct = 100;
          } else {
            // Linear interpolation – no jitter here so mini-leaderboard doesn't flicker
            p.distancePct = Math.min(99, (elapsed / p.finishTime) * 100);
          }
        }
      }
    }

    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "race match get error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Anti-cheat constants
const MIN_SHIFT_INTERVAL_MS = 250;  // humanly impossible to shift faster than this
const MAX_SHIFTS_PER_RACE   = 120;  // theoretical max: 100% / min_gain(3%) ≈ 34, cap at 3× that

// ── POST /api/race/match/:matchId/shift ───────────────────────────────────────
router.post("/match/:matchId/shift", requireAuth, async (req: AuthRequest, res) => {
  try {
    const match = await RaceMatch.findOne({ matchId: req.params["matchId"] });
    if (!match || match.status !== "active") {
      res.status(400).json({ message: "Match not active" }); return;
    }

    const playerIdx = match.players.findIndex(p => p.userId?.toString() === req.userId);
    if (playerIdx === -1) { res.status(403).json({ message: "Not your match" }); return; }

    const player = match.players[playerIdx];
    if (player.finishTime !== null) {
      res.status(400).json({ message: "You already finished" }); return;
    }

    // ── Anti-cheat: server-side cadence validation ────────────────────────────
    const now = Date.now();
    if (player.lastShiftAt !== null && (now - player.lastShiftAt) < MIN_SHIFT_INTERVAL_MS) {
      res.status(429).json({ message: "Shift cadence too fast" }); return;
    }
    if ((player.shiftCount ?? 0) >= MAX_SHIFTS_PER_RACE) {
      res.status(400).json({ message: "Max shifts reached" }); return;
    }
    player.lastShiftAt = now;
    player.shiftCount  = (player.shiftCount ?? 0) + 1;

    // ── Server-side timing window: green zone is 35–65% of a sweep cycle ─────
    // Gear/sweep-speed only progresses on successful (hit) shifts — a miss keeps
    // the car in the same gear and the sweep cycle keeps running uninterrupted,
    // it does not reset to gear 1.
    const priorHits    = player.hitCount ?? 0;
    const gear         = Math.min(6, priorHits + 1);
    const sweepDur      = Math.max(900, 2400 - (gear - 1) * 150);
    const raceStart   = match.startedAt?.getTime() ?? now;
    const elapsed     = (now - raceStart) % (sweepDur * 2);
    const raw         = elapsed / sweepDur;          // 0→2 bounce
    const pos         = raw > 1 ? 2 - raw : raw;     // 0→1→0
    // raceGearBonus widens the green zone (base half-window 0.15, max adds 0.125 each side)
    const userSnap    = await User.findById(req.userId).select("raceGearBonus").lean();
    const gearBonus   = (userSnap as any)?.raceGearBonus ?? 0;
    const halfWindow  = 0.15 + gearBonus * 0.5;
    const hit         = pos >= (0.5 - halfWindow) && pos <= (0.5 + halfWindow);

    // Speed/progress only builds up on a successful (green-zone) shift — like a real
    // car's gear change. Missing the zone leaves speed exactly where it was: no gain,
    // no loss, and the current gear/cycle keeps running rather than resetting.
    const carSnap = player.carSnapshot;
    const speedFactor = (carSnap.topSpeed + carSnap.accel) / 200;
    const progress = hit ? (0.08 + Math.random() * 0.04) * (0.8 + speedFactor * 0.4) : 0;

    // ── Crash mechanic: obstacle chance ───────────────────────────────────────
    // Perfect shifts have lower crash chance (skilled drivers dodge); misses are more likely to crash
    const crashChance = hit ? 0.04 : 0.12;
    const crashed = Math.random() < crashChance;
    if (crashed) {
      player.crashCount = (player.crashCount ?? 0) + 1;
      // Crash penalty: lose 3–6% distance (net negative vs normal gain)
      const penalty = 3 + Math.random() * 3;
      player.distancePct = Math.max(0, player.distancePct - penalty);
    } else if (hit) {
      player.distancePct = Math.min(100, player.distancePct + progress * 100);
      player.hitCount = priorHits + 1;
    }
    // miss, no crash: distancePct and hitCount both stay exactly the same

    if (player.distancePct >= 100) {
      const finishTime = Date.now() - (match.startedAt?.getTime() ?? Date.now());
      player.finishTime = finishTime;
      player.distancePct = 100;
    }

    // Check if all real players finished
    await checkRaceCompletion(match);
    await match.save();
    res.json({ match, hit, crashed });  // return server-computed values for accurate frontend feedback
  } catch (err) {
    req.log.error({ err }, "race shift error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/race/match/:matchId/nitro ───────────────────────────────────────
router.post("/match/:matchId/nitro", requireAuth, async (req: AuthRequest, res) => {
  try {
    const match = await RaceMatch.findOne({ matchId: req.params["matchId"] });
    if (!match || match.status !== "active") {
      res.status(400).json({ message: "Match not active" }); return;
    }
    const playerIdx = match.players.findIndex(p => p.userId?.toString() === req.userId);
    if (playerIdx === -1) { res.status(403).json({ message: "Not your match" }); return; }

    const player = match.players[playerIdx];
    if (player.nitroUsed >= 3) {
      res.status(400).json({ message: "No nitro left" }); return;
    }

    const nitroBoost = 0.12 + (player.carSnapshot.nitro / 100) * 0.08; // 12–20% boost
    player.distancePct = Math.min(100, player.distancePct + nitroBoost * 100);
    player.nitroUsed += 1;

    if (player.distancePct >= 100) {
      player.finishTime = Date.now() - (match.startedAt?.getTime() ?? Date.now());
      player.distancePct = 100;
    }

    await checkRaceCompletion(match);
    await match.save();
    // Fire nitro mission event (non-fatal)
    fireMissionEvent(String(req.userId), "nitro_use").catch(() => {});
    res.json({ match });
  } catch (err) {
    req.log.error({ err }, "race nitro error");
    res.status(500).json({ message: "Internal server error" });
  }
});

async function checkRaceCompletion(match: any) {
  if (match.status === "complete") return;

  // Smooth AI progress interpolation — reveals AI position progressively each poll
  const now = Date.now();
  const elapsed = match.startedAt ? now - match.startedAt.getTime() : 0;
  for (const p of match.players) {
    if (p.isAI && p.finishTime !== null) {
      if (elapsed >= p.finishTime) {
        p.distancePct = 100;
      } else {
        // Smooth linear interpolation so AI looks like it's actively racing
        // Add a tiny random jitter to simulate gear-miss moments (±3% variance)
        const base = (elapsed / p.finishTime) * 100;
        const jitter = (Math.random() - 0.5) * 3;
        p.distancePct = Math.min(99, Math.max(0, base + jitter));
      }
    }
  }

  // All finished = every human has finishTime set, and all AI have elapsed past their time
  const allHumansFinished = match.players
    .filter((p: any) => !p.isAI)
    .every((p: any) => p.finishTime !== null);
  const allAIFinished = match.players
    .filter((p: any) => p.isAI)
    .every((p: any) => p.finishTime !== null && elapsed >= p.finishTime);
  if (!allHumansFinished || !allAIFinished) return;

  // Sort by finish time (nulls last)
  const sorted = [...match.players].sort((a: any, b: any) => {
    if (a.finishTime === null && b.finishTime === null) return 0;
    if (a.finishTime === null) return 1;
    if (b.finishTime === null) return -1;
    return a.finishTime - b.finishTime;
  });

  sorted.forEach((p: any, i: number) => { p.placement = i + 1; });
  match.status    = "complete";
  match.finishedAt = new Date();

  // Grant rewards
  if (!match.rewardsGranted) {
    await grantRaceRewards(match);
    match.rewardsGranted = true;
  }

  // Degrade car condition and grant key shards for each human player
  for (const p of match.players) {
    if (p.isAI || !p.userId) continue;
    const playerId = String(p.userId);

    // Degrade car condition
    try {
      const garage = await PlayerGarage.findOne({ userId: playerId });
      if (garage && garage.activeCar) {
        const ownedCar = garage.cars.find((c: any) => c.carId === garage.activeCar);
        if (ownedCar) {
          const hadCrash = (p.crashCount ?? 0) > 0;
          const degradation = hadCrash
            ? Math.floor(Math.random() * 8) + 8
            : Math.floor(Math.random() * 4) + 2;
          (ownedCar as any).condition = Math.max(0, ((ownedCar as any).condition ?? 100) - degradation);

          // Degrade all installed parts by the same amount
          const equippedPartIds = Object.values((ownedCar as any).equippedParts ?? {}).filter(Boolean) as string[];
          for (const partId of equippedPartIds) {
            const partStack = garage.parts.find((pt: any) => pt.partId === partId);
            if (partStack) {
              (partStack as any).condition = Math.max(0, ((partStack as any).condition ?? 100) - degradation);
            }
          }

          garage.markModified("cars");
          garage.markModified("parts");
          await garage.save();
        }
      }
    } catch (e) { /* non-fatal */ }

    // Grant +1 keyShard after each race completion
    try {
      await User.findByIdAndUpdate(playerId, { $inc: { keyShards: 1 } });
      // Auto-convert shards to keys
      const u = await User.findById(playerId).select("keyShards keys");
      if (u && u.keyShards >= 20) {
        const toAdd = Math.floor(u.keyShards / 20);
        await User.findByIdAndUpdate(playerId, { $inc: { keyShards: -(toAdd * 20), keys: toAdd } });
      }
    } catch (e) { /* non-fatal */ }
  }
}

// Daily reward cap constants (mirrors combat system)
const RACE_FULL_CAP = 30;  // first 30 races: full rewards + Key Shard
const RACE_HALF_CAP = 50;  // races 30–49: 50% DC + 50% XP, no Key Shard
// 50+: DC = 0, XP = 5% only

async function grantRaceRewards(match: any) {
  const _raceFlash = await getActiveFlashEvent();
  const BASE_REWARDS: Record<number, { dc: number; xp: number; keyShards: number }> = {
    1: { dc: 300, xp: 300, keyShards: 1 },
    2: { dc: 150, xp: 180, keyShards: 0 },
    3: { dc:  80, xp: 100, keyShards: 0 },
    4: { dc:  40, xp:  60, keyShards: 0 },
  };

  for (const p of match.players) {
    if (p.isAI || !p.userId) continue;
    const placement = p.placement ?? 4;
    const base = BASE_REWARDS[placement] ?? BASE_REWARDS[4];

    const u = await User.findById(p.userId);
    if (!u) continue;

    // ── Daily cap check (same pattern as combat) ──────────────────────────────
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!u.miniGameResetAt || u.miniGameResetAt < today) {
      u.miniGameMatchesToday = 0;
      u.miniGameResetAt = new Date(today.getTime() + 86_400_000);
    }
    const racesToday = u.miniGameMatchesToday ?? 0;
    const dcMult  = racesToday >= RACE_HALF_CAP ? 0    : racesToday >= RACE_FULL_CAP ? 0.5 : 1;
    const xpMult  = racesToday >= RACE_HALF_CAP ? 0.05 : racesToday >= RACE_FULL_CAP ? 0.5 : 1;
    const fullRewards = racesToday < RACE_FULL_CAP;
    u.miniGameMatchesToday = racesToday + 1;
    // ─────────────────────────────────────────────────────────────────────────

    let dcEarned      = Math.floor(base.dc * dcMult);
    const xpEarned    = Math.floor(base.xp * xpMult * (1 + (u.prestigeXpBoost ?? 0) / 100));
    const shardsEarned = fullRewards ? base.keyShards : 0;
    // 1st place: 10% chance of a bonus Key (Racing Royale spin token)
    const bonusKey = placement === 1 && fullRewards && Math.random() < 0.1 ? 1 : 0;
    // Flash 2x_race_prizes
    if (_raceFlash?.effect === "2x_race_prizes" && dcEarned > 0) dcEarned *= 2;

    u.dc         += dcEarned;
    u.xp         += xpEarned;
    u.keyShards  += shardsEarned;
    u.keys       += bonusKey;
    u.totalRaces += 1;
    if (placement === 1) u.raceWins += 1;
    await u.save();

    const weekStart = getWeekStart();
    if (placement === 1) {
      await MiniGameLeaderboard.findOneAndUpdate(
        { leaderboardType: "race_wins", userId: p.userId, weekStart },
        { $inc: { score: 1 }, $set: { username: u.username, avatar: u.avatar } },
        { upsert: true },
      );
      // Tier 8 §8.1 — announce if this win pushed the player into the weekly top 3
      announceLeaderboardMilestone("race_wins", weekStart, p.userId, u.username).catch(() => {});
    }
    if (p.finishTime !== null) {
      const lbType = match.mode === "2player" ? "race_fastest_2p" : "race_fastest_4p";
      const existing = await MiniGameLeaderboard.findOne({ leaderboardType: lbType, userId: p.userId, weekStart });
      if (!existing || p.finishTime < existing.score) {
        await MiniGameLeaderboard.findOneAndUpdate(
          { leaderboardType: lbType, userId: p.userId, weekStart },
          { $set: { score: p.finishTime, username: u.username, avatar: u.avatar } },
          { upsert: true },
        );
        announceLeaderboardMilestone(lbType, weekStart, p.userId, u.username).catch(() => {});
      }
    }

    const capNote = dcMult < 1 ? ` (${racesToday >= RACE_HALF_CAP ? "XP only" : "50% cap"})` : "";
    await Notification.create({
      userId: p.userId,
      type: "system",
      message: `Race ${placement === 1 ? "Victory! 🏆" : `Finished #${placement}`} — +${dcEarned} DC, +${xpEarned} XP${shardsEarned ? ", +1 Key Shard" : ""}${bonusKey ? ", +1 Key 🎰" : ""}${capNote}`,
      read: false,
      createdAt: new Date(),
    });

    // Fire mission events (non-fatal)
    fireMissionEvent(String(p.userId), "race_play").catch(() => {});
    if (placement === 1) fireMissionEvent(String(p.userId), "race_win").catch(() => {});
    if (dcEarned > 0) fireMissionEvent(String(p.userId), "dc_earned", dcEarned).catch(() => {});
    checkAchievements(String(p.userId)).catch(() => {});
    // Event points — "race_1st" for winner, "race_finish" for all placements
    const raceAction = placement === 1 ? "race_1st" : "race_finish";
    awardEventPoints({ userId: String(p.userId), username: u.username, action: raceAction, io: (match as any)._io }).catch(() => {});
    awardBattlePassXp(String(p.userId), raceAction).catch(() => {});
    updateQuestProgress(String(p.userId), placement === 1 ? "race_1st" : "race_finish").catch(() => {});
  }
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── POST /api/race/cars/:carId/service ────────────────────────────────────────
router.post("/cars/:carId/service", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { carId } = req.params;
    const { method } = req.body as { method?: "dc" | "token" };

    const garage = await PlayerGarage.findOne({ userId: req.userId });
    if (!garage) { res.status(404).json({ message: "Garage not found" }); return; }

    const ownedCar = garage.cars.find((c: any) => c.carId === carId) as any;
    if (!ownedCar) { res.status(404).json({ message: "Car not in your garage" }); return; }

    if ((ownedCar.condition ?? 100) >= 100) {
      res.status(400).json({ message: "Car is already in perfect condition" }); return;
    }

    const user = await User.findById(req.userId).select("dc");
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    if (!method || method === "dc") {
      // Get car tier from RaceCar model
      let carTier = "common";
      try {
        const RaceCar = (await import("./models/RaceCar")).default;
        const carDef = await RaceCar.findOne({ carId }).lean();
        carTier = (carDef as any)?.tier ?? "common";
      } catch (e) {}

      const DC_COSTS: Record<string, number> = { common: 2000, uncommon: 5000, rare: 10000, epic: 18000, legendary: 30000 };
      const cost = DC_COSTS[carTier] ?? 2000;

      if (user.dc < cost) { res.status(400).json({ message: "Not enough DC. Service costs " + cost + " DC." }); return; }
      await User.findByIdAndUpdate(req.userId, { $inc: { dc: -cost } });
    } else if (method === "token") {
      const Item = (await import("../../models/Item")).default;
      const token = await Item.findOne({ owner: req.userId, name: "Service Token", quantity: { $gt: 0 } });
      if (!token) { res.status(400).json({ message: "No Service Token in inventory" }); return; }
      token.quantity = (token.quantity ?? 1) - 1;
      if (token.quantity <= 0) await token.deleteOne();
      else await token.save();
    } else {
      res.status(400).json({ message: "Invalid method. Use 'dc' or 'token'." }); return;
    }

    ownedCar.condition = 100;

    // Restore all installed parts to 100% condition
    const equippedPartIds = Object.values((ownedCar as any).equippedParts ?? {}).filter(Boolean) as string[];
    for (const partId of equippedPartIds) {
      const partStack = garage.parts.find((pt: any) => pt.partId === partId);
      if (partStack) {
        (partStack as any).condition = 100;
      }
    }

    garage.markModified("cars");
    garage.markModified("parts");
    await garage.save();

    res.json({ message: "Car serviced to 100% condition", condition: 100 });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
