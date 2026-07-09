import { Router } from "express";
import BlackMarketListing from "../models/BlackMarketListing";
import Item from "../models/Item";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const SEIZURE_CHANCE = 0.05; // 5% per 6h window

// Seizure background job — runs every 6 hours
setInterval(async () => {
  try {
    const now = new Date();
    const due = await BlackMarketListing.find({
      status: "active",
      seizureCheckAt: { $lte: now },
    });

    for (const listing of due) {
      if (Math.random() < SEIZURE_CHANCE) {
        listing.status = "seized";
        await listing.save();
        // Notify seller
        await Notification.create({
          userId: listing.sellerId,
          type: "system",
          message: `Your black market listing "${listing.name}" was seized by law enforcement.`,
        });
      } else {
        // Reset check to +6h
        listing.seizureCheckAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
        await listing.save();
      }
    }
  } catch {
    // Non-critical; ignore errors in background job
  }
}, 6 * 60 * 60 * 1000);

// GET /api/black-market/listings
router.get("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const listings = await BlackMarketListing.find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(listings.map(l => ({
      id: l._id,
      name: l.name,
      type: l.type,
      rarity: l.rarity,
      strengthBonus: l.strengthBonus,
      charismaBonus: l.charismaBonus,
      intelligenceBonus: l.intelligenceBonus,
      streetCredBonus: l.streetCredBonus,
      travelTimeReduction: l.travelTimeReduction,
      description: l.description,
      price: l.price,
      seller: "Anonymous",
      imageUrl: l.imageUrl ?? null,
      expiresAt: l.expiresAt,
      seizureCheckAt: l.seizureCheckAt,
    })));
  } catch (err: any) {
    req.log.error({ err }, "black-market listings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/black-market/listings
router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("level");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.level < 20) return res.status(403).json({ message: "Black market requires level 20+" });

    const { itemId, price } = req.body;
    if (!itemId || !price || Number(price) < 1) return res.status(400).json({ message: "itemId and price required" });

    const item = await Item.findOne({ _id: itemId, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip the item first" });
    if (item.marketListed) return res.status(400).json({ message: "Already listed on regular market" });
    if (item.type === "consumable" || item.type === "material") return res.status(400).json({ message: "Cannot list consumables or materials" });

    const now = Date.now();
    const listing = await BlackMarketListing.create({
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      slot: item.slot ?? null,
      strengthBonus: item.strengthBonus ?? 0,
      charismaBonus: item.charismaBonus ?? 0,
      intelligenceBonus: item.intelligenceBonus ?? 0,
      streetCredBonus: item.streetCredBonus ?? 0,
      travelTimeReduction: item.travelTimeReduction ?? 0,
      effect: item.effect ?? null,
      description: item.description,
      basePrice: item.basePrice ?? 0,
      imageUrl: item.imageUrl ?? null,
      price: Number(price),
      sellerId: req.userId,
      itemId: item._id,
      status: "active",
      expiresAt: new Date(now + 48 * 60 * 60 * 1000),
      seizureCheckAt: new Date(now + 6 * 60 * 60 * 1000),
    });

    // Mark the source item as "held" — not yet transferred; held until sale or expiry
    item.marketListed = true;
    item.marketPrice = Number(price);
    item.marketListedAt = new Date();
    await item.save();

    res.status(201).json({ message: `${item.name} listed anonymously on the black market`, listingId: listing._id });
  } catch (err: any) {
    req.log.error({ err }, "black-market list error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/black-market/listings/:id/buy
router.post("/listings/:id/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Atomically claim listing
    const listing = await BlackMarketListing.findOneAndUpdate(
      { _id: req.params.id, status: "active" },
      { $set: { status: "sold" } },
      { new: false },
    );
    if (!listing) return res.status(404).json({ message: "Listing not found or already sold" });

    if (listing.sellerId.equals(req.userId as string)) {
      // Reverse
      await BlackMarketListing.findByIdAndUpdate(listing._id, { $set: { status: "active" } });
      return res.status(400).json({ message: "Cannot buy your own listing" });
    }

    const price = listing.price;

    // Deduct buyer
    const buyer = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: price } },
      { $inc: { dc: -price } },
      { new: true },
    );
    if (!buyer) {
      await BlackMarketListing.findByIdAndUpdate(listing._id, { $set: { status: "active" } });
      return res.status(400).json({ message: `Not enough DC. Price: ${price.toLocaleString()} DC` });
    }

    // Credit seller (full payout — no commission)
    await User.findByIdAndUpdate(listing.sellerId, { $inc: { dc: price } });

    // Transfer item ownership
    await Item.findByIdAndUpdate(listing.itemId, {
      $set: { owner: buyer._id, marketListed: false, marketPrice: null, marketListedAt: null, equipped: false },
    });

    res.json({ message: `Purchased ${listing.name} for ${price.toLocaleString()} DC`, dc: buyer.dc });
  } catch (err: any) {
    req.log.error({ err }, "black-market buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
