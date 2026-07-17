import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import PriceOverride from "../models/PriceOverride";
import PlayerMiniGameInventory from "../models/PlayerMiniGameInventory";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { marketShopBuySchema, marketListingCreateSchema } from "../lib/schemas";

const router = Router();

const MARKET_FEE = 0.05;

// Price overrides — in-memory cache backed by DB; loaded lazily on first shop request
export const PRICE_OVERRIDES: Map<string, number> = new Map();
let _overridesLoaded = false;
async function ensureOverridesLoaded(): Promise<void> {
  if (_overridesLoaded) return;
  const rows = await PriceOverride.find().lean();
  for (const r of rows) PRICE_OVERRIDES.set(r.itemId, r.price);
  _overridesLoaded = true;
}

// All shop items use local cyberpunk PNG assets served from /assets/items/
function img(id: string): string {
  return `/assets/items/${id}.png`;
}

export const SHOP_ITEMS: Array<{
  id: string; name: string;
  type: "weapon" | "clothing" | "vehicle" | "consumable" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "event";
  slot: "enhancement" | "clothing" | "vehicle" | null;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; travelTimeReduction: number;
  basePrice: number; description: string; effect?: string; imageUrl: string;
}> = [
  // ── CONSUMABLES ──────────────────────────────────────────────────────────
  // Tier 1 — basic energy & health
  { id: "energy-drink",    name: "Energy Drink",    type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 500,     description: "+15 Energy on use.",                        effect: "energy:15",               imageUrl: img("energy-drink") },
  { id: "med-patch",       name: "Med Patch",       type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 500,     description: "+50 Health on use.",                        effect: "health:50",               imageUrl: img("med-patch") },
  // Tier 2 — mid consumables
  { id: "stim-pack",       name: "Stim Pack",       type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 2_000,   description: "+30 Energy on use.",                        effect: "energy:30",               imageUrl: img("stim-pack") },
  { id: "nerve-tonic",     name: "Nerve Tonic",     type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 1_500,   description: "+20 Nerve on use.",                         effect: "nerve:20",                imageUrl: img("nerve-tonic") },
  { id: "first-aid-kit",   name: "First Aid Kit",   type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 3_000,   description: "-30 minutes hospital time.",                effect: "hospital:-30",            imageUrl: img("first-aid-kit") },
  // Tier 3 — hospital clear
  { id: "trauma-kit",      name: "Trauma Kit",      type: "consumable", rarity: "rare",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 15_000,  description: "Clears hospitalization, restores full HP.", effect: "clear_hospital",          imageUrl: img("trauma-kit") },
  // Tier 4 — epic consumables
  { id: "nano-repair",     name: "Nano Repair",     type: "consumable", rarity: "epic",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 250_000, description: "-60% hospital time, +50 Energy.",           effect: "hospital_pct:-60,energy:50", imageUrl: img("nano-repair") },
  // Tier 5 — legendary
  { id: "legendary-elixir",name: "Legendary Elixir",type: "consumable", rarity: "legendary", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 5_000_000, description: "+10 to all stats for 4 hours, +50 Energy, +20 Nerve.", effect: "all_stats_timed:10:4,energy:50,nerve:20", imageUrl: img("legendary-elixir") },
  { id: "service-token",   name: "Service Token",   type: "consumable", rarity: "rare",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 50_000,  description: "Instantly services any race car to 100% condition. Use at the Garage.", effect: "service_car", imageUrl: img("service-token") },

  // ── ADRENALINE / NITRO BOOSTERS ─────────────────────────────────────────
  { id: "adrenaline-vial", name: "Adrenaline Vial", type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 800,     description: "+2 Adrenaline instant.",                    effect: "adrenaline:2",            imageUrl: img("adrenaline-vial") },
  { id: "combat-stim",     name: "Combat Stim",     type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 1_800,   description: "+5 Adrenaline instant (full refill).",      effect: "adrenaline:5",            imageUrl: img("combat-stim") },
  { id: "nitro-can",       name: "Nitro Can",       type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 800,     description: "+2 Nitro instant.",                         effect: "nitro:2",                 imageUrl: img("nitro-can") },
  { id: "fuel-pack",       name: "Fuel Pack",       type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 1_800,   description: "+5 Nitro instant (full refill).",           effect: "nitro:5",                 imageUrl: img("fuel-pack") },

  // ── WEAPONS ──────────────────────────────────────────────────────────────
  // Tier 1 — common street weapons
  { id: "rusty-blade",     name: "Rusty Blade",     type: "weapon", rarity: "common",    slot: "enhancement", strengthBonus: 3,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0,  travelTimeReduction: 0, basePrice: 300,       description: "A dull street knife. Better than nothing.",      imageUrl: img("rusty-blade") },
  { id: "combat-knife",    name: "Combat Knife",    type: "weapon", rarity: "common",    slot: "enhancement", strengthBonus: 5,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 1,  travelTimeReduction: 0, basePrice: 1_500,     description: "Fast and sharp. A street staple.",               imageUrl: img("combat-knife") },
  // Tier 2 — uncommon
  { id: "shock-glove",     name: "Shock Glove",     type: "weapon", rarity: "uncommon",  slot: "enhancement", strengthBonus: 10, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 2,  travelTimeReduction: 0, basePrice: 8_000,     description: "Electrified knuckles. Stings a lot.",            imageUrl: img("shock-glove") },
  { id: "pistol",          name: "Pistol",          type: "weapon", rarity: "uncommon",  slot: "enhancement", strengthBonus: 7,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0,  travelTimeReduction: 0, basePrice: 20_000,    description: "Standard 9mm sidearm.",                          imageUrl: img("pistol") },
  // Tier 3 — rare
  { id: "tactical-shotgun",name: "Tactical Shotgun",type: "weapon", rarity: "rare",      slot: "enhancement", strengthBonus: 12, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 1,  travelTimeReduction: 0, basePrice: 40_000,    description: "Pump-action. Wide spread. Close range devastation.", imageUrl: img("tactical-shotgun") },
  { id: "neural-cutter",   name: "Neural Cutter",   type: "weapon", rarity: "rare",      slot: "enhancement", strengthBonus: 18, charismaBonus: 0, intelligenceBonus: 3, streetCredBonus: 4,  travelTimeReduction: 0, basePrice: 60_000,    description: "Monofilament blade with haptic feedback.",       imageUrl: img("neural-cutter") },
  { id: "katana",          name: "Katana",          type: "weapon", rarity: "rare",      slot: "enhancement", strengthBonus: 14, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 3,  travelTimeReduction: 0, basePrice: 100_000,   description: "Traditional blade. Razor-edged. Respected.",     imageUrl: img("katana") },
  // Tier 4 — epic
  { id: "sniper-rifle",    name: "Sniper Rifle",    type: "weapon", rarity: "epic",      slot: "enhancement", strengthBonus: 16, charismaBonus: 0, intelligenceBonus: 8, streetCredBonus: 0,  travelTimeReduction: 0, basePrice: 350_000,   description: "Long-range precision weapon. One shot.",         imageUrl: img("sniper-rifle") },
  { id: "plasma-pistol",   name: "Plasma Pistol",   type: "weapon", rarity: "epic",      slot: "enhancement", strengthBonus: 22, charismaBonus: 0, intelligenceBonus: 6, streetCredBonus: 10, travelTimeReduction: 0, basePrice: 800_000,   description: "Micro-plasma discharge. Leaves burn marks.",     imageUrl: img("plasma-pistol") },
  // Tier 5 — legendary
  { id: "railgun",         name: "Railgun",         type: "weapon", rarity: "legendary", slot: "enhancement", strengthBonus: 35, charismaBonus: 0, intelligenceBonus: 12, streetCredBonus: 5, travelTimeReduction: 0, basePrice: 3_000_000, description: "Electromagnetic kinetic weapon. Corporate banned.", imageUrl: img("railgun") },
  { id: "plasma-cannon",   name: "Plasma Cannon",   type: "weapon", rarity: "legendary", slot: "enhancement", strengthBonus: 50, charismaBonus: 0, intelligenceBonus: 18, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 25_000_000, description: "Destroys everything in its path.",              imageUrl: img("plasma-cannon") },

  // ── CLOTHING ─────────────────────────────────────────────────────────────
  { id: "hoodie",           name: "Hoodie",           type: "clothing", rarity: "common",    slot: "clothing", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 500,       description: "Stay low-profile.",                              imageUrl: img("hoodie") },
  { id: "street-jacket",    name: "Street Jacket",    type: "clothing", rarity: "common",    slot: "clothing", strengthBonus: 1, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 1, travelTimeReduction: 0, basePrice: 1_500,     description: "Beat-up jacket with patches. Street credible.",  imageUrl: img("street-jacket") },
  { id: "designer-jacket",  name: "Designer Jacket",  type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 3, intelligenceBonus: 0, streetCredBonus: 1, travelTimeReduction: 0, basePrice: 5_000,     description: "Limited-run drop piece. Turns heads.",           imageUrl: img("designer-jacket") },
  { id: "corpo-suit",       name: "Corp Suit",        type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 2, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 8_000,     description: "Impeccably cut. Projects authority.",            imageUrl: img("corpo-suit") },
  { id: "leather-jacket",   name: "Leather Jacket",   type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 1, charismaBonus: 2, intelligenceBonus: 0, streetCredBonus: 2, travelTimeReduction: 0, basePrice: 12_000,    description: "Classic rebel aesthetic.",                       imageUrl: img("leather-jacket") },
  { id: "grid-outfit",      name: "Grid Outfit",      type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 4, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 18_000,    description: "Hacker collective uniform.",                     imageUrl: img("grid-outfit") },
  { id: "tailored-suit",    name: "Tailored Suit",    type: "clothing", rarity: "rare",      slot: "clothing", strengthBonus: 0, charismaBonus: 6, intelligenceBonus: 0, streetCredBonus: 2, travelTimeReduction: 0, basePrice: 60_000,    description: "Bespoke. Intimidating. Expensive.",              imageUrl: img("tailored-suit") },
  { id: "faction-outfit",   name: "Faction Outfit",   type: "clothing", rarity: "epic",      slot: "clothing", strengthBonus: 5, charismaBonus: 8, intelligenceBonus: 0, streetCredBonus: 8, travelTimeReduction: 0, basePrice: 800_000,   description: "Gang colors. Respect multiplier.",               imageUrl: img("faction-outfit") },
  { id: "nano-suit",        name: "Nano Suit",        type: "clothing", rarity: "epic",      slot: "clothing", strengthBonus: 5, charismaBonus: 2, intelligenceBonus: 8, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 1_200_000, description: "Adaptive nano-fiber suit.",                      imageUrl: img("nano-suit") },
  { id: "directors-suit",   name: "Director's Suit",  type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 18, intelligenceBonus: 12, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 8_000_000, description: "Worn by those who run things.",                 imageUrl: img("directors-suit") },
  { id: "ceo-tuxedo",       name: "CEO Tuxedo",       type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 25, intelligenceBonus: 18, streetCredBonus: 0, travelTimeReduction: 0, basePrice: 20_000_000, description: "The pinnacle of corp fashion.",               imageUrl: img("ceo-tuxedo") },

  // ── VEHICLES ─────────────────────────────────────────────────────────────
  { id: "bicycle",     name: "Bicycle",      type: "vehicle", rarity: "common",    slot: "vehicle", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 20, basePrice: 500,        description: "-20% travel time. Pedal power.",               imageUrl: img("bicycle") },
  { id: "motorcycle",  name: "Motorcycle",   type: "vehicle", rarity: "uncommon",  slot: "vehicle", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, travelTimeReduction: 35, basePrice: 12_000,     description: "-35% travel time. Fast and loud.",             imageUrl: img("motorcycle") },
  { id: "sports-car",  name: "Sports Car",   type: "vehicle", rarity: "rare",      slot: "vehicle", strengthBonus: 0, charismaBonus: 5, intelligenceBonus: 0, streetCredBonus: 2, travelTimeReduction: 60, basePrice: 150_000,    description: "-60% travel time. Aerodynamic.",             imageUrl: img("sports-car") },
  { id: "luxury-car",  name: "Luxury Car",   type: "vehicle", rarity: "rare",      slot: "vehicle", strengthBonus: 0, charismaBonus: 12, intelligenceBonus: 0, streetCredBonus: 3, travelTimeReduction: 40, basePrice: 250_000,    description: "-40% travel time. Bulletproof glass.",       imageUrl: img("luxury-car") },
  { id: "hoverbike",   name: "Hoverbike",    type: "vehicle", rarity: "epic",      slot: "vehicle", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 5, streetCredBonus: 5, travelTimeReduction: 70, basePrice: 1_500_000,  description: "-70% travel time. Mag-lev. No wheels.",        imageUrl: img("hoverbike") },
  { id: "armored-limo",name: "Armored Limo", type: "vehicle", rarity: "legendary", slot: "vehicle", strengthBonus: 5, charismaBonus: 15, intelligenceBonus: 0, streetCredBonus: 8, travelTimeReduction: 80, basePrice: 15_000_000, description: "-80% travel time. Mobile fortress.",         imageUrl: img("armored-limo") },

];

