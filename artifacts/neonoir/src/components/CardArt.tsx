/**
 * CardArt — Programmatic SVG card art for all Neonoir item types.
 * Generates visually distinct, tier-appropriate card illustrations.
 * Used in place of missing imageCard assets across Royale, Arena, and Garage.
 */

import { useId } from "react";

const TIER_PALETTE: Record<string, { primary: string; secondary: string; glow: string; bg: string; accent: string }> = {
  common:    { primary: "#9ca3af", secondary: "#6b7280", glow: "#6b728060", bg: "#111118", accent: "#d1d5db" },
  uncommon:  { primary: "#4ade80", secondary: "#22c55e", glow: "#22c55e60", bg: "#0a150b", accent: "#86efac" },
  rare:      { primary: "#60a5fa", secondary: "#3b82f6", glow: "#3b82f660", bg: "#080f1a", accent: "#93c5fd" },
  epic:      { primary: "#c084fc", secondary: "#a855f7", glow: "#a855f780", bg: "#0e0818", accent: "#d8b4fe" },
  legendary: { primary: "#fbbf24", secondary: "#f59e0b", glow: "#f59e0b80", bg: "#120b00", accent: "#fde68a" },
};

// ── Weapon Art ────────────────────────────────────────────────────────────────
function WeaponArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}_blur`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* glow circle */}
      <ellipse cx="100" cy="120" rx="70" ry="60" fill={`url(#${id}_glow)`} />
      {/* gun body */}
      <rect x="50" y="95" width="90" height="18" rx="4" fill={p.secondary} opacity="0.9" />
      <rect x="110" y="88" width="32" height="10" rx="3" fill={p.primary} opacity="0.95" />
      {/* barrel */}
      <rect x="140" y="98" width="28" height="8" rx="2" fill={p.accent} opacity="0.8" />
      {/* handle */}
      <rect x="60" y="111" width="16" height="26" rx="4" fill={p.secondary} opacity="0.85" />
      {/* trigger guard */}
      <path d="M72 113 Q82 126 92 113" stroke={p.primary} strokeWidth="2.5" fill="none" opacity="0.7" />
      {/* scope (rare+) */}
      {(tier === "rare" || isEpic || isLegendary) && (
        <rect x="90" y="85" width="30" height="10" rx="3" fill={p.accent} opacity="0.8" />
      )}
      {/* energy glow line (epic+) */}
      {(isEpic || isLegendary) && (
        <line x1="140" y1="102" x2="168" y2="102" stroke={p.primary} strokeWidth="3" opacity="0.9"
          style={{ filter: `drop-shadow(0 0 4px ${p.primary})` }} />
      )}
      {/* muzzle flash (legendary) */}
      {isLegendary && (
        <>
          <polygon points="168,99 180,102 168,105" fill={p.accent} opacity="0.95"
            style={{ filter: `drop-shadow(0 0 6px ${p.accent})` }} />
          <polygon points="172,95 184,102 172,109" fill={p.primary} opacity="0.6" />
        </>
      )}
      {/* shine */}
      <rect x="55" y="97" width="40" height="3" rx="1" fill="white" opacity="0.12" />
    </g>
  );
}

