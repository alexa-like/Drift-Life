/**
 * Net — Wire Cartel Section 4
 * Hacking minigame, SIM coin, dark web marketplace, firewall, drones.
 */
import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import ActionMastery, { masteryGain } from "../models/ActionMastery";

import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen, isHospitalized, isJailed } from "../models/User";
import { getWorldState, recalcSimPrice } from "../models/WorldState";
import { energySufficientExpr, buildRegenPipeline } from "../lib/atomicRegen";

const router = Router();

// In-memory dark web listings (production: use DB collection)
interface DarkListing {
  id: string; pseudoHandle: string; itemName: string; price: number; currency: "dc" | "sim";
  stingRisk: number; createdAt: Date; sellerId: string;
}
const darkListings: DarkListing[] = [];

// Pending hacking sessions (server-side sequence store)
const hackSessions: Map<string, {
  targetId: string; sequence: string[]; difficulty: number; expiresAt: Date;
}> = new Map();

const HACK_COOLDOWN_MS = 60_000; // 1 min between hack attempts on same target
const HACKS_PER_HOUR = 15;

function generateSequence(difficulty: number): string[] {
  const symbols = ["▲", "■", "●", "◆", "★", "✦", "⬟", "⬡"];
  const length = Math.min(10, 3 + difficulty);
  return Array.from({ length }, () => symbols[Math.floor(Math.random() * symbols.length)]);
}

