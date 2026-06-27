import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import FeedEvent from "../models/FeedEvent";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const MARKET_FEE = 0.05; // 5% transaction fee

const SHOP_ITEMS: Array<{
  id: string; name: string;
  type: "weapon" | "armor" | "clothing" | "vehicle" | "consumable" | "material" | "badge" | "card" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  slot: "weapon" | "armor" | "clothing" | "vehicle" | null;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number; streetCredBonus: number;
  defenseBonus: number; basePrice: number; description: string; effect?: string;
}> = [
  { id: "rusty-blade", name: "Rusty Blade", type: "weapon", rarity: "common", slot: "weapon", strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, basePrice: 300, description: "A dull street knife. Better than nothing." },
  { id: "shock-glove", name: "Shock Glove", type: "weapon", rarity: "uncommon", slot: "weapon", strengthBonus: 12, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 0, basePrice: 800, description: "Electrified knuckles. Stings a bit." },
  { id: "neural-cutter", name: "Neural Cutter", type: "weapon", rarity: "rare", slot: "weapon", strengthBonus: 22, charismaBonus: 0, intelligenceBonus: 3, streetCredBonus: 5, defenseBonus: 0, basePrice: 2000, description: "Monofilament blade with haptic feedback." },
  { id: "plasma-pistol", name: "Plasma Pistol", type: "weapon", rarity: "epic", slot: "weapon", strengthBonus: 35, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 10, defenseBonus: 0, basePrice: 5500, description: "Micro-plasma discharge. Leaves burn marks." },
  { id: "leather-coat", name: "Leather Coat", type: "armor", rarity: "common", slot: "armor", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 4, basePrice: 250, description: "Thick synth-leather. Basic protection." },
  { id: "kevlar-vest", name: "Kevlar Vest", type: "armor", rarity: "uncommon", slot: "armor", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 10, basePrice: 900, description: "Standard corporate-issue body armor." },
  { id: "subdermal-plating", name: "Subdermal Plating", type: "armor", rarity: "rare", slot: "armor", strengthBonus: 2, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 3, defenseBonus: 20, basePrice: 2500, description: "Titanium mesh under the skin." },
  { id: "corpo-suit", name: "Corp Suit", type: "clothing", rarity: "uncommon", slot: "clothing", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 2, streetCredBonus: 0, defenseBonus: 0, basePrice: 600, description: "Impeccably cut suit. Projects authority." },
  { id: "street-jacket", name: "Street Jacket", type: "clothing", rarity: "common", slot: "clothing", strengthBonus: 1, charismaBonus: 2, intelligenceBonus: 0, streetCredBonus: 3, defenseBonus: 0, basePrice: 180, description: "Beat-up jacket with patches." },
  { id: "stim-pack", name: "Stim Pack", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, basePrice: 150, description: "+30 Energy on use.", effect: "energy:30" },
  { id: "med-patch", name: "Med Patch", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, basePrice: 200, description: "+50 Health on use.", effect: "health:50" },
  { id: "nerve-tonic", name: "Nerve Tonic", type: "consumable", rarity: "uncommon", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, basePrice: 350, description: "+20 Nerve on use.", effect: "nerve:20" },
  { id: "trauma-kit", name: "Trauma Kit", type: "consumable", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, basePrice: 800, description: "Clears hospitalization, restores full HP.", effect: "clear_hospital" },
];

// GET /api/market/shop
router.get("/shop", requireAuth, async (_req, res) => {
  res.json(SHOP_ITEMS.map(i => ({
    id: i.id, name: i.name, type: i.type, rarity: i.rarity, slot: i.slot,
    strengthBonus: i.strengthBonus, charismaBonus: i.charismaBonus,
    intelligenceBonus: i.intelligenceBonus, streetCredBonus: i.streetCredBonus,
    defenseBonus: i.defenseBonus, basePrice: i.basePrice, description: i.description,
    effect: i.effect ?? null,
  })));
});

