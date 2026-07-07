// ─── Frame Logo Components ────────────────────────────────────────────────────
// Each frame has a unique SVG logo. GlitchLogo wraps any logo with the
// 3-layer glitch animation. Fires every ~6s, 0.3s duration.

import { useEffect, useRef, useState } from 'react'
import type { Frame } from '../../lib/chatFrames'

// ── Individual Logo SVGs ──────────────────────────────────────────────────────

export function NeonDriftLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Stylised D letterform with motion blur streaks */}
      <rect x="8" y="6" width="4" height="28" fill={color} rx="1"/>
      <path d="M12 6 Q32 6 32 20 Q32 34 12 34Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round"/>
      {/* motion blur lines */}
      <line x1="6" y1="14" x2="2" y2="14" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <line x1="6" y1="20" x2="1" y2="20" stroke={color} strokeWidth="1" opacity="0.4"/>
      <line x1="6" y1="26" x2="3" y2="26" stroke={color} strokeWidth="1.5" opacity="0.5"/>
    </svg>
  )
}

export function GridStaticLogo({ color }: { color: string }) {
  // Circuit-node cluster: circles connected by short lines
  const nodes = [ [20,8],[8,20],[32,20],[20,32],[14,14],[26,14],[14,26],[26,26] ]
  const edges = [ [0,4],[0,5],[4,1],[5,2],[1,6],[2,7],[6,3],[7,3],[4,6],[5,7] ]
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {edges.map(([a,b], i) => (
        <line key={i}
          x1={nodes[a][0]} y1={nodes[a][1]}
          x2={nodes[b][0]} y2={nodes[b][1]}
          stroke={color} strokeWidth="1" opacity="0.6"
        />
      ))}
      {nodes.map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 3.5 : 2.5} fill={color} opacity={i === 0 ? 1 : 0.8}/>
      ))}
    </svg>
  )
}

export function StreetPhantomLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Minimalist ghost outline */}
      <path d="M20 4 C12 4 8 10 8 18 L8 34 L12 30 L16 34 L20 30 L24 34 L28 30 L32 34 L32 18 C32 10 28 4 20 4Z"
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="15" cy="18" r="2.5" fill={color} opacity="0.8"/>
      <circle cx="25" cy="18" r="2.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

export function UrbanHeatLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* City skyline silhouette */}
      <rect x="2" y="28" width="36" height="2" fill={color} opacity="0.4"/>
      <rect x="4" y="20" width="4" height="10" fill={color}/>
      <rect x="10" y="14" width="5" height="16" fill={color}/>
      <rect x="17" y="10" width="6" height="20" fill={color}/>
      <rect x="18" y="8" width="2" height="4" fill={color} opacity="0.7"/>
      <rect x="25" y="16" width="4" height="14" fill={color}/>
      <rect x="31" y="22" width="5" height="8" fill={color}/>
    </svg>
  )
}

export function SignalBreachLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Broken lock */}
      <rect x="12" y="20" width="16" height="14" rx="2" fill="none" stroke={color} strokeWidth="2"/>
      {/* shackle — broken on right */}
      <path d="M15 20 L15 14 Q15 8 20 8 Q25 8 25 14 L25 18" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      {/* crack through body */}
      <path d="M20 24 L18 28 L22 30 L20 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
      {/* keyhole */}
      <circle cx="20" cy="28" r="2" fill="none" stroke={color} strokeWidth="1.2"/>
    </svg>
  )
}

export function NightMarketLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Round lantern */}
      <line x1="20" y1="2" x2="20" y2="10" stroke={color} strokeWidth="1.5"/>
      <ellipse cx="20" cy="24" rx="10" ry="14" fill="none" stroke={color} strokeWidth="2"/>
      <ellipse cx="20" cy="24" rx="7" ry="10" fill={color} opacity="0.1"/>
      <line x1="10" y1="18" x2="30" y2="18" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="10" y1="24" x2="30" y2="24" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="10" y1="30" x2="30" y2="30" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="20" y1="38" x2="20" y2="40" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}

export function ChromeEdgeLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Hexagonal shield/badge */}
      <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12Z" fill="none" stroke={color} strokeWidth="2"/>
      {/* inner hex */}
      <path d="M20 10 L29 15 L29 25 L20 30 L11 25 L11 15Z" fill={color} opacity="0.15" stroke={color} strokeWidth="1" />
      {/* shine line */}
      <line x1="8" y1="14" x2="14" y2="10" stroke="white" strokeWidth="1" opacity="0.5"/>
    </svg>
  )
}

