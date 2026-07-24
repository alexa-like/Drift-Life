import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../../middlewares/auth";
import NpcStoreListing, { INpcStoreListing } from "./models/NpcStoreListing";
import User from "../../models/User";
import Item from "../../models/Item";
import MiniGameItem from "../garage/models/MiniGameItem";
import PlayerMiniGameInventory from "../garage/models/PlayerMiniGameInventory";
import { SHOP_ITEMS } from "../market/routes";

const router = Router();

const STORE_CONFIGS: Record<string, { name: string; keeper: string; tagline: string; itemType: "normal"|"arena"; itemTiers: string[]; faqs: { q: string; a: string }[] }> = {
  iron_wolf: {
    name: "Iron Wolf Armory", keeper: 'Marcus "Iron" Cole', tagline: "Enhancement gear, no bullshit.",
    itemType: "normal", itemTiers: ["common","uncommon","rare"],
    faqs: [
      { q: "What do you sell?", a: "Enhancement gear. Street-grade to military-spec. Slot it in and feel stronger." },
      { q: "These prices negotiable?", a: "Fixed. Always. No haggling. Either you want it or you don't." },
      { q: "Got anything rarer?", a: "Not here. If you want the heavy stuff, try the auction." },
      { q: "How often do you restock?", a: "Every 6 hours. Come back if you missed something." },
    ]
  },
  steelshield: {
    name: "Steelshield Outfitters", keeper: "Yuki Tanaka", tagline: "Fashion that fights back.",
    itemType: "normal", itemTiers: ["common","uncommon","rare"],
    faqs: [
      { q: "What does clothing do?", a: "Stat boosts. Charisma, intelligence, street cred — the right outfit opens doors." },
      { q: "Fashion or function?", a: "Both. My pieces are designed, not just functional." },
      { q: "Do clothes wear out?", a: "No durability on clothing. Buy it once, keep it forever." },
      { q: "How often do you restock?", a: "Every 6 hours. New looks every cycle." },
    ]
  },
  neon_motors: {
    name: "Neon Motors", keeper: 'Rico "Speed" Vega', tagline: "The finest rides in the city.",
    itemType: "normal", itemTiers: ["common","uncommon","rare"],
    faqs: [
      { q: "Why so expensive?", a: "Quality has a price. You want cheap, go to the Slums." },
      { q: "What do vehicles do?", a: "Reduces travel time across the city. Better car, faster travel." },
      { q: "Can I sell my car?", a: "On the player market. I only sell new." },
      { q: "How often do you restock?", a: "Every 6 hours. The showroom rotates." },
    ]
  },
  district_pharma: {
    name: "District Pharma", keeper: "Dr. Elena Reyes", tagline: "Precisely what you need.",
    itemType: "normal", itemTiers: ["common","uncommon","rare"],
    faqs: [
      { q: "What is a Service Token?", a: "One token services any race car to 100% condition. Cars degrade after races — keep them tuned." },
      { q: "Do consumables expire?", a: "In your inventory? No. Use them when you need them." },
      { q: "What does Stim Pack do?", a: "+30 Energy instantly. Useful before a long crime run." },
      { q: "How often do you restock?", a: "Every 6 hours." },
    ]
  },
  combat_zone: {
    name: "Combat Zone Supply", keeper: '"The Sergeant"', tagline: "Gear for the arena. No questions.",
    itemType: "arena", itemTiers: ["common","uncommon"],
    faqs: [
      { q: "Do you carry Epic or Legendary gear?", a: "No. Never. You want that? Try your luck in the Royale." },
      { q: "Why do rare items rotate?", a: "Supply is unpredictable. Check back — you might get lucky." },
      { q: "How do I use this ammo?", a: "Buy it, it goes straight into your ammo pool for that weapon type." },
      { q: "How often do you restock?", a: "Every 6 hours. Prices change each cycle." },
    ]
  },
};

