export type FrameRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface FrameDef {
  id: string;
  name: string;
  rarity: FrameRarity;
  glowColor: string;
  ncCost: number; // 0 = free
  earnedBy?: string; // description if achievement-only
}

export const FRAME_CATALOG: FrameDef[] = [
  // COMMON — Static Border, Free
  { id: "neonPulse",     name: "Neon Pulse",    rarity: "common",    glowColor: "#6B7280", ncCost: 0 },
  { id: "ironBorder",    name: "Iron Border",   rarity: "common",    glowColor: "#78716C", ncCost: 0 },
  { id: "copperRing",    name: "Copper Ring",   rarity: "common",    glowColor: "#B45309", ncCost: 0 },
  { id: "stonewall",     name: "Stonewall",     rarity: "common",    glowColor: "#57534E", ncCost: 0 },
  { id: "asphalt",       name: "Asphalt",       rarity: "common",    glowColor: "#44403C", ncCost: 0 },
  { id: "coldSteel",     name: "Cold Steel",    rarity: "common",    glowColor: "#475569", ncCost: 0 },
  { id: "graphene",      name: "Graphene",      rarity: "common",    glowColor: "#1E293B", ncCost: 0 },
  { id: "sandDune",      name: "Sand Dune",     rarity: "common",    glowColor: "#92400E", ncCost: 0 },
  { id: "rustBelt",      name: "Rust Belt",     rarity: "common",    glowColor: "#9A3412", ncCost: 0 },
  { id: "voidRim",       name: "Void Rim",      rarity: "common",    glowColor: "#0F172A", ncCost: 0 },
  { id: "ghostFrame",    name: "Ghost Frame",   rarity: "common",    glowColor: "#E2E8F0", ncCost: 0 },
  { id: "concrete",      name: "Concrete",      rarity: "common",    glowColor: "#94A3B8", ncCost: 0 },
  { id: "basicBlue",     name: "Basic Blue",    rarity: "common",    glowColor: "#2563EB", ncCost: 0 },
  // COMMON — Paid
  { id: "silverEdge",    name: "Silver Edge",   rarity: "common",    glowColor: "#9CA3AF", ncCost: 50 },
  { id: "plainGold",     name: "Plain Gold",    rarity: "common",    glowColor: "#CA8A04", ncCost: 50 },
  // UNCOMMON — Slow Shimmer, Free
  { id: "gradientShift", name: "Gradient Shift",rarity: "uncommon",  glowColor: "#10B981", ncCost: 0 },
  { id: "oceanBreeze",   name: "Ocean Breeze",  rarity: "uncommon",  glowColor: "#0EA5E9", ncCost: 0 },
  { id: "midnightWave",  name: "Midnight Wave", rarity: "uncommon",  glowColor: "#1D4ED8", ncCost: 0 },
  { id: "forestEdge",    name: "Forest Edge",   rarity: "uncommon",  glowColor: "#166534", ncCost: 0 },
  { id: "iceBlue",       name: "Ice Blue",      rarity: "uncommon",  glowColor: "#BAE6FD", ncCost: 0 },
  { id: "springMint",    name: "Spring Mint",   rarity: "uncommon",  glowColor: "#34D399", ncCost: 0 },
  { id: "vintageCopper", name: "Vintage Copper",rarity: "uncommon",  glowColor: "#C2410C", ncCost: 0 },
  // UNCOMMON — Paid
  { id: "mossGlow",      name: "Moss Glow",     rarity: "uncommon",  glowColor: "#16A34A", ncCost: 75 },
  { id: "roseGold",      name: "Rose Gold",     rarity: "uncommon",  glowColor: "#FB7185", ncCost: 75 },
  { id: "amberGlow",     name: "Amber Glow",    rarity: "uncommon",  glowColor: "#D97706", ncCost: 75 },
  { id: "lavenderMist",  name: "Lavender Mist", rarity: "uncommon",  glowColor: "#A78BFA", ncCost: 75 },
  { id: "citrusBurst",   name: "Citrus Burst",  rarity: "uncommon",  glowColor: "#F97316", ncCost: 75 },
  { id: "crimsonEdge",   name: "Crimson Edge",  rarity: "uncommon",  glowColor: "#DC2626", ncCost: 75 },
  { id: "desertSun",     name: "Desert Sun",    rarity: "uncommon",  glowColor: "#FCD34D", ncCost: 75 },
  { id: "duskPurple",    name: "Dusk Purple",   rarity: "uncommon",  glowColor: "#7C3AED", ncCost: 75 },
  // RARE — Pulse Glow, Free
  { id: "rippleRing",    name: "Ripple Ring",   rarity: "rare",      glowColor: "#38BDF8", ncCost: 0 },
  { id: "glitchShake",   name: "Glitch Shake",  rarity: "rare",      glowColor: "#22D3EE", ncCost: 0 },
  { id: "frostbite",     name: "Frostbite",     rarity: "rare",      glowColor: "#7DD3FC", ncCost: 0 },
  { id: "bloodMoon",     name: "Blood Moon",    rarity: "rare",      glowColor: "#B91C1C", ncCost: 0 },
  { id: "shadowPulse",   name: "Shadow Pulse",  rarity: "rare",      glowColor: "#6D28D9", ncCost: 0 },
  { id: "cosmicDust",    name: "Cosmic Dust",   rarity: "rare",      glowColor: "#818CF8", ncCost: 0 },
  { id: "stormCloud",    name: "Storm Cloud",   rarity: "rare",      glowColor: "#64748B", ncCost: 0 },
  // RARE — Paid
  { id: "cyberGlow",     name: "Cyber Glow",    rarity: "rare",      glowColor: "#00E5FF", ncCost: 150 },
  { id: "plasmaRing",    name: "Plasma Ring",   rarity: "rare",      glowColor: "#E879F9", ncCost: 150 },
  { id: "solarFlare",    name: "Solar Flare",   rarity: "rare",      glowColor: "#FB923C", ncCost: 150 },
  { id: "acidGreen",     name: "Acid Green",    rarity: "rare",      glowColor: "#4ADE80", ncCost: 150 },
  { id: "ultraviolet",   name: "Ultraviolet",   rarity: "rare",      glowColor: "#818CF8", ncCost: 150 },
  { id: "crystalline",   name: "Crystalline",   rarity: "rare",      glowColor: "#93C5FD", ncCost: 150 },
  { id: "venomDrip",     name: "Venom Drip",    rarity: "rare",      glowColor: "#65A30D", ncCost: 150 },
  { id: "vortexEdge",    name: "Vortex Edge",   rarity: "rare",      glowColor: "#9333EA", ncCost: 150 },
  // EPIC — Rotating Gradient, Free
  { id: "scanLine",      name: "Scan Line",     rarity: "epic",      glowColor: "#8B5CF6", ncCost: 0 },
  { id: "particleTrail", name: "Particle Trail",rarity: "epic",      glowColor: "#6366F1", ncCost: 0 },
  { id: "auroraGlow",    name: "Aurora Glow",   rarity: "epic",      glowColor: "#34D399", ncCost: 0 },
  { id: "nebularing",    name: "Nebula Ring",   rarity: "epic",      glowColor: "#C084FC", ncCost: 0 },
  { id: "voidGate",      name: "Void Gate",     rarity: "epic",      glowColor: "#4C1D95", ncCost: 0 },
  { id: "darkMatter",    name: "Dark Matter",   rarity: "epic",      glowColor: "#1E1B4B", ncCost: 0 },
  { id: "glitchMatrix",  name: "Glitch Matrix", rarity: "epic",      glowColor: "#00FF41", ncCost: 0 },
  { id: "stormBreaker",  name: "Storm Breaker", rarity: "epic",      glowColor: "#94A3B8", ncCost: 0 },
  { id: "celestialArc",  name: "Celestial Arc", rarity: "epic",      glowColor: "#BAE6FD", ncCost: 0 },
  { id: "abyssalRing",   name: "Abyssal Ring",  rarity: "epic",      glowColor: "#312E81", ncCost: 0 },
  // EPIC — Paid
  { id: "hologramFlicker",name:"Hologram Flicker",rarity:"epic",     glowColor: "#A78BFA", ncCost: 500 },
  { id: "cosmicRing",    name: "Cosmic Ring",   rarity: "epic",      glowColor: "#6366F1", ncCost: 500 },
  { id: "novaBlast",     name: "Nova Blast",    rarity: "epic",      glowColor: "#FDE68A", ncCost: 500 },
  { id: "bioHazard",     name: "Bio Hazard",    rarity: "epic",      glowColor: "#84CC16", ncCost: 500 },
  { id: "fireRing",      name: "Fire Ring",     rarity: "epic",      glowColor: "#EF4444", ncCost: 500 },
  { id: "quantumField",  name: "Quantum Field", rarity: "epic",      glowColor: "#0EA5E9", ncCost: 500 },
  { id: "solarWind",     name: "Solar Wind",    rarity: "epic",      glowColor: "#FCD34D", ncCost: 500 },
  { id: "neonNights",    name: "Neon Nights",   rarity: "epic",      glowColor: "#F472B6", ncCost: 500 },
  { id: "dragonScale",   name: "Dragon Scale",  rarity: "epic",      glowColor: "#DC2626", ncCost: 500 },
  { id: "frostedGlass",  name: "Frosted Glass", rarity: "epic",      glowColor: "#E0F2FE", ncCost: 500 },
  // LEGENDARY — Electric Flicker, Free (earned through gameplay)
  { id: "electricArc",   name: "Electric Arc",  rarity: "legendary", glowColor: "#F59E0B", ncCost: 0, earnedBy: "Reach Prestige Rank 1" },
  { id: "dataStream",    name: "Data Stream",   rarity: "legendary", glowColor: "#06B6D4", ncCost: 0, earnedBy: "Complete 500 Data crimes" },
  { id: "factionCrest",  name: "Faction Crest", rarity: "legendary", glowColor: "#F59E0B", ncCost: 0, earnedBy: "Control 5 districts" },
  { id: "thunderStrike", name: "Thunder Strike",rarity: "legendary", glowColor: "#FDE68A", ncCost: 0, earnedBy: "Win 1000 PvP fights" },
  { id: "volcanicAsh",   name: "Volcanic Ash",  rarity: "legendary", glowColor: "#78350F", ncCost: 0, earnedBy: "Heist veteran" },
  { id: "darkLord",      name: "Dark Lord",     rarity: "legendary", glowColor: "#7C3AED", ncCost: 0, earnedBy: "Reach Level 100" },
  { id: "meteorShower",  name: "Meteor Shower", rarity: "legendary", glowColor: "#F97316", ncCost: 0, earnedBy: "Earn 10M DC in a week" },
  { id: "nightKing",     name: "Night King",    rarity: "legendary", glowColor: "#93C5FD", ncCost: 0, earnedBy: "Rule The Outskirts" },
  { id: "streetLegend",  name: "Street Legend", rarity: "legendary", glowColor: "#EF4444", ncCost: 0, earnedBy: "Max Street Cred" },
  { id: "gridMaster",    name: "Grid Master",   rarity: "legendary", glowColor: "#00E5FF", ncCost: 0, earnedBy: "Max Intelligence" },
  { id: "voidWalker",    name: "Void Walker",   rarity: "legendary", glowColor: "#4C1D95", ncCost: 0, earnedBy: "Complete The Outskirts all bosses" },
  // LEGENDARY — Paid
  { id: "cyberSpark",    name: "Cyber Spark",   rarity: "legendary", glowColor: "#22D3EE", ncCost: 1000 },
  { id: "godRay",        name: "God Ray",       rarity: "legendary", glowColor: "#FBBF24", ncCost: 1000 },
  { id: "plasmaBolt",    name: "Plasma Bolt",   rarity: "legendary", glowColor: "#D946EF", ncCost: 1000 },
  { id: "ironClad",      name: "Iron Clad",     rarity: "legendary", glowColor: "#CBD5E1", ncCost: 1000 },
  // MYTHIC — Achievement/Event only
  { id: "matrixRain",    name: "Matrix Rain",   rarity: "mythic",    glowColor: "#00FF41", ncCost: 0, earnedBy: "Achievement: Hack the City" },
  { id: "spectral",      name: "Spectral",      rarity: "mythic",    glowColor: "#F0F9FF", ncCost: 0, earnedBy: "Achievement: Ghost Protocol" },
  { id: "voidCore",      name: "Void Core",     rarity: "mythic",    glowColor: "#7C3AED", ncCost: 0, earnedBy: "Achievement: Into the Void" },
  { id: "hackerElite",   name: "Hacker Elite",  rarity: "mythic",    glowColor: "#00FF41", ncCost: 0, earnedBy: "Achievement: Breach God" },
  { id: "shadowLord",    name: "Shadow Lord",   rarity: "mythic",    glowColor: "#1E1B4B", ncCost: 0, earnedBy: "Achievement: Shadow Sovereign" },
  { id: "cosmicHorror",  name: "Cosmic Horror", rarity: "mythic",    glowColor: "#6B21A8", ncCost: 0, earnedBy: "Achievement: The Void Stares Back" },
  { id: "theAbyss",      name: "The Abyss",     rarity: "mythic",    glowColor: "#0C0A09", ncCost: 0, earnedBy: "Achievement: Rock Bottom" },
  { id: "deathCode",     name: "Death Code",    rarity: "mythic",    glowColor: "#EF4444", ncCost: 0, earnedBy: "Achievement: System Crash" },
];

export const FRAME_MAP = new Map<string, FrameDef>(
  FRAME_CATALOG.map(f => [f.id, f])
);

export function getFrame(id: string | null | undefined): FrameDef {
  return FRAME_MAP.get(id || "ghostFrame") || FRAME_CATALOG[10]; // fallback to ghostFrame
}

export const RARITY_ORDER: Record<FrameRarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};

export const RARITY_COLOR: Record<FrameRarity, string> = {
  common: "#9CA3AF",
  uncommon: "#4ADE80",
  rare: "#60A5FA",
  epic: "#C084FC",
  legendary: "#FBBF24",
  mythic: "#00FF41",
};
