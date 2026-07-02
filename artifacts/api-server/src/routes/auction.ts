import { Router } from "express";
import AuctionListing from "../models/AuctionListing";
import Item from "../models/Item";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const SELLER_FEE = 0.05;
const SNIPE_WINDOW_MS = 5 * 60 * 1000;

// GET /api/auction — list active auctions
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const listings = await AuctionListing.find({ status: "active", endsAt: { $gt: now } })
      .sort({ endsAt: 1 })
      .limit(50);

    res.json(listings.map((l) => ({
      id: l._id,
      seller: { id: l.sellerId, name: l.sellerName },
      item: l.itemSnapshot,
      startingPrice: l.startingPrice,
      currentBid: l.currentBid,
      currentBidder: l.currentBidderName,
      buyoutPrice: l.buyoutPrice,
      endsAt: l.endsAt,
      bidCount: l.bids.length,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auction/mine — my listings and won items
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [myListings, wonAuctions] = await Promise.all([
      AuctionListing.find({ sellerId: req.userId }).sort({ createdAt: -1 }).limit(20),
      AuctionListing.find({ currentBidderId: req.userId, status: "sold" }).sort({ updatedAt: -1 }).limit(20),
    ]);

    res.json({
      listings: myListings.map((l) => ({
        id: l._id,
        item: l.itemSnapshot,
        currentBid: l.currentBid,
        buyoutPrice: l.buyoutPrice,
        endsAt: l.endsAt,
        status: l.status,
        bidCount: l.bids.length,
      })),
      won: wonAuctions.map((l) => ({
        id: l._id,
        item: l.itemSnapshot,
        finalBid: l.currentBid,
        soldAt: l.updatedAt,
        itemId: l.itemId,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auction/list — create an auction listing
router.post("/list", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, startingPrice, buyoutPrice, durationHours } = req.body as {
      itemId: string;
      startingPrice: number;
      buyoutPrice?: number;
      durationHours: number;
    };

    if (!itemId || !startingPrice || !durationHours)
      return res.status(400).json({ message: "itemId, startingPrice, and durationHours required" });
    if (startingPrice < 1) return res.status(400).json({ message: "Starting price must be at least 1 DC" });
    if (durationHours < 1 || durationHours > 72) return res.status(400).json({ message: "Duration must be 1-72 hours" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.level < 25) return res.status(400).json({ message: "Auction House unlocks at level 25" });

    const item = await Item.findOne({ _id: itemId, ownerId: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found in your inventory" });

    const isEquipped =
      user.equippedWeapon?.equals(item._id) ||
      user.equippedArmor?.equals(item._id) ||
      user.equippedClothing?.equals(item._id) ||
      user.equippedVehicle?.equals(item._id);
    if (isEquipped) return res.status(400).json({ message: "Unequip the item before listing it" });

    const listing = await AuctionListing.create({
      sellerId: user._id,
      sellerName: user.username,
      itemId: item._id,
      itemSnapshot: {
        name: item.name,
        type: item.type,
        rarity: item.rarity || "common",
        description: item.description || "",
        iconUrl: item.iconUrl || null,
      },
      startingPrice,
      currentBid: 0,
      buyoutPrice: buyoutPrice ?? null,
      endsAt: new Date(Date.now() + durationHours * 3_600_000),
    });

    item.auctionId = listing._id as unknown as typeof item.auctionId;
    await item.save();

    res.status(201).json({ message: "Listing created", listingId: listing._id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auction/:id/bid — place a bid
router.post("/:id/bid", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1) return res.status(400).json({ message: "Invalid bid amount" });

    const listing = await AuctionListing.findById(req.params.id);
    if (!listing || listing.status !== "active") return res.status(404).json({ message: "Listing not found or closed" });
    if (new Date() > listing.endsAt) return res.status(400).json({ message: "Auction has ended" });
    if (listing.sellerId.equals(req.userId as string)) return res.status(400).json({ message: "Cannot bid on your own auction" });

    const minBid = listing.currentBid > 0 ? listing.currentBid + 1 : listing.startingPrice;
    if (amount < minBid) return res.status(400).json({ message: `Minimum bid is ${minBid.toLocaleString()} DC` });

    const bidder = await User.findById(req.userId);
    if (!bidder) return res.status(404).json({ message: "User not found" });
    if (bidder.dc < amount) return res.status(400).json({ message: "Not enough DC" });

    const previousBidderId = listing.currentBidderId;
    const previousBid = listing.currentBid;

    bidder.dc -= amount;

    if (previousBidderId && !previousBidderId.equals(req.userId as string)) {
      const prevBidder = await User.findById(previousBidderId);
      if (prevBidder) {
        prevBidder.dc += previousBid;
        await prevBidder.save();
        await Notification.create({
          userId: prevBidder._id,
          type: "system",
          message: `You were outbid on "${listing.itemSnapshot.name}". Your ${previousBid.toLocaleString()} DC was refunded.`,
        });
      }
    }

    listing.currentBid = amount;
    listing.currentBidderId = bidder._id;
    listing.currentBidderName = bidder.username;
    listing.bids.push({ bidderId: bidder._id, bidderName: bidder.username, amount, placedAt: new Date() });

    const remaining = listing.endsAt.getTime() - Date.now();
    if (remaining < SNIPE_WINDOW_MS) {
      listing.endsAt = new Date(Date.now() + SNIPE_WINDOW_MS);
    }

    const isBuyout = listing.buyoutPrice && amount >= listing.buyoutPrice;
    if (isBuyout) {
      listing.status = "sold";
      const feeAmount = Math.floor(amount * SELLER_FEE);
      const sellerProfit = amount - feeAmount;
      await User.findByIdAndUpdate(listing.sellerId, { $inc: { dc: sellerProfit } });
      await Notification.create({
        userId: listing.sellerId,
        type: "system",
        message: `Your "${listing.itemSnapshot.name}" sold via buyout for ${amount.toLocaleString()} DC (fee: ${feeAmount.toLocaleString()} DC)`,
      });
      await Item.findByIdAndUpdate(listing.itemId, { owner: bidder._id, auctionId: null });
    }

    await Promise.all([bidder.save(), listing.save()]);

    res.json({
      message: isBuyout ? "Buyout! Item is yours." : `Bid of ${amount.toLocaleString()} DC placed`,
      currentBid: listing.currentBid,
      endsAt: listing.endsAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auction/:id/cancel — cancel listing (seller only, no bids)
router.post("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await AuctionListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (!listing.sellerId.equals(req.userId as string)) return res.status(403).json({ message: "Not your listing" });
    if (listing.status !== "active") return res.status(400).json({ message: "Listing is not active" });
    if (listing.bids.length > 0) return res.status(400).json({ message: "Cannot cancel after bids have been placed" });

    listing.status = "cancelled";
    await listing.save();

    await Item.findByIdAndUpdate(listing.itemId, { auctionId: null });

    res.json({ message: "Listing cancelled and item returned to inventory" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