// Ensure every shop item's imageUrl points to its local PNG asset (keyed by item id).
// This runs once at module load, overriding any placeholder values set above.
for (const item of SHOP_ITEMS) {
  item.imageUrl = `/assets/items/${item.id}.png`;
}

// GET /api/market/shop
router.get("/shop", requireAuth, async (_req, res) => {
  await ensureOverridesLoaded();
  res.json(SHOP_ITEMS.map(i => ({
    id: i.id, name: i.name, type: i.type, rarity: i.rarity, slot: i.slot,
    strengthBonus: i.strengthBonus, charismaBonus: i.charismaBonus,
    intelligenceBonus: i.intelligenceBonus, streetCredBonus: i.streetCredBonus,
    travelTimeReduction: i.travelTimeReduction,
    basePrice: i.basePrice,
    price: PRICE_OVERRIDES.get(i.id) ?? i.basePrice,
    description: i.description,
    effect: i.effect ?? null, imageUrl: i.imageUrl,
  })));
});

// POST /api/market/shop/buy
router.post("/shop/buy", requireAuth, validateBody(marketShopBuySchema), async (req: AuthRequest, res) => {
  try {
    await ensureOverridesLoaded();
    const { itemId, quantity = 1 } = req.body;
    const shopItem = SHOP_ITEMS.find(i => i.id === itemId);
    if (!shopItem) return res.status(404).json({ message: "Item not found in shop" });

    const qty = Math.max(1, Math.min(99, Number(quantity)));
    const effectivePrice = PRICE_OVERRIDES.get(shopItem.id) ?? shopItem.basePrice;
    const totalCost = effectivePrice * qty;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dc < totalCost) return res.status(400).json({ message: `Not enough DC. Costs ${totalCost.toLocaleString()} DC.` });

    user.dc -= totalCost;

    const itemData = {
      owner: user._id,
      name: shopItem.name,
      type: shopItem.type,
      rarity: shopItem.rarity,
      slot: shopItem.slot,
      strengthBonus: shopItem.strengthBonus,
      charismaBonus: shopItem.charismaBonus,
      intelligenceBonus: shopItem.intelligenceBonus,
      streetCredBonus: shopItem.streetCredBonus,
      travelTimeReduction: shopItem.travelTimeReduction,
      basePrice: shopItem.basePrice,
      description: shopItem.description,
      effect: shopItem.effect ?? null,
      imageUrl: shopItem.imageUrl,
      blackMarket: false,
    };

    if (shopItem.type === "consumable") {
      const existing = await Item.findOne({ owner: user._id, name: shopItem.name });
      if (existing) {
        existing.quantity += qty;
        await existing.save();
      } else {
        await Item.create({ ...itemData, quantity: qty });
      }
    } else {
      await Item.create({ ...itemData, quantity: 1 });
    }

    await user.save();
    res.json({ message: `Purchased ${qty > 1 ? `${qty}x ` : ""}${shopItem.name}`, dc: user.dc });
  } catch (err: any) {
    req.log.error({ err }, "shop buy error");
    res.status(500).json({ message: "Internal server error" });
  }
});