const NORMAL_STORE_POOLS: Record<string, string[]> = {
  iron_wolf: ["rusty-blade","combat-knife","shock-glove","pistol","tactical-shotgun","neural-cutter","katana"],
  steelshield: ["street-jacket","neon-hoodie","bulletproof-vest","corp-suit","synth-armor"],
  neon_motors: ["motorcycle","sports-car","luxury-car"],
  district_pharma: ["energy-drink","med-patch","stim-pack","nerve-tonic","first-aid-kit","trauma-kit","nano-repair","service-token","adrenaline-vial","combat-stim","nitro-can","fuel-pack"],
  combat_zone: [],
};

const PRICE_RANGES: Record<string, Record<string, [number,number]>> = {
  iron_wolf:    { common:[800,1200], uncommon:[2000,3500], rare:[6000,10000] },
  steelshield:  { common:[600,1000], uncommon:[1800,3000], rare:[5000,9000] },
  neon_motors:  { common:[3000,5000], uncommon:[8000,14000], rare:[25000,40000] },
  district_pharma: { common:[300,600], uncommon:[900,1800], rare:[3000,6000] },
  combat_zone:  { common:[500,900], uncommon:[1500,2800], rare:[5000,9000] },
};

// ABSOLUTE RULE (spec Appendix A / Section 9.4): Epic and Legendary items
// must NEVER appear in any NPC store — Downtown or district. Enforce at the
// listing-generation boundary so no code path can accidentally slip them in.
const FORBIDDEN_TIERS = new Set(["epic", "legendary"]);

async function restockStore(storeId: string): Promise<void> {
  const config = STORE_CONFIGS[storeId];
  if (!config) return;

  // Deactivate existing listings
  await NpcStoreListing.updateMany({ storeId }, { $set: { isActive: false } });

  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const listings: Partial<INpcStoreListing>[] = [];

  if (config.itemType === "normal") {
    const pool = NORMAL_STORE_POOLS[storeId] ?? [];
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 4) + 4);

    for (const itemId of shuffled) {
      const tier = itemId.includes("sniper") || itemId.includes("katana") || itemId.includes("luxury") ? "rare"
                 : itemId.includes("shock") || itemId.includes("pistol") || itemId.includes("stim") ? "uncommon"
                 : "common";
      const priceRange = PRICE_RANGES[storeId]?.[tier] ?? [500, 1000];
      const price = Math.floor(Math.random() * (priceRange[1] - priceRange[0])) + priceRange[0];
      listings.push({
        storeId,
        itemId,
        itemType: "normal",
        itemName: itemId.replace(/-/g, " "),
        itemTier: tier,
        price,
        quantity: Math.floor(Math.random() * 4) + 1,
        expiresAt,
        isActive: true,
      });
    }
  } else if (storeId === "combat_zone") {
    const arenaItems = await MiniGameItem.find({
      category: { $in: ["pistol","smg","assault_rifle","shotgun","sniper_rifle","lmg","body_armor"] },
      tier: { $in: ["common","uncommon"] },
      isActive: true,
    }).lean();

    const shuffled = arenaItems.sort(() => Math.random() - 0.5).slice(0, 6);
    for (const item of shuffled) {
      const priceRange = PRICE_RANGES[storeId][item.tier] ?? [500, 900];
      const price = Math.floor(Math.random() * (priceRange[1] - priceRange[0])) + priceRange[0];
      listings.push({
        storeId,
        itemId: item.itemId,
        itemType: "arena",
        itemName: item.name,
        itemTier: item.tier,
        price,
        quantity: Math.floor(Math.random() * 3) + 1,
        expiresAt,
        isActive: true,
      });
    }

    // 20% chance to include 1 Rare arena item
    if (Math.random() < 0.20) {
      const rareItems = await MiniGameItem.find({ tier: "rare", isActive: true }).lean();
      if (rareItems.length > 0) {
        const rareItem = rareItems[Math.floor(Math.random() * rareItems.length)];
        const priceRange = PRICE_RANGES[storeId]["rare"];
        const price = Math.floor(Math.random() * (priceRange[1] - priceRange[0])) + priceRange[0];
        listings.push({
          storeId,
          itemId: rareItem.itemId,
          itemType: "arena",
          itemName: rareItem.name,
          itemTier: "rare",
          price,
          quantity: 1,
          expiresAt,
          isActive: true,
        });
      }
    }
  }
  // Final guard: strip any Epic/Legendary items before inserting (absolute rule)
  const safeListings = listings.filter(l => !FORBIDDEN_TIERS.has(l.itemTier ?? ""));
  if (safeListings.length > 0) {
    await NpcStoreListing.insertMany(safeListings);
  }
}

