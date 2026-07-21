import { Router } from "express";
import mongoose from "mongoose";
import PlayerTrade from "../models/PlayerTrade";
import Item from "../models/Item";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { notifyUser } from "../lib/notifyUser";
import { logger } from "../lib/logger";

const router = Router();

const TRADE_EXPIRY_HOURS = 24;

// ── GET /api/trade/search-player?q= — find a player by username for trade ──
router.get("/search-player", requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query["q"] ?? "").trim();
    if (q.length < 2) return res.json([]);
    const users = await User.find({
      username: { $regex: q, $options: "i" },
      _id: { $ne: req.userId },
    }).select("_id username level faction").limit(8).lean();
    res.json(users.map(u => ({ id: u._id, username: u.username, level: u.level, faction: u.faction })));
  } catch (err) {
    logger.error({ err }, "trade GET /search-player");
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/trade/pending — incoming + outgoing pending trades ──────────────
router.get("/pending", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trades = await PlayerTrade.find({
      $or: [{ initiatorId: req.userId }, { targetId: req.userId }],
      status: "pending",
    }).sort({ createdAt: -1 });

    res.json(
      trades.map((t) => ({
        id: t._id,
        initiator: { id: t.initiatorId, name: t.initiatorName },
        target: { id: t.targetId, name: t.targetName },
        initiatorOffer: t.initiatorOffer,
        targetOffer: t.targetOffer,
        status: t.status,
        expiresAt: t.expiresAt,
        isMine: t.initiatorId.equals(req.userId as string),
      }))
    );
  } catch (err) {
    logger.error({ err }, "trade GET /pending");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/trade/offer — create trade offer with escrow ──────────────────
router.post("/offer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      targetId,
      offerDc = 0,
      offerItemIds = [],
      requestDc = 0,
      requestItemIds = [],
    } = req.body as {
      targetId: string;
      offerDc?: number;
      offerItemIds?: string[];
      requestDc?: number;
      requestItemIds?: string[];
    };

    if (!targetId) return res.status(400).json({ message: "targetId required" });
    if (targetId === req.userId?.toString()) return res.status(400).json({ message: "Cannot trade with yourself" });
    if (offerDc < 0 || requestDc < 0) return res.status(400).json({ message: "DC amounts must be non-negative" });
    if (offerDc === 0 && requestDc === 0 && offerItemIds.length === 0 && requestItemIds.length === 0) {
      return res.status(400).json({ message: "Trade must include at least one item or DC" });
    }

    const [initiator, target] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);
    if (!initiator) return res.status(404).json({ message: "User not found" });
    if (!target) return res.status(404).json({ message: "Target player not found" });
    if (initiator.dc < offerDc) return res.status(400).json({ message: "Not enough DC to offer" });

    // Validate offered items — must be owned, not equipped, not market-listed, not inTrade
    const offerItems = offerItemIds.length > 0
      ? await Item.find({ _id: { $in: offerItemIds }, ownerId: req.userId })
      : [];
    if (offerItems.length !== offerItemIds.length) {
      return res.status(400).json({ message: "One or more offer items not in your inventory" });
    }
    const blockedOffer = offerItems.find(i => i.equipped || i.marketListed || (i as any).inTrade);
    if (blockedOffer) {
      return res.status(400).json({
        message: `${blockedOffer.name} is ${blockedOffer.equipped ? "equipped" : blockedOffer.marketListed ? "listed on market" : "already in a pending trade"} — remove it first`,
      });
    }

    // Validate requested items — must be owned by target
    const requestItems = requestItemIds.length > 0
      ? await Item.find({ _id: { $in: requestItemIds }, ownerId: targetId })
      : [];
    if (requestItems.length !== requestItemIds.length) {
      return res.status(400).json({ message: "One or more requested items not in target's inventory" });
    }

    // Max 5 pending outgoing offers at a time
    const existingPending = await PlayerTrade.countDocuments({
      initiatorId: req.userId,
      status: "pending",
    });
    if (existingPending >= 5) {
      return res.status(400).json({ message: "Max 5 pending trade offers at a time" });
    }

    // Escrow: deduct DC and lock items atomically
    if (offerDc > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: req.userId, dc: { $gte: offerDc } },
        { $inc: { dc: -offerDc } },
        { new: true }
      );
      if (!updated) return res.status(400).json({ message: "Insufficient DC — balance changed" });
    }
    if (offerItems.length > 0) {
      await Item.updateMany(
        { _id: { $in: offerItems.map(i => i._id) } },
        { $set: { inTrade: true } }
      );
    }

    const trade = await PlayerTrade.create({
      initiatorId: initiator._id,
      initiatorName: initiator.username,
      targetId: target._id,
      targetName: target.username,
      initiatorOffer: {
        dc: offerDc,
        itemIds: offerItems.map((i) => i._id),
        itemNames: offerItems.map((i) => i.name),
      },
      targetOffer: {
        dc: requestDc,
        itemIds: requestItems.map((i) => i._id),
        itemNames: requestItems.map((i) => i.name),
      },
      expiresAt: new Date(Date.now() + TRADE_EXPIRY_HOURS * 3_600_000),
    });

    await notifyUser({
      userId: target._id,
      type: "general",
      message: `${initiator.username} sent you a trade offer`,
      link: "/trade",
      push: { title: "🤝 Trade Offer", body: `${initiator.username} wants to trade with you` },
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${target._id}`).emit("trade_offer", {
        tradeId: trade._id,
        fromUsername: initiator.username,
      });
    }

    res.status(201).json({ message: "Trade offer sent", tradeId: trade._id });
  } catch (err) {
    logger.error({ err }, "trade POST /offer");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/trade/:id/accept — accept trade with atomic swap ───────────────
router.post("/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found or not pending" });
    if (!trade.targetId.equals(req.userId as string)) {
      return res.status(403).json({ message: "Only the trade recipient can accept" });
    }
    if (new Date() > trade.expiresAt) {
      await _releaseInitiatorEscrow(trade);
      trade.status = "cancelled";
      await trade.save();
      return res.status(400).json({ message: "Trade offer has expired" });
    }

    if (trade.targetOffer.dc > 0) {
      const target = await User.findById(trade.targetId).select("dc");
      if (!target || target.dc < trade.targetOffer.dc) {
        return res.status(400).json({ message: "You don't have enough DC" });
      }
    }

    const targetItems = trade.targetOffer.itemIds.length > 0
      ? await Item.find({ _id: { $in: trade.targetOffer.itemIds }, ownerId: trade.targetId })
      : [];
    if (targetItems.length !== trade.targetOffer.itemIds.length) {
      return res.status(400).json({ message: "Some of the requested items are no longer in your inventory" });
    }
    const blockedTarget = targetItems.find(i => i.equipped || i.marketListed || (i as any).inTrade);
    if (blockedTarget) {
      return res.status(400).json({
        message: `${blockedTarget.name} is ${blockedTarget.equipped ? "equipped" : blockedTarget.marketListed ? "market-listed" : "in another trade"} — remove it first`,
      });
    }

    const initiatorItems = trade.initiatorOffer.itemIds.length > 0
      ? await Item.find({ _id: { $in: trade.initiatorOffer.itemIds }, ownerId: trade.initiatorId })
      : [];
    if (initiatorItems.length !== trade.initiatorOffer.itemIds.length) {
      return res.status(400).json({ message: "Some offered items are no longer available — the offer may be invalid" });
    }

    if (trade.targetOffer.dc > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: trade.targetId, dc: { $gte: trade.targetOffer.dc } },
        { $inc: { dc: -trade.targetOffer.dc } }
      );
      if (!updated) return res.status(400).json({ message: "Insufficient DC — try again" });
    }

    await Promise.all([
      ...initiatorItems.map(item =>
        Item.findByIdAndUpdate(item._id, { $set: { ownerId: trade.targetId, owner: trade.targetId, inTrade: false } })
      ),
      ...targetItems.map(item =>
        Item.findByIdAndUpdate(item._id, { $set: { ownerId: trade.initiatorId, owner: trade.initiatorId } })
      ),
    ]);

    const dcUpdates: Promise<unknown>[] = [];
    if (trade.initiatorOffer.dc > 0) {
      dcUpdates.push(User.findByIdAndUpdate(trade.targetId, { $inc: { dc: trade.initiatorOffer.dc } }));
    }
    if (trade.targetOffer.dc > 0) {
      dcUpdates.push(User.findByIdAndUpdate(trade.initiatorId, { $inc: { dc: trade.targetOffer.dc } }));
    }
    await Promise.all(dcUpdates);

    trade.status = "completed";
    await trade.save();

    await notifyUser({
      userId: trade.initiatorId,
      type: "general",
      message: `Trade with ${trade.targetName} completed successfully`,
      link: "/trade",
      push: { title: "✅ Trade Completed", body: `Your trade with ${trade.targetName} went through` },
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${trade.initiatorId}`).emit("trade_completed", { tradeId: trade._id, withUsername: trade.targetName });
      io.to(`user:${trade.targetId}`).emit("trade_completed", { tradeId: trade._id, withUsername: trade.initiatorName });
    }

    res.json({ message: "Trade completed successfully" });
  } catch (err) {
    logger.error({ err }, "trade POST /:id/accept");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/trade/:id/decline — decline trade ──────────────────────────────
router.post("/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found" });
    if (!trade.targetId.equals(req.userId as string)) {
      return res.status(403).json({ message: "Only the recipient can decline" });
    }

    await _releaseInitiatorEscrow(trade);
    trade.status = "declined";
    await trade.save();

    await notifyUser({
      userId: trade.initiatorId,
      type: "general",
      message: `${trade.targetName} declined your trade offer`,
      link: "/trade",
      push: { title: "Trade Declined", body: `${trade.targetName} declined your trade offer` },
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${trade.initiatorId}`).emit("trade_declined", { tradeId: trade._id });
    }

    res.json({ message: "Trade declined" });
  } catch (err) {
    logger.error({ err }, "trade POST /:id/decline");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/trade/:id/cancel — cancel (initiator only) ─────────────────────
router.post("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found" });
    if (!trade.initiatorId.equals(req.userId as string)) {
      return res.status(403).json({ message: "Only the sender can cancel" });
    }

    await _releaseInitiatorEscrow(trade);
    trade.status = "cancelled";
    await trade.save();

    res.json({ message: "Trade cancelled" });
  } catch (err) {
    logger.error({ err }, "trade POST /:id/cancel");
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/trade/:id/counter — counter with new terms ─────────────────────
router.post("/:id/counter", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      offerDc = 0,
      offerItemIds = [],
      requestDc = 0,
      requestItemIds = [],
    } = req.body as {
      offerDc?: number;
      offerItemIds?: string[];
      requestDc?: number;
      requestItemIds?: string[];
    };

    const original = await PlayerTrade.findById(req.params.id);
    if (!original || original.status !== "pending") {
      return res.status(404).json({ message: "Trade not found or not pending" });
    }
    if (!original.targetId.equals(req.userId as string)) {
      return res.status(403).json({ message: "Only the recipient can counter" });
    }

    const [counterUser, originalInitiator] = await Promise.all([
      User.findById(req.userId),
      User.findById(original.initiatorId),
    ]);
    if (!counterUser || !originalInitiator) return res.status(404).json({ message: "Users not found" });
    if (counterUser.dc < offerDc) return res.status(400).json({ message: "Not enough DC to offer in counter" });

    const counterOfferItems = offerItemIds.length > 0
      ? await Item.find({ _id: { $in: offerItemIds }, ownerId: req.userId })
      : [];
    if (counterOfferItems.length !== offerItemIds.length) {
      return res.status(400).json({ message: "One or more counter-offer items not in your inventory" });
    }
    const blockedCounter = counterOfferItems.find(i => i.equipped || i.marketListed || (i as any).inTrade);
    if (blockedCounter) {
      return res.status(400).json({
        message: `${blockedCounter.name} is ${blockedCounter.equipped ? "equipped" : blockedCounter.marketListed ? "market-listed" : "in another trade"} — remove it first`,
      });
    }
    const counterRequestItems = requestItemIds.length > 0
      ? await Item.find({ _id: { $in: requestItemIds }, ownerId: original.initiatorId })
      : [];
    if (counterRequestItems.length !== requestItemIds.length) {
      return res.status(400).json({ message: "One or more requested items not in original sender's inventory" });
    }

    // Release original initiator's escrow and cancel original
    await _releaseInitiatorEscrow(original);
    original.status = "declined";
    await original.save();

    // Escrow counter-offerer's DC and lock their items
    if (offerDc > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: req.userId, dc: { $gte: offerDc } },
        { $inc: { dc: -offerDc } }
      );
      if (!updated) return res.status(400).json({ message: "Insufficient DC — balance changed" });
    }
    if (counterOfferItems.length > 0) {
      await Item.updateMany(
        { _id: { $in: counterOfferItems.map(i => i._id) } },
        { $set: { inTrade: true } }
      );
    }

    const counterTrade = await PlayerTrade.create({
      initiatorId: counterUser._id,
      initiatorName: counterUser.username,
      targetId: originalInitiator._id,
      targetName: originalInitiator.username,
      initiatorOffer: {
        dc: offerDc,
        itemIds: counterOfferItems.map(i => i._id),
        itemNames: counterOfferItems.map(i => i.name),
      },
      targetOffer: {
        dc: requestDc,
        itemIds: counterRequestItems.map(i => i._id),
        itemNames: counterRequestItems.map(i => i.name),
      },
      expiresAt: new Date(Date.now() + TRADE_EXPIRY_HOURS * 3_600_000),
    });

    await notifyUser({
      userId: originalInitiator._id,
      type: "general",
      message: `${counterUser.username} countered your trade offer`,
      link: "/trade",
      push: { title: "🔄 Trade Counter", body: `${counterUser.username} sent you a counter-offer` },
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${originalInitiator._id}`).emit("trade_offer", {
        tradeId: counterTrade._id,
        fromUsername: counterUser.username,
        isCounter: true,
      });
    }

    res.status(201).json({ message: "Counter-offer sent", tradeId: counterTrade._id });
  } catch (err) {
    logger.error({ err }, "trade POST /:id/counter");
    res.status(500).json({ message: "Server error" });
  }
});

// ── Helper: release initiator's escrowed DC and unlock their items ────────────
async function _releaseInitiatorEscrow(trade: InstanceType<typeof PlayerTrade>): Promise<void> {
  if (trade.initiatorOffer.dc > 0) {
    await User.findByIdAndUpdate(trade.initiatorId, { $inc: { dc: trade.initiatorOffer.dc } });
  }
  if (trade.initiatorOffer.itemIds.length > 0) {
    await Item.updateMany(
      { _id: { $in: trade.initiatorOffer.itemIds } },
      { $set: { inTrade: false } }
    );
  }
}

export default router;
