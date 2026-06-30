import { Router } from "express";
import User from "../models/User";
import Item from "../models/Item";
import FeedEvent from "../models/FeedEvent";
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
  { id: "street-food", name: "Street Food", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 250, description: "+5 Energy on use.", effect: "energy:5", imageUrl: img("noodle box street food glowing container") },
  { id: "energy-drink", name: "Energy Drink", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500, description: "+10 Energy on use.", effect: "energy:10", imageUrl: img("energy drink can neon glow electric") },
  { id: "bandage", name: "Bandage", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 300, description: "-10 minutes hospital time.", effect: "hospital:-10", imageUrl: img("medical bandage glowing blue healing") },
  { id: "painkillers", name: "Painkillers", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 400, description: "+5 Nerve on use.", effect: "nerve:5", imageUrl: img("painkiller pill bottle amber neon") },
  { id: "first-aid-kit", name: "First Aid Kit", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1000, description: "-20 minutes hospital time.", effect: "hospital:-20", imageUrl: img("first aid kit red cross glowing medical") },
  { id: "stim-pack", name: "Stim Pack", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 150, description: "+30 Energy on use.", effect: "energy:30", imageUrl: img("stim injector syringe green glowing energy") },
  { id: "med-patch", name: "Med Patch", type: "consumable", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 200, description: "+50 Health on use.", effect: "health:50", imageUrl: img("medical skin patch blue healing glowing") },
  { id: "nerve-tonic", name: "Nerve Tonic", type: "consumable", rarity: "uncommon", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 350, description: "+20 Nerve on use.", effect: "nerve:20", imageUrl: img("nerve tonic bottle purple glowing courage") },
  { id: "protein-bar", name: "Protein Bar", type: "consumable", rarity: "uncommon", slot: null, strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2000, description: "+15 Energy, +5 Strength for 1 hour.", effect: "energy:15,strength_temp:5", imageUrl: img("futuristic protein nutrition bar glowing") },
  { id: "adrenaline-shot", name: "Adrenaline Shot", type: "consumable", rarity: "uncommon", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5000, description: "+20 Energy on use.", effect: "energy:20", imageUrl: img("adrenaline shot syringe red glowing inject") },
  { id: "stimulant-pack", name: "Stimulant Pack", type: "consumable", rarity: "uncommon", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8000, description: "+15 Energy, +10 Nerve on use.", effect: "energy:15,nerve:10", imageUrl: img("stimulant drug pack orange glowing cyber") },
  { id: "medical-kit", name: "Medical Kit", type: "consumable", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 25000, description: "-50 minutes hospital time.", effect: "hospital:-50", imageUrl: img("advanced medical kit blue glowing hospital") },
  { id: "super-stimulant", name: "Super Stimulant", type: "consumable", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 30000, description: "+30 Energy, +15 Nerve on use.", effect: "energy:30,nerve:15", imageUrl: img("super stimulant rare drug vial cyan glow") },
  { id: "trauma-kit", name: "Trauma Kit", type: "consumable", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800, description: "Clears hospitalization, restores full HP.", effect: "clear_hospital", imageUrl: img("trauma kit red cross advanced clear hospital") },
  { id: "nano-repair", name: "Nano Repair", type: "consumable", rarity: "epic", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 250000, description: "-60% hospital time, +50 Energy.", effect: "hospital_pct:-60,energy:50", imageUrl: img("nano repair injection blue nanobots swarm glowing") },
  { id: "combat-drug", name: "Combat Drug", type: "consumable", rarity: "epic", slot: null, strengthBonus: 20, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 300000, description: "+20 Strength for 1 hour.", effect: "strength_temp:20", imageUrl: img("combat drug red vial glowing strength") },
  { id: "legendary-elixir", name: "Legendary Elixir", type: "consumable", rarity: "legendary", slot: null, strengthBonus: 10, charismaBonus: 10, intelligenceBonus: 10, streetCredBonus: 10, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5000000, description: "+10 to all stats, +50 Energy, +20 Nerve.", effect: "all_stats:10,energy:50,nerve:20", imageUrl: img("legendary elixir golden vial glowing mythic all stats") },
  { id: "phoenix-down", name: "Phoenix Down", type: "consumable", rarity: "legendary", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8000000, description: "Instantly removes hospitalization.", effect: "clear_hospital", imageUrl: img("phoenix down golden feather revival instant") },
  { id: "event-cake", name: "Event Cake", type: "consumable", rarity: "event", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 9999, description: "+50 Energy, +50 Nerve.", effect: "energy:50,nerve:50", imageUrl: img("birthday cake neon cyber celebration party") },

  // ── WEAPONS ──────────────────────────────────────────────────────────────
  { id: "brass-knuckles", name: "Brass Knuckles", type: "weapon", rarity: "common", slot: "weapon", strengthBonus: 2, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1000, description: "Metal reinforced knuckles.", imageUrl: img("brass knuckles metal street weapon fighter") },
  { id: "baseball-bat", name: "Baseball Bat", type: "weapon", rarity: "common", slot: "weapon", strengthBonus: 3, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800, description: "Old-fashioned but effective.", imageUrl: img("baseball bat street weapon neon scratched") },
  { id: "combat-knife", name: "Combat Knife", type: "weapon", rarity: "common", slot: "weapon", strengthBonus: 2, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 1, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1200, description: "Fast and sharp.", imageUrl: img("combat knife blade tactical street glowing") },
  { id: "rusty-blade", name: "Rusty Blade", type: "weapon", rarity: "common", slot: "weapon", strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 300, description: "A dull street knife. Better than nothing.", imageUrl: img("rusty jagged blade old worn street") },
  { id: "pistol", name: "Pistol", type: "weapon", rarity: "uncommon", slot: "weapon", strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 15000, description: "Standard 9mm sidearm.", imageUrl: img("pistol handgun neon glow sidearm") },
  { id: "tactical-shotgun", name: "Tactical Shotgun", type: "weapon", rarity: "uncommon", slot: "weapon", strengthBonus: 6, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 22000, description: "Pump-action. Wide spread.", imageUrl: img("tactical shotgun pump action neon") },
  { id: "shock-glove", name: "Shock Glove", type: "weapon", rarity: "uncommon", slot: "weapon", strengthBonus: 12, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 2, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800, description: "Electrified knuckles. Stings a bit.", imageUrl: img("shock glove electrified blue lightning knuckles") },
  { id: "katana", name: "Katana", type: "weapon", rarity: "rare", slot: "weapon", strengthBonus: 8, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 80000, description: "Traditional blade, razor-edged.", imageUrl: img("katana sword neon glow blade razor") },
  { id: "sniper-rifle", name: "Sniper Rifle", type: "weapon", rarity: "rare", slot: "weapon", strengthBonus: 7, charismaBonus: 0, intelligenceBonus: 3, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 95000, description: "Long-range precision weapon.", imageUrl: img("sniper rifle precision long range cyber scope") },
  { id: "neural-cutter", name: "Neural Cutter", type: "weapon", rarity: "rare", slot: "weapon", strengthBonus: 22, charismaBonus: 0, intelligenceBonus: 3, streetCredBonus: 5, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2000, description: "Monofilament blade with haptic feedback.", imageUrl: img("neural cutter monofilament blade haptic cyber purple") },
  { id: "plasma-pistol", name: "Plasma Pistol", type: "weapon", rarity: "epic", slot: "weapon", strengthBonus: 15, charismaBonus: 0, intelligenceBonus: 5, streetCredBonus: 10, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800000, description: "Micro-plasma discharge. Leaves burn marks.", imageUrl: img("plasma pistol energy weapon purple glow discharge") },
  { id: "railgun", name: "Railgun", type: "weapon", rarity: "epic", slot: "weapon", strengthBonus: 20, charismaBonus: 0, intelligenceBonus: 10, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2000000, description: "Electromagnetic kinetic weapon.", imageUrl: img("railgun electromagnetic kinetic weapon blue glow coil") },
  { id: "plasma-cannon", name: "Plasma Cannon", type: "weapon", rarity: "legendary", slot: "weapon", strengthBonus: 30, charismaBonus: 0, intelligenceBonus: 15, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 25000000, description: "Destroys everything in its path.", imageUrl: img("plasma cannon legendary gold massive energy weapon") },

  // ── ARMOR ────────────────────────────────────────────────────────────────
  { id: "leather-coat", name: "Leather Coat", type: "armor", rarity: "common", slot: "armor", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 4, travelEnergyReduction: 0, basePrice: 250, description: "Thick synth-leather. Basic protection.", imageUrl: img("leather coat synth dark street protection") },
  { id: "kevlar-vest", name: "Kevlar Vest", type: "armor", rarity: "uncommon", slot: "armor", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 10, travelEnergyReduction: 0, basePrice: 900, description: "Standard corporate-issue body armor.", imageUrl: img("kevlar vest body armor tactical corporate") },
  { id: "subdermal-plating", name: "Subdermal Plating", type: "armor", rarity: "rare", slot: "armor", strengthBonus: 2, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 3, defenseBonus: 20, travelEnergyReduction: 0, basePrice: 2500, description: "Titanium mesh under the skin.", imageUrl: img("subdermal titanium plating implant body armor glowing") },

  // ── CLOTHING ─────────────────────────────────────────────────────────────
  { id: "basic-tee", name: "Basic Tee", type: "clothing", rarity: "common", slot: "clothing", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 250, description: "Plain tee. No frills.", imageUrl: img("basic t-shirt street fashion minimal") },
  { id: "hoodie", name: "Hoodie", type: "clothing", rarity: "common", slot: "clothing", strengthBonus: 0, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500, description: "Stay low-profile.", imageUrl: img("hoodie street fashion neon hood anonymous") },
  { id: "street-jacket", name: "Street Jacket", type: "clothing", rarity: "common", slot: "clothing", strengthBonus: 1, charismaBonus: 1, intelligenceBonus: 0, streetCredBonus: 1, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 750, description: "Beat-up jacket with patches.", imageUrl: img("street jacket patches worn neon cyberpunk") },
  { id: "designer-jacket", name: "Designer Jacket", type: "clothing", rarity: "uncommon", slot: "clothing", strengthBonus: 0, charismaBonus: 3, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5000, description: "Limited-run drop piece.", imageUrl: img("designer jacket luxury limited cyber fashion") },
  { id: "leather-jacket", name: "Leather Jacket", type: "clothing", rarity: "uncommon", slot: "clothing", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 0, streetCredBonus: 1, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8000, description: "Classic rebel aesthetic.", imageUrl: img("leather jacket biker rebel neon cyber") },
  { id: "grid-outfit", name: "Grid Outfit", type: "clothing", rarity: "uncommon", slot: "clothing", strengthBonus: 0, charismaBonus: 2, intelligenceBonus: 3, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 12000, description: "Hacker collective uniform.", imageUrl: img("grid hacker outfit uniform neon blue digital") },
  { id: "corpo-suit", name: "Corp Suit", type: "clothing", rarity: "uncommon", slot: "clothing", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 2, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 600, description: "Impeccably cut suit. Projects authority.", imageUrl: img("corporate suit authority grey tailored") },
  { id: "tactical-vest", name: "Tactical Vest", type: "clothing", rarity: "rare", slot: "clothing", strengthBonus: 3, charismaBonus: 2, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 40000, description: "Multi-pocket combat vest.", imageUrl: img("tactical vest military combat multipocket") },
  { id: "tailored-suit", name: "Tailored Suit", type: "clothing", rarity: "rare", slot: "clothing", strengthBonus: 0, charismaBonus: 5, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 50000, description: "Bespoke. Intimidating.", imageUrl: img("tailored suit bespoke elite luxury intimidating") },
  { id: "nano-suit", name: "Nano Suit", type: "clothing", rarity: "epic", slot: "clothing", strengthBonus: 5, charismaBonus: 0, intelligenceBonus: 5, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 1200000, description: "Adaptive nano-fiber armor suit.", imageUrl: img("nano suit adaptive fiber armor blue glow advanced") },
  { id: "faction-outfit", name: "Faction Outfit", type: "clothing", rarity: "epic", slot: "clothing", strengthBonus: 5, charismaBonus: 8, intelligenceBonus: 0, streetCredBonus: 5, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 800000, description: "Gang colors. Respect multiplier.", imageUrl: img("faction outfit gang colors neon respect street") },
  { id: "directors-suit", name: "Director's Suit", type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 15, intelligenceBonus: 10, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 8000000, description: "Worn by those who run things.", imageUrl: img("directors suit legendary power gold charisma") },
  { id: "ceo-tuxedo", name: "CEO Tuxedo", type: "clothing", rarity: "legendary", slot: "clothing", strengthBonus: 0, charismaBonus: 20, intelligenceBonus: 15, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20000000, description: "The pinnacle of corp fashion.", imageUrl: img("ceo tuxedo pinnacle elite gold diamond legendary") },

  // ── VEHICLES ─────────────────────────────────────────────────────────────
  { id: "bicycle", name: "Bicycle", type: "vehicle", rarity: "common", slot: "vehicle", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 5, basePrice: 500, description: "-5% travel energy. Pedal power.", imageUrl: img("bicycle street transport neon minimal") },
  { id: "motorcycle", name: "Motorcycle", type: "vehicle", rarity: "uncommon", slot: "vehicle", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 15, basePrice: 5000, description: "-15% travel energy. Fast and loud.", imageUrl: img("motorcycle speed neon cyber street fast") },
  { id: "sports-car", name: "Sports Car", type: "vehicle", rarity: "rare", slot: "vehicle", strengthBonus: 0, charismaBonus: 5, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 35, basePrice: 100000, description: "-35% travel energy. Aerodynamic hypercar.", imageUrl: img("sports car aerodynamic neon race speed") },
  { id: "luxury-car", name: "Luxury Car", type: "vehicle", rarity: "rare", slot: "vehicle", strengthBonus: 0, charismaBonus: 8, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 30, basePrice: 150000, description: "-30% travel energy. Bulletproof glass.", imageUrl: img("luxury car gold neon bulletproof elite") },
  { id: "hoverbike", name: "Hoverbike", type: "vehicle", rarity: "epic", slot: "vehicle", strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 5, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 45, basePrice: 1500000, description: "-45% travel energy. Mag-lev. No wheels.", imageUrl: img("hoverbike levitating mag-lev blue glow float") },
  { id: "armored-limo", name: "Armored Limo", type: "vehicle", rarity: "legendary", slot: "vehicle", strengthBonus: 5, charismaBonus: 15, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 30, basePrice: 15000000, description: "-30% travel energy. Mobile fortress.", imageUrl: img("armored limousine gold neon elite fortress") },

  // ── MATERIALS ────────────────────────────────────────────────────────────
  { id: "scrap-metal", name: "Scrap Metal", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 100, description: "Salvaged from the ruins.", imageUrl: img("scrap metal salvage pile rust worn") },
  { id: "fabric", name: "Fabric", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 100, description: "Textile for crafting.", imageUrl: img("fabric roll textile craft material") },
  { id: "chemicals", name: "Chemicals", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 150, description: "Industrial chemicals.", imageUrl: img("chemical container green liquid glowing") },
  { id: "electronics", name: "Electronics", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 200, description: "Circuit boards and chips.", imageUrl: img("circuit board electronics chips neon") },
  { id: "leather", name: "Leather", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 120, description: "Synth-leather strips.", imageUrl: img("leather material synth strip craft") },
  { id: "wood", name: "Wood", type: "material", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 80, description: "Rare natural material in 2047.", imageUrl: img("wood plank rare natural material 2047") },
  { id: "rare-metal", name: "Rare Metal", type: "material", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 2000, description: "Exotic alloy for high-end crafting.", imageUrl: img("rare metal ingot exotic alloy blue glow") },
  { id: "nano-materials", name: "Nano Materials", type: "material", rarity: "epic", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 25000, description: "Self-assembling nano-particles.", imageUrl: img("nano materials purple particles self-assembling glow") },
  { id: "legendary-core", name: "Legendary Core", type: "material", rarity: "legendary", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 500000, description: "Core energy cell of unknown origin.", imageUrl: img("legendary core energy crystal gold glowing origin") },

  // ── BADGES ───────────────────────────────────────────────────────────────
  { id: "badge-newbie", name: "Newbie Badge", type: "badge", rarity: "common", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 0, description: "Awarded on first login.", imageUrl: img("newbie badge star award beginner") },
  { id: "badge-crime-lord", name: "Crime Lord Badge", type: "badge", rarity: "uncommon", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 0, description: "Complete 10 crimes.", imageUrl: img("crime lord badge skull neon red") },
  { id: "badge-rich-kid", name: "Rich Kid Badge", type: "badge", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 0, description: "Accumulate 1,000,000 DC.", imageUrl: img("rich kid badge gold money wealth") },
  { id: "badge-centurion", name: "Centurion Badge", type: "badge", rarity: "legendary", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 0, description: "Reach Level 100.", imageUrl: img("centurion badge level 100 legendary warrior") },
  { id: "badge-ultimate", name: "Ultimate Badge", type: "badge", rarity: "legendary", slot: null, strengthBonus: 5, charismaBonus: 5, intelligenceBonus: 5, streetCredBonus: 5, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 0, description: "+5 all stats permanently.", imageUrl: img("ultimate badge all stats legendary rainbow glow") },

  // ── CHARACTER CARDS ───────────────────────────────────────────────────────
  { id: "card-director-webb", name: "Director Webb Card", type: "card", rarity: "epic", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 50000, description: "CEO of NovaCorp. Ruthless.", imageUrl: img("director webb card corporate boss suit ruthless") },
  { id: "card-mama-nova", name: "Mama Nova Card", type: "card", rarity: "epic", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 50000, description: "Underground fixer queen.", imageUrl: img("mama nova card underground fixer woman queen cyber") },
  { id: "card-ghost", name: "Ghost Card", type: "card", rarity: "epic", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 50000, description: "Elite hacker. Never seen.", imageUrl: img("ghost card hacker elite anonymous shadow cyber") },
  { id: "card-chief-ralston", name: "Chief Ralston Card", type: "card", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20000, description: "NVPD Chief. Corrupt but fair.", imageUrl: img("chief ralston card police chief corrupt cyber") },
  { id: "card-cleo", name: "Cleo Card", type: "card", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20000, description: "Syndicate enforcer.", imageUrl: img("cleo card syndicate enforcer woman cyber neon") },
  { id: "card-marco", name: "Marco Card", type: "card", rarity: "rare", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 20000, description: "Street gang leader.", imageUrl: img("marco card street gang leader tattoo cyber") },
  { id: "card-city-legend", name: "City Legend Card", type: "card", rarity: "legendary", slot: null, strengthBonus: 0, charismaBonus: 0, intelligenceBonus: 0, streetCredBonus: 0, defenseBonus: 0, travelEnergyReduction: 0, basePrice: 5000000, description: "The card of urban legend.", imageUrl: img("city legend card mythic urban legend glow gold") },
];

