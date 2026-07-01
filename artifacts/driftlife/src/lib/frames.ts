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
  /** Unique monospace/symbol icon shown in the chat header strip */
  icon: string;
  /**
   * Text color for message content. null → default (#e2e8f0).
   * Rare uses glowColor at ~53% opacity (appended "88").
   * Epic at ~80% ("cc"), Legendary at ~93% ("ee"), Mythic at 100%.
   */
  textColor: string | null;
  /**
   * CSS background value for the chat header strip.
   * null for all tiers except mythic (including mythic aliases which define their own).
   */
  headerBg: string | null;
}

export const FRAME_CATALOG: FrameDef[] = [
  // ── COMMON ──────────────────────────────────────────────────────────────────
  { id:"ghostFrame",     name:"Phantom",          rarity:"common",    glowColor:"#64748b", animationType:"static",            variantIndex:0,  ncCost:0,    icon:"○",  textColor:null, headerBg:null },
  { id:"basicWhite",     name:"Bulkhead",          rarity:"common",    glowColor:"#e2e8f0", animationType:"static",            variantIndex:1,  ncCost:0,    icon:"□",  textColor:null, headerBg:null },
  { id:"basicGray",      name:"Hex Cut",           rarity:"common",    glowColor:"#94a3b8", animationType:"static",            variantIndex:2,  ncCost:0,    icon:"⬡",  textColor:null, headerBg:null },
  { id:"neonBlue",       name:"Twin Ring",         rarity:"common",    glowColor:"#3b82f6", animationType:"static",            variantIndex:3,  ncCost:0,    icon:"◈",  textColor:null, headerBg:null },
  { id:"neonGreen",      name:"Grid Lines",        rarity:"common",    glowColor:"#22c55e", animationType:"static",            variantIndex:4,  ncCost:0,    icon:"⊞",  textColor:null, headerBg:null },
  { id:"neonRed",        name:"Hazard",            rarity:"common",    glowColor:"#ef4444", animationType:"static",            variantIndex:5,  ncCost:0,    icon:"△",  textColor:null, headerBg:null },
  { id:"corpGray",       name:"Corp Tag",          rarity:"common",    glowColor:"#6b7280", animationType:"static",            variantIndex:6,  ncCost:0,    icon:"▸",  textColor:null, headerBg:null },
  { id:"streetOrange",   name:"Street Wire",       rarity:"common",    glowColor:"#ff6b35", animationType:"static",            variantIndex:7,  ncCost:0,    icon:"⌁",  textColor:null, headerBg:null },
  { id:"cyanPulse",      name:"Crosshair",         rarity:"common",    glowColor:"#00d4ff", animationType:"static",            variantIndex:8,  ncCost:0,    icon:"⊕",  textColor:null, headerBg:null },
  { id:"goldBasic",      name:"Diamond Cut",       rarity:"common",    glowColor:"#f59e0b", animationType:"static",            variantIndex:9,  ncCost:0,    icon:"◇",  textColor:null, headerBg:null },

  // ── UNCOMMON ─────────────────────────────────────────────────────────────────
  { id:"shimmerCyan",    name:"Circuit Trace",     rarity:"uncommon",  glowColor:"#00d4ff", animationType:"shimmer",           variantIndex:0,  ncCost:0,    icon:"≈",  textColor:null, headerBg:null },
  { id:"shimmerPurple",  name:"Twin Orbit",        rarity:"uncommon",  glowColor:"#a855f7", animationType:"shimmer",           variantIndex:1,  ncCost:0,    icon:"∿",  textColor:null, headerBg:null },
  { id:"shimmerGold",    name:"Ticker",            rarity:"uncommon",  glowColor:"#f59e0b", animationType:"shimmer",           variantIndex:2,  ncCost:0,    icon:"≋",  textColor:null, headerBg:null },
  { id:"shimmerRed",     name:"Triple Crown",      rarity:"uncommon",  glowColor:"#ff2d55", animationType:"shimmer",           variantIndex:3,  ncCost:0,    icon:"⋈",  textColor:null, headerBg:null },
  { id:"shimmerGreen",   name:"Comet",             rarity:"uncommon",  glowColor:"#39d353", animationType:"shimmer",           variantIndex:4,  ncCost:0,    icon:"⟡",  textColor:null, headerBg:null },
  { id:"shimmerOrange",  name:"Beacon",            rarity:"uncommon",  glowColor:"#ff6b35", animationType:"shimmer",           variantIndex:5,  ncCost:0,    icon:"⌀",  textColor:null, headerBg:null },
  { id:"techShimmer",    name:"Data Ping",         rarity:"uncommon",  glowColor:"#60a5fa", animationType:"shimmer",           variantIndex:6,  ncCost:0,    icon:"⌥",  textColor:null, headerBg:null },
  { id:"suitShimmer",    name:"Executive",         rarity:"uncommon",  glowColor:"#e2e8f0", animationType:"shimmer",           variantIndex:7,  ncCost:0,    icon:"⊜",  textColor:null, headerBg:null },
  { id:"crimsonShimmer", name:"Dual Ring",         rarity:"uncommon",  glowColor:"#dc2626", animationType:"shimmer",           variantIndex:8,  ncCost:0,    icon:"⊗",  textColor:null, headerBg:null },
  { id:"iceShimmer",     name:"Frost Crawl",       rarity:"uncommon",  glowColor:"#e0f2fe", animationType:"shimmer",           variantIndex:9,  ncCost:0,    icon:"❄",  textColor:null, headerBg:null },

  // ── RARE ─────────────────────────────────────────────────────────────────────
  { id:"pulseCyan",      name:"Lifeline",          rarity:"rare",      glowColor:"#00d4ff", animationType:"pulse",             variantIndex:0,  ncCost:0,    icon:"⎊",  textColor:"#00d4ff88", headerBg:null },
  { id:"pulsePurple",    name:"Binary Breath",     rarity:"rare",      glowColor:"#a855f7", animationType:"pulse",             variantIndex:1,  ncCost:0,    icon:"⎈",  textColor:"#a855f788", headerBg:null },
  { id:"pulseGold",      name:"Spotlight",         rarity:"rare",      glowColor:"#f59e0b", animationType:"pulse",             variantIndex:2,  ncCost:0,    icon:"⍟",  textColor:"#f59e0b88", headerBg:null },
  { id:"pulseRed",       name:"Erratic",           rarity:"rare",      glowColor:"#ff2d55", animationType:"pulse",             variantIndex:3,  ncCost:0,    icon:"⎐",  textColor:"#ff2d5588", headerBg:null },
  { id:"pulseGreen",     name:"Scanner",           rarity:"rare",      glowColor:"#39d353", animationType:"pulse",             variantIndex:4,  ncCost:0,    icon:"⎍",  textColor:"#39d35388", headerBg:null },
  { id:"hackerPulse",    name:"Corner Bloom",      rarity:"rare",      glowColor:"#4ade80", animationType:"pulse",             variantIndex:5,  ncCost:0,    icon:"⎋",  textColor:"#4ade8088", headerBg:null },
  { id:"corePulse",      name:"Octacore",          rarity:"rare",      glowColor:"#818cf8", animationType:"pulse",             variantIndex:6,  ncCost:0,    icon:"⎏",  textColor:"#818cf888", headerBg:null },
  { id:"vaultPulse",     name:"Vault",             rarity:"rare",      glowColor:"#fbbf24", animationType:"pulse",             variantIndex:7,  ncCost:0,    icon:"⎑",  textColor:"#fbbf2488", headerBg:null },
  { id:"streetPulse",    name:"Strobe",            rarity:"rare",      glowColor:"#fb923c", animationType:"pulse",             variantIndex:8,  ncCost:0,    icon:"⌬",  textColor:"#fb923c88", headerBg:null },
  { id:"spectralPulse",  name:"Spectral",          rarity:"rare",      glowColor:"#e879f9", animationType:"pulse",             variantIndex:9,  ncCost:0,    icon:"⌖",  textColor:"#e879f988", headerBg:null },

  // ── EPIC ─────────────────────────────────────────────────────────────────────
  { id:"epicCyan",       name:"Radar",             rarity:"epic",      glowColor:"#00d4ff", animationType:"epic-particles",    variantIndex:0,  ncCost:50,   icon:"◉",  textColor:"#00d4ffcc", headerBg:null },
  { id:"epicPurple",     name:"Dual Radar",        rarity:"epic",      glowColor:"#a855f7", animationType:"epic-particles",    variantIndex:1,  ncCost:60,   icon:"✦",  textColor:"#a855f7cc", headerBg:null },
  { id:"epicGold",       name:"Sector Load",       rarity:"epic",      glowColor:"#f59e0b", animationType:"epic-particles",    variantIndex:2,  ncCost:70,   icon:"★",  textColor:"#f59e0bcc", headerBg:null },
  { id:"syndicate",      name:"Syndicate",         rarity:"epic",      glowColor:"#ff6b35", animationType:"epic-particles",    variantIndex:3,  ncCost:75,   icon:"⌘",  textColor:"#ff6b35cc", headerBg:null },
  { id:"epicRed",        name:"Plasma Burn",       rarity:"epic",      glowColor:"#ff2d55", animationType:"epic-particles",    variantIndex:4,  ncCost:80,   icon:"⚡",  textColor:"#ff2d55cc", headerBg:null },
  { id:"gridCore",       name:"Grid Matrix",       rarity:"epic",      glowColor:"#22d3ee", animationType:"epic-particles",    variantIndex:5,  ncCost:80,   icon:"⊟",  textColor:"#22d3eecc", headerBg:null },
  { id:"suitsFrame",     name:"Orbit",             rarity:"epic",      glowColor:"#94a3b8", animationType:"epic-particles",    variantIndex:6,  ncCost:90,   icon:"⊡",  textColor:"#94a3b8cc", headerBg:null },
  { id:"epicVoid",       name:"Void Spark",        rarity:"epic",      glowColor:"#7c3aed", animationType:"epic-particles",    variantIndex:7,  ncCost:100,  icon:"⍜",  textColor:"#7c3aedcc", headerBg:null },
  { id:"epicInferno",    name:"Inferno",           rarity:"epic",      glowColor:"#ef4444", animationType:"epic-particles",    variantIndex:8,  ncCost:100,  icon:"☈",  textColor:"#ef4444cc", headerBg:null },
  { id:"epicNova",       name:"Nova Burst",        rarity:"epic",      glowColor:"#f0abfc", animationType:"epic-particles",    variantIndex:9,  ncCost:120,  icon:"✧",  textColor:"#f0abfccc", headerBg:null },

  // ── LEGENDARY ────────────────────────────────────────────────────────────────
  { id:"legendCyan",     name:"Arc Node",          rarity:"legendary", glowColor:"#00d4ff", animationType:"legendary-electric",variantIndex:0,  ncCost:200,  icon:"⟁",  textColor:"#00d4ffee", headerBg:null },
  { id:"legendPurple",   name:"Chain Lightning",   rarity:"legendary", glowColor:"#a855f7", animationType:"legendary-electric",variantIndex:1,  ncCost:250,  icon:"⟴",  textColor:"#a855f7ee", headerBg:null },
  { id:"legendGold",     name:"Glitch Lord",       rarity:"legendary", glowColor:"#f59e0b", animationType:"legendary-electric",variantIndex:2,  ncCost:300,  icon:"⍫",  textColor:"#f59e0bee", headerBg:null },
  { id:"legendRed",      name:"Heartbeat",         rarity:"legendary", glowColor:"#ff2d55", animationType:"legendary-electric",variantIndex:3,  ncCost:300,  icon:"♥",  textColor:"#ff2d55ee", headerBg:null },
  { id:"crimsonLord",    name:"Chromatic",         rarity:"legendary", glowColor:"#b91c1c", animationType:"legendary-electric",variantIndex:4,  ncCost:350,  icon:"⚔",  textColor:"#b91c1cee", headerBg:null },
  { id:"arcLight",       name:"Arc Crawl",         rarity:"legendary", glowColor:"#a5f3fc", animationType:"legendary-electric",variantIndex:5,  ncCost:350,  icon:"⌯",  textColor:"#a5f3fcee", headerBg:null },
  { id:"plasmaBolt",     name:"Plasma Bolt",       rarity:"legendary", glowColor:"#d946ef", animationType:"legendary-electric",variantIndex:6,  ncCost:400,  icon:"⌲",  textColor:"#d946efee", headerBg:null },
  { id:"thunderClap",    name:"Thunderclap",       rarity:"legendary", glowColor:"#fde047", animationType:"legendary-electric",variantIndex:7,  ncCost:400,  icon:"⚑",  textColor:"#fde047ee", headerBg:null },
  { id:"vantaLegend",    name:"Vanta",             rarity:"legendary", glowColor:"#00d4ff", animationType:"legendary-electric",variantIndex:8,  ncCost:450,  icon:"⍣",  textColor:"#00d4ffee", headerBg:null },
  { id:"executioner",    name:"Executioner",       rarity:"legendary", glowColor:"#ff2d55", animationType:"legendary-electric",variantIndex:9,  ncCost:500,  icon:"☠",  textColor:"#ff2d55ee", headerBg:null },

  // ── MYTHIC ───────────────────────────────────────────────────────────────────
  {
    id:"matrixGreen", name:"Matrix", rarity:"mythic", glowColor:"#39d353",
    animationType:"mythic-cascade", variantIndex:0, ncCost:1000,
    icon:"⌸", textColor:"#39d353",
    headerBg:"linear-gradient(135deg, #001a06 0%, #002e0a 50%, #001a06 100%)",
  },
  {
    id:"voidWalker", name:"Void Walker", rarity:"mythic", glowColor:"#7c3aed",
    animationType:"mythic-cascade", variantIndex:1, ncCost:1500,
    icon:"⎔", textColor:"#7c3aed",
    headerBg:"linear-gradient(135deg, #0d0018 0%, #1a0030 50%, #0d0018 100%)",
  },
  {
    id:"nova2047", name:"Nova 2047", rarity:"mythic", glowColor:"#f0abfc",
    animationType:"mythic-cascade", variantIndex:2, ncCost:2000,
    icon:"✺", textColor:"#f0abfc",
    headerBg:"linear-gradient(135deg, #1a0020 0%, #2d0045 45%, #1a0028 100%)",
  },
  {
    id:"godMode", name:"God Mode", rarity:"mythic", glowColor:"#fde047",
    animationType:"mythic-cascade", variantIndex:3, ncCost:3000,
    icon:"⍝", textColor:"#fde047",
    headerBg:"linear-gradient(135deg, #1a1400 0%, #2a1e00 50%, #1a1400 100%)",
  },
  {
    id:"theOne", name:"The One", rarity:"mythic", glowColor:"#00d4ff",
    animationType:"mythic-cascade", variantIndex:4, ncCost:5000,
    icon:"⊘", textColor:"#00d4ff",
    headerBg:"linear-gradient(135deg, #001a20 0%, #002030 50%, #001828 100%)",
  },

  // ── MYTHIC ALIASES ────────────────────────────────────────────────────────────
  {
    id:"matrixBlue", name:"Blue Code", rarity:"mythic", glowColor:"#00d4ff",
    animationType:"mythic-cascade", variantIndex:0, ncCost:1000, mythicAliasOf:"matrixGreen",
    icon:"⌹", textColor:"#00d4ff",
    headerBg:"linear-gradient(135deg, #001020 0%, #001428 50%, #001020 100%)",
  },
  {
    id:"matrixGold", name:"Golden Code", rarity:"mythic", glowColor:"#f59e0b",
    animationType:"mythic-cascade", variantIndex:0, ncCost:1000, mythicAliasOf:"matrixGreen",
    icon:"⌺", textColor:"#f59e0b",
    headerBg:"linear-gradient(135deg, #1a1200 0%, #2a1e00 50%, #1a1200 100%)",
  },
  {
    id:"matrixRed", name:"Red Code", rarity:"mythic", glowColor:"#ff2d55",
    animationType:"mythic-cascade", variantIndex:0, ncCost:1000, mythicAliasOf:"matrixGreen",
    icon:"⌻", textColor:"#ff2d55",
    headerBg:"linear-gradient(135deg, #1a0008 0%, #280010 50%, #1a0008 100%)",
  },
  {
    id:"omega", name:"Omega", rarity:"mythic", glowColor:"#a855f7",
    animationType:"mythic-cascade", variantIndex:3, ncCost:3000, mythicAliasOf:"godMode",
    icon:"Ω", textColor:"#a855f7",
    headerBg:"linear-gradient(135deg, #120018 0%, #1e0028 50%, #120018 100%)",
  },
  {
    id:"architect", name:"Architect", rarity:"mythic", glowColor:"#e2e8f0",
    animationType:"mythic-cascade", variantIndex:4, ncCost:5000, mythicAliasOf:"theOne",
    icon:"Λ", textColor:"#e2e8f0",
    headerBg:"linear-gradient(135deg, #080810 0%, #10101e 50%, #080810 100%)",
  },
];

const FALLBACK: FrameDef = {
  id: "ghostFrame", name: "Phantom", rarity: "common", glowColor: "#64748b",
  animationType: "static", variantIndex: 0, ncCost: 0,
  icon: "○", textColor: null, headerBg: null,
};

export function getFrame(frameId: string | null | undefined): FrameDef {
  if (!frameId) return FALLBACK;
  const found = FRAME_CATALOG.find(f => f.id === frameId);
  if (!found) return FALLBACK;
  if (found.mythicAliasOf) {
    const target = FRAME_CATALOG.find(f => f.id === found.mythicAliasOf);
    if (target) {
      // Alias inherits the base frame's animation/variant, but uses its own
      // identity fields (id, name, glowColor) AND its own new display fields.
      return {
        ...target,
        id: found.id,
        name: found.name,
        glowColor: found.glowColor,
        icon: found.icon,
        textColor: found.textColor,
        headerBg: found.headerBg,
      };
    }
  }
  return found;
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
