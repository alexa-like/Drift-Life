import { useEffect, useRef } from "react";
import { getFrame } from "../lib/frames";
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

function perimPt(pos: number, W: number, H: number, bb: number): [number, number] {
  const perim = 2 * (W + H);
  const d = ((pos % perim) + perim) % perim;
  if (d < W) return [d, bb];
  if (d < W + H) return [W - bb, d - W];
  if (d < 2 * W + H) return [W - (d - W - H), H - bb];
  return [bb, H - (d - 2 * W - H)];
}

function octPath(ctx: CanvasRenderingContext2D, b: number, w: number, h: number) {
  const cut = Math.max(4, w * 0.18);
  ctx.beginPath();
  ctx.moveTo(b + cut, b); ctx.lineTo(w - b - cut, b);
  ctx.lineTo(w - b, b + cut); ctx.lineTo(w - b, h - b - cut);
  ctx.lineTo(w - b - cut, h - b); ctx.lineTo(b + cut, h - b);
  ctx.lineTo(b, h - b - cut); ctx.lineTo(b, b + cut);
  ctx.closePath();
}

function diamondPath(ctx: CanvasRenderingContext2D, w: number, h: number, margin: number) {
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, margin); ctx.lineTo(w - margin, cy);
  ctx.lineTo(cx, h - margin); ctx.lineTo(margin, cy);
  ctx.closePath();
}

const MATRIX_CHARS = "01アイウBC#!@$%░▓";

function hsl2hex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}

const SPARK_DX = Array.from({ length: 32 }, (_, i) => (seededRand(i + 50) - 0.5) * 14);
const SPARK_DY = Array.from({ length: 32 }, (_, i) => (seededRand(i + 150) - 0.5) * 14);
const SPARK_X  = Array.from({ length: 32 }, (_, i) => seededRand(i + 100));
const SPARK_Y  = Array.from({ length: 32 }, (_, i) => seededRand(i + 200));