// GET /npc-stores — all stores list
router.get("/", requireAuth, async (req, res: Response) => {
  const storeIds = Object.keys(STORE_CONFIGS);
  const result = await Promise.all(storeIds.map(async storeId => {
    let listings = await NpcStoreListing.find({ storeId, isActive: true, expiresAt: { $gt: new Date() } }).lean();
    if (listings.length === 0) {
      await restockStore(storeId);
      listings = await NpcStoreListing.find({ storeId, isActive: true, expiresAt: { $gt: new Date() } }).lean();
    }
    const cfg = STORE_CONFIGS[storeId];
    const nextRestock = listings[0]?.expiresAt ?? new Date(Date.now() + 6 * 60 * 60 * 1000);
    return { storeId, storeName: cfg.name, keeper: cfg.keeper, tagline: cfg.tagline, listings, restocksAt: nextRestock };
  }));
  res.json(result);
});

// GET /npc-stores/:storeId — single store
router.get("/:storeId", requireAuth, async (req: AuthRequest, res: Response) => {
  const storeId = req.params["storeId"] as string;
  const cfg = STORE_CONFIGS[storeId];
  if (!cfg) { res.status(404).json({ message: "Store not found" }); return; }

  let listings = await NpcStoreListing.find({ storeId, isActive: true, expiresAt: { $gt: new Date() } }).lean();
  if (listings.length === 0) {
    await restockStore(storeId);
    listings = await NpcStoreListing.find({ storeId, isActive: true, expiresAt: { $gt: new Date() } }).lean();
  }

  const nextRestock = listings[0]?.expiresAt ?? new Date(Date.now() + 6 * 60 * 60 * 1000);
  res.json({ storeId, storeName: cfg.name, keeper: cfg.keeper, tagline: cfg.tagline, faqs: cfg.faqs, listings, restocksAt: nextRestock });
});

