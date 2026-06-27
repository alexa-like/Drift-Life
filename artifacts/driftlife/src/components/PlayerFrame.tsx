import { useEffect, useRef } from "react";
import { getFrame, FrameRarity } from "../lib/frames";
import { registerAnim, unregisterAnim, seededRand } from "../lib/animTicker";

export type FrameSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};
const BORDER_PX: Record<FrameSize, number> = {
  xs: 2, sm: 2, md: 3, lg: 3, xl: 4,
};

export const FRAME_VARIANT: Record<string, number> = {
  ghostFrame: 0, basicWhite: 1, basicGray: 2, neonBlue: 3,
  neonGreen: 4, neonRed: 5, corpGray: 6, streetOrange: 7, cyanPulse: 8, goldBasic: 9,
  shimmerCyan: 0, shimmerPurple: 1, shimmerGold: 2, shimmerRed: 3,
  shimmerGreen: 4, shimmerOrange: 5, techShimmer: 6, suitShimmer: 7, crimsonShimmer: 8, iceShimmer: 9,
  pulseCyan: 0, pulsePurple: 1, pulseGold: 2, pulseRed: 3,
  pulseGreen: 4, hackerPulse: 5, corePulse: 6, vaultPulse: 7, streetPulse: 8, spectralPulse: 9,
  epicCyan: 0, epicPurple: 1, epicGold: 2, syndicate: 3,
  epicRed: 4, gridCore: 5, suitsFrame: 6, epicVoid: 7, epicInferno: 8, epicNova: 9,
  legendCyan: 0, legendPurple: 1, legendRed: 2, arcLight: 3,
  legendGold: 4, crimsonLord: 5, thunderClap: 6, plasmaBolt: 7, vantaLegend: 8, executioner: 9,
  matrixGreen: 0, matrixBlue: 1, omega: 2, voidWalker: 3,
  matrixGold: 4, matrixRed: 5, architect: 6, nova2047: 7, godMode: 8, theOne: 9,
};

interface Props {
  frameId: string | null | undefined;
  size?: FrameSize;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Perimeter point helper
function perimPt(pos: number, W: number, H: number, bb: number): [number, number] {
  const perim = 2 * (W + H);
  const d = ((pos % perim) + perim) % perim;
  if (d < W) return [d, bb];
  if (d < W + H) return [W - bb, d - W];
  if (d < 2 * W + H) return [W - (d - W - H), H - bb];
  return [bb, H - (d - 2 * W - H)];
}

// Chamfered octagon path helper
function octPath(ctx: CanvasRenderingContext2D, b: number, w: number, h: number, cut: number) {
  ctx.beginPath();
  ctx.moveTo(b + cut, b);
  ctx.lineTo(w - b - cut, b);
  ctx.lineTo(w - b, b + cut);
  ctx.lineTo(w - b, h - b - cut);
  ctx.lineTo(w - b - cut, h - b);
  ctx.lineTo(b + cut, h - b);
  ctx.lineTo(b, h - b - cut);
  ctx.lineTo(b, b + cut);
  ctx.closePath();
}

// Diamond path helper
function diamondPath(ctx: CanvasRenderingContext2D, w: number, h: number, margin: number) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, margin);
  ctx.lineTo(w - margin, cy);
  ctx.lineTo(cx, h - margin);
  ctx.lineTo(margin, cy);
  ctx.closePath();
}

