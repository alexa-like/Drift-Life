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

// ── Paw Drift (CyberKitty) ────────────────────────────────────────────────────

function PawDrift({ accent }: { accent: string }) {
  const css = `
@keyframes pawDrift {
  0%   { transform: translateX(110%) translateY(0px) rotate(-15deg); opacity: 0; }
  8%   { opacity: 0.75; }
  92%  { opacity: 0.55; }
  100% { transform: translateX(-110%) translateY(6px) rotate(-15deg); opacity: 0; }
}
`
  const paws = [
    { top: '12%', delay: '0s',   dur: '10s',  scale: 0.9 },
    { top: '48%', delay: '3.5s', dur: '13s',  scale: 0.65 },
    { top: '68%', delay: '1s',   dur: '11.5s',scale: 0.75 },
    { top: '28%', delay: '5.5s', dur: '9.5s', scale: 0.55 },
    { top: '78%', delay: '7.2s', dur: '14s',  scale: 0.8 },
    { top: '55%', delay: '2.4s', dur: '12s',  scale: 0.6 },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {paws.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: p.top,
            right: '-8%',
            transform: `scale(${p.scale})`,
            animation: `pawDrift ${p.dur} linear ${p.delay} infinite`,
          }}>
            <svg width="22" height="20" viewBox="0 0 22 20" fill={accent} opacity="0.85">
              {/* Main pad */}
              <ellipse cx="11" cy="15" rx="5.5" ry="4" />
              {/* Four toes */}
              <ellipse cx="3.5"  cy="8.5" rx="2.4" ry="2.8" />
              <ellipse cx="8.2"  cy="5.5" rx="2.3" ry="2.7" />
              <ellipse cx="13.8" cy="5.5" rx="2.3" ry="2.7" />
              <ellipse cx="18.5" cy="8.5" rx="2.4" ry="2.8" />
            </svg>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Snowflake Field (CyberFrost) ──────────────────────────────────────────────

function SnowflakeField({ accent }: { accent: string }) {
  const css = `
@keyframes snowFall {
  0%   { transform: translateY(-24px) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.88; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(120%) rotate(180deg); opacity: 0; }
}
@keyframes snowSway {
  0%, 100% { transform: translateX(0); }
  33%       { transform: translateX(6px); }
  66%       { transform: translateX(-4px); }
}
`
  const flakes = [
    { left: '4%',  delay: '0s',   dur: '9s',  size: 16 },
    { left: '14%', delay: '2.2s', dur: '12s', size: 10 },
    { left: '27%', delay: '0.5s', dur: '10s', size: 20 },
    { left: '40%', delay: '3.5s', dur: '11s', size: 12 },
    { left: '54%', delay: '1.2s', dur: '9.5s',size: 18 },
    { left: '67%', delay: '4.2s', dur: '13s', size: 10 },
    { left: '78%', delay: '1.8s', dur: '10.5s',size:14 },
    { left: '90%', delay: '5.5s', dur: '11.5s',size:12 },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {flakes.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '-24px',
            left: f.left,
            animation: `snowFall ${f.dur} linear ${f.delay} infinite`,
          }}>
            <div style={{ animation: `snowSway ${f.dur} ease-in-out ${f.delay} infinite` }}>
              <svg width={f.size} height={f.size} viewBox="0 0 24 24" opacity="0.82">
                <line x1="12" y1="1"  x2="12" y2="23" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="23" y2="12" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="4.5" y1="4.5"  x2="19.5" y2="19.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="19.5" y1="4.5" x2="4.5" y2="19.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
                {/* arm tips */}
                <line x1="12" y1="1"  x2="9"  y2="4"  stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="12" y1="1"  x2="15" y2="4"  stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="12" y1="23" x2="9"  y2="20" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="12" y1="23" x2="15" y2="20" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="4"  y2="9"  stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="4"  y2="15" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="23" y1="12" x2="20" y2="9"  stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="23" y1="12" x2="20" y2="15" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="2.5" fill={accent}/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Christmas Spirits (CyberSanta) ────────────────────────────────────────────

function ChristmasSpirits() {
  const css = `
@keyframes xmasRise {
  0%   { transform: translateY(0) rotate(-3deg); opacity: 0; }
  8%   { opacity: 0.85; }
  92%  { opacity: 0.65; }
  100% { transform: translateY(-140%) rotate(3deg); opacity: 0; }
}
@keyframes xmasSway {
  0%, 100% { transform: translateX(0); }
  50%       { transform: translateX(5px); }
}
`
  type XmasItem = { type: 'tree' | 'flake' | 'candy'; left: string; delay: string; dur: string; size: number }
  const items: XmasItem[] = [
    { type: 'tree',  left: '4%',  delay: '0s',   dur: '12s', size: 18 },
    { type: 'flake', left: '16%', delay: '2s',   dur: '9s',  size: 14 },
    { type: 'candy', left: '29%', delay: '0.8s', dur: '13s', size: 15 },
    { type: 'tree',  left: '44%', delay: '3.5s', dur: '11s', size: 14 },
    { type: 'flake', left: '58%', delay: '1.4s', dur: '10s', size: 16 },
    { type: 'candy', left: '72%', delay: '4s',   dur: '12.5s',size:14 },
    { type: 'tree',  left: '86%', delay: '0.4s', dur: '14s', size: 12 },
  ]
  const renderItem = (type: XmasItem['type'], size: number) => {
    const s = size
    if (type === 'tree') return (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <polygon points="12,2 19,16 5,16" fill="#2d8c2d" stroke="#39ff14" strokeWidth="0.8"/>
        <polygon points="12,8 17,19 7,19" fill="#1a5e1a" stroke="#39ff14" strokeWidth="0.8"/>
        <rect x="10" y="19" width="4" height="3" fill="#8B4513"/>
        <circle cx="9"  cy="11" r="1.2" fill="#FFD700"/>
        <circle cx="15" cy="13" r="1.2" fill="#FF4444"/>
        <circle cx="12" cy="15" r="1.2" fill="#FFD700"/>
      </svg>
    )
    if (type === 'flake') return (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <line x1="12" y1="2"  x2="12" y2="22" stroke="#AADDFF" strokeWidth="2" strokeLinecap="round"/>
        <line x1="2"  y1="12" x2="22" y2="12" stroke="#AADDFF" strokeWidth="2" strokeLinecap="round"/>
        <line x1="5"  y1="5"  x2="19" y2="19" stroke="#AADDFF" strokeWidth="2" strokeLinecap="round"/>
        <line x1="19" y1="5"  x2="5"  y2="19" stroke="#AADDFF" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="2" fill="#FFFFFF"/>
      </svg>
    )
    // candy cane
    return (
      <svg width={s * 0.7} height={s} viewBox="0 0 16 24">
        <path d="M8 2 Q14 2 14 8 Q14 14 8 14 L8 22" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round"/>
        <path d="M8 2 Q14 2 14 8 Q14 14 8 14 L8 22" fill="none" stroke="#C41E3A"
          strokeWidth="4" strokeLinecap="round" strokeDasharray="4 4" strokeDashoffset="0"/>
      </svg>
    )
  }
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: '-10%',
            left: item.left,
            animation: `xmasRise ${item.dur} ease-in-out ${item.delay} infinite`,
          }}>
            <div style={{ animation: `xmasSway ${item.dur} ease-in-out ${item.delay} infinite` }}>
              {renderItem(item.type, item.size)}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Ember Sparks (CyberDragon) ────────────────────────────────────────────────

const EmberSparks = memo(function EmberSparks() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    type Ember = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; size:number; hue:number }
    const embers: Ember[] = []
    const spawn = () => embers.push({
      x: W * (0.05 + Math.random() * 0.9),
      y: H * (0.5 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 1.0,
      vy: -(0.6 + Math.random() * 1.8),
      life: 0, maxLife: 45 + Math.random() * 45,
      size: 1.4 + Math.random() * 2.8,
      hue: 10 + Math.random() * 40,   // 10–50 = red-orange-yellow
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 3 === 0 && embers.length < 22) spawn()
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.life++; e.x += e.vx; e.y += e.vy
        e.vx *= 0.98
        if (e.life > e.maxLife) { embers.splice(i, 1); continue }
        const t = e.life / e.maxLife
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        const size = e.size * (1 - t * 0.4)
        // outer glow
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, size * 3)
        grad.addColorStop(0, `hsla(${e.hue},100%,65%,${alpha * 0.7})`)
        grad.addColorStop(1, `hsla(${e.hue},100%,30%,0)`)
        ctx.beginPath(); ctx.arc(e.x, e.y, size * 3, 0, Math.PI * 2)
        ctx.fillStyle = grad; ctx.fill()
        // bright core
        ctx.beginPath(); ctx.arc(e.x, e.y, size * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${e.hue + 30},100%,90%,${alpha})`; ctx.fill()
      }
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
    case 'speed-lines':       return <SpeedLines />
    case 'data-grid':         return <DataGrid />
    case 'smoke-particles':   return <SmokeParticles accent={accentColor} />
    case 'thermal-heat':      return <ThermalHeat />
    case 'glitch-tears':      return <GlitchTears />
    case 'lantern-drift':     return <LanternDrift />
    case 'chrome-shimmer':    return <ChromeShimmer />
    case 'void-stars':        return <VoidStars />
    case 'gold-sparkles':     return <GoldSparkles />
    case 'code-rain':         return <CodeRain />
    case 'nova-burst':        return <NovaBurst />
    case 'aurora-sovereign':  return <AuroraSovereign />
    case 'petal-drift':       return <PetalDrift accent={accentColor} />
    case 'frost-shimmer':     return <FrostShimmer accent={accentColor} />
    case 'circuit-pulse':     return <CircuitPulse accent={accentColor} />
    case 'paw-drift':         return <PawDrift accent={accentColor} />
    case 'snowflake-field':   return <SnowflakeField accent={accentColor} />
    case 'christmas-spirits': return <ChristmasSpirits />
    case 'ember-sparks':      return <EmberSparks />
    default:                  return null
  }
}
