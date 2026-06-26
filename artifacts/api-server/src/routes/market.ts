import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const SHOP_ITEMS = [
  { id: "rusty-blade", name: "Rusty Blade", type: "weapon" as const, rarity: "common" as const, damage: 5, defense: 0, slot: "weapon" as const, price: 300, description: "A dull street knife. Better than fists." },
  { id: "shock-glove", name: "Shock Glove", type: "weapon" as const, rarity: "uncommon" as const, damage: 12, defense: 0, slot: "weapon" as const, price: 800, description: "Electrified knuckles. Stings a bit." },
  { id: "neural-cutter", name: "Neural Cutter", type: "weapon" as const, rarity: "rare" as const, damage: 22, defense: 0, slot: "weapon" as const, price: 2000, description: "Monofilament blade with haptic feedback." },
  { id: "leather-coat", name: "Leather Coat", type: "armor" as const, rarity: "common" as const, damage: 0, defense: 4, slot: "armor" as const, price: 250, description: "Thick synth-leather. Basic protection." },
  { id: "kevlar-vest", name: "Kevlar Vest", type: "armor" as const, rarity: "uncommon" as const, damage: 0, defense: 10, slot: "armor" as const, price: 900, description: "Standard corporate-issue body armor." },
  { id: "subdermal-plating", name: "Subdermal Plating", type: "armor" as const, rarity: "rare" as const, damage: 0, defense: 20, slot: "armor" as const, price: 2500, description: "Titanium mesh under the skin. Hurts to install." },
  { id: "stim-pack", name: "Stim Pack", type: "consumable" as const, rarity: "common" as const, damage: 0, defense: 0, slot: null, price: 150, description: "Quick-inject energy boost. +30 energy.", effect: "energy+30" },
  { id: "med-patch", name: "Med Patch", type: "consumable" as const, rarity: "common" as const, damage: 0, defense: 0, slot: null, price: 200, description: "Bio-adhesive healing patch. +50 health.", effect: "health+50" },
];

// GET /api/market/shop
router.get("/shop", requireAuth, async (_req, res) => {
  res.json(SHOP_ITEMS);
});

// POST /api/market/shop/buy
router.post("/shop/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId } = req.body;
    const shopItem = SHOP_ITEMS.find(i => i.id === itemId);
    if (!shopItem) return res.status(404).json({ message: "Item not found in shop" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dc < shopItem.price) return res.status(400).json({ message: "Not enough DC" });

    user.dc -= shopItem.price;
    const item = await Item.create({
      owner: user._id,
      name: shopItem.name,
      type: shopItem.type,
      rarity: shopItem.rarity,
      damage: shopItem.damage,
      defense: shopItem.defense,
      slot: shopItem.slot,
      price: shopItem.price,
      description: shopItem.description,
      effect: shopItem.effect ?? null,
    });

    user.inventory.push(item._id);
    await user.save();

    res.json({ message: `Purchased ${item.name}`, dc: user.dc, item: { id: item._id, name: item.name } });
  } catch (err: any) {
    req.log.error({ err }, "shop buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/market/listings
router.get("/listings", requireAuth, async (_req, res) => {
  try {
    const items = await Item.find({ marketListed: true })
      .populate("owner", "username")
      .lean();
    res.json(items.map(i => ({
      id: i._id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      damage: i.damage,
      defense: i.defense,
      description: i.description,
      price: i.marketPrice,
      seller: (i.owner as any).username,
    })));
  } catch (err: any) {
    req.log.error({ err }, "listings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings
router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, price } = req.body;
    const listPrice = Math.floor(Number(price));
    if (!itemId || !listPrice || listPrice <= 0) return res.status(400).json({ message: "itemId and price required" });

    const item = await Item.findOne({ _id: itemId, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Cannot list equipped item" });

    item.marketListed = true;
    item.marketPrice = listPrice;
    await item.save();

    res.json({ message: `Listed ${item.name} for ${listPrice} DC` });
  } catch (err: any) {
    req.log.error({ err }, "list item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings/:id/buy
router.post("/listings/:id/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, marketListed: true });
    if (!item) return res.status(404).json({ message: "Listing not found" });
    if (String(item.owner) === req.userId) return res.status(400).json({ message: "Cannot buy your own listing" });

    const [buyer, seller] = await Promise.all([
      User.findById(req.userId),
      User.findById(item.owner),
    ]);
    if (!buyer || !seller) return res.status(404).json({ message: "User not found" });
    if (buyer.dc < item.marketPrice!) return res.status(400).json({ message: "Not enough DC" });

    buyer.dc -= item.marketPrice!;
    seller.dc += item.marketPrice!;
    item.owner = buyer._id;
    item.marketListed = false;
    item.marketPrice = null;

    buyer.inventory.push(item._id);
    seller.inventory = seller.inventory.filter(id => String(id) !== String(item._id));

    await Promise.all([buyer.save(), seller.save(), item.save()]);

    await FeedEvent.create({
      type: "market",
      actor: buyer.username,
      actorId: buyer._id,
      target: seller.username,
      targetId: seller._id,
      message: `${buyer.username} bought ${item.name} from ${seller.username} for ${item.marketPrice} DC`,
      dc: item.marketPrice!,
    });

    res.json({ message: `Purchased ${item.name}`, dc: buyer.dc });
  } catch (err: any) {
    req.log.error({ err }, "buy listing error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
