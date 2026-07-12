// ─── Body Art Sub-Components ──────────────────────────────────────────────────
// Each animation is self-contained. BodyArtLayer is the single entry point.
// CSS-based effects for lightweight rendering in chat (many instances).
// Canvas-based for complex particle effects.

import { useEffect, useRef, memo } from 'react'
import type { BodyArt } from '../../lib/chatFrames'

// ── CSS-only effects ─────────────────────────────────────────────────────────

const CSS_SPEED_LINES = `
@keyframes speedLineSweep {
  0%   { transform: translateX(-110%) skewX(-20deg); opacity: 0; }
  10%  { opacity: 0.55; }
  90%  { opacity: 0.35; }
  100% { transform: translateX(110%) skewX(-20deg); opacity: 0; }
}
.frame-speed-lines > span {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: rgba(255,255,255,0.55);
  animation: speedLineSweep 3s linear infinite;
}
`

function SpeedLines() {
  return (
    <>
      <style>{CSS_SPEED_LINES}</style>
      <div className="frame-speed-lines" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {[0,0.4,0.8,1.2,1.6,2.0,2.4].map((d, i) => (
          <span key={i} style={{
            left: `${10 + i * 12}%`,
            animationDelay: `${d}s`,
            width: i % 3 === 0 ? 2 : 1,
            opacity: 0,
          }} />
        ))}
      </div>
    </>
  )
}

const CSS_DATA_GRID = `
@keyframes gridScrollUp {
  from { background-position: 0 0; }
  to   { background-position: 0 -40px; }
}
`

