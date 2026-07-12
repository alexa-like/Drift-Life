// ─── Frame Border System ──────────────────────────────────────────────────────
// Each frame gets unique SVG corner art + a 3D layered border, replacing the
// old flat "2px solid accentColor" approach.
//
// Design principles:
//  - Corner pieces are SVG, ~24-32 px, rotated for tr/bl/br via CSS transform
//  - FrameBorderWrapper: overflow:visible so corners stick out beyond the box edge
//  - BodyArt clipping is handled by a separate inner div
//  - FrameIcon: small (14px) SVG symbol in the name-tag, replaces emoji

import type { CSSProperties, ReactElement } from 'react'
import type { Frame } from '../lib/chatFrames'

// ─── Global CSS for animated border effects ───────────────────────────────────
const BORDER_CSS = `
@keyframes fb-pulse-ring {
  0%, 100% { opacity: 0.85; }
  50%       { opacity: 1; }
}
@keyframes fb-spin-slow {
  to { transform: rotate(360deg); }
}
@keyframes fb-flicker {
  0%, 100% { opacity: 1; }
  48%, 52% { opacity: 0.55; }
}
@keyframes fb-shimmer-linear {
  0%   { opacity: 0.6; }
  50%  { opacity: 1; }
  100% { opacity: 0.6; }
}
.fb-flicker { animation: fb-flicker 3s ease-in-out infinite; }
.fb-pulse   { animation: fb-pulse-ring 2s ease-in-out infinite; }
.fb-shimmer { animation: fb-shimmer-linear 2s ease-in-out infinite; }
`

let borderCssInjected = false
export function ensureBorderCss() {
  if (borderCssInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = BORDER_CSS
  document.head.appendChild(el)
  borderCssInjected = true
}

// ─── Corner piece infrastructure ─────────────────────────────────────────────
type Pos = 'tl' | 'tr' | 'bl' | 'br'

export interface CornerProps {
  size: number
  color: string
  accent: string   // secondary/accent shade
  pos: Pos
}

/** Wraps an SVG and positions it at the correct corner, mirrored appropriately. */
function C({ size, pos, children, cls }: { size: number; pos: Pos; children: React.ReactNode; cls?: string }) {
  const flip = pos === 'tr' ? 'scale(-1,1)' : pos === 'bl' ? 'scale(1,-1)' : pos === 'br' ? 'scale(-1,-1)' : undefined
  const style: CSSProperties = {
    position: 'absolute', width: size, height: size, pointerEvents: 'none', zIndex: 5,
    ...(pos === 'tl' ? { top: -size / 2 + 1, left: -size / 2 + 1 }
      : pos === 'tr' ? { top: -size / 2 + 1, right: -size / 2 + 1 }
      : pos === 'bl' ? { bottom: -size / 2 + 1, left: -size / 2 + 1 }
      :                { bottom: -size / 2 + 1, right: -size / 2 + 1 }),
  }
  return (
    <div style={style} className={cls}>
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', transform: flip }}>
        {children}
      </svg>
    </div>
  )
}

// ─── All corner SVG designs ───────────────────────────────────────────────────

// ⚡ Neon Drift — lightning bolt
export function CornerLightning({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-pulse">
      <defs><filter id="glow-ld"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="M21 1 L8 18 L17 18 L6 31 L25 13 L16 13 Z" fill={color} filter="url(#glow-ld)"/>
      <path d="M21 1 L8 18 L17 18 L6 31 L25 13 L16 13 Z" fill="none" stroke="white" strokeWidth="0.4" opacity="0.4"/>
    </C>
  )
}

// ▣ Grid Static — circuit node
export function CornerCircuit({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <g stroke={color} strokeWidth="1.5" fill="none">
        <line x1="0" y1="8" x2="6" y2="8"/><line x1="8" y1="0" x2="8" y2="6"/>
        <rect x="5.5" y="5.5" width="5" height="5" fill={color} opacity="0.9"/>
        <line x1="8" y1="10.5" x2="8" y2="20"/><line x1="10.5" y1="8" x2="22" y2="8"/>
        <circle cx="22" cy="8" r="2.5" fill={color}/>
        <circle cx="8" cy="22" r="2" fill={color}/>
        <line x1="8" y1="22" x2="8" y2="32"/><line x1="22" y1="8" x2="32" y2="8"/>
        {/* second branch */}
        <line x1="22" y1="8" x2="22" y2="18"/><circle cx="22" cy="18" r="1.5" fill={color}/>
      </g>
    </C>
  )
}

// 🐉 Dragon claw — three curved claw marks with scale at base
export function CornerDragonClaw({ size, color, accent, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-pulse">
      <defs><filter id="glow-dc"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-dc)">
        <path d="M1 31 Q3 16 13 2" stroke={color} fill="none" strokeWidth="2.8" strokeLinecap="round"/>
        <path d="M7 32 Q11 17 23 4" stroke={color} fill="none" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"/>
        <path d="M14 32 Q20 21 31 10" stroke={color} fill="none" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
        {/* Scale segments at base */}
        <path d="M1 31 Q8 26 15 28 Q10 32 1 31 Z" fill={accent} opacity="0.55"/>
        <path d="M6 32 Q15 27 22 29 Q17 33 6 32 Z" fill={accent} opacity="0.45"/>
        {/* Claw tips */}
        <circle cx="13" cy="2" r="2" fill={color}/>
        <circle cx="23" cy="4" r="1.6" fill={color}/>
        <circle cx="31" cy="10" r="1.2" fill={color}/>
      </g>
    </C>
  )
}