// POST /api/market/shop/buy
router.post("/shop/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const shopItem = SHOP_ITEMS.find(i => i.id === itemId);
    if (!shopItem) return res.status(404).json({ message: "Item not found in shop" });

    const qty = Math.max(1, Math.min(99, Number(quantity)));
    const totalCost = shopItem.basePrice * qty;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dc < totalCost) return res.status(400).json({ message: `Not enough DC. Costs ${totalCost} DC.` });

    user.dc -= totalCost;

    // Stack consumables, create new for gear
    if (shopItem.type === "consumable" || shopItem.type === "material") {
      const existing = await Item.findOne({ owner: user._id, name: shopItem.name });
      if (existing) {
        existing.quantity += qty;
        await existing.save();
      } else {
        await Item.create({ ...shopItem, owner: user._id, quantity: qty, slot: shopItem.slot, blackMarket: false });
      }
    } else {
      await Item.create({ ...shopItem, owner: user._id, quantity: 1, slot: shopItem.slot, blackMarket: false });
    }

    await user.save();
    res.json({ message: `Purchased ${qty > 1 ? `${qty}x ` : ""}${shopItem.name}`, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "shop buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/market/listings
router.get("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await Item.find({ marketListed: true })
      .populate("owner", "username")
      .lean();
    res.json(items.map(i => ({
      id: i._id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      slot: i.slot,
      strengthBonus: i.strengthBonus,
      charismaBonus: i.charismaBonus,
      intelligenceBonus: i.intelligenceBonus,
      streetCredBonus: i.streetCredBonus,
      defenseBonus: i.defenseBonus,
      description: i.description,
      price: i.marketPrice,
      seller: (i.owner as any)?.username ?? "Unknown",
    })));
  } catch (err: any) {
    req.log.error({ err }, "listings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings — list an item
router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, price } = req.body;
    const listPrice = Math.floor(Number(price));
    if (!itemId || !listPrice || listPrice <= 0) {
      return res.status(400).json({ message: "itemId and price required" });
    }

    const item = await Item.findOne({ _id: itemId, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip before listing" });
    if (item.marketListed) return res.status(400).json({ message: "Already listed" });

    item.marketListed = true;
    item.marketPrice = listPrice;
    item.marketListedAt = new Date();
    await item.save();

    res.json({ message: `Listed ${item.name} for ${listPrice.toLocaleString()} DC` });
  } catch (err: any) {
    req.log.error({ err }, "list item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/market/listings/:id — cancel listing
router.delete("/listings/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params["id"], owner: req.userId, marketListed: true });
    if (!item) return res.status(404).json({ message: "Listing not found" });

    item.marketListed = false;
    item.marketPrice = null;
    item.marketListedAt = null;
    await item.save();

    res.json({ message: `${item.name} delisted` });
  } catch (err: any) {
    req.log.error({ err }, "delist error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings/:id/buy
router.post("/listings/:id/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, marketListed: true });
    if (!item) return res.status(404).json({ message: "Listing not found" });
    if (String(item.owner) === req.userId) {
      return res.status(400).json({ message: "Cannot buy your own listing" });
    }

    const [buyer, seller] = await Promise.all([
      User.findById(req.userId),
      User.findById(item.owner),
    ]);
    if (!buyer || !seller) return res.status(404).json({ message: "User not found" });

    const salePrice = item.marketPrice!;
    if (buyer.dc < salePrice) {
      return res.status(400).json({ message: `Not enough DC. Costs ${salePrice.toLocaleString()} DC.` });
    }

    const fee = Math.floor(salePrice * MARKET_FEE);
    const sellerReceives = salePrice - fee;

    buyer.dc -= salePrice;
    seller.dc += sellerReceives;

    item.owner = buyer._id;
    item.marketListed = false;
    item.marketPrice = null;
    item.marketListedAt = null;

    await Promise.all([buyer.save(), seller.save(), item.save()]);

    await FeedEvent.create({
      type: "market",
      actor: buyer.username,
      actorId: buyer._id,
      target: seller.username,
      targetId: seller._id,
      message: `${buyer.username} bought ${item.name} from ${seller.username} for ${salePrice.toLocaleString()} DC`,
      dc: salePrice,
    });

    res.json({ message: `Purchased ${item.name} for ${salePrice.toLocaleString()} DC`, dc: buyer.dc });
  } catch (err: any) {
    req.log.error({ err }, "buy listing error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
