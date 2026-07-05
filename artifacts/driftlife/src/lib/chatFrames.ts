import type { CSSProperties } from "react";

export interface ChatFrame {
  id: string;
  name: string;
  tier: "standard" | "rare" | "elite" | "legendary";
  price: number;
  description: string;
  nameBarStyle: CSSProperties;
  messageBorderStyle: CSSProperties;
  nameBarClass?: string;
  messageBgClass?: string;
  animationCss?: string;
  badge?: string;
}

export const CHAT_FRAMES: ChatFrame[] = [
  {
    id: "neon_street",
    name: "Neon Street",
    tier: "standard",
    price: 500,
    description: "The classic street racer look. Cyan neon on pure black.",
    nameBarStyle: { background: "#00d4ff", color: "#000" },
    messageBorderStyle: { border: "1px solid #00d4ff60", background: "#00d4ff08" },
  },
  {
    id: "red_heat",
    name: "Red Heat",
    tier: "standard",
    price: 500,
    description: "Born from the heat of the chase. Blazing red frame.",
    nameBarStyle: { background: "#ff2d55", color: "#fff" },
    messageBorderStyle: { border: "1px solid #ff2d5560", background: "#ff2d5508" },
  },
  {
    id: "grid_runner",
    name: "Grid Runner",
    tier: "standard",
    price: 500,
    description: "Grid faction style. Digital teal with circuit vibes.",
    nameBarStyle: { background: "linear-gradient(90deg,#00d4ff,#00ff9d)", color: "#000" },
    messageBorderStyle: { border: "1px solid #00ff9d60", background: "#00ff9d06" },
  },
  {
    id: "suits_gold",
    name: "Suits Gold",
    tier: "standard",
    price: 500,
    description: "Polished and powerful. The Suits never settle.",
    nameBarStyle: { background: "linear-gradient(90deg,#f59e0b,#fbbf24)", color: "#000" },
    messageBorderStyle: { border: "1px solid #f59e0b60", background: "#f59e0b06" },
  },
  {
    id: "void_purple",
    name: "Void Purple",
    tier: "rare",
    price: 1500,
    description: "Deep void energy. Purple fades into the abyss.",
    nameBarStyle: { background: "linear-gradient(90deg,#a855f7,#7c3aed)", color: "#fff" },
    messageBorderStyle: { border: "1px solid #a855f760", background: "#a855f708" },
  },
  {
    id: "toxic_green",
    name: "Toxic Green",
    tier: "rare",
    price: 1500,
    description: "Radioactive glow. Not from this district.",
    nameBarStyle: { background: "#39d353", color: "#000" },
    messageBorderStyle: { border: "1px solid #39d35360", background: "#39d35308" },
  },
  {
    id: "chrome_rise",
    name: "Chrome Rise",
    tier: "rare",
    price: 1500,
    description: "Polished chrome finish. Reflects the city lights.",
    nameBarStyle: { background: "linear-gradient(90deg,#94a3b8,#e2e8f0,#94a3b8)", color: "#000" },
    messageBorderStyle: { border: "1px solid #94a3b860", background: "#94a3b806" },
  },
  {
    id: "infrared",
    name: "Infrared",
    tier: "rare",
    price: 1500,
    description: "Heat signature visible from orbit. Orange-red burn.",
    nameBarStyle: { background: "linear-gradient(90deg,#ff6b35,#ff2d55)", color: "#fff" },
    messageBorderStyle: { border: "1px solid #ff6b3560", background: "#ff6b3508" },
  },
  {
    id: "drift_king",
    name: "Drift King",
    tier: "elite",
    price: 4000,
    description: "Reserved for those who've left tire marks on every track.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#f59e0b,#ff6b35,#ff2d55)",
      color: "#fff",
      fontWeight: "bold",
    },
    messageBorderStyle: {
      border: "1px solid #f59e0b",
      background: "linear-gradient(135deg,#f59e0b08,#ff2d5508)",
      boxShadow: "0 0 8px #f59e0b30",
    },
    badge: "👑",
  },
  {
    id: "cyber_phantom",
    name: "Cyber Phantom",
    tier: "elite",
    price: 4000,
    description: "Ghost in the machine. Shimmering blue phantom energy.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#0ea5e9,#a855f7)",
      color: "#fff",
    },
    messageBorderStyle: {
      border: "1px solid #0ea5e960",
      background: "#0ea5e908",
      boxShadow: "0 0 8px #0ea5e930",
    },
    badge: "👻",
  },
  {
    id: "neon_pulse",
    name: "Neon Pulse",
    tier: "elite",
    price: 4000,
    description: "Pulsing neon that never stops. Pink and electric.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#ec4899,#a855f7,#00d4ff)",
      color: "#fff",
    },
    messageBorderStyle: {
      border: "1px solid #ec489960",
      background: "#ec489908",
      boxShadow: "0 0 10px #ec489930",
    },
    badge: "⚡",
    animationCss: "neon-pulse",
  },
  {
    id: "nitro_blaze",
    name: "Nitro Blaze",
    tier: "elite",
    price: 4000,
    description: "Full nitro injection. You can almost smell the fuel.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#fbbf24,#f59e0b,#ff6b35)",
      color: "#000",
      fontWeight: "bold",
    },
    messageBorderStyle: {
      border: "1px solid #fbbf2460",
      background: "#fbbf2408",
      boxShadow: "0 0 8px #fbbf2430",
    },
    badge: "🔥",
  },
  {
    id: "shadow_lord",
    name: "Shadow Lord",
    tier: "legendary",
    price: 10000,
    description: "The darkest frame in New Vanta. Only the ruthless earn this.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#1e1e2e,#334155,#1e1e2e)",
      color: "#ff2d55",
      fontWeight: "bold",
      border: "1px solid #ff2d55",
      letterSpacing: "0.1em",
    },
    messageBorderStyle: {
      border: "1px solid #ff2d55",
      background: "#ff2d5506",
      boxShadow: "0 0 12px #ff2d5540",
    },
    badge: "💀",
    animationCss: "shadow-lord-pulse",
  },
  {
    id: "galaxy_drift",
    name: "Galaxy Drift",
    tier: "legendary",
    price: 10000,
    description: "Across galaxies, one driver remains undefeated.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#0f0c29,#302b63,#24243e,#a855f7,#00d4ff)",
      color: "#fff",
      fontWeight: "bold",
    },
    messageBorderStyle: {
      border: "1px solid #a855f7",
      background: "linear-gradient(135deg,#a855f708,#00d4ff08)",
      boxShadow: "0 0 16px #a855f740",
    },
    badge: "🌌",
    animationCss: "galaxy-shift",
  },
  {
    id: "apex_predator",
    name: "Apex Predator",
    tier: "legendary",
    price: 10000,
    description: "Top of the food chain. The city fears this frame.",
    nameBarStyle: {
      background: "linear-gradient(90deg,#ff2d55,#f59e0b,#ff2d55)",
      color: "#fff",
      fontWeight: "bold",
      letterSpacing: "0.08em",
    },
    messageBorderStyle: {
      border: "1px solid #f59e0b",
      background: "#f59e0b06",
      boxShadow: "0 0 14px #f59e0b50",
    },
    badge: "🦅",
    animationCss: "apex-glow",
  },
];

export const FRAME_TIER_COLOR: Record<string, string> = {
  standard: "#94a3b8",
  rare: "#00d4ff",
  elite: "#a855f7",
  legendary: "#f59e0b",
};

export const FRAME_TIER_LABEL: Record<string, string> = {
  standard: "STANDARD",
  rare: "RARE",
  elite: "ELITE",
  legendary: "LEGENDARY",
};

export function getFrame(id: string | null | undefined): ChatFrame | null {
  if (!id) return null;
  return CHAT_FRAMES.find(f => f.id === id) ?? null;
}