// ── Armor Art ─────────────────────────────────────────────────────────────────
function ArmorArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.35" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="65" ry="65" fill={`url(#${id}_glow)`} />
      {/* vest body */}
      <path d="M65 75 L55 100 L55 145 L145 145 L145 100 L135 75 Z"
        fill={p.secondary} opacity="0.85" stroke={p.primary} strokeWidth="1.5" />
      {/* collar */}
      <path d="M65 75 L80 65 L100 70 L120 65 L135 75" stroke={p.primary} strokeWidth="2" fill="none" opacity="0.9" />
      {/* chest plate */}
      <rect x="75" y="90" width="50" height="40" rx="6" fill={p.primary} opacity="0.2"
        stroke={p.primary} strokeWidth="1" />
      {/* center emblem */}
      <polygon points="100,95 108,108 100,121 92,108"
        fill={p.accent} opacity={isLegendary ? 0.95 : 0.7}
        style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 5px ${p.accent})` } : {}} />
      {/* shoulder pads */}
      <ellipse cx="65" cy="92" rx="12" ry="16" fill={p.secondary} opacity="0.9" stroke={p.primary} strokeWidth="1" />
      <ellipse cx="135" cy="92" rx="12" ry="16" fill={p.secondary} opacity="0.9" stroke={p.primary} strokeWidth="1" />
      {/* buckles */}
      <rect x="87" y="125" width="8" height="6" rx="2" fill={p.accent} opacity="0.8" />
      <rect x="105" y="125" width="8" height="6" rx="2" fill={p.accent} opacity="0.8" />
      {/* energy lines (epic+) */}
      {(isEpic || isLegendary) && (
        <>
          <line x1="75" y1="110" x2="91" y2="110" stroke={p.accent} strokeWidth="1.5" opacity="0.7" />
          <line x1="109" y1="110" x2="125" y2="110" stroke={p.accent} strokeWidth="1.5" opacity="0.7" />
        </>
      )}
      <rect x="68" y="78" width="20" height="4" rx="2" fill="white" opacity="0.08" />
    </g>
  );
}

// ── Consumable Art ────────────────────────────────────────────────────────────
function ConsumableArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}_bottle`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p.secondary} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="55" ry="55" fill={`url(#${id}_glow)`} />
      {/* bottle */}
      <rect x="82" y="85" width="36" height="55" rx="10" fill={`url(#${id}_bottle)`}
        stroke={p.primary} strokeWidth="1.5"
        style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 6px ${p.primary})` } : {}} />
      {/* cap */}
      <rect x="88" y="75" width="24" height="14" rx="5" fill={p.accent} opacity="0.95" stroke={p.primary} strokeWidth="1" />
      {/* label stripe */}
      <rect x="82" y="108" width="36" height="14" fill="white" opacity="0.1" />
      {/* cross symbol */}
      <rect x="96" y="99" width="8" height="22" rx="2" fill="white" opacity="0.8" />
      <rect x="90" y="105" width="20" height="8" rx="2" fill="white" opacity="0.8" />
      {/* bubbles (epic+) */}
      {(isEpic || isLegendary) && (
        <>
          <circle cx="91" cy="120" r="2.5" fill={p.accent} opacity="0.7" />
          <circle cx="109" cy="115" r="2" fill={p.accent} opacity="0.6" />
          <circle cx="96" cy="130" r="1.5" fill={p.accent} opacity="0.5" />
        </>
      )}
      {/* shine */}
      <rect x="86" y="87" width="8" height="28" rx="4" fill="white" opacity="0.15" />
    </g>
  );
}

// ── Ammo Art ──────────────────────────────────────────────────────────────────
function AmmoArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  const bullets = [88, 100, 112];
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.3" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="55" ry="55" fill={`url(#${id}_glow)`} />
      {bullets.map((x, i) => (
        <g key={i} transform={`translate(${x}, 85)`}>
          {/* case */}
          <rect x="-5" y="15" width="10" height="30" rx="2" fill={p.secondary} opacity="0.9"
            stroke={p.primary} strokeWidth="0.5" />
          {/* tip */}
          <ellipse cx="0" cy="15" rx="5" ry="8" fill={p.accent} opacity="0.95"
            style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 4px ${p.accent})` } : {}} />
          {/* rim */}
          <rect x="-6" y="43" width="12" height="3" rx="1" fill={p.primary} opacity="0.6" />
          {/* energy trace (epic+) */}
          {(isEpic || isLegendary) && (
            <line x1="0" y1="7" x2="0" y2="0" stroke={p.accent} strokeWidth="2" opacity="0.8" />
          )}
        </g>
      ))}
      {/* box */}
      <rect x="72" y="120" width="56" height="20" rx="4" fill={p.secondary} opacity="0.5" stroke={p.primary} strokeWidth="1" />
      <rect x="76" y="124" width="48" height="3" rx="1" fill={p.primary} opacity="0.4" />
    </g>
  );
}

// ── Car Art ───────────────────────────────────────────────────────────────────
function CarArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="70%" r="55%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}_body`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={p.secondary} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="125" rx="75" ry="40" fill={`url(#${id}_glow)`} />
      {/* shadow */}
      <ellipse cx="100" cy="147" rx="60" ry="8" fill="black" opacity="0.5" />
      {/* body */}
      <path d="M30 120 L40 95 L75 80 L125 80 L160 95 L170 120 L170 138 L30 138 Z"
        fill={`url(#${id}_body)`} stroke={p.primary} strokeWidth="1.5"
        style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 6px ${p.primary})` } : {}} />
      {/* windshield */}
      <path d="M78 82 L72 108 L128 108 L122 82 Z" fill="#0a1a2a" opacity="0.8" stroke={p.accent} strokeWidth="1" />
      {/* windows */}
      <path d="M78 84 L73 106 L98 106 L98 84 Z" fill="#0d2035" opacity="0.7" />
      <path d="M102 84 L102 106 L127 106 L122 84 Z" fill="#0d2035" opacity="0.7" />
      {/* wheels */}
      {[55, 145].map(x => (
        <g key={x}>
          <circle cx={x} cy="138" r="16" fill="#0a0a14" stroke={p.primary} strokeWidth="2" />
          <circle cx={x} cy="138" r="10" fill={p.secondary} opacity="0.4" />
          <circle cx={x} cy="138" r="4" fill={p.accent} opacity="0.8" />
          {[0, 60, 120, 180, 240, 300].map(deg => {
            const rad = deg * Math.PI / 180;
            return <line key={deg} x1={x} y1={138} x2={x + Math.cos(rad) * 9} y2={138 + Math.sin(rad) * 9}
              stroke={p.primary} strokeWidth="1.5" opacity="0.6" />;
          })}
        </g>
      ))}
      {/* underglow (uncommon+) */}
      {tier !== "common" && (
        <rect x="35" y="138" width="130" height="4" rx="2" fill={p.primary} opacity="0.5"
          style={{ filter: `blur(3px)` }} />
      )}
      {/* headlights */}
      <ellipse cx="168" cy="110" rx="5" ry="8" fill={p.accent} opacity="0.9"
        style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 8px ${p.accent})` } : {}} />
      {/* spoiler (rare+) */}
      {["rare", "epic", "legendary"].includes(tier) && (
        <rect x="25" y="92" width="8" height="24" rx="2" fill={p.secondary} opacity="0.85" stroke={p.primary} strokeWidth="1" />
      )}
      {/* nitro flames (legendary) */}
      {isLegendary && (
        <>
          <ellipse cx="22" cy="122" rx="12" ry="6" fill="#f97316" opacity="0.9"
            style={{ filter: "drop-shadow(0 0 8px #f97316)" }} />
          <ellipse cx="16" cy="122" rx="7" ry="4" fill="#fbbf24" opacity="0.9" />
        </>
      )}
      {/* shine */}
      <path d="M60 84 Q100 81 140 84 L138 90 Q100 87 62 90 Z" fill="white" opacity="0.1" />
    </g>
  );
}

