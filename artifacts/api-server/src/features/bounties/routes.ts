/**
 * bounties.ts — Bounty placement, listing, cancellation, and claim logic.
 *
 * Mounted at /api/bounties in routes/index.ts.
 * claimBounty()  — exported for arena.ts (auto-claim when winner beats bounty target).
 * expireBounties() — exported for index.ts scheduler (hourly refund of expired bounties).
 */
import { Router } from "express";
import mongoose from "mongoose";
import Bounty from "./models/Bounty";
import User from "../../models/User";
import Notification from "../../models/Notification";
import { requireAuth, AuthRequest } from "../../middlewares/auth";
import { logger } from "../../lib/logger";
import { emitFeedEvent } from "../../lib/feedEvents";
import { sendPushToUser } from "../../lib/sendPushToUser";
import { notifyTelegram } from "../../lib/telegram";

const router = Router();

const MIN_BOUNTY    = 1_000;
const BOUNTY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── POST /api/bounties — place a bounty ───────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetId, amount } = req.body;

    if (!targetId || typeof amount !== "number" || amount < MIN_BOUNTY) {
      return res.status(400).json({ message: `Minimum bounty is ${MIN_BOUNTY.toLocaleString()} DC` });
    }
    if (targetId === String(req.userId)) {
      return res.status(400).json({ message: "You can't place a bounty on yourself" });
    }

    const [placer, target] = await Promise.all([
      User.findById(req.userId).select("username dc"),
      User.findById(targetId).select("username isGhostAccount"),
    ]);

    if (!placer || !target) return res.status(404).json({ message: "User not found" });
    if ((target as any).isGhostAccount) return res.status(400).json({ message: "Invalid target" });
    if (placer.dc < amount) return res.status(400).json({ message: "Insufficient DC" });

    // Reject if the same placer already has an active bounty on this target
    const existing = await Bounty.findOne({ placerId: req.userId, targetId, status: "active" });
    if (existing) {
      return res.status(400).json({ message: "You already have an active bounty on this player" });
    }

    // Atomic DC deduction — fails safely if DC drops below amount between check and write
    const deducted = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: amount } },
      { $inc: { dc: -amount } },
    );
    if (!deducted) return res.status(400).json({ message: "Insufficient DC" });

    const expiresAt = new Date(Date.now() + BOUNTY_TTL_MS);
    await Bounty.create({
      placerId:   req.userId,
      placerName: placer.username,
      targetId,
      targetName: target.username,
      amount,
      expiresAt,
    });

    // Feed post
    emitFeedEvent({
      type: "system", actor: "System", actorId: undefined,
      message: `[💰 BOUNTY] @${placer.username} has placed a ${amount.toLocaleString()} DC bounty on @${target.username}!`,
      dc: 0, xp: 0,
    }).catch(() => {});

    // Notify target
    Notification.create({
      userId: targetId, type: "system",
      message: `💰 A ${amount.toLocaleString()} DC bounty has been placed on your head by ${placer.username}. Watch your back.`,
    }).catch(() => {});
    sendPushToUser(String(targetId), {
      title: "💰 Bounty on Your Head",
      body: `${placer.username} placed a ${amount.toLocaleString()} DC bounty on you!`,
      link: "/leaderboard", tag: "general",
    }, "general").catch(() => {});

    res.status(201).json({ message: "Bounty placed", amount });
  } catch (err: any) {
    req.log.error({ err }, "POST /bounties error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/bounties — active bounties sorted by amount desc ─────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const page  = Math.max(0, Number(req.query["page"] ?? 0));
    const limit = 20;
    const bounties = await Bounty.find({ status: "active" })
      .sort({ amount: -1 })
      .skip(page * limit)
      .limit(limit)
      .lean();
    res.json(bounties.map(b => ({
      id:          b._id,
      placerName:  b.placerName,
      targetId:    b.targetId,
      targetName:  b.targetName,
      amount:      b.amount,
      expiresAt:   b.expiresAt,
      createdAt:   (b as any).createdAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "GET /bounties error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/bounties/mine — placed by me + active on me ─────────────────────
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [placed, onMe] = await Promise.all([
      Bounty.find({ placerId: req.userId }).sort({ createdAt: -1 }).limit(20).lean(),
      Bounty.find({ targetId: req.userId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    res.json({ placed, onMe });
  } catch (err: any) {
    req.log.error({ err }, "GET /bounties/mine error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/bounties/on/:userId — active bounties on a specific player ───────
router.get("/on/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bounties = await Bounty.find({ targetId: req.params.userId, status: "active" })
      .sort({ amount: -1 })
      .lean();
    const totalAmount = bounties.reduce((s, b) => s + b.amount, 0);
    res.json({ count: bounties.length, totalAmount, bounties });
  } catch (err: any) {
    req.log.error({ err }, "GET /bounties/on/:userId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/bounties/:id/cancel — placer cancels → DC refunded ──────────────
router.post("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bounty = await Bounty.findById(req.params.id);
    if (!bounty) return res.status(404).json({ message: "Bounty not found" });
    if (String(bounty.placerId) !== String(req.userId)) {
      return res.status(403).json({ message: "You did not place this bounty" });
    }
    if (bounty.status !== "active") {
      return res.status(400).json({ message: `Bounty is already ${bounty.status}` });
    }

    bounty.status = "cancelled";
    await Promise.all([
      bounty.save(),
      User.findByIdAndUpdate(req.userId, { $inc: { dc: bounty.amount } }),
    ]);

    res.json({ message: "Bounty cancelled. DC refunded.", refunded: bounty.amount });
  } catch (err: any) {
    req.log.error({ err }, "POST /bounties/:id/cancel error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Exported helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * claimBounty — called by arena.ts when a player defeats another in a real PvP match.
 * Finds the highest active bounty on the loser and transfers DC to the winner.
 */
export async function claimBounty(winnerId: string, loserId: string): Promise<void> {
  try {
    const bounty = await Bounty.findOne({ targetId: loserId, status: "active" }).sort({ amount: -1 });
    if (!bounty) return;

    const [winner, loser] = await Promise.all([
      User.findById(winnerId).select("username telegramId telegramNotifications"),
      User.findById(loserId).select("username telegramId telegramNotifications"),
    ]);
    if (!winner || !loser) return;

    // Mark claimed + award DC
    bounty.status        = "claimed";
    bounty.claimedById   = new mongoose.Types.ObjectId(winnerId);
    bounty.claimedByName = winner.username;
    bounty.claimedAt     = new Date();
    await Promise.all([
      bounty.save(),
      User.findByIdAndUpdate(winnerId, { $inc: { dc: bounty.amount } }),
    ]);

    // Notify winner
    Notification.create({
      userId: winnerId, type: "system",
      message: `💰 You claimed the ${bounty.amount.toLocaleString()} DC bounty on ${loser.username}!`,
    }).catch(() => {});
    sendPushToUser(winnerId, {
      title: "💰 Bounty Claimed!",
      body: `You collected the ${bounty.amount.toLocaleString()} DC bounty on ${loser.username}!`,
      link: "/leaderboard", tag: "general",
    }, "general").catch(() => {});
    notifyTelegram(winner as any,
      `💰 <b>Bounty Claimed!</b>\n\nYou collected the ${bounty.amount.toLocaleString()} DC bounty on <b>${loser.username}</b>!`,
    ).catch(() => {});

    // Notify loser
    Notification.create({
      userId: String(bounty.targetId), type: "system",
      message: `💰 ${winner.username} collected the ${bounty.amount.toLocaleString()} DC bounty on you.`,
    }).catch(() => {});

    // Feed post
    emitFeedEvent({
      type: "system", actor: "System", actorId: undefined,
      message: `[💰 BOUNTY CLAIMED] @${winner.username} collected the ${bounty.amount.toLocaleString()} DC bounty on @${loser.username}!`,
      dc: 0, xp: 0,
    }).catch(() => {});

    logger.info({ winnerId, loserId, amount: bounty.amount }, "Bounty claimed via arena");
  } catch (err) {
    logger.error({ err }, "claimBounty error");
  }
}

/**
 * expireBounties — called hourly.
 * Marks overdue active bounties as expired and refunds DC to the placer.
 */
export async function expireBounties(): Promise<void> {
  try {
    const now     = new Date();
    const expired = await Bounty.find({ status: "active", expiresAt: { $lte: now } });
    for (const bounty of expired) {
      bounty.status = "expired";
      await Promise.all([
        bounty.save(),
        User.findByIdAndUpdate(bounty.placerId, { $inc: { dc: bounty.amount } }),
      ]);
      Notification.create({
        userId: String(bounty.placerId), type: "system",
        message: `Your ${bounty.amount.toLocaleString()} DC bounty on ${bounty.targetName} has expired and been refunded.`,
      }).catch(() => {});
    }
    if (expired.length > 0) {
      logger.info({ count: expired.length }, "Bounties expired and refunded");
    }
  } catch (err) {
    logger.error({ err }, "expireBounties error");
  }
}

export default router;
