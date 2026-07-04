import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";

import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const MARKET_FEE = 0.05;

// Price overrides set by owner — in-memory, resets on restart
export const PRICE_OVERRIDES: Map<string, number> = new Map();

function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return (h % 89999) + 10000;
}

function img(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `cyberpunk New Vanta 2047 ${prompt}, neon glow dark background game item icon digital art`
  )}?width=256&height=256&nologo=true&seed=${strHash(prompt)}&model=turbo`;
}

export const SHOP_ITEMS: Array<{
  id: string; name: string;
  type: "weapon" | "armor" | "clothing" | "vehicle" | "consumable" | "material" | "badge" | "card" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "event";
  slot: "weapon" | "armor" | "clothing" | "vehicle" | null;
  strengthBonus: number; charismaBonus: number; intelligenceBonus: number;
  streetCredBonus: number; defenseBonus: number; travelEnergyReduction: number;
  basePrice: number; description: string; effect?: string; imageUrl: string;
}> = [
  // ── CONSUMABLES ──────────────────────────────────────────────────────────
  // Tier 1 — basic energy & health
  { id: "energy-drink",    name: "Energy Drink",    type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500,     description: "+15 Energy on use.",                        effect: "energy:15",               imageUrl: img("energy drink can neon glow electric blue") },
  { id: "med-patch",       name: "Med Patch",       type: "consumable", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500,     description: "+50 Health on use.",                        effect: "health:50",               imageUrl: img("medical skin patch blue healing glowing") },
  // Tier 2 — mid consumables
  { id: "stim-pack",       name: "Stim Pack",       type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2_000,   description: "+30 Energy on use.",                        effect: "energy:30",               imageUrl: img("stim injector syringe green glowing energy") },
  { id: "nerve-tonic",     name: "Nerve Tonic",     type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1_500,   description: "+20 Nerve on use.",                         effect: "nerve:20",                imageUrl: img("nerve tonic bottle purple glowing courage") },
  { id: "first-aid-kit",   name: "First Aid Kit",   type: "consumable", rarity: "uncommon",  slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 3_000,   description: "-30 minutes hospital time.",                effect: "hospital:-30",            imageUrl: img("first aid kit red cross glowing medical") },
  // Tier 3 — hospital clear
  { id: "trauma-kit",      name: "Trauma Kit",      type: "consumable", rarity: "rare",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 15_000,  description: "Clears hospitalization, restores full HP.", effect: "clear_hospital",          imageUrl: img("trauma kit red cross advanced clear hospital") },
  // Tier 4 — epic consumables
  { id: "nano-repair",     name: "Nano Repair",     type: "consumable", rarity: "epic",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 250_000, description: "-60% hospital time, +50 Energy.",           effect: "hospital_pct:-60,energy:50", imageUrl: img("nano repair injection blue nanobots swarm glowing") },
  { id: "combat-drug",     name: "Combat Drug",     type: "consumable", rarity: "epic",      slot: null, strengthBonus: 20, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 300_000, description: "+20 Strength for 1 hour.",                  effect: "strength_temp:20",        imageUrl: img("combat drug red vial glowing strength fight") },
  // Tier 5 — legendary
  { id: "legendary-elixir",name: "Legendary Elixir",type: "consumable", rarity: "legendary", slot: null, strengthBonus: 10, charismaBonus: 10, intelligenceBonus: 10, streetCredBonus: 10, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5_000_000, description: "+10 to all stats, +50 Energy, +20 Nerve.", effect: "all_stats:10,energy:50,nerve:20", imageUrl: img("legendary elixir golden vial glowing mythic all stats") },

  // ── WEAPONS ──────────────────────────────────────────────────────────────
  // Tier 1 — common street weapons
  { id: "rusty-blade",     name: "Rusty Blade",     type: "weapon", rarity: "common",    slot: "weapon", strengthBonus: 3,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 300,       description: "A dull street knife. Better than nothing.",      imageUrl: img("rusty jagged blade old worn street knife") },
  { id: "combat-knife",    name: "Combat Knife",    type: "weapon", rarity: "common",    slot: "weapon", strengthBonus: 5,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 1,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1_500,     description: "Fast and sharp. A street staple.",               imageUrl: img("combat knife blade tactical street glowing") },
  // Tier 2 — uncommon
  { id: "shock-glove",     name: "Shock Glove",     type: "weapon", rarity: "uncommon",  slot: "weapon", strengthBonus: 10, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 2,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8_000,     description: "Electrified knuckles. Stings a lot.",            imageUrl: img("shock glove electrified blue lightning knuckles cyber") },
  { id: "pistol",          name: "Pistol",          type: "weapon", rarity: "uncommon",  slot: "weapon", strengthBonus: 7,  charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20_000,    description: "Standard 9mm sidearm.",                          imageUrl: img("pistol handgun neon glow sidearm black") },
  // Tier 3 — rare
  { id: "tactical-shotgun",name: "Tactical Shotgun",type: "weapon", rarity: "rare",      slot: "weapon", strengthBonus: 12, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 1,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 40_000,    description: "Pump-action. Wide spread. Close range devastation.", imageUrl: img("tactical shotgun pump action neon orange") },
  { id: "neural-cutter",   name: "Neural Cutter",   type: "weapon", rarity: "rare",      slot: "weapon", strengthBonus: 18, charismaBonus: 0, intelligenceBonus: 3, streetCredBonus: 4,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 60_000,    description: "Monofilament blade with haptic feedback.",       imageUrl: img("neural cutter monofilament blade haptic cyber purple glow") },
  { id: "katana",          name: "Katana",          type: "weapon", rarity: "rare",      slot: "weapon", strengthBonus: 14, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 3,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 100_000,   description: "Traditional blade. Razor-edged. Respected.",     imageUrl: img("katana sword neon glow blade razor sharp") },
  // Tier 4 — epic
  { id: "sniper-rifle",    name: "Sniper Rifle",    type: "weapon", rarity: "epic",      slot: "weapon", strengthBonus: 16, charismaBonus: 0, intelligenceBonus: 8, streetCredBonus: 0,  defenseBonus: 0, travelEnergyReduction: 0, basePrice: 350_000,   description: "Long-range precision weapon. One shot.",         imageUrl: img("sniper rifle precision long range cyber scope glowing") },
  { id: "plasma-pistol",   name: "Plasma Pistol",   type: "weapon", rarity: "epic",      slot: "weapon", strengthBonus: 22, charismaBonus: 0, intelligenceBonus: 6, streetCredBonus: 10, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800_000,   description: "Micro-plasma discharge. Leaves burn marks.",     imageUrl: img("plasma pistol energy weapon purple glow discharge fire") },
  // Tier 5 — legendary
  { id: "railgun",         name: "Railgun",         type: "weapon", rarity: "legendary", slot: "weapon", strengthBonus: 35, charismaBonus: 0, intelligenceBonus: 12, streetCredBonus: 5, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 3_000_000, description: "Electromagnetic kinetic weapon. Corporate banned.", imageUrl: img("railgun electromagnetic kinetic weapon blue glow coil") },
  { id: "plasma-cannon",   name: "Plasma Cannon",   type: "weapon", rarity: "legendary", slot: "weapon", strengthBonus: 50, charismaBonus: 0, intelligenceBonus: 18, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 25_000_000, description: "Destroys everything in its path.",              imageUrl: img("plasma cannon legendary gold massive energy weapon destroy") },

  // ── ARMOR ────────────────────────────────────────────────────────────────
  { id: "leather-coat",      name: "Leather Coat",      type: "armor", rarity: "common",    slot: "armor", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 5,  travelEnergyReduction: 0, basePrice: 1_200,     description: "Thick synth-leather. Basic protection.",         imageUrl: img("leather coat synth dark street protection worn") },
  { id: "kevlar-vest",       name: "Kevlar Vest",       type: "armor", rarity: "uncommon",  slot: "armor", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 12, travelEnergyReduction: 0, basePrice: 8_000,     description: "Standard corporate-issue body armor.",           imageUrl: img("kevlar vest body armor tactical corporate black") },
  { id: "combat-rig",        name: "Combat Rig",        type: "armor", rarity: "rare",      slot: "armor", strengthBonus: 2, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 22, travelEnergyReduction: 0, basePrice: 60_000,    description: "Military exo-rig. Built for the front lines.",   imageUrl: img("combat exo rig military armor plates neon blue") },
  { id: "subdermal-plating", name: "Subdermal Plating", type: "armor", rarity: "epic",      slot: "armor", strengthBonus: 3, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 4, defenseBonus: 35, travelEnergyReduction: 0, basePrice: 500_000,   description: "Titanium mesh under the skin.",                  imageUrl: img("subdermal titanium plating implant body armor glowing cyan") },
  { id: "nanoweave-armor",   name: "Nanoweave Armor",   type: "armor", rarity: "legendary", slot: "armor", strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 5, streetCredBonus: 0, defenseBonus: 55, travelEnergyReduction: 0, basePrice: 8_000_000, description: "Self-sealing adaptive nanoweave. Near impenetrable.", imageUrl: img("nanoweave armor legendary gold adaptive seal glowing") },

  // ── CLOTHING ─────────────────────────────────────────────────────────────
  { id: "hoodie",           name: "Hoodie",           type: "clothing", rarity: "common",    slot: "clothing", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500,       description: "Stay low-profile.",                              imageUrl: img("hoodie street fashion neon hood anonymous dark") },
  { id: "street-jacket",    name: "Street Jacket",    type: "clothing", rarity: "common",    slot: "clothing", strengthBonus: 1, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 1, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1_500,     description: "Beat-up jacket with patches. Street credible.",  imageUrl: img("street jacket patches worn neon cyberpunk rebel") },
  { id: "designer-jacket",  name: "Designer Jacket",  type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 3, intelligenceBonus: 0, streetCredBonus: 1, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5_000,     description: "Limited-run drop piece. Turns heads.",           imageUrl: img("designer jacket luxury limited cyber fashion neon") },
  { id: "corpo-suit",       name: "Corp Suit",        type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 2, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8_000,     description: "Impeccably cut. Projects authority.",            imageUrl: img("corporate suit authority grey tailored neon") },
  { id: "leather-jacket",   name: "Leather Jacket",   type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 1, charismaBonus: 2, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 12_000,    description: "Classic rebel aesthetic.",                       imageUrl: img("leather jacket biker rebel neon cyber") },
  { id: "grid-outfit",      name: "Grid Outfit",      type: "clothing", rarity: "uncommon",  slot: "clothing", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 4, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 18_000,    description: "Hacker collective uniform.",                     imageUrl: img("grid hacker outfit uniform neon blue digital circuit") },
  { id: "tailored-suit",    name: "Tailored Suit",    type: "clothing", rarity: "rare",      slot: "clothing", strengthBonus: 0, charismaBonus: 6, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 60_000,    description: "Bespoke. Intimidating. Expensive.",              imageUrl: img("tailored suit bespoke elite luxury intimidating dark") },
  { id: "faction-outfit",   name: "Faction Outfit",   type: "clothing", rarity: "epic",      slot: "clothing", strengthBonus: 5, charismaBonus: 8, intelligenceBonus: 0, streetCredBonus: 8, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800_000,   description: "Gang colors. Respect multiplier.",               imageUrl: img("faction outfit gang colors neon respect street cyber") },
  { id: "nano-suit",        name: "Nano Suit",        type: "clothing", rarity: "epic",      slot: "clothing", strengthBonus: 5, charismaBonus: 2, intelligenceBonus: 8, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1_200_000, description: "Adaptive nano-fiber suit.",                      imageUrl: img("nano suit adaptive fiber armor blue glow advanced tech") },
  { id: "directors-suit",   name: "Director's Suit",  type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 18, intelligenceBonus: 12, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8_000_000, description: "Worn by those who run things.",                 imageUrl: img("directors suit legendary power gold charisma elite") },
  { id: "ceo-tuxedo",       name: "CEO Tuxedo",       type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 25, intelligenceBonus: 18, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20_000_000, description: "The pinnacle of corp fashion.",               imageUrl: img("ceo tuxedo pinnacle elite gold diamond legendary corp") },

  // ── VEHICLES ─────────────────────────────────────────────────────────────
  { id: "bicycle",     name: "Bicycle",      type: "vehicle", rarity: "common",    slot: "vehicle", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 5,  basePrice: 500,        description: "-5% travel energy. Pedal power.",              imageUrl: img("bicycle street transport neon minimal city") },
  { id: "motorcycle",  name: "Motorcycle",   type: "vehicle", rarity: "uncommon",  slot: "vehicle", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 20, basePrice: 12_000,     description: "-20% travel energy. Fast and loud.",           imageUrl: img("motorcycle speed neon cyber street fast chrome") },
  { id: "sports-car",  name: "Sports Car",   type: "vehicle", rarity: "rare",      slot: "vehicle", strengthBonus: 0, charismaBonus: 5, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 0, travelEnergyReduction: 35, basePrice: 150_000,    description: "-35% travel energy. Aerodynamic.",             imageUrl: img("sports car aerodynamic neon race speed cyber") },
  { id: "luxury-car",  name: "Luxury Car",   type: "vehicle", rarity: "rare",      slot: "vehicle", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 0, streetCredBonus: 3, defenseBonus: 0, travelEnergyReduction: 30, basePrice: 250_000,    description: "-30% travel energy. Bulletproof glass.",       imageUrl: img("luxury car gold neon bulletproof elite sedan") },
  { id: "hoverbike",   name: "Hoverbike",    type: "vehicle", rarity: "epic",      slot: "vehicle", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 5, streetCredBonus: 5, defenseBonus: 0, travelEnergyReduction: 50, basePrice: 1_500_000,  description: "-50% travel energy. Mag-lev. No wheels.",      imageUrl: img("hoverbike levitating mag-lev blue glow float cyber") },
  { id: "armored-limo",name: "Armored Limo", type: "vehicle", rarity: "legendary", slot: "vehicle", strengthBonus: 5, charismaBonus: 15, intelligenceBonus: 0, streetCredBonus: 8, defenseBonus: 0, travelEnergyReduction: 30, basePrice: 15_000_000, description: "-30% travel energy. Mobile fortress.",         imageUrl: img("armored limousine gold neon elite fortress dark") },

  // ── CRAFTING MATERIALS ───────────────────────────────────────────────────
  { id: "scrap-metal",   name: "Scrap Metal",   type: "material", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 100,    description: "Salvaged from the ruins. Used in crafting.",    imageUrl: img("scrap metal salvage pile rust worn industrial") },
  { id: "fabric",        name: "Fabric",        type: "material", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 100,    description: "Textile roll for crafting gear.",               imageUrl: img("fabric roll textile craft material neon thread") },
  { id: "chemicals",     name: "Chemicals",     type: "material", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 150,    description: "Industrial chemicals. Handle with care.",       imageUrl: img("chemical container green liquid glowing danger") },
  { id: "electronics",   name: "Electronics",   type: "material", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 200,    description: "Circuit boards and chips.",                     imageUrl: img("circuit board electronics chips neon blue glow") },
  { id: "leather",       name: "Leather",       type: "material", rarity: "common",    slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 120,    description: "Synth-leather strips.",                         imageUrl: img("leather material synth strip craft dark brown") },
  { id: "rare-metal",    name: "Rare Metal",    type: "material", rarity: "rare",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2_000,  description: "Exotic alloy for high-end crafting.",           imageUrl: img("rare metal ingot exotic alloy blue glow ingot") },
  { id: "nano-materials",name: "Nano Materials",type: "material", rarity: "epic",      slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 25_000, description: "Self-assembling nano-particles.",               imageUrl: img("nano materials purple particles self-assembling glow swarm") },
];

// GET /api/market/shop
router.get("/shop", requireAuth, async (_req, res) => {
  res.json(SHOP_ITEMS.map(i => ({
    id: i.id, name: i.name, type: i.type, rarity: i.rarity, slot: i.slot,
    strengthBonus: i.strengthBonus, charismaBonus: i.charismaBonus,
    intelligenceBonus: i.intelligenceBonus, streetCredBonus: i.streetCredBonus,
    defenseBonus: i.defenseBonus, travelEnergyReduction: i.travelEnergyReduction,
    basePrice: i.basePrice,
    price: PRICE_OVERRIDES.get(i.id) ?? i.basePrice,
    description: i.description,
    effect: i.effect ?? null, imageUrl: i.imageUrl,
  })));
});

// POST /api/market/shop/buy
router.post("/shop/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
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
      defenseBonus: shopItem.defenseBonus,
      travelEnergyReduction: shopItem.travelEnergyReduction,
      basePrice: shopItem.basePrice,
      description: shopItem.description,
      effect: shopItem.effect ?? null,
      imageUrl: shopItem.imageUrl,
      blackMarket: false,
    };

    if (shopItem.type === "consumable" || shopItem.type === "material") {
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

// GET /api/market/listings — auto-expires listings older than 30 days
router.get("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Expire stale listings silently
    await Item.updateMany(
      { marketListed: true, marketListedAt: { $lt: thirtyDaysAgo } },
      { $set: { marketListed: false, marketPrice: null, marketListedAt: null } }
    );
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
      defenseBonus: i.defenseBonus,
      travelEnergyReduction: i.travelEnergyReduction,
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
router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { itemId, price } = req.body;
    if (!itemId || !price || price < 1) return res.status(400).json({ message: "itemId and price required" });

    const item = await Item.findOne({ _id: itemId, owner: req.userId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.equipped) return res.status(400).json({ message: "Unequip the item first" });
    if (item.marketListed) return res.status(400).json({ message: "Already listed" });
    if (item.type === "consumable" || item.type === "material") return res.status(400).json({ message: "Cannot list consumables or materials" });

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

// POST /api/market/listings/:id/buy — buy a P2P listing
router.post("/listings/:id/buy", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, marketListed: true });
    if (!item) return res.status(404).json({ message: "Listing not found or already sold" });
    if (item.owner.equals(req.userId as string)) return res.status(400).json({ message: "Cannot buy your own item" });

    const price = item.marketPrice ?? 0;

    const [buyer, seller] = await Promise.all([
      User.findById(req.userId),
      User.findById(item.owner),
    ]);

    if (!buyer || !seller) return res.status(404).json({ message: "User not found" });
    if (buyer.dc < price) return res.status(400).json({ message: `Not enough DC. Price: ${price.toLocaleString()} DC` });

    const fee = Math.floor(price * MARKET_FEE);
    const sellerProfit = price - fee;

    buyer.dc -= price;
    seller.dc += sellerProfit;

    item.owner = buyer._id;
    item.marketListed = false;
    item.marketPrice = null;
    item.marketListedAt = null;
    item.equipped = false;

    await Promise.all([buyer.save(), seller.save(), item.save()]);

    // market purchases are private — no feed post

    res.json({ message: `Purchased ${item.name} for ${price.toLocaleString()} DC`, dc: buyer.dc });
  } catch (err: any) {
    req.log.error({ err }, "buy listing error");
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
    return res.json({ message: `Price override cleared for ${itemId}` });
  }

  if (price < 0) return res.status(400).json({ message: "Price must be >= 0" });
  PRICE_OVERRIDES.set(itemId, price);
  res.json({ message: `Price of ${itemId} set to ${price} DC` });
});

export default router;