function drawStatic(ctx: CanvasRenderingContext2D, frameId: string, w: number, h: number, b: number, color: string, R: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;

  switch (frameId) {
    case "ghostFrame": {
      ctx.globalAlpha = 0.13;
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "basicWhite": {
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      ctx.shadowBlur = 12; ctx.fillStyle = color;
      for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]] as const) {
        ctx.beginPath(); ctx.arc(cx, cy, b * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "basicGray": {
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 5;
      octPath(ctx, b, w, h); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case "neonBlue": {
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.lineWidth = b * 0.7; ctx.globalAlpha = 0.4; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b * 3.5, b * 3.5, w - b * 7, h - b * 7, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "neonGreen": {
      ctx.setLineDash([5, 3]); ctx.lineWidth = b * 1.5; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0;
      break;
    }
    case "neonRed": {
      ctx.lineWidth = b; ctx.shadowBlur = 4; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = b * 1.5; ctx.shadowBlur = 6;
      const sz = Math.max(7, w * 0.26);
      for (const [cx, cy, sx, sy] of [[b, b, 1, 1], [w - b, b, -1, 1], [b, h - b, 1, -1], [w - b, h - b, -1, -1]] as const) {
        for (let i = -sz; i < sz * 2; i += 4) {
          ctx.beginPath();
          ctx.moveTo(cx + sx * Math.max(0, i), cy + sy * Math.max(0, -i + sz));
          ctx.lineTo(cx + sx * Math.max(0, i + sz), cy + sy * Math.max(0, -i));
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "corpGray": {
      const arm = Math.max(7, w * 0.32);
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 8;
      for (const [cx, cy, sx, sy] of [[b, b, 1, 1], [w - b, b, -1, 1], [b, h - b, 1, -1], [w - b, h - b, -1, -1]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * arm);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "streetOrange": {
      ctx.lineWidth = b; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, R); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowBlur = 6;
      const step = Math.max(7, w / 4);
      for (let i = b; i <= w - b; i += step) {
        for (const y of [b, h - b]) { ctx.beginPath(); ctx.arc(i, y, b * 0.7, 0, Math.PI * 2); ctx.fill(); }
      }
      for (let j = b + step; j < h - b; j += step) {
        for (const x of [b, w - b]) { ctx.beginPath(); ctx.arc(x, j, b * 0.7, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "cyanPulse": {
      ctx.lineWidth = b; ctx.globalAlpha = 0.22; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = b * 1.5; ctx.shadowBlur = 8;
      const sz = Math.max(5, w * 0.2);
      for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]] as const) {
        ctx.beginPath(); ctx.moveTo(cx - sz * 0.5, cy - sz * 0.5); ctx.lineTo(cx + sz * 0.5, cy + sz * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + sz * 0.5, cy - sz * 0.5); ctx.lineTo(cx - sz * 0.5, cy + sz * 0.5); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "goldBasic": {
      ctx.lineWidth = b * 1.5; ctx.shadowBlur = 6;
      diamondPath(ctx, w, h, b * 0.5); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
  }
  ctx.globalAlpha = 1; ctx.setLineDash([]);
}

function drawAnimated(ctx: CanvasRenderingContext2D, frameId: string, w: number, h: number, b: number, color: string, R: number, t: number) {
  const perim = 2 * (w + h);
  const corners: [number, number][] = [[b, b], [w - b, b], [w - b, h - b], [b, h - b]];

  const drawOrbTail = (pos: number, tailLen: number) => {
    for (let i = 0; i < tailLen; i++) {
      const tp = ((pos - i * (perim * 0.07 / tailLen)) + perim * 20) % perim;
      const [px, py] = perimPt(tp, w, h, b);
      const alpha = (1 - i / tailLen) ** 1.8;
      ctx.beginPath(); ctx.arc(px, py, b * 0.8 * (1 - i / tailLen * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = color + Math.floor(alpha * 220).toString(16).padStart(2, "0");
      ctx.shadowColor = color; ctx.shadowBlur = alpha * 5; ctx.fill();
    }
    const [hx, hy] = perimPt(pos, w, h, b);
    ctx.beginPath(); ctx.arc(hx, hy, b, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 9; ctx.fill();
    ctx.shadowBlur = 0;
  };

  switch (frameId) {

    // ── UNCOMMON ─────────────────────────────────────────────────────────────

    case "shimmerCyan": {
      ctx.strokeStyle = color + "22"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      const segCount = 12, segLen = perim / segCount;
      const active = Math.floor(t / 3) % (segCount + 5);
      for (let i = 0; i < Math.min(active, segCount); i++) {
        const age = active - i;
        const alpha = Math.max(0, 1 - age * 0.08);
        const [x1, y1] = perimPt(i * segLen, w, h, b);
        const [x2, y2] = perimPt((i + 0.8) * segLen, w, h, b);
        ctx.strokeStyle = color + Math.floor(alpha * 190).toString(16).padStart(2, "0");
        ctx.lineWidth = b * 1.5; ctx.shadowColor = color; ctx.shadowBlur = alpha * 5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
        ctx.beginPath(); ctx.arc(x1, y1, b * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "shimmerPurple": {
      ctx.strokeStyle = color + "28"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      for (let c = 0; c < 2; c++) {
        const dir = c === 0 ? 1 : -1;
        const pos = ((t * 2.2 * dir) + c * perim * 0.5 + perim * 20) % perim;
        drawOrbTail(pos, 18);
      }
      break;
    }
    case "shimmerGold": {
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(t * 0.9) % 10;
      ctx.strokeStyle = color; ctx.lineWidth = b * 1.4;
      ctx.shadowColor = color; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0;
      break;
    }
    case "shimmerRed": {
      ctx.strokeStyle = color + "28"; ctx.lineWidth = b;
      octPath(ctx, b, w, h); ctx.stroke();
      for (let c = 0; c < 3; c++) {
        const pos = ((t * 2.8 + c * perim / 3) + perim * 20) % perim;
        drawOrbTail(pos, 12);
      }
      break;
    }
    case "shimmerGreen": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 3;
      ctx.shadowColor = color; ctx.shadowBlur = 2;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const pos = (t * 1.1 + perim * 20) % perim;
      drawOrbTail(pos, 50);
      break;
    }
    case "shimmerOrange": {
      ctx.strokeStyle = color + "32"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      const active = Math.floor(t / 8) % 4;
      const phase = (t % 8) / 8;
      const fa = Math.sin(phase * Math.PI);
      const [cx, cy] = corners[active];
      ctx.beginPath(); ctx.arc(cx, cy, b * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
      ctx.shadowColor = color; ctx.shadowBlur = fa * 11; ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "techShimmer": {
      ctx.strokeStyle = color + "22"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const ph = (t + i * 13) % 22;
        if (ph < 7) {
          const fa = Math.sin((ph / 7) * Math.PI);
          const pingPos = (SPARK_X[i & 31] * perim + i * 53) % perim;
          const [px, py] = perimPt(pingPos, w, h, b);
          ctx.beginPath(); ctx.arc(px, py, b * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(fa * 210).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = fa * 6; ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "suitShimmer": {
      ctx.strokeStyle = color + "48"; ctx.lineWidth = b * 0.7;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      const pos = (t * 0.65 + perim * 20) % perim;
      drawOrbTail(pos, 30);
      break;
    }
    case "crimsonShimmer": {
      ctx.strokeStyle = color + "22"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, R); ctx.stroke();
      const pos1 = (t * 2.5 + perim * 20) % perim;
      const [ox, oy] = perimPt(pos1, w, h, b);
      ctx.beginPath(); ctx.arc(ox, oy, b, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 7; ctx.fill();
      const ip = 2 * ((w - b * 6) + (h - b * 6));
      const pos2 = (ip * 20 - t * 1.8) % ip;
      const [ix, iy] = perimPt(pos2, w - b * 6, h - b * 6, b);
      ctx.beginPath(); ctx.arc(ix + b * 3, iy + b * 3, b * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "iceShimmer": {
      ctx.strokeStyle = color + "58"; ctx.lineWidth = b * 1.2;
      ctx.shadowColor = color; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 24; i++) {
        const pos = ((t * 0.32 + i * (perim / 24)) + perim * 20) % perim;
        const [px, py] = perimPt(pos, w, h, b);
        const fa = 0.18 + 0.42 * Math.abs(Math.sin((t * 0.045 + i * 0.4)));
        ctx.beginPath(); ctx.arc(px, py, b * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(fa * 190).toString(16).padStart(2, "0"); ctx.fill();
      }
      break;
    }

    // ── RARE ─────────────────────────────────────────────────────────────────

    case "pulseCyan": {
      const p = 0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 5 * p; ctx.globalAlpha = 0.3 + 0.7 * p;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "pulsePurple": {
      const p1 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2);
      const p2 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2 + Math.PI);
      ctx.strokeStyle = color; ctx.lineWidth = b;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4 * p1; ctx.globalAlpha = 0.25 + 0.75 * p1;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 4 * p2; ctx.globalAlpha = 0.25 + 0.75 * p2;
      ctx.beginPath(); ctx.roundRect(b * 2.8, b * 2.8, w - b * 5.6, h - b * 5.6, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "pulseGold": {
      ctx.strokeStyle = color + "38"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      const pos = (t * 1.4 + perim * 20) % perim;
      for (let i = 0; i < 14; i++) {
        const tp = ((pos - i * (perim * 0.09 / 14)) + perim * 20) % perim;
        const [px, py] = perimPt(tp, w, h, b);
        const fa = (1 - i / 14) ** 2;
        ctx.beginPath(); ctx.arc(px, py, b + b * fa * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(fa * 230).toString(16).padStart(2, "0");
        ctx.shadowColor = color; ctx.shadowBlur = fa * 9; ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "pulseRed": {
      const fast = 0.5 + 0.5 * Math.sin((t / 14) * Math.PI * 2);
      const flicker = seededRand(t & 15) > 0.85 ? 0.15 : 1.0;
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 4 * fast;
      ctx.globalAlpha = (0.4 + 0.6 * fast) * flicker;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "pulseGreen": {
      ctx.strokeStyle = color + "50"; ctx.lineWidth = b;
      ctx.shadowColor = color; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const sy = ((t * 1.1) % (h + 12)) - 6;
      const sg = ctx.createLinearGradient(0, sy - 4, 0, sy + 4);
      sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "cc"); sg.addColorStop(1, color + "00");
      ctx.fillStyle = sg; ctx.fillRect(b, Math.max(b, sy - 4), w - b * 2, 8);
      break;
    }
    case "hackerPulse": {
      ctx.strokeStyle = color + "32"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      corners.forEach(([cx, cy], i) => {
        const phase = (t / 24 + i * 0.25) * Math.PI * 2;
        const fa = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(phase));
        const r = b * (1.6 + Math.sin(phase) * 0.9);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(fa * 180).toString(16).padStart(2, "0");
        ctx.shadowColor = color; ctx.shadowBlur = 4 * fa; ctx.fill();
      });
      ctx.shadowBlur = 0;
      break;
    }
    case "corePulse": {
      const p = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 36) * Math.PI * 2));
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 5 * p; ctx.globalAlpha = 0.35 + 0.65 * p;
      octPath(ctx, b, w, h); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "vaultPulse": {
      const p1 = 0.5 + 0.5 * Math.sin((t / 55) * Math.PI * 2);
      const p2 = 0.5 + 0.5 * Math.sin((t / 55) * Math.PI * 2 + Math.PI * 0.6);
      ctx.strokeStyle = color; ctx.lineWidth = b * 3.5;
      ctx.globalAlpha = 0.12 + 0.28 * p1; ctx.shadowColor = color; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.lineWidth = b; ctx.globalAlpha = 0.45 + 0.55 * p2; ctx.shadowBlur = 5 * p2;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "streetPulse": {
      const on = Math.floor(t / 4) % 3 !== 2;
      if (on) {
        const p = 0.4 + 0.6 * ((t % 4) / 4);
        ctx.strokeStyle = color; ctx.lineWidth = b * 2;
        ctx.shadowColor = color; ctx.shadowBlur = 4 * p; ctx.globalAlpha = 0.6 + 0.4 * p;
        ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }
    case "spectralPulse": {
      const d = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin((t / 60) * Math.PI * 2));
      const g = 0.1 + 0.35 * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2 + 1.3));
      ctx.strokeStyle = color; ctx.lineWidth = b * 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 3; ctx.globalAlpha = d;
      diamondPath(ctx, w, h, b * 0.5); ctx.stroke();
      ctx.globalAlpha = g;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }

    // ── EPIC ─────────────────────────────────────────────────────────────────

    case "epicCyan": {
      const cx2 = w / 2, cy2 = h / 2;
      const ang = (t / 70) * Math.PI * 2;
      const grad = ctx.createConicGradient(ang, cx2, cy2);
      grad.addColorStop(0, color); grad.addColorStop(0.07, color + "80");
      grad.addColorStop(0.22, color + "08"); grad.addColorStop(0.99, color + "08"); grad.addColorStop(1, color);
      ctx.strokeStyle = grad; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case "epicPurple": {
      const cx2 = w / 2, cy2 = h / 2;
      const a1 = (t / 55) * Math.PI * 2, a2 = -(t / 90) * Math.PI * 2;
      const g1 = ctx.createConicGradient(a1, cx2, cy2);
      g1.addColorStop(0, color); g1.addColorStop(0.09, color + "60"); g1.addColorStop(0.28, color + "05"); g1.addColorStop(1, color + "05");
      const g2 = ctx.createConicGradient(a2, cx2, cy2);
      g2.addColorStop(0, color + "80"); g2.addColorStop(0.14, color + "20"); g2.addColorStop(0.99, color + "20"); g2.addColorStop(1, color + "80");
      ctx.lineWidth = b * 2; ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.strokeStyle = g1; octPath(ctx, b, w, h); ctx.stroke();
      ctx.lineWidth = b; ctx.shadowBlur = 3;
      ctx.strokeStyle = g2; octPath(ctx, b, w, h); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case "epicGold": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      const segCount = 8, cycle = Math.floor(t / 4) % (segCount + 6);
      for (let i = 0; i < segCount; i++) {
        const startPos = (i / segCount) * perim, endPos = ((i + 0.86) / segCount) * perim;
        const age = cycle - i;
        if (age < 0) continue;
        const fa = Math.max(0, 1 - age * 0.13);
        const [x1, y1] = perimPt(startPos, w, h, b);
        const [x2, y2] = perimPt(endPos, w, h, b);
        ctx.strokeStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
        ctx.lineWidth = b * 2; ctx.shadowColor = color; ctx.shadowBlur = fa * 7;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "syndicate": {
      ctx.strokeStyle = color + "70"; ctx.lineWidth = b;
      ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color + "28"; ctx.lineWidth = b * 4; ctx.shadowBlur = 2;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const scanY = ((t * 1.5) % (h + 14)) - 7;
      const fg = ctx.createLinearGradient(0, scanY - 5, 0, scanY + 5);
      fg.addColorStop(0, "#ff6b3500"); fg.addColorStop(0.5, "#ff6b35dd"); fg.addColorStop(1, "#ff6b3500");
      ctx.fillStyle = fg; ctx.fillRect(b, Math.max(b, scanY - 5), w - b * 2, 10);
      for (let i = 0; i < 3; i++) {
        const ex = b + seededRand((t + i * 19) & 255) * (w - b * 2);
        const ey = scanY - seededRand((t + i * 37) & 255) * 8;
        if (ey > b && ey < h - b) { ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, Math.PI * 2); ctx.fillStyle = "#ffffff80"; ctx.fill(); }
      }
      break;
    }
    case "epicRed": {
      ctx.strokeStyle = color + "60"; ctx.lineWidth = b;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color + "28"; ctx.lineWidth = b * 5; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const scanY = ((t * 2.3) % (h + 16)) - 8;
      const pg = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
      pg.addColorStop(0, color + "00"); pg.addColorStop(0.5, color + "ff"); pg.addColorStop(1, color + "00");
      ctx.fillStyle = pg; ctx.fillRect(b, Math.max(b, scanY - 6), w - b * 2, 12);
      break;
    }
    case "gridCore": {
      ctx.strokeStyle = color + "40"; ctx.lineWidth = b;
      ctx.beginPath(); ctx.rect(b, b, w - b * 2, h - b * 2); ctx.stroke();
      const cell = Math.max(4, w / 7);
      for (let x = b; x < w - b; x += cell) {
        for (const y of [b, h - b - cell]) {
          const blink = Math.floor((t + x * 0.3 + y * 0.5) / 6) % 3;
          const fa = blink === 0 ? 0.85 : blink === 1 ? 0.25 : 0.05;
          ctx.fillStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = fa * 5;
          ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "suitsFrame": {
      ctx.strokeStyle = color + "60"; ctx.lineWidth = b;
      ctx.shadowColor = color; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const ang = (t / 80) * Math.PI * 2;
      corners.forEach(([cx, cy], i) => {
        const ph = ang + i * Math.PI / 2;
        const dx = Math.cos(ph) * b * 2.5, dy = Math.sin(ph) * b * 2.5;
        ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(ph + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -b * 0.85); ctx.lineTo(b * 0.85, 0); ctx.lineTo(0, b * 0.85); ctx.lineTo(-b * 0.85, 0);
        ctx.closePath();
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill();
        ctx.restore();
      });
      ctx.shadowBlur = 0;
      break;
    }
    case "epicVoid": {
      ctx.strokeStyle = color + "70"; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color + "22"; ctx.lineWidth = b * 5; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      if (t % 3 === 0) {
        const n = (t >> 2) & 31;
        for (let i = 0; i < 2; i++) {
          const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
          const [sx, sy] = perimPt(pos, w, h, b);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.9;
          ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.globalAlpha = 0.72;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + SPARK_DX[(n + i * 3) & 31] * 0.6, sy + SPARK_DY[(n + i * 5) & 31] * 0.6);
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
      }
      break;
    }
    case "epicInferno": {
      const fa = seededRand(t & 31);
      const fb = seededRand((t + 7) & 31);
      const p = 0.5 + 0.5 * Math.sin((t / 8) * Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = b * (2 + fa * 2);
      ctx.shadowColor = color; ctx.shadowBlur = 3 + fb * 8; ctx.globalAlpha = 0.5 + 0.5 * p;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.lineWidth = b; ctx.shadowBlur = fa * 4; ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#ffffff30";
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "epicNova": {
      const cx2 = w / 2, cy2 = h / 2;
      const a1 = (t / 45) * Math.PI * 2;
      const g1 = ctx.createConicGradient(a1, cx2, cy2);
      g1.addColorStop(0, color); g1.addColorStop(0.08, color + "80"); g1.addColorStop(0.5, color + "08");
      g1.addColorStop(0.58, color + "80"); g1.addColorStop(0.66, color + "08"); g1.addColorStop(1, color);
      ctx.strokeStyle = g1; ctx.lineWidth = b * 2;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      const burst = 0.5 + 0.5 * Math.sin((t / 28) * Math.PI * 2);
      ctx.strokeStyle = color + "30"; ctx.lineWidth = b * 4;
      ctx.shadowBlur = 4 + 4 * burst; ctx.globalAlpha = 0.12 + 0.18 * burst;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }

    // ── LEGENDARY ─────────────────────────────────────────────────────────────

    case "legendCyan": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      if (t % 4 === 0) {
        const n = (t >> 2) & 31;
        for (let i = 0; i < 2; i++) {
          const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
          const [sx, sy] = perimPt(pos, w, h, b);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
          ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + SPARK_DX[(n + i * 3) & 31] * 0.8, sy + SPARK_DY[(n + i * 5) & 31] * 0.8);
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
      }
      break;
    }
    case "legendPurple": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      if (t % 18 < 7) {
        const c1 = Math.floor(t / 18) % 4, c2 = (c1 + 2) % 4;
        const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2;
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.9 * (1 - (t % 18) / 7);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        let lx = x1, ly = y1;
        const n = (t >> 1) & 31;
        for (let s = 0; s < 5; s++) {
          lx += (x2 - x1) / 5 + SPARK_DX[(n + s) & 31] * 0.7;
          ly += (y2 - y1) / 5 + SPARK_DY[(n + s) & 31] * 0.7;
          ctx.lineTo(Math.max(b, Math.min(w - b, lx)), Math.max(b, Math.min(h - b, ly)));
        }
        ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }
    case "legendGold": {
      const glitch = t % 14 < 4;
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      if (glitch) {
        const ox = SPARK_DX[t & 31] * 0.5;
        ctx.strokeStyle = "#ff000060"; ctx.lineWidth = b * 2;
        ctx.beginPath(); ctx.roundRect(b + ox, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.strokeStyle = "#00ff0050"; ctx.lineWidth = b * 1.5;
        ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.strokeStyle = "#4488ff70"; ctx.lineWidth = b * 2;
        ctx.beginPath(); ctx.roundRect(b - ox, b, w - b * 2, h - b * 2, R); ctx.stroke();
      } else {
        ctx.strokeStyle = color; ctx.lineWidth = b * 2;
        ctx.shadowColor = color; ctx.shadowBlur = 7;
        ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case "legendRed": {
      const period = t % 60, hb = period < 8 ? 0.2 + 0.8 * Math.sin((period / 8) * Math.PI)
        : period >= 14 && period < 26 ? 0.2 + Math.sin(((period - 14) / 12) * Math.PI) : 0.2;
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 10 * hb;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.globalAlpha = 0.2 + 0.8 * hb; ctx.shadowBlur = 8 * hb;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "crimsonLord": {
      const offset = 1 + (0.5 + 0.5 * Math.sin((t / 22) * Math.PI * 2)) * 2;
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = b * 2;
      ctx.strokeStyle = "#ff000070";
      ctx.beginPath(); ctx.roundRect(b - offset, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#00ff0050";
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#4488ff70";
      ctx.beginPath(); ctx.roundRect(b + offset, b, w - b * 2, h - b * 2, R); ctx.stroke();
      break;
    }
    case "arcLight": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const arcStart = (t * 0.55) % perim, arcLen = perim * 0.2;
      for (let i = 0; i < 18; i++) {
        const pos = (arcStart + (i / 18) * arcLen + perim * 20) % perim;
        const [px, py] = perimPt(pos, w, h, b);
        const fade = Math.sin((i / 18) * Math.PI);
        const jitter = SPARK_DX[(Math.floor(t * 0.1 + i) & 31)] * 0.18;
        ctx.beginPath(); ctx.arc(px + jitter, py + jitter * 0.5, b * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = fade * 8;
        ctx.globalAlpha = fade * 0.9; ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "plasmaBolt": {
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const bp = t % 70;
      if (bp < 30) {
        const progress = bp / 30;
        const ba = bp < 15 ? progress * 2 : 2 - progress * 2;
        const bY = b + progress * (h - b * 2);
        let lx = w / 2;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
        ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.globalAlpha = ba * 0.9;
        ctx.beginPath(); ctx.moveTo(lx, b);
        for (let s = 0; s < 6; s++) {
          const sy2 = b + (s / 6) * (bY - b);
          lx += SPARK_DX[(t + s * 3) & 31] * 0.4;
          lx = Math.max(b + 2, Math.min(w - b - 2, lx));
          ctx.lineTo(lx, sy2);
        }
        ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }
    case "thunderClap": {
      const phase = t % 80;
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      if (phase < 12) {
        const ba = Math.sin((phase / 12) * Math.PI);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * (2 + phase * 0.5);
        ctx.shadowColor = color; ctx.shadowBlur = 12 * ba; ctx.globalAlpha = ba * 0.85;
        ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = color; ctx.lineWidth = b * 2;
        ctx.shadowColor = color; ctx.shadowBlur = 7;
        ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case "vantaLegend": {
      const va = 0.04 + 0.96 * Math.pow(0.5 + 0.5 * Math.sin((t / 90) * Math.PI * 2), 2);
      ctx.strokeStyle = color + "15"; ctx.lineWidth = b * 8;
      ctx.shadowColor = color; ctx.shadowBlur = 15 * va; ctx.globalAlpha = va;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.lineWidth = b * 2; ctx.shadowBlur = 10 * va;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "executioner": {
      const throb = 0.5 + 0.5 * Math.sin((t / 70) * Math.PI * 2);
      ctx.strokeStyle = color + "18"; ctx.lineWidth = b * 7;
      ctx.shadowColor = color; ctx.shadowBlur = 10 + 5 * throb;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2;
      ctx.globalAlpha = 0.4 + 0.6 * throb; ctx.shadowBlur = 7 * throb;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (throb > 0.95) {
        const fa = (throb - 0.95) / 0.05;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * 3;
        ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.globalAlpha = fa * 0.8;
        ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }

    // ── MYTHIC ────────────────────────────────────────────────────────────────

    case "matrixGreen": {
      const cc = hsl2hex((t / 4) % 360, 100, 60);
      ctx.strokeStyle = "#39d35350"; ctx.lineWidth = b * 6;
      ctx.shadowColor = cc; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#39d353"; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const cs = Math.max(5, b * 2);
      ctx.font = `${cs}px monospace`;
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * 0.3 + x) / 4) % MATRIX_CHARS.length;
        ctx.fillStyle = cc; ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin((t + x) / 10));
        ctx.fillText(MATRIX_CHARS[ci], x, b + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 3) % MATRIX_CHARS.length], x, h - 1);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "matrixBlue": {
      const cc = hsl2hex((200 + (t / 3) % 40), 100, 60);
      ctx.strokeStyle = cc + "50"; ctx.lineWidth = b * 6;
      ctx.shadowColor = cc; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = cc; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const cs = Math.max(5, b * 2);
      ctx.font = `${cs}px monospace`;
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * 0.4 + x) / 4) % MATRIX_CHARS.length;
        const fa = 0.35 + 0.45 * Math.abs(Math.sin((t + x) / 8));
        ctx.fillStyle = cc; ctx.globalAlpha = fa;
        ctx.fillText(MATRIX_CHARS[ci], x, b + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 2) % MATRIX_CHARS.length], x, h - 1);
      }
      for (let y = cs; y < h - cs; y += cs + 1) {
        const ci = Math.floor((t * 0.4 + y) / 4) % MATRIX_CHARS.length;
        const fa = 0.35 + 0.45 * Math.abs(Math.sin((t + y) / 8));
        ctx.fillStyle = cc; ctx.globalAlpha = fa;
        ctx.fillText(MATRIX_CHARS[ci], 0, y);
        ctx.fillText(MATRIX_CHARS[(ci + 4) % MATRIX_CHARS.length], w - cs, y);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "matrixGold": {
      const cc = hsl2hex((40 + (t / 6) % 20), 100, 55);
      ctx.strokeStyle = "#f59e0b50"; ctx.lineWidth = b * 6;
      ctx.shadowColor = cc; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const cs = Math.max(5, b * 2);
      ctx.font = `${cs}px monospace`;
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * 0.2 + x) / 6) % MATRIX_CHARS.length;
        const fa = 0.4 + 0.35 * Math.abs(Math.sin((t * 0.5 + x * 0.3)));
        ctx.fillStyle = cc; ctx.globalAlpha = fa;
        ctx.fillText(MATRIX_CHARS[ci], x, b + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 6) % MATRIX_CHARS.length], x, h - 1);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "matrixRed": {
      const cc = hsl2hex((0 + (t / 4) % 15), 100, 55);
      ctx.strokeStyle = "#ff2d5550"; ctx.lineWidth = b * 6;
      ctx.shadowColor = cc; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#ff2d55"; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const cs = Math.max(5, b * 2);
      ctx.font = `${cs}px monospace`;
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * 0.5 + x) / 3) % MATRIX_CHARS.length;
        const blink = (Math.floor((t + x) / 5) % 3 !== 0) ? 1 : 0;
        ctx.fillStyle = cc; ctx.globalAlpha = 0.55 * blink;
        ctx.fillText(MATRIX_CHARS[ci], x, b + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 4) % MATRIX_CHARS.length], x, h - 1);
      }
      for (let y = cs; y < h - cs; y += cs + 1) {
        const ci = Math.floor((t * 0.5 + y) / 3) % MATRIX_CHARS.length;
        const blink = (Math.floor((t + y) / 5) % 3 !== 0) ? 1 : 0;
        ctx.fillStyle = cc; ctx.globalAlpha = 0.55 * blink;
        ctx.fillText(MATRIX_CHARS[ci], 0, y);
        ctx.fillText(MATRIX_CHARS[(ci + 8) % MATRIX_CHARS.length], w - cs, y);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "voidWalker": {
      ctx.strokeStyle = color + "50"; ctx.lineWidth = b * 6;
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const cx2 = w / 2, cy2 = h / 2;
      for (let i = 0; i < 12; i++) {
        const lp = ((t + i * 17) % 30) / 30;
        const sp = (SPARK_X[i & 31] * perim + i * 47) % perim;
        const [sx, sy] = perimPt(sp, w, h, b);
        const px = sx + (cx2 - sx) * lp, py = sy + (cy2 - sy) * lp;
        const fa = Math.sin(lp * Math.PI) * 0.7;
        ctx.beginPath(); ctx.arc(px, py, b * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 5 * fa;
        ctx.globalAlpha = fa; ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "nova2047": {
      const cx2 = w / 2, cy2 = h / 2;
      const a1 = (t / 40) * Math.PI * 2, a2 = -(t / 65) * Math.PI * 2;
      const g1 = ctx.createConicGradient(a1, cx2, cy2);
      g1.addColorStop(0, color); g1.addColorStop(0.12, color + "60"); g1.addColorStop(0.5, color + "08"); g1.addColorStop(0.62, color + "60"); g1.addColorStop(1, color);
      const g2 = ctx.createConicGradient(a2, cx2, cy2);
      g2.addColorStop(0, "#ffffff30"); g2.addColorStop(0.5, color + "10"); g2.addColorStop(1, "#ffffff30");
      ctx.strokeStyle = color + "40"; ctx.lineWidth = b * 6;
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = g1; ctx.lineWidth = b * 2.5; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = g2; ctx.lineWidth = b; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const rp = (t % 40) / 40;
      ctx.strokeStyle = color + Math.floor((1 - rp) * 80).toString(16).padStart(2, "0");
      ctx.lineWidth = 1; ctx.globalAlpha = 1 - rp;
      const exp = rp * 10;
      ctx.beginPath(); ctx.roundRect(b - exp, b - exp, w - b * 2 + exp * 2, h - b * 2 + exp * 2, R + exp); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "godMode": {
      const cc = hsl2hex((50 + (t / 5) % 20), 100, 60);
      ctx.strokeStyle = cc + "40"; ctx.lineWidth = b * 7;
      ctx.shadowColor = cc; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b * 2; ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      for (let r = 0; r < 3; r++) {
        const rp = ((t + r * 26) % 55) / 55;
        const exp = rp * 12;
        ctx.strokeStyle = cc + Math.floor((1 - rp) * 100).toString(16).padStart(2, "0");
        ctx.lineWidth = 1.5 - rp; ctx.globalAlpha = (1 - rp) * 0.8;
        ctx.beginPath(); ctx.roundRect(b - exp, b - exp, w - b * 2 + exp * 2, h - b * 2 + exp * 2, R + exp); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      break;
    }
    case "omega": {
      const cc = hsl2hex((t / 2) % 360, 100, 60);
      ctx.strokeStyle = cc + "40"; ctx.lineWidth = b * 7;
      ctx.shadowColor = cc; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = cc; ctx.lineWidth = b * 2.5; ctx.shadowBlur = 10;
      const fl = 0.7 + 0.3 * Math.abs(Math.sin((t / 7) * Math.PI));
      ctx.globalAlpha = fl;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (t % 2 === 0) {
        const n = (t >> 1) & 31;
        for (let i = 0; i < 3; i++) {
          const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
          const [sx, sy] = perimPt(pos, w, h, b);
          const sc = hsl2hex((t / 2 + i * 40) % 360, 100, 75);
          ctx.strokeStyle = sc; ctx.lineWidth = 1;
          ctx.shadowColor = sc; ctx.shadowBlur = 5; ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + SPARK_DX[(n + i) & 31] * 0.7, sy + SPARK_DY[(n + i) & 31] * 0.7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }
    case "architect": {
      ctx.strokeStyle = "#e2e8f040"; ctx.lineWidth = b * 6;
      ctx.shadowColor = "#e2e8f0"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = b * 2; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(b, b, w - b * 2, h - b * 2, R); ctx.stroke();
      ctx.shadowBlur = 0;
      const step = Math.max(5, w / 6);
      const rot = (t / 200) * Math.PI * 2;
      for (let i = 0; i < Math.ceil(perim / step); i++) {
        const pos = ((i * step + t * 0.25) + perim * 20) % perim;
        const [px, py] = perimPt(pos, w, h, b);
        const fa = 0.3 + 0.5 * Math.abs(Math.sin((t * 0.04 + i * 0.5)));
        ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
        ctx.fillStyle = "#ffffff"; ctx.globalAlpha = fa;
        ctx.fillRect(-b * 0.4, -b * 0.4, b * 0.8, b * 0.8);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "theOne": {
      const cc = hsl2hex((t / 2.5) % 360, 100, 65);
      const cx2 = w / 2, cy2 = h / 2;
      for (let layer = 0; layer < 3; layer++) {
        const a = ((t / (40 + layer * 25)) * Math.PI * 2) * (layer % 2 === 0 ? 1 : -1);
        const lc = hsl2hex((t / 2.5 + layer * 120) % 360, 100, 65);
        const g = ctx.createConicGradient(a, cx2, cy2);
        g.addColorStop(0, lc); g.addColorStop(0.08, lc + "40"); g.addColorStop(0.5, lc + "05"); g.addColorStop(1, lc);
        ctx.strokeStyle = g;
        ctx.lineWidth = layer === 0 ? b * 3 : b * (2 - layer * 0.4);
        ctx.shadowColor = lc; ctx.shadowBlur = 5 + layer * 2;
        ctx.beginPath(); ctx.roundRect(b + layer, b + layer, w - b * 2 - layer * 2, h - b * 2 - layer * 2, R); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const cs = Math.max(4, b * 1.8);
      ctx.font = `${cs}px monospace`;
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * 0.5 + x) / 3) % MATRIX_CHARS.length;
        ctx.fillStyle = cc; ctx.globalAlpha = 0.45;
        ctx.fillText(MATRIX_CHARS[ci], x, b + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 5) % MATRIX_CHARS.length], x, h - 1);
      }
      ctx.globalAlpha = 1;
      if (t % 20 < 6) {
        const c1 = Math.floor(t / 20) % 4, c2 = (c1 + 2) % 4;
        const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
        ctx.shadowColor = cc; ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.85 * (1 - (t % 20) / 6);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        let lx = x1, ly = y1;
        const n = (t >> 1) & 31;
        for (let s = 0; s < 5; s++) {
          lx += (x2 - x1) / 5 + SPARK_DX[(n + s) & 31] * 0.5;
          ly += (y2 - y1) / 5 + SPARK_DY[(n + s) & 31] * 0.5;
          ctx.lineTo(Math.max(b, Math.min(w - b, lx)), Math.max(b, Math.min(h - b, ly)));
        }
        ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      break;
    }
  }
}

export function PlayerFrame({ frameId, size = "md", children, style, className }: Props) {
  const frame = getFrame(frameId);
  const px = SIZE_PX[size];
  const border = BORDER_PX[size];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    const R = 3;
    const color = frame.glowColor;

    if (frame.rarity === "common") {
      drawStatic(ctx, frame.id, w, h, b, color, R);
      return () => observer.disconnect();
    }

    let t = 0;
    const animId = registerAnim(() => {
      if (!visibleRef.current) return;
      ctx.clearRect(0, 0, w, h);
      drawAnimated(ctx, frame.id, w, h, b, color, R, t);
      t++;
    });

    return () => { unregisterAnim(animId); observer.disconnect(); };
  }, [frame.id, frame.rarity, frame.glowColor, px, border]);

  return (
    <div
      style={{ position: "relative", width: px, height: px, flexShrink: 0, ...style }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        style={{
          position: "absolute",
          inset: border,
          borderRadius: 2,
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