function DataGrid() {
  return (
    <>
      <style>{CSS_DATA_GRID}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: `
          linear-gradient(rgba(0,255,159,0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,159,0.12) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        animation: 'gridScrollUp 4s linear infinite',
      }} />
    </>
  )
}

const CSS_THERMAL = `
@keyframes thermalPulse {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`

function ThermalHeat() {
  return (
    <>
      <style>{CSS_THERMAL}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: 'linear-gradient(135deg, #0a0a2a 0%, #1a0000 20%, #ff2200 45%, #ff8800 65%, #ffee00 85%, #ff2200 100%)',
        backgroundSize: '300% 300%',
        animation: 'thermalPulse 6s ease infinite',
        opacity: 0.18,
      }} />
    </>
  )
}

const CSS_GLITCH = `
@keyframes glitchTear {
  0%, 88%  { clip-path: inset(0 0 100% 0); transform: translateX(0); }
  90%      { clip-path: inset(30% 0 60% 0); transform: translateX(6px); }
  91%      { clip-path: inset(30% 0 60% 0); transform: translateX(0); }
  95%      { clip-path: inset(50% 0 40% 0); transform: translateX(-4px); }
  96%      { clip-path: inset(0 0 100% 0); transform: translateX(0); }
  100%     { clip-path: inset(0 0 100% 0); transform: translateX(0); }
}
@keyframes glitchScanlines {
  0%, 100% { opacity: 0.04; }
  50% { opacity: 0.08; }
}
`

function GlitchTears() {
  return (
    <>
      <style>{CSS_GLITCH}</style>
      {/* scanline texture */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,0,64,0.07) 0px, rgba(255,0,64,0.07) 1px, transparent 1px, transparent 3px)',
        animation: 'glitchScanlines 3s ease infinite',
      }} />
      {/* horizontal tear overlay */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: 'rgba(255,0,64,0.5)',
        animation: 'glitchTear 4s steps(1) infinite',
      }} />
    </>
  )
}

const CSS_LANTERN = `
@keyframes lanternDriftA {
  from { transform: translateX(110%); }
  to   { transform: translateX(-110%); }
}
@keyframes lanternDriftB {
  from { transform: translateX(130%); }
  to   { transform: translateX(-130%); }
}
@keyframes lanternSway {
  0%, 100% { rotate: -4deg; }
  50% { rotate: 4deg; }
}
`

function LanternDrift() {
  const lanterns = [
    { top:'15%', delay:'0s', dur:'12s', layer:'A', scale:1 },
    { top:'55%', delay:'4s', dur:'16s', layer:'A', scale:0.7 },
    { top:'30%', delay:'2s', dur:'20s', layer:'B', scale:0.85 },
    { top:'70%', delay:'7s', dur:'14s', layer:'B', scale:0.6 },
  ]
  return (
    <>
      <style>{CSS_LANTERN}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {lanterns.map((l, i) => (
          <div key={i} style={{
            position:'absolute',
            top: l.top,
            transform: `scale(${l.scale})`,
            animation: `lanternDrift${l.layer} ${l.dur} linear ${l.delay} infinite`,
          }}>
            <svg width="16" height="22" viewBox="0 0 16 22" style={{ animation:'lanternSway 3s ease infinite', display:'block' }}>
              {/* string */}
              <line x1="8" y1="0" x2="8" y2="4" stroke="#FF007F" strokeWidth="1" opacity="0.8"/>
              {/* body */}
              <ellipse cx="8" cy="13" rx="6" ry="8" fill="none" stroke="#FF007F" strokeWidth="1.2" opacity="0.9"/>
              {/* inner glow */}
              <ellipse cx="8" cy="13" rx="4" ry="6" fill="#FF007F" opacity="0.15"/>
              {/* ribs */}
              <line x1="2" y1="10" x2="14" y2="10" stroke="#FF007F" strokeWidth="0.7" opacity="0.5"/>
              <line x1="2" y1="13" x2="14" y2="13" stroke="#FF007F" strokeWidth="0.7" opacity="0.5"/>
              <line x1="2" y1="16" x2="14" y2="16" stroke="#FF007F" strokeWidth="0.7" opacity="0.5"/>
              {/* tassel */}
              <line x1="8" y1="21" x2="8" y2="22" stroke="#FF007F" strokeWidth="1" opacity="0.6"/>
            </svg>
          </div>
        ))}
      </div>
    </>
  )
}

const CSS_CHROME = `
@keyframes chromeShimmer {
  0%   { transform: translateX(-160%) rotate(15deg); opacity: 0; }
  15%  { opacity: 0.18; }
  85%  { opacity: 0.12; }
  100% { transform: translateX(160%) rotate(15deg); opacity: 0; }
}
`

function ChromeShimmer() {
  return (
    <>
      <style>{CSS_CHROME}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{
          position:'absolute',
          top: '-20%', bottom:'-20%',
          left: '0', right:'0',
          background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
          animation: 'chromeShimmer 8s ease-in-out 2s infinite',
        }} />
      </div>
    </>
  )
}

const CSS_AURORA = `
@keyframes auroraDrift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`

function AuroraSovereign() {
  return (
    <>
      <style>{CSS_AURORA}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: 'linear-gradient(90deg, #1a003a 0%, #3a007a 20%, #4B0082 40%, #2a006a 60%, #6020a0 80%, #1a003a 100%)',
        backgroundSize: '300% 100%',
        animation: 'auroraDrift 8s ease infinite',
        opacity: 0.45,
      }} />
    </>
  )
}

// ── Color-parameterized CSS effects (shared across many themed tiers) ────────

function PetalDrift({ accent }: { accent: string }) {
  const css = `
@keyframes petalFall {
  0%   { transform: translateY(-15%) translateX(0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.85; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(130%) translateX(14px) rotate(220deg); opacity: 0; }
}
`
  const petals = [
    { left: '6%',  delay: '0s',   dur: '7s',  size: 8 },
    { left: '20%', delay: '1.4s', dur: '9s',  size: 6 },
    { left: '35%', delay: '0.6s', dur: '8s',  size: 9 },
    { left: '50%', delay: '2.2s', dur: '6.5s',size: 7 },
    { left: '65%', delay: '0.2s', dur: '9.5s',size: 8 },
    { left: '80%', delay: '1.8s', dur: '7.5s',size: 6 },
    { left: '92%', delay: '3s',   dur: '8.5s',size: 7 },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {petals.map((p, i) => (
          <div key={i} style={{
            position:'absolute', top: '-15%', left: p.left,
            width: p.size, height: p.size,
            borderRadius: '0 60% 0 60%',
            background: accent,
            opacity: 0,
            animation: `petalFall ${p.dur} ease-in ${p.delay} infinite`,
          }} />
        ))}
      </div>
    </>
  )
}

function FrostShimmer({ accent }: { accent: string }) {
  const css = `
@keyframes frostShimmerSweep {
  0%   { background-position: -150% 0; }
  100% { background-position: 150% 0; }
}
@keyframes frostTwinkle {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.9; }
}
`
  const crystals = [
    { top:'20%', left:'12%', delay:'0s' }, { top:'55%', left:'30%', delay:'0.6s' },
    { top:'30%', left:'55%', delay:'1.1s' }, { top:'70%', left:'75%', delay:'0.3s' },
    { top:'15%', left:'88%', delay:'1.6s' },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: `linear-gradient(90deg, transparent 30%, ${accent}33 50%, transparent 70%)`,
        backgroundSize: '250% 100%',
        animation: 'frostShimmerSweep 5s ease-in-out infinite',
      }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        {crystals.map((c, i) => (
          <span key={i} style={{
            position:'absolute', top: c.top, left: c.left,
            width: 4, height: 4, borderRadius: '50%',
            background: accent, boxShadow: `0 0 6px ${accent}`,
            animation: `frostTwinkle 2.2s ease-in-out ${c.delay} infinite`,
          }} />
        ))}
      </div>
    </>
  )
}

function CircuitPulse({ accent }: { accent: string }) {
  const css = `
@keyframes circuitFlow {
  0%   { stroke-dashoffset: 120; opacity: 0.3; }
  50%  { opacity: 0.9; }
  100% { stroke-dashoffset: 0; opacity: 0.3; }
}
`
  return (
    <>
      <style>{css}</style>
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0, pointerEvents:'none' }} preserveAspectRatio="none">
        {[0.2, 0.45, 0.7, 0.9].map((y, i) => (
          <polyline key={i}
            points={`0,${y*100}% 15%,${y*100}% 20%,${(y*100)-8}% 45%,${(y*100)-8}% 50%,${y*100}% 100%,${y*100}%`}
            fill="none" stroke={accent} strokeWidth="1"
            strokeDasharray="6 4"
            style={{ animation: `circuitFlow ${3 + i * 0.7}s linear infinite` }}
          />
        ))}
      </svg>
    </>
  )
}

// ── Canvas-based effects ─────────────────────────────────────────────────────

const SmokeParticles = memo(function SmokeParticles({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    type P = { x:number; y:number; r:number; vy:number; vx:number; life:number; maxLife:number }
    const particles: P[] = []
    const spawn = () => particles.push({
      x: W * (0.2 + Math.random() * 0.6),
      y: H,
      r: 4 + Math.random() * 8,
      vy: -(0.3 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 0.4,
      life: 0,
      maxLife: 80 + Math.random() * 60,
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 8 === 0 && particles.length < 12) spawn()
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++; p.x += p.vx; p.y += p.vy; p.r += 0.05
        if (p.life > p.maxLife) { particles.splice(i, 1); continue }
        const alpha = (1 - p.life / p.maxLife) * 0.25
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        grad.addColorStop(0, `rgba(100,30,160,${alpha})`)
        grad.addColorStop(1, `rgba(60,20,100,0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = grad; ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

const VoidStars = memo(function VoidStars() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    const stars = Array.from({ length: 28 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      blink: Math.random() * Math.PI * 2,
    }))
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0
        const alpha = 0.4 + 0.4 * Math.sin(t * 1.5 + s.blink)
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(200,200,255,${alpha})`; ctx.fill()
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

const GoldSparkles = memo(function GoldSparkles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    type Sp = { x:number; y:number; vy:number; vx:number; life:number; maxLife:number; size:number }
    const sparks: Sp[] = []
    const spawn = () => sparks.push({
      x: W * (0.1 + Math.random() * 0.8),
      y: H * (0.6 + Math.random() * 0.4),
      vy: -(0.6 + Math.random() * 1.2),
      vx: (Math.random() - 0.5) * 0.5,
      life: 0, maxLife: 40 + Math.random() * 30,
      size: 1.5 + Math.random() * 2,
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 5 === 0 && sparks.length < 15) spawn()
      sparks.forEach((s, i) => {
        s.life++; s.x += s.vx; s.y += s.vy
        if (s.life > s.maxLife) { sparks.splice(i, 1); return }
        const t = s.life / s.maxLife
        const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.life * 0.2)
        ctx.fillStyle = `rgba(255,210,0,${alpha * 0.9})`
        const sz = s.size * (1 - t * 0.5)
        ctx.fillRect(-sz/2, -sz/2, sz, sz)
        ctx.restore()
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

const CodeRain = memo(function CodeRain() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    const COLS = Math.floor(W / 10)
    const drops: number[] = Array.from({ length: COLS }, () => Math.random() * -20)
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&'
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, W, H)
      ctx.font = '9px monospace'
      drops.forEach((y, i) => {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)]
        const bright = Math.random() > 0.92
        ctx.fillStyle = bright ? 'rgba(200,255,200,0.9)' : 'rgba(0,80,0,0.8)'
        ctx.fillText(ch, i * 10 + 1, y * 10)
        if (y * 10 > H && Math.random() > 0.975) drops[i] = 0
        drops[i] += 0.4
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

const NovaBurst = memo(function NovaBurst() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    const CX = W / 2, CY = H / 2
    let phase = 0 // 0..1 burst cycle
    const CYCLE = 240 // frames (~4s at 60fps)
    type Pt = { angle:number; speed:number; life:number }
    let burst: Pt[] = []
    const spawnBurst = () => {
      burst = Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * Math.PI * 2 + Math.random() * 0.3,
        speed: 0.8 + Math.random() * 1.2,
        life: 0,
      }))
    }
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      frame++
      if (frame % CYCLE === 0) spawnBurst()
      const t = (frame % CYCLE) / CYCLE

      // Afterglow rings between bursts
      if (burst.length === 0 || t > 0.3) {
        const ringAlpha = Math.max(0, 0.06 - (t - 0.3) * 0.2)
        for (let r = 15; r < Math.min(W, H) * 0.8; r += 18) {
          ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,45,107,${ringAlpha})`; ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      burst.forEach(p => {
        p.life++
        const dist = p.speed * p.life
        const x = CX + Math.cos(p.angle) * dist
        const y = CY + Math.sin(p.angle) * dist
        const alpha = Math.max(0, 1 - p.life / 48)
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = Math.random() > 0.5
          ? `rgba(255,45,107,${alpha})`
          : `rgba(255,200,220,${alpha})`
        ctx.fill()
      })
      burst = burst.filter(p => p.life < 48)
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ─── BodyArtLayer ─────────────────────────────────────────────────────────────

interface BodyArtLayerProps {
  bodyArt: BodyArt
  accentColor: string
}

export function BodyArtLayer({ bodyArt, accentColor }: BodyArtLayerProps) {
  switch (bodyArt) {
    case 'speed-lines':     return <SpeedLines />
    case 'data-grid':       return <DataGrid />
    case 'smoke-particles': return <SmokeParticles accent={accentColor} />
    case 'thermal-heat':    return <ThermalHeat />
    case 'glitch-tears':    return <GlitchTears />
    case 'lantern-drift':   return <LanternDrift />
    case 'chrome-shimmer':  return <ChromeShimmer />
    case 'void-stars':      return <VoidStars />
    case 'gold-sparkles':   return <GoldSparkles />
    case 'code-rain':       return <CodeRain />
    case 'nova-burst':      return <NovaBurst />
    case 'aurora-sovereign':return <AuroraSovereign />
    case 'petal-drift':     return <PetalDrift accent={accentColor} />
    case 'frost-shimmer':   return <FrostShimmer accent={accentColor} />
    case 'circuit-pulse':   return <CircuitPulse accent={accentColor} />
    default:                return null
  }
}
