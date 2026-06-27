import type { ReactElement } from "react";

interface Props {
  itemId: string;
  size?: number;
  className?: string;
}

const ITEM_SVGS: Record<string, (size: number) => ReactElement> = {
  "rusty-blade": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <filter id="rb-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes rb-flicker { 0%,100%{opacity:1} 45%{opacity:.8} 55%{opacity:1} 70%{opacity:.85} }
          .rb-blade{animation:rb-flicker 3s ease-in-out infinite}
        `}</style>
      </defs>
      <rect x="28" y="4" width="8" height="42" rx="2" fill="#3a3028" stroke="#8b6914" strokeWidth="1.5" className="rb-blade" filter="url(#rb-glow)"/>
      <polygon points="28,46 36,46 32,60" fill="#5c4a1e" stroke="#8b6914" strokeWidth="1"/>
      <rect x="22" y="42" width="20" height="4" rx="1" fill="#4a3518" stroke="#8b6914" strokeWidth="1"/>
      <circle cx="22" cy="18" r="2" fill="#8b4513" opacity=".6"/>
      <circle cx="38" cy="28" r="1.5" fill="#8b4513" opacity=".5"/>
      <circle cx="30" cy="34" r="1" fill="#6b3010" opacity=".7"/>
      <rect x="30" y="6" width="2" height="38" fill="#c8a44020" rx="1"/>
    </svg>
  ),

  "shock-glove": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <filter id="sg-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes sg-spark { 0%,100%{opacity:0;transform:scaleY(1)} 40%{opacity:1;transform:scaleY(1.2)} 60%{opacity:.6} }
          @keyframes sg-glow { 0%,100%{filter:drop-shadow(0 0 3px #4fc3f7)} 50%{filter:drop-shadow(0 0 8px #4fc3f7)} }
          .sg-glove{animation:sg-glow 1.5s ease-in-out infinite}
          .sg-spark1{animation:sg-spark 1.2s ease-in-out infinite}
          .sg-spark2{animation:sg-spark 1.2s .4s ease-in-out infinite}
          .sg-spark3{animation:sg-spark 1.2s .8s ease-in-out infinite}
        `}</style>
      </defs>
      <g className="sg-glove" filter="url(#sg-glow)">
        <rect x="18" y="28" width="28" height="22" rx="4" fill="#1a2a3a" stroke="#4fc3f7" strokeWidth="1.5"/>
        <rect x="22" y="16" width="6" height="16" rx="3" fill="#1a2a3a" stroke="#4fc3f7" strokeWidth="1.2"/>
        <rect x="30" y="14" width="6" height="18" rx="3" fill="#1a2a3a" stroke="#4fc3f7" strokeWidth="1.2"/>
        <rect x="38" y="16" width="6" height="16" rx="3" fill="#1a2a3a" stroke="#4fc3f7" strokeWidth="1.2"/>
        <rect x="12" y="30" width="8" height="12" rx="3" fill="#1a2a3a" stroke="#4fc3f7" strokeWidth="1.2"/>
      </g>
      <line x1="24" y1="8" x2="20" y2="14" stroke="#4fc3f7" strokeWidth="1.5" strokeLinecap="round" className="sg-spark1"/>
      <line x1="33" y1="6" x2="33" y2="12" stroke="#81d4fa" strokeWidth="1.5" strokeLinecap="round" className="sg-spark2"/>
      <line x1="42" y1="8" x2="46" y2="14" stroke="#4fc3f7" strokeWidth="1.5" strokeLinecap="round" className="sg-spark3"/>
      <line x1="22" y1="8" x2="18" y2="12" stroke="#b3e5fc" strokeWidth="1" className="sg-spark1"/>
      <line x1="44" y1="8" x2="48" y2="12" stroke="#b3e5fc" strokeWidth="1" className="sg-spark2"/>
    </svg>
  ),

  "neural-cutter": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="nc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff"/>
          <stop offset="100%" stopColor="#006080"/>
        </linearGradient>
        <style>{`
          @keyframes nc-pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
          @keyframes nc-scan { 0%{transform:translateY(-20px)} 100%{transform:translateY(50px)} }
          .nc-wave{animation:nc-pulse 2s ease-in-out infinite}
          .nc-line{animation:nc-scan 2s linear infinite}
        `}</style>
      </defs>
      <polygon points="30,4 34,4 36,48 28,48" fill="url(#nc-grad)" opacity=".9"/>
      <polygon points="30,4 34,4 32,8" fill="#ffffff" opacity=".9"/>
      <rect x="25" y="48" width="14" height="5" rx="1" fill="#006080" stroke="#00d4ff40" strokeWidth="1"/>
      <rect x="22" y="53" width="20" height="6" rx="2" fill="#003a4a" stroke="#00d4ff60" strokeWidth="1"/>
      <line x1="32" y1="10" x2="32" y2="46" stroke="#ffffff" strokeWidth=".5" opacity=".6"/>
      <rect x="30" y="0" width="4" height="60" fill="#00d4ff08" className="nc-line"/>
      <line x1="26" y1="30" x2="38" y2="30" stroke="#00d4ff" strokeWidth=".5" opacity=".4" className="nc-wave"/>
      <line x1="27" y1="35" x2="37" y2="35" stroke="#00d4ff" strokeWidth=".5" opacity=".3" className="nc-wave"/>
    </svg>
  ),

  "plasma-pistol": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="pp-plasma" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ff8c00"/>
          <stop offset="50%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#3b0070"/>
        </radialGradient>
        <style>{`
          @keyframes pp-charge { 0%,100%{r:3;opacity:.5} 50%{r:6;opacity:1} }
          @keyframes pp-glow { 0%,100%{filter:drop-shadow(0 0 4px #a855f7)} 50%{filter:drop-shadow(0 0 10px #ff8c00)} }
          .pp-body{animation:pp-glow 2s ease-in-out infinite}
          .pp-cell{animation:pp-charge 1.5s ease-in-out infinite}
        `}</style>
      </defs>
      <g className="pp-body">
        <rect x="10" y="20" width="38" height="16" rx="3" fill="#1a0a2e" stroke="#a855f7" strokeWidth="1.5"/>
        <rect x="44" y="22" width="10" height="6" rx="1" fill="#0d0018" stroke="#ff8c00" strokeWidth="1"/>
        <rect x="22" y="36" width="16" height="18" rx="2" fill="#1a0a2e" stroke="#a855f7" strokeWidth="1.2"/>
        <rect x="26" y="52" width="10" height="4" rx="1" fill="#0d0018"/>
        <rect x="14" y="24" width="6" height="4" rx="1" fill="#2d1050" stroke="#a855f760" strokeWidth=".5"/>
        <rect x="22" y="24" width="6" height="4" rx="1" fill="#2d1050" stroke="#a855f760" strokeWidth=".5"/>
      </g>
      <circle cx="51" cy="25" r="3" fill="url(#pp-plasma)" className="pp-cell"/>
    </svg>
  ),

  "leather-coat": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes lc-shimmer { 0%,100%{opacity:.1} 50%{opacity:.3} }
          .lc-sheen{animation:lc-shimmer 3s ease-in-out infinite}
        `}</style>
      </defs>
      <path d="M20,8 L10,20 L10,54 L28,54 L28,30 L36,30 L36,54 L54,54 L54,20 L44,8 Z" fill="#2a1a0a" stroke="#8b6914" strokeWidth="1.5"/>
      <path d="M20,8 L28,18 L28,30" stroke="#c8a440" strokeWidth="1" fill="none"/>
      <path d="M44,8 L36,18 L36,30" stroke="#c8a440" strokeWidth="1" fill="none"/>
      <rect x="28" y="8" width="8" height="30" fill="#3a2510" stroke="#8b691430" strokeWidth="1"/>
      <line x1="14" y1="25" x2="24" y2="25" stroke="#c8a44020" strokeWidth="2"/>
      <line x1="40" y1="25" x2="50" y2="25" stroke="#c8a44020" strokeWidth="2"/>
      <rect x="12" y="24" width="50" height="6" fill="#c8a44008" className="lc-sheen" rx="1"/>
    </svg>
  ),

  "kevlar-vest": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <pattern id="kv-grid" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="none"/>
          <rect x="0" y="0" width="3" height="3" fill="#f59e0b10"/>
          <rect x="3" y="3" width="3" height="3" fill="#f59e0b10"/>
        </pattern>
        <style>{`
          @keyframes kv-scan { 0%{transform:translateY(-30px)} 100%{transform:translateY(70px)} }
          .kv-line{animation:kv-scan 3s linear infinite;opacity:.4}
        `}</style>
      </defs>
      <rect x="12" y="8" width="40" height="48" rx="4" fill="#1a1a0a" stroke="#f59e0b" strokeWidth="1.5"/>
      <rect x="12" y="8" width="40" height="48" rx="4" fill="url(#kv-grid)"/>
      <rect x="16" y="12" width="14" height="14" rx="2" fill="#2a2a10" stroke="#f59e0b60" strokeWidth="1"/>
      <rect x="34" y="12" width="14" height="14" rx="2" fill="#2a2a10" stroke="#f59e0b60" strokeWidth="1"/>
      <rect x="16" y="30" width="32" height="22" rx="2" fill="#222210" stroke="#f59e0b40" strokeWidth="1"/>
      <rect x="10" y="0" width="44" height="6" fill="#f59e0b10" rx="1" className="kv-line"/>
    </svg>
  ),

  "subdermal-plating": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes sp-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.9;transform:scale(1.05)} }
          @keyframes sp-flow { 0%{stroke-dashoffset:40} 100%{stroke-dashoffset:0} }
          .sp-core{animation:sp-pulse 2s ease-in-out infinite}
          .sp-circuit{animation:sp-flow 2s linear infinite;stroke-dasharray:6 4}
        `}</style>
      </defs>
      <ellipse cx="32" cy="32" rx="22" ry="26" fill="#0a1a1a" stroke="#00d4ff" strokeWidth="1.5"/>
      <ellipse cx="32" cy="32" rx="14" ry="18" fill="#0d2a2a" stroke="#00d4ff80" strokeWidth="1" className="sp-core"/>
      <line x1="32" y1="14" x2="32" y2="50" stroke="#00d4ff" strokeWidth=".8" className="sp-circuit"/>
      <line x1="10" y1="32" x2="54" y2="32" stroke="#00d4ff" strokeWidth=".8" className="sp-circuit"/>
      <line x1="16" y1="16" x2="48" y2="48" stroke="#00d4ff60" strokeWidth=".6" className="sp-circuit"/>
      <line x1="48" y1="16" x2="16" y2="48" stroke="#00d4ff60" strokeWidth=".6" className="sp-circuit"/>
      <circle cx="32" cy="32" r="5" fill="#00d4ff40" stroke="#00d4ff" strokeWidth="1.5" className="sp-core"/>
      <circle cx="32" cy="32" r="2" fill="#00d4ff" className="sp-core"/>
    </svg>
  ),

  "corpo-suit": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes cs-sheen { 0%{transform:translateX(-30px)} 100%{transform:translateX(80px)} }
          .cs-shine{animation:cs-sheen 4s ease-in-out infinite;opacity:.15}
        `}</style>
      </defs>
      <path d="M20,6 L14,22 L14,58 L50,58 L50,22 L44,6 Z" fill="#0e0e16" stroke="#d4af37" strokeWidth="1.5"/>
      <path d="M26,6 L32,20 L38,6" fill="#1a1a24" stroke="#d4af37" strokeWidth="1"/>
      <line x1="32" y1="20" x2="32" y2="58" stroke="#d4af3740" strokeWidth="2"/>
      <rect x="22" y="24" width="8" height="4" rx="1" fill="#d4af3720" stroke="#d4af3780" strokeWidth=".5"/>
      <rect x="34" y="24" width="8" height="4" rx="1" fill="#d4af3720" stroke="#d4af3780" strokeWidth=".5"/>
      <rect x="26" y="34" width="12" height="20" fill="#1a1a24" stroke="#d4af3740" strokeWidth=".5" rx="1"/>
      <path d="M28,36 L28,52 M36,36 L36,52" stroke="#d4af3730" strokeWidth=".8"/>
      <line x1="14" y1="58" x2="20" y2="38" stroke="#d4af3730" strokeWidth="1"/>
      <line x1="50" y1="58" x2="44" y2="38" stroke="#d4af3730" strokeWidth="1"/>
      <rect x="10" y="0" width="8" height="64" fill="#d4af3720" rx="2" className="cs-shine"/>
    </svg>
  ),

  "street-jacket": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes sj-buzz { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:.7} 94%{opacity:1} }
          .sj-body{animation:sj-buzz 2.5s ease-in-out infinite}
        `}</style>
      </defs>
      <g className="sj-body">
        <path d="M18,6 L8,22 L8,56 L28,56 L28,28 L36,28 L36,56 L56,56 L56,22 L46,6 Z" fill="#1a0a08" stroke="#ff2d55" strokeWidth="1.5"/>
        <path d="M18,6 L28,16" stroke="#ff2d5580" strokeWidth="2" fill="none"/>
        <path d="M46,6 L36,16" stroke="#ff2d5580" strokeWidth="2" fill="none"/>
        <rect x="10" y="26" width="16" height="8" rx="1" fill="#2a1010" stroke="#ff2d5540" strokeWidth=".8"/>
        <rect x="38" y="26" width="16" height="8" rx="1" fill="#2a1010" stroke="#ff2d5540" strokeWidth=".8"/>
        <circle cx="16" cy="14" r="2" fill="#ff2d5580"/>
        <circle cx="48" cy="14" r="2" fill="#ff2d5580"/>
        <rect x="14" y="36" width="4" height="4" fill="#ff2d55" rx=".5"/>
        <rect x="22" y="36" width="4" height="4" fill="#f59e0b" rx=".5"/>
        <rect x="42" y="38" width="6" height="2" fill="#ff2d5540" rx=".5"/>
        <rect x="42" y="42" width="8" height="2" fill="#ff2d5530" rx=".5"/>
        <text x="30" y="44" fontSize="6" fill="#ff2d55" fontFamily="monospace" textAnchor="middle">STREET</text>
      </g>
    </svg>
  ),

  "stim-pack": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes stim-bubble1 { 0%,100%{cy:44;opacity:0} 50%{cy:20;opacity:.8} }
          @keyframes stim-bubble2 { 0%,100%{cy:48;opacity:0} 40%{cy:22;opacity:.6} }
          @keyframes stim-glow { 0%,100%{filter:drop-shadow(0 0 3px #39d353)} 50%{filter:drop-shadow(0 0 8px #39d353)} }
          .stim-body{animation:stim-glow 2s ease-in-out infinite}
          .stim-b1{animation:stim-bubble1 1.8s ease-in-out infinite}
          .stim-b2{animation:stim-bubble2 1.8s .6s ease-in-out infinite}
        `}</style>
      </defs>
      <g className="stim-body">
        <rect x="26" y="6" width="12" height="4" rx="1" fill="#1a2a1a" stroke="#39d353" strokeWidth="1.2"/>
        <rect x="22" y="10" width="20" height="44" rx="4" fill="#0d1f0d" stroke="#39d353" strokeWidth="1.5"/>
        <rect x="22" y="10" width="20" height="36" rx="4" fill="#39d35320"/>
        <rect x="24" y="44" width="16" height="8" rx="2" fill="#0d1f0d"/>
        <line x1="32" y1="52" x2="32" y2="58" stroke="#39d353" strokeWidth="2"/>
        <circle cx="32" cy="59" r="2" fill="#39d353"/>
      </g>
      <circle cx="28" cy="44" r="2" fill="#39d35380" className="stim-b1"/>
      <circle cx="34" cy="48" r="1.5" fill="#39d35360" className="stim-b2"/>
      <circle cx="30" cy="46" r="1" fill="#39d35370"/>
    </svg>
  ),

  "med-patch": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes mp-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:.8} }
          @keyframes mp-heartbeat { 0%,100%{d:path("M16,32 L22,32 L26,24 L30,40 L34,28 L38,36 L42,32 L48,32")} 50%{d:path("M16,32 L20,32 L26,20 L30,44 L34,24 L38,38 L44,32 L48,32")} }
          .mp-cross{animation:mp-pulse 1.5s ease-in-out infinite}
        `}</style>
      </defs>
      <rect x="8" y="16" width="48" height="32" rx="5" fill="#1a0a0a" stroke="#ff2d55" strokeWidth="1.5"/>
      <rect x="8" y="24" width="48" height="16" rx="1" fill="#ff2d5510"/>
      <rect x="24" y="16" width="16" height="32" rx="1" fill="#ff2d5510"/>
      <rect x="26" y="20" width="12" height="24" rx="2" fill="#ff2d5520"/>
      <g className="mp-cross">
        <rect x="28" y="22" width="8" height="20" rx="2" fill="#ff2d55"/>
        <rect x="22" y="28" width="20" height="8" rx="2" fill="#ff2d55"/>
      </g>
      <path d="M16,38 L22,38 L26,30 L30,46 L34,34 L38,40 L42,38 L48,38" stroke="#ff2d5540" strokeWidth="1" fill="none" strokeLinecap="round"/>
    </svg>
  ),

  "nerve-tonic": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes nt-swirl { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
          @keyframes nt-glow { 0%,100%{filter:drop-shadow(0 0 4px #a855f7)} 50%{filter:drop-shadow(0 0 10px #7c3aed)} }
          .nt-bottle{animation:nt-glow 2s ease-in-out infinite}
          .nt-liquid{transform-origin:32px 40px;animation:nt-swirl 4s linear infinite}
        `}</style>
      </defs>
      <g className="nt-bottle">
        <rect x="26" y="4" width="12" height="6" rx="2" fill="#2a1040" stroke="#a855f7" strokeWidth="1.2"/>
        <path d="M22,10 L16,22 L16,56 L48,56 L48,22 L42,10 Z" fill="#1a0830" stroke="#a855f7" strokeWidth="1.5" rx="2"/>
        <path d="M22,10 L16,22 L16,56 L48,56 L48,22 L42,10 Z" fill="#a855f715"/>
      </g>
      <ellipse cx="32" cy="40" rx="10" ry="8" fill="#a855f730" className="nt-liquid"/>
      <ellipse cx="32" cy="36" rx="6" ry="5" fill="#7c3aed40" className="nt-liquid"/>
      <circle cx="24" cy="30" r="2" fill="#a855f740" opacity=".7"/>
      <circle cx="38" cy="44" r="1.5" fill="#7c3aed40" opacity=".7"/>
      <circle cx="32" cy="26" r="1" fill="#a855f780"/>
    </svg>
  ),

  "trauma-kit": (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <defs>
        <style>{`
          @keyframes tk-blink { 0%,100%{opacity:1} 50%{opacity:.4} }
          @keyframes tk-pulse { 0%,100%{filter:drop-shadow(0 0 3px #ff2d55)} 50%{filter:drop-shadow(0 0 8px #ff2d55)} }
          .tk-cross{animation:tk-blink 1.2s ease-in-out infinite}
          .tk-case{animation:tk-pulse 2s ease-in-out infinite}
          .tk-dot{animation:tk-blink 1.2s .6s ease-in-out infinite}
        `}</style>
      </defs>
      <g className="tk-case">
        <rect x="6" y="18" width="52" height="36" rx="4" fill="#100a0a" stroke="#ff2d55" strokeWidth="2"/>
        <rect x="22" y="10" width="20" height="10" rx="3" fill="#1a0a0a" stroke="#ff2d55" strokeWidth="1.5"/>
        <rect x="26" y="12" width="12" height="6" rx="2" fill="#100a0a"/>
        <line x1="6" y1="36" x2="58" y2="36" stroke="#ff2d5530" strokeWidth="1"/>
      </g>
      <g className="tk-cross">
        <rect x="28" y="22" width="8" height="24" rx="2" fill="#ff2d55"/>
        <rect x="20" y="30" width="24" height="8" rx="2" fill="#ff2d55"/>
      </g>
      <circle cx="50" cy="22" r="3" fill="#ff2d55" className="tk-dot"/>
      <circle cx="50" cy="22" r="1.5" fill="#fff" className="tk-dot"/>
    </svg>
  ),
};

const FALLBACK_COLORS: Record<string, string> = {
  weapon: "#ff6b35",
  armor: "#00d4ff",
  clothing: "#a855f7",
  consumable: "#39d353",
  material: "#f59e0b",
  misc: "#94a3b8",
};

const TYPE_ICONS: Record<string, string> = {
  weapon: "⚔", armor: "🛡", clothing: "👗", consumable: "💊", misc: "📦",
};

interface FallbackProps {
  type?: string;
  rarity?: string;
  size: number;
}

function FallbackIcon({ type = "misc", size }: FallbackProps) {
  const color = FALLBACK_COLORS[type] ?? "#94a3b8";
  return (
    <div
      style={{
        width: size, height: size,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.45,
      }}
    >
      {TYPE_ICONS[type] ?? "📦"}
    </div>
  );
}

export function ItemImage({ itemId, size = 48, className }: Props) {
  const renderer = ITEM_SVGS[itemId];
  if (!renderer) return <FallbackIcon size={size} type={itemId.includes("weapon") ? "weapon" : "misc"} />;
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {renderer(size)}
    </div>
  );
}

export function getItemType(itemId: string): string {
  if (["rusty-blade","shock-glove","neural-cutter","plasma-pistol"].includes(itemId)) return "weapon";
  if (["leather-coat","kevlar-vest","subdermal-plating"].includes(itemId)) return "armor";
  if (["corpo-suit","street-jacket"].includes(itemId)) return "clothing";
  if (["stim-pack","med-patch","nerve-tonic","trauma-kit"].includes(itemId)) return "consumable";
  return "misc";
}
