import { useEffect, useRef, ReactNode, CSSProperties } from "react";
import { getFrame } from "../lib/frames";
import { registerAnim, unregisterAnim, seededRand } from "../lib/animTicker";

interface Props {
  frameId?: string | null;
  colorOverride?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  borderRadius?: number;
}

const MATRIX_CHARS = "01アイウBC#!@$%░▓";

function hsl2hex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}

function perimPt(pos: number, W: number, H: number, bb: number): [number, number] {
  const perim = 2 * (W + H);
  const d = ((pos % perim) + perim) % perim;
  if (d < W) return [d, bb];
  if (d < W + H) return [W - bb, d - W];
  if (d < 2 * W + H) return [W - (d - W - H), H - bb];
  return [bb, H - (d - 2 * W - H)];
}

const SPARK_DX = Array.from({ length: 32 }, (_, i) => (seededRand(i + 50) - 0.5) * 20);
const SPARK_DY = Array.from({ length: 32 }, (_, i) => (seededRand(i + 150) - 0.5) * 20);
const SPARK_X  = Array.from({ length: 32 }, (_, i) => seededRand(i + 100));
const SPARK_Y  = Array.from({ length: 32 }, (_, i) => seededRand(i + 200));

function drawCard(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  t: number,
  frameId: string,
  rarity: string,
  color: string,
  br: number,
) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (w === 0 || h === 0) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  const ins = 1.5;
  const r = Math.max(0, br - ins);
  const perim = 2 * (w + h);
  const corners: [number, number][] = [[ins, ins], [w - ins, ins], [w - ins, h - ins], [ins, h - ins]];

  const path = () => {
    ctx.beginPath();
    ctx.roundRect(ins, ins, w - ins * 2, h - ins * 2, r);
  };

  const octPath = () => {
    const cut = Math.min(20, Math.min(w, h) * 0.12);
    ctx.beginPath();
    ctx.moveTo(ins + cut, ins); ctx.lineTo(w - ins - cut, ins);
    ctx.lineTo(w - ins, ins + cut); ctx.lineTo(w - ins, h - ins - cut);
    ctx.lineTo(w - ins - cut, h - ins); ctx.lineTo(ins + cut, h - ins);
    ctx.lineTo(ins, h - ins - cut); ctx.lineTo(ins, ins + cut);
    ctx.closePath();
  };

  const drawOrbTail = (pos: number, tailLen: number) => {
    for (let i = 0; i < tailLen; i++) {
      const tp = ((pos - i * (perim * 0.06 / tailLen)) + perim * 20) % perim;
      const [px, py] = perimPt(tp, w, h, ins);
      const fa = (1 - i / tailLen) ** 1.8;
      ctx.beginPath(); ctx.arc(px, py, 2.5 * (1 - i / tailLen * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = color + Math.floor(fa * 220).toString(16).padStart(2, "0");
      ctx.shadowColor = color; ctx.shadowBlur = fa * 8; ctx.fill();
    }
    const [hx, hy] = perimPt(pos, w, h, ins);
    ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fill();
    ctx.shadowBlur = 0;
  };

  // ── COMMON — static designs ───────────────────────────────────────────────
  if (rarity === "common") {
    ctx.strokeStyle = color; ctx.shadowColor = color;

    switch (frameId) {
      case "ghostFrame":
        ctx.globalAlpha = 0.13; ctx.lineWidth = 1.5; ctx.shadowBlur = 3;
        path(); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      case "basicWhite":
        ctx.strokeStyle = color + "80"; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        ctx.fillStyle = color; ctx.shadowBlur = 12;
        for (const [cx, cy] of corners) { ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.shadowBlur = 0;
        break;
      case "basicGray":
        ctx.strokeStyle = color + "80"; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        octPath(); ctx.stroke(); ctx.shadowBlur = 0;
        break;
      case "neonBlue":
        ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        path(); ctx.stroke();
        ctx.lineWidth = 0.8; ctx.globalAlpha = 0.4; ctx.shadowBlur = 3;
        ctx.beginPath(); ctx.roundRect(ins + 8, ins + 8, w - ins * 2 - 16, h - ins * 2 - 16, Math.max(0, r - 8)); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      case "neonGreen":
        ctx.setLineDash([8, 5]); ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        path(); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        break;
      case "neonRed": {
        ctx.strokeStyle = color + "50"; ctx.lineWidth = 1; ctx.shadowBlur = 4; ctx.globalAlpha = 0.5;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.shadowBlur = 6;
        const sz = 22;
        for (const [cx, cy, sx, sy] of [[ins, ins, 1, 1], [w - ins, ins, -1, 1], [ins, h - ins, 1, -1], [w - ins, h - ins, -1, -1]] as const) {
          for (let i = -sz; i < sz * 2; i += 5) {
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
        const arm = Math.min(28, Math.min(w, h) * 0.22);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 9;
        for (const [cx, cy, sx, sy] of [[ins, ins, 1, 1], [w - ins, ins, -1, 1], [ins, h - ins, 1, -1], [w - ins, h - ins, -1, -1]] as const) {
          ctx.beginPath(); ctx.moveTo(cx + sx * arm, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * arm); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "streetOrange": {
        ctx.strokeStyle = color + "80"; ctx.lineWidth = 1; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.roundRect(ins + 9, ins + 9, w - ins * 2 - 18, h - ins * 2 - 18, Math.max(0, r - 9)); ctx.stroke();
        ctx.fillStyle = color; ctx.shadowBlur = 8;
        const step = Math.max(14, w / 8);
        for (let xi = ins; xi <= w - ins; xi += step) {
          for (const yy of [ins, h - ins]) { ctx.beginPath(); ctx.arc(xi, yy, 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
        for (let yi = ins + step; yi < h - ins; yi += step) {
          for (const xx of [ins, w - ins]) { ctx.beginPath(); ctx.arc(xx, yi, 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "cyanPulse": {
        ctx.strokeStyle = color + "30"; ctx.lineWidth = 1; ctx.shadowBlur = 4; ctx.globalAlpha = 0.4;
        path(); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 10;
        const sz = Math.min(18, Math.min(w, h) * 0.12);
        for (const [cx, cy] of corners) {
          ctx.beginPath(); ctx.moveTo(cx - sz * 0.6, cy - sz * 0.6); ctx.lineTo(cx + sz * 0.6, cy + sz * 0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + sz * 0.6, cy - sz * 0.6); ctx.lineTo(cx - sz * 0.6, cy + sz * 0.6); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "goldBasic":
        ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5; ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(w / 2, ins); ctx.lineTo(w - ins, h / 2); ctx.lineTo(w / 2, h - ins); ctx.lineTo(ins, h / 2);
        ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0;
        break;
    }
    return;
  }

  // ── UNCOMMON ──────────────────────────────────────────────────────────────
  if (rarity === "uncommon") {
    switch (frameId) {
      case "shimmerCyan": {
        ctx.strokeStyle = color + "22"; ctx.lineWidth = 1.5; path(); ctx.stroke();
        const segCount = 16, segLen = perim / segCount;
        const active = Math.floor(t / 3) % (segCount + 5);
        for (let i = 0; i < Math.min(active, segCount); i++) {
          const age = active - i, fa = Math.max(0, 1 - age * 0.07);
          const [x1, y1] = perimPt(i * segLen, w, h, ins);
          const [x2, y2] = perimPt((i + 0.82) * segLen, w, h, ins);
          ctx.strokeStyle = color + Math.floor(fa * 190).toString(16).padStart(2, "0");
          ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = fa * 7;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.fillStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
          ctx.beginPath(); ctx.arc(x1, y1, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "shimmerPurple": {
        ctx.strokeStyle = color + "28"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        for (let c = 0; c < 2; c++) {
          const dir = c === 0 ? 1 : -1;
          const pos = ((t * 2.5 * dir) + c * perim * 0.5 + perim * 20) % perim;
          drawOrbTail(pos, 22);
        }
        break;
      }
      case "shimmerGold":
        ctx.setLineDash([8, 5]); ctx.lineDashOffset = -(t * 1.0) % 13;
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 6;
        path(); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        break;
      case "shimmerRed": {
        ctx.strokeStyle = color + "28"; ctx.lineWidth = 1.5; octPath(); ctx.stroke();
        for (let c = 0; c < 3; c++) {
          const pos = ((t * 3.0 + c * perim / 3) + perim * 20) % perim;
          drawOrbTail(pos, 14);
        }
        break;
      }
      case "shimmerGreen": {
        ctx.strokeStyle = color + "18"; ctx.lineWidth = 8;
        ctx.shadowColor = color; ctx.shadowBlur = 3;
        path(); ctx.stroke(); ctx.shadowBlur = 0;
        const pos = (t * 1.2 + perim * 20) % perim;
        drawOrbTail(pos, 55);
        break;
      }
      case "shimmerOrange": {
        ctx.strokeStyle = color + "32"; ctx.lineWidth = 1.5; path(); ctx.stroke();
        const ac = Math.floor(t / 10) % 4, phase = (t % 10) / 10;
        const fa = Math.sin(phase * Math.PI);
        const [cx, cy] = corners[ac];
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
        ctx.shadowColor = color; ctx.shadowBlur = fa * 15; ctx.fill(); ctx.shadowBlur = 0;
        break;
      }
      case "techShimmer": {
        ctx.strokeStyle = color + "22"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        for (let i = 0; i < 10; i++) {
          const ph = (t + i * 13) % 24;
          if (ph < 8) {
            const fa = Math.sin((ph / 8) * Math.PI);
            const pingPos = (SPARK_X[i & 31] * perim + i * 53) % perim;
            const [px, py] = perimPt(pingPos, w, h, ins);
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color + Math.floor(fa * 210).toString(16).padStart(2, "0");
            ctx.shadowColor = color; ctx.shadowBlur = fa * 8; ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "suitShimmer": {
        ctx.strokeStyle = color + "48"; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        const pos = (t * 0.7 + perim * 20) % perim;
        drawOrbTail(pos, 35);
        break;
      }
      case "crimsonShimmer": {
        ctx.strokeStyle = color + "22"; ctx.lineWidth = 1.5;
        path(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(ins + 8, ins + 8, w - ins * 2 - 16, h - ins * 2 - 16, Math.max(0, r - 8)); ctx.stroke();
        const pos1 = (t * 2.8 + perim * 20) % perim;
        const [ox, oy] = perimPt(pos1, w, h, ins);
        ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fill();
        const ip = 2 * ((w - 16) + (h - 16));
        const pos2 = (ip * 20 - t * 2.0) % ip;
        const [ix, iy] = perimPt(pos2, w - 16, h - 16, ins);
        ctx.beginPath(); ctx.arc(ix + 8, iy + 8, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case "iceShimmer": {
        ctx.strokeStyle = color + "55"; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 4;
        path(); ctx.stroke(); ctx.shadowBlur = 0;
        for (let i = 0; i < 30; i++) {
          const pos = ((t * 0.3 + i * (perim / 30)) + perim * 20) % perim;
          const [px, py] = perimPt(pos, w, h, ins);
          const fa = 0.18 + 0.42 * Math.abs(Math.sin((t * 0.04 + i * 0.4)));
          ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(fa * 190).toString(16).padStart(2, "0"); ctx.fill();
        }
        break;
      }
    }
    return;
  }

  // ── RARE ──────────────────────────────────────────────────────────────────
  if (rarity === "rare") {
    switch (frameId) {
      case "pulseCyan": {
        const p = 0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 14 * p; ctx.globalAlpha = 0.3 + 0.7 * p;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "pulsePurple": {
        const p1 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2);
        const p2 = 0.5 + 0.5 * Math.sin((t / 32) * Math.PI * 2 + Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.shadowColor = color; ctx.shadowBlur = 12 * p1; ctx.globalAlpha = 0.25 + 0.75 * p1;
        path(); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.shadowBlur = 10 * p2; ctx.globalAlpha = 0.25 + 0.75 * p2;
        ctx.beginPath(); ctx.roundRect(ins + 6, ins + 6, w - ins * 2 - 12, h - ins * 2 - 12, Math.max(0, r - 6)); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "pulseGold": {
        ctx.strokeStyle = color + "38"; ctx.lineWidth = 1.5; path(); ctx.stroke();
        const pos = (t * 1.8 + perim * 20) % perim;
        for (let i = 0; i < 18; i++) {
          const tp = ((pos - i * (perim * 0.09 / 18)) + perim * 20) % perim;
          const [px, py] = perimPt(tp, w, h, ins);
          const fa = (1 - i / 18) ** 2;
          ctx.beginPath(); ctx.arc(px, py, 3 + 2 * fa, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(fa * 230).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = fa * 12; ctx.fill();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "pulseRed": {
        const fast = 0.5 + 0.5 * Math.sin((t / 14) * Math.PI * 2);
        const flicker = seededRand(t & 15) > 0.85 ? 0.15 : 1.0;
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 12 * fast;
        ctx.globalAlpha = (0.4 + 0.6 * fast) * flicker;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "pulseGreen": {
        ctx.strokeStyle = color + "50"; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 5;
        path(); ctx.stroke(); ctx.shadowBlur = 0;
        const sy = ((t * 1.3) % (h + 16)) - 8;
        const sg = ctx.createLinearGradient(0, sy - 5, 0, sy + 5);
        sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "cc"); sg.addColorStop(1, color + "00");
        ctx.fillStyle = sg; ctx.fillRect(ins, Math.max(ins, sy - 5), w - ins * 2, 10);
        break;
      }
      case "hackerPulse": {
        ctx.strokeStyle = color + "30"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        corners.forEach(([cx, cy], i) => {
          const phase = (t / 24 + i * 0.25) * Math.PI * 2;
          const fa = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(phase));
          const rad = 5 + Math.sin(phase) * 3;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(fa * 180).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = 8 * fa; ctx.fill();
        });
        ctx.shadowBlur = 0;
        break;
      }
      case "corePulse": {
        const p = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 36) * Math.PI * 2));
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 14 * p; ctx.globalAlpha = 0.35 + 0.65 * p;
        octPath(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "vaultPulse": {
        const p1 = 0.5 + 0.5 * Math.sin((t / 55) * Math.PI * 2);
        const p2 = 0.5 + 0.5 * Math.sin((t / 55) * Math.PI * 2 + Math.PI * 0.6);
        ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.globalAlpha = 0.1 + 0.25 * p1;
        ctx.shadowColor = color; ctx.shadowBlur = 5;
        path(); ctx.stroke();
        ctx.lineWidth = 2; ctx.globalAlpha = 0.4 + 0.6 * p2; ctx.shadowBlur = 12 * p2;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "streetPulse": {
        const on = Math.floor(t / 4) % 3 !== 2;
        if (on) {
          const p = 0.4 + 0.6 * ((t % 4) / 4);
          ctx.strokeStyle = color; ctx.lineWidth = 3;
          ctx.shadowColor = color; ctx.shadowBlur = 12 * p; ctx.globalAlpha = 0.6 + 0.4 * p;
          ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
      case "spectralPulse": {
        const d = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin((t / 60) * Math.PI * 2));
        const g = 0.1 + 0.35 * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2 + 1.3));
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.globalAlpha = d;
        ctx.beginPath();
        ctx.moveTo(w / 2, ins); ctx.lineTo(w - ins, h / 2); ctx.lineTo(w / 2, h - ins); ctx.lineTo(ins, h / 2);
        ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = g; path(); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
    }
    return;
  }

  // ── EPIC ──────────────────────────────────────────────────────────────────
  if (rarity === "epic") {
    const cx2 = w / 2, cy2 = h / 2;
    switch (frameId) {
      case "epicCyan": {
        const ang = (t / 70) * Math.PI * 2;
        const grad = ctx.createConicGradient(ang, cx2, cy2);
        grad.addColorStop(0, color); grad.addColorStop(0.07, color + "80");
        grad.addColorStop(0.22, color + "08"); grad.addColorStop(0.99, color + "08"); grad.addColorStop(1, color);
        ctx.strokeStyle = grad; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        path(); ctx.stroke(); ctx.shadowBlur = 0;
        break;
      }
      case "epicPurple": {
        const a1 = (t / 55) * Math.PI * 2, a2 = -(t / 90) * Math.PI * 2;
        const g1 = ctx.createConicGradient(a1, cx2, cy2);
        g1.addColorStop(0, color); g1.addColorStop(0.09, color + "60"); g1.addColorStop(0.28, color + "05"); g1.addColorStop(1, color + "05");
        const g2 = ctx.createConicGradient(a2, cx2, cy2);
        g2.addColorStop(0, color + "80"); g2.addColorStop(0.14, color + "20"); g2.addColorStop(0.99, color + "20"); g2.addColorStop(1, color + "80");
        ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.strokeStyle = g1; octPath(); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.shadowBlur = 5;
        ctx.strokeStyle = g2; octPath(); ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }
      case "epicGold": {
        ctx.strokeStyle = color + "18"; ctx.lineWidth = 1.5; path(); ctx.stroke();
        const segCount = 10, cycle = Math.floor(t / 4) % (segCount + 6);
        for (let i = 0; i < segCount; i++) {
          const sp = (i / segCount) * perim, ep = ((i + 0.86) / segCount) * perim;
          const age = cycle - i;
          if (age < 0) continue;
          const fa = Math.max(0, 1 - age * 0.11);
          const [x1, y1] = perimPt(sp, w, h, ins);
          const [x2, y2] = perimPt(ep, w, h, ins);
          ctx.strokeStyle = color + Math.floor(fa * 210).toString(16).padStart(2, "0");
          ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = fa * 9;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "syndicate": {
        ctx.strokeStyle = color + "70"; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 8; path(); ctx.stroke();
        ctx.strokeStyle = color + "28"; ctx.lineWidth = 10; ctx.shadowBlur = 4; path(); ctx.stroke();
        ctx.shadowBlur = 0;
        const sy = ((t * 1.8) % (h + 18)) - 9;
        const fg = ctx.createLinearGradient(0, sy - 6, 0, sy + 6);
        fg.addColorStop(0, "#ff6b3500"); fg.addColorStop(0.5, "#ff6b35ee"); fg.addColorStop(1, "#ff6b3500");
        ctx.fillStyle = fg; ctx.fillRect(ins, Math.max(ins, sy - 6), w - ins * 2, 12);
        for (let i = 0; i < 4; i++) {
          const ex = ins + seededRand((t + i * 19) & 255) * (w - ins * 2);
          const ey = sy - seededRand((t + i * 37) & 255) * 10;
          if (ey > ins && ey < h - ins) { ctx.beginPath(); ctx.arc(ex, ey, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#ffffff90"; ctx.fill(); }
        }
        break;
      }
      case "epicRed": {
        ctx.strokeStyle = color + "60"; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 10; path(); ctx.stroke();
        ctx.strokeStyle = color + "28"; ctx.lineWidth = 12; ctx.shadowBlur = 6; path(); ctx.stroke();
        ctx.shadowBlur = 0;
        const sy = ((t * 2.6) % (h + 18)) - 9;
        const pg = ctx.createLinearGradient(0, sy - 7, 0, sy + 7);
        pg.addColorStop(0, color + "00"); pg.addColorStop(0.5, color + "ff"); pg.addColorStop(1, color + "00");
        ctx.fillStyle = pg; ctx.fillRect(ins, Math.max(ins, sy - 7), w - ins * 2, 14);
        break;
      }
      case "gridCore": {
        ctx.strokeStyle = color + "40"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(ins, ins, w - ins * 2, h - ins * 2); ctx.stroke();
        const cell = 12;
        for (let x = ins; x < w - ins; x += cell) {
          for (const y of [ins, h - ins - cell]) {
            const blink = Math.floor((t + x * 0.3 + y * 0.5) / 6) % 3;
            const fa = blink === 0 ? 0.85 : blink === 1 ? 0.25 : 0.05;
            ctx.fillStyle = color + Math.floor(fa * 200).toString(16).padStart(2, "0");
            ctx.shadowColor = color; ctx.shadowBlur = fa * 6;
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
          }
        }
        ctx.shadowBlur = 0;
        break;
      }
      case "suitsFrame": {
        ctx.strokeStyle = color + "60"; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 8; path(); ctx.stroke(); ctx.shadowBlur = 0;
        const ang = (t / 80) * Math.PI * 2;
        corners.forEach(([cx, cy], i) => {
          const ph = ang + i * Math.PI / 2;
          const dx = Math.cos(ph) * 8, dy = Math.sin(ph) * 8;
          ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(ph + Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fill();
          ctx.restore();
        });
        ctx.shadowBlur = 0;
        break;
      }
      case "epicVoid": {
        ctx.strokeStyle = color + "70"; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 10; path(); ctx.stroke();
        ctx.strokeStyle = color + "22"; ctx.lineWidth = 12; ctx.shadowBlur = 5; path(); ctx.stroke();
        ctx.shadowBlur = 0;
        if (t % 3 === 0) {
          const n = (t >> 2) & 31;
          for (let i = 0; i < 3; i++) {
            const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
            const [sx, sy] = perimPt(pos, w, h, ins);
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
            ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + SPARK_DX[(n + i * 3) & 31] * 0.7, sy + SPARK_DY[(n + i * 5) & 31] * 0.7);
            ctx.stroke(); ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
        }
        break;
      }
      case "epicInferno": {
        const fa2 = seededRand(t & 31), fb = seededRand((t + 7) & 31);
        const p = 0.5 + 0.5 * Math.sin((t / 8) * Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 3 + fa2 * 4;
        ctx.shadowColor = color; ctx.shadowBlur = 5 + fb * 14; ctx.globalAlpha = 0.5 + 0.5 * p;
        path(); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.shadowBlur = fa2 * 6; ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#ffffff30"; path(); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "epicNova": {
        const a1 = (t / 45) * Math.PI * 2;
        const g1 = ctx.createConicGradient(a1, cx2, cy2);
        g1.addColorStop(0, color); g1.addColorStop(0.08, color + "80"); g1.addColorStop(0.5, color + "08");
        g1.addColorStop(0.58, color + "80"); g1.addColorStop(0.66, color + "08"); g1.addColorStop(1, color);
        ctx.strokeStyle = g1; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 12; path(); ctx.stroke();
        const burst = 0.5 + 0.5 * Math.sin((t / 28) * Math.PI * 2);
        ctx.strokeStyle = color + "30"; ctx.lineWidth = 10;
        ctx.shadowBlur = 6 + 6 * burst; ctx.globalAlpha = 0.12 + 0.18 * burst;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
    }
    return;
  }

  // ── LEGENDARY ─────────────────────────────────────────────────────────────
  if (rarity === "legendary") {
    ctx.strokeStyle = color + "15"; ctx.lineWidth = 16;
    ctx.shadowColor = color; ctx.shadowBlur = 28; path(); ctx.stroke();
    ctx.strokeStyle = color + "35"; ctx.lineWidth = 6; ctx.shadowBlur = 18; path(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 14; path(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.roundRect(ins + 4, ins + 4, w - ins * 2 - 8, h - ins * 2 - 8, Math.max(0, r - 4)); ctx.stroke();

    switch (frameId) {
      case "legendCyan":
        if (t % 4 === 0) {
          const n = (t >> 2) & 31;
          for (let i = 0; i < 3; i++) {
            const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
            const [sx, sy] = perimPt(pos, w, h, ins);
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2;
            ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.globalAlpha = 0.88;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + SPARK_DX[(n + i * 3) & 31] * 0.9, sy + SPARK_DY[(n + i * 5) & 31] * 0.9);
            ctx.stroke(); ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
        }
        break;
      case "legendPurple":
        if (t % 18 < 7) {
          const c1 = Math.floor(t / 18) % 4, c2 = (c1 + 2) % 4;
          const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
          ctx.shadowColor = color; ctx.shadowBlur = 14;
          ctx.globalAlpha = 0.9 * (1 - (t % 18) / 7);
          ctx.beginPath(); ctx.moveTo(x1, y1);
          let lx = x1, ly = y1;
          const n = (t >> 1) & 31;
          for (let s = 0; s < 6; s++) {
            lx += (x2 - x1) / 6 + SPARK_DX[(n + s) & 31] * 0.8;
            ly += (y2 - y1) / 6 + SPARK_DY[(n + s) & 31] * 0.8;
            ctx.lineTo(Math.max(ins, Math.min(w - ins, lx)), Math.max(ins, Math.min(h - ins, ly)));
          }
          ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      case "legendGold": {
        const glitch = t % 14 < 4;
        if (glitch) {
          const ox = SPARK_DX[t & 31] * 0.6;
          ctx.strokeStyle = "#ff000060"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(ins + ox, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
          ctx.strokeStyle = "#00ff0050"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(ins, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
          ctx.strokeStyle = "#4488ff70"; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(ins - ox, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
        }
        break;
      }
      case "legendRed": {
        const period = t % 60;
        const hb = period < 8 ? 0.2 + 0.8 * Math.sin((period / 8) * Math.PI)
          : period >= 14 && period < 26 ? 0.2 + Math.sin(((period - 14) / 12) * Math.PI) : 0.2;
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.globalAlpha = hb; ctx.shadowColor = color; ctx.shadowBlur = 12 * hb;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "crimsonLord": {
        const offset = 1.5 + (0.5 + 0.5 * Math.sin((t / 22) * Math.PI * 2)) * 3;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ff000070";
        ctx.beginPath(); ctx.roundRect(ins - offset, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
        ctx.strokeStyle = "#00ff0050";
        ctx.beginPath(); ctx.roundRect(ins, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
        ctx.strokeStyle = "#4488ff70";
        ctx.beginPath(); ctx.roundRect(ins + offset, ins, w - ins * 2, h - ins * 2, r); ctx.stroke();
        break;
      }
      case "arcLight": {
        const arcStart = (t * 0.6) % perim, arcLen = perim * 0.18;
        for (let i = 0; i < 22; i++) {
          const pos = (arcStart + (i / 22) * arcLen + perim * 20) % perim;
          const [px, py] = perimPt(pos, w, h, ins);
          const fade = Math.sin((i / 22) * Math.PI);
          const jitter = SPARK_DX[(Math.floor(t * 0.1 + i) & 31)] * 0.2;
          ctx.beginPath(); ctx.arc(px + jitter, py + jitter * 0.5, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = fade * 12;
          ctx.globalAlpha = fade * 0.9; ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "plasmaBolt": {
        const bp = t % 70;
        if (bp < 30) {
          const progress = bp / 30;
          const ba = bp < 15 ? progress * 2 : 2 - progress * 2;
          const bY = ins + progress * (h - ins * 2);
          let lx = w / 2;
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
          ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.globalAlpha = ba * 0.9;
          ctx.beginPath(); ctx.moveTo(lx, ins);
          for (let s = 0; s < 8; s++) {
            const sy2 = ins + (s / 8) * (bY - ins);
            lx += SPARK_DX[(t + s * 3) & 31] * 0.5;
            lx = Math.max(ins + 2, Math.min(w - ins - 2, lx));
            ctx.lineTo(lx, sy2);
          }
          ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
      case "thunderClap": {
        const phase = t % 80;
        if (phase < 12) {
          const ba = Math.sin((phase / 12) * Math.PI);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3 + phase;
          ctx.shadowColor = color; ctx.shadowBlur = 18 * ba; ctx.globalAlpha = ba * 0.85;
          path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
      case "vantaLegend": {
        const va = 0.04 + 0.96 * Math.pow(0.5 + 0.5 * Math.sin((t / 90) * Math.PI * 2), 2);
        ctx.globalAlpha = va; ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowColor = color; ctx.shadowBlur = 18 * va;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "executioner": {
        const throb = 0.5 + 0.5 * Math.sin((t / 70) * Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.globalAlpha = 0.4 + 0.6 * throb; ctx.shadowColor = color; ctx.shadowBlur = 12 * throb;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        if (throb > 0.95) {
          const fa = (throb - 0.95) / 0.05;
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5;
          ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.globalAlpha = fa * 0.8;
          path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
    }
    return;
  }

  // ── MYTHIC ────────────────────────────────────────────────────────────────
  if (rarity === "mythic") {
    const cs = 8;
    ctx.font = `bold ${cs}px monospace`;

    const drawGlow = (cc: string, strokeColor: string) => {
      ctx.strokeStyle = cc + "40"; ctx.lineWidth = 18;
      ctx.shadowColor = cc; ctx.shadowBlur = 30; path(); ctx.stroke();
      ctx.strokeStyle = strokeColor + "80"; ctx.lineWidth = 7; ctx.shadowBlur = 18; path(); ctx.stroke();
      ctx.strokeStyle = strokeColor; ctx.lineWidth = 2.5; ctx.shadowBlur = 12; path(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff20"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(ins + 6, ins + 6, w - ins * 2 - 12, h - ins * 2 - 12, Math.max(0, r - 6)); ctx.stroke();
    };

    const drawChars = (cc: string, speed: number, allSides: boolean, blinkMod?: number) => {
      for (let x = 0; x < w; x += cs + 1) {
        const ci = Math.floor((t * speed + x) / 4) % MATRIX_CHARS.length;
        const blink = blinkMod ? (Math.floor((t + x) / blinkMod) % 3 !== 0 ? 1 : 0) : 1;
        const fa = blinkMod ? 0.55 * blink : 0.45 + 0.35 * Math.abs(Math.sin((t * 0.5 + x * 0.3)));
        ctx.fillStyle = cc; ctx.globalAlpha = fa;
        ctx.fillText(MATRIX_CHARS[ci], x, ins + cs - 1);
        ctx.fillText(MATRIX_CHARS[(ci + 4) % MATRIX_CHARS.length], x, h - 2);
      }
      if (allSides) {
        for (let y = cs; y < h - cs; y += cs + 1) {
          const ci = Math.floor((t * speed + y) / 4) % MATRIX_CHARS.length;
          const blink = blinkMod ? (Math.floor((t + y) / blinkMod) % 3 !== 0 ? 1 : 0) : 1;
          const fa = blinkMod ? 0.55 * blink : 0.45 + 0.35 * Math.abs(Math.sin((t * 0.5 + y * 0.3)));
          ctx.fillStyle = cc; ctx.globalAlpha = fa;
          ctx.fillText(MATRIX_CHARS[ci], 0, y);
          ctx.fillText(MATRIX_CHARS[(ci + 6) % MATRIX_CHARS.length], w - cs, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    switch (frameId) {
      case "matrixGreen": {
        const cc = hsl2hex((t / 4) % 360, 100, 60);
        drawGlow(cc, "#39d353"); drawChars(cc, 0.3, false);
        break;
      }
      case "matrixBlue": {
        const cc = hsl2hex((200 + (t / 3) % 40), 100, 60);
        drawGlow(cc, cc); drawChars(cc, 0.4, true);
        break;
      }
      case "matrixGold": {
        const cc = hsl2hex((40 + (t / 6) % 20), 100, 55);
        drawGlow(cc, "#f59e0b"); drawChars(cc, 0.2, false);
        break;
      }
      case "matrixRed": {
        const cc = hsl2hex((0 + (t / 4) % 15), 100, 55);
        drawGlow(cc, "#ff2d55"); drawChars(cc, 0.5, true, 5);
        break;
      }
      case "voidWalker": {
        drawGlow(color, color);
        for (let i = 0; i < 16; i++) {
          const lp = ((t + i * 17) % 30) / 30;
          const sp = (SPARK_X[i & 31] * perim + i * 47) % perim;
          const [sx, sy] = perimPt(sp, w, h, ins);
          const px = sx + (cx2 - sx) * lp, py = sy + (cy2 - sy) * lp;
          const fa = Math.sin(lp * Math.PI) * 0.7;
          ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 7 * fa;
          ctx.globalAlpha = fa; ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "nova2047": {
        const a1 = (t / 40) * Math.PI * 2, a2 = -(t / 65) * Math.PI * 2;
        const g1 = ctx.createConicGradient(a1, cx2, cy2);
        g1.addColorStop(0, color); g1.addColorStop(0.12, color + "60"); g1.addColorStop(0.5, color + "08"); g1.addColorStop(0.62, color + "60"); g1.addColorStop(1, color);
        const g2 = ctx.createConicGradient(a2, cx2, cy2);
        g2.addColorStop(0, "#ffffff30"); g2.addColorStop(0.5, color + "10"); g2.addColorStop(1, "#ffffff30");
        ctx.strokeStyle = color + "40"; ctx.lineWidth = 18; ctx.shadowColor = color; ctx.shadowBlur = 28; path(); ctx.stroke();
        ctx.strokeStyle = g1; ctx.lineWidth = 3; ctx.shadowBlur = 14; path(); ctx.stroke();
        ctx.strokeStyle = g2; ctx.lineWidth = 1.5; ctx.shadowBlur = 6; path(); ctx.stroke();
        ctx.shadowBlur = 0;
        const rp = (t % 40) / 40;
        ctx.strokeStyle = color + Math.floor((1 - rp) * 80).toString(16).padStart(2, "0");
        ctx.lineWidth = 1; ctx.globalAlpha = 1 - rp;
        const exp = rp * 16;
        ctx.beginPath(); ctx.roundRect(ins - exp, ins - exp, w - ins * 2 + exp * 2, h - ins * 2 + exp * 2, r + exp); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "godMode": {
        const cc = hsl2hex((50 + (t / 5) % 20), 100, 60);
        drawGlow(cc, "#fde047");
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        for (let ri = 0; ri < 3; ri++) {
          const rp = ((t + ri * 26) % 55) / 55;
          const exp = rp * 18;
          ctx.strokeStyle = cc + Math.floor((1 - rp) * 100).toString(16).padStart(2, "0");
          ctx.lineWidth = 2 - rp; ctx.globalAlpha = (1 - rp) * 0.8;
          ctx.beginPath(); ctx.roundRect(ins - exp, ins - exp, w - ins * 2 + exp * 2, h - ins * 2 + exp * 2, r + exp); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        break;
      }
      case "omega": {
        const cc = hsl2hex((t / 2) % 360, 100, 60);
        drawGlow(cc, cc);
        const fl = 0.7 + 0.3 * Math.abs(Math.sin((t / 7) * Math.PI));
        ctx.strokeStyle = cc; ctx.lineWidth = 2.5; ctx.shadowBlur = 12; ctx.globalAlpha = fl;
        path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        if (t % 2 === 0) {
          const n = (t >> 1) & 31;
          for (let i = 0; i < 4; i++) {
            const pos = (SPARK_X[(n + i * 7) & 31] * perim) % perim;
            const [sx, sy] = perimPt(pos, w, h, ins);
            const sc = hsl2hex((t / 2 + i * 40) % 360, 100, 75);
            ctx.strokeStyle = sc; ctx.lineWidth = 1.5;
            ctx.shadowColor = sc; ctx.shadowBlur = 8; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + SPARK_DX[(n + i) & 31] * 0.8, sy + SPARK_DY[(n + i) & 31] * 0.8);
            ctx.stroke();
          }
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
      case "architect": {
        drawGlow("#e2e8f0", "#e2e8f0");
        const step = 18;
        const rot = (t / 200) * Math.PI * 2;
        for (let i = 0; i < Math.ceil(perim / step); i++) {
          const pos = ((i * step + t * 0.3) + perim * 20) % perim;
          const [px, py] = perimPt(pos, w, h, ins);
          const fa = 0.3 + 0.5 * Math.abs(Math.sin((t * 0.04 + i * 0.5)));
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          ctx.fillStyle = "#ffffff"; ctx.globalAlpha = fa;
          ctx.fillRect(-2, -2, 4, 4);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "theOne": {
        const cc = hsl2hex((t / 2.5) % 360, 100, 65);
        for (let layer = 0; layer < 3; layer++) {
          const a = ((t / (40 + layer * 25)) * Math.PI * 2) * (layer % 2 === 0 ? 1 : -1);
          const lc = hsl2hex((t / 2.5 + layer * 120) % 360, 100, 65);
          const g = ctx.createConicGradient(a, cx2, cy2);
          g.addColorStop(0, lc); g.addColorStop(0.08, lc + "40"); g.addColorStop(0.5, lc + "05"); g.addColorStop(1, lc);
          ctx.strokeStyle = g;
          ctx.lineWidth = layer === 0 ? 5 : layer === 1 ? 3 : 2;
          ctx.shadowColor = lc; ctx.shadowBlur = 8 + layer * 3;
          ctx.beginPath(); ctx.roundRect(ins + layer * 1.5, ins + layer * 1.5, w - ins * 2 - layer * 3, h - ins * 2 - layer * 3, Math.max(0, r - layer * 1.5)); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        drawChars(cc, 0.5, false);
        if (t % 20 < 7) {
          const c1 = Math.floor(t / 20) % 4, c2 = (c1 + 2) % 4;
          const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
          ctx.shadowColor = cc; ctx.shadowBlur = 14;
          ctx.globalAlpha = 0.85 * (1 - (t % 20) / 7);
          ctx.beginPath(); ctx.moveTo(x1, y1);
          let lx = x1, ly = y1;
          const n = (t >> 1) & 31;
          for (let s = 0; s < 6; s++) {
            lx += (x2 - x1) / 6 + SPARK_DX[(n + s) & 31] * 0.6;
            ly += (y2 - y1) / 6 + SPARK_DY[(n + s) & 31] * 0.6;
            ctx.lineTo(Math.max(ins, Math.min(w - ins, lx)), Math.max(ins, Math.min(h - ins, ly)));
          }
          ctx.lineTo(x2, y2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        break;
      }
    }
  }
}

export function FrameCardWrapper({ frameId, colorOverride, children, className, style, borderRadius = 8 }: Props) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const ctxMaybe = canvas.getContext("2d", { alpha: true });
    if (!ctxMaybe) return () => observer.disconnect();
    const ctx = ctxMaybe as CanvasRenderingContext2D;

    if (rarity === "common") {
      const ro = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        const w = Math.round(rect.width), h = Math.round(rect.height);
        if (w === 0 || h === 0) return;
        canvas.width = w; canvas.height = h;
        drawCard(canvas, ctx, 0, frame.id, rarity, color, borderRadius);
      });
      ro.observe(wrap);
      return () => { ro.disconnect(); observer.disconnect(); };
    }

    let t = 0;
    const animId = registerAnim(() => {
      if (!visibleRef.current) return;
      drawCard(canvas, ctx, t, frame.id, rarity, color, borderRadius);
      t++;
    });

    return () => { unregisterAnim(animId); observer.disconnect(); };
  }, [frame.id, rarity, color, borderRadius]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
          borderRadius,
        }}
      />
      {children}
    </div>
  );
}