// 🌸 Sakura — curving branch with 3 five-petal blossoms
export function CornerSakura({ size, color, pos }: CornerProps) {
  function Blossom({ cx, cy, r }: { cx: number; cy: number; r: number }) {
    return (
      <g transform={`translate(${cx} ${cy})`}>
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="0" cy={-r} rx={r * 0.52} ry={r}
            transform={`rotate(${a})`} fill={color} opacity="0.92"/>
        ))}
        <circle cx="0" cy="0" r={r * 0.38} fill="#FFE066"/>
      </g>
    )
  }
  return (
    <C size={size} pos={pos}>
      <path d="M0 32 Q13 19 32 0" stroke={color} fill="none" strokeWidth="1.4" opacity="0.7"/>
      {/* Secondary branch */}
      <path d="M0 22 Q8 18 14 10" stroke={color} fill="none" strokeWidth="1" opacity="0.5"/>
      <Blossom cx={4} cy={28} r={3.8}/>
      <Blossom cx={16} cy={16} r={3.3}/>
      <Blossom cx={28} cy={4} r={2.8}/>
    </C>
  )
}

// ❄ CyberFrost — ice spike crystal
export function CornerIceCrystal({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs>
        <linearGradient id="ice-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.8"/>
        </linearGradient>
      </defs>
      <g fill="none" stroke={color} strokeWidth="1.4">
        {/* Main spike up */}
        <polygon points="16,0 20,14 28,14 22,22 25,32 16,26 7,32 10,22 4,14 12,14"
          fill={color} fillOpacity="0.18" stroke={color}/>
        {/* Inner highlight */}
        <polygon points="16,5 19,14 25,14 20,20 22,28 16,23 10,28 12,20 7,14 13,14"
          fill="white" fillOpacity="0.12" stroke="white" strokeWidth="0.5" strokeOpacity="0.4"/>
        {/* Cross bars */}
        <line x1="0" y1="16" x2="6" y2="16"/><line x1="26" y1="16" x2="32" y2="16"/>
        <line x1="16" y1="0" x2="16" y2="4"/><line x1="16" y1="28" x2="16" y2="32"/>
        {/* Crystal side spikes */}
        <polygon points="0,16 4,14 4,18" fill={color}/><polygon points="32,16 28,14 28,18" fill={color}/>
      </g>
    </C>
  )
}

// 🌴 Retro Miami — palm tree with dual-color fronds
export function CornerPalmTree({ size, color, accent, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      {/* Trunk with S-curve */}
      <path d="M16 32 Q18 24 15 16 Q14 10 17 4" stroke="#A0784A" fill="none" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Top fronds */}
      <path d="M16 6 Q4 1 0 4" stroke={accent} fill="none" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 6 Q28 -1 32 3" stroke={accent} fill="none" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M16 8 Q3 11 0 16" stroke={color} fill="none" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 8 Q29 11 32 16" stroke={color} fill="none" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 11 Q8 18 2 24" stroke={accent} fill="none" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      {/* Coconuts */}
      <circle cx="13" cy="8" r="1.8" fill="#8B4513"/>
      <circle cx="18" cy="7" r="1.8" fill="#8B4513"/>
    </C>
  )
}

// 🎃 Halloween — spider web with spider
export function CornerSpiderWeb({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <g stroke={color} fill="none" opacity="0.9">
        {/* Radial spokes from top-left */}
        <line x1="0" y1="0" x2="32" y2="0" strokeWidth="1"/>
        <line x1="0" y1="0" x2="0" y2="32" strokeWidth="1"/>
        <line x1="0" y1="0" x2="32" y2="32" strokeWidth="1"/>
        <line x1="0" y1="0" x2="20" y2="32" strokeWidth="0.8"/>
        <line x1="0" y1="0" x2="32" y2="20" strokeWidth="0.8"/>
        {/* Web arcs */}
        <path d="M9 0 Q0 0 0 9" strokeWidth="0.9"/>
        <path d="M18 0 Q0 0 0 18" strokeWidth="0.9"/>
        <path d="M28 0 Q0 0 0 28" strokeWidth="0.9"/>
        {/* Spider at corner */}
        <circle cx="3.5" cy="3.5" r="3" fill={color}/>
        {/* Legs */}
        {[[-2,-1],[-2,1],[-1,-2],[1,-2],[2,-2],[2,0],[0,2],[-2,2]].map(([dx,dy],i)=>(
          <line key={i} x1="3.5" y1="3.5" x2={3.5+dx*3.5} y2={3.5+dy*3.5} strokeWidth="0.7"/>
        ))}
        <circle cx="3.5" cy="3.5" r="1.2" fill="red" opacity="0.7"/>
      </g>
    </C>
  )
}

// ⚜️ APEX — gold crown with gems
export function CornerCrown({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-shimmer">
      <defs>
        <linearGradient id="crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffde0"/>
          <stop offset="40%" stopColor={color}/>
          <stop offset="100%" stopColor="#b8860b"/>
        </linearGradient>
        <filter id="glow-crown"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g filter="url(#glow-crown)">
        <path d="M2 29 L2 13 L10 21 L16 5 L22 21 L30 13 L30 29 Z" fill="url(#crown-gold)"/>
        {/* Points */}
        <circle cx="2" cy="13" r="2.2" fill={color}/>
        <circle cx="16" cy="5" r="2.8" fill={color}/>
        <circle cx="30" cy="13" r="2.2" fill={color}/>
        {/* Gems on crown body */}
        <rect x="7" y="20" width="4" height="4" rx="1" fill="white" opacity="0.5"/>
        <rect x="14" y="20" width="4" height="4" rx="1" fill="cyan" opacity="0.5"/>
        <rect x="21" y="20" width="4" height="4" rx="1" fill="white" opacity="0.5"/>
        {/* Base band */}
        <rect x="2" y="25" width="28" height="4" rx="1" fill="#b8860b" opacity="0.8"/>
      </g>
    </C>
  )
}