// GET /api/market/shop
router.get("/shop", requireAuth, async (_req, res) => {
  res.json(SHOP_ITEMS.map(i => ({
    id: i.id, name: i.name, type: i.type, rarity: i.rarity, slot: i.slot,
    strengthBonus: i.strengthBonus, charismaBonus: i.charismaBonus,
    intelligenceBonus: i.intelligenceBonus, streetCredBonus: i.streetCredBonus,
    defenseBonus: i.defenseBonus, travelEnergyReduction: i.travelEnergyReduction,
    basePrice: PRICE_OVERRIDES.get(i.id) ?? i.basePrice,
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
    if (user.dc < totalCost) return res.status(400).json({ message: `Not enough DC. Costs ${totalCost} DC.` });

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
      imageUrl: i.imageUrl ?? null,
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

// POST /api/market/cancel/:id — cancel listing (alias)
router.post("/cancel/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, owner: req.userId, marketListed: true });
    if (!item) return res.status(404).json({ message: "Listing not found" });
    item.marketListed = false;
    item.marketPrice = null;
    item.marketListedAt = null;
    await item.save();
    res.json({ message: `${item.name} delisted` });
  } catch (err: any) {
    req.log.error({ err }, "cancel listing error");
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
    seller.dc = Math.min(seller.dc + sellerReceives, 100_000_000);

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
