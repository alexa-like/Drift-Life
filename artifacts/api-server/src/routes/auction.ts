import { Router } from "express";
import mongoose from "mongoose";
import AuctionListing from "../models/AuctionListing";
import MiniGameItem from "../models/MiniGameItem";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { auctionBidSchema } from "../lib/schemas";
import { logger } from "../lib/logger";
import { postToSystemFeed } from "../lib/systemFeed";

const router = Router();

const SNIPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_AUCTIONS = 5;
const MIN_BID_BY_TIER: Record<"epic" | "legendary", number> = {
  epic: 50_000,
  legendary: 200_000,
};
const AMMO_GRANT_QTY = 50;

const WEAPON_CATEGORIES = new Set(["pistol", "smg", "assault_rifle", "shotgun", "sniper_rifle", "lmg"]);
const AMMO_CATEGORIES = new Set([
  "pistol_rounds", "smg_rounds", "rifle_rounds", "shotgun_shells", "sniper_rounds", "lmg_rounds",
]);

// ── Bot Auction Generation ────────────────────────────────────────────────────
export async function generateBotAuction(): Promise<void> {
  try {
    const activeCount = await AuctionListing.countDocuments({ status: "active" });
    if (activeCount >= MAX_CONCURRENT_AUCTIONS) return;

    const activeItemIds = (await AuctionListing.find({ status: "active" }).select("itemId")).map((l) => l.itemId);
    const tier: "epic" | "legendary" = Math.random() < 0.7 ? "epic" : "legendary";

    const candidates = await MiniGameItem.find({
      tier,
      isActive: true,
      itemId: { $nin: activeItemIds },
    });
    if (candidates.length === 0) return;

    const item = candidates[Math.floor(Math.random() * candidates.length)];
    const minimumBid = MIN_BID_BY_TIER[tier];
    const bidIncrement = Math.max(100, Math.floor(minimumBid * 0.01));
    const durationMs = 30 * 60_000 + Math.floor(Math.random() * (23.5 * 60 * 60_000));

    await AuctionListing.create({
      itemId: item.itemId,
      itemName: item.name,
      itemCategory: item.category,
      itemTier: tier,
      itemImage: item.imageCard || null,
      currentBid: 0,
      currentBidderId: null,
      currentBidderName: null,
      minimumBid,
      bidIncrement,
      expiresAt: new Date(Date.now() + durationMs),
      status: "active",
      bids: [],
    });

    logger.info({ itemId: item.itemId, tier }, "generateBotAuction: created new bot auction");

    // Tier 8 §8.2 — announce every new auction listing as it goes live
    postToSystemFeed(
      "auction_listing",
      `:hammer: New ${tier === "legendary" ? "Legendary" : "Epic"} auction just went live — ${item.name}! Bid now at /auction`,
    ).catch(() => {});
  } catch (err) {
    logger.error({ err }, "generateBotAuction: error");
  }
}

let botAuctionTimer: NodeJS.Timeout | null = null;

export function scheduleBotAuctions(): void {
  const runAndReschedule = async () => {
    await generateBotAuction();
    const delayMs = 30 * 60_000 + Math.floor(Math.random() * 90 * 60_000);
    botAuctionTimer = setTimeout(runAndReschedule, delayMs);
  };
  // Kick off the first auction shortly after startup, then continue on a random cadence.
  botAuctionTimer = setTimeout(runAndReschedule, 10_000);
}

export function stopBotAuctions(): void {
  if (botAuctionTimer) {
    clearTimeout(botAuctionTimer);
    botAuctionTimer = null;
  }
}