const MARKET_LISTING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Expires stale market listings — restores arena items/ammo to their mini-game
// inventories, and simply unlists normal items back to their owner.
// Called both lazily (on GET /listings) and via an hourly cron in index.ts.
export async function expireMarketListings(): Promise<number> {
  const cutoff = new Date(Date.now() - MARKET_LISTING_TTL_MS);
  const stale = await Item.find({ marketListed: true, marketListedAt: { $lt: cutoff } }).lean();
  if (stale.length === 0) return 0;

  for (const item of stale) {
    try {
      const meta = item.arenaListingMeta;
      if (meta?.kind === "arena" && meta.inventoryRef && meta.itemId) {
        // Restore the weapon/armor stack to the player's arena inventory
        const inv = await PlayerMiniGameInventory.findOne({ userId: item.owner });
        if (inv) {
          const arr = inv[meta.inventoryRef] as Array<{ itemId: string; durability: number }>;
          const existing = arr.find((w) => w.itemId === meta.itemId);
          if (existing) {
            existing.durability = Math.max(existing.durability, meta.durability ?? 100);
          } else {
            arr.push({ itemId: meta.itemId, durability: meta.durability ?? 100 });
          }
          await inv.save();
        }
        await Item.deleteOne({ _id: item._id });
      } else if (meta?.kind === "arena_ammo" && meta.ammoCategory && meta.rounds) {
        await PlayerMiniGameInventory.updateOne(
          { userId: item.owner },
          { $inc: { [`ammo.${meta.ammoCategory}`]: meta.rounds } },
          { upsert: false },
        );
        await Item.deleteOne({ _id: item._id });
      } else {
        // Normal item — just unlist it back to the owner
        await Item.updateOne(
          { _id: item._id },
          { $set: { marketListed: false, marketPrice: null, marketListedAt: null } },
        );
      }
    } catch {
      // Skip this item on error, continue with the rest
    }
  }
  return stale.length;
}

