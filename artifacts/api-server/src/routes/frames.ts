import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

export interface Frame {
  frameId: string;
  displayName: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  glowColor: string;
  animationType: "static" | "shimmer" | "pulse" | "rotate" | "flicker" | "matrix";
  price: number;
  currency: "dc" | "nc";
  isFree: boolean;
  description: string;
}

export const FRAME_CATALOG: Frame[] = [
  // Common — static
  { frameId: "ghostFrame",       displayName: "Ghost",            rarity: "common",   glowColor: "#64748b", animationType: "static",  price: 0,         currency: "dc", isFree: true,  description: "The default frame. Solid slate." },
  { frameId: "basicWhite",       displayName: "Basic White",      rarity: "common",   glowColor: "#e2e8f0", animationType: "static",  price: 500,       currency: "dc", isFree: false, description: "Clean white border." },
  { frameId: "basicGray",        displayName: "Basic Gray",       rarity: "common",   glowColor: "#94a3b8", animationType: "static",  price: 500,       currency: "dc", isFree: false, description: "Cool gray steel." },
  { frameId: "neonBlue",         displayName: "Neon Blue",        rarity: "common",   glowColor: "#3b82f6", animationType: "static",  price: 1000,      currency: "dc", isFree: false, description: "Bright blue static." },
  { frameId: "neonGreen",        displayName: "Neon Green",       rarity: "common",   glowColor: "#22c55e", animationType: "static",  price: 1000,      currency: "dc", isFree: false, description: "Grid hacker aesthetic." },
  { frameId: "neonRed",          displayName: "Neon Red",         rarity: "common",   glowColor: "#ef4444", animationType: "static",  price: 1000,      currency: "dc", isFree: false, description: "Street heat." },
  { frameId: "corpGray",         displayName: "Corp Gray",        rarity: "common",   glowColor: "#6b7280", animationType: "static",  price: 1500,      currency: "dc", isFree: false, description: "Corporate minimal." },
  { frameId: "streetOrange",     displayName: "Street Orange",    rarity: "common",   glowColor: "#ff6b35", animationType: "static",  price: 1500,      currency: "dc", isFree: false, description: "Syndicate street colours." },
  { frameId: "cyanPulse",        displayName: "Cyan Basic",       rarity: "common",   glowColor: "#00d4ff", animationType: "static",  price: 2000,      currency: "dc", isFree: false, description: "Data courier blue." },
  { frameId: "goldBasic",        displayName: "Gold Basic",       rarity: "common",   glowColor: "#f59e0b", animationType: "static",  price: 2000,      currency: "dc", isFree: false, description: "DC gold." },

  // Uncommon — shimmer
  { frameId: "shimmerCyan",      displayName: "Shimmer Cyan",     rarity: "uncommon", glowColor: "#00d4ff", animationType: "shimmer", price: 5000,      currency: "dc", isFree: false, description: "Slow sweep of electric cyan." },
  { frameId: "shimmerPurple",    displayName: "Shimmer Purple",   rarity: "uncommon", glowColor: "#a855f7", animationType: "shimmer", price: 5000,      currency: "dc", isFree: false, description: "Purple NC shimmer." },
  { frameId: "shimmerGold",      displayName: "Shimmer Gold",     rarity: "uncommon", glowColor: "#f59e0b", animationType: "shimmer", price: 6000,      currency: "dc", isFree: false, description: "Wealth shimmer." },
  { frameId: "shimmerRed",       displayName: "Shimmer Red",      rarity: "uncommon", glowColor: "#ff2d55", animationType: "shimmer", price: 6000,      currency: "dc", isFree: false, description: "Danger shimmer." },
  { frameId: "shimmerGreen",     displayName: "Shimmer Green",    rarity: "uncommon", glowColor: "#39d353", animationType: "shimmer", price: 6000,      currency: "dc", isFree: false, description: "Bounty shimmer." },
  { frameId: "shimmerOrange",    displayName: "Shimmer Orange",   rarity: "uncommon", glowColor: "#ff6b35", animationType: "shimmer", price: 6500,      currency: "dc", isFree: false, description: "Street shimmer." },
  { frameId: "techShimmer",      displayName: "Tech Shimmer",     rarity: "uncommon", glowColor: "#60a5fa", animationType: "shimmer", price: 7000,      currency: "dc", isFree: false, description: "Grid collective aesthetic." },
  { frameId: "suitShimmer",      displayName: "Suit Shimmer",     rarity: "uncommon", glowColor: "#e2e8f0", animationType: "shimmer", price: 7000,      currency: "dc", isFree: false, description: "Corporate shimmer." },
  { frameId: "crimsonShimmer",   displayName: "Crimson Shimmer",  rarity: "uncommon", glowColor: "#dc2626", animationType: "shimmer", price: 7500,      currency: "dc", isFree: false, description: "Bloodline shimmer." },
  { frameId: "iceShimmer",       displayName: "Ice Shimmer",      rarity: "uncommon", glowColor: "#e0f2fe", animationType: "shimmer", price: 7500,      currency: "dc", isFree: false, description: "Arctic cold." },

  // Rare — pulse
  { frameId: "pulseCyan",        displayName: "Pulse Cyan",       rarity: "rare",     glowColor: "#00d4ff", animationType: "pulse",   price: 25000,     currency: "dc", isFree: false, description: "Gentle pulse of electric blue." },
  { frameId: "pulsePurple",      displayName: "Pulse Purple",     rarity: "rare",     glowColor: "#a855f7", animationType: "pulse",   price: 25000,     currency: "dc", isFree: false, description: "NC credit pulse." },
  { frameId: "pulseGold",        displayName: "Pulse Gold",       rarity: "rare",     glowColor: "#f59e0b", animationType: "pulse",   price: 30000,     currency: "dc", isFree: false, description: "Wealth pulse." },
  { frameId: "pulseRed",         displayName: "Pulse Red",        rarity: "rare",     glowColor: "#ff2d55", animationType: "pulse",   price: 30000,     currency: "dc", isFree: false, description: "Danger pulse." },
  { frameId: "pulseGreen",       displayName: "Pulse Green",      rarity: "rare",     glowColor: "#39d353", animationType: "pulse",   price: 30000,     currency: "dc", isFree: false, description: "Success pulse." },
  { frameId: "hackerPulse",      displayName: "Hacker Pulse",     rarity: "rare",     glowColor: "#4ade80", animationType: "pulse",   price: 35000,     currency: "dc", isFree: false, description: "Terminal green pulse." },
  { frameId: "corePulse",        displayName: "Core Pulse",       rarity: "rare",     glowColor: "#818cf8", animationType: "pulse",   price: 35000,     currency: "dc", isFree: false, description: "Deep indigo pulse." },
  { frameId: "vaultPulse",       displayName: "Vault Pulse",      rarity: "rare",     glowColor: "#fbbf24", animationType: "pulse",   price: 40000,     currency: "dc", isFree: false, description: "Bank vault glow." },
  { frameId: "streetPulse",      displayName: "Street Pulse",     rarity: "rare",     glowColor: "#fb923c", animationType: "pulse",   price: 40000,     currency: "dc", isFree: false, description: "Underground pulse." },
  { frameId: "spectralPulse",    displayName: "Spectral Pulse",   rarity: "rare",     glowColor: "#e879f9", animationType: "pulse",   price: 45000,     currency: "dc", isFree: false, description: "Ghost channel." },

  // Epic — rotating gradient
  { frameId: "epicCyan",         displayName: "Epic Cyan",        rarity: "epic",     glowColor: "#00d4ff", animationType: "rotate",  price: 200000,    currency: "dc", isFree: false, description: "Rotating cyan gradient sweep." },
  { frameId: "epicPurple",       displayName: "Epic Purple",      rarity: "epic",     glowColor: "#a855f7", animationType: "rotate",  price: 200000,    currency: "dc", isFree: false, description: "Rotating NC gradient." },
  { frameId: "epicGold",         displayName: "Epic Gold",        rarity: "epic",     glowColor: "#f59e0b", animationType: "rotate",  price: 250000,    currency: "dc", isFree: false, description: "Rotating wealth gradient." },
  { frameId: "epicRed",          displayName: "Epic Red",         rarity: "epic",     glowColor: "#ff2d55", animationType: "rotate",  price: 250000,    currency: "dc", isFree: false, description: "Rotating danger." },
  { frameId: "syndicate",        displayName: "Syndicate",        rarity: "epic",     glowColor: "#ff6b35", animationType: "rotate",  price: 300000,    currency: "dc", isFree: false, description: "The Street's signature." },
  { frameId: "gridCore",         displayName: "Grid Core",        rarity: "epic",     glowColor: "#22d3ee", animationType: "rotate",  price: 300000,    currency: "dc", isFree: false, description: "Digital core rotation." },
  { frameId: "suitsFrame",       displayName: "The Suits",        rarity: "epic",     glowColor: "#94a3b8", animationType: "rotate",  price: 300000,    currency: "dc", isFree: false, description: "Corporate power rotation." },
  { frameId: "epicVoid",         displayName: "Void",             rarity: "epic",     glowColor: "#7c3aed", animationType: "rotate",  price: 350000,    currency: "dc", isFree: false, description: "Rotating dark matter." },
  { frameId: "epicInferno",      displayName: "Inferno",          rarity: "epic",     glowColor: "#ef4444", animationType: "rotate",  price: 350000,    currency: "dc", isFree: false, description: "Rotating fire gradient." },
  { frameId: "epicNova",         displayName: "Nova",             rarity: "epic",     glowColor: "#f0abfc", animationType: "rotate",  price: 400000,    currency: "dc", isFree: false, description: "Supernova gradient sweep." },

  // Legendary — electric flicker
  { frameId: "legendCyan",       displayName: "Lightning Cyan",   rarity: "legendary", glowColor: "#00d4ff", animationType: "flicker", price: 50,        currency: "nc", isFree: false, description: "Electric cyan flicker." },
  { frameId: "legendPurple",     displayName: "Lightning Purple", rarity: "legendary", glowColor: "#a855f7", animationType: "flicker", price: 75,        currency: "nc", isFree: false, description: "Electric NC flicker." },
  { frameId: "legendGold",       displayName: "Lightning Gold",   rarity: "legendary", glowColor: "#f59e0b", animationType: "flicker", price: 100,       currency: "nc", isFree: false, description: "Electric gold spark." },
  { frameId: "legendRed",        displayName: "Lightning Red",    rarity: "legendary", glowColor: "#ff2d55", animationType: "flicker", price: 100,       currency: "nc", isFree: false, description: "Electric danger." },
  { frameId: "crimsonLord",      displayName: "Crimson Lord",     rarity: "legendary", glowColor: "#b91c1c", animationType: "flicker", price: 125,       currency: "nc", isFree: false, description: "Blood-red lightning." },
  { frameId: "arcLight",         displayName: "Arc Light",        rarity: "legendary", glowColor: "#a5f3fc", animationType: "flicker", price: 125,       currency: "nc", isFree: false, description: "Pale arc flash." },
  { frameId: "plasmaBolt",       displayName: "Plasma Bolt",      rarity: "legendary", glowColor: "#d946ef", animationType: "flicker", price: 150,       currency: "nc", isFree: false, description: "Plasma discharge." },
  { frameId: "thunderClap",      displayName: "Thunderclap",      rarity: "legendary", glowColor: "#fde047", animationType: "flicker", price: 150,       currency: "nc", isFree: false, description: "Yellow static burst." },
  { frameId: "vantaLegend",      displayName: "Vanta Legend",     rarity: "legendary", glowColor: "#00d4ff", animationType: "flicker", price: 200,       currency: "nc", isFree: false, description: "New Vanta city electric." },
  { frameId: "executioner",      displayName: "Executioner",      rarity: "legendary", glowColor: "#ff2d55", animationType: "flicker", price: 200,       currency: "nc", isFree: false, description: "Death row glow." },

  // Mythic — matrix
  { frameId: "matrixGreen",      displayName: "Matrix",           rarity: "mythic",   glowColor: "#39d353", animationType: "matrix",  price: 500,       currency: "nc", isFree: false, description: "Falling code. The real one." },
  { frameId: "matrixBlue",       displayName: "Blue Code",        rarity: "mythic",   glowColor: "#00d4ff", animationType: "matrix",  price: 500,       currency: "nc", isFree: false, description: "Grid network cascade." },
  { frameId: "matrixGold",       displayName: "Golden Code",      rarity: "mythic",   glowColor: "#f59e0b", animationType: "matrix",  price: 600,       currency: "nc", isFree: false, description: "Wealth data stream." },
  { frameId: "matrixRed",        displayName: "Red Code",         rarity: "mythic",   glowColor: "#ff2d55", animationType: "matrix",  price: 600,       currency: "nc", isFree: false, description: "Virus cascade." },
  { frameId: "omega",            displayName: "Omega",            rarity: "mythic",   glowColor: "#a855f7", animationType: "matrix",  price: 750,       currency: "nc", isFree: false, description: "The end state. Mythic." },
  { frameId: "voidWalker",       displayName: "Void Walker",      rarity: "mythic",   glowColor: "#7c3aed", animationType: "matrix",  price: 750,       currency: "nc", isFree: false, description: "Phase through walls." },
  { frameId: "architect",        displayName: "Architect",        rarity: "mythic",   glowColor: "#e2e8f0", animationType: "matrix",  price: 1000,      currency: "nc", isFree: false, description: "The city's creator." },
  { frameId: "nova2047",         displayName: "Nova 2047",        rarity: "mythic",   glowColor: "#f0abfc", animationType: "matrix",  price: 1000,      currency: "nc", isFree: false, description: "New Vanta at its peak." },
  { frameId: "godMode",          displayName: "God Mode",         rarity: "mythic",   glowColor: "#fde047", animationType: "matrix",  price: 2000,      currency: "nc", isFree: false, description: "Cheat codes unlocked." },
  { frameId: "theOne",           displayName: "The One",          rarity: "mythic",   glowColor: "#00d4ff", animationType: "matrix",  price: 5000,      currency: "nc", isFree: false, description: "Only one player can hold this." },
];

