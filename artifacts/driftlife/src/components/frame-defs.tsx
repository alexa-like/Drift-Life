// ─── Frame Visual Definitions ─────────────────────────────────────────────────
// Per-frame header style, body style, floating decorations, and inline body art.
// Modelled after the cybercodeonline donation-tier gallery reference.

import type { CSSProperties, ReactNode } from 'react'
import type { Frame } from '../lib/chatFrames'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FrameDef {
  /** CSS background/style applied to the 32-px header bar */
  headerStyle?: CSSProperties
  /** Optional animation class for the header (apex shimmer, sovereign weave…) */
  headerClass?: string
  /** Text colour for the username inside the header */
  headerText: string
  /** Whether to uppercase the username */
  uppercase?: boolean
  /** Element rendered LEFT of the username (icon, bat, candle…) */
  headerLeft?: () => ReactNode
  /** Element rendered RIGHT inside the header (barcode, bracket, star…) */
  headerRight?: () => ReactNode
  /** CSS background/style applied to the message body */
  bodyStyle?: CSSProperties
  /** Text colour for the message text (default = #e2e8f0) */
  bodyText?: string
  /** Art rendered on the right side of the body (dragon face, xmas tree…) */
  bodyRight?: () => ReactNode
  /** Element floating ABOVE the frame border (snow drift, blossom branch, hat) */
  topFloat?: () => ReactNode
  /** Border/glow colour (overrides frame.accentColor if set) */
  borderColor: string
  /** Show blinking block cursor after username */
  blinkCursor?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Barcode strip (vertical bars) used in headers */
function Barcode({ color = '#FFD700', height = 20, count = 16 }: { color?: string; height?: number; count?: number }) {
  const widths = [3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1.2, paddingRight: 4 }}>
      {widths.slice(0, count).map((w, i) => (
        <div key={i} style={{ width: w * 1.5, height, background: color, opacity: 0.9, flexShrink: 0 }} />
      ))}
    </div>
  )
}

/** Dashed rogue bracket  ─ ─ ─ */
function RogueBracket() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, paddingRight: 6, color: '#FF2244', fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' }}>
      <span>[</span>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 2, background: '#FF2244' }} />
      ))}
      <span>]</span>
    </div>
  )
}

/** Tiny circuit corner decoration at top-right of body (Cyberdeck-style) */
function CornerBracketSvg({ color = '#555' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
      <path d="M2 2 L2 18 M2 2 L18 2" stroke={color} strokeWidth="2" fill="none" />
    </svg>
  )
}

/** EXP badge — small yellow tag for Netrunner body */
function ExpBadge() {
  return (
    <div style={{
      position: 'absolute', bottom: 4, right: 4,
      background: '#FFD700', color: '#000',
      fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold',
      padding: '1px 4px', lineHeight: 1.4,
    }}>EXP.05</div>
  )
}

/** Blinking terminal cursor icon */
function CursorIcon({ color }: { color: string }) {
  return <span style={{ animation: 'blackoutBlink 1s step-start infinite', marginRight: 2, fontSize: 10, color }}>█</span>
}

// ── Top-float decorations ──────────────────────────────────────────────────────

/** Cherry blossom branch floating above the top-right of a frame */
function SakuraBranchFloat() {
  return (
    <div style={{ position: 'absolute', top: -30, right: 6, width: 110, height: 36, pointerEvents: 'none', zIndex: 20 }}>
      <svg width="110" height="36" viewBox="0 0 110 36">
        {/* Main branch */}
        <path d="M110 36 Q80 22 55 14 Q32 8 8 2" stroke="#7B4F1A" fill="none" strokeWidth="2.2" strokeLinecap="round" />
        {/* Sub branch */}
        <path d="M55 14 Q42 8 26 5" stroke="#7B4F1A" fill="none" strokeWidth="1.3" strokeLinecap="round" />
        {/* Blossoms */}
        {[[10, 3], [30, 6], [56, 15], [82, 24], [95, 30]] .map(([cx, cy], bi) => (
          <g key={bi} transform={`translate(${cx},${cy})`}>
            {[0, 72, 144, 216, 288].map(a => (
              <ellipse key={a} cx="0" cy="-4" rx="2.2" ry="3.6"
                transform={`rotate(${a})`} fill="#FFB7C5" opacity="0.92" />
            ))}
            <circle cx="0" cy="0" r="1.3" fill="#FFE066" />
          </g>
        ))}
        {/* Falling petals */}
        <ellipse cx="40" cy="30" rx="1.5" ry="2.4" transform="rotate(-25 40 30)" fill="#FFB7C5" opacity="0.6" />
        <ellipse cx="70" cy="33" rx="1.4" ry="2.2" transform="rotate(15 70 33)" fill="#FFB7C5" opacity="0.5" />
      </svg>
    </div>
  )
}

/** Snow drift sitting ON the frame top border */
function FrostSnowDrift() {
  return (
    <div style={{ position: 'absolute', top: -10, left: 0, right: 0, height: 14, pointerEvents: 'none', zIndex: 20 }}>
      <svg width="100%" height="14" preserveAspectRatio="none" viewBox="0 0 320 14">
        <path d="M0 14 Q5 4 12 8 Q18 2 25 7 Q31 1 37 6 Q44 0 50 5 Q57 1 63 6 Q70 2 76 7 Q82 1 88 5 Q95 2 102 7 Q108 0 115 5 Q121 2 127 7 Q133 1 139 6 Q146 3 152 7 Q158 0 165 5 Q171 2 177 7 Q183 1 189 6 Q196 2 202 7 Q208 0 215 5 Q221 2 227 7 Q233 1 239 6 Q246 2 252 7 Q258 0 265 5 Q271 2 278 7 Q284 1 290 6 Q296 3 302 7 Q308 1 314 6 Q317 3 320 7 L320 14 Z" fill="white" />
      </svg>
    </div>
  )
}

