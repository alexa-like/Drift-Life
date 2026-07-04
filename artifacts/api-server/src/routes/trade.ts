import { Router } from "express";
import mongoose from "mongoose";
import PlayerTrade from "../models/PlayerTrade";
import Item from "../models/Item";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const TRADE_EXPIRY_HOURS = 24;

// GET /api/trade/pending — my pending trades (sent + received)
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
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/trade/offer — create trade offer
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

    const [initiator, target] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);
    if (!initiator) return res.status(404).json({ message: "User not found" });
    if (!target) return res.status(404).json({ message: "Target player not found" });
    if (offerDc > initiator.dc) return res.status(400).json({ message: "Not enough DC in your offer" });

    const offerItems = offerItemIds.length > 0
      ? await Item.find({ _id: { $in: offerItemIds }, ownerId: req.userId })
      : [];
    if (offerItems.length !== offerItemIds.length)
      return res.status(400).json({ message: "One or more offer items not in your inventory" });

    const requestItems = requestItemIds.length > 0
      ? await Item.find({ _id: { $in: requestItemIds }, ownerId: targetId })
      : [];
    if (requestItems.length !== requestItemIds.length)
      return res.status(400).json({ message: "One or more requested items not in target's inventory" });

    const existingPending = await PlayerTrade.countDocuments({
      initiatorId: req.userId,
      status: "pending",
    });
    if (existingPending >= 5)
      return res.status(400).json({ message: "Max 5 pending trade offers at a time" });

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

    await Notification.create({
      userId: target._id,
      type: "system",
      message: `${initiator.username} sent you a trade offer`,
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
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/trade/:id/accept — accept trade
router.post("/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found or not pending" });
    if (!trade.targetId.equals(req.userId as string))
      return res.status(403).json({ message: "Only the trade recipient can accept" });
    if (new Date() > trade.expiresAt) {
      trade.status = "cancelled";
      await trade.save();
      return res.status(400).json({ message: "Trade offer has expired" });
    }

    const [initiator, target] = await Promise.all([
      User.findById(trade.initiatorId),
      User.findById(trade.targetId),
    ]);
    if (!initiator || !target) return res.status(404).json({ message: "Users not found" });

    if (initiator.dc < trade.initiatorOffer.dc)
      return res.status(400).json({ message: "Initiator no longer has enough DC" });
    if (target.dc < trade.targetOffer.dc)
      return res.status(400).json({ message: "You don't have enough DC" });

    const initiatorItems = trade.initiatorOffer.itemIds.length > 0
      ? await Item.find({ _id: { $in: trade.initiatorOffer.itemIds }, ownerId: initiator._id })
      : [];
    const targetItems = trade.targetOffer.itemIds.length > 0
      ? await Item.find({ _id: { $in: trade.targetOffer.itemIds }, ownerId: target._id })
      : [];

    if (initiatorItems.length !== trade.initiatorOffer.itemIds.length)
      return res.status(400).json({ message: "Some items are no longer available in initiator's inventory" });
    if (targetItems.length !== trade.targetOffer.itemIds.length)
      return res.status(400).json({ message: "Some items are no longer available in your inventory" });

    initiator.dc -= trade.initiatorOffer.dc;
    initiator.dc += trade.targetOffer.dc;
    target.dc -= trade.targetOffer.dc;
    target.dc += trade.initiatorOffer.dc;

    for (const item of initiatorItems) {
      item.ownerId = target._id as unknown as typeof item.ownerId;
      await item.save();
    }
    for (const item of targetItems) {
      item.ownerId = initiator._id as unknown as typeof item.ownerId;
      await item.save();
    }

    trade.status = "completed";
    await Promise.all([initiator.save(), target.save(), trade.save()]);

    await Notification.create({
      userId: initiator._id,
      type: "system",
      message: `Trade with ${target.username} completed`,
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${initiator._id}`).emit("trade_completed", { tradeId: trade._id, withUsername: target.username });
      io.to(`user:${target._id}`).emit("trade_completed", { tradeId: trade._id, withUsername: initiator.username });
    }

    res.json({ message: "Trade completed successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/trade/:id/decline — decline trade
router.post("/:id/decline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found" });
    if (!trade.targetId.equals(req.userId as string) && !trade.initiatorId.equals(req.userId as string))
      return res.status(403).json({ message: "Not your trade" });

    trade.status = "declined";
    await trade.save();

    const otherId = trade.targetId.equals(req.userId as string) ? trade.initiatorId : trade.targetId;
    await Notification.create({
      userId: otherId,
      type: "system",
      message: `Your trade offer was declined`,
    });

    const io = req.app.locals["io"];
    if (io) {
      io.to(`user:${otherId}`).emit("trade_declined", { tradeId: trade._id });
    }

    res.json({ message: "Trade declined" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/trade/:id/cancel — cancel (initiator only)
router.post("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const trade = await PlayerTrade.findById(req.params.id);
    if (!trade || trade.status !== "pending") return res.status(404).json({ message: "Trade not found" });
    if (!trade.initiatorId.equals(req.userId as string)) return res.status(403).json({ message: "Only the sender can cancel" });

    trade.status = "cancelled";
    await trade.save();
    res.json({ message: "Trade cancelled" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
