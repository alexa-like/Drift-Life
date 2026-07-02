import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const PACK_COST = 500;
const PACK_XP = 10;

export interface CardDef {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "event";
  description: string;
  weight: number;
}

export const CARD_CATALOG: CardDef[] = [
  // Common (50%)
  { id: "street_rat",      name: "Street Rat",        rarity: "common",    description: "A hustler from the gutters of Residential North.", weight: 50 },
  { id: "burner_phone",    name: "Burner Phone",       rarity: "common",    description: "Untraceable. Disposable. Essential.",             weight: 50 },
  { id: "synth_coffee",    name: "Synth Coffee",       rarity: "common",    description: "Tastes like regret. Works like magic.",           weight: 50 },
  { id: "city_map",        name: "City Map",           rarity: "common",    description: "New Vanta's streets inked on nano-paper.",        weight: 50 },
  // Uncommon (25%)
  { id: "corp_badge",      name: "Corp Badge",         rarity: "uncommon",  description: "A forged Citadel Tower access card.",             weight: 25 },
  { id: "data_chip",       name: "Data Chip",          rarity: "uncommon",  description: "Encrypted. Could be worth millions. Could be empty.", weight: 25 },
  { id: "stray_doc",       name: "Stray Doc",          rarity: "uncommon",  description: "Case files that shouldn't exist.",                weight: 25 },
  // Rare (15%)
  { id: "blackout_suit",   name: "Blackout Suit",      rarity: "rare",      description: "Adaptive camo in jet-black nanoweave.",           weight: 15 },
  { id: "ghost_signal",    name: "Ghost Signal",       rarity: "rare",      description: "A mysterious transmission intercepted mid-air.",  weight: 15 },
  { id: "mama_nova",       name: "Mama Nova",          rarity: "rare",      description: "The matriarch of The Boulevard. She remembers.",  weight: 15 },
  // Epic (7%)
  { id: "director_webb",   name: "Director Webb",      rarity: "epic",      description: "The Suits' top enforcer. Ruthless. Precise.",     weight: 7 },
  { id: "grid_phantom",    name: "Grid Phantom",       rarity: "epic",      description: "A ghost in The Grid's architecture.",             weight: 7 },
  { id: "heist_blueprint", name: "Heist Blueprint",    rarity: "epic",      description: "Schematics for a job that never happened. Yet.", weight: 7 },
  // Legendary (3%)
  { id: "vanta_key",       name: "VANTA Key",          rarity: "legendary", description: "Rumored to unlock the city's hidden layer.",      weight: 3 },
  { id: "new_vanta_map",   name: "New Vanta 2047",     rarity: "legendary", description: "The full city. Every alley. Every secret.",       weight: 3 },
  // Event (1%)
  { id: "zero_day",        name: "Zero Day",           rarity: "event",     description: "The exploit that started it all.",                weight: 1 },
];

const totalWeight = CARD_CATALOG.reduce((s, c) => s + c.weight, 0);

function drawCard(): CardDef {
  let roll = Math.random() * totalWeight;
  for (const card of CARD_CATALOG) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return CARD_CATALOG[0];
}

// GET /api/cards/catalog
router.get("/catalog", requireAuth, (_req, res) => {
  res.json(CARD_CATALOG.map(({ weight: _w, ...c }) => c));
});

// GET /api/cards — my collection
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("cards dc");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ cards: user.cards ?? [], dc: user.dc, packCost: PACK_COST });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/cards/buy-pack
router.post("/buy-pack", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.dc < PACK_COST) return res.status(400).json({ message: `Costs ${PACK_COST} DC per pack` });

    const card = drawCard();
    user.dc -= PACK_COST;
    user.xp += PACK_XP;
    if (!user.cards) user.cards = [];
    user.cards.push({ cardId: card.id, name: card.name, rarity: card.rarity, obtainedAt: new Date() });
    await user.save();

    res.json({
      message: `You pulled: ${card.name}`,
      card: { cardId: card.id, name: card.name, rarity: card.rarity, description: card.description },
      xpGained: PACK_XP,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