// GET /api/frames — all frames + player's owned set
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select("ownedFrames equippedFrame equippedFrameRarity").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const ownedFrames: string[] = (user as any).ownedFrames || [];

    res.json(FRAME_CATALOG.map(f => ({
      ...f,
      owned: f.isFree || ownedFrames.includes(f.frameId),
      equipped: (user as any).equippedFrame === f.frameId,
    })));
  } catch (err: any) {
    req.log.error({ err }, "get frames error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/purchase/:frameId — buy a frame with DC or NC
router.post("/purchase/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frame = FRAME_CATALOG.find(f => f.frameId === req.params.frameId);
    if (!frame) return res.status(404).json({ message: "Frame not found" });
    if (frame.isFree) return res.status(400).json({ message: "This frame is free — equip it directly" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const owned: string[] = (user as any).ownedFrames || [];
    if (owned.includes(frame.frameId)) return res.status(400).json({ message: "You already own this frame" });

    if (frame.currency === "dc") {
      if (user.dc < frame.price) return res.status(400).json({ message: `Not enough DC. Costs ${frame.price.toLocaleString()} DC.` });
      user.dc -= frame.price;
    } else {
      if (user.nc < frame.price) return res.status(400).json({ message: `Not enough NC. Costs ${frame.price} NC.` });
      user.nc -= frame.price;
    }

    owned.push(frame.frameId);
    (user as any).ownedFrames = owned;
    await user.save();

    res.json({ message: `${frame.displayName} frame purchased`, frameId: frame.frameId, ownedFrames: owned });
  } catch (err: any) {
    req.log.error({ err }, "purchase frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/frames/equip/:frameId
router.post("/equip/:frameId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const frame = FRAME_CATALOG.find(f => f.frameId === req.params.frameId);
    if (!frame) return res.status(404).json({ message: "Frame not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const owned: string[] = (user as any).ownedFrames || [];
    if (!frame.isFree && !owned.includes(frame.frameId)) {
      return res.status(403).json({ message: "You don't own this frame" });
    }

    (user as any).equippedFrame = frame.frameId;
    (user as any).equippedFrameRarity = frame.rarity;
    await user.save();

    res.json({ equippedFrame: frame.frameId, equippedFrameRarity: frame.rarity });
  } catch (err: any) {
    req.log.error({ err }, "equip frame error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/frames/store — Phase 2 premium store placeholder
router.get("/store", requireAuth, async (_req, res) => {
  res.json({ message: "coming soon", frames: FRAME_CATALOG.filter(f => !f.isFree) });
});

export default router;
