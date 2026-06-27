export type FrameRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface FrameDef {
  id: string;
  name: string;
  rarity: FrameRarity;
  glowColor: string;
  ncCost: number; // 0 = free / dc-priced
  earnedBy?: string;
}

// IDs match the backend FRAME_CATALOG frameId values exactly
export const FRAME_CATALOG: FrameDef[] = [
  // ── COMMON — static border ────────────────────────────────────────────────
  { id: "ghostFrame",     name: "Ghost",           rarity: "common",    glowColor: "#64748b", ncCost: 0 },
  { id: "basicWhite",     name: "Basic White",     rarity: "common",    glowColor: "#e2e8f0", ncCost: 0 },
  { id: "basicGray",      name: "Basic Gray",      rarity: "common",    glowColor: "#94a3b8", ncCost: 0 },
  { id: "neonBlue",       name: "Neon Blue",       rarity: "common",    glowColor: "#3b82f6", ncCost: 0 },
  { id: "neonGreen",      name: "Neon Green",      rarity: "common",    glowColor: "#22c55e", ncCost: 0 },
  { id: "neonRed",        name: "Neon Red",        rarity: "common",    glowColor: "#ef4444", ncCost: 0 },
  { id: "corpGray",       name: "Corp Gray",       rarity: "common",    glowColor: "#6b7280", ncCost: 0 },
  { id: "streetOrange",   name: "Street Orange",   rarity: "common",    glowColor: "#ff6b35", ncCost: 0 },
  { id: "cyanPulse",      name: "Cyan Basic",      rarity: "common",    glowColor: "#00d4ff", ncCost: 0 },
  { id: "goldBasic",      name: "Gold Basic",      rarity: "common",    glowColor: "#f59e0b", ncCost: 0 },

  // ── UNCOMMON — shimmer sweep ──────────────────────────────────────────────
  { id: "shimmerCyan",    name: "Shimmer Cyan",    rarity: "uncommon",  glowColor: "#00d4ff", ncCost: 0 },
  { id: "shimmerPurple",  name: "Shimmer Purple",  rarity: "uncommon",  glowColor: "#a855f7", ncCost: 0 },
  { id: "shimmerGold",    name: "Shimmer Gold",    rarity: "uncommon",  glowColor: "#f59e0b", ncCost: 0 },
  { id: "shimmerRed",     name: "Shimmer Red",     rarity: "uncommon",  glowColor: "#ff2d55", ncCost: 0 },
  { id: "shimmerGreen",   name: "Shimmer Green",   rarity: "uncommon",  glowColor: "#39d353", ncCost: 0 },
  { id: "shimmerOrange",  name: "Shimmer Orange",  rarity: "uncommon",  glowColor: "#ff6b35", ncCost: 0 },
  { id: "techShimmer",    name: "Tech Shimmer",    rarity: "uncommon",  glowColor: "#60a5fa", ncCost: 0 },
  { id: "suitShimmer",    name: "Suit Shimmer",    rarity: "uncommon",  glowColor: "#e2e8f0", ncCost: 0 },
  { id: "crimsonShimmer", name: "Crimson Shimmer", rarity: "uncommon",  glowColor: "#dc2626", ncCost: 0 },
  { id: "iceShimmer",     name: "Ice Shimmer",     rarity: "uncommon",  glowColor: "#e0f2fe", ncCost: 0 },

  // ── RARE — pulse glow ────────────────────────────────────────────────────
  { id: "pulseCyan",      name: "Pulse Cyan",      rarity: "rare",      glowColor: "#00d4ff", ncCost: 0 },
  { id: "pulsePurple",    name: "Pulse Purple",    rarity: "rare",      glowColor: "#a855f7", ncCost: 0 },
  { id: "pulseGold",      name: "Pulse Gold",      rarity: "rare",      glowColor: "#f59e0b", ncCost: 0 },
  { id: "pulseRed",       name: "Pulse Red",       rarity: "rare",      glowColor: "#ff2d55", ncCost: 0 },
  { id: "pulseGreen",     name: "Pulse Green",     rarity: "rare",      glowColor: "#39d353", ncCost: 0 },
  { id: "hackerPulse",    name: "Hacker Pulse",    rarity: "rare",      glowColor: "#4ade80", ncCost: 0 },
  { id: "corePulse",      name: "Core Pulse",      rarity: "rare",      glowColor: "#818cf8", ncCost: 0 },
  { id: "vaultPulse",     name: "Vault Pulse",     rarity: "rare",      glowColor: "#fbbf24", ncCost: 0 },
  { id: "streetPulse",    name: "Street Pulse",    rarity: "rare",      glowColor: "#fb923c", ncCost: 0 },
  { id: "spectralPulse",  name: "Spectral Pulse",  rarity: "rare",      glowColor: "#e879f9", ncCost: 0 },

  // ── EPIC — rotating conic gradient ───────────────────────────────────────
  { id: "epicCyan",       name: "Epic Cyan",       rarity: "epic",      glowColor: "#00d4ff", ncCost: 0 },
  { id: "epicPurple",     name: "Epic Purple",     rarity: "epic",      glowColor: "#a855f7", ncCost: 0 },
  { id: "epicGold",       name: "Epic Gold",       rarity: "epic",      glowColor: "#f59e0b", ncCost: 0 },
  { id: "epicRed",        name: "Epic Red",        rarity: "epic",      glowColor: "#ff2d55", ncCost: 0 },
  { id: "syndicate",      name: "Syndicate",       rarity: "epic",      glowColor: "#ff6b35", ncCost: 0 },
  { id: "gridCore",       name: "Grid Core",       rarity: "epic",      glowColor: "#22d3ee", ncCost: 0 },
  { id: "suitsFrame",     name: "The Suits",       rarity: "epic",      glowColor: "#94a3b8", ncCost: 0 },
  { id: "epicVoid",       name: "Void",            rarity: "epic",      glowColor: "#7c3aed", ncCost: 0 },
  { id: "epicInferno",    name: "Inferno",         rarity: "epic",      glowColor: "#ef4444", ncCost: 0 },
  { id: "epicNova",       name: "Nova",            rarity: "epic",      glowColor: "#f0abfc", ncCost: 0 },

  // ── LEGENDARY — electric flicker ────────────────────────────────────────
  { id: "legendCyan",     name: "Lightning Cyan",  rarity: "legendary", glowColor: "#00d4ff", ncCost: 50 },
  { id: "legendPurple",   name: "Lightning Purple",rarity: "legendary", glowColor: "#a855f7", ncCost: 75 },
  { id: "legendGold",     name: "Lightning Gold",  rarity: "legendary", glowColor: "#f59e0b", ncCost: 100 },
  { id: "legendRed",      name: "Lightning Red",   rarity: "legendary", glowColor: "#ff2d55", ncCost: 100 },
  { id: "crimsonLord",    name: "Crimson Lord",    rarity: "legendary", glowColor: "#b91c1c", ncCost: 125 },
  { id: "arcLight",       name: "Arc Light",       rarity: "legendary", glowColor: "#a5f3fc", ncCost: 125 },
  { id: "plasmaBolt",     name: "Plasma Bolt",     rarity: "legendary", glowColor: "#d946ef", ncCost: 150 },
  { id: "thunderClap",    name: "Thunderclap",     rarity: "legendary", glowColor: "#fde047", ncCost: 150 },
  { id: "vantaLegend",    name: "Vanta Legend",    rarity: "legendary", glowColor: "#00d4ff", ncCost: 200 },
  { id: "executioner",    name: "Executioner",     rarity: "legendary", glowColor: "#ff2d55", ncCost: 200 },

  // ── MYTHIC — matrix cascade ──────────────────────────────────────────────
  { id: "matrixGreen",    name: "Matrix",          rarity: "mythic",    glowColor: "#39d353", ncCost: 500 },
  { id: "matrixBlue",     name: "Blue Code",       rarity: "mythic",    glowColor: "#00d4ff", ncCost: 500 },
  { id: "matrixGold",     name: "Golden Code",     rarity: "mythic",    glowColor: "#f59e0b", ncCost: 600 },
  { id: "matrixRed",      name: "Red Code",        rarity: "mythic",    glowColor: "#ff2d55", ncCost: 600 },
  { id: "omega",          name: "Omega",           rarity: "mythic",    glowColor: "#a855f7", ncCost: 750 },
  { id: "voidWalker",     name: "Void Walker",     rarity: "mythic",    glowColor: "#7c3aed", ncCost: 750 },
  { id: "architect",      name: "Architect",       rarity: "mythic",    glowColor: "#e2e8f0", ncCost: 1000 },
  { id: "nova2047",       name: "Nova 2047",       rarity: "mythic",    glowColor: "#f0abfc", ncCost: 1000 },
  { id: "godMode",        name: "God Mode",        rarity: "mythic",    glowColor: "#fde047", ncCost: 2000 },
  { id: "theOne",         name: "The One",         rarity: "mythic",    glowColor: "#00d4ff", ncCost: 5000 },
];

export const FRAME_MAP = new Map<string, FrameDef>(
  FRAME_CATALOG.map(f => [f.id, f])
);

export function getFrame(id: string | null | undefined): FrameDef {
  return FRAME_MAP.get(id || "ghostFrame") || FRAME_CATALOG[0]; // fallback to ghostFrame
}

export const RARITY_ORDER: Record<FrameRarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
};

export const RARITY_COLOR: Record<FrameRarity, string> = {
  common:    "#9CA3AF",
  uncommon:  "#4ADE80",
  rare:      "#60A5FA",
  epic:      "#C084FC",
  legendary: "#FBBF24",
  mythic:    "#00FF41",
};