/** Santa hat floating above the header left side */
function SantaHatFloat() {
  return (
    <div style={{ position: 'absolute', top: -26, left: 14, width: 36, height: 30, pointerEvents: 'none', zIndex: 20 }}>
      <svg width="36" height="30" viewBox="0 0 36 30">
        {/* Hat body */}
        <path d="M6 22 Q10 8 22 2 Q26 0 24 7 Q21 4 19 11 Q26 13 28 22 Z" fill="#CC1122" />
        {/* Brim */}
        <rect x="0" y="22" width="36" height="7" rx="3.5" fill="white" />
        {/* Pompom */}
        <circle cx="22" cy="2" r="4" fill="white" />
      </svg>
    </div>
  )
}

/** Halloween bat floating near header */
function HalloweenBatIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" style={{ flexShrink: 0 }}>
      <path d="M9 5 Q5 0 0 2 Q3 4 4 7 Q6 5 9 6 Q12 5 14 7 Q15 4 18 2 Q13 0 9 5Z" fill="#222" />
      <circle cx="9" cy="7" r="2.5" fill="#333" />
      <circle cx="7.8" cy="6.5" r="0.8" fill="#FF4400" />
      <circle cx="10.2" cy="6.5" r="0.8" fill="#FF4400" />
    </svg>
  )
}

/** CyberKitty paw icon */
function PawIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="8" r="4" fill={color} opacity="0.9" />
      <circle cx="3" cy="4" r="2" fill={color} opacity="0.8" />
      <circle cx="7" cy="3" r="2" fill={color} opacity="0.8" />
      <circle cx="11" cy="4" r="2" fill={color} opacity="0.8" />
    </svg>
  )
}

// ── Body right art ─────────────────────────────────────────────────────────────

/** CyberDragon: fierce dragon face on the right side of the body */
function DragonBodyArt() {
  return (
    <div style={{ width: 90, height: '100%', minHeight: 44, position: 'relative' }}>
      <svg width="90" height="60" viewBox="0 0 90 60" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: '100%' }}>
        <defs>
          <radialGradient id="dragGlow" cx="65%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FF2200" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="90" height="60" fill="url(#dragGlow)" />
        {/* Head mass */}
        <ellipse cx="62" cy="32" rx="30" ry="23" fill="#6B0000" opacity="0.7" />
        {/* Snout */}
        <path d="M34 38 Q30 30 34 25 Q40 23 43 32 Q40 40 34 38Z" fill="#8B0000" opacity="0.8" />
        {/* Eye socket */}
        <ellipse cx="48" cy="23" rx="8" ry="6.5" fill="#1A0000" />
        {/* Iris */}
        <ellipse cx="48" cy="23" rx="5.5" ry="4.5" fill="#FF2200" />
        {/* Slit pupil */}
        <ellipse cx="48" cy="23" rx="1.8" ry="4" fill="#000" />
        {/* Eye highlight */}
        <circle cx="46" cy="21" r="1.2" fill="white" opacity="0.5" />
        {/* Nostril */}
        <ellipse cx="35" cy="35" rx="2" ry="1.3" fill="#1A0000" />
        {/* Horns */}
        <path d="M62 8 L55 24 L69 22Z" fill="#500000" />
        <path d="M76 12 L70 26 L84 25Z" fill="#500000" />
        {/* Scales hint */}
        <path d="M45 42 Q55 38 65 40 Q70 42 68 46 Q60 48 50 46Z" fill="#500000" opacity="0.5" />
        {/* Corner QR-seal */}
        <rect x="76" y="3" width="12" height="12" fill="none" stroke="#FF4400" strokeWidth="1.2" opacity="0.7" />
        <rect x="78" y="5" width="4" height="4" fill="#FF4400" opacity="0.5" />
        <rect x="83" y="5" width="4" height="4" fill="#FF4400" opacity="0.5" />
        <rect x="78" y="10" width="4" height="4" fill="#FF4400" opacity="0.5" />
      </svg>
    </div>
  )
}

/** CyberSanta: Christmas tree on right side of body */
function XmasTreeArt() {
  return (
    <div style={{ width: 56, height: '100%', minHeight: 44, position: 'relative' }}>
      <svg width="56" height="70" viewBox="0 0 56 70" style={{ position: 'absolute', top: 0, right: 2, height: '100%', width: '56px' }}>
        {/* Tree */}
        <polygon points="28,4 7,26 16,26 10,46 22,46 22,56 34,56 34,46 46,46 40,26 49,26" fill="#1A7A1A" />
        {/* Tree glow */}
        <polygon points="28,4 7,26 16,26 10,46 22,46 22,56 34,56 34,46 46,46 40,26 49,26" fill="none" stroke="#39FF14" strokeWidth="1" opacity="0.5" />
        {/* Star */}
        <polygon points="28,0 29.5,5 35,5 31,8 32.5,13 28,10 23.5,13 25,8 21,5 26.5,5" fill="#FFD700" />
        {/* Ornaments */}
        <circle cx="20" cy="32" r="2.5" fill="#FF2222" />
        <circle cx="34" cy="36" r="2.5" fill="#FFD700" />
        <circle cx="23" cy="42" r="2.5" fill="#FF2222" />
        <circle cx="35" cy="28" r="2" fill="#00AAFF" />
        <circle cx="28" cy="38" r="2" fill="#00AAFF" />
        {/* Trunk */}
        <rect x="24" y="56" width="8" height="9" fill="#8B4513" />
        {/* Stars/sparkles scattered */}
        <text x="4" y="16" fontSize="8" fill="#FFD700" opacity="0.8">✦</text>
        <text x="46" y="20" fontSize="6" fill="#FFD700" opacity="0.6">✦</text>
        <text x="6" y="50" fontSize="7" fill="#FFD700" opacity="0.5">✦</text>
      </svg>
    </div>
  )
}