export function VoidSignalLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Oscillating waveform */}
      <path d="M2 20 L7 20 L10 10 L13 30 L16 14 L19 26 L22 16 L25 24 L28 20 L33 20 L38 20"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* signal dots */}
      <circle cx="2" cy="20" r="2" fill={color} opacity="0.7"/>
      <circle cx="38" cy="20" r="2" fill={color} opacity="0.7"/>
    </svg>
  )
}

export function ApexLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* 3-point crown */}
      <path d="M4 32 L4 20 L12 26 L20 8 L28 26 L36 20 L36 32Z"
        fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="4" y="32" width="32" height="3" rx="1.5" fill={color}/>
      {/* gems */}
      <circle cx="20" cy="16" r="2.5" fill={color}/>
      <circle cx="12" cy="26" r="1.5" fill={color} opacity="0.8"/>
      <circle cx="28" cy="26" r="1.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

export function BlackoutProtocolLogo({ color }: { color: string }) {
  // [CLASSIFIED] text block — no icon, just the text
  return (
    <svg width="80" height="30" viewBox="0 0 80 30">
      <rect x="1" y="1" width="78" height="28" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <text x="40" y="19" textAnchor="middle" fill={color} fontFamily="monospace" fontSize="10" fontWeight="bold">[ CLASSIFIED ]</text>
    </svg>
  )
}

export function NovaCircuitLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Starburst / explosion */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const x1 = 20 + 6 * Math.cos(angle), y1 = 20 + 6 * Math.sin(angle)
        const x2 = 20 + 17 * Math.cos(angle), y2 = 20 + 17 * Math.sin(angle)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
        const x1 = 20 + 4 * Math.cos(angle), y1 = 20 + 4 * Math.sin(angle)
        const x2 = 20 + 11 * Math.cos(angle), y2 = 20 + 11 * Math.sin(angle)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      })}
      <circle cx="20" cy="20" r="4" fill={color}/>
    </svg>
  )
}

export function SovereignLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Ornate 5-point crown with gem details */}
      <path d="M4 32 L4 20 L10 25 L14 12 L20 8 L26 12 L30 25 L36 20 L36 32Z"
        fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
      <rect x="4" y="32" width="32" height="3" rx="1.5" fill={color}/>
      {/* center gem */}
      <path d="M20 10 L22 14 L20 16 L18 14Z" fill={color}/>
      {/* side gems */}
      <path d="M14 14 L16 17 L14 19 L12 17Z" fill={color} opacity="0.7"/>
      <path d="M26 14 L28 17 L26 19 L24 17Z" fill={color} opacity="0.7"/>
      {/* outer tips */}
      <circle cx="7" cy="21" r="1.5" fill={color} opacity="0.5"/>
      <circle cx="33" cy="21" r="1.5" fill={color} opacity="0.5"/>
    </svg>
  )
}

// ─── Subscriber-exclusive Logos ───────────────────────────────────────────────

export function StreetRunnerLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Speedometer arc */}
      <path d="M6 28 A16 16 0 0 1 34 28" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      {/* Needle */}
      <line x1="20" y1="28" x2="30" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="28" r="2.5" fill={color}/>
      {/* Speed tick marks */}
      {[0, 30, 60, 90, 120, 150, 180].map((deg, i) => {
        const rad = (deg - 180) * Math.PI / 180
        const r1 = 14, r2 = i % 3 === 0 ? 11 : 12.5
        const x1 = 20 + r1 * Math.cos(rad), y1 = 28 + r1 * Math.sin(rad)
        const x2 = 20 + r2 * Math.cos(rad), y2 = 28 + r2 * Math.sin(rad)
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={i % 3 === 0 ? 1.5 : 1} opacity="0.7"/>
      })}
      {/* Motion lines */}
      <line x1="2" y1="32" x2="8" y2="32" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <line x1="2" y1="28" x2="6" y2="28" stroke={color} strokeWidth="1" opacity="0.4"/>
    </svg>
  )
}

export function NeonSyndicateLogo({ color }: { color: string }) {
  // Hexagonal syndicate ring with inner network
  const hex = (cx: number, cy: number, r: number, from: number, to: number) => {
    const pts = []
    for (let i = from; i <= to; i++) {
      const a = (i * 60 - 90) * Math.PI / 180
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
    }
    return pts.join(' ')
  }
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Outer hex ring */}
      <polygon points={hex(20, 20, 17, 0, 5) + ' ' + hex(20, 20, 17, 0, 0)} fill="none" stroke={color} strokeWidth="2" opacity="0.9"/>
      {/* Inner hex */}
      <polygon points={hex(20, 20, 9, 0, 5) + ' ' + hex(20, 20, 9, 0, 0)} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6"/>
      {/* Spokes */}
      {[0,1,2,3,4,5].map(i => {
        const a = (i * 60 - 90) * Math.PI / 180
        return <line key={i}
          x1={20 + 9 * Math.cos(a)} y1={20 + 9 * Math.sin(a)}
          x2={20 + 17 * Math.cos(a)} y2={20 + 17 * Math.sin(a)}
          stroke={color} strokeWidth="1" opacity="0.5"/>
      })}
      <circle cx="20" cy="20" r="3" fill={color}/>
    </svg>
  )
}

