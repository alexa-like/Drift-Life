/**
 * Races — Wire Cartel Section 3 (race mechanics)
 * Drag, Circuit, Drift, and Pink-Slip races. All resolution server-authoritative.
 */
import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Car from "../models/Car";
import FeedEvent from "../models/FeedEvent";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { getWorldState } from "../models/WorldState";

const router = Router();

// In-memory pending pink-slip confirmations (clears on restart — production would use Redis/DB)
const pendingPinkSlips: Map<string, { challengerId: string; defenderId: string; challengerCarId: string; defenderCarId: string; expiresAt: Date }> = new Map();

// ── Race resolution helpers ─────────────────────────────────────────────────

function resolveDrag(challengerCar: any, defenderCar: any, launchBonus = 0, worldGrip = 1) {
  const BASE_TIME = 12.0; // seconds
  const cTime = BASE_TIME
    - challengerCar.power * 0.02
    - challengerCar.nitro * 0.01
    + (Math.random() * 0.4 - 0.2)
    - launchBonus;
  const dTime = BASE_TIME
    - defenderCar.power * 0.02
    - defenderCar.nitro * 0.01
    + (Math.random() * 0.4 - 0.2);
  return { challengerTime: parseFloat(cTime.toFixed(3)), defenderTime: parseFloat(dTime.toFixed(3)), challengerWins: cTime < dTime };
}

function resolveCircuit(challengerCar: any, defenderCar: any, cornerBonus = 0, laps = 3) {
  let cTotal = 0, dTotal = 0;
  for (let i = 0; i < laps; i++) {
    const BASE_LAP = 90;
    cTotal += BASE_LAP - challengerCar.handling * 0.015 - challengerCar.grip * 0.01 + (Math.random() * 2 - 1) - cornerBonus;
    dTotal += BASE_LAP - defenderCar.handling * 0.015 - defenderCar.grip * 0.01 + (Math.random() * 2 - 1);
  }
  return { challengerTime: parseFloat(cTotal.toFixed(2)), defenderTime: parseFloat(dTotal.toFixed(2)), challengerWins: cTotal < dTotal };
}

function resolveDrift(challengerCar: any, defenderCar: any, gripRainPenalty = 1) {
  const styleC = 1 + Math.random() * 0.5;
  const styleD = 1 + Math.random() * 0.5;
  const cScore = (Math.random() * 60 + 20) * ((challengerCar.grip * gripRainPenalty) * 0.3 + styleC);
  const dScore = (Math.random() * 60 + 20) * ((defenderCar.grip * gripRainPenalty) * 0.3 + styleD);
  return { challengerScore: parseFloat(cScore.toFixed(1)), defenderScore: parseFloat(dScore.toFixed(1)), challengerWins: cScore > dScore };
}