// [|] Terminal bracket — Blackout / Netrunner
export function CornerTerminal({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-flicker">
      <g stroke={color} fill="none" strokeWidth="2.5" strokeLinecap="square">
        {/* Outer bracket corners */}
        <path d="M12 1 L1 1 L1 12"/>
        <path d="M20 1 L31 1 L31 12"/>
        <path d="M1 20 L1 31 L12 31"/>
        <path d="M31 20 L31 31 L20 31"/>
      </g>
      {/* Cursor block center */}
      <rect x="11" y="11" width="10" height="10" fill={color} opacity="0.75" className="fb-flicker"/>
      {/* Scan line */}
      <line x1="0" y1="16" x2="32" y2="16" stroke={color} strokeWidth="0.6" opacity="0.35"/>
    </C>
  )
}

// 🌙 Constellation — star map dots + lines
export function CornerConstellation({ size, color, pos }: CornerProps) {
  const stars: [number, number, number][] = [[4,5,2],[17,3,2.5],[28,9,1.5],[9,17,1.5],[25,19,2],[7,27,1.5],[22,28,1]]
  const edges: [number, number][] = [[0,1],[1,2],[0,3],[1,3],[2,4],[3,5],[4,6]]
  return (
    <C size={size} pos={pos}>
      <g>
        {edges.map(([a, b], i) => (
          <line key={i}
            x1={stars[a][0]} y1={stars[a][1]}
            x2={stars[b][0]} y2={stars[b][1]}
            stroke={color} strokeWidth="0.6" opacity="0.5"/>
        ))}
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={color}
            style={{ filter: `drop-shadow(0 0 ${i < 2 ? 3 : 2}px ${color})` }}/>
        ))}
      </g>
    </C>
  )
}

// 💥 Nova burst — starburst explosion
export function CornerNovaBurst({ size, color, pos }: CornerProps) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <C size={size} pos={pos} cls="fb-pulse">
      <defs><filter id="glow-nova"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-nova)">
        {rays.map((a, i) => {
          const isMain = i % 2 === 0
          const len = isMain ? 13 : 8
          const rad = (a * Math.PI) / 180
          return (
            <line key={a}
              x1={16 + 3.5 * Math.cos(rad)} y1={16 + 3.5 * Math.sin(rad)}
              x2={16 + len * Math.cos(rad)} y2={16 + len * Math.sin(rad)}
              stroke={color} strokeWidth={isMain ? 1.8 : 1} opacity={isMain ? 1 : 0.55}/>
          )
        })}
        <circle cx="16" cy="16" r="4.5" fill={color}/>
        <circle cx="16" cy="16" r="2" fill="white" opacity="0.5"/>
      </g>
    </C>
  )
}

// ⚜ Fleur-de-lis — Sovereign frame
export function CornerFleurDeLis({ size, color, accent, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs>
        <linearGradient id="fdl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color}/>
        </linearGradient>
      </defs>
      <g fill="url(#fdl-grad)" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        {/* Center top petal */}
        <path d="M16 0 Q20 7 18 14 Q16 12 14 14 Q12 7 16 0 Z"/>
        {/* Left petal */}
        <path d="M16 10 Q6 7 2 14 Q7 15 16 18 Z" opacity="0.85"/>
        {/* Right petal */}
        <path d="M16 10 Q26 7 30 14 Q25 15 16 18 Z" opacity="0.85"/>
        {/* Stem */}
        <path d="M14 14 Q10 21 12 29 L16 25 L20 29 Q22 21 18 14 Z" opacity="0.9"/>
        {/* Base bar */}
        <rect x="10" y="27" width="12" height="3.5" rx="1.8" opacity="0.7"/>
      </g>
    </C>
  )
}

// 🍃 Holly berries — CyberSanta
export function CornerHolly({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      {/* Leaves */}
      <path d="M3 16 Q9 3 18 6 Q12 14 3 16 Z" fill="#1A8C1A"/>
      <path d="M18 6 Q27 2 30 11 Q23 12 18 6 Z" fill="#147A14"/>
      <path d="M3 16 Q0 26 9 29 Q9 20 3 16 Z" fill="#1A8C1A"/>
      <path d="M9 29 Q12 22 21 24 Q16 30 9 29 Z" fill="#147A14"/>
      {/* Berries — glossy */}
      <circle cx="15" cy="21" r="4.8" fill="#CC0010"/>
      <circle cx="23" cy="17" r="4.8" fill="#CC0010"/>
      <circle cx="19" cy="25" r="3.5" fill="#BB0010"/>
      {/* Berry highlights */}
      <circle cx="13" cy="19" r="1.3" fill="#FF6677" opacity="0.7"/>
      <circle cx="21" cy="15" r="1.3" fill="#FF6677" opacity="0.7"/>
    </C>
  )
}

// 🌺 Toxic bloom — Cyberbloom
export function CornerToxicFlower({ size, color, pos }: CornerProps) {
  const petals = [0, 60, 120, 180, 240, 300]
  return (
    <C size={size} pos={pos} cls="fb-pulse">
      <defs><filter id="glow-tb"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-tb)">
        {petals.map(a => {
          const rad = (a * Math.PI) / 180
          return (
            <ellipse key={a}
              cx={16 + 7.5 * Math.cos(rad)} cy={16 + 7.5 * Math.sin(rad)}
              rx="3.5" ry="6"
              transform={`rotate(${a} ${16 + 7.5 * Math.cos(rad)} ${16 + 7.5 * Math.sin(rad)})`}
              fill={color} opacity="0.85"/>
          )
        })}
        <circle cx="16" cy="16" r="4.5" fill={color}/>
        <circle cx="16" cy="16" r="2" fill="black" opacity="0.45"/>
        {/* Drip drops */}
        {[30, 150, 270].map(a => {
          const rad = (a * Math.PI) / 180
          return <circle key={a} cx={16 + 14 * Math.cos(rad)} cy={16 + 14 * Math.sin(rad)} r="1.8" fill={color} opacity="0.6"/>
        })}
      </g>
    </C>
  )
}