// POST /npc-stores/:storeId/buy
router.post("/:storeId/buy", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const storeId = req.params["storeId"] as string;
    const { itemId } = req.body as { itemId: string };
    const cfg = STORE_CONFIGS[storeId];
    if (!cfg) { res.status(404).json({ message: "Store not found" }); return; }

    const listing = await NpcStoreListing.findOne({
      storeId,
      itemId,
      isActive: true,
      expiresAt: { $gt: new Date() },
      quantity: { $gt: 0 },
    });
    if (!listing) { res.status(404).json({ message: "Item not available" }); return; }

    const user = await User.findById(req.userId).select("dc");
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    if (user.dc < listing.price) { res.status(400).json({ message: "Not enough DC" }); return; }

    // Atomic decrement listing quantity
    const updated = await NpcStoreListing.findOneAndUpdate(
      { _id: listing._id, quantity: { $gt: 0 } },
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' }
    );
    if (!updated) { res.status(409).json({ message: "Item sold out" }); return; }
    if (updated.quantity === 0) {
      await NpcStoreListing.updateOne({ _id: listing._id }, { $set: { isActive: false } });
    }

    // Deduct DC
    await User.findByIdAndUpdate(req.userId, { $inc: { dc: -listing.price } });

    // Add item to player inventory
    if (listing.itemType === "normal") {
      // Look up real item definition from shop catalog
      const shopDef = SHOP_ITEMS.find(s => s.id === listing.itemId || s.name.toLowerCase() === listing.itemName.toLowerCase());
      const realType = (shopDef?.type ?? "consumable") as "weapon" | "clothing" | "vehicle" | "consumable" | "misc";
      const isStackable = realType === "consumable";

      const existing = isStackable
        ? await Item.findOne({ owner: req.userId, name: listing.itemName, type: realType })
        : null;

      if (existing) {
        existing.quantity = (existing.quantity ?? 1) + 1;
        await existing.save();
      } else {
        await Item.create({
          owner: req.userId,
          name: listing.itemName,
          type: realType,
          rarity: listing.itemTier as "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "event",
          slot: shopDef?.slot ?? null,
          strengthBonus: shopDef?.strengthBonus ?? 0,
          charismaBonus: shopDef?.charismaBonus ?? 0,
          intelligenceBonus: shopDef?.intelligenceBonus ?? 0,
          streetCredBonus: shopDef?.streetCredBonus ?? 0,
          travelTimeReduction: shopDef?.travelTimeReduction ?? 0,
          effect: shopDef?.effect ?? null,
          description: shopDef?.description ?? "",
          imageUrl: shopDef?.imageUrl ?? null,
          quantity: 1,
          basePrice: listing.price,
        });
      }

      // Onboarding stage 1→2: buying any vehicle advances the player to stage 2
      if (realType === "vehicle") {
        const buyerFull = await User.findById(req.userId).select("onboardingStage username");
        if (buyerFull && (buyerFull.onboardingStage ?? 0) === 1) {
          User.findOneAndUpdate(
            { _id: req.userId, onboardingStage: 1 },
            { $set: { onboardingStage: 2 }, $inc: { dc: 500 } },
          ).catch(() => {});
          import("../../lib/notifyUser").then(({ notifyUser }) =>
            notifyUser({ userId: String(req.userId), type: "achievements", message: "Wheels acquired! 500 DC bonus. Now find a job — steady income matters." })
          ).catch(() => {});
          import("../../lib/economyLog").then(({ logEconomy }) =>
            logEconomy("dc_in", 500, "onboarding_stage2_reward", { userId: String(req.userId), username: buyerFull.username })
          ).catch(() => {});
        }
      }
    } else {
      // Add to arena inventory (PlayerMiniGameInventory)
      const itemDef = await MiniGameItem.findOne({ itemId: listing.itemId }).lean();
      if (itemDef) {
        const cat = (itemDef as any).category as string;
        const isAmmo = cat?.endsWith("_rounds") || cat === "shotgun_shells";
        if (isAmmo) {
          const ammoCategory = (itemDef as any).ammoCategory ?? cat;
          const mag = (itemDef as any).magazineSize ?? 10;
          await PlayerMiniGameInventory.findOneAndUpdate(
            { userId: req.userId },
            { $inc: { ["ammo." + ammoCategory]: mag }, $setOnInsert: { userId: req.userId } },
            { upsert: true }
          );
        } else {
          const isWeapon = ["pistol","smg","assault_rifle","shotgun","sniper_rifle","lmg"].includes(cat);
          const isArmor = cat === "body_armor" || cat === "armor";
          const slot = isWeapon ? "weapons" : isArmor ? "armor" : "consumables";
          await PlayerMiniGameInventory.findOneAndUpdate(
            { userId: req.userId },
            {
              $push: { [slot]: { itemId: listing.itemId, quantity: 1 } },
              $setOnInsert: { userId: req.userId },
            },
            { upsert: true }
          );
        }
      }
    }

    res.json({ message: "Purchased " + listing.itemName, dc: user.dc - listing.price });
  } catch (err: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