// ── Car Part Art ──────────────────────────────────────────────────────────────
function CarPartArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.35" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="60" ry="60" fill={`url(#${id}_glow)`} />
      {/* gear */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
        const rad = deg * Math.PI / 180;
        const x = 100 + Math.cos(rad) * 46;
        const y = 110 + Math.sin(rad) * 46;
        return <rect key={deg} x={x - 6} y={y - 5} width="12" height="10" rx="2"
          fill={p.secondary} opacity="0.85"
          transform={`rotate(${deg}, ${x}, ${y})`}
          stroke={p.primary} strokeWidth="0.5" />;
      })}
      <circle cx="100" cy="110" r="40" fill={p.bg} stroke={p.primary} strokeWidth="2"
        style={isLegendary || isEpic ? { filter: `drop-shadow(0 0 5px ${p.primary})` } : {}} />
      <circle cx="100" cy="110" r="26" fill={p.secondary} opacity="0.3" stroke={p.primary} strokeWidth="1.5" />
      <circle cx="100" cy="110" r="10" fill={p.accent} opacity="0.8" />
      {/* spokes */}
      {[0, 60, 120, 180, 240, 300].map(deg => {
        const rad = deg * Math.PI / 180;
        return <line key={deg}
          x1={100 + Math.cos(rad) * 11} y1={110 + Math.sin(rad) * 11}
          x2={100 + Math.cos(rad) * 25} y2={110 + Math.sin(rad) * 25}
          stroke={p.primary} strokeWidth="2.5" opacity="0.7" />;
      })}
      {/* energy ring (epic+) */}
      {(isEpic || isLegendary) && (
        <circle cx="100" cy="110" r="33" fill="none" stroke={p.accent} strokeWidth="1.5"
          strokeDasharray="6 3" opacity="0.8" />
      )}
    </g>
  );
}