// 👻 Smoke wisp — Street Phantom
export function CornerSmokeWisp({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <g fill="none" stroke={color} strokeLinecap="round">
        <path d="M4 32 Q6 22 11 18 Q9 12 15 8 Q13 3 19 1" strokeWidth="2.3" opacity="0.9"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}/>
        <path d="M11 32 Q15 24 13 18 Q17 14 15 8" strokeWidth="1.6" opacity="0.6"/>
        <path d="M20 28 Q24 22 22 16 Q26 12 24 6" strokeWidth="1" opacity="0.4"/>
        {/* Wisp head */}
        <circle cx="19" cy="1.5" r="3" fill={color} fillOpacity="0.5" stroke="none"/>
      </g>
    </C>
  )
}

// 🏮 Lantern — Night Market
export function CornerLantern({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs>
        <radialGradient id="lantern-glow">
          <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
          <stop offset="100%" stopColor={color}/>
        </radialGradient>
      </defs>
      {/* Hanging string */}
      <path d="M16 0 Q14 5 16 7" stroke={color} fill="none" strokeWidth="1.2"/>
      {/* Top cap */}
      <rect x="11" y="6" width="10" height="3" rx="1.5" fill={color}/>
      {/* Main lantern body */}
      <ellipse cx="16" cy="18" rx="9" ry="11" fill="url(#lantern-glow)" opacity="0.9"/>
      {/* Lantern ribs */}
      <ellipse cx="16" cy="18" rx="3.5" ry="11" fill="none" stroke="black" strokeWidth="0.6" opacity="0.35"/>
      <ellipse cx="16" cy="18" rx="7" ry="11" fill="none" stroke="black" strokeWidth="0.4" opacity="0.2"/>
      {/* Bottom cap */}
      <rect x="11" y="27" width="10" height="3" rx="1.5" fill={color}/>
      {/* Tassel */}
      <line x1="16" y1="30" x2="16" y2="32" stroke="#FFD700" strokeWidth="1.5"/>
    </C>
  )
}

// ◈ Hex bolt — Chrome Edge
export function CornerHexBolt({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs>
        <linearGradient id="chrome-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.7"/>
          <stop offset="50%" stopColor={color}/>
          <stop offset="100%" stopColor="#666"/>
        </linearGradient>
      </defs>
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="url(#chrome-grad)" stroke={color} strokeWidth="1.2"/>
      <polygon points="16,6 25,11 25,21 16,26 7,21 7,11" fill="white" fillOpacity="0.12"/>
      {/* Bolt slots */}
      <line x1="12" y1="16" x2="20" y2="16" stroke="black" strokeWidth="2.5"/>
      <circle cx="16" cy="16" r="5" fill="none" stroke={color} strokeWidth="1"/>
    </C>
  )
}

// ✨ Aurora spike — Lightwalker
export function CornerAuroraSpike({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-shimmer">
      <defs>
        <linearGradient id="aurora-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white"/>
          <stop offset="100%" stopColor={color}/>
        </linearGradient>
        <filter id="glow-aurora"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g filter="url(#glow-aurora)">
        <polygon points="16,0 20,13 31,11 21,21 24,32 16,26 8,32 11,21 1,11 12,13"
          fill="url(#aurora-grad)" opacity="0.8"/>
        <polygon points="16,4 19,13 27,12 20,19 22,28 16,23 10,28 12,19 5,12 13,13"
          fill="white" opacity="0.3"/>
      </g>
    </C>
  )
}

// 🎆 Firework — Golden New Year
export function CornerFirework({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-shimmer">
      <defs><filter id="glow-fw"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-fw)">
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * 30
          const isMain = i % 2 === 0
          const len = isMain ? 13 : 8
          const rad = (a * Math.PI) / 180
          const [x2, y2] = [16 + len * Math.cos(rad), 16 + len * Math.sin(rad)]
          return (
            <g key={a}>
              <line x1={16 + 3 * Math.cos(rad)} y1={16 + 3 * Math.sin(rad)} x2={x2} y2={y2}
                stroke={color} strokeWidth={isMain ? 1.8 : 1} opacity={isMain ? 1 : 0.55}/>
              {isMain && <circle cx={x2} cy={y2} r="1.8" fill={color}/>}
            </g>
          )
        })}
        <circle cx="16" cy="16" r="3.5" fill={color}/>
        <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.6"/>
      </g>
    </C>
  )
}

// ⭐ Prestige star
export function CornerPrestigeStar({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-shimmer">
      <defs>
        <radialGradient id="star-grad">
          <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
          <stop offset="100%" stopColor={color}/>
        </radialGradient>
        <filter id="glow-star"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g filter="url(#glow-star)">
        <polygon points="16,1 20,12 31,12 22,19 25,30 16,24 7,30 10,19 1,12 12,12"
          fill="url(#star-grad)" stroke={color} strokeWidth="0.5"/>
        <polygon points="16,5 19,13 27,13 21,18 23,26 16,22 9,26 11,18 5,13 13,13"
          fill="white" fillOpacity="0.2"/>
      </g>
    </C>
  )
}

// 🔥 Flame tip — Urban Heat
export function CornerFlame({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-pulse">
      <defs><filter id="glow-flame"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-flame)">
        <path d="M16 0 Q24 8 20 16 Q28 10 24 22 Q32 14 27 28 Q20 18 14 22 Q18 12 12 20 Q8 12 16 0 Z"
          fill={color} opacity="0.9"/>
        {/* Inner hot core */}
        <path d="M16 6 Q21 12 18 18 Q22 14 20 22 Q16 14 13 18 Q14 12 16 6 Z"
          fill="#FFF59D" opacity="0.65"/>
      </g>
    </C>
  )
}

