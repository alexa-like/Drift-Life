import { useEffect, useRef } from "react";
import { getFrame, FrameRarity } from "../lib/frames";

export type FrameSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};
const BORDER_PX: Record<FrameSize, number> = {
  xs: 2, sm: 2, md: 3, lg: 3, xl: 4,
};

// Each frameId maps to a visual style variant (0, 1, or 2) within its rarity tier
export const FRAME_VARIANT: Record<string, number> = {
  // Common — v0: rounded + L-corners | v1: square corners + dots | v2: chamfered corners
  ghostFrame: 0, basicWhite: 0, basicGray: 0, neonBlue: 0,
  neonGreen: 1, neonRed: 1, corpGray: 1,
  streetOrange: 2, cyanPulse: 2, goldBasic: 2,
  // Uncommon — v0: single comet | v1: dual opposing comets | v2: marching dashes
  shimmerCyan: 0, shimmerPurple: 0, shimmerGold: 0, shimmerRed: 0,
  shimmerGreen: 1, shimmerOrange: 1, techShimmer: 1,
  suitShimmer: 2, crimsonShimmer: 2, iceShimmer: 2,
  // Rare — v0: sine pulse | v1: dual breathing rings | v2: traveling bright spot
  pulseCyan: 0, pulsePurple: 0, pulseGold: 0, pulseRed: 0,
  pulseGreen: 1, hackerPulse: 1, corePulse: 1,
  vaultPulse: 2, streetPulse: 2, spectralPulse: 2,
  // Epic — v0: conic spin + sparks | v1: plasma scan line | v2: orbiting diamonds
  epicCyan: 0, epicPurple: 0, epicGold: 0, syndicate: 0,
  epicRed: 1, gridCore: 1, suitsFrame: 1,
  epicVoid: 2, epicInferno: 2, epicNova: 2,
  // Legendary — v0: random sparks | v1: corner-to-corner arc | v2: glitch/stutter
  legendCyan: 0, legendPurple: 0, legendRed: 0, arcLight: 0,
  legendGold: 1, crimsonLord: 1, thunderClap: 1,
  plasmaBolt: 2, vantaLegend: 2, executioner: 2,
  // Mythic — v0: matrix top+bottom | v1: all-4-edges matrix | v2: void/cosmic sparks
  matrixGreen: 0, matrixBlue: 0, omega: 0, voidWalker: 0,
  matrixGold: 1, matrixRed: 1, architect: 1,
  nova2047: 2, godMode: 2, theOne: 2,
};

