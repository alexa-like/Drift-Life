// ─── Body Art Sub-Components ──────────────────────────────────────────────────
// Each animation is self-contained. BodyArtLayer is the single entry point.
// CSS-based effects for lightweight rendering in chat (many instances).
// Canvas-based for complex particle effects.
// ALL opacity values are intentionally high so art shows through the frame overlay.

import { useEffect, useRef, memo } from 'react'
import type { BodyArt } from '../../lib/chatFrames'

// ── Speed Lines ───────────────────────────────────────────────────────────────

const CSS_SPEED_LINES = `
@keyframes speedLineSweep {
  0%   { transform: translateX(-110%) skewX(-22deg); opacity: 0; }
  8%   { opacity: 0.9; }
  92%  { opacity: 0.65; }
  100% { transform: translateX(110%) skewX(-22deg); opacity: 0; }
}
.frame-speed-lines > span {
  position: absolute;
  top: 0; bottom: 0;
  background: rgba(255,255,255,0.7);
  animation: speedLineSweep 2.4s linear infinite;
}
`
function SpeedLines() {
  return (
    <>
      <style>{CSS_SPEED_LINES}</style>
      <div className="frame-speed-lines" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {[0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((d, i) => (
          <span key={i} style={{
            left: `${5 + i * 11}%`,
            animationDelay: `${d}s`,
            width: i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1,
            opacity: 0,
          }} />
        ))}
      </div>
    </>
  )
}

// ── Data Grid ─────────────────────────────────────────────────────────────────

const CSS_DATA_GRID = `
@keyframes gridScrollUp {
  from { background-position: 0 0; }
  to   { background-position: 0 -40px; }
}
@keyframes gridPulse {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 0.85; }
}
`
function DataGrid() {
  return (
    <>
      <style>{CSS_DATA_GRID}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: `
          linear-gradient(rgba(0,255,159,0.35) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,159,0.25) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        animation: 'gridScrollUp 3s linear infinite, gridPulse 4s ease infinite',
      }} />
    </>
  )
}

// ── Thermal Heat ──────────────────────────────────────────────────────────────

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
        background: 'linear-gradient(135deg, #0a0000 0%, #1a0000 15%, #cc1100 35%, #ff5500 55%, #ffcc00 75%, #ff2200 90%, #0a0000 100%)',
        backgroundSize: '300% 300%',
        animation: 'thermalPulse 5s ease infinite',
        opacity: 0.55,
      }} />
    </>
  )
}

// ── Glitch Tears ──────────────────────────────────────────────────────────────

const CSS_GLITCH = `
@keyframes glitchTear {
  0%, 82%  { clip-path: inset(0 0 100% 0); transform: translateX(0); }
  84%      { clip-path: inset(20% 0 65% 0); transform: translateX(8px); opacity: 0.9; }
  86%      { clip-path: inset(20% 0 65% 0); transform: translateX(-4px); }
  90%      { clip-path: inset(55% 0 35% 0); transform: translateX(-6px); }
  92%      { clip-path: inset(0 0 100% 0); transform: translateX(0); }
  100%     { clip-path: inset(0 0 100% 0); transform: translateX(0); }
}
@keyframes glitchScanlines {
  0%, 100% { opacity: 0.20; }
  50%      { opacity: 0.35; }
}
`
function GlitchTears({ accent = '#FF0040' }: { accent?: string }) {
  return (
    <>
      <style>{CSS_GLITCH}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: `repeating-linear-gradient(0deg, ${accent}28 0px, ${accent}28 1px, transparent 1px, transparent 3px)`,
        animation: 'glitchScanlines 2.5s ease infinite',
      }} />
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: accent,
        opacity: 0.6,
        animation: 'glitchTear 3.5s steps(1) infinite',
      }} />
    </>
  )
}

// ── Lantern Drift ─────────────────────────────────────────────────────────────

const CSS_LANTERN = `
@keyframes lanternDriftA { from { transform: translateX(120%); } to { transform: translateX(-120%); } }
@keyframes lanternDriftB { from { transform: translateX(140%); } to { transform: translateX(-140%); } }
@keyframes lanternSway { 0%, 100% { rotate: -6deg; } 50% { rotate: 6deg; } }
@keyframes lanternGlow { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
`
function LanternDrift() {
  const lanterns = [
    { top:'12%', delay:'0s',  dur:'10s', layer:'A', scale:1.1 },
    { top:'52%', delay:'3.5s',dur:'14s', layer:'A', scale:0.75 },
    { top:'28%', delay:'1.5s',dur:'18s', layer:'B', scale:0.9 },
    { top:'68%', delay:'6s',  dur:'12s', layer:'B', scale:0.65 },
    { top:'42%', delay:'8s',  dur:'11s', layer:'A', scale:0.8 },
  ]
  return (
    <>
      <style>{CSS_LANTERN}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {lanterns.map((l, i) => (
          <div key={i} style={{
            position:'absolute', top: l.top,
            transform: `scale(${l.scale})`,
            animation: `lanternDrift${l.layer} ${l.dur} linear ${l.delay} infinite`,
          }}>
            <svg width="18" height="26" viewBox="0 0 18 26" style={{ animation:'lanternSway 3s ease infinite, lanternGlow 2s ease infinite', display:'block' }}>
              <line x1="9" y1="0" x2="9" y2="5" stroke="#FF007F" strokeWidth="1.5" opacity="0.9"/>
              <ellipse cx="9" cy="15" rx="7" ry="9" fill="none" stroke="#FF007F" strokeWidth="1.5" opacity="0.95"/>
              <ellipse cx="9" cy="15" rx="4.5" ry="6.5" fill="#FF007F" opacity="0.25"/>
              <line x1="2" y1="11" x2="16" y2="11" stroke="#FF007F" strokeWidth="0.8" opacity="0.7"/>
              <line x1="2" y1="15" x2="16" y2="15" stroke="#FF007F" strokeWidth="0.8" opacity="0.7"/>
              <line x1="2" y1="19" x2="16" y2="19" stroke="#FF007F" strokeWidth="0.8" opacity="0.7"/>
              <line x1="9" y1="24" x2="9" y2="26" stroke="#FF007F" strokeWidth="1.2" opacity="0.7"/>
            </svg>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Chrome Shimmer ────────────────────────────────────────────────────────────

const CSS_CHROME = `
@keyframes chromeShimmer {
  0%   { transform: translateX(-170%) rotate(15deg); opacity: 0; }
  15%  { opacity: 0.5; }
  85%  { opacity: 0.35; }
  100% { transform: translateX(170%) rotate(15deg); opacity: 0; }
}
@keyframes chromePulse {
  0%, 100% { opacity: 0.15; }
  50%       { opacity: 0.30; }
}
`
function ChromeShimmer() {
  return (
    <>
      <style>{CSS_CHROME}</style>
      {/* base metallic texture */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: 'repeating-linear-gradient(70deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 5px)',
        animation: 'chromePulse 3s ease infinite',
      }} />
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{
          position:'absolute', top:'-20%', bottom:'-20%', left:'0', right:'0',
          background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.5) 50%, transparent 80%)',
          animation: 'chromeShimmer 6s ease-in-out 1s infinite',
        }} />
      </div>
    </>
  )
}

// ── Void Stars ────────────────────────────────────────────────────────────────

const VoidStars = memo(function VoidStars({ accent = '#4040FF' }: { accent?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    // parse accent hex to rgb
    const r = parseInt(accent.slice(1,3),16), g = parseInt(accent.slice(3,5),16), b = parseInt(accent.slice(5,7),16)
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
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
        const alpha = 0.55 + 0.45 * Math.sin(t * 1.5 + s.blink)
        // glow
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4)
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.8})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI*2)
        ctx.fillStyle = grad; ctx.fill()
        // core
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(220,230,255,${alpha})`; ctx.fill()
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [accent])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Aurora Sovereign ──────────────────────────────────────────────────────────

const CSS_AURORA = `
@keyframes auroraDrift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes auroraShift {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 0.95; }
}
`
function AuroraSovereign() {
  return (
    <>
      <style>{CSS_AURORA}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: 'linear-gradient(90deg, #1a003a 0%, #4a00aa 20%, #6010c0 40%, #3000a0 60%, #7020d0 80%, #1a003a 100%)',
        backgroundSize: '300% 100%',
        animation: 'auroraDrift 7s ease infinite, auroraShift 4s ease infinite',
      }} />
    </>
  )
}

// ── Smoke Particles ───────────────────────────────────────────────────────────

const SmokeParticles = memo(function SmokeParticles({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    type P = { x:number; y:number; r:number; vy:number; vx:number; life:number; maxLife:number }
    const particles: P[] = []
    const spawn = () => particles.push({
      x: W * (0.1 + Math.random() * 0.8), y: H,
      r: 6 + Math.random() * 14,
      vy: -(0.4 + Math.random() * 0.7),
      vx: (Math.random() - 0.5) * 0.5,
      life: 0, maxLife: 70 + Math.random() * 50,
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 6 === 0 && particles.length < 16) spawn()
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++; p.x += p.vx; p.y += p.vy; p.r += 0.08
        if (p.life > p.maxLife) { particles.splice(i, 1); continue }
        const alpha = (1 - p.life / p.maxLife) * 0.55
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        grad.addColorStop(0, `rgba(120,40,200,${alpha})`)
        grad.addColorStop(0.5, `rgba(80,20,150,${alpha * 0.6})`)
        grad.addColorStop(1, `rgba(50,10,100,0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = grad; ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Gold Sparkles ─────────────────────────────────────────────────────────────

const GoldSparkles = memo(function GoldSparkles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    type Sp = { x:number; y:number; vy:number; vx:number; life:number; maxLife:number; size:number; type:'star'|'square' }
    const sparks: Sp[] = []
    const spawn = () => sparks.push({
      x: W * (0.05 + Math.random() * 0.9),
      y: H * (0.5 + Math.random() * 0.5),
      vy: -(0.8 + Math.random() * 1.8),
      vx: (Math.random() - 0.5) * 0.8,
      life: 0, maxLife: 35 + Math.random() * 35,
      size: 2 + Math.random() * 3,
      type: Math.random() > 0.5 ? 'star' : 'square',
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 3 === 0 && sparks.length < 22) spawn()
      sparks.forEach((s, i) => {
        s.life++; s.x += s.vx; s.y += s.vy
        if (s.life > s.maxLife) { sparks.splice(i, 1); return }
        const t = s.life / s.maxLife
        const alpha = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75
        const sz = s.size * (1 - t * 0.4)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(s.x, s.y)
        ctx.rotate(s.life * 0.25)
        // glow
        ctx.shadowColor = '#FFD700'
        ctx.shadowBlur = sz * 4
        ctx.fillStyle = t < 0.3 ? '#FFFFFF' : '#FFD700'
        if (s.type === 'square') {
          ctx.fillRect(-sz/2, -sz/2, sz, sz)
        } else {
          // 4-point star
          ctx.beginPath()
          for (let p = 0; p < 8; p++) {
            const angle = (p * Math.PI) / 4
            const r = p % 2 === 0 ? sz : sz * 0.4
            p === 0 ? ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r) : ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r)
          }
          ctx.closePath(); ctx.fill()
        }
        ctx.restore()
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Code Rain ─────────────────────────────────────────────────────────────────

const CodeRain = memo(function CodeRain({ accent = '#00FF9F' }: { accent?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    const COLS = Math.floor(W / 9)
    const drops: number[] = Array.from({ length: COLS }, () => Math.random() * -20)
    const CHARS = 'アイウエオカキクケコサシスセソ0123456789ABCDEF@#$%&'
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(0, 0, W, H)
      ctx.font = 'bold 9px monospace'
      drops.forEach((y, i) => {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)]
        const bright = Math.random() > 0.88
        ctx.fillStyle = bright ? 'rgba(220,255,230,0.95)' : accent + 'CC'
        ctx.fillText(ch, i * 9 + 1, y * 9)
        if (y * 9 > H && Math.random() > 0.972) drops[i] = 0
        drops[i] += 0.5
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [accent])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Nova Burst ────────────────────────────────────────────────────────────────

const NovaBurst = memo(function NovaBurst() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    const CX = W / 2, CY = H / 2
    const CYCLE = 210
    type Pt = { angle:number; speed:number; life:number }
    let burst: Pt[] = []
    const spawnBurst = () => {
      burst = Array.from({ length: 32 }, (_, i) => ({
        angle: (i / 32) * Math.PI * 2 + Math.random() * 0.2,
        speed: 1.0 + Math.random() * 1.8,
        life: 0,
      }))
    }
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      frame++
      if (frame % CYCLE === 1) spawnBurst()
      const t = (frame % CYCLE) / CYCLE
      // afterglow rings
      const ringAlpha = Math.max(0, 0.12 - t * 0.15)
      for (let r = 10; r < Math.min(W, H) * 0.9; r += 16) {
        ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,45,107,${ringAlpha})`; ctx.lineWidth = 1.5
        ctx.stroke()
      }
      burst.forEach(p => {
        p.life++
        const dist = p.speed * p.life
        const x = CX + Math.cos(p.angle) * dist
        const y = CY + Math.sin(p.angle) * dist
        const alpha = Math.max(0, 1 - p.life / 55)
        const sz = 2 * alpha
        ctx.save()
        ctx.shadowColor = '#FF2D6B'; ctx.shadowBlur = 6
        ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2)
        ctx.fillStyle = alpha > 0.5 ? `rgba(255,200,220,${alpha})` : `rgba(255,45,107,${alpha})`
        ctx.fill(); ctx.restore()
      })
      burst = burst.filter(p => p.life < 55)
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Petal Drift ───────────────────────────────────────────────────────────────

function PetalDrift({ accent }: { accent: string }) {
  const css = `
@keyframes petalFall {
  0%   { transform: translateY(-18%) translateX(0px) rotate(0deg); opacity: 0; }
  8%   { opacity: 0.92; }
  92%  { opacity: 0.75; }
  100% { transform: translateY(135%) translateX(18px) rotate(260deg); opacity: 0; }
}
`
  const petals = [
    { left: '4%',  delay: '0s',   dur: '6.5s', size: 11 },
    { left: '17%', delay: '1.2s', dur: '8.5s', size: 8  },
    { left: '31%', delay: '0.4s', dur: '7.2s', size: 13 },
    { left: '46%', delay: '2s',   dur: '5.8s', size: 9  },
    { left: '59%', delay: '0.7s', dur: '8s',   size: 12 },
    { left: '73%', delay: '1.6s', dur: '7s',   size: 8  },
    { left: '86%', delay: '2.8s', dur: '7.8s', size: 10 },
    { left: '94%', delay: '0.2s', dur: '6.2s', size: 9  },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {petals.map((p, i) => (
          <div key={i} style={{
            position:'absolute', top:'-18%', left: p.left,
            width: p.size, height: p.size,
            borderRadius: '0 60% 0 60%',
            background: accent,
            boxShadow: `0 0 4px ${accent}`,
            opacity: 0,
            animation: `petalFall ${p.dur} ease-in ${p.delay} infinite`,
          }} />
        ))}
      </div>
    </>
  )
}

// ── Frost Shimmer ─────────────────────────────────────────────────────────────

function FrostShimmer({ accent }: { accent: string }) {
  const css = `
@keyframes frostShimmerSweep {
  0%   { background-position: -150% 0; }
  100% { background-position: 150% 0; }
}
@keyframes frostTwinkle {
  0%, 100% { opacity: 0.35; transform: scale(0.8); }
  50%       { opacity: 1;    transform: scale(1.3); }
}
`
  const crystals = [
    { top:'18%', left:'8%',  delay:'0s'   },
    { top:'60%', left:'22%', delay:'0.5s' },
    { top:'35%', left:'40%', delay:'1.0s' },
    { top:'75%', left:'58%', delay:'0.3s' },
    { top:'20%', left:'72%', delay:'1.4s' },
    { top:'50%', left:'88%', delay:'0.8s' },
    { top:'85%', left:'10%', delay:'1.8s' },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background: `linear-gradient(90deg, transparent 20%, ${accent}55 50%, transparent 80%)`,
        backgroundSize: '250% 100%',
        animation: 'frostShimmerSweep 4s ease-in-out infinite',
      }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        {crystals.map((c, i) => (
          <span key={i} style={{
            position:'absolute', top: c.top, left: c.left,
            width: 7, height: 7, borderRadius: '50%',
            background: accent, boxShadow: `0 0 10px ${accent}, 0 0 20px ${accent}66`,
            animation: `frostTwinkle 1.8s ease-in-out ${c.delay} infinite`,
          }} />
        ))}
      </div>
    </>
  )
}

// ── Circuit Pulse ─────────────────────────────────────────────────────────────

function CircuitPulse({ accent }: { accent: string }) {
  const css = `
@keyframes circuitFlow {
  0%   { stroke-dashoffset: 120; opacity: 0.4; }
  50%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0.4; }
}
@keyframes circuitGlow {
  0%, 100% { filter: drop-shadow(0 0 2px ${accent}); }
  50%       { filter: drop-shadow(0 0 6px ${accent}); }
}
`
  return (
    <>
      <style>{css}</style>
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0, pointerEvents:'none', animation:`circuitGlow 2s ease infinite` }} preserveAspectRatio="none">
        {[0.15, 0.40, 0.65, 0.88].map((y, i) => (
          <polyline key={i}
            points={`0,${y*100}% 12%,${y*100}% 18%,${(y*100)-10}% 42%,${(y*100)-10}% 50%,${y*100}% 100%,${y*100}%`}
            fill="none" stroke={accent} strokeWidth="1.5"
            strokeDasharray="8 4"
            style={{ animation: `circuitFlow ${2.8 + i * 0.6}s linear infinite` }}
          />
        ))}
      </svg>
    </>
  )
}

// ── Paw Drift (CyberKitty) ────────────────────────────────────────────────────

function PawDrift({ accent }: { accent: string }) {
  const css = `
@keyframes pawDrift {
  0%   { transform: translateX(115%) rotate(-15deg); opacity: 0; }
  8%   { opacity: 0.8; }
  92%  { opacity: 0.65; }
  100% { transform: translateX(-115%) rotate(-15deg); opacity: 0; }
}
`
  const paws = [
    { top: '10%', delay: '0s',   dur: '9.5s',  scale: 0.95 },
    { top: '48%', delay: '3.2s', dur: '12.5s', scale: 0.70 },
    { top: '70%', delay: '1s',   dur: '11s',   scale: 0.80 },
    { top: '28%', delay: '5.5s', dur: '9s',    scale: 0.60 },
    { top: '80%', delay: '7s',   dur: '13.5s', scale: 0.85 },
    { top: '55%', delay: '2.4s', dur: '11.5s', scale: 0.65 },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {paws.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', top: p.top, right: '-5%',
            transform: `scale(${p.scale})`,
            animation: `pawDrift ${p.dur} linear ${p.delay} infinite`,
          }}>
            <svg width="26" height="24" viewBox="0 0 26 24">
              <ellipse cx="13" cy="17.5" rx="6.5" ry="5" fill={accent} opacity="0.9"/>
              <ellipse cx="4"  cy="10"   rx="2.8" ry="3.2" fill={accent} opacity="0.85"/>
              <ellipse cx="9.5" cy="6.5" rx="2.7" ry="3.1" fill={accent} opacity="0.85"/>
              <ellipse cx="16.5" cy="6.5" rx="2.7" ry="3.1" fill={accent} opacity="0.85"/>
              <ellipse cx="22"  cy="10"   rx="2.8" ry="3.2" fill={accent} opacity="0.85"/>
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
  0%   { transform: translateY(-28px) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.92; }
  90%  { opacity: 0.7; }
  100% { transform: translateY(125%) rotate(180deg); opacity: 0; }
}
@keyframes snowSway {
  0%, 100% { margin-left: 0px; }
  33%       { margin-left: 8px; }
  66%       { margin-left: -5px; }
}
`
  const flakes = [
    { left: '3%',  delay: '0s',    dur: '8.5s',  size: 18 },
    { left: '13%', delay: '2s',    dur: '11.5s', size: 11 },
    { left: '26%', delay: '0.4s',  dur: '9.5s',  size: 22 },
    { left: '39%', delay: '3.2s',  dur: '10.5s', size: 13 },
    { left: '53%', delay: '1.0s',  dur: '9s',    size: 20 },
    { left: '66%', delay: '4s',    dur: '12.5s', size: 11 },
    { left: '77%', delay: '1.6s',  dur: '10s',   size: 16 },
    { left: '89%', delay: '5s',    dur: '11s',   size: 13 },
  ]
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {flakes.map((f, i) => (
          <div key={i} style={{ position:'absolute', top:'-28px', left: f.left, animation:`snowFall ${f.dur} linear ${f.delay} infinite` }}>
            <div style={{ animation:`snowSway ${f.dur} ease-in-out ${f.delay} infinite` }}>
              <svg width={f.size} height={f.size} viewBox="0 0 24 24" opacity="0.9">
                <line x1="12" y1="1"  x2="12" y2="23" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="23" y2="12" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="4.5" y1="4.5"  x2="19.5" y2="19.5" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="19.5" y1="4.5" x2="4.5" y2="19.5" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="12" y1="1"  x2="9"  y2="4.5"  stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="12" y1="1"  x2="15" y2="4.5"  stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="12" y1="23" x2="9"  y2="19.5" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="12" y1="23" x2="15" y2="19.5" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="4.5" y2="9"   stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="1"  y1="12" x2="4.5" y2="15"  stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="23" y1="12" x2="19.5" y2="9"  stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="23" y1="12" x2="19.5" y2="15" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="3" fill={accent}/>
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
  8%   { opacity: 0.9; }
  92%  { opacity: 0.7; }
  100% { transform: translateY(-145%) rotate(3deg); opacity: 0; }
}
@keyframes xmasSway {
  0%, 100% { transform: translateX(0); }
  50%       { transform: translateX(6px); }
}
`
  type XItem = { type: 'tree' | 'flake' | 'candy'; left: string; delay: string; dur: string; size: number }
  const items: XItem[] = [
    { type: 'tree',  left: '3%',  delay: '0s',    dur: '11.5s', size: 20 },
    { type: 'flake', left: '15%', delay: '2s',    dur: '8.5s',  size: 16 },
    { type: 'candy', left: '28%', delay: '0.7s',  dur: '12.5s', size: 17 },
    { type: 'tree',  left: '43%', delay: '3.2s',  dur: '10.5s', size: 15 },
    { type: 'flake', left: '57%', delay: '1.4s',  dur: '9.5s',  size: 18 },
    { type: 'candy', left: '71%', delay: '3.8s',  dur: '12s',   size: 15 },
    { type: 'tree',  left: '85%', delay: '0.3s',  dur: '13s',   size: 14 },
  ]
  const renderItem = (type: XItem['type'], size: number) => {
    if (type === 'tree') return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <polygon points="12,2 20,17 4,17" fill="#1e7e1e" stroke="#39ff14" strokeWidth="0.8"/>
        <polygon points="12,9 18,20 6,20" fill="#155e15" stroke="#39ff14" strokeWidth="0.8"/>
        <rect x="10.5" y="20" width="3" height="3" fill="#8B4513"/>
        <circle cx="9" cy="12" r="1.5" fill="#FFD700"/>
        <circle cx="15" cy="14" r="1.5" fill="#FF4444"/>
        <circle cx="12" cy="16.5" r="1.5" fill="#FFD700"/>
        <circle cx="12" cy="4" r="1.5" fill="#FFD700"/>
      </svg>
    )
    if (type === 'flake') return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <line x1="12" y1="2"  x2="12" y2="22" stroke="#AADDFF" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="2"  y1="12" x2="22" y2="12" stroke="#AADDFF" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="5"  y1="5"  x2="19" y2="19" stroke="#AADDFF" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="19" y1="5"  x2="5"  y2="19" stroke="#AADDFF" strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="2.5" fill="#FFFFFF"/>
      </svg>
    )
    return (
      <svg width={size * 0.65} height={size} viewBox="0 0 16 24">
        <path d="M8 2 Q14 2 14 8 Q14 14 8 14 L8 22" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M8 2 Q14 2 14 8 Q14 14 8 14 L8 22" fill="none" stroke="#C41E3A"
          strokeWidth="4.5" strokeLinecap="round" strokeDasharray="4 4" strokeDashoffset="0"/>
      </svg>
    )
  }
  return (
    <>
      <style>{css}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {items.map((item, i) => (
          <div key={i} style={{ position:'absolute', bottom:'-5%', left: item.left, animation:`xmasRise ${item.dur} ease-in-out ${item.delay} infinite` }}>
            <div style={{ animation:`xmasSway ${item.dur} ease-in-out ${item.delay} infinite` }}>
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
      y: H * (0.45 + Math.random() * 0.55),
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(0.7 + Math.random() * 2.2),
      life: 0, maxLife: 40 + Math.random() * 45,
      size: 1.5 + Math.random() * 3.5,
      hue: 8 + Math.random() * 45,
    })
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      if (frame++ % 2 === 0 && embers.length < 30) spawn()
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.life++; e.x += e.vx; e.y += e.vy; e.vx *= 0.98
        if (e.life > e.maxLife) { embers.splice(i, 1); continue }
        const t = e.life / e.maxLife
        const alpha = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88
        const size = e.size * (1 - t * 0.45)
        ctx.save()
        ctx.shadowColor = `hsl(${e.hue},100%,60%)`; ctx.shadowBlur = size * 5
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, size * 3.5)
        grad.addColorStop(0, `hsla(${e.hue},100%,72%,${alpha * 0.8})`)
        grad.addColorStop(1, `hsla(${e.hue},100%,30%,0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(e.x, e.y, size * 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `hsla(${e.hue + 25},100%,92%,${alpha})`
        ctx.beginPath(); ctx.arc(e.x, e.y, size * 0.55, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
})

// ── Retro Grid (Retro Miami) ──────────────────────────────────────────────────

const CSS_RETRO_GRID = `
@keyframes retroGridScroll {
  from { background-position: 0 0; }
  to   { background-position: 0 30px; }
}
@keyframes retroSunPulse {
  0%, 100% { opacity: 0.65; }
  50%       { opacity: 0.95; }
}
@keyframes retroScanline {
  0%   { top: -10%; }
  100% { top: 110%; }
}
`
function RetroGrid({ accent }: { accent: string }) {
  return (
    <>
      <style>{CSS_RETRO_GRID}</style>
      {/* perspective grid lines */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: `
          linear-gradient(rgba(0,245,212,0.45) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,47,209,0.35) 1px, transparent 1px)
        `,
        backgroundSize: '22px 22px',
        animation: 'retroGridScroll 1.8s linear infinite',
      }} />
      {/* sun/horizon gradient */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        height: '50%',
        background: `linear-gradient(to top, ${accent}55, rgba(255,47,209,0.25) 50%, transparent)`,
        animation: 'retroSunPulse 3s ease infinite',
      }} />
      {/* moving scanline */}
      <div style={{
        position:'absolute', left:0, right:0, top:'-10%',
        height: '3px',
        background: 'rgba(255,255,255,0.25)',
        animation: 'retroScanline 4s linear infinite',
      }} />
    </>
  )
}

// ── Fire Wall (Urban Heat) ────────────────────────────────────────────────────

const FireWall = memo(function FireWall({ accent = '#FF6600' }: { accent?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let af: number
    const W = canvas.offsetWidth || 220, H = canvas.offsetHeight || 60
    canvas.width = W; canvas.height = H
    // Create fire columns
    const NUM_COLS = Math.floor(W / 8)
    const heights: number[] = Array.from({ length: NUM_COLS }, () => Math.random() * H * 0.6)
    const speeds: number[] = Array.from({ length: NUM_COLS }, () => 0.5 + Math.random() * 2)
    const targets: number[] = Array.from({ length: NUM_COLS }, () => Math.random() * H * 0.7)
    let frame = 0
    const draw = () => {
      af = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      frame++
      // Update column heights
      heights.forEach((h, i) => {
        if (frame % 8 === i % 8) targets[i] = Math.random() * H * 0.75
        heights[i] += (targets[i] - h) * 0.08
      })
      // Draw fire columns from bottom
      heights.forEach((h, i) => {
        const x = i * 8
        const grad = ctx.createLinearGradient(x, H, x, H - h)
        grad.addColorStop(0, `rgba(255,80,0,0.95)`)
        grad.addColorStop(0.3, `rgba(255,150,0,0.8)`)
        grad.addColorStop(0.7, `rgba(255,220,0,0.4)`)
        grad.addColorStop(1, `rgba(255,240,100,0)`)
        ctx.fillStyle = grad
        ctx.fillRect(x, H - h, 7, h)
      })
    }
    draw()
    return () => cancelAnimationFrame(af)
  }, [accent])
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
    case 'glitch-tears':      return <GlitchTears accent={accentColor} />
    case 'lantern-drift':     return <LanternDrift />
    case 'chrome-shimmer':    return <ChromeShimmer />
    case 'void-stars':        return <VoidStars accent={accentColor} />
    case 'gold-sparkles':     return <GoldSparkles />
    case 'code-rain':         return <CodeRain accent={accentColor} />
    case 'nova-burst':        return <NovaBurst />
    case 'aurora-sovereign':  return <AuroraSovereign />
    case 'petal-drift':       return <PetalDrift accent={accentColor} />
    case 'frost-shimmer':     return <FrostShimmer accent={accentColor} />
    case 'circuit-pulse':     return <CircuitPulse accent={accentColor} />
    case 'paw-drift':         return <PawDrift accent={accentColor} />
    case 'snowflake-field':   return <SnowflakeField accent={accentColor} />
    case 'christmas-spirits': return <ChristmasSpirits />
    case 'ember-sparks':      return <EmberSparks />
    case 'retro-grid':        return <RetroGrid accent={accentColor} />
    case 'fire-wall':         return <FireWall accent={accentColor} />
    default:                  return null
  }
}