// ⚠ Warning triangle — Signal Breach
export function CornerWarning({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos} cls="fb-flicker">
      <defs><filter id="glow-warn"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-warn)">
        <polygon points="16,2 30,28 2,28" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2"/>
        {/* Exclamation */}
        <line x1="16" y1="11" x2="16" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="16" cy="25" r="1.5" fill="white"/>
      </g>
    </C>
  )
}

// 🌙 Crescent moon — Lunar Stallion
export function CornerCrescent({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs><filter id="glow-moon"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#glow-moon)">
        {/* Crescent shape */}
        <path d="M22 6 A14 14 0 1 0 22 26 A10 10 0 1 1 22 6 Z" fill={color} opacity="0.85"/>
        {/* Stars around */}
        <circle cx="6" cy="4" r="1.5" fill={color}/>
        <circle cx="28" cy="8" r="1" fill={color}/>
        <circle cx="4" cy="20" r="1" fill={color}/>
        <circle cx="26" cy="26" r="1.5" fill={color}/>
        <circle cx="14" cy="2" r="1.2" fill={color}/>
      </g>
    </C>
  )
}

// 🐾 Paw print — CyberKitty
export function CornerPawPrint({ size, color, pos }: CornerProps) {
  return (
    <C size={size} pos={pos}>
      <defs><filter id="glow-paw"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g fill={color} filter="url(#glow-paw)">
        {/* Main pad */}
        <ellipse cx="16" cy="21" rx="6" ry="5.5"/>
        {/* Toe pads */}
        <ellipse cx="7" cy="13" rx="3.5" ry="4.5"/>
        <ellipse cx="16" cy="11" rx="3.5" ry="4.5"/>
        <ellipse cx="25" cy="13" rx="3.5" ry="4.5"/>
        {/* Claw lines */}
        <line x1="7" y1="9" x2="6" y2="7" stroke={color} strokeWidth="1.2" opacity="0.6"/>
        <line x1="16" y1="7" x2="16" y2="5" stroke={color} strokeWidth="1.2" opacity="0.6"/>
        <line x1="25" y1="9" x2="26" y2="7" stroke={color} strokeWidth="1.2" opacity="0.6"/>
      </g>
    </C>
  )
}

// ─── Frame icon map (replaces emoji in name tag) ──────────────────────────────
// Each returns an SVG path string rendered at 14x14 inside the name tag.