// ── Item Delivery ──────────────────────────────────────────────────────────────
async function grantItemToInventory(userId: mongoose.Types.ObjectId | string, itemDef: InstanceType<typeof MiniGameItem>): Promise<void> {
  const category = itemDef.category;

  if (WEAPON_CATEGORIES.has(category)) {
    const slot = itemDef.weaponSlot === "secondary" ? "secondaryWeapons" : "primaryWeapons";
    await PlayerMiniGameInventory.findOneAndUpdate(
      { userId },
      {
        $push: { [slot]: { itemId: itemDef.itemId, durability: itemDef.maxDurability ?? 100 } },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    return;
  }

  if (category === "body_armor") {
    await PlayerMiniGameInventory.findOneAndUpdate(
      { userId },
      {
        $push: { bodyArmors: { itemId: itemDef.itemId, durability: itemDef.maxDurability ?? 100 } },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    return;
  }

  if (category === "consumable") {
    const inv = await PlayerMiniGameInventory.findOneAndUpdate(
      { userId, "consumables.itemId": itemDef.itemId },
      { $inc: { "consumables.$.quantity": 1 } },
      { returnDocument: 'after' },
    );
    if (!inv) {
      await PlayerMiniGameInventory.findOneAndUpdate(
        { userId },
        {
          $push: { consumables: { itemId: itemDef.itemId, quantity: 1 } },
          $setOnInsert: { userId },
        },
        { upsert: true },
      );
    }
    return;
  }

  if (AMMO_CATEGORIES.has(category)) {
    await PlayerMiniGameInventory.findOneAndUpdate(
      { userId },
      {
        $inc: { [`ammo.${category}`]: AMMO_GRANT_QTY },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    return;
  }

  logger.warn({ category, itemId: itemDef.itemId }, "grantItemToInventory: unknown category, item not delivered");
}

// ── Auction Auto-Close ────────────────────────────────────────────────────────
export async function closeExpiredAuctions(): Promise<void> {
  try {
    const now = new Date();
    const expired = await AuctionListing.find({ status: "active", expiresAt: { $lte: now } });

    for (const listing of expired) {
      try {
        if (listing.currentBidderId) {
          listing.status = "sold";
          await listing.save();

          const itemDef = await MiniGameItem.findOne({ itemId: listing.itemId });
          if (itemDef) {
            await grantItemToInventory(listing.currentBidderId, itemDef);
          } else {
            logger.error({ itemId: listing.itemId }, "closeExpiredAuctions: item definition missing, cannot deliver");
          }

          await Notification.create({
            userId: listing.currentBidderId,
            type: "system",
            message: `You won the auction for "${listing.itemName}" with a bid of ${listing.currentBid.toLocaleString()} DC! Check your inventory.`,
          });
        } else {
          listing.status = "expired";
          await listing.save();
        }
      } catch (err) {
        logger.error({ err, listingId: listing._id }, "closeExpiredAuctions: error processing listing");
      }
    }
  } catch (err) {
    logger.error({ err }, "closeExpiredAuctions: query error");
  }
}

// GET /api/auction — list active auctions
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const listings = await AuctionListing.find({ status: "active", expiresAt: { $gt: now } })
      .sort({ expiresAt: 1 })
      .limit(50);

    res.json(listings.map((l) => ({
      id: l._id,
      itemId: l.itemId,
      itemName: l.itemName,
      itemCategory: l.itemCategory,
      itemTier: l.itemTier,
      itemImage: l.itemImage,
      currentBid: l.currentBid,
      currentBidder: l.currentBidderName,
      minimumBid: l.minimumBid,
      nextMinBid: l.currentBid > 0 ? l.currentBid + l.bidIncrement : l.minimumBid,
      bidIncrement: l.bidIncrement,
      expiresAt: l.expiresAt,
      bidCount: l.bids.length,
      isWinning: l.currentBidderId ? l.currentBidderId.equals(req.userId as string) : false,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auction/:id/bid — place a bid
router.post("/:id/bid", requireAuth, validateBody(auctionBidSchema), async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };

    const listing = await AuctionListing.findById(req.params.id);
    if (!listing || listing.status !== "active") return res.status(404).json({ message: "Listing not found or closed" });
    if (new Date() > listing.expiresAt) return res.status(400).json({ message: "Auction has ended" });

    const minBid = listing.currentBid > 0 ? listing.currentBid + listing.bidIncrement : listing.minimumBid;
    if (amount < minBid) return res.status(400).json({ message: `Minimum bid is ${minBid.toLocaleString()} DC` });

    if (listing.currentBidderId && listing.currentBidderId.equals(req.userId as string)) {
      return res.status(400).json({ message: "You are already the highest bidder" });
    }

    // Atomically deduct DC from the new bidder, guarding against insufficient funds.
    const bidder = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: amount } },
      { $inc: { dc: -amount } },
      { returnDocument: 'after' },
    );
    if (!bidder) return res.status(400).json({ message: "Not enough DC" });

    const previousBidderId = listing.currentBidderId;
    const previousBid = listing.currentBid;

    // Claim the bid slot with optimistic concurrency keyed on the prior currentBid,
    // so two simultaneous bids can't both succeed against stale state.
    const remaining = listing.expiresAt.getTime() - Date.now();
    const newExpiresAt = remaining < SNIPE_WINDOW_MS ? new Date(Date.now() + SNIPE_WINDOW_MS) : listing.expiresAt;

    const updated = await AuctionListing.findOneAndUpdate(
      { _id: listing._id, status: "active", currentBid: previousBid },
      {
        $set: {
          currentBid: amount,
          currentBidderId: bidder._id,
          currentBidderName: bidder.username,
          expiresAt: newExpiresAt,
        },
        $push: { bids: { bidderId: bidder._id, bidderName: bidder.username, amount, timestamp: new Date() } },
      },
      { returnDocument: 'after' },
    );

    if (!updated) {
      // Lost the race — refund and reject.
      await User.findByIdAndUpdate(bidder._id, { $inc: { dc: amount } });
      return res.status(409).json({ message: "Someone else just bid — try again" });
    }

    if (previousBidderId && !previousBidderId.equals(bidder._id as unknown as string)) {
      await User.findByIdAndUpdate(previousBidderId, { $inc: { dc: previousBid } });
      await Notification.create({
        userId: previousBidderId,
        type: "system",
        message: `You were outbid on "${listing.itemName}". Your ${previousBid.toLocaleString()} DC was refunded.`,
      });
      const io = req.app.locals["io"];
      if (io) {
        io.to(`user:${previousBidderId}`).emit("auction_outbid", {
          listingId: listing._id,
          itemName: listing.itemName,
          newBid: amount,
        });
      }
    }

    res.json({
      message: `Bid of ${amount.toLocaleString()} DC placed`,
      currentBid: updated.currentBid,
      expiresAt: updated.expiresAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