// GET /api/market/listings — auto-expires listings older than 30 days
router.get("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    await expireMarketListings();
    const items = await Item.find({ marketListed: true })
      .populate("owner", "username")
      .lean();
    res.json(items.map(i => ({
      id: i._id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      strengthBonus: i.strengthBonus,
      charismaBonus: i.charismaBonus,
      intelligenceBonus: i.intelligenceBonus,
      streetCredBonus: i.streetCredBonus,
      travelTimeReduction: i.travelTimeReduction,
      effect: i.effect,
      description: i.description,
      basePrice: i.basePrice,
      marketPrice: i.marketPrice,
      marketListedAt: i.marketListedAt,
      imageUrl: i.imageUrl ?? null,
      seller: (i.owner as any)?.username ?? "Unknown",
    })));
  } catch (err: any) {
    req.log.error({ err }, "listings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings — list an item for P2P sale
router.post("/listings", requireAuth, validateBody(marketListingCreateSchema), async (req: AuthRequest, res) => {
  try {
    const { itemId, price } = req.body;

    const item = await Item.findOne({ _id: itemId, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip the item first" });
    if (item.marketListed) return res.status(400).json({ message: "Already listed" });
    if (item.type === "consumable") return res.status(400).json({ message: "Cannot list consumables on the market" });

    item.marketListed = true;
    item.marketPrice = price;
    item.marketListedAt = new Date();
    await item.save();

    res.json({ message: `${item.name} listed for ${price.toLocaleString()} DC` });
  } catch (err: any) {
    req.log.error({ err }, "list item error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/market/listings/:id — cancel a listing
router.delete("/listings/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId, marketListed: true });
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

// POST /api/market/listings/:id/buy — buy a P2P listing (atomic — no double-sell)
router.post("/listings/:id/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Step 1: Atomically claim the listing — only one buyer can win this race
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, marketListed: true },
      { $set: { marketListed: false, marketPrice: null, marketListedAt: null, equipped: false } },
      { new: false }, // return pre-update doc so we have price + original owner
    );
    if (!item) return res.status(404).json({ message: "Listing not found or already sold" });

    if (item.owner.equals(req.userId as string)) {
      // Reverse claim — can't buy your own item
      await Item.findByIdAndUpdate(item._id, { $set: { marketListed: true, marketPrice: item.marketPrice, marketListedAt: item.marketListedAt } });
      return res.status(400).json({ message: "Cannot buy your own item" });
    }

    const price = item.marketPrice ?? 0;
    const fee = Math.floor(price * MARKET_FEE);
    const sellerProfit = price - fee;

    // Step 2: Atomically deduct from buyer — reverse claim if they can't afford it
    const buyer = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: price } },
      { $inc: { dc: -price } },
      { new: true },
    );
    if (!buyer) {
      await Item.findByIdAndUpdate(item._id, { $set: { marketListed: true, marketPrice: item.marketPrice, marketListedAt: item.marketListedAt } });
      return res.status(400).json({ message: `Not enough DC. Price: ${price.toLocaleString()} DC` });
    }

    // Step 3: Credit seller + transfer ownership (both are independent atomic ops)
    await Promise.all([
      User.findByIdAndUpdate(item.owner, { $inc: { dc: sellerProfit } }),
      Item.findByIdAndUpdate(item._id, { $set: { owner: buyer._id } }),
    ]);

    res.json({ message: `Purchased ${item.name} for ${price.toLocaleString()} DC`, dc: buyer.dc });
  } catch (err: any) {
    req.log.error({ err }, "buy listing error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/market/listings/batch — list multiple items atomically (partial success)
router.post("/listings/batch", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { listings: items } = req.body as {
      listings: Array<{
        itemId: string;
        itemType: "normal" | "arena" | "arena_ammo";
        inventoryRef?: "primaryWeapons" | "secondaryWeapons" | "bodyArmors";
        ammoCategory?: "pistol_rounds" | "smg_rounds" | "rifle_rounds" | "shotgun_shells" | "sniper_rounds" | "lmg_rounds";
        roundsToList?: number;
        price: number;
      }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "listings array required" });
    }

    let listed = 0;
    let failed = 0;
    let expectedPayout = 0;

    for (const entry of items) {
      try {
        const { itemId, itemType, inventoryRef, ammoCategory, roundsToList, price } = entry;

        // 1. Validate price
        if (!price || price <= 0) { failed++; continue; }

        if (itemType === "normal") {
          // 2. Verify item is in user inventory
          const item = await Item.findOne({ _id: itemId, owner: req.userId });
          if (!item) { failed++; continue; }
          if (item.equipped) { failed++; continue; }
          if (item.marketListed) { failed++; continue; }

          item.marketListed = true;
          item.marketPrice = price;
          item.marketListedAt = new Date();
          await item.save();

          const fee = Math.floor(price * MARKET_FEE);
          expectedPayout += price - fee;
          listed++;

        } else if (itemType === "arena") {
          // 3. Verify item in PlayerMiniGameInventory with durability > 0
          if (!inventoryRef) { failed++; continue; }
          const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId });
          if (!inv) { failed++; continue; }

          const stack = (inv[inventoryRef] as Array<{ itemId: string; durability: number }>)
            .find((w) => w.itemId === itemId);
          if (!stack || stack.durability <= 0) { failed++; continue; }

          // Remove from arena inventory atomically
          await PlayerMiniGameInventory.updateOne(
            { userId: req.userId },
            { $pull: { [inventoryRef]: { itemId } } },
          );

          // Create a normal Item record that is market-listed
          await Item.create({
            owner: req.userId,
            name: itemId,
            type: "misc",
            rarity: "common",
            strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0,
            streetCredBonus: 0, travelTimeReduction: 0,
            basePrice: price,
            description: `Arena item: ${itemId} (durability ${stack.durability})`,
            quantity: 1,
            blackMarket: false,
            marketListed: true,
            marketPrice: price,
            marketListedAt: new Date(),
            arenaListingMeta: {
              kind: "arena",
              inventoryRef,
              itemId,
              durability: stack.durability,
            },
          });

          const fee = Math.floor(price * MARKET_FEE);
          expectedPayout += price - fee;
          listed++;

        } else if (itemType === "arena_ammo") {
          // 4. Verify roundsToList <= ammo[ammoCategory]
          if (!ammoCategory || !roundsToList || roundsToList <= 0) { failed++; continue; }
          const inv = await PlayerMiniGameInventory.findOne({ userId: req.userId });
          if (!inv) { failed++; continue; }

          const available = inv.ammo[ammoCategory] ?? 0;
          if (roundsToList > available) { failed++; continue; }

          // Deduct ammo atomically
          await PlayerMiniGameInventory.updateOne(
            { userId: req.userId },
            { $inc: { [`ammo.${ammoCategory}`]: -roundsToList } },
          );

          // Create a market-listed Item representing the ammo
          await Item.create({
            owner: req.userId,
            name: `${ammoCategory.replace(/_/g, " ")} x${roundsToList}`,
            type: "consumable",
            rarity: "common",
            strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0,
            streetCredBonus: 0, travelTimeReduction: 0,
            basePrice: price,
            description: `${roundsToList} rounds of ${ammoCategory.replace(/_/g, " ")}`,
            quantity: roundsToList,
            blackMarket: false,
            marketListed: true,
            marketPrice: price,
            marketListedAt: new Date(),
            arenaListingMeta: {
              kind: "arena_ammo",
              ammoCategory,
              rounds: roundsToList,
            },
          });

          const fee = Math.floor(price * MARKET_FEE);
          expectedPayout += price - fee;
          listed++;

        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    res.json({ listed, failed, expectedPayout });
  } catch (err: any) {
    req.log.error({ err }, "batch listing error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/market/price-overrides (owner only)
router.get("/price-overrides", requireAuth, async (req: AuthRequest, res) => {
  if (req.role !== "owner" && req.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const overrides: Record<string, number> = {};
  PRICE_OVERRIDES.forEach((v, k) => { overrides[k] = v; });
  res.json(overrides);
});

// POST /api/market/price-override (owner only)
router.post("/price-override", requireAuth, async (req: AuthRequest, res) => {
  if (req.role !== "owner" && req.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const { itemId, price } = req.body as { itemId: string; price: number | null };
  if (!itemId) return res.status(400).json({ message: "itemId required" });

  if (price === null || price === undefined) {
    PRICE_OVERRIDES.delete(itemId);
    await PriceOverride.findOneAndDelete({ itemId });
    return res.json({ message: `Price override cleared for ${itemId}` });
  }

  if (price < 0) return res.status(400).json({ message: "Price must be >= 0" });
  PRICE_OVERRIDES.set(itemId, price);
  await PriceOverride.findOneAndUpdate({ itemId }, { price }, { upsert: true });
  res.json({ message: `Price of ${itemId} set to ${price} DC` });
});

export default router;