const FRAME_ICON_SVG: Record<string, (color: string) => React.ReactNode> = {
  neon_drift:          (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M21 1 L8 18 L17 18 L6 31 L25 13 L16 13 Z" fill={c}/></svg>,
  grid_static:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><rect x="10" y="10" width="12" height="12" fill="none" stroke={c} strokeWidth="2"/><circle cx="10" cy="10" r="2.5" fill={c}/><circle cx="22" cy="10" r="2.5" fill={c}/><circle cx="10" cy="22" r="2.5" fill={c}/><circle cx="22" cy="22" r="2.5" fill={c}/></svg>,
  street_phantom:      (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M4 32 Q6 22 11 18 Q9 12 15 8 Q13 3 19 1" stroke={c} fill="none" strokeWidth="2.5" strokeLinecap="round"/><circle cx="19" cy="1.5" r="3" fill={c} opacity="0.6"/></svg>,
  urban_heat:          (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M16 0 Q24 8 20 16 Q28 10 24 22 Q32 14 27 28 Q20 18 14 22 Q18 12 12 20 Q8 12 16 0 Z" fill={c}/></svg>,
  signal_breach:       (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,2 30,28 2,28" fill={c} fillOpacity="0.4" stroke={c} strokeWidth="2"/><line x1="16" y1="11" x2="16" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="25" r="1.5" fill="white"/></svg>,
  night_market:        (c) => <svg width="13" height="13" viewBox="0 0 32 32"><ellipse cx="16" cy="18" rx="9" ry="11" fill={c} opacity="0.8"/><rect x="11" y="6" width="10" height="3" rx="1.5" fill={c}/><line x1="16" y1="0" x2="16" y2="6" stroke={c} strokeWidth="1.2"/></svg>,
  chrome_edge:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke={c} strokeWidth="2"/><line x1="12" y1="16" x2="20" y2="16" stroke={c} strokeWidth="2.5"/></svg>,
  void_signal:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><circle cx="16" cy="16" r="8" fill="none" stroke={c} strokeWidth="1.5"/><circle cx="16" cy="6" r="2.5" fill={c}/><circle cx="24" cy="21" r="2" fill={c}/><circle cx="8" cy="21" r="2" fill={c}/><line x1="16" y1="8" x2="24" y2="20" stroke={c} strokeWidth="0.8" opacity="0.6"/><line x1="16" y1="8" x2="8" y2="20" stroke={c} strokeWidth="0.8" opacity="0.6"/></svg>,
  cyberkitty:          (c) => <svg width="13" height="13" viewBox="0 0 32 32"><ellipse cx="16" cy="20" rx="6" ry="5.5" fill={c}/><ellipse cx="8" cy="13" rx="3" ry="4" fill={c}/><ellipse cx="16" cy="11" rx="3" ry="4" fill={c}/><ellipse cx="24" cy="13" rx="3" ry="4" fill={c}/></svg>,
  cyberfrost:          (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,0 20,14 32,12 22,22 25,32 16,26 7,32 10,22 0,12 12,14" fill="none" stroke={c} strokeWidth="1.8"/></svg>,
  retro_miami:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M16 32 Q18 22 16 12 Q15 6 17 0" stroke="#A0784A" fill="none" strokeWidth="2.5"/><path d="M16 6 Q4 1 0 4" stroke={c} fill="none" strokeWidth="1.8"/><path d="M16 6 Q28 1 32 4" stroke={c} fill="none" strokeWidth="1.8"/></svg>,
  sakura:              (c) => <svg width="13" height="13" viewBox="0 0 32 32">{[0,72,144,216,288].map(a=><ellipse key={a} cx="0" cy="-9" rx="4" ry="7" transform={`translate(16,16) rotate(${a})`} fill={c} opacity="0.9"/>)}<circle cx="16" cy="16" r="3.5" fill="#FFE066"/></svg>,
  halloween:           (c) => <svg width="13" height="13" viewBox="0 0 32 32"><ellipse cx="16" cy="18" rx="13" ry="11" fill={c} opacity="0.9"/><path d="M3 18 Q5 10 10 12" fill="none" stroke="black" strokeWidth="1"/><circle cx="10" cy="15" r="2.5" fill="black"/><circle cx="22" cy="15" r="2.5" fill="black"/><path d="M10 22 Q16 25 22 22" fill="none" stroke="black" strokeWidth="1.5"/></svg>,
  cyberbloom:          (c) => <svg width="13" height="13" viewBox="0 0 32 32">{[0,60,120,180,240,300].map(a=>{const r=a*Math.PI/180;return<ellipse key={a} cx={16+7*Math.cos(r)} cy={16+7*Math.sin(r)} rx="3" ry="5" transform={`rotate(${a} ${16+7*Math.cos(r)} ${16+7*Math.sin(r)})`} fill={c} opacity="0.85"/>})}<circle cx="16" cy="16" r="4" fill={c}/></svg>,
  apex:                (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M2 29 L2 13 L10 21 L16 5 L22 21 L30 13 L30 29 Z" fill={c}/><circle cx="2" cy="13" r="2" fill={c}/><circle cx="16" cy="5" r="2.5" fill={c}/><circle cx="30" cy="13" r="2" fill={c}/></svg>,
  blackout_protocol:   (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M10 2 L2 2 L2 10" stroke={c} fill="none" strokeWidth="2.5"/><path d="M22 2 L30 2 L30 10" stroke={c} fill="none" strokeWidth="2.5"/><path d="M2 22 L2 30 L10 30" stroke={c} fill="none" strokeWidth="2.5"/><path d="M30 22 L30 30 L22 30" stroke={c} fill="none" strokeWidth="2.5"/><rect x="12" y="12" width="8" height="8" fill={c} opacity="0.8"/></svg>,
  nova_circuit:        (c) => <svg width="13" height="13" viewBox="0 0 32 32">{[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>{const isM=i%2===0;const len=isM?13:8;const r=a*Math.PI/180;return<line key={a} x1={16+3*Math.cos(r)} y1={16+3*Math.sin(r)} x2={16+len*Math.cos(r)} y2={16+len*Math.sin(r)} stroke={c} strokeWidth={isM?1.8:1} opacity={isM?1:0.5}/>})}<circle cx="16" cy="16" r="4" fill={c}/></svg>,
  sovereign:           (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M16 0 Q20 7 18 14 Q16 12 14 14 Q12 7 16 0 Z" fill={c}/><path d="M16 10 Q6 7 2 14 Q7 15 16 18 Z" fill={c} opacity="0.85"/><path d="M16 10 Q26 7 30 14 Q25 15 16 18 Z" fill={c} opacity="0.85"/><path d="M14 14 Q10 21 12 29 L16 25 L20 29 Q22 21 18 14 Z" fill={c}/><rect x="10" y="27" width="12" height="3.5" rx="1.5" fill={c} opacity="0.7"/></svg>,
  cybersanta:          (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M3 16 Q9 3 18 6 Q12 14 3 16 Z" fill="#1A8C1A"/><path d="M18 6 Q27 2 30 11 Q23 12 18 6 Z" fill="#147A14"/><circle cx="15" cy="21" r="5" fill="#CC0010"/><circle cx="23" cy="17" r="5" fill="#CC0010"/></svg>,
  cyberdragon:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M1 31 Q3 16 13 2" stroke={c} fill="none" strokeWidth="2.8" strokeLinecap="round"/><path d="M7 32 Q11 17 23 4" stroke={c} fill="none" strokeWidth="2.2" strokeLinecap="round" opacity="0.85"/><path d="M14 32 Q20 21 31 10" stroke={c} fill="none" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/><path d="M1 31 Q8 26 15 28 Q10 32 1 31 Z" fill={c} opacity="0.55"/></svg>,
  netrunner:           (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M10 2 L2 2 L2 10" stroke={c} fill="none" strokeWidth="2.5"/><path d="M22 2 L30 2 L30 10" stroke={c} fill="none" strokeWidth="2.5"/><path d="M2 22 L2 30 L10 30" stroke={c} fill="none" strokeWidth="2.5"/><path d="M30 22 L30 30 L22 30" stroke={c} fill="none" strokeWidth="2.5"/><text x="10" y="22" fill={c} fontSize="12" fontFamily="monospace" fontWeight="bold">{'>'}</text></svg>,
  golden_new_year:     (c) => <svg width="13" height="13" viewBox="0 0 32 32">{Array.from({length:12},(_,i)=>{const a=i*30;const isM=i%2===0;const len=isM?14:9;const r=a*Math.PI/180;return<line key={a} x1={16+3*Math.cos(r)} y1={16+3*Math.sin(r)} x2={16+len*Math.cos(r)} y2={16+len*Math.sin(r)} stroke={c} strokeWidth={isM?1.8:1} opacity={isM?1:0.5}/>})}<circle cx="16" cy="16" r="3.5" fill={c}/></svg>,
  lunar_stallion:      (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M22 6 A14 14 0 1 0 22 26 A10 10 0 1 1 22 6 Z" fill={c} opacity="0.85"/><circle cx="6" cy="4" r="1.5" fill={c}/><circle cx="4" cy="20" r="1" fill={c}/><circle cx="26" cy="26" r="1.5" fill={c}/></svg>,
  lightwalker:         (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,1 20,12 31,12 22,19 25,30 16,24 7,30 10,19 1,12 12,12" fill={c} opacity="0.85"/></svg>,
  prestige_frame_P1:   (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,1 20,12 31,12 22,19 25,30 16,24 7,30 10,19 1,12 12,12" fill={c}/></svg>,
  prestige_frame_P2:   (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,1 20,12 31,12 22,19 25,30 16,24 7,30 10,19 1,12 12,12" fill={c}/><polygon points="16,6 19,13 27,13 21,18 23,26 16,22 9,26 11,18 5,13 13,13" fill="white" fillOpacity="0.25"/></svg>,
  prestige_frame_P3:   (c) => <svg width="13" height="13" viewBox="0 0 32 32"><polygon points="16,0 20,8 30,6 24,14 30,22 20,20 16,28 12,20 2,22 8,14 2,6 12,8" fill={c} opacity="0.85"/></svg>,
  prestige_frame_P4:   (c) => <svg width="13" height="13" viewBox="0 0 32 32">{[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>{const r=a*Math.PI/180;const len=i%2===0?14:9;return<line key={a} x1={16+3.5*Math.cos(r)} y1={16+3.5*Math.sin(r)} x2={16+len*Math.cos(r)} y2={16+len*Math.sin(r)} stroke={c} strokeWidth={i%2===0?2:1}/>})}<circle cx="16" cy="16" r="5" fill={c}/><circle cx="16" cy="16" r="2.5" fill="white" opacity="0.4"/></svg>,
  sub_street_runner:   (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M21 1 L8 18 L17 18 L6 31 L25 13 L16 13 Z" fill={c}/></svg>,
  sub_neon_syndicate:  (c) => <svg width="13" height="13" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke={c} strokeWidth="1.5"/>{[0,60,120,180,240,300].map(a=>{const r=a*Math.PI/180;return<line key={a} x1="16" y1="16" x2={16+10*Math.cos(r)} y2={16+10*Math.sin(r)} stroke={c} strokeWidth="0.8" opacity="0.6"/>})}<circle cx="16" cy="16" r="3" fill={c}/></svg>,
  sub_apex_sovereign:  (c) => <svg width="13" height="13" viewBox="0 0 32 32"><path d="M2 29 L2 13 L10 21 L16 5 L22 21 L30 13 L30 29 Z" fill={c}/><circle cx="16" cy="5" r="2.5" fill={c}/></svg>,
}

/** Returns a small themed SVG icon for the name tag, replacing emoji. */
export function FrameTagIcon({ frame, textColor }: { frame: Frame; textColor: string }) {
  const render = FRAME_ICON_SVG[frame.id]
  if (!render) return null
  return <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{render(textColor)}</span>
}

// ─── Border definition map ────────────────────────────────────────────────────

type CornerComponent = (props: CornerProps) => ReactElement

interface BorderDef {
  width: number
  color: string        // border line color
  style: 'solid' | 'dashed' | 'dotted'
  shadow: string       // full box-shadow string
  cornerSize: number
  Corner: CornerComponent
}

function glow(color: string, px: number, op = 'aa'): string {
  return [
    `0 0 ${px}px ${color}${op}`,
    `0 0 ${Math.ceil(px / 2)}px ${color}${op}`,
    `inset 0 0 ${px + 8}px ${color}16`,
    `inset 0 1px 0 rgba(255,255,255,0.07)`,
    `inset 0 -1px 0 rgba(0,0,0,0.35)`,
  ].join(', ')
}

const BORDER_MAP: Record<string, BorderDef> = {
  // ── Elite ──────────────────────────────────────────────────────────────────
  neon_drift:          { width: 2, color: '#00E0FF', style: 'solid',  shadow: glow('#00E0FF', 14),         cornerSize: 22, Corner: CornerLightning    },
  grid_static:         { width: 2, color: '#00FF9F', style: 'solid',  shadow: glow('#00FF9F', 12),         cornerSize: 22, Corner: CornerCircuit      },
  street_phantom:      { width: 2, color: '#9B30FF', style: 'solid',  shadow: glow('#9B30FF', 14),         cornerSize: 22, Corner: CornerSmokeWisp    },
  urban_heat:          { width: 2, color: '#FF6600', style: 'solid',  shadow: glow('#FF6600', 16),         cornerSize: 24, Corner: CornerFlame        },
  signal_breach:       { width: 2, color: '#FF0040', style: 'dashed', shadow: glow('#FF0040', 12),         cornerSize: 22, Corner: CornerWarning      },
  night_market:        { width: 2, color: '#FF007F', style: 'solid',  shadow: glow('#FF007F', 14),         cornerSize: 26, Corner: CornerLantern      },
  chrome_edge:         { width: 2, color: '#E0E0E0', style: 'solid',  shadow: glow('#C0C0C0', 10),         cornerSize: 24, Corner: CornerHexBolt      },
  void_signal:         { width: 2, color: '#5060FF', style: 'solid',  shadow: glow('#5060FF', 14),         cornerSize: 22, Corner: CornerConstellation},
  cyberkitty:          { width: 2, color: '#00C8D4', style: 'solid',  shadow: glow('#00C8D4', 12),         cornerSize: 24, Corner: CornerPawPrint     },
  cyberfrost:          { width: 2, color: '#5BC8F5', style: 'solid',  shadow: glow('#5BC8F5', 14),         cornerSize: 26, Corner: CornerIceCrystal  },
  retro_miami:         { width: 2, color: '#FF2FD1', style: 'solid',  shadow: glow('#FF2FD1', 14),         cornerSize: 28, Corner: CornerPalmTree     },
  sakura:              { width: 2, color: '#FFB7C5', style: 'solid',  shadow: glow('#FFB7C5', 12),         cornerSize: 26, Corner: CornerSakura       },
  halloween:           { width: 2, color: '#FF7518', style: 'solid',  shadow: glow('#FF7518', 14),         cornerSize: 24, Corner: CornerSpiderWeb    },
  cyberbloom:          { width: 2, color: '#39FF14', style: 'solid',  shadow: glow('#39FF14', 14),         cornerSize: 24, Corner: CornerToxicFlower  },
  // ── Legendary ──────────────────────────────────────────────────────────────
  apex:                { width: 3, color: '#FFD700', style: 'solid',  shadow: glow('#FFD700', 20),         cornerSize: 28, Corner: CornerCrown        },
  blackout_protocol:   { width: 2, color: '#CCCCCC', style: 'dashed', shadow: glow('#FFFFFF', 10, '55'),   cornerSize: 26, Corner: CornerTerminal     },
  nova_circuit:        { width: 2, color: '#FF2D6B', style: 'solid',  shadow: glow('#FF2D6B', 16),         cornerSize: 26, Corner: CornerNovaBurst    },
  sovereign:           { width: 3, color: '#9040FF', style: 'solid',  shadow: glow('#9040FF', 20),         cornerSize: 28, Corner: CornerFleurDeLis  },
  cybersanta:          { width: 2, color: '#FF4444', style: 'solid',  shadow: glow('#FF4444', 14),         cornerSize: 26, Corner: CornerHolly        },
  cyberdragon:         { width: 3, color: '#FF4400', style: 'solid',  shadow: glow('#FF4400', 22),         cornerSize: 28, Corner: CornerDragonClaw   },
  netrunner:           { width: 2, color: '#00FF9F', style: 'solid',  shadow: glow('#00FF9F', 16),         cornerSize: 26, Corner: CornerTerminal     },
  golden_new_year:     { width: 3, color: '#FFD700', style: 'solid',  shadow: glow('#FFD700', 20),         cornerSize: 28, Corner: CornerFirework     },
  // ── Mythic ─────────────────────────────────────────────────────────────────
  lunar_stallion:      { width: 3, color: '#8888FF', style: 'solid',  shadow: glow('#8888FF', 24),         cornerSize: 30, Corner: CornerCrescent     },
  lightwalker:         { width: 3, color: '#DDDEFF', style: 'solid',  shadow: glow('#E0E0FF', 24, '88'),   cornerSize: 30, Corner: CornerAuroraSpike  },
  prestige_frame_P1:   { width: 3, color: '#FFD700', style: 'solid',  shadow: glow('#FFD700', 22),         cornerSize: 28, Corner: CornerPrestigeStar },
  prestige_frame_P2:   { width: 3, color: '#D0D0D0', style: 'solid',  shadow: glow('#D0D0D0', 22),         cornerSize: 30, Corner: CornerPrestigeStar },
  prestige_frame_P3:   { width: 3, color: '#AA60FF', style: 'solid',  shadow: glow('#AA60FF', 24),         cornerSize: 30, Corner: CornerFleurDeLis  },
  prestige_frame_P4:   { width: 3, color: '#FF2D6B', style: 'solid',  shadow: glow('#FF2D6B', 26),         cornerSize: 32, Corner: CornerNovaBurst    },
  // ── Subscriber ─────────────────────────────────────────────────────────────
  sub_street_runner:   { width: 2, color: '#00E0FF', style: 'solid',  shadow: glow('#00E0FF', 12),         cornerSize: 22, Corner: CornerLightning    },
  sub_neon_syndicate:  { width: 2, color: '#FF4FA3', style: 'solid',  shadow: glow('#FF4FA3', 12),         cornerSize: 22, Corner: CornerSmokeWisp    },
  sub_apex_sovereign:  { width: 3, color: '#FFD700', style: 'solid',  shadow: glow('#FFD700', 18),         cornerSize: 26, Corner: CornerCrown        },
}

function defaultBorder(frame: Frame): BorderDef {
  return {
    width: 2, color: frame.accentColor, style: 'solid',
    shadow: glow(frame.accentColor, 12),
    cornerSize: 22, Corner: CornerConstellation,
  }
}

// ─── FrameBorderWrapper ───────────────────────────────────────────────────────
// Renders the themed border + 4 corner pieces around a chat frame body.

export interface FrameBorderWrapperProps {
  frame: Frame
  style?: CSSProperties
  children: React.ReactNode
}

export function FrameBorderWrapper({ frame, style, children }: FrameBorderWrapperProps) {
  ensureBorderCss()
  const def = BORDER_MAP[frame.id] ?? defaultBorder(frame)
  const { Corner, cornerSize } = def

  return (
    <div style={{
      position: 'relative',
      border: `${def.width}px ${def.style} ${def.color}`,
      boxShadow: def.shadow,
      overflow: 'visible',       // corners protrude outside the box
      ...style,
    }}>
      <Corner size={cornerSize} color={def.color} accent={frame.accentColor} pos="tl"/>
      <Corner size={cornerSize} color={def.color} accent={frame.accentColor} pos="tr"/>
      <Corner size={cornerSize} color={def.color} accent={frame.accentColor} pos="bl"/>
      <Corner size={cornerSize} color={def.color} accent={frame.accentColor} pos="br"/>
      {children}
    </div>
  )
}