export function ApexSovereignLogo({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {/* Crown */}
      <path d="M6 30 L6 24 L12 14 L20 20 L28 14 L34 24 L34 30 Z"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round"/>
      {/* Crown peaks */}
      <circle cx="12" cy="14" r="2" fill={color}/>
      <circle cx="20" cy="9" r="2.5" fill={color}/>
      <circle cx="28" cy="14" r="2" fill={color}/>
      {/* Base gems */}
      <rect x="10" y="27" width="4" height="4" rx="1" fill={color} opacity="0.8"/>
      <rect x="18" y="27" width="4" height="4" rx="1" fill={color} opacity="0.9"/>
      <rect x="26" y="27" width="4" height="4" rx="1" fill={color} opacity="0.8"/>
      {/* Center diamond */}
      <path d="M20 17 L22.5 20 L20 23 L17.5 20 Z" fill={color} opacity="0.9"/>
    </svg>
  )
}

// ─── Logo Map ─────────────────────────────────────────────────────────────────

const LOGOS: Record<string, React.FC<{ color: string }>> = {
  NeonDriftLogo:        NeonDriftLogo,
  GridStaticLogo:       GridStaticLogo,
  StreetPhantomLogo:    StreetPhantomLogo,
  UrbanHeatLogo:        UrbanHeatLogo,
  SignalBreachLogo:     SignalBreachLogo,
  NightMarketLogo:      NightMarketLogo,
  ChromeEdgeLogo:       ChromeEdgeLogo,
  VoidSignalLogo:       VoidSignalLogo,
  ApexLogo:             ApexLogo,
  BlackoutProtocolLogo: BlackoutProtocolLogo,
  NovaCircuitLogo:      NovaCircuitLogo,
  SovereignLogo:        SovereignLogo,
  // Subscriber-exclusive
  StreetRunnerLogo:     StreetRunnerLogo,
  NeonSyndicateLogo:    NeonSyndicateLogo,
  ApexSovereignLogo:    ApexSovereignLogo,
}

// ─── Glitch Animation ─────────────────────────────────────────────────────────

const GLITCH_CSS = `
@keyframes glitchMain {
  0%,100% { opacity:1; }
  50% { opacity:0.8; }
}
@keyframes glitchFlicker {
  0%,100% { opacity:0; }
  10%,30%,50%,70%,90% { opacity:0.7; }
  20%,40%,60%,80% { opacity:0; }
}
@keyframes spinSlow { from { rotate: 0deg; } to { rotate: 360deg; } }
@keyframes floatUpDown {
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
}
`

interface GlitchLogoProps {
  frame: Frame
  size?: number
}

export function GlitchLogo({ frame, size = 40 }: GlitchLogoProps) {
  const Logo = LOGOS[frame.logoComponent]
  const [glitching, setGlitching] = useState(false)
  const isLegendary = frame.rarity === 'legendary'

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true)
      setTimeout(() => setGlitching(false), 300)
    }, 5000 + Math.random() * 3000)
    return () => clearInterval(interval)
  }, [])

  if (!Logo) return null

  const floatStyle = isLegendary
    ? { animation: 'floatUpDown 3s ease-in-out infinite' } as React.CSSProperties
    : {}

  return (
    <>
      <style>{GLITCH_CSS}</style>
      <div style={{ position: 'relative', display: 'inline-block', width: size, height: size, ...floatStyle }}>
        {/* ghost left */}
        <div style={{
          position: 'absolute', inset: 0, opacity: glitching ? 0.6 : 0,
          transform: 'translateX(-4px)',
          transition: 'opacity 0.05s',
          filter: 'brightness(10)',
        }}>
          <Logo color="#ffffff" />
        </div>
        {/* main */}
        <div style={{ position: 'absolute', inset: 0, filter: glitching && isLegendary ? 'saturate(0)' : 'none', transition: 'filter 0.1s' }}>
          <Logo color={frame.accentColor} />
        </div>
        {/* ghost right */}
        <div style={{
          position: 'absolute', inset: 0, opacity: glitching ? 0.4 : 0,
          transform: 'translateX(4px)',
          transition: 'opacity 0.05s',
        }}>
          <Logo color={frame.accentColor} />
        </div>
      </div>
    </>
  )
}

export function getLogoComponent(name: string): React.FC<{ color: string }> | null {
  return LOGOS[name] ?? null
}