// ── Currency Art ──────────────────────────────────────────────────────────────
function CurrencyArt({ p, id }: { p: typeof TIER_PALETTE.common; id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.5" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}_coin`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.accent} />
          <stop offset="100%" stopColor={p.secondary} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="105" r="70" fill={`url(#${id}_glow)`} />
      <circle cx="100" cy="105" r="48" fill={`url(#${id}_coin)`} stroke={p.primary} strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 10px ${p.primary})` }} />
      <circle cx="100" cy="105" r="40" fill="none" stroke={p.accent} strokeWidth="1" opacity="0.5" />
      {/* DC symbol */}
      <text x="100" y="114" textAnchor="middle" fontFamily="monospace" fontWeight="bold"
        fontSize="28" fill={p.bg} opacity="0.95">DC</text>
      {/* shine */}
      <ellipse cx="85" cy="90" rx="14" ry="10" fill="white" opacity="0.15" transform="rotate(-30, 85, 90)" />
      {/* stack coins behind */}
      <ellipse cx="108" cy="125" rx="38" ry="8" fill={p.secondary} opacity="0.4" />
      <ellipse cx="108" cy="131" rx="38" ry="8" fill={p.secondary} opacity="0.3" />
    </g>
  );
}

// ── Energy Art ────────────────────────────────────────────────────────────────
function EnergyArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="65" ry="65" fill={`url(#${id}_glow)`} />
      {/* bolt */}
      <polygon points="115,70 88,108 105,108 85,148 128,103 110,103"
        fill="#f59e0b" stroke="#fbbf24" strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 ${isLegendary ? 12 : 6}px #f59e0b)` }} />
      <polygon points="115,70 88,108 105,108 85,148 128,103 110,103"
        fill="none" stroke="white" strokeWidth="0.5" opacity="0.4" />
    </g>
  );
}