/** Sakura: falling petals on right side */
function SakuraPetalsArt() {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 40, position: 'relative', opacity: 0.7 }}>
      <svg width="50" height="60" viewBox="0 0 50 60" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: '50px' }}>
        {[[10, 8, -20], [35, 18, 15], [20, 32, -10], [40, 42, 25], [12, 52, -30]].map(([cx, cy, rot], i) => (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${rot})`}>
            {[0, 72, 144, 216, 288].map(a => (
              <ellipse key={a} cx="0" cy="-3" rx="1.8" ry="3"
                transform={`rotate(${a})`} fill="#FFB7C5" opacity="0.75" />
            ))}
            <circle cx="0" cy="0" r="1" fill="#FFE066" />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Halloween: bat silhouette on right */
function HalloweenBatArt() {
  return (
    <div style={{ width: 60, height: '100%', minHeight: 40, position: 'relative', opacity: 0.65 }}>
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '60px' }}>
        {/* Large bat */}
        <path d="M30 22 Q18 8 4 14 Q12 18 14 26 Q20 20 30 24 Q40 20 46 26 Q48 18 56 14 Q42 8 30 22Z" fill="#1A0A2A" opacity="0.8" />
        <circle cx="30" cy="26" r="5" fill="#2A1040" />
        <circle cx="27" cy="25" r="1.2" fill="#FF4400" />
        <circle cx="33" cy="25" r="1.2" fill="#FF4400" />
        {/* Small bat */}
        <path d="M18 44 Q12 38 6 40 Q10 42 10 46 Q13 43 18 45 Q23 43 26 46 Q26 42 30 40 Q24 38 18 44Z" fill="#1A0A2A" opacity="0.6" />
        {/* Moon */}
        <path d="M48 10 Q56 14 54 22 Q58 18 58 10 Q54 4 48 10Z" fill="#FFD060" opacity="0.7" />
      </svg>
    </div>
  )
}

/** Netrunner body: EXP badge + scan line overlay */
function NetrunnerBodyArt() {
  return (
    <div style={{ width: 60, height: '100%', minHeight: 40, position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: 4, right: 4, background: '#FFD700', color: '#000', fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold', padding: '2px 5px' }}>
        EXP.05
      </div>
      <div style={{ position: 'absolute', top: 8, right: 4, display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.4 }}>
        {[40, 28, 35, 20, 32, 25, 38, 22].map((w, i) => (
          <div key={i} style={{ width: w, height: 1.5, background: '#FFD700' }} />
        ))}
      </div>
    </div>
  )
}

/** Signal Breach: warning bracket on right */
function SignalBreachArt() {
  return (
    <div style={{ width: 44, height: '100%', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold', color: '#FF0040', lineHeight: 1 }}>
        [!]
      </div>
    </div>
  )
}

/** Void Signal: constellation on right */
function VoidConstellationArt() {
  return (
    <div style={{ width: 60, height: '100%', minHeight: 40 }}>
      <svg width="60" height="50" viewBox="0 0 60 50" style={{ width: '60px', height: '100%' }}>
        <g opacity="0.6">
          {[[12, 8], [38, 14], [48, 32], [22, 38], [5, 28]].map(([x, y], i, arr) => (
            <g key={i}>
              {arr.map(([x2, y2], j) => j > i && Math.hypot(x2 - x, y2 - y) < 32 ? (
                <line key={j} x1={x} y1={y} x2={x2} y2={y2} stroke="#4466FF" strokeWidth="0.6" opacity="0.5" />
              ) : null)}
              <circle cx={x} cy={y} r={i === 0 ? 2.5 : 1.8} fill="#8899FF" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

/** Rogue Signal: bracket decoration on right */
function RogueBodyArt() {
  return (
    <div style={{ width: 44, height: '100%', minHeight: 40, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', paddingTop: 6, paddingLeft: 4, opacity: 0.65 }}>
      {[28, 20, 34, 16, 26].map((w, i) => (
        <div key={i} style={{ height: 2, width: w, background: '#FF2244' }} />
      ))}
    </div>
  )
}

/** Night Market: lantern art on right */
function NightMarketArt() {
  return (
    <div style={{ width: 44, height: '100%', minHeight: 44 }}>
      <svg width="44" height="60" viewBox="0 0 44 60" style={{ width: '44px', height: '100%' }}>
        <g opacity="0.75">
          {/* Top lantern */}
          <line x1="22" y1="0" x2="22" y2="6" stroke="#FF88AA" strokeWidth="1" />
          <rect x="14" y="6" width="16" height="3" rx="1" fill="#FF4499" />
          <ellipse cx="22" cy="22" rx="10" ry="14" fill="#FF226688" />
          <path d="M12 10 Q22 5 32 10 L32 34 Q22 39 12 34Z" fill="#FF2266" opacity="0.7" />
          <ellipse cx="22" cy="34" rx="10" ry="3" fill="#FF4499" />
          <rect x="14" y="37" width="16" height="2" rx="1" fill="#FF4499" />
          <line x1="22" y1="39" x2="22" y2="44" stroke="#FF88AA" strokeWidth="1" />
          {/* Tassel */}
          {[-3, 0, 3].map(ox => (
            <line key={ox} x1={22 + ox} y1="44" x2={22 + ox} y2="50" stroke="#FF88AA" strokeWidth="0.8" />
          ))}
        </g>
      </svg>
    </div>
  )
}

/** Apex: gold crown on right */
function ApexCrownArt() {
  return (
    <div style={{ width: 44, height: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="38" height="32" viewBox="0 0 38 32">
        <defs>
          <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FFF5A0" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>
        <path d="M3 28 L6 10 L13 18 L19 4 L25 18 L32 10 L35 28Z" fill="url(#crownGrad)" stroke="#B8860B" strokeWidth="0.8" />
        <rect x="3" y="28" width="32" height="4" rx="2" fill="#B8860B" />
        <circle cx="19" cy="28" r="3" fill="#FF4444" />
        <circle cx="8" cy="26" r="2" fill="#4444FF" />
        <circle cx="30" cy="26" r="2" fill="#44CC44" />
      </svg>
    </div>
  )
}

/** Golden New Year: firework burst */
function FireworkArt() {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 44 }}>
      <svg width="50" height="60" viewBox="0 0 50 60" style={{ width: '50px', height: '100%' }}>
        <g opacity="0.8">
          {/* Burst lines */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30) * Math.PI / 180
            const x1 = 30 + Math.cos(angle) * 5
            const y1 = 24 + Math.sin(angle) * 5
            const x2 = 30 + Math.cos(angle) * 18
            const y2 = 24 + Math.sin(angle) * 18
            const star_x = 30 + Math.cos(angle) * 20
            const star_y = 24 + Math.sin(angle) * 20
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFD700" strokeWidth="1.5" opacity={i % 2 === 0 ? 0.9 : 0.6} />
                <circle cx={star_x} cy={star_y} r="1.5" fill={i % 3 === 0 ? '#FF6600' : '#FFD700'} />
              </g>
            )
          })}
          <circle cx="30" cy="24" r="4" fill="#FFD700" opacity="0.9" />
          <circle cx="30" cy="24" r="2" fill="white" opacity="0.7" />
          {/* Second smaller burst */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 + 22) * Math.PI / 180
            const x2 = 14 + Math.cos(angle) * 10
            const y2 = 44 + Math.sin(angle) * 10
            return <line key={i} x1="14" y1="44" x2={x2} y2={y2} stroke="#FF6600" strokeWidth="1" opacity="0.6" />
          })}
          <circle cx="14" cy="44" r="2.5" fill="#FF6600" opacity="0.8" />
        </g>
      </svg>
    </div>
  )
}

/** Lunar Stallion: moon + stars on right */
function LunarArt() {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 44 }}>
      <svg width="50" height="60" viewBox="0 0 50 60" style={{ width: '50px', height: '100%' }}>
        <g opacity="0.8">
          {/* Crescent moon */}
          <path d="M32 8 Q46 16 44 30 Q48 24 48 14 Q44 4 32 8Z" fill="#C8C0FF" />
          {/* Stars */}
          {[[8, 10], [16, 26], [6, 38], [22, 46], [38, 48], [44, 36]].map(([sx, sy], i) => (
            <circle key={i} cx={sx} cy={sy} r={i % 2 === 0 ? 1.5 : 1} fill="#A0A8FF" opacity={0.5 + i * 0.07} />
          ))}
          {/* Constellation lines */}
          <line x1="8" y1="10" x2="16" y2="26" stroke="#6070BB" strokeWidth="0.7" opacity="0.4" />
          <line x1="16" y1="26" x2="6" y2="38" stroke="#6070BB" strokeWidth="0.7" opacity="0.4" />
          <line x1="16" y1="26" x2="22" y2="46" stroke="#6070BB" strokeWidth="0.7" opacity="0.4" />
        </g>
      </svg>
    </div>
  )
}

/** Lightwalker: aurora crystal on right */
function LightwalkerArt() {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 44 }}>
      <svg width="50" height="60" viewBox="0 0 50 60" style={{ width: '50px', height: '100%' }}>
        <defs>
          <radialGradient id="lightGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#80AAFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#2040AA" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="28" cy="28" rx="20" ry="28" fill="url(#lightGlow)" />
        {/* Crystal shape */}
        <polygon points="28,4 36,24 28,44 20,24" fill="#90C0FF" opacity="0.5" />
        <polygon points="28,4 36,24 28,44 20,24" fill="none" stroke="#C0E0FF" strokeWidth="0.8" />
        {/* Inner crystal highlight */}
        <polygon points="28,10 33,24 28,38 23,24" fill="#C0E0FF" opacity="0.25" />
        {/* Sparkles */}
        {[[12, 12], [42, 20], [8, 36], [44, 44]].map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r="1.4" fill="#80CCFF" opacity={0.6 - i * 0.1} />
        ))}
      </svg>
    </div>
  )
}

/** Prestige body art (stars/sparkles) */
function PrestigeBodyArt({ color }: { color: string }) {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 44, opacity: 0.7 }}>
      <svg width="50" height="60" viewBox="0 0 50 60" style={{ width: '50px', height: '100%' }}>
        {[[10, 12], [38, 8], [26, 28], [12, 44], [42, 36], [30, 52]].map(([sx, sy], i) => (
          <g key={i} transform={`translate(${sx},${sy})`}>
            {[0, 45, 90, 135].map(a => (
              <line key={a} x1="0" y1={-4 - i % 2} x2="0" y2={4 + i % 2}
                transform={`rotate(${a})`} stroke={color} strokeWidth="1" opacity={0.5 + i * 0.05} />
            ))}
            <circle cx="0" cy="0" r="1" fill={color} />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Sub Apex header art */
function SubApexArt() {
  return (
    <div style={{ width: 46, height: '100%', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="36" height="28" viewBox="0 0 36 28">
        <defs>
          <linearGradient id="subApexG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FF8800" />
          </linearGradient>
        </defs>
        <polygon points="18,2 24,12 34,12 26,20 30,30 18,24 6,30 10,20 2,12 12,12" fill="url(#subApexG)" opacity="0.8" />
        <polygon points="18,7 22,14 28,14 23,18 25,25 18,21 11,25 13,18 8,14 14,14" fill="#FFF8CC" opacity="0.5" />
      </svg>
    </div>
  )
}

// ── Cyberdeck / Grid-terminal body ─────────────────────────────────────────────
function CyberdeckBodyArt() {
  return (
    <div style={{ width: 50, height: '100%', minHeight: 44, position: 'relative' }}>
      {/* Corner bracket */}
      <div style={{ position: 'absolute', top: 3, right: 3 }}>
        <CornerBracketSvg color="#888" />
      </div>
      {/* Bottom: barcode + SYS label */}
      <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4, alignItems: 'flex-end', opacity: 0.5 }}>
        <div style={{ display: 'flex', gap: 0.8 }}>
          {[2, 1, 2, 1, 3, 1, 1, 2, 1].map((w, i) => (
            <div key={i} style={{ width: w, height: 10, background: '#555' }} />
          ))}
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 7, color: '#555', paddingBottom: 1 }}>SYS.DX</span>
      </div>
    </div>
  )
}

// ── FRAME_DEFS map ─────────────────────────────────────────────────────────────

export const FRAME_DEFS: Record<string, FrameDef> = {

  // ── Elite ──────────────────────────────────────────────────────────────────

  neon_drift: {
    headerStyle: { background: '#00E0FF' },
    headerText: '#0A0A18',
    uppercase: true,
    headerRight: () => (
      <div style={{ display: 'flex', gap: 3, paddingRight: 4, alignItems: 'center' }}>
        {[24, 14, 24].map((w, i) => (
          <div key={i} style={{ width: w, height: 3, background: '#0A0A18', borderRadius: 1.5, opacity: 0.6 }} />
        ))}
      </div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #001a22 0%, #060f12 60%, #001f28 100%)' },
    borderColor: '#00E0FF',
  },

  grid_static: {
    headerStyle: { background: '#00FF9F' },
    headerText: '#0A1A12',
    uppercase: true,
    headerRight: () => (
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#0A1A12', opacity: 0.7, paddingRight: 6 }}>
        {'[>_]'}
      </div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #001a10 0%, #060f08 60%, #001a14 100%)' },
    bodyRight: () => (
      <div style={{ width: 44, height: '100%', minHeight: 44 }}>
        <svg width="44" height="60" viewBox="0 0 44 60" style={{ opacity: 0.25, width: '44px', height: '100%' }}>
          {[0, 11, 22, 33, 44].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="60" stroke="#00FF9F" strokeWidth="0.6" />
          ))}
          {[0, 12, 24, 36, 48, 60].map(y => (
            <line key={y} x1="0" y1={y} x2="44" y2={y} stroke="#00FF9F" strokeWidth="0.6" />
          ))}
          {[[8, 12], [28, 30], [16, 48]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3" fill="#00FF9F" opacity="0.8" />
          ))}
        </svg>
      </div>
    ),
    borderColor: '#00FF9F',
  },

  street_phantom: {
    headerStyle: { background: 'linear-gradient(90deg, #2d0a5a 0%, #6a00c8 50%, #3a0070 100%)' },
    headerText: '#e8d8ff',
    headerRight: () => (
      <svg width="18" height="18" viewBox="0 0 18 18" style={{ opacity: 0.7, flexShrink: 0, marginRight: 6 }}>
        {/* Ghost silhouette */}
        <path d="M9 2 Q3 2 3 9 L3 16 L5 14 L7 16 L9 14 L11 16 L13 14 L15 16 L15 9 Q15 2 9 2Z" fill="#C0A0FF" />
        <circle cx="7" cy="9" r="1.5" fill="#2d0a5a" />
        <circle cx="11" cy="9" r="1.5" fill="#2d0a5a" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #12002a 0%, #070010 60%, #180030 100%)' },
    borderColor: '#9B30FF',
  },

  urban_heat: {
    headerStyle: { background: 'linear-gradient(90deg, #CC2200 0%, #FF4500 50%, #CC2200 100%)' },
    headerText: '#ffe8d0',
    headerRight: () => (
      <svg width="16" height="24" viewBox="0 0 16 24" style={{ opacity: 0.85, flexShrink: 0, marginRight: 6 }}>
        {/* Flame */}
        <path d="M8 1 Q12 6 10 11 Q14 8 12 14 Q15 11 13 18 Q10 22 8 23 Q6 22 3 18 Q1 11 4 14 Q2 8 6 11 Q4 6 8 1Z" fill="#FF8C00" />
        <path d="M8 8 Q10 12 9 16 Q11 13 10 17 Q8 21 8 22 Q6 21 6 17 Q5 13 7 16 Q6 12 8 8Z" fill="#FFD700" opacity="0.8" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0500 0%, #0f0300 60%, #1a0800 100%)' },
    borderColor: '#FF4500',
  },

  signal_breach: {
    headerStyle: { background: '#CC0030' },
    headerText: '#FFE0E8',
    uppercase: true,
    headerRight: () => <RogueBracket />,
    bodyStyle: { background: 'linear-gradient(160deg, #1a000a 0%, #0a0005 60%, #1a0010 100%)' },
    bodyRight: () => <SignalBreachArt />,
    borderColor: '#FF0040',
  },

  night_market: {
    headerStyle: { background: 'linear-gradient(90deg, #880040 0%, #CC0066 50%, #880040 100%)' },
    headerText: '#FFD0EA',
    headerRight: () => (
      <div style={{ fontSize: 16, marginRight: 6, opacity: 0.8 }}>🏮</div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0012 0%, #0a0008 60%, #1a0018 100%)' },
    bodyRight: () => <NightMarketArt />,
    borderColor: '#FF007F',
  },

  chrome_edge: {
    headerStyle: { background: 'linear-gradient(90deg, #2a2a3a 0%, #c0c0c0 40%, #e8e8f0 50%, #c0c0c0 60%, #2a2a3a 100%)' },
    headerText: '#0a0a14',
    uppercase: true,
    headerRight: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0, marginRight: 6 }}>
        {/* Hex bolt */}
        <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" fill="#888" stroke="#ddd" strokeWidth="1" />
        <circle cx="10" cy="10" r="3.5" fill="#ddd" />
        <line x1="10" y1="7" x2="10" y2="13" stroke="#888" strokeWidth="2" />
        <line x1="7.6" y1="8.5" x2="12.4" y2="11.5" stroke="#888" strokeWidth="2" />
        <line x1="7.6" y1="11.5" x2="12.4" y2="8.5" stroke="#888" strokeWidth="2" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #141420 0%, #0a0a14 60%, #141425 100%)' },
    borderColor: '#A8A8C8',
  },

  void_signal: {
    headerClass: 'frame-header-void',
    headerText: '#8899FF',
    headerRight: () => (
      <div style={{ display: 'flex', gap: 4, paddingRight: 6, alignItems: 'center' }}>
        {[3, 2.5, 2].map((r, i) => (
          <div key={i} style={{ width: r * 2, height: r * 2, borderRadius: '50%', background: '#8899FF', opacity: 0.7 - i * 0.15 }} />
        ))}
      </div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #050518 0%, #080820 60%, #050520 100%)' },
    bodyRight: () => <VoidConstellationArt />,
    borderColor: '#4466FF',
  },

  cyberkitty: {
    headerStyle: { background: '#00C8D4' },
    headerText: '#002830',
    headerLeft: () => <PawIcon color="#002830" />,
    headerRight: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ opacity: 0.7, flexShrink: 0, marginRight: 4 }}>
        {/* Cat ears */}
        <polygon points="4,14 7,4 12,12" fill="#002830" />
        <polygon points="18,14 15,4 10,12" fill="#002830" />
        {/* Head */}
        <circle cx="11" cy="14" r="8" fill="#002830" opacity="0.6" />
        {/* Eyes */}
        <ellipse cx="8" cy="13" rx="1.5" ry="2" fill="#00C8D4" opacity="0.9" />
        <ellipse cx="14" cy="13" rx="1.5" ry="2" fill="#00C8D4" opacity="0.9" />
        {/* Nose */}
        <ellipse cx="11" cy="16" rx="1" ry="0.7" fill="#FF88AA" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #001a1e 0%, #060f10 60%, #001f22 100%)' },
    borderColor: '#00C8D4',
  },

  cyberfrost: {
    headerStyle: { background: '#F0FAFF' },
    headerText: '#0a2030',
    topFloat: () => <FrostSnowDrift />,
    headerRight: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0, marginRight: 4, opacity: 0.6 }}>
        {/* Snowflake */}
        {[0, 60, 120].map(a => (
          <line key={a} x1="11" y1="3" x2="11" y2="19" stroke="#88CCEE" strokeWidth="1.5"
            transform={`rotate(${a} 11 11)`} />
        ))}
        <circle cx="11" cy="11" r="2" fill="#88CCEE" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #06121e 0%, #040810 60%, #06121e 100%)' },
    borderColor: '#88CCEE',
  },

  retro_miami: {
    headerStyle: { background: 'linear-gradient(90deg, #00D4C8 0%, #00F0D0 50%, #00D4C8 100%)' },
    headerText: '#001a18',
    uppercase: true,
    headerRight: () => (
      <svg width="22" height="28" viewBox="0 0 22 28" style={{ flexShrink: 0, marginRight: 4, opacity: 0.8 }}>
        {/* Palm tree */}
        <line x1="11" y1="8" x2="11" y2="26" stroke="#005544" strokeWidth="2" />
        <path d="M11 10 Q6 6 2 8 Q5 10 11 10Z" fill="#006644" />
        <path d="M11 10 Q16 6 20 8 Q17 10 11 10Z" fill="#006644" />
        <path d="M11 8 Q9 2 6 2 Q8 5 11 8Z" fill="#006644" />
        <path d="M11 8 Q13 2 16 2 Q14 5 11 8Z" fill="#006644" />
        <ellipse cx="11" cy="26" rx="4" ry="2" fill="#005533" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #0a001a 0%, #050010 60%, #0f0028 100%)' },
    borderColor: '#00F5D4',
  },

  sakura: {
    headerStyle: { background: '#F08098' },
    headerText: '#3a0a18',
    topFloat: () => <SakuraBranchFloat />,
    headerRight: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0, marginRight: 4, opacity: 0.8 }}>
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="10" cy="10" rx="2.5" ry="5.5"
            transform={`rotate(${a} 10 10) translate(0, -3.5)`} fill="#FFB7C5" opacity="0.9" />
        ))}
        <circle cx="10" cy="10" r="2" fill="#FFE066" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0510 0%, #0d020a 60%, #1a0810 100%)' },
    bodyRight: () => <SakuraPetalsArt />,
    borderColor: '#FF8FAB',
  },

  halloween: {
    headerStyle: { background: '#CC5500' },
    headerText: '#FFE0C8',
    headerLeft: () => <HalloweenBatIcon />,
    headerRight: () => (
      <div style={{ fontSize: 14, marginRight: 6, opacity: 0.85 }}>🎃</div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0a00 0%, #0d0600 60%, #1a0800 100%)' },
    bodyRight: () => <HalloweenBatArt />,
    borderColor: '#FF7518',
  },

  cyberbloom: {
    headerStyle: { background: '#39FF14' },
    headerText: '#051a01',
    uppercase: true,
    headerRight: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0, marginRight: 4, opacity: 0.7 }}>
        {[0, 60, 120, 180, 240, 300].map(a => (
          <ellipse key={a} cx="10" cy="10" rx="2" ry="6"
            transform={`rotate(${a} 10 10) translate(0, -3)`} fill="#39FF14" opacity="0.8" />
        ))}
        <circle cx="10" cy="10" r="2.5" fill="#CCFF55" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #02140a 0%, #010d05 60%, #02140a 100%)' },
    borderColor: '#39FF14',
  },

  // ── Legendary ─────────────────────────────────────────────────────────────────

  apex: {
    headerClass: 'frame-header-apex',
    headerText: '#3a2a00',
    uppercase: true,
    bodyStyle: { background: 'linear-gradient(160deg, #1a1000 0%, #0d0a00 60%, #1a1200 100%)' },
    bodyRight: () => <ApexCrownArt />,
    borderColor: '#FFD700',
  },

  blackout_protocol: {
    headerStyle: { background: '#0d0d0d' },
    headerText: '#E0E0E0',
    uppercase: true,
    blinkCursor: true,
    headerRight: () => (
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#888', paddingRight: 6 }}>[ ]</div>
    ),
    bodyStyle: { background: '#050505' },
    bodyText: '#B0B0B0',
    bodyRight: () => (
      <div style={{ width: 50, height: '100%', minHeight: 44, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center', paddingRight: 4, opacity: 0.35 }}>
        {['> run.exe', '  OK', '> decrypt', '  ...', ].map((t, i) => (
          <div key={i} style={{ fontFamily: 'monospace', fontSize: 7, color: '#00FF00', whiteSpace: 'nowrap' }}>{t}</div>
        ))}
      </div>
    ),
    borderColor: '#444444',
  },

  nova_circuit: {
    headerStyle: { background: 'linear-gradient(90deg, #8B0020 0%, #CC1040 50%, #8B0020 100%)' },
    headerText: '#FFD0D8',
    uppercase: true,
    headerRight: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0, marginRight: 4, opacity: 0.85 }}>
        {/* Explosion burst */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * 45) * Math.PI / 180
          return <line key={i} x1={11 + Math.cos(a) * 4} y1={11 + Math.sin(a) * 4}
            x2={11 + Math.cos(a) * 10} y2={11 + Math.sin(a) * 10}
            stroke="#FF4466" strokeWidth={i % 2 === 0 ? 1.5 : 1} />
        })}
        <circle cx="11" cy="11" r="4" fill="#FF2244" />
        <circle cx="11" cy="11" r="2" fill="#FFA0B0" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0008 0%, #0d0005 60%, #1a000a 100%)' },
    borderColor: '#CC1850',
  },

  sovereign: {
    headerClass: 'frame-header-sovereign',
    headerText: '#E0C8FF',
    headerRight: () => (
      <svg width="18" height="24" viewBox="0 0 18 24" style={{ flexShrink: 0, marginRight: 6, opacity: 0.85 }}>
        {/* Fleur-de-lis */}
        <path d="M9 2 Q11 6 9 9 Q7 6 9 2Z" fill="#C080FF" />
        <path d="M9 9 Q14 8 15 12 Q12 14 9 12 Q6 14 3 12 Q4 8 9 9Z" fill="#C080FF" />
        <path d="M9 12 Q11 18 9 22 Q7 18 9 12Z" fill="#C080FF" />
        <path d="M6 19 Q9 18 12 19 L12 22 Q9 21 6 22Z" fill="#C080FF" />
      </svg>
    ),
    bodyStyle: {
      background: '#0d0020',
      backgroundImage: 'linear-gradient(160deg, #1a0035 0%, #0d001a 60%, #1a0035 100%)',
    },
    borderColor: '#8B00FF',
  },

  cybersanta: {
    headerClass: 'frame-header-santa',
    headerText: '#FFFFFF',
    topFloat: () => <SantaHatFloat />,
    headerRight: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0, marginRight: 4, opacity: 0.9 }}>
        {/* Star */}
        <polygon points="11,2 13,8 19,8 14,12 16,18 11,14 6,18 8,12 3,8 9,8" fill="#FFD700" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #0a1a08 0%, #061006 60%, #0a1a08 100%)' },
    bodyRight: () => <XmasTreeArt />,
    borderColor: '#CC1E3A',
  },

  cyberdragon: {
    headerStyle: { background: '#C41400' },
    headerText: '#FFD0C8',
    uppercase: true,
    headerRight: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0, marginRight: 4, opacity: 0.8 }}>
        {/* Dragon scale pattern */}
        {[[4, 4], [12, 4], [20, 4], [8, 12], [16, 12], [4, 20], [12, 20], [20, 20]].map(([cx, cy], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="5" ry="3.5"
            transform={`rotate(-20 ${cx} ${cy})`} fill="none" stroke="#FF4422" strokeWidth="1" opacity="0.6" />
        ))}
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a0000 0%, #0d0000 50%, #200000 100%)' },
    bodyRight: () => <DragonBodyArt />,
    borderColor: '#C41400',
  },

  netrunner: {
    headerStyle: { background: 'linear-gradient(90deg, #0D1F0D 60%, #FFD700 60%)' },
    headerText: '#FFFFFF',
    uppercase: true,
    headerRight: () => <Barcode color="#0D1F0D" height={20} count={14} />,
    bodyStyle: { background: 'linear-gradient(160deg, #0a1200 0%, #060d00 60%, #0a1200 100%)' },
    bodyRight: () => <NetrunnerBodyArt />,
    borderColor: '#FFD700',
  },

  golden_new_year: {
    headerClass: 'frame-header-apex',
    headerText: '#3a2a00',
    uppercase: true,
    headerRight: () => (
      <div style={{ fontSize: 16, marginRight: 6 }}>🎆</div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #1a1200 0%, #0d0a00 60%, #1a1400 100%)' },
    bodyRight: () => <FireworkArt />,
    borderColor: '#FFD700',
  },

  // ── Mythic ────────────────────────────────────────────────────────────────────

  lunar_stallion: {
    headerClass: 'frame-header-lunar',
    headerText: '#C8C0FF',
    uppercase: true,
    headerRight: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0, marginRight: 4, opacity: 0.8 }}>
        {/* Crescent moon */}
        <path d="M11 3 Q18 7 18 13 Q20 10 20 5 Q16 1 11 3Z" fill="#C8C0FF" />
        {[8, 4, 14, 18].map((sx, i) => (
          <circle key={i} cx={sx} cy={[14, 6, 6, 16][i]} r={1 + i % 2 * 0.5} fill="#A0A8FF" opacity="0.7" />
        ))}
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #060820 0%, #040610 60%, #080a24 100%)' },
    bodyRight: () => <LunarArt />,
    borderColor: '#7070FF',
  },

  lightwalker: {
    headerClass: 'frame-header-lightwalker',
    headerText: '#C0D8FF',
    uppercase: true,
    headerRight: () => (
      <div style={{ display: 'flex', gap: 3, paddingRight: 6, alignItems: 'center' }}>
        {[3, 2, 3, 1.5, 2].map((r, i) => (
          <div key={i} style={{ width: r * 2, height: r * 2, borderRadius: '50%', background: '#8ACOFF', opacity: 0.7 }} />
        ))}
      </div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #060c20 0%, #04080f 60%, #080c24 100%)' },
    bodyRight: () => <LightwalkerArt />,
    borderColor: '#4488FF',
  },

  // ── Prestige ──────────────────────────────────────────────────────────────────

  prestige_frame_P1: {
    headerClass: 'frame-header-prestige1',
    headerText: '#001a08',
    uppercase: true,
    headerRight: () => (
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0, marginRight: 4, opacity: 0.8 }}>
        <polygon points="10,2 12.2,7.5 18,7.5 13.4,11.5 15.2,17 10,13.5 4.8,17 6.6,11.5 2,7.5 7.8,7.5" fill="#001a08" />
      </svg>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #01120a 0%, #010d06 60%, #01120a 100%)' },
    bodyRight: () => <PrestigeBodyArt color="#22CC22" />,
    borderColor: '#22CC22',
  },

  prestige_frame_P2: {
    headerClass: 'frame-header-prestige2',
    headerText: '#101020',
    uppercase: true,
    bodyStyle: { background: 'linear-gradient(160deg, #12121c 0%, #0a0a14 60%, #141420 100%)' },
    bodyRight: () => <PrestigeBodyArt color="#c0c0c0" />,
    borderColor: '#c0c0c0',
  },

  prestige_frame_P3: {
    headerClass: 'frame-header-prestige3',
    headerText: '#E8CCFF',
    uppercase: true,
    bodyStyle: { background: 'linear-gradient(160deg, #150030 0%, #0d001f 60%, #150030 100%)' },
    bodyRight: () => <PrestigeBodyArt color="#9B30FF" />,
    borderColor: '#9B30FF',
  },

  prestige_frame_P4: {
    headerClass: 'frame-header-prestige4',
    headerText: '#FFF0C0',
    uppercase: true,
    bodyStyle: { background: 'linear-gradient(160deg, #1a0800 0%, #0d0500 50%, #1a0a00 100%)' },
    bodyRight: () => <PrestigeBodyArt color="#FFD700" />,
    borderColor: '#FFD700',
  },

  // ── Subscriber frames ─────────────────────────────────────────────────────────

  sub_street_runner: {
    headerStyle: { background: '#1A1A2A' },
    headerText: '#00E0FF',
    headerRight: () => (
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#00E0FF', opacity: 0.7, paddingRight: 6 }}>SUB</div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #05050e 0%, #030308 60%, #05050e 100%)' },
    borderColor: '#00E0FF',
  },

  sub_neon_syndicate: {
    headerStyle: { background: 'linear-gradient(90deg, #1a002a 0%, #4a0080 50%, #1a002a 100%)' },
    headerText: '#DD88FF',
    headerRight: () => (
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#DD88FF', opacity: 0.7, paddingRight: 6 }}>SUB</div>
    ),
    bodyStyle: { background: 'linear-gradient(160deg, #0d0018 0%, #080010 60%, #0d0018 100%)' },
    borderColor: '#AA44FF',
  },

  sub_apex_sovereign: {
    headerClass: 'frame-header-apex',
    headerText: '#3a2a00',
    uppercase: true,
    bodyStyle: { background: 'linear-gradient(160deg, #1a1400 0%, #0d0a00 60%, #1a1400 100%)' },
    bodyRight: () => <SubApexArt />,
    borderColor: '#FFD700',
  },
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getFrameDef(id: string): FrameDef | null {
  return FRAME_DEFS[id] ?? null
}

export function defaultFrameDef(frame: Frame): FrameDef {
  return {
    headerStyle: { background: frame.headerColor ?? '#1a1a2a' },
    headerText: frame.textOnHeader === 'dark' ? '#111111' : '#ffffff',
    bodyStyle: { background: `linear-gradient(160deg, ${frame.accentColor}22 0%, #060210 60%, ${frame.accentColor}14 100%)` },
    borderColor: frame.accentColor ?? '#444',
  }
}