// ── POST /api/races/start — challenge another player ────────────────────────
router.post("/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { defenderId, raceType, isPinkSlip = false, launchBonus = 0, cornerBonus = 0 } = req.body as {
      defenderId: string; raceType: "drag"|"circuit"|"drift"; isPinkSlip?: boolean;
      launchBonus?: number; cornerBonus?: number;
    };

    if (!["drag","circuit","drift"].includes(raceType)) return res.status(400).json({ message: "Invalid race type" });

    const challenger = await User.findById(req.userId);
    const defender = await User.findById(defenderId);
    if (!challenger || !defender) return res.status(404).json({ message: "User not found" });
    if (challenger._id.equals(defender._id)) return res.status(400).json({ message: "Can't race yourself" });

    const challengerCar = challenger.activeCar
      ? await Car.findById(challenger.activeCar)
      : await Car.findOne({ ownerId: challenger._id });
    const defenderCar = defender.activeCar
      ? await Car.findById(defender.activeCar)
      : await Car.findOne({ ownerId: defender._id });

    if (!challengerCar) return res.status(400).json({ message: "You have no active car. Visit the Garage first." });
    if (!defenderCar) return res.status(400).json({ message: "Opponent has no car" });
    if (challengerCar.impoundedUntil && challengerCar.impoundedUntil > new Date()) {
      return res.status(400).json({ message: "Your car is impounded" });
    }

    // Level bracket check (same as PvP combat ±25 levels)
    if (Math.abs(challenger.level - defender.level) > 25) {
      return res.status(400).json({ message: "Level bracket restriction — can only race players within 25 levels" });
    }

    if (isPinkSlip) {
      // Pink-slip requires confirmation from both sides — create pending
      const raceId = new mongoose.Types.ObjectId().toString();
      pendingPinkSlips.set(raceId, {
        challengerId: challenger._id.toString(),
        defenderId: defender._id.toString(),
        challengerCarId: challengerCar._id.toString(),
        defenderCarId: defenderCar._id.toString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await Notification.create({
        userId: defender._id,
        type: "pink_slip_challenge",
        message: `${challenger.username} is challenging you to a pink-slip ${raceType} race! Your ${defenderCar.name} vs their ${challengerCar.name}.`,
        link: `/races/accept/${raceId}`,
      });

      return res.json({ message: "Pink-slip challenge sent. Waiting for opponent confirmation.", raceId });
    }

    // Non-pink-slip: resolve immediately
    const world = await getWorldState().catch(() => null);
    const gripMod = world?.weather === "rain" ? 0.9 : 1.0;
    const prizeMult = world?.activeEvents.find(e => e.type === "race_week" && e.endsAt > new Date())?.effectModifiers.racePrizeMult ?? 1;

    // ── Server-side bonus clamping ────────────────────────────────────────────
    // Client minigames produce a value in [0, 1]; clamp strictly before use
    // so a tampered API call cannot exceed what a perfect minigame produces.
    const safeLaunchBonus  = Math.max(0, Math.min(1, Number(launchBonus)  || 0));
    const safeCornerBonus  = Math.max(0, Math.min(1, Number(cornerBonus)  || 0));

    let result: any;
    if (raceType === "drag")    result = resolveDrag(challengerCar, defenderCar, safeLaunchBonus * 0.3);
    if (raceType === "circuit") result = resolveCircuit(challengerCar, defenderCar, safeCornerBonus * 0.5);
    if (raceType === "drift")   result = resolveDrift(challengerCar, defenderCar, gripMod);

    const { challengerWins } = result;
    const winner = challengerWins ? challenger : defender;
    const loser  = challengerWins ? defender : challenger;
    const loserCar = challengerWins ? defenderCar : challengerCar;

    // Prize: 5% of loser's wallet (capped)
    const prize = Math.min(50_000, Math.floor(loser.dc * 0.05 * prizeMult));
    winner.dc = Math.min(100_000_000, winner.dc + prize);
    loser.dc = Math.max(0, loser.dc - prize);
    winner.raceWins = (winner.raceWins ?? 0) + 1;
    loser.totalRaces = (loser.totalRaces ?? 0) + 1;
    winner.totalRaces = (winner.totalRaces ?? 0) + 1;
    winner.seasonPoints = (winner.seasonPoints ?? 0) + 10;
    winner.followers = Math.floor((winner.followers ?? 0) + 2);

    // Loser's car damaged
    loserCar.durability = Math.max(0, loserCar.durability - 15);
    if (loserCar.durability === 0) {
      loserCar.impoundedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min impound
    }
    loserCar.raceLosses += 1;
    if (challengerWins) challengerCar.raceWins += 1;
    else defenderCar.raceWins += 1;

    await Promise.all([winner.save(), loser.save(), loserCar.save()]);

    await FeedEvent.create({
      type: "race", actor: winner.username, actorId: winner._id,
      message: `${winner.username} beat ${loser.username} in a ${raceType} race — +${prize.toLocaleString()} DC`,
      dc: prize, xp: 25,
    }).catch(() => {});

    res.json({ ...result, raceType, winner: winner.username, loser: loser.username, prize, challengerWins });
  } catch (err: any) {
    req.log.error({ err }, "race error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/races/accept/:raceId — accept pink-slip challenge ──────────────
router.post("/accept/:raceId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const pending = pendingPinkSlips.get(req.params.raceId);
    if (!pending) return res.status(404).json({ message: "Race challenge not found or expired" });
    if (pending.defenderId !== req.userId?.toString()) return res.status(403).json({ message: "Not your challenge" });
    if (pending.expiresAt < new Date()) {
      pendingPinkSlips.delete(req.params.raceId);
      return res.status(410).json({ message: "Challenge expired" });
    }

    const challenger = await User.findById(pending.challengerId);
    const defender = await User.findById(pending.defenderId);
    const challengerCar = await Car.findById(pending.challengerCarId);
    const defenderCar = await Car.findById(pending.defenderCarId);
    if (!challenger || !defender || !challengerCar || !defenderCar) return res.status(404).json({ message: "Players or cars not found" });

    pendingPinkSlips.delete(req.params.raceId);

    // Race type from body (default drag for pink-slip)
    const raceType = (req.body.raceType ?? "drag") as "drag" | "circuit" | "drift";
    let result: any;
    if (raceType === "drag")    result = resolveDrag(challengerCar, defenderCar);
    if (raceType === "circuit") result = resolveCircuit(challengerCar, defenderCar);
    if (raceType === "drift")   result = resolveDrift(challengerCar, defenderCar);

    const { challengerWins } = result;
    const winner = challengerWins ? challenger : defender;
    const loser  = challengerWins ? defender : challenger;
    const winnerCar = challengerWins ? challengerCar : defenderCar;
    const loserCar  = challengerWins ? defenderCar : challengerCar;

    // PINK SLIP: transfer loser's car to winner
    loserCar.ownerId = winner._id;
    loser.cars = loser.cars.filter(id => !id.equals(loserCar._id));
    if (loser.activeCar?.equals(loserCar._id)) loser.activeCar = loser.cars[0] ?? null;
    winner.cars.push(loserCar._id);

    winner.raceWins = (winner.raceWins ?? 0) + 1;
    winner.seasonPoints = (winner.seasonPoints ?? 0) + 50;
    winner.pinkSlipWins = (winner.pinkSlipWins ?? 0) + 1;
    winner.followers = Math.floor((winner.followers ?? 0) + 20);

    await Promise.all([winner.save(), loser.save(), loserCar.save()]);

    await FeedEvent.create({
      type: "race", actor: winner.username, actorId: winner._id,
      message: `PINK SLIP: ${winner.username} won ${loserCar.name} from ${loser.username} in a ${raceType} race!`,
      dc: 0, xp: 100,
    }).catch(() => {});

    res.json({ ...result, raceType, winner: winner.username, loser: loser.username, pinkSlip: true, transferredCar: loserCar.name });
  } catch (err: any) {
    req.log.error({ err }, "accept race error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