// ── Title/Badge Art ───────────────────────────────────────────────────────────
function TitleArt({ p, id }: { p: typeof TIER_PALETTE.common; id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="65" ry="65" fill={`url(#${id}_glow)`} />
      {/* scroll */}
      <rect x="50" y="85" width="100" height="55" rx="6" fill={p.secondary} opacity="0.3"
        stroke={p.primary} strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 5px ${p.primary})` }} />
      <rect x="44" y="88" width="12" height="50" rx="6" fill={p.secondary} opacity="0.7" stroke={p.primary} strokeWidth="1" />
      <rect x="144" y="88" width="12" height="50" rx="6" fill={p.secondary} opacity="0.7" stroke={p.primary} strokeWidth="1" />
      {/* lines */}
      <rect x="62" y="100" width="76" height="3" rx="1" fill={p.accent} opacity="0.6" />
      <rect x="62" y="110" width="60" height="3" rx="1" fill={p.primary} opacity="0.4" />
      <rect x="62" y="120" width="70" height="3" rx="1" fill={p.primary} opacity="0.3" />
      {/* star */}
      <polygon points="100,90 103,100 114,100 105,106 108,117 100,111 92,117 95,106 86,100 97,100"
        fill={p.accent} opacity="0.9" style={{ filter: `drop-shadow(0 0 4px ${p.accent})` }} />
    </g>
  );
}

// ── Loot Crate Art ────────────────────────────────────────────────────────────
function LootCrateArt({ p, id, tier }: { p: typeof TIER_PALETTE.common; id: string; tier: string }) {
  const isLegendary = tier === "legendary";
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="115" rx="65" ry="55" fill={`url(#${id}_glow)`} />
      {/* crate body */}
      <rect x="52" y="92" width="96" height="72" rx="5" fill={p.secondary} opacity="0.5"
        stroke={p.primary} strokeWidth="1.5"
        style={isLegendary ? { filter: `drop-shadow(0 0 8px ${p.primary})` } : {}} />
      {/* lid */}
      <rect x="52" y="88" width="96" height="20" rx="5" fill={p.secondary} opacity="0.8"
        stroke={p.primary} strokeWidth="1.5" />
      {/* straps */}
      <rect x="94" y="88" width="12" height="76" rx="3" fill={p.primary} opacity="0.4" />
      <rect x="52" y="118" width="96" height="10" rx="0" fill={p.primary} opacity="0.3" />
      {/* lock */}
      <rect x="90" y="100" width="20" height="16" rx="4" fill={p.accent} opacity="0.9" stroke={p.secondary} strokeWidth="1" />
      <circle cx="100" cy="108" r="3" fill={p.bg} opacity="0.8" />
      {/* shine */}
      <rect x="56" y="90" width="36" height="5" rx="2" fill="white" opacity="0.1" />
      {/* glow particles (legendary) */}
      {isLegendary && (
        <>
          <circle cx="65" cy="82" r="3" fill={p.accent} opacity="0.8" style={{ filter: "blur(1px)" }} />
          <circle cx="135" cy="79" r="2" fill={p.accent} opacity="0.6" style={{ filter: "blur(1px)" }} />
          <circle cx="148" cy="88" r="2.5" fill={p.accent} opacity="0.7" style={{ filter: "blur(1px)" }} />
        </>
      )}
    </g>
  );
}

// ── Background / Cosmetic Art ─────────────────────────────────────────────────
function BackgroundArt({ p, id }: { p: typeof TIER_PALETTE.common; id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.5" />
          <stop offset="60%" stopColor={p.secondary} stopOpacity="0.2" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="40" y="70" width="120" height="90" rx="8" fill={`url(#${id}_bg)`} stroke={p.primary} strokeWidth="1.5" />
      {/* grid lines */}
      {[80, 90, 100, 110, 120, 130, 140].map(y => (
        <line key={y} x1="40" y1={y} x2="160" y2={y} stroke={p.primary} strokeWidth="0.5" opacity="0.2" />
      ))}
      {[60, 80, 100, 120, 140].map(x => (
        <line key={x} x1={x} y1="70" x2={x} y2="160" stroke={p.primary} strokeWidth="0.5" opacity="0.2" />
      ))}
      {/* avatar silhouette */}
      <circle cx="100" cy="105" r="22" fill={p.secondary} opacity="0.4" stroke={p.primary} strokeWidth="1.5" />
      <circle cx="100" cy="98" r="10" fill={p.secondary} opacity="0.6" />
      <path d="M78 130 Q100 118 122 130" fill={p.secondary} opacity="0.5" />
      {/* corner decorations */}
      <rect x="40" y="70" width="16" height="16" rx="0" fill="none" stroke={p.primary} strokeWidth="2" opacity="0.6"
        style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <rect x="144" y="144" width="16" height="16" rx="0" fill="none" stroke={p.primary} strokeWidth="2" opacity="0.6" />
    </g>
  );
}

