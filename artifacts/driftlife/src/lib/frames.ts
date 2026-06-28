export type FrameRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type FrameAnimationType = "static" | "shimmer" | "pulse" | "epic-particles" | "legendary-electric" | "mythic-cascade";

export interface FrameDef {
  id: string;
  name: string;
  rarity: FrameRarity;
  glowColor: string;
  animationType: FrameAnimationType;
  variantIndex: number;
  ncCost: number;
  earnedBy?: string;
  mythicAliasOf?: string;
}

// Fallback catalog — used for rendering when DB isn't available yet
// Colors and animation types must match backend BUILT_IN_FRAMES
export const FRAME_CATALOG: FrameDef[] = [
  { id:"ghostFrame",     name:"Ghost",           rarity:"common",    glowColor:"#64748b", animationType:"static",            variantIndex:0  , ncCost:0 },
  { id:"basicWhite",     name:"Basic White",     rarity:"common",    glowColor:"#e2e8f0", animationType:"static",            variantIndex:1  , ncCost:0 },
  { id:"basicGray",      name:"Basic Gray",      rarity:"common",    glowColor:"#94a3b8", animationType:"static",            variantIndex:2  , ncCost:0 },
  { id:"neonBlue",       name:"Neon Blue",       rarity:"common",    glowColor:"#3b82f6", animationType:"static",            variantIndex:3  , ncCost:0 },
  { id:"neonGreen",      name:"Neon Green",      rarity:"common",    glowColor:"#22c55e", animationType:"static",            variantIndex:4  , ncCost:0 },
  { id:"neonRed",        name:"Neon Red",        rarity:"common",    glowColor:"#ef4444", animationType:"static",            variantIndex:5  , ncCost:0 },
  { id:"corpGray",       name:"Corp Gray",       rarity:"common",    glowColor:"#6b7280", animationType:"static",            variantIndex:6  , ncCost:0 },
  { id:"streetOrange",   name:"Street Orange",   rarity:"common",    glowColor:"#ff6b35", animationType:"static",            variantIndex:7  , ncCost:0 },
  { id:"cyanPulse",      name:"Cyan Basic",      rarity:"common",    glowColor:"#00d4ff", animationType:"static",            variantIndex:8  , ncCost:0 },
  { id:"goldBasic",      name:"Gold Basic",      rarity:"common",    glowColor:"#f59e0b", animationType:"static",            variantIndex:9  , ncCost:0 },
  { id:"shimmerCyan",    name:"Shimmer Cyan",    rarity:"uncommon",  glowColor:"#00d4ff", animationType:"shimmer",           variantIndex:0  , ncCost:0 },
  { id:"shimmerPurple",  name:"Shimmer Purple",  rarity:"uncommon",  glowColor:"#a855f7", animationType:"shimmer",           variantIndex:1  , ncCost:0 },
  { id:"shimmerGold",    name:"Shimmer Gold",    rarity:"uncommon",  glowColor:"#f59e0b", animationType:"shimmer",           variantIndex:2  , ncCost:0 },
  { id:"shimmerRed",     name:"Shimmer Red",     rarity:"uncommon",  glowColor:"#ff2d55", animationType:"shimmer",           variantIndex:3  , ncCost:0 },
  { id:"shimmerGreen",   name:"Shimmer Green",   rarity:"uncommon",  glowColor:"#39d353", animationType:"shimmer",           variantIndex:4  , ncCost:0 },
  { id:"shimmerOrange",  name:"Shimmer Orange",  rarity:"uncommon",  glowColor:"#ff6b35", animationType:"shimmer",           variantIndex:5  , ncCost:0 },
  { id:"techShimmer",    name:"Tech Shimmer",    rarity:"uncommon",  glowColor:"#60a5fa", animationType:"shimmer",           variantIndex:6  , ncCost:0 },
  { id:"suitShimmer",    name:"Suit Shimmer",    rarity:"uncommon",  glowColor:"#e2e8f0", animationType:"shimmer",           variantIndex:7  , ncCost:0 },
  { id:"crimsonShimmer", name:"Crimson Shimmer", rarity:"uncommon",  glowColor:"#dc2626", animationType:"shimmer",           variantIndex:8  , ncCost:0 },
  { id:"iceShimmer",     name:"Ice Shimmer",     rarity:"uncommon",  glowColor:"#e0f2fe", animationType:"shimmer",           variantIndex:9  , ncCost:0 },
  { id:"pulseCyan",      name:"Pulse Cyan",      rarity:"rare",      glowColor:"#00d4ff", animationType:"pulse",             variantIndex:0  , ncCost:0 },
  { id:"pulsePurple",    name:"Pulse Purple",    rarity:"rare",      glowColor:"#a855f7", animationType:"pulse",             variantIndex:1  , ncCost:0 },
  { id:"pulseGold",      name:"Pulse Gold",      rarity:"rare",      glowColor:"#f59e0b", animationType:"pulse",             variantIndex:2  , ncCost:0 },
  { id:"pulseRed",       name:"Pulse Red",       rarity:"rare",      glowColor:"#ff2d55", animationType:"pulse",             variantIndex:3  , ncCost:0 },
  { id:"pulseGreen",     name:"Pulse Green",     rarity:"rare",      glowColor:"#39d353", animationType:"pulse",             variantIndex:4  , ncCost:0 },
  { id:"hackerPulse",    name:"Hacker Pulse",    rarity:"rare",      glowColor:"#4ade80", animationType:"pulse",             variantIndex:5  , ncCost:0 },
  { id:"corePulse",      name:"Core Pulse",      rarity:"rare",      glowColor:"#818cf8", animationType:"pulse",             variantIndex:6  , ncCost:0 },
  { id:"vaultPulse",     name:"Vault Pulse",     rarity:"rare",      glowColor:"#fbbf24", animationType:"pulse",             variantIndex:7  , ncCost:0 },
  { id:"streetPulse",    name:"Street Pulse",    rarity:"rare",      glowColor:"#fb923c", animationType:"pulse",             variantIndex:8  , ncCost:0 },
  { id:"spectralPulse",  name:"Spectral Pulse",  rarity:"rare",      glowColor:"#e879f9", animationType:"pulse",             variantIndex:9  , ncCost:0 },
  { id:"epicCyan",       name:"Data Stream",     rarity:"epic",      glowColor:"#00d4ff", animationType:"epic-particles",    variantIndex:0  , ncCost:50 },
  { id:"epicPurple",     name:"Neural",          rarity:"epic",      glowColor:"#a855f7", animationType:"epic-particles",    variantIndex:1  , ncCost:60 },
  { id:"epicGold",       name:"Vault",           rarity:"epic",      glowColor:"#f59e0b", animationType:"epic-particles",    variantIndex:2  , ncCost:70 },
  { id:"syndicate",      name:"Syndicate",       rarity:"epic",      glowColor:"#ff6b35", animationType:"epic-particles",    variantIndex:3  , ncCost:75 },
  { id:"epicRed",        name:"Danger Zone",     rarity:"epic",      glowColor:"#ff2d55", animationType:"epic-particles",    variantIndex:4  , ncCost:80 },
  { id:"gridCore",       name:"Grid Core",       rarity:"epic",      glowColor:"#22d3ee", animationType:"epic-particles",    variantIndex:5  , ncCost:80 },
  { id:"suitsFrame",     name:"The Suits",       rarity:"epic",      glowColor:"#94a3b8", animationType:"epic-particles",    variantIndex:6  , ncCost:90 },
  { id:"epicVoid",       name:"Void",            rarity:"epic",      glowColor:"#7c3aed", animationType:"epic-particles",    variantIndex:7  , ncCost:100 },
  { id:"epicInferno",    name:"Inferno",         rarity:"epic",      glowColor:"#ef4444", animationType:"epic-particles",    variantIndex:8  , ncCost:100 },
  { id:"epicNova",       name:"Nova",            rarity:"epic",      glowColor:"#f0abfc", animationType:"epic-particles",    variantIndex:9  , ncCost:120 },
  { id:"legendCyan",     name:"Lightning Cyan",  rarity:"legendary", glowColor:"#00d4ff", animationType:"legendary-electric",variantIndex:0  , ncCost:200 },
  { id:"legendPurple",   name:"Lightning Purple",rarity:"legendary", glowColor:"#a855f7", animationType:"legendary-electric",variantIndex:1  , ncCost:250 },
  { id:"legendGold",     name:"Lightning Gold",  rarity:"legendary", glowColor:"#f59e0b", animationType:"legendary-electric",variantIndex:2  , ncCost:300 },
  { id:"legendRed",      name:"Lightning Red",   rarity:"legendary", glowColor:"#ff2d55", animationType:"legendary-electric",variantIndex:3  , ncCost:300 },
  { id:"crimsonLord",    name:"Crimson Lord",    rarity:"legendary", glowColor:"#b91c1c", animationType:"legendary-electric",variantIndex:4  , ncCost:350 },
  { id:"arcLight",       name:"Arc Light",       rarity:"legendary", glowColor:"#a5f3fc", animationType:"legendary-electric",variantIndex:5  , ncCost:350 },
  { id:"plasmaBolt",     name:"Plasma Bolt",     rarity:"legendary", glowColor:"#d946ef", animationType:"legendary-electric",variantIndex:6  , ncCost:400 },
  { id:"thunderClap",    name:"Thunderclap",     rarity:"legendary", glowColor:"#fde047", animationType:"legendary-electric",variantIndex:7  , ncCost:400 },
  { id:"vantaLegend",    name:"Vanta Legend",    rarity:"legendary", glowColor:"#00d4ff", animationType:"legendary-electric",variantIndex:8  , ncCost:450 },
  { id:"executioner",    name:"Executioner",     rarity:"legendary", glowColor:"#ff2d55", animationType:"legendary-electric",variantIndex:9  , ncCost:500 },
  { id:"matrixGreen",    name:"Matrix",          rarity:"mythic",    glowColor:"#39d353", animationType:"mythic-cascade",    variantIndex:0  , ncCost:1000 },
  { id:"voidWalker",     name:"Void Walker",     rarity:"mythic",    glowColor:"#7c3aed", animationType:"mythic-cascade",    variantIndex:1  , ncCost:1500 },
  { id:"nova2047",       name:"Nova 2047",       rarity:"mythic",    glowColor:"#f0abfc", animationType:"mythic-cascade",    variantIndex:2  , ncCost:2000 },
  { id:"godMode",        name:"God Mode",        rarity:"mythic",    glowColor:"#fde047", animationType:"mythic-cascade",    variantIndex:3  , ncCost:3000 },
  { id:"theOne",         name:"The One",         rarity:"mythic",    glowColor:"#00d4ff", animationType:"mythic-cascade",    variantIndex:4  , ncCost:5000 },
  { id:"matrixBlue",     name:"Blue Code",       rarity:"mythic",    glowColor:"#00d4ff", animationType:"mythic-cascade",    variantIndex:0  , ncCost:1000, mythicAliasOf:"matrixGreen" },
  { id:"matrixGold",     name:"Golden Code",     rarity:"mythic",    glowColor:"#f59e0b", animationType:"mythic-cascade",    variantIndex:0  , ncCost:1000, mythicAliasOf:"matrixGreen" },
  { id:"matrixRed",      name:"Red Code",        rarity:"mythic",    glowColor:"#ff2d55", animationType:"mythic-cascade",    variantIndex:0  , ncCost:1000, mythicAliasOf:"matrixGreen" },
  { id:"omega",          name:"Omega",           rarity:"mythic",    glowColor:"#a855f7", animationType:"mythic-cascade",    variantIndex:3  , ncCost:3000, mythicAliasOf:"godMode" },
  { id:"architect",      name:"Architect",       rarity:"mythic",    glowColor:"#e2e8f0", animationType:"mythic-cascade",    variantIndex:4  , ncCost:5000, mythicAliasOf:"theOne" },
];

const FALLBACK: FrameDef = { id: "ghostFrame", name: "Ghost", rarity: "common", glowColor: "#64748b", animationType: "static", variantIndex: 0, ncCost: 0 };

export function getFrame(frameId: string | null | undefined): FrameDef {
  if (!frameId) return FALLBACK;
  const aliased = FRAME_CATALOG.find(f => f.id === frameId);
  if (!aliased) return FALLBACK;
  if (aliased.mythicAliasOf) {
    const target = FRAME_CATALOG.find(f => f.id === aliased.mythicAliasOf);
    if (target) return { ...target, id: aliased.id, name: aliased.name, glowColor: aliased.glowColor };
  }
  return aliased;
}

export const RARITY_COLORS: Record<FrameRarity, string> = {
  common: "#94a3b8",
  uncommon: "#39d353",
  rare: "#00d4ff",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ff2d55",
};

export const RARITY_ORDER: FrameRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
