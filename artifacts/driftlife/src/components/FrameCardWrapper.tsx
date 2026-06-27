import { useEffect, useRef, ReactNode, CSSProperties } from "react";
import { getFrame, FrameRarity } from "../lib/frames";
import { FRAME_VARIANT } from "./PlayerFrame";

interface Props {
  frameId?: string | null;
  colorOverride?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  borderRadius?: number;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Generate evenly-spaced points along a rounded-rect perimeter
function perimeterPoints(w: number, h: number, r: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  const rr = Math.min(r, w / 2, h / 2);
  const inset = 1.5;
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const arcLen = (Math.PI / 2) * rr;
  const sw = x1 - x0 - 2 * rr, sh = y1 - y0 - 2 * rr;
  const perim = 2 * (sw + sh) + 4 * arcLen;
  for (let i = 0; i < n; i++) {
    pts.push(perimPoint((i / n) * perim, x0, y0, x1, y1, rr, sw, sh, arcLen, perim));
  }
  return pts;
}

function perimPoint(
  d: number, x0: number, y0: number, x1: number, y1: number,
  rr: number, sw: number, sh: number, arcLen: number, _perim: number,
): [number, number] {
  const seg = [sw, arcLen, sh, arcLen, sw, arcLen, sh, arcLen];
  let rem = d % _perim;
  for (let i = 0; i < seg.length; i++) {
    if (rem <= seg[i]) {
      const t = rem / seg[i];
      if (i === 0) return [x0 + rr + t * sw, y0];
      if (i === 1) { const a = -Math.PI / 2 + t * Math.PI / 2; return [x1 - rr + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]; }
      if (i === 2) return [x1, y0 + rr + t * sh];
      if (i === 3) { const a = 0 + t * Math.PI / 2; return [x1 - rr + rr * Math.cos(a), y1 - rr + rr * Math.sin(a)]; }
      if (i === 4) return [x1 - rr - t * sw, y1];
      if (i === 5) { const a = Math.PI / 2 + t * Math.PI / 2; return [x0 + rr + rr * Math.cos(a), y1 - rr + rr * Math.sin(a)]; }
      if (i === 6) return [x0, y1 - rr - t * sh];
      if (i === 7) { const a = Math.PI + t * Math.PI / 2; return [x0 + rr + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]; }
    }
    rem -= seg[i];
  }
  return [x0 + rr, y0];
}

// ── Main draw function ────────────────────────────────────────────────────────

function drawFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  t: number,
  rarity: FrameRarity,
  color: string,
  br: number,
  variant: number,
) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (w === 0 || h === 0) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  const r = br;
  const inset = 1.5;

  const path = () => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset));
  };

  // ── COMMON ───────────────────────────────────────────────────────────────
  if (rarity === "common") {
    if (variant === 1) {
      // Square corners + glowing corner dots
      ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.rect(inset, inset, w - inset * 2, h - inset * 2); ctx.stroke();
      ctx.shadowBlur = 12;
      for (const [cx, cy] of [[inset, inset],[w-inset, inset],[inset, h-inset],[w-inset, h-inset]] as const) {
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      }
      ctx.shadowBlur = 0;
    } else if (variant === 2) {
      // Chamfered / octagon corners
      const cut = Math.min(16, Math.min(w, h) * 0.14);
      ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(inset + cut, inset); ctx.lineTo(w - inset - cut, inset);
      ctx.lineTo(w - inset, inset + cut); ctx.lineTo(w - inset, h - inset - cut);
      ctx.lineTo(w - inset - cut, h - inset); ctx.lineTo(inset + cut, h - inset);
      ctx.lineTo(inset, h - inset - cut); ctx.lineTo(inset, inset + cut);
      ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // v0: Rounded rect + L-corner accent marks (original)
      ctx.strokeStyle = color + "90"; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      path(); ctx.stroke(); ctx.shadowBlur = 0;
      const acs = 8;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 8;
      for (const [cx, cy, sx, sy] of [
        [inset, inset, 1, 1],[w-inset, inset, -1, 1],[inset, h-inset, 1, -1],[w-inset, h-inset, -1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * acs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * acs);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    return;
  }

  // ── UNCOMMON ─────────────────────────────────────────────────────────────
  if (rarity === "uncommon") {
    if (variant === 1) {
      // Dual opposing comets
      const pts = perimeterPoints(w, h, r, 200);
      const total = pts.length;
      ctx.strokeStyle = color + "25"; ctx.lineWidth = 1.5; path(); ctx.stroke();
      for (let c = 0; c < 2; c++) {
        const dir = c === 0 ? 1 : -1;
        const offset = c === 0 ? 0 : total / 2;
        const headIdx = Math.floor(((t * 2 * dir) + offset * dir + total * 200) % total);
        for (let i = 0; i < 35; i++) {
          const idx = ((headIdx - dir * i) + total * 100) % total;
          const pt = pts[idx];
          const alpha = (1 - i / 35) ** 1.5;
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 1.2 + (1 - i / 35), 0, Math.PI * 2);
          ctx.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
          ctx.shadowColor = color; ctx.shadowBlur = alpha * 10; ctx.fill();
        }
        const head = pts[((headIdx) + total) % total];
        ctx.beginPath(); ctx.arc(head[0], head[1], 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fill();
      }
      ctx.shadowBlur = 0;
    } else if (variant === 2) {
      // Marching dashes
      ctx.setLineDash([8, 5]); ctx.lineDashOffset = -(t * 0.8) % 13;
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      path(); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 0;
    } else {
      // v0: Single comet clockwise (original)
      const perim = 2 * (w + h);
      const cometPos = (t * 3) % perim;
      ctx.strokeStyle = color + "25"; ctx.lineWidth = 1.5; path(); ctx.stroke();
      const pts = perimeterPoints(w, h, r, 180);
      const total = pts.length;
      const headIdx = Math.floor((cometPos / perim) * total) % total;
      for (let i = 0; i < 40; i++) {
        const idx = (headIdx - i + total) % total;
        const pt = pts[idx];
        const alpha = (1 - i / 40) ** 1.5;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 1.5 + (1 - i / 40) * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.shadowColor = color; ctx.shadowBlur = alpha * 12; ctx.fill();
      }
      const head = pts[headIdx];
      ctx.beginPath(); ctx.arc(head[0], head[1], 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.fill();
      ctx.shadowBlur = 0;
    }
    return;
  }

  // ── RARE ──────────────────────────────────────────────────────────────────
  if (rarity === "rare") {
    if (variant === 1) {
      // Dual breathing rings, out of phase
      const p1 = 0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2);
      const p2 = 0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2 + Math.PI);
      ctx.strokeStyle = color; ctx.lineWidth = 4 + p1 * 4;
      ctx.shadowColor = color; ctx.shadowBlur = 14 * p1; ctx.globalAlpha = 0.2 + 0.5 * p1;
      path(); ctx.stroke();
      ctx.lineWidth = 2 + p2 * 3;
      ctx.shadowBlur = 10 * p2; ctx.globalAlpha = 0.3 + 0.5 * p2;
      const i2 = 5;
      ctx.beginPath(); ctx.roundRect(i2, i2, w - i2 * 2, h - i2 * 2, Math.max(0, r - i2)); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    } else if (variant === 2) {
      // Traveling bright spot along perimeter
      const pts = perimeterPoints(w, h, r, 200);
      const total = pts.length;
      ctx.strokeStyle = color + "40"; ctx.lineWidth = 1.5; path(); ctx.stroke();
      const headIdx = Math.floor((t * 2) % total);
      for (let i = 0; i < 16; i++) {
        const idx = (headIdx - i + total) % total;
        const pt = pts[idx];
        const alpha = (1 - i / 16) ** 2;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5 + 1.5 * alpha, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.shadowColor = color; ctx.shadowBlur = alpha * 14; ctx.fill();
      }
      const head = pts[headIdx];
      ctx.beginPath(); ctx.arc(head[0], head[1], 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // v0: Pulsing double-layer glow + ripple (original)
      const pulse = 0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2);
      ctx.strokeStyle = color + Math.floor((0.1 + 0.2 * pulse) * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 6 + pulse * 4; ctx.shadowColor = color; ctx.shadowBlur = 18 * pulse;
      path(); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowBlur = 10 * pulse;
      ctx.globalAlpha = 0.6 + 0.4 * pulse; path(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      const ripplePhase = (t % 80) / 80;
      if (ripplePhase < 0.6) {
        ctx.strokeStyle = color + Math.floor((1 - ripplePhase / 0.6) * 80).toString(16).padStart(2, "0");
        ctx.lineWidth = 1; ctx.globalAlpha = 1 - ripplePhase / 0.6;
        const exp = ripplePhase * 12;
        ctx.beginPath(); ctx.roundRect(inset - exp, inset - exp, w - inset * 2 + exp * 2, h - inset * 2 + exp * 2, r + exp); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    return;
  }

  // ── EPIC ──────────────────────────────────────────────────────────────────
  if (rarity === "epic") {
    if (variant === 1) {
      // Plasma scan line sweeping top to bottom
      ctx.strokeStyle = color + "60"; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      path(); ctx.stroke();
      ctx.strokeStyle = color + "30"; ctx.lineWidth = 8; ctx.shadowBlur = 20;
      path(); ctx.stroke(); ctx.shadowBlur = 0;
      const scanY = ((t * 2) % (h + 30)) - 15;
      const sg = ctx.createLinearGradient(0, scanY - 6, 0, scanY + 6);
      sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "ee"); sg.addColorStop(1, color + "00");
      ctx.fillStyle = sg;
      ctx.fillRect(inset, Math.max(inset, scanY - 6), w - inset * 2, 12);
    } else if (variant === 2) {
      // Orbiting diamond markers at each corner
      const angle = (t / 80) * Math.PI * 2;
      ctx.strokeStyle = color + "50"; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 10;
      path(); ctx.stroke();
      ctx.strokeStyle = color + "30"; ctx.lineWidth = 8; ctx.shadowBlur = 20; path(); ctx.stroke();
      ctx.shadowBlur = 0;
      const corners: [number, number][] = [[inset, inset],[w-inset, inset],[w-inset, h-inset],[inset, h-inset]];
      corners.forEach(([cx, cy], i) => {
        const ph = angle + (i * Math.PI / 2), rad = 8;
        const px = cx + Math.cos(ph) * rad, py = cy + Math.sin(ph) * rad;
        ctx.save(); ctx.translate(px, py); ctx.rotate(ph);
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath();
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fill(); ctx.restore();
      });
      ctx.shadowBlur = 0;
    } else {
      // v0: Conic gradient spin + orbiting corner sparks (original)
      const angle = (t / 80) * Math.PI * 2;
      const cx2 = w / 2, cy2 = h / 2;
      const grad = ctx.createConicGradient(angle, cx2, cy2);
      grad.addColorStop(0, color); grad.addColorStop(0.15, "#ffffff");
      grad.addColorStop(0.3, color + "20"); grad.addColorStop(0.5, color);
      grad.addColorStop(0.65, "#ffffff80"); grad.addColorStop(0.8, color + "20"); grad.addColorStop(1, color);
      ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = 12;
      path(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = color + "30"; ctx.lineWidth = 8; ctx.shadowColor = color; ctx.shadowBlur = 20;
      path(); ctx.stroke(); ctx.shadowBlur = 0;
      const corners2: [number, number][] = [[inset, inset],[w-inset, inset],[w-inset, h-inset],[inset, h-inset]];
      corners2.forEach(([cx3, cy3], i) => {
        const phase = angle + (i * Math.PI) / 2;
        const ox = Math.cos(phase) * 6, oy = Math.sin(phase) * 6;
        ctx.beginPath(); ctx.arc(cx3 + ox, cy3 + oy, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fill();
      });
      ctx.shadowBlur = 0;
    }
    return;
  }

  // ── LEGENDARY ─────────────────────────────────────────────────────────────
  if (rarity === "legendary") {
    if (variant === 1) {
      // Corner-to-corner chain lightning
      ctx.strokeStyle = color + "18"; ctx.lineWidth = 12;
      ctx.shadowColor = color; ctx.shadowBlur = 30; path(); ctx.stroke();
      ctx.strokeStyle = color + "35"; ctx.lineWidth = 5; ctx.shadowBlur = 18; path(); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 14; path(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff50"; ctx.lineWidth = 0.5;
      const i2 = 4; ctx.beginPath(); ctx.roundRect(i2, i2, w - i2 * 2, h - i2 * 2, Math.max(0, r - i2)); ctx.stroke();
      if (t % 12 < 5) {
        const corners: [number, number][] = [[inset, inset],[w-inset, inset],[w-inset, h-inset],[inset, h-inset]];
        const c1 = Math.floor(t / 12) % 4, c2 = (c1 + 1 + ((Math.floor(t / 12) >> 1) % 2)) % 4;
        const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
        ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.globalAlpha = 0.9 * (1 - (t % 12) / 5);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        let lx = x1, ly = y1;
        for (let s = 0; s < 6; s++) {
          lx += (x2 - x1) / 6 + (Math.random() - 0.5) * 20;
          ly += (y2 - y1) / 6 + (Math.random() - 0.5) * 20;
          ctx.lineTo(lx, ly);
        }
        ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
    } else if (variant === 2) {
      // Glitch/stutter border
      const glitch = t % 18 < 3;
      const ox = glitch ? (Math.random() - 0.5) * 6 : 0;
      const oy = glitch ? (Math.random() - 0.5) * 6 : 0;
      ctx.strokeStyle = color + "18"; ctx.lineWidth = 12;
      ctx.shadowColor = color; ctx.shadowBlur = 30; path(); ctx.stroke();
      ctx.strokeStyle = glitch ? "#ffffff" : color; ctx.lineWidth = 2;
      ctx.shadowBlur = glitch ? 20 : 14; ctx.globalAlpha = glitch ? 0.65 : 1;
      ctx.beginPath(); ctx.roundRect(inset + ox, inset + oy, w - inset * 2, h - inset * 2, Math.max(0, r - inset)); ctx.stroke();
      if (glitch) {
        ctx.strokeStyle = color + "70"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(inset - ox * 2, inset - oy * 2, w - inset * 2, h - inset * 2, Math.max(0, r - inset)); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    } else {
      // v0: Electric arcs + triple bloom (original)
      ctx.strokeStyle = color + "18"; ctx.lineWidth = 12;
      ctx.shadowColor = color; ctx.shadowBlur = 30; path(); ctx.stroke();
      ctx.strokeStyle = color + "35"; ctx.lineWidth = 5; ctx.shadowBlur = 18; path(); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 14; path(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff50"; ctx.lineWidth = 0.5;
      const i2 = 4; ctx.beginPath(); ctx.roundRect(i2, i2, w - i2 * 2, h - i2 * 2, Math.max(0, r - i2)); ctx.stroke();
      const orn = 12; ctx.strokeStyle = "#ffffff90"; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 8;
      for (const [x, y, sx, sy] of [
        [inset, inset, 1, 1],[w-inset, inset, -1, 1],[inset, h-inset, 1, -1],[w-inset, h-inset, -1, -1],
      ] as const) {
        ctx.beginPath(); ctx.moveTo(x + sx * orn, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * orn); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (t % 5 === 0) {
        const numArcs = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numArcs; i++) {
          const side = Math.floor(Math.random() * 4);
          let x1: number, y1: number;
          if (side === 0) { x1 = Math.random() * w; y1 = inset; }
          else if (side === 1) { x1 = w - inset; y1 = Math.random() * h; }
          else if (side === 2) { x1 = Math.random() * w; y1 = h - inset; }
          else { x1 = inset; y1 = Math.random() * h; }
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
          ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.beginPath(); ctx.moveTo(x1, y1);
          let lx = x1, ly = y1;
          for (let s = 0; s < 4; s++) {
            lx += (Math.random() - 0.5) * 14; ly += (Math.random() - 0.5) * 14; ctx.lineTo(lx, ly);
          }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = 0;
      }
    }
    return;
  }

  // ── MYTHIC ────────────────────────────────────────────────────────────────
  if (rarity === "mythic") {
    const CHARS = "01アイウ#!@$%0█▓▒░";

    const drawEdgeChars = (
      positions: number[],
      getXY: (p: number) => [number, number],
      offset: number,
      cycleColor: string,
    ) => {
      positions.forEach(p => {
        const speed = (t + p + offset) / 6;
        const ci = Math.floor(speed) % CHARS.length;
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin((t + p + offset) / 15));
        ctx.globalAlpha = alpha;
        const [x, y] = getXY(p);
        ctx.fillStyle = cycleColor;
        ctx.fillText(CHARS[ci], x, y);
      });
    };

    if (variant === 1) {
      // All 4 edges matrix + deeper cycling + bigger surge
      const hShift = (t / 2) % 360;
      const cc = hslToHex(hShift, 100, 62);
      ctx.strokeStyle = cc + "22"; ctx.lineWidth = 18;
      ctx.shadowColor = cc; ctx.shadowBlur = 38; path(); ctx.stroke();
      ctx.strokeStyle = color + "50"; ctx.lineWidth = 6; ctx.shadowBlur = 22; path(); ctx.stroke();
      const flick = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
      ctx.strokeStyle = cc; ctx.lineWidth = 2; ctx.globalAlpha = flick;
      ctx.shadowColor = cc; ctx.shadowBlur = 18; path(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 0.5;
      const mi = 5; ctx.beginPath(); ctx.roundRect(mi, mi, w - mi * 2, h - mi * 2, Math.max(0, r - mi)); ctx.stroke();
      ctx.font = "bold 7px monospace"; ctx.shadowColor = cc; ctx.shadowBlur = 8;
      const topPos = Array.from({ length: Math.floor(w / 9) }, (_, i) => i * 9 + 4);
      const leftPos = Array.from({ length: Math.floor(h / 9) }, (_, i) => i * 9 + 4);
      drawEdgeChars(topPos, p => [p, inset + 7], 0, cc);
      drawEdgeChars(topPos, p => [p, h - inset - 2], 30, cc);
      drawEdgeChars(leftPos, p => [inset + 2, p], 15, cc);
      drawEdgeChars(leftPos, p => [w - inset - 9, p], 45, cc);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      const surge = t % 100;
      if (surge < 10) {
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.globalAlpha = (1 - surge / 10) * 0.9;
        ctx.shadowColor = cc; ctx.shadowBlur = 40; path(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
    } else if (variant === 2) {
      // Void/cosmic — dense perimeter sparks + inner accent
      const hShift = (t / 3) % 360;
      const cc = hslToHex(hShift, 80, 55);
      ctx.strokeStyle = cc + "28"; ctx.lineWidth = 20;
      ctx.shadowColor = cc; ctx.shadowBlur = 42; path(); ctx.stroke();
      ctx.strokeStyle = color + "60"; ctx.lineWidth = 6; ctx.shadowBlur = 24; path(); ctx.stroke();
      ctx.strokeStyle = cc; ctx.lineWidth = 2; ctx.shadowColor = cc; ctx.shadowBlur = 18; path(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 0.5;
      const mi2 = 5; ctx.beginPath(); ctx.roundRect(mi2, mi2, w - mi2 * 2, h - mi2 * 2, Math.max(0, r - mi2)); ctx.stroke();
      // Dense perimeter sparks
      const pts = perimeterPoints(w, h, r, 200);
      for (let i = 0; i < 8; i++) {
        const idx = Math.floor((t * 2.5 + i * (200 / 8)) % 200);
        const pt = pts[idx];
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = cc; ctx.shadowBlur = 14; ctx.fill();
      }
      ctx.shadowBlur = 0;
    } else {
      // v0: Matrix rain + cosmic bloom + hue shift (original)
      const hShift = (t / 3) % 360;
      const cc = hslToHex(hShift, 100, 60);
      ctx.strokeStyle = cc + "20"; ctx.lineWidth = 16;
      ctx.shadowColor = cc; ctx.shadowBlur = 35; path(); ctx.stroke();
      ctx.strokeStyle = color + "50"; ctx.lineWidth = 6; ctx.shadowBlur = 20; path(); ctx.stroke();
      const flick = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
      ctx.strokeStyle = cc; ctx.lineWidth = 2; ctx.globalAlpha = flick;
      ctx.shadowColor = cc; ctx.shadowBlur = 16; path(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff30"; ctx.lineWidth = 0.5;
      const mi3 = 5; ctx.beginPath(); ctx.roundRect(mi3, mi3, w - mi3 * 2, h - mi3 * 2, Math.max(0, r - mi3)); ctx.stroke();
      ctx.font = "bold 7px monospace"; ctx.shadowColor = cc; ctx.shadowBlur = 8;
      const topPos2 = Array.from({ length: Math.floor(w / 9) }, (_, i) => i * 9 + 4);
      const leftPos2 = Array.from({ length: Math.floor(h / 9) }, (_, i) => i * 9 + 4);
      drawEdgeChars(topPos2, p => [p, inset + 7], 0, cc);
      drawEdgeChars(topPos2, p => [p, h - inset - 2], 30, cc);
      drawEdgeChars(leftPos2, p => [inset + 2, p], 15, cc);
      drawEdgeChars(leftPos2, p => [w - inset - 9, p], 45, cc);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      const surgePhase = t % 120;
      if (surgePhase < 8) {
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
        ctx.globalAlpha = (1 - surgePhase / 8) * 0.8;
        ctx.shadowColor = cc; ctx.shadowBlur = 30; path(); ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
    }
  }
}

export function FrameCardWrapper({
  frameId, colorOverride, children, className, style, borderRadius = 8,
}: Props) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity as FrameRarity;
  const variant = FRAME_VARIANT[frame.id] ?? 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    if (!frameId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isStatic = rarity === "common";

    function draw() {
      if (!canvas || !ctx) return;
      drawFrame(canvas, ctx, tRef.current, rarity, color, borderRadius, variant);
      tRef.current++;
      if (!isStatic) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    animRef.current = requestAnimationFrame(draw);

    let ro: ResizeObserver | null = null;
    if (isStatic && canvas.parentElement) {
      ro = new ResizeObserver(() => {
        if (!canvas || !ctx) return;
        drawFrame(canvas, ctx, 0, rarity, color, borderRadius, variant);
      });
      ro.observe(canvas.parentElement);
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      ro?.disconnect();
    };
  }, [frameId, rarity, color, borderRadius, variant]);

  const glow = frameId && rarity !== "common"
    ? `0 0 ${rarity === "mythic" ? 24 : rarity === "legendary" ? 18 : rarity === "epic" ? 12 : rarity === "rare" ? 8 : 4}px ${color}40`
    : undefined;

  return (
    <div
      className={className}
      style={{ position: "relative", borderRadius, boxShadow: glow, ...style }}
    >
      {frameId && (
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
      )}
      {children}
    </div>
  );
}