// ── GET /api/net/status — player's net stats ─────────────────────────────────
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("sim firewallLevel intelligence onboardingStage").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const world = await getWorldState();
    res.json({
      sim: user.sim, firewallLevel: user.firewallLevel, intelligence: user.intelligence,
      simPrice: world.simPrice, simPriceHistory: world.simPriceHistory.slice(-24),
    });
  } catch (err: any) {
    req.log.error({ err }, "net status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/hack/initiate — start a hack session ──────────────────────
router.post("/hack/initiate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId } = req.body as { targetId: string };
    if (!targetId) return res.status(400).json({ message: "Target required" });
    if (!mongoose.Types.ObjectId.isValid(targetId))
      return res.status(400).json({ message: "Invalid target" });

    const [hacker, target] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);
    if (!hacker || !target) return res.status(404).json({ message: "User not found" });
    if (hacker._id.equals(target._id)) return res.status(400).json({ message: "Can't hack yourself" });

    applyRegen(hacker);
    if (isHospitalized(hacker)) return res.status(400).json({ message: "Hospitalized" });
    if (isJailed(hacker)) return res.status(400).json({ message: "In jail" });
    if (hacker.energy < 3) return res.status(400).json({ message: "Need 3 energy to hack" });
    if (hacker.onboardingStage < 3) return res.status(400).json({ message: "Complete Street, Garage and City first to unlock Net" });

    // Anti-abuse rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentHacks = await ActionMastery.countDocuments({
      userId: req.userId, actionType: "hack", lastAttemptAt: { $gt: oneHourAgo },
    });
    if (recentHacks >= HACKS_PER_HOUR) return res.status(429).json({ message: "Hack rate limit reached" });

    // Deduct energy atomically
    await User.findOneAndUpdate(
      { _id: req.userId, ...energySufficientExpr(3) },
      buildRegenPipeline({ energyCost: 3 }),
      { new: true },
    );

    // Generate sequence (difficulty based on target's firewall)
    const difficulty = Math.max(1, Math.min(8, (target.firewallLevel ?? 1)));
    const sequence = generateSequence(difficulty);

    // Intelligence reduces effective difficulty
    const intReduction = Math.floor((hacker.intelligence - 5) / 10);
    const effectiveDifficulty = Math.max(1, difficulty - intReduction);
    const adjustedSeq = generateSequence(effectiveDifficulty);

    const sessionId = new mongoose.Types.ObjectId().toString();
    hackSessions.set(sessionId, {
      targetId: target._id.toString(),
      sequence: adjustedSeq,
      difficulty: effectiveDifficulty,
      expiresAt: new Date(Date.now() + 30_000), // 30 sec to complete
    });

    res.json({
      sessionId, sequence: adjustedSeq, difficulty: effectiveDifficulty,
      timeLimit: 30, targetFirewall: target.firewallLevel,
    });
  } catch (err: any) {
    req.log.error({ err }, "hack initiate error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/hack/submit — submit hack attempt ─────────────────────────
router.post("/hack/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionId, answer } = req.body as { sessionId: string; answer: string[] };
    const session = hackSessions.get(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found or expired" });
    if (session.expiresAt < new Date()) {
      hackSessions.delete(sessionId);
      return res.status(410).json({ message: "Session expired" });
    }

    const hacker = await User.findById(req.userId);
    const target = await User.findById(session.targetId);
    if (!hacker || !target) return res.status(404).json({ message: "User not found" });

    hackSessions.delete(sessionId);

    // Verify answer matches sequence
    const correct = session.sequence.every((s, i) => s === answer[i]) && answer.length === session.sequence.length;

    // Update mastery
    const mastKey = `hack_${session.difficulty}`;
    let mast = await ActionMastery.findOne({ userId: req.userId, actionId: mastKey, actionType: "hack" });
    if (!mast) mast = new ActionMastery({ userId: req.userId, actionId: mastKey, actionType: "hack" });
    mast.attempts += 1;
    mast.lastAttemptAt = new Date();

    if (!correct) {
      await mast.save();
      // Alert target if they have high firewall (spotted_chance = 15% - stealth)
      const spottedChance = Math.max(0, 0.15 - (hacker.intelligence / 200));
      if (Math.random() < spottedChance) {
        await Notification.create({
          userId: target._id,
          type: "hack_attempt",
          message: `Someone attempted to breach your firewall and failed.`,
          link: null,
        });
      }
      return res.json({ success: false, message: "Sequence mismatch. Hack failed." });
    }

    mast.successes += 1;
    mast.mastery = Math.min(100, mast.mastery + masteryGain(mast.mastery));
    await mast.save();

    // Payout: SIM coin based on difficulty
    const simEarned = Math.floor(session.difficulty * 5 + Math.random() * session.difficulty * 10);
    hacker.sim += simEarned;

    // Notify target
    await Notification.create({
      userId: target._id, type: "hacked",
      message: "Your firewall was breached! An unknown entity accessed your system.",
      link: null,
    });

    // Alert hacker's heat slightly
    hacker.heat = Math.min(100, hacker.heat + session.difficulty * 2);
    hacker.seasonPoints = (hacker.seasonPoints ?? 0) + 5;
    await hacker.save();

    // SIM price impact (buy pressure from hack rewards)
    const world = await getWorldState();
    world.simBuyVolume += simEarned;
    await world.save();

    // net hacks are private — no feed post

    res.json({ success: true, simEarned, heatGain: session.difficulty * 2, sim: hacker.sim, mastery: mast.mastery });
  } catch (err: any) {
    req.log.error({ err }, "hack submit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/net/sim — SIM price + player balance ────────────────────────────
router.get("/sim", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user, world] = await Promise.all([
      User.findById(req.userId).select("sim").lean(),
      getWorldState(),
    ]);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ sim: user.sim, price: world.simPrice, history: world.simPriceHistory.slice(-48) });
  } catch (err: any) {
    req.log.error({ err }, "sim price error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/sim/buy — buy SIM with DC ──────────────────────────────────
router.post("/sim/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1) return res.status(400).json({ message: "Invalid amount" });

    const world = await getWorldState();
    const cost = Math.ceil(amount * world.simPrice);

    const user = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost, sim: amount } },
      { new: true },
    );
    if (!user) return res.status(400).json({ message: `Costs ${cost.toLocaleString()} DC`, cost });

    // Update buy volume and recalculate price
    world.simBuyVolume += cost;
    world.simPrice = recalcSimPrice(world);
    world.simPriceHistory.push({ price: world.simPrice, at: new Date() });
    if (world.simPriceHistory.length > 168) world.simPriceHistory.shift(); // keep 1 week
    await world.save();

    res.json({ bought: amount, cost, sim: user.sim, dc: user.dc, newPrice: world.simPrice });
  } catch (err: any) {
    req.log.error({ err }, "buy sim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/sim/sell — sell SIM for DC ─────────────────────────────────
router.post("/sim/sell", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1) return res.status(400).json({ message: "Invalid amount" });

    const world = await getWorldState();
    const revenue = Math.floor(amount * world.simPrice);

    const user = await User.findOneAndUpdate(
      { _id: req.userId, sim: { $gte: amount } },
      { $inc: { sim: -amount, dc: revenue } },
      { new: true },
    );
    if (!user) return res.status(400).json({ message: "Not enough SIM" });

    world.simSellVolume += revenue;
    world.simPrice = recalcSimPrice(world);
    world.simPriceHistory.push({ price: world.simPrice, at: new Date() });
    if (world.simPriceHistory.length > 168) world.simPriceHistory.shift();
    await world.save();

    res.json({ sold: amount, revenue, sim: user.sim, dc: user.dc, newPrice: world.simPrice });
  } catch (err: any) {
    req.log.error({ err }, "sell sim error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/net/dark-market — dark web listings ─────────────────────────────
router.get("/dark-market", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("successfulCrimes onboardingStage").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    // Only accessible after first successful Tier-2+ Run
    if (user.successfulCrimes < 3) {
      return res.status(403).json({ message: "You need to complete at least 3 runs to access the Dark Market." });
    }
    // Filter expired listings
    const now = new Date();
    const active = darkListings.filter(l => l.createdAt > new Date(now.getTime() - 48 * 60 * 60 * 1000));
    // Never expose real sellerId
    res.json(active.map(l => ({
      id: l.id, pseudoHandle: l.pseudoHandle, itemName: l.itemName,
      price: l.price, currency: l.currency, stingRisk: l.stingRisk,
    })));
  } catch (err: any) {
    req.log.error({ err }, "dark market error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/dark-market/list — create dark listing ─────────────────────
router.post("/dark-market/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemName, price, currency = "dc" } = req.body as { itemName: string; price: number; currency?: "dc" | "sim" };
    if (!itemName || !price || price < 1) return res.status(400).json({ message: "Invalid listing" });

    const adjectives = ["Shadow", "Ghost", "Neon", "Void", "Rust"];
    const nouns = ["Dealer", "Courier", "Broker", "Runner", "Phantom"];
    const pseudoHandle = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}#${Math.floor(1000 + Math.random() * 8999)}`;

    const listing: DarkListing = {
      id: new mongoose.Types.ObjectId().toString(),
      pseudoHandle, itemName, price, currency,
      stingRisk: 0.03, // 3% sting risk per purchase
      createdAt: new Date(),
      sellerId: req.userId!.toString(),
    };
    darkListings.push(listing);
    if (darkListings.length > 500) darkListings.shift();

    res.status(201).json({ message: "Listed on dark market.", pseudoHandle, id: listing.id });
  } catch (err: any) {
    req.log.error({ err }, "dark list error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/dark-market/buy/:listingId — buy from dark market ──────────
router.post("/dark-market/buy/:listingId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = darkListings.find(l => l.id === req.params.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.sellerId === req.userId?.toString()) return res.status(400).json({ message: "Can't buy your own listing" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Sting risk check (3% — item confiscation + heat spike)
    if (Math.random() < listing.stingRisk) {
      user.heat = Math.min(100, user.heat + 20);
      await user.save();
      return res.json({ success: false, stung: true, message: "STING OPERATION. Item confiscated. Heat +20.", heat: user.heat });
    }

    if (listing.currency === "dc") {
      if (user.dc < listing.price) return res.status(400).json({ message: "Not enough DC" });
      user.dc -= listing.price;
    } else {
      if (user.sim < listing.price) return res.status(400).json({ message: "Not enough SIM" });
      user.sim -= listing.price;
    }

    // Remove listing
    const idx = darkListings.findIndex(l => l.id === listing.id);
    if (idx !== -1) darkListings.splice(idx, 1);

    // Pay seller (anonymously)
    await User.findByIdAndUpdate(listing.sellerId, {
      $inc: listing.currency === "dc" ? { dirtyDc: listing.price } : { sim: listing.price },
    });

    await user.save();
    res.json({ success: true, item: listing.itemName, dc: user.dc, sim: user.sim });
  } catch (err: any) {
    req.log.error({ err }, "dark buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/net/firewall/upgrade — upgrade firewall level ──────────────────
router.post("/firewall/upgrade", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const FIREWALL_COSTS = [0, 5_000, 15_000, 40_000, 100_000, 250_000]; // levels 1-6
    const nextLevel = (user.firewallLevel ?? 1) + 1;
    if (nextLevel > 6) return res.status(400).json({ message: "Firewall at max level" });
    const cost = FIREWALL_COSTS[nextLevel - 1];

    if (user.dc < cost) return res.status(400).json({ message: `Costs ${cost.toLocaleString()} DC`, cost });
    user.dc -= cost;
    user.firewallLevel = nextLevel;
    await user.save();

    res.json({ message: `Firewall upgraded to level ${nextLevel}.`, firewallLevel: nextLevel, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "firewall upgrade error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