function hsl2hex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function PlayerFrame({ frameId, size = "md", children, style, className }: Props) {
  const frame = getFrame(frameId);
  const px = SIZE_PX[size];
  const border = BORDER_PX[size];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);
  const rarity = frame.rarity as FrameRarity;
  const idx = FRAME_VARIANT[frame.id] ?? 0;
  const color = frame.glowColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // IntersectionObserver — pause animation when frame is off-screen
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const ctxMaybe = canvas.getContext("2d", { alpha: true });
    if (!ctxMaybe) return () => observer.disconnect();
    const ctx = ctxMaybe as CanvasRenderingContext2D;

    const w = canvas.width, h = canvas.height;
    const b = border;
    const R = 3; // corner radius
    const cut = Math.max(4, w * 0.18); // chamfer size
    const CHARS = "01アイウBC#!@$%░▓";
    let t = 0;

    // ── COMMON — 10 unique static border designs ────────────────────────────
    function drawCommon() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      switch (idx) {
        case 0: { // Ghost — rounded + L-corner arms
          ctx.lineWidth = b * 2;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const arm = Math.max(5, w * 0.28);
          ctx.lineWidth = b;
          for (const [cx, cy, sx, sy] of [[b, b, 1, 1], [w - b, b, -1, 1], [b, h - b, 1, -1], [w - b, h - b, -1, -1]] as const) {
            ctx.beginPath(); ctx.moveTo(cx + sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * arm); ctx.stroke();
          }
          break;
        }
        case 1: { // Basic White — square + glowing corner dots
          ctx.lineWidth = b * 1.5;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          ctx.shadowBlur = 8; ctx.fillStyle = color;
          for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]] as const) {
            ctx.beginPath(); ctx.arc(cx, cy, b * 1.4, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 2: { // Basic Gray — chamfered octagon
          ctx.lineWidth = b * 1.5;
          octPath(ctx, b, w, h, cut); ctx.stroke();
          break;
        }
        case 3: { // Neon Blue — double concentric
          ctx.lineWidth = b * 1.5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.lineWidth = b * 0.6; ctx.globalAlpha = 0.35;
          ctx.beginPath(); ctx.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, R); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 4: { // Neon Green — dashed border
          ctx.setLineDash([5, 3]); ctx.lineWidth = b * 1.5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 5: { // Neon Red — thick glow + thin inner line
          ctx.lineWidth = b * 4; ctx.shadowBlur = 2; ctx.globalAlpha = 0.25;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.lineWidth = b; ctx.shadowBlur = 5; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          break;
        }
        case 6: { // Corp Gray — corner brackets only
          const arm2 = Math.max(6, w * 0.32);
          ctx.lineWidth = b * 1.5;
          for (const [cx, cy, sx, sy] of [[b, b, 1, 1], [w - b, b, -1, 1], [b, h - b, 1, -1], [w - b, h - b, -1, -1]] as const) {
            ctx.beginPath(); ctx.moveTo(cx + sx * arm2, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * arm2); ctx.stroke();
          }
          break;
        }
        case 7: { // Street Orange — inner ring + perimeter dots
          ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, R); ctx.stroke();
          ctx.shadowBlur = 6; ctx.fillStyle = color;
          const step = Math.max(6, w / 3.5);
          for (let i = b; i <= w - b; i += step) {
            for (const y of [b, h - b]) { ctx.beginPath(); ctx.arc(i, y, b * 0.7, 0, Math.PI * 2); ctx.fill(); }
          }
          for (let j = b + step; j < h - b; j += step) {
            for (const x of [b, w - b]) { ctx.beginPath(); ctx.arc(x, j, b * 0.7, 0, Math.PI * 2); ctx.fill(); }
          }
          break;
        }
        case 8: { // Cyan Basic — diagonal X marks at corners
          ctx.lineWidth = b; ctx.globalAlpha = 0.3;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = b * 1.5; ctx.shadowBlur = 6;
          const sz = Math.max(5, w * 0.22);
          for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]] as const) {
            ctx.beginPath(); ctx.moveTo(cx - sz * 0.55, cy - sz * 0.55); ctx.lineTo(cx + sz * 0.55, cy + sz * 0.55); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + sz * 0.55, cy - sz * 0.55); ctx.lineTo(cx - sz * 0.55, cy + sz * 0.55); ctx.stroke();
          }
          break;
        }
        case 9: { // Gold Basic — diamond shape
          ctx.lineWidth = b * 1.5;
          diamondPath(ctx, w, h, b * 0.5);
          ctx.stroke();
          break;
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── UNCOMMON — 10 visually distinct shimmer designs ─────────────────────
    function drawUncommon() {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);
      const perim = 2 * (w + h);

      switch (idx) {
        case 0: { // shimmerCyan — single orb sweep, rounded border
          ctx.strokeStyle = color + "30"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const pos = (t * 2.5) % perim;
          for (let i = 0; i < 18; i++) {
            const tp = (pos - i * (perim * 0.08 / 18) + perim * 10) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / 18) ** 2;
            ctx.beginPath(); ctx.arc(px2, py, b * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
            ctx.shadowColor = color; ctx.shadowBlur = alpha * 5; ctx.fill();
          }
          break;
        }
        case 1: { // shimmerPurple — dual opposing orbs, square border
          ctx.strokeStyle = color + "30"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          for (let c = 0; c < 2; c++) {
            const pos = ((t * 2.0 + c * perim * 0.5) + perim * 10) % perim;
            for (let i = 0; i < 12; i++) {
              const tp = (pos - i * (perim * 0.07 / 12) + perim * 10) % perim;
              const [px2, py] = perimPt(tp, w, h, b);
              const alpha = (1 - i / 12) ** 2;
              ctx.beginPath(); ctx.arc(px2, py, b * 0.8, 0, Math.PI * 2);
              ctx.fillStyle = color + Math.floor(alpha * 180).toString(16).padStart(2, "0");
              ctx.shadowColor = color; ctx.shadowBlur = alpha * 4; ctx.fill();
            }
          }
          break;
        }
        case 2: { // shimmerGold — rotating dashed border (no orb)
          ctx.setLineDash([5, 4]);
          ctx.lineDashOffset = -(t * 0.8) % 9;
          ctx.strokeStyle = color; ctx.lineWidth = b * 1.4;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.setLineDash([]); ctx.shadowBlur = 0;
          break;
        }
        case 3: { // shimmerRed — 3 orbs equally spaced, chamfered border
          ctx.strokeStyle = color + "25"; ctx.lineWidth = b;
          octPath(ctx, b, w, h, cut); ctx.stroke();
          for (let c = 0; c < 3; c++) {
            const pos = ((t * 3.0 + c * perim / 3) + perim * 10) % perim;
            const [px2, py] = perimPt(pos, w, h, b);
            ctx.beginPath(); ctx.arc(px2, py, b * 1.1, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.fill();
          }
          break;
        }
        case 4: { // shimmerGreen — single orb with extra-long tail, thick border
          ctx.lineWidth = b * 3; ctx.globalAlpha = 0.18;
          ctx.strokeStyle = color;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = b;
          ctx.strokeStyle = color + "20";
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const pos = (t * 1.5) % perim;
          for (let i = 0; i < 30; i++) {
            const tp = (pos - i * (perim * 0.12 / 30) + perim * 10) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / 30) ** 1.8;
            ctx.beginPath(); ctx.arc(px2, py, b * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
            ctx.shadowBlur = 0; ctx.fill();
          }
          break;
        }
        case 5: { // shimmerOrange — corner flash sequence
          ctx.strokeStyle = color + "40"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const corners = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];
          const active = Math.floor(t / 6) % 4;
          const phase = (t % 6) / 6;
          const a = Math.sin(phase * Math.PI);
          const [cx, cy] = corners[active];
          ctx.beginPath(); ctx.arc(cx, cy, b * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(a * 180).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = a * 8; ctx.fill();
          break;
        }
        case 6: { // techShimmer — digital dot sweep on square border
          ctx.strokeStyle = color + "20"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          const pos = (t * 2.2) % perim;
          const stepSz = Math.max(5, w / 4);
          for (let i = 0; i < 8; i++) {
            const tp = (pos + i * stepSz) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const blink = (Math.floor((t + i * 3) / 4) % 2 === 0) ? 1 : 0.3;
            ctx.beginPath(); ctx.arc(px2, py, b * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(blink * 200).toString(16).padStart(2, "0");
            ctx.shadowBlur = 0; ctx.fill();
          }
          break;
        }
        case 7: { // suitShimmer — ultra-slow elegant sweep, thin border
          ctx.strokeStyle = color + "50"; ctx.lineWidth = b * 0.8;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          const pos = (t * 1.0) % perim;
          for (let i = 0; i < 24; i++) {
            const tp = (pos - i * (perim * 0.1 / 24) + perim * 10) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / 24) ** 2.5;
            ctx.beginPath(); ctx.arc(px2, py, b * 0.9, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(alpha * 160).toString(16).padStart(2, "0");
            ctx.shadowBlur = 0; ctx.fill();
          }
          break;
        }
        case 8: { // crimsonShimmer — two rings (inner+outer) sweeping
          ctx.strokeStyle = color + "20"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.beginPath(); ctx.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, R); ctx.stroke();
          const rings = [{ r: 0, spd: 2.5, sz: b }, { r: b * 2.5, spd: -1.5, sz: b * 0.6 }];
          for (const ring of rings) {
            const rPerim = 2 * (w - ring.r * 2 + h - ring.r * 2);
            const pos = ((t * ring.spd) + rPerim * 10) % rPerim;
            const [px2, py] = perimPt(pos, w - ring.r * 2, h - ring.r * 2, b);
            ctx.beginPath(); ctx.arc(px2 + ring.r, py + ring.r, ring.sz, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.fill();
          }
          break;
        }
        case 9: { // iceShimmer — very slow faint crawl, barely visible
          ctx.strokeStyle = color + "60"; ctx.lineWidth = b * 1.2;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const pos = (t * 0.7) % perim;
          for (let i = 0; i < 40; i++) {
            const tp = (pos - i * (perim * 0.18 / 40) + perim * 10) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / 40) ** 3;
            ctx.beginPath(); ctx.arc(px2, py, b * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(alpha * 140).toString(16).padStart(2, "0");
            ctx.shadowBlur = 0; ctx.fill();
          }
          break;
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // ── RARE — 10 distinct pulse designs ────────────────────────────────────
    function drawRare() {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);

      switch (idx) {
        case 0: { // pulseCyan — breathing pulse, rounded
          const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2));
          ctx.strokeStyle = color; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 5 * pulse;
          ctx.globalAlpha = 0.4 + 0.6 * pulse;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 1: { // pulsePurple — dual breathing rings (in-phase opposition)
          const p1 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2);
          const p2 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2 + Math.PI);
          ctx.strokeStyle = color; ctx.lineWidth = b;
          ctx.shadowColor = color;
          ctx.shadowBlur = 4 * p1; ctx.globalAlpha = 0.3 + 0.7 * p1;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.shadowBlur = 4 * p2; ctx.globalAlpha = 0.3 + 0.7 * p2;
          ctx.beginPath(); ctx.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 2: { // pulseGold — slow perimeter spotlight
          ctx.strokeStyle = color + "40"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const perim = 2 * (w + h);
          const pos = (t * 1.2) % perim;
          for (let i = 0; i < 14; i++) {
            const tp = (pos - i * (perim * 0.1 / 14) + perim * 10) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / 14) ** 2;
            ctx.beginPath(); ctx.arc(px2, py, b + b * alpha * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(alpha * 220).toString(16).padStart(2, "0");
            ctx.shadowColor = color; ctx.shadowBlur = alpha * 8; ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 3: { // pulseRed — fast erratic pulse with flicker
          const fast = 0.5 + 0.5 * Math.sin((t / 18) * Math.PI * 2);
          const flicker = seededRand(t & 15) > 0.7 ? 0.6 : 1.0;
          ctx.strokeStyle = color; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 4 * fast;
          ctx.globalAlpha = (0.5 + 0.5 * fast) * flicker;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 4: { // pulseGreen — vertical scan line
          ctx.strokeStyle = color + "50"; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const scanY = ((t * 1.3) % (h + 14)) - 7;
          const sg = ctx.createLinearGradient(0, scanY - 4, 0, scanY + 4);
          sg.addColorStop(0, color + "00");
          sg.addColorStop(0.5, color + "cc");
          sg.addColorStop(1, color + "00");
          ctx.fillStyle = sg; ctx.shadowBlur = 0;
          ctx.fillRect(b, Math.max(b, scanY - 4), w - b * 2, 8);
          break;
        }
        case 5: { // hackerPulse — corner glow blooms
          ctx.strokeStyle = color + "40"; ctx.lineWidth = b;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          const corners = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];
          corners.forEach(([cx, cy], i) => {
            const phase = (t / 28 + i * 0.25) * Math.PI * 2;
            const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(phase));
            const r = b * (1.5 + Math.sin(phase) * 0.8);
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(a * 180).toString(16).padStart(2, "0");
            ctx.shadowColor = color; ctx.shadowBlur = 4 * a; ctx.fill();
          });
          ctx.shadowBlur = 0;
          break;
        }
        case 6: { // corePulse — chamfered octagon shape pulse
          const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 36) * Math.PI * 2));
          ctx.strokeStyle = color; ctx.lineWidth = b * 1.8;
          ctx.shadowColor = color; ctx.shadowBlur = 4 * pulse;
          ctx.globalAlpha = 0.4 + 0.6 * pulse;
          octPath(ctx, b, w, h, cut); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 7: { // vaultPulse — slow heavy double pulse
          const p = (0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2));
          ctx.strokeStyle = color; ctx.lineWidth = b * 3; ctx.globalAlpha = 0.15 + 0.35 * p;
          ctx.shadowColor = color; ctx.shadowBlur = 3;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.lineWidth = b; ctx.globalAlpha = 0.5 + 0.5 * p; ctx.shadowBlur = 5 * p;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 8: { // streetPulse — rapid strobe with square border
          const strobe = Math.sin((t / 10) * Math.PI * 2);
          const pulse = 0.3 + 0.7 * (0.5 + 0.5 * strobe);
          ctx.strokeStyle = color; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 3 * pulse;
          ctx.globalAlpha = pulse;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 9: { // spectralPulse — ghost fade with diamond shape
          const ghost = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin((t / 60) * Math.PI * 2));
          ctx.strokeStyle = color; ctx.lineWidth = b * 1.5;
          ctx.shadowColor = color; ctx.shadowBlur = 3;
          ctx.globalAlpha = ghost;
          diamondPath(ctx, w, h, b * 0.5); ctx.stroke();
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R);
          ctx.globalAlpha = ghost * 0.4; ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
      }
      t++;
    }

    // ── EPIC — 10 distinct rotating/scanning designs ────────────────────────
    function drawEpic() {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);
      const cx2 = w / 2, cy2 = h / 2;

      switch (idx) {
        case 0: { // epicCyan — conic gradient rotation, rounded
          const ang = (t / 80) * Math.PI * 2;
          const grad = ctx.createConicGradient(ang, cx2, cy2);
          grad.addColorStop(0, color);
          grad.addColorStop(0.4, color + "40");
          grad.addColorStop(0.7, color + "10");
          grad.addColorStop(1, color);
          ctx.strokeStyle = grad; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }
        case 1: { // epicPurple — conic rotation on chamfered border
          const ang = (t / 65) * Math.PI * 2;
          const grad = ctx.createConicGradient(ang, cx2, cy2);
          grad.addColorStop(0, color);
          grad.addColorStop(0.35, color + "30");
          grad.addColorStop(0.65, color + "08");
          grad.addColorStop(1, color);
          ctx.strokeStyle = grad; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 5;
          octPath(ctx, b, w, h, cut); ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }
        case 2: { // epicGold — dual conic (outer+inner rotate opposite)
          const a1 = (t / 90) * Math.PI * 2;
          const a2 = -(t / 60) * Math.PI * 2;
          const g1 = ctx.createConicGradient(a1, cx2, cy2);
          g1.addColorStop(0, color); g1.addColorStop(0.5, color + "20"); g1.addColorStop(1, color);
          ctx.strokeStyle = g1; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const g2 = ctx.createConicGradient(a2, cx2, cy2);
          g2.addColorStop(0, color); g2.addColorStop(0.5, color + "20"); g2.addColorStop(1, color);
          ctx.strokeStyle = g2; ctx.lineWidth = b;
          ctx.beginPath(); ctx.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, R); ctx.stroke();
          ctx.shadowBlur = 0;
          break;
        }
        case 3: { // syndicate — horizontal scan + thick glow outer
          ctx.strokeStyle = color + "60"; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.lineWidth = b * 4; ctx.globalAlpha = 0.12; ctx.shadowBlur = 2;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1;
          const scanX = ((t * 1.4) % (w + 14)) - 7;
          const sg = ctx.createLinearGradient(scanX - 5, 0, scanX + 5, 0);
          sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "cc"); sg.addColorStop(1, color + "00");
          ctx.fillStyle = sg; ctx.shadowBlur = 0;
          ctx.fillRect(Math.max(b, scanX - 5), b, 10, h - b * 2);
          break;
        }
        case 4: { // epicRed — rotating diamond points at corners
          ctx.strokeStyle = color + "60"; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          const ang = (t / 50) * Math.PI * 2;
          const corners = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];
          corners.forEach(([cx, cy], i) => {
            const ph = ang + i * Math.PI / 2;
            const r = b * 2.5;
            const px3 = cx + Math.cos(ph) * r, py = cy + Math.sin(ph) * r;
            ctx.save(); ctx.translate(px3, py); ctx.rotate(ph);
            ctx.beginPath();
            ctx.moveTo(0, -b * 0.85); ctx.lineTo(b * 0.85, 0);
            ctx.lineTo(0, b * 0.85); ctx.lineTo(-b * 0.85, 0);
            ctx.closePath();
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill();
            ctx.restore();
          });
          ctx.shadowBlur = 0;
          break;
        }
        case 5: { // gridCore — fast horizontal scan lines (grid aesthetic)
          ctx.strokeStyle = color + "50"; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          const scanX = ((t * 2.4) % (w + 14)) - 7;
          const sg = ctx.createLinearGradient(scanX - 4, 0, scanX + 4, 0);
          sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "dd"); sg.addColorStop(1, color + "00");
          ctx.fillStyle = sg;
          ctx.fillRect(Math.max(b, scanX - 4), b, 8, h - b * 2);
          break;
        }
        case 6: { // suitsFrame — slow elegant conic + slow orbital dots
          const ang = (t / 120) * Math.PI * 2;
          const grad = ctx.createConicGradient(ang, cx2, cy2);
          grad.addColorStop(0, color + "90");
          grad.addColorStop(0.5, color + "10");
          grad.addColorStop(1, color + "90");
          ctx.strokeStyle = grad; ctx.lineWidth = b * 1.5;
          ctx.shadowColor = color; ctx.shadowBlur = 3;
          ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
          const corners = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];
          corners.forEach(([cx, cy], i) => {
            const ph = ang + i * Math.PI / 2;
            ctx.beginPath(); ctx.arc(cx + Math.cos(ph) * b * 1.5, cy + Math.sin(ph) * b * 1.5, b * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.fill();
          });
          ctx.shadowBlur = 0;
          break;
        }
        case 7: { // epicVoid — dark matter absorption (inverted conic)
          const ang = -(t / 70) * Math.PI * 2;
          const grad = ctx.createConicGradient(ang, cx2, cy2);
          grad.addColorStop(0, color);
          grad.addColorStop(0.2, color + "80");
          grad.addColorStop(0.5, color + "08");
          grad.addColorStop(0.8, color + "80");
          grad.addColorStop(1, color);
          ctx.strokeStyle = grad; ctx.lineWidth = b * 2;
          ctx.shadowColor = color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          // breathing inner dark ring
          const pulse = 0.3 + 0.4 * Math.sin((t / 35) * Math.PI * 2);
          ctx.strokeStyle = color + "40"; ctx.lineWidth = b * 0.7; ctx.globalAlpha = pulse; ctx.shadowBlur = 2;
          ctx.beginPath(); ctx.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
        case 8: { // epicInferno — bottom-to-top fire scan + ember dots
          ctx.strokeStyle = color + "70"; ctx.lineWidth = b;
          ctx.shadowColor = color; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.shadowBlur = 0;
          const scanY = h - ((t * 1.8) % (h + 16));
          const fg = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
          fg.addColorStop(0, color + "00"); fg.addColorStop(0.5, color + "cc"); fg.addColorStop(1, color + "00");
          ctx.fillStyle = fg;
          ctx.fillRect(b, Math.max(b, scanY - 6), w - b * 2, 12);
          // ember dots
          for (let i = 0; i < 3; i++) {
            const ex = b + seededRand((t + i * 17) & 255) * (w - b * 2);
            const ey = scanY - seededRand((t + i * 31) & 255) * 8;
            if (ey > b && ey < h - b) {
              ctx.beginPath(); ctx.arc(ex, ey, 0.8, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff"; ctx.fill();
            }
          }
          break;
        }
        case 9: { // epicNova — supernova radial burst + pulsing outer
          const ang = (t / 55) * Math.PI * 2;
          const burst = 0.5 + 0.5 * Math.sin((t / 30) * Math.PI * 2);
          const grad = ctx.createConicGradient(ang, cx2, cy2);
          grad.addColorStop(0, color);
          grad.addColorStop(0.25, color + "60");
          grad.addColorStop(0.5, color + "ff");
          grad.addColorStop(0.75, color + "60");
          grad.addColorStop(1, color);
          ctx.strokeStyle = grad; ctx.lineWidth = b * 1.5;
          ctx.shadowColor = color; ctx.shadowBlur = 4 + 3 * burst;
          ctx.globalAlpha = 0.7 + 0.3 * burst;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          break;
        }
      }
      t++;
    }

    // ── LEGENDARY — 10 distinct electric/flicker designs ───────────────────
    // Pre-computed spark positions to avoid Math.random() in hot path
    const SPARK_X = Array.from({ length: 32 }, (_, i) => seededRand(i + 100));
    const SPARK_Y = Array.from({ length: 32 }, (_, i) => seededRand(i + 200));
    const SPARK_DX = Array.from({ length: 32 }, (_, i) => (seededRand(i + 50) - 0.5) * 10);
    const SPARK_DY = Array.from({ length: 32 }, (_, i) => (seededRand(i + 150) - 0.5) * 10);

    function drawLegendary() {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;

      const corners: [number, number][] = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];

      switch (idx) {
        case 0: { // legendCyan — corner sparks every N frames
          if (t % 8 === 0) {
            const si = (t >> 3) & 3;
            const [sx, sy] = corners[si];
            const n = (t >> 3) & 7;
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.shadowColor = color; ctx.shadowBlur = 5;
            ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + SPARK_DX[n & 31], sy + SPARK_DY[n & 31]); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 1: { // legendPurple — arc lightning corner-to-corner
          if (t % 15 < 5) {
            const c1 = Math.floor(t / 15) % 4;
            const c2 = (c1 + 2) % 4;
            const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
            ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(x1, y1);
            let lx = x1, ly = y1;
            const n = (t >> 1) & 31;
            for (let s = 0; s < 5; s++) {
              lx += (x2 - x1) / 5 + (SPARK_DX[(n + s) & 31]);
              ly += (y2 - y1) / 5 + (SPARK_DY[(n + s) & 31]);
              ctx.lineTo(Math.max(b, Math.min(w - b, lx)), Math.max(b, Math.min(h - b, ly)));
            }
            ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
          }
          break;
        }
        case 2: { // legendRed — glitch offset
          const glitch = t % 12 < 3;
          if (glitch) {
            const n = t & 31;
            const ox = (SPARK_DX[n] * 0.4), oy = (SPARK_DY[n] * 0.4);
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * 2;
            ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.roundRect(b + ox, b + oy, w - b * 2, h - b * 2, R); ctx.stroke();
            ctx.strokeStyle = color + "60"; ctx.lineWidth = b;
            ctx.beginPath(); ctx.roundRect(b - ox, b - oy, w - b * 2, h - b * 2, R); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 3: { // arcLight — pale arc flash + sustained arc
          ctx.strokeStyle = color; ctx.lineWidth = b * 1.5;
          ctx.shadowColor = color; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          if (t % 18 < 6) {
            const c1 = Math.floor(t / 18) % 4, c2 = (c1 + 1) % 4;
            const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
            ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 4; ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.moveTo(x1, y1);
            const n = (t >> 1) & 31;
            let lx = x1, ly = y1;
            for (let s = 0; s < 4; s++) {
              lx += (x2 - x1) / 4 + SPARK_DX[(n + s) & 31] * 0.6;
              ly += (y2 - y1) / 4 + SPARK_DY[(n + s) & 31] * 0.6;
              ctx.lineTo(Math.max(b, Math.min(w - b, lx)), Math.max(b, Math.min(h - b, ly)));
            }
            ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 4: { // legendGold — electrical sparks along edges
          if (t % 6 === 0) {
            const n = (t >> 2) & 31;
            const sides = [[w * SPARK_X[n], b], [w - b, h * SPARK_Y[n]], [w * SPARK_X[(n + 5) & 31], h - b], [b, h * SPARK_Y[(n + 8) & 31]]];
            for (let s = 0; s < 2; s++) {
              const [sx, sy] = sides[(n + s) & 3];
              ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
              ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.globalAlpha = 0.85;
              ctx.beginPath();
              ctx.moveTo(Math.max(b, Math.min(w - b, sx)), Math.max(b, Math.min(h - b, sy)));
              ctx.lineTo(
                Math.max(b, Math.min(w - b, sx + SPARK_DX[(n + s * 7) & 31])),
                Math.max(b, Math.min(h - b, sy + SPARK_DY[(n + s * 11) & 31]))
              );
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 5: { // crimsonLord — blood-red arc + double-border pulse
          const pulse = 0.5 + 0.5 * Math.sin((t / 20) * Math.PI * 2);
          ctx.strokeStyle = color + "80"; ctx.lineWidth = b * 3; ctx.globalAlpha = 0.15 * pulse;
          ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
          ctx.globalAlpha = 1;
          if (t % 20 < 7) {
            const c1 = (Math.floor(t / 20)) % 4, c2 = (c1 + 2) % 4;
            const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
            ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 1;
            ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.moveTo(x1, y1);
            const n = t & 31;
            let lx = x1, ly = y1;
            for (let s = 0; s < 6; s++) {
              lx += (x2 - x1) / 6 + SPARK_DX[(n + s) & 31] * 0.7;
              ly += (y2 - y1) / 6 + SPARK_DY[(n + s) & 31] * 0.7;
              ctx.lineTo(Math.max(b, Math.min(w - b, lx)), Math.max(b, Math.min(h - b, ly)));
            }
            ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 6: { // thunderClap — yellow heavy strobe burst
          const burst = t % 10;
          if (burst < 4) {
            const a = 1 - burst / 4;
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * (2 + burst);
            ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.globalAlpha = a * 0.8;
            ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 7: { // plasmaBolt — plasma discharges rotating around corners
          const ang = (t / 40) * Math.PI * 2;
          corners.forEach(([cx, cy], i) => {
            const ph = ang + i * Math.PI / 2;
            const r = b * 3;
            const ex = cx + Math.cos(ph) * r, ey = cy + Math.sin(ph) * r;
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
            ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(Math.max(0, Math.min(w, ex)), Math.max(0, Math.min(h, ey)));
            ctx.stroke();
            ctx.globalAlpha = 1;
          });
          ctx.shadowBlur = 0;
          break;
        }
        case 8: { // vantaLegend — multi-spark city electric (city skyline style)
          if (t % 5 === 0) {
            for (let i = 0; i < 3; i++) {
              const n = (t + i * 11) & 31;
              const side = n & 3;
              let sx: number, sy: number;
              if (side === 0) { sx = b + SPARK_X[n] * (w - b * 2); sy = b; }
              else if (side === 1) { sx = w - b; sy = b + SPARK_Y[n] * (h - b * 2); }
              else if (side === 2) { sx = b + SPARK_X[(n + 7) & 31] * (w - b * 2); sy = h - b; }
              else { sx = b; sy = b + SPARK_Y[(n + 13) & 31] * (h - b * 2); }
              ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
              ctx.shadowColor = color; ctx.shadowBlur = 4; ctx.globalAlpha = 0.8;
              ctx.beginPath(); ctx.moveTo(sx, sy);
              ctx.lineTo(sx + SPARK_DX[n] * 0.7, sy + SPARK_DY[n] * 0.7); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 9: { // executioner — hard red sharp glitch + scan
          const glitch = t % 8 < 2;
          if (glitch) {
            const n = t & 31;
            const ox = SPARK_DX[n] * 0.5;
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * 2;
            ctx.shadowColor = color; ctx.shadowBlur = 4; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.roundRect(b + ox, b, w - b * 2, h - b * 2, R); ctx.stroke();
            ctx.strokeStyle = color; ctx.lineWidth = b; ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.roundRect(b - ox * 0.5, b, w - b * 2, h - b * 2, R); ctx.stroke();
          }
          // scan stripe
          const scanY = ((t * 2.0) % (h + 12)) - 6;
          const sg = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
          sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "aa"); sg.addColorStop(1, color + "00");
          ctx.fillStyle = sg; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          ctx.fillRect(b, Math.max(b, scanY - 3), w - b * 2, 6);
          break;
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      t++;
    }

    // ── MYTHIC — 10 distinct matrix/cascade designs ─────────────────────────
    const M_HUE_SPEED = [4, 3, 5, 2, 6, 3.5, 0, 4.5, 7, 2.5];
    const M_DENSITY   = [8, 7, 7, 8, 6, 8, 9, 7, 6, 8];

    function drawMythic() {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);
      const hspd = M_HUE_SPEED[idx] ?? 4;
      const dens = M_DENSITY[idx] ?? 7;
      // architect (idx 6) is white, fixed
      const cc = idx === 6 ? "#e2e8f0" : hspd === 0 ? color : hsl2hex((t / hspd) % 360, 100, 60);

      ctx.strokeStyle = cc; ctx.lineWidth = b * 1.5;
      ctx.shadowColor = cc; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;

      const charSize = Math.max(5, b * 2);
      ctx.font = `${charSize}px monospace`;

      switch (idx) {
        case 0: { // matrixGreen — top+bottom chars
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.3 + x) / 4) % CHARS.length;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.55;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 3) % CHARS.length], x, h - 1);
          }
          break;
        }
        case 1: { // matrixBlue — all 4 sides chars with wave alpha
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.4 + x) / 4) % CHARS.length;
            const a = 0.4 + 0.4 * Math.abs(Math.sin((t + x) / 10));
            ctx.fillStyle = cc; ctx.globalAlpha = a;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 2) % CHARS.length], x, h - 1);
          }
          for (let y = dens; y < h - dens; y += dens) {
            const ci = Math.floor((t * 0.4 + y) / 4) % CHARS.length;
            const a = 0.4 + 0.4 * Math.abs(Math.sin((t + y) / 10));
            ctx.fillStyle = cc; ctx.globalAlpha = a;
            ctx.fillText(CHARS[ci], 0, y);
            ctx.fillText(CHARS[(ci + 4) % CHARS.length], w - dens, y);
          }
          break;
        }
        case 2: { // omega — all 4 sides + fast hue + pulsing size
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.6 + x) / 3) % CHARS.length;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.6;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 5) % CHARS.length], x, h - 1);
          }
          for (let y = dens; y < h - dens; y += dens) {
            const ci = Math.floor((t * 0.6 + y) / 3) % CHARS.length;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.6;
            ctx.fillText(CHARS[ci], 0, y);
            ctx.fillText(CHARS[(ci + 7) % CHARS.length], w - dens, y);
          }
          break;
        }
        case 3: { // voidWalker — orbiting void orbs
          const perim = 2 * (w + h);
          for (let i = 0; i < 5; i++) {
            const pos = (t * 2.5 + i * (perim / 5)) % perim;
            const [px2, py] = perimPt(pos, w, h, b);
            const a = 0.5 + 0.5 * Math.sin((t / 15 + i) * Math.PI * 2);
            ctx.beginPath(); ctx.arc(px2, py, b * (0.6 + a * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = cc; ctx.shadowBlur = 5 * a; ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 4: { // matrixGold — wealth cascade top+bottom, slower hue
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.25 + x) / 5) % CHARS.length;
            const a = 0.45 + 0.35 * Math.sin((t * 0.5 + x * 0.3));
            ctx.fillStyle = cc; ctx.globalAlpha = Math.max(0.1, a);
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 6) % CHARS.length], x, h - 1);
          }
          break;
        }
        case 5: { // matrixRed — virus cascade (all sides, blinking)
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.5 + x) / 3) % CHARS.length;
            const blink = (Math.floor((t + x) / 6) % 3 !== 0) ? 1 : 0;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.55 * blink;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 4) % CHARS.length], x, h - 1);
          }
          for (let y = dens; y < h - dens; y += dens) {
            const ci = Math.floor((t * 0.5 + y) / 3) % CHARS.length;
            const blink = (Math.floor((t + y) / 6) % 3 !== 0) ? 1 : 0;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.55 * blink;
            ctx.fillText(CHARS[ci], 0, y);
            ctx.fillText(CHARS[(ci + 8) % CHARS.length], w - dens, y);
          }
          break;
        }
        case 6: { // architect — slow elegant white chars top+bottom only
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.15 + x) / 8) % CHARS.length;
            const a = 0.25 + 0.35 * Math.sin((t * 0.08 + x * 0.5));
            ctx.fillStyle = "#e2e8f0"; ctx.globalAlpha = Math.max(0.05, a);
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 2) % CHARS.length], x, h - 1);
          }
          break;
        }
        case 7: { // nova2047 — pink nebula orbital + chars top
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.35 + x) / 4) % CHARS.length;
            const a = 0.3 + 0.4 * Math.abs(Math.sin((t * 0.6 + x * 0.4)));
            ctx.fillStyle = cc; ctx.globalAlpha = a;
            ctx.fillText(CHARS[ci], x, b + 2);
          }
          const perim = 2 * (w + h);
          for (let i = 0; i < 3; i++) {
            const pos = (t * 1.8 + i * (perim / 3)) % perim;
            const [px2, py] = perimPt(pos, w, h, b);
            const a = 0.5 + 0.5 * Math.sin((t / 12 + i * 2) * Math.PI * 2);
            ctx.beginPath(); ctx.arc(px2, py, b * (0.5 + a * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = cc; ctx.shadowBlur = 4 * a; ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 8: { // godMode — maximum chaos (all chars all sides + orbs)
          for (let x = 0; x < w; x += dens - 1) {
            const ci = Math.floor((t * 0.7 + x) / 2) % CHARS.length;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.7;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 6) % CHARS.length], x, h - 1);
          }
          for (let y = dens; y < h - dens; y += dens) {
            const ci = Math.floor((t * 0.7 + y) / 2) % CHARS.length;
            ctx.fillStyle = cc; ctx.globalAlpha = 0.7;
            ctx.fillText(CHARS[ci], 0, y);
            ctx.fillText(CHARS[(ci + 9) % CHARS.length], w - dens, y);
          }
          const perim = 2 * (w + h);
          for (let i = 0; i < 4; i++) {
            const pos = (t * 3.5 + i * (perim / 4)) % perim;
            const [px2, py] = perimPt(pos, w, h, b);
            ctx.beginPath(); ctx.arc(px2, py, b * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = cc; ctx.shadowBlur = 4; ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 9: { // theOne — matrix + orbits + corner bloom (unique combo)
          for (let x = 0; x < w; x += dens) {
            const ci = Math.floor((t * 0.45 + x) / 4) % CHARS.length;
            const a = 0.4 + 0.4 * Math.abs(Math.sin((t * 0.5 + x * 0.35)));
            ctx.fillStyle = cc; ctx.globalAlpha = a;
            ctx.fillText(CHARS[ci], x, b + 2);
            ctx.fillText(CHARS[(ci + 5) % CHARS.length], x, h - 1);
          }
          const perim = 2 * (w + h);
          for (let i = 0; i < 6; i++) {
            const pos = (t * 2.2 + i * (perim / 6)) % perim;
            const [px2, py] = perimPt(pos, w, h, b);
            const a = 0.5 + 0.5 * Math.abs(Math.sin((t / 10 + i)));
            ctx.beginPath(); ctx.arc(px2, py, b * (0.4 + a * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff"; ctx.shadowColor = cc; ctx.shadowBlur = 3 * a; ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      t++;
    }

    const drawMap: Record<FrameRarity, () => void> = {
      common: drawCommon,
      uncommon: drawUncommon,
      rare: drawRare,
      epic: drawEpic,
      legendary: drawLegendary,
      mythic: drawMythic,
    };

    const drawFn = drawMap[rarity] ?? drawCommon;
    const isStatic = rarity === "common";

    drawFn();
    if (isStatic) {
      observer.disconnect();
      return;
    }

    const tickId = registerAnim(() => drawFn());
    return () => {
      unregisterAnim(tickId);
      observer.disconnect();
    };
  }, [frame.id, rarity, idx, border, color]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: px,
        height: px,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 2,
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: border + 2,
          borderRadius: 3,
          overflow: "hidden",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