interface Props {
  frameId: string | null | undefined;
  size?: FrameSize;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Perimeter helper: walk w×h rect, starting top-left → clockwise
function perimPt(pos: number, W: number, H: number, bb: number): [number, number] {
  const perim = 2 * (W + H);
  const d = ((pos % perim) + perim) % perim;
  if (d < W) return [d, bb];
  if (d < W + H) return [W - bb, d - W];
  if (d < 2 * W + H) return [W - (d - W - H), H - bb];
  return [bb, H - (d - 2 * W - H)];
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
  const rarity = frame.rarity as FrameRarity;
  const variant = FRAME_VARIANT[frame.id] ?? 0;
  const color = frame.glowColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const b = border;
    let animId: number, t = 0;

    // ── COMMON ─────────────────────────────────────────────────────────────
    function drawC0() {
      // Rounded rect + bright L-corner marks
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 4;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const acs = Math.max(5, w * 0.25);
      ctx!.lineWidth = b; ctx!.shadowBlur = 8;
      for (const [cx, cy, sx, sy] of [[b,b,1,1],[w-b,b,-1,1],[b,h-b,1,-1],[w-b,h-b,-1,-1]] as const) {
        ctx!.beginPath(); ctx!.moveTo(cx + sx * acs, cy); ctx!.lineTo(cx, cy); ctx!.lineTo(cx, cy + sy * acs); ctx!.stroke();
      }
      ctx!.shadowBlur = 0;
    }
    function drawC1() {
      // Square (no radius) + glowing dots at corners
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 1.5;
      ctx!.shadowColor = color; ctx!.shadowBlur = 5;
      ctx!.beginPath(); ctx!.rect(b, b, w - b * 2, h - b * 2); ctx!.stroke();
      ctx!.shadowBlur = 12;
      for (const [cx, cy] of [[b,b],[w-b,b],[b,h-b],[w-b,h-b]] as const) {
        ctx!.beginPath(); ctx!.arc(cx, cy, b * 1.4, 0, Math.PI * 2);
        ctx!.fillStyle = color; ctx!.fill();
      }
      ctx!.shadowBlur = 0;
    }
    function drawC2() {
      // Chamfered octagon corners
      ctx!.clearRect(0, 0, w, h);
      const cut = Math.max(4, w * 0.18);
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 1.5;
      ctx!.shadowColor = color; ctx!.shadowBlur = 5;
      ctx!.beginPath();
      ctx!.moveTo(b + cut, b); ctx!.lineTo(w - b - cut, b);
      ctx!.lineTo(w - b, b + cut); ctx!.lineTo(w - b, h - b - cut);
      ctx!.lineTo(w - b - cut, h - b); ctx!.lineTo(b + cut, h - b);
      ctx!.lineTo(b, h - b - cut); ctx!.lineTo(b, b + cut);
      ctx!.closePath(); ctx!.stroke();
      ctx!.shadowBlur = 0;
    }

    // ── UNCOMMON ────────────────────────────────────────────────────────────
    function drawU0() {
      // Single comet clockwise
      ctx!.clearRect(0, 0, w, h);
      const perim = 2 * (w + h);
      const pos = (t * 2.5) % perim;
      ctx!.strokeStyle = color + "25"; ctx!.lineWidth = b;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      for (let i = 0; i < 20; i++) {
        const tp = (pos - i * (perim * 0.12 / 20) + perim * 10) % perim;
        const [px2, py] = perimPt(tp, w, h, b);
        const alpha = (1 - i / 20) ** 1.5;
        ctx!.beginPath(); ctx!.arc(px2, py, b * (0.4 + 0.6 * (1 - i / 20)), 0, Math.PI * 2);
        ctx!.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx!.shadowColor = color; ctx!.shadowBlur = alpha * 8; ctx!.fill();
      }
      const [hx, hy] = perimPt(pos, w, h, b);
      ctx!.beginPath(); ctx!.arc(hx, hy, b * 1.2, 0, Math.PI * 2);
      ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 14; ctx!.fill();
      ctx!.shadowBlur = 0; t++;
    }
    function drawU1() {
      // Two comets going opposite directions
      ctx!.clearRect(0, 0, w, h);
      const perim = 2 * (w + h);
      ctx!.strokeStyle = color + "25"; ctx!.lineWidth = b;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      for (let c = 0; c < 2; c++) {
        const dir = c === 0 ? 1 : -1, offset = c === 0 ? 0 : perim / 2;
        const pos = ((t * 2 * dir) + offset + perim * 100) % perim;
        for (let i = 0; i < 14; i++) {
          const tp = (pos - dir * i * (perim * 0.1 / 14) + perim * 100) % perim;
          const [px2, py] = perimPt(tp, w, h, b);
          const alpha = (1 - i / 14) ** 1.5;
          ctx!.beginPath(); ctx!.arc(px2, py, b * 0.8, 0, Math.PI * 2);
          ctx!.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
          ctx!.shadowColor = color; ctx!.shadowBlur = alpha * 6; ctx!.fill();
        }
        const [hx, hy] = perimPt(pos, w, h, b);
        ctx!.beginPath(); ctx!.arc(hx, hy, b, 0, Math.PI * 2);
        ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 12; ctx!.fill();
      }
      ctx!.shadowBlur = 0; t++;
    }
    function drawU2() {
      // Marching dashes
      ctx!.clearRect(0, 0, w, h);
      ctx!.setLineDash([6, 4]); ctx!.lineDashOffset = -(t * 0.8) % 10;
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 1.5;
      ctx!.shadowColor = color; ctx!.shadowBlur = 6;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.setLineDash([]); ctx!.shadowBlur = 0; t++;
    }

    // ── RARE ─────────────────────────────────────────────────────────────────
    function drawR0() {
      // Sine pulse + globalAlpha
      ctx!.clearRect(0, 0, w, h);
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2));
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 8 * pulse;
      ctx!.globalAlpha = 0.5 + 0.5 * pulse;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
    }
    function drawR1() {
      // Dual breathing rings out of phase
      ctx!.clearRect(0, 0, w, h);
      const p1 = 0.5 + 0.5 * Math.sin((t / 35) * Math.PI * 2);
      const p2 = 0.5 + 0.5 * Math.sin((t / 35) * Math.PI * 2 + Math.PI);
      ctx!.strokeStyle = color; ctx!.lineWidth = b; ctx!.shadowColor = color;
      ctx!.shadowBlur = 5 + 7 * p1; ctx!.globalAlpha = 0.3 + 0.7 * p1;
      ctx!.beginPath(); ctx!.roundRect(b * 0.5, b * 0.5, w - b, h - b, 5); ctx!.stroke();
      ctx!.shadowBlur = 5 + 7 * p2; ctx!.globalAlpha = 0.3 + 0.7 * p2;
      ctx!.beginPath(); ctx!.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, 2); ctx!.stroke();
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
    }
    function drawR2() {
      // Traveling bright spot along perimeter
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color + "40"; ctx!.lineWidth = b;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const perim = 2 * (w + h), pos = (t * 2) % perim;
      for (let i = 0; i < 12; i++) {
        const tp = (pos - i * (perim * 0.07 / 12) + perim * 10) % perim;
        const [px2, py] = perimPt(tp, w, h, b);
        const alpha = (1 - i / 12) ** 2;
        ctx!.beginPath(); ctx!.arc(px2, py, b + b * alpha * 0.5, 0, Math.PI * 2);
        ctx!.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx!.shadowColor = color; ctx!.shadowBlur = alpha * 10; ctx!.fill();
      }
      ctx!.shadowBlur = 0; t++;
    }

    // ── EPIC ─────────────────────────────────────────────────────────────────
    function drawE0() {
      // Conic gradient spin + orbiting corner sparks
      ctx!.clearRect(0, 0, w, h);
      const ang = (t / 80) * Math.PI * 2, cx2 = w / 2, cy2 = h / 2;
      const grad = ctx!.createConicGradient(ang, cx2, cy2);
      grad.addColorStop(0, color); grad.addColorStop(0.33, color + "80");
      grad.addColorStop(0.66, color + "20"); grad.addColorStop(1, color);
      ctx!.strokeStyle = grad; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 10;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const corners: [number, number][] = [[b,b],[w-b,b],[w-b,h-b],[b,h-b]];
      corners.forEach(([cx3, cy3], i) => {
        const ph = ang + (i * Math.PI) / 2;
        ctx!.beginPath(); ctx!.arc(cx3 + Math.cos(ph) * b * 2, cy3 + Math.sin(ph) * b * 2, b * 0.8, 0, Math.PI * 2);
        ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 8; ctx!.fill();
      });
      ctx!.shadowBlur = 0; t++;
    }
    function drawE1() {
      // Plasma scan line (sweeps top→bottom)
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color + "60"; ctx!.lineWidth = b;
      ctx!.shadowColor = color; ctx!.shadowBlur = 6;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const scanY = ((t * 1.5) % (h + 20)) - 10;
      const sg = ctx!.createLinearGradient(0, scanY - 5, 0, scanY + 5);
      sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "dd"); sg.addColorStop(1, color + "00");
      ctx!.fillStyle = sg; ctx!.fillRect(b, Math.max(b, scanY - 5), w - b * 2, 10);
      ctx!.shadowBlur = 0; t++;
    }
    function drawE2() {
      // Orbiting diamond markers at each corner
      ctx!.clearRect(0, 0, w, h);
      const ang = (t / 60) * Math.PI * 2;
      ctx!.strokeStyle = color + "50"; ctx!.lineWidth = b;
      ctx!.shadowColor = color; ctx!.shadowBlur = 8;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.strokeStyle = color + "25"; ctx!.lineWidth = b * 3; ctx!.shadowBlur = 16;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const corners: [number, number][] = [[b,b],[w-b,b],[w-b,h-b],[b,h-b]];
      corners.forEach(([cx3, cy3], i) => {
        const ph = ang + (i * Math.PI / 2), r = b * 2.5;
        const px2 = cx3 + Math.cos(ph) * r, py = cy3 + Math.sin(ph) * r;
        ctx!.save(); ctx!.translate(px2, py); ctx!.rotate(ph);
        ctx!.beginPath(); ctx!.moveTo(0, -b * 0.9); ctx!.lineTo(b * 0.9, 0); ctx!.lineTo(0, b * 0.9); ctx!.lineTo(-b * 0.9, 0); ctx!.closePath();
        ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 10; ctx!.fill(); ctx!.restore();
      });
      ctx!.shadowBlur = 0; t++;
    }

    // ── LEGENDARY ───────────────────────────────────────────────────────────
    function drawL0() {
      // Random electric sparks on border
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 12;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      if (t % 8 === 0) {
        for (let i = 0; i < 3; i++) {
          const side = Math.floor(Math.random() * 4);
          let x1: number, y1: number;
          if (side === 0) { x1 = Math.random() * w; y1 = b; }
          else if (side === 1) { x1 = w - b; y1 = Math.random() * h; }
          else if (side === 2) { x1 = Math.random() * w; y1 = h - b; }
          else { x1 = b; y1 = Math.random() * h; }
          ctx!.strokeStyle = "#ffffff"; ctx!.lineWidth = 1;
          ctx!.shadowBlur = 6; ctx!.shadowColor = "#ffffff";
          ctx!.beginPath(); ctx!.moveTo(x1, y1);
          ctx!.lineTo(x1 + (Math.random() - 0.5) * 12, y1 + (Math.random() - 0.5) * 12);
          ctx!.stroke();
        }
      }
      ctx!.shadowBlur = 0; t++;
    }
    function drawL1() {
      // Corner-to-corner lightning arc
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 10;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      if (t % 15 < 4) {
        const corners: [number, number][] = [[b,b],[w-b,b],[w-b,h-b],[b,h-b]];
        const c1 = Math.floor(Math.random() * 4), c2 = (c1 + 1 + Math.floor(Math.random() * 2)) % 4;
        const [x1, y1] = corners[c1], [x2, y2] = corners[c2];
        ctx!.strokeStyle = "#ffffff"; ctx!.lineWidth = 1;
        ctx!.shadowColor = color; ctx!.shadowBlur = 12; ctx!.globalAlpha = 0.85;
        ctx!.beginPath(); ctx!.moveTo(x1, y1);
        let lx = x1, ly = y1;
        for (let s = 0; s < 5; s++) {
          lx += (x2 - x1) / 5 + (Math.random() - 0.5) * 14;
          ly += (y2 - y1) / 5 + (Math.random() - 0.5) * 14;
          ctx!.lineTo(lx, ly);
        }
        ctx!.lineTo(x2, y2); ctx!.stroke(); ctx!.globalAlpha = 1;
      }
      ctx!.shadowBlur = 0; t++;
    }
    function drawL2() {
      // Glitch/stutter border
      ctx!.clearRect(0, 0, w, h);
      const glitch = t % 20 < 3;
      const ox = glitch ? (Math.random() - 0.5) * 5 : 0;
      const oy = glitch ? (Math.random() - 0.5) * 5 : 0;
      ctx!.strokeStyle = glitch ? "#ffffff" : color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = glitch ? 16 : 8;
      ctx!.globalAlpha = glitch ? 0.7 : 1;
      ctx!.beginPath(); ctx!.roundRect(b + ox, b + oy, w - b * 2, h - b * 2, 4); ctx!.stroke();
      if (glitch) {
        ctx!.strokeStyle = color + "80"; ctx!.lineWidth = b;
        ctx!.beginPath(); ctx!.roundRect(b - ox * 2, b - oy * 2, w - b * 2, h - b * 2, 4); ctx!.stroke();
      }
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
    }

    // ── MYTHIC ──────────────────────────────────────────────────────────────
    const CHARS = "01アイウBC#!@$%░▓█";
    function drawM0() {
      // Matrix chars top+bottom + hue-cycle bloom
      ctx!.clearRect(0, 0, w, h);
      const cc = hsl2hex((t / 2) % 360, 100, 60);
      ctx!.strokeStyle = cc; ctx!.lineWidth = b * 1.5;
      ctx!.shadowColor = cc; ctx!.shadowBlur = 16;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.font = `${Math.max(5, b * 2)}px monospace`; ctx!.fillStyle = cc; ctx!.shadowBlur = 5;
      for (let x = 0; x < w; x += 8) {
        const ci = Math.floor((t * 0.3 + x) / 4) % CHARS.length;
        ctx!.globalAlpha = 0.6; ctx!.fillText(CHARS[ci], x, b + 2);
        ctx!.fillText(CHARS[(ci + 3) % CHARS.length], x, h - 1);
      }
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
    }
    function drawM1() {
      // All 4 edges matrix chars + surge flash
      ctx!.clearRect(0, 0, w, h);
      const cc = hsl2hex((t / 1.5) % 360, 100, 65);
      ctx!.strokeStyle = cc + "30"; ctx!.lineWidth = b * 8;
      ctx!.shadowColor = cc; ctx!.shadowBlur = 28;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.strokeStyle = cc; ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 14;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.font = `${Math.max(5, b * 2)}px monospace`; ctx!.fillStyle = cc; ctx!.shadowBlur = 4;
      for (let x = 0; x < w; x += 7) {
        const ci = Math.floor((t * 0.4 + x) / 4) % CHARS.length;
        ctx!.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin((t + x) / 10));
        ctx!.fillText(CHARS[ci], x, b + 2); ctx!.fillText(CHARS[(ci + 2) % CHARS.length], x, h - 1);
      }
      for (let y = 0; y < h; y += 7) {
        const ci = Math.floor((t * 0.4 + y + 20) / 4) % CHARS.length;
        ctx!.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin((t + y) / 10));
        ctx!.fillText(CHARS[ci], 0, y); ctx!.fillText(CHARS[(ci + 5) % CHARS.length], w - 7, y);
      }
      if (t % 80 < 5) {
        ctx!.globalAlpha = (1 - (t % 80) / 5) * 0.9;
        ctx!.strokeStyle = "#ffffff"; ctx!.lineWidth = 2; ctx!.shadowColor = cc; ctx!.shadowBlur = 24;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      }
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
    }
    function drawM2() {
      // Void/cosmic — dense perimeter sparks + inner accent + color shift
      ctx!.clearRect(0, 0, w, h);
      const cc = hsl2hex((t / 4) % 360, 80, 55);
      ctx!.strokeStyle = cc + "40"; ctx!.lineWidth = b * 10;
      ctx!.shadowColor = cc; ctx!.shadowBlur = 40;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.strokeStyle = cc; ctx!.lineWidth = b * 2; ctx!.shadowBlur = 20;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      const perim = 2 * (w + h);
      for (let i = 0; i < 6; i++) {
        const pos = (t * 3 + i * (perim / 6)) % perim;
        const [px2, py] = perimPt(pos, w, h, b);
        ctx!.beginPath(); ctx!.arc(px2, py, b * (0.5 + Math.random() * 0.5), 0, Math.PI * 2);
        ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = cc; ctx!.shadowBlur = 12; ctx!.fill();
      }
      ctx!.strokeStyle = color + "50"; ctx!.lineWidth = 1; ctx!.shadowBlur = 8;
      ctx!.beginPath(); ctx!.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, 2); ctx!.stroke();
      ctx!.shadowBlur = 0; t++;
    }

    const drawFns: Record<string, () => void> = {
      common_0: drawC0, common_1: drawC1, common_2: drawC2,
      uncommon_0: drawU0, uncommon_1: drawU1, uncommon_2: drawU2,
      rare_0: drawR0, rare_1: drawR1, rare_2: drawR2,
      epic_0: drawE0, epic_1: drawE1, epic_2: drawE2,
      legendary_0: drawL0, legendary_1: drawL1, legendary_2: drawL2,
      mythic_0: drawM0, mythic_1: drawM1, mythic_2: drawM2,
    };

    const drawFn = drawFns[`${rarity}_${variant}`] ?? drawC0;
    const isStatic = rarity === "common";

    function draw() {
      drawFn();
      if (!isStatic) animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [frame.id, rarity, variant, border, color]);

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
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 2 }}
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