// ── Key Art ───────────────────────────────────────────────────────────────────
function KeyArt({ p, id }: { p: typeof TIER_PALETTE.common; id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.45" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="110" rx="65" ry="65" fill={`url(#${id}_glow)`} />
      {/* ring */}
      <circle cx="80" cy="95" r="22" fill="none" stroke={p.accent} strokeWidth="5"
        style={{ filter: `drop-shadow(0 0 6px ${p.accent})` }} />
      <circle cx="80" cy="95" r="12" fill="none" stroke={p.primary} strokeWidth="2" opacity="0.5" />
      {/* shaft */}
      <rect x="96" y="93" width="60" height="8" rx="4" fill={p.accent} stroke={p.primary} strokeWidth="1"
        style={{ filter: `drop-shadow(0 0 4px ${p.accent})` }} />
      {/* teeth */}
      <rect x="128" y="101" width="8" height="10" rx="2" fill={p.accent} />
      <rect x="144" y="101" width="8" height="14" rx="2" fill={p.accent} />
      <rect x="136" y="101" width="6" height="8" rx="2" fill={p.accent} />
    </g>
  );
}

// ── Generic / XP / Spin Token Art ────────────────────────────────────────────
function GenericArt({ p, id }: { p: typeof TIER_PALETTE.common; id: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.primary} stopOpacity="0.4" />
          <stop offset="100%" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="110" r="65" fill={`url(#${id}_glow)`} />
      {/* octagon */}
      <polygon
        points="100,60 132,72 148,103 136,136 104,150 70,138 54,108 67,76"
        fill={p.secondary} opacity="0.3"
        stroke={p.primary} strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 6px ${p.primary})` }}
      />
      <polygon
        points="100,72 124,81 137,104 128,128 102,138 78,130 65,107 74,82"
        fill={p.primary} opacity="0.15"
        stroke={p.accent} strokeWidth="1"
      />
      <text x="100" y="117" textAnchor="middle" fontFamily="monospace" fontWeight="bold"
        fontSize="32" fill={p.accent} opacity="0.9">★</text>
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface CardArtProps {
  itemType: string;  // weapon | armor | consumable | ammo | car | car_part | currency | energy | key | title | badge | avatar_background | loot_crate | xp_boost | spin_token | energy_max_boost
  tier: string;      // common | uncommon | rare | epic | legendary
  size?: number;     // default 200
  className?: string;
  style?: React.CSSProperties;
}

export function CardArt({ itemType, tier, size = 200, className, style }: CardArtProps) {
  const p = TIER_PALETTE[tier] ?? TIER_PALETTE.common;
  // useId gives a per-instance stable unique ID — no cross-card SVG def collisions
  const reactId = useId();
  const id = `ca${reactId.replace(/:/g, "_")}`;
  const isLegendary = tier === "legendary";
  const isEpic = tier === "epic";

  function renderArt() {
    switch (itemType) {
      case "weapon":       return <WeaponArt p={p} id={id} tier={tier} />;
      case "armor":        return <ArmorArt p={p} id={id} tier={tier} />;
      case "consumable":   return <ConsumableArt p={p} id={id} tier={tier} />;
      case "ammo":         return <AmmoArt p={p} id={id} tier={tier} />;
      case "car":          return <CarArt p={p} id={id} tier={tier} />;
      case "car_part":
      case "carPart":      return <CarPartArt p={p} id={id} tier={tier} />;
      case "currency":
      case "currency_dc":  return <CurrencyArt p={p} id={id} />;
      case "energy_drink":
      case "energy_max_boost": return <EnergyArt p={p} id={id} tier={tier} />;
      case "currency_keys":
      case "key":          return <KeyArt p={p} id={id} />;
      case "currency_shards":
      case "shard":        return <GenericArt p={p} id={id} />;
      case "title":
      case "badge":        return <TitleArt p={p} id={id} />;
      case "avatar_background": return <BackgroundArt p={p} id={id} />;
      case "loot_crate":   return <LootCrateArt p={p} id={id} tier={tier} />;
      case "xp_boost":     return <EnergyArt p={p} id={id} tier={tier} />;
      case "spin_token":   return <GenericArt p={p} id={id} />;
      default:             return <GenericArt p={p} id={id} />;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <radialGradient id={`${id}_frame`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={p.bg} />
          <stop offset="100%" stopColor="#05050d" />
        </radialGradient>
        {isLegendary && (
          <filter id={`${id}_legendary`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix in="blur" type="saturate" values="3" result="sat" />
            <feComposite in="SourceGraphic" in2="sat" operator="over" />
          </filter>
        )}
      </defs>

      {/* Background */}
      <rect width="200" height="200" fill={`url(#${id}_frame)`} />

      {/* Corner brackets */}
      <path d="M8 22 L8 8 L22 8" stroke={p.primary} strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M178 8 L192 8 L192 22" stroke={p.primary} strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M8 178 L8 192 L22 192" stroke={p.primary} strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M192 178 L192 192 L178 192" stroke={p.primary} strokeWidth="2" fill="none" opacity="0.6" />

      {/* Scan line overlay */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1="8" y1={30 + i * 20} x2="192" y2={30 + i * 20}
          stroke={p.primary} strokeWidth="0.4" opacity="0.06" />
      ))}

      {/* Art */}
      <g filter={isLegendary ? `url(#${id}_legendary)` : undefined}>
        {renderArt()}
      </g>

      {/* Legendary shimmer overlay */}
      {isLegendary && (
        <rect x="0" y="0" width="200" height="200"
          fill={p.primary} opacity="0.04"
          style={{
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Border glow */}
      <rect x="2" y="2" width="196" height="196" rx="2"
        fill="none"
        stroke={p.primary}
        strokeWidth={isLegendary ? "2" : isEpic ? "1.5" : "1"}
        opacity={isLegendary ? 0.7 : isEpic ? 0.5 : 0.25}
      />
    </svg>
  );
}

// Helper: map itemId to itemType (for Arena items which don't have itemType field)
export function inferItemType(itemId: string, category?: string): string {
  if (category) {
    if (category === "weapon") return "weapon";
    if (category === "armor") return "armor";
    if (category === "consumable") return "consumable";
    if (category === "ammo") return "ammo";
    if (category === "car") return "car";
    if (category === "carPart" || category === "car_part") return "car_part";
  }
  if (itemId.includes("car") && !itemId.includes("part")) return "car";
  if (itemId.includes("part") || itemId.includes("engine") || itemId.includes("tire") || itemId.includes("nitro") || itemId.includes("spoiler") || itemId.includes("body")) return "car_part";
  if (itemId.includes("ammo") || itemId.includes("suppressor")) return "ammo";
  if (itemId.includes("vest") || itemId.includes("armor") || itemId.includes("helm") || itemId.includes("glove") || itemId.includes("boot") || itemId.includes("mask") || itemId.includes("visor") || itemId.includes("riot")) return "armor";
  if (itemId.includes("medkit") || itemId.includes("bandage") || itemId.includes("nade") || itemId.includes("grenade") || itemId.includes("flashlight")) return "consumable";
  if (itemId.includes("pistol") || itemId.includes("rifle") || itemId.includes("smg") || itemId.includes("shotgun") || itemId.includes("sniper") || itemId.includes("bat") || itemId.includes("knife") || itemId.includes("katana") || itemId.includes("weapon") || itemId.includes("omega")) return "weapon";
  return "weapon";
}

export default CardArt;
