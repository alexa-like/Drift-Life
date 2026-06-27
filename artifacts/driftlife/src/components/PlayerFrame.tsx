import { useEffect, useRef } from "react";
import { getFrame, FrameRarity } from "../lib/frames";

export type FrameSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};
const BORDER_PX: Record<FrameSize, number> = {
  xs: 2, sm: 2, md: 3, lg: 3, xl: 4,
};

// Each frameId gets a unique index 0-9 within its rarity tier
export const FRAME_VARIANT: Record<string, number> = {
  // Common
  ghostFrame: 0, basicWhite: 1, basicGray: 2, neonBlue: 3,
  neonGreen: 4, neonRed: 5, corpGray: 6,
  streetOrange: 7, cyanPulse: 8, goldBasic: 9,
  // Uncommon
  shimmerCyan: 0, shimmerPurple: 1, shimmerGold: 2, shimmerRed: 3,
  shimmerGreen: 4, shimmerOrange: 5, techShimmer: 6,
  suitShimmer: 7, crimsonShimmer: 8, iceShimmer: 9,
  // Rare
  pulseCyan: 0, pulsePurple: 1, pulseGold: 2, pulseRed: 3,
  pulseGreen: 4, hackerPulse: 5, corePulse: 6,
  vaultPulse: 7, streetPulse: 8, spectralPulse: 9,
  // Epic
  epicCyan: 0, epicPurple: 1, epicGold: 2, syndicate: 3,
  epicRed: 4, gridCore: 5, suitsFrame: 6,
  epicVoid: 7, epicInferno: 8, epicNova: 9,
  // Legendary
  legendCyan: 0, legendPurple: 1, legendRed: 2, arcLight: 3,
  legendGold: 4, crimsonLord: 5, thunderClap: 6,
  plasmaBolt: 7, vantaLegend: 8, executioner: 9,
  // Mythic
  matrixGreen: 0, matrixBlue: 1, omega: 2, voidWalker: 3,
  matrixGold: 4, matrixRed: 5, architect: 6,
  nova2047: 7, godMode: 8, theOne: 9,
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
  const idx = FRAME_VARIANT[frame.id] ?? 0;
  const color = frame.glowColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const b = border;
    let animId: number, t = 0;
    const CHARS = "01アイウBC#!@$%░▓█";

    // ── COMMON — 10 unique static designs ──────────────────────────────────
    function drawCommon() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = color;
      ctx!.shadowColor = color;
      const R = 4;
      switch (idx) {
        case 0: { // Rounded + L-corner arms
          ctx!.lineWidth = b * 2; ctx!.shadowBlur = 4;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          const arm = Math.max(5, w * 0.25);
          ctx!.lineWidth = b; ctx!.shadowBlur = 8;
          for (const [cx, cy, sx, sy] of [[b,b,1,1],[w-b,b,-1,1],[b,h-b,1,-1],[w-b,h-b,-1,-1]] as const) {
            ctx!.beginPath(); ctx!.moveTo(cx + sx * arm, cy); ctx!.lineTo(cx, cy); ctx!.lineTo(cx, cy + sy * arm); ctx!.stroke();
          }
          break;
        }
        case 1: { // Square + glowing corner dots
          ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 5;
          ctx!.beginPath(); ctx!.rect(b, b, w - b * 2, h - b * 2); ctx!.stroke();
          ctx!.shadowBlur = 12;
          for (const [cx, cy] of [[b,b],[w-b,b],[b,h-b],[w-b,h-b]] as const) {
            ctx!.beginPath(); ctx!.arc(cx, cy, b * 1.4, 0, Math.PI * 2);
            ctx!.fillStyle = color; ctx!.fill();
          }
          break;
        }
        case 2: { // Chamfered octagon
          const cut = Math.max(4, w * 0.18);
          ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 5;
          ctx!.beginPath();
          ctx!.moveTo(b + cut, b); ctx!.lineTo(w - b - cut, b);
          ctx!.lineTo(w - b, b + cut); ctx!.lineTo(w - b, h - b - cut);
          ctx!.lineTo(w - b - cut, h - b); ctx!.lineTo(b + cut, h - b);
          ctx!.lineTo(b, h - b - cut); ctx!.lineTo(b, b + cut);
          ctx!.closePath(); ctx!.stroke();
          break;
        }
        case 3: { // Double concentric borders
          ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 6;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          ctx!.lineWidth = b * 0.8; ctx!.shadowBlur = 3; ctx!.globalAlpha = 0.4;
          ctx!.beginPath(); ctx!.roundRect(b * 3, b * 3, w - b * 6, h - b * 6, R); ctx!.stroke();
          ctx!.globalAlpha = 1;
          break;
        }
        case 4: { // Dashed border
          ctx!.setLineDash([5, 3]); ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 5;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          ctx!.setLineDash([]);
          break;
        }
        case 5: { // Thick glow band + thin inner line
          ctx!.lineWidth = b * 4; ctx!.shadowBlur = 2; ctx!.globalAlpha = 0.3;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          ctx!.lineWidth = b; ctx!.shadowBlur = 10; ctx!.globalAlpha = 1;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          break;
        }
        case 6: { // Corner brackets ONLY (no sides)
          const arm2 = Math.max(6, w * 0.3);
          ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 8;
          for (const [cx, cy, sx, sy] of [[b,b,1,1],[w-b,b,-1,1],[b,h-b,1,-1],[w-b,h-b,-1,-1]] as const) {
            ctx!.beginPath(); ctx!.moveTo(cx + sx * arm2, cy); ctx!.lineTo(cx, cy); ctx!.lineTo(cx, cy + sy * arm2); ctx!.stroke();
          }
          break;
        }
        case 7: { // Inner ring + perimeter dots
          ctx!.lineWidth = b; ctx!.shadowBlur = 6;
          ctx!.beginPath(); ctx!.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, R); ctx!.stroke();
          ctx!.shadowBlur = 10; ctx!.fillStyle = color;
          const step = Math.max(6, w / 3.5);
          for (let i = b; i <= w - b; i += step) {
            for (const y of [b, h - b]) { ctx!.beginPath(); ctx!.arc(i, y, b * 0.7, 0, Math.PI * 2); ctx!.fill(); }
          }
          for (let j = b + step; j < h - b; j += step) {
            for (const x of [b, w - b]) { ctx!.beginPath(); ctx!.arc(x, j, b * 0.7, 0, Math.PI * 2); ctx!.fill(); }
          }
          break;
        }
        case 8: { // Diagonal X marks at corners
          ctx!.lineWidth = b; ctx!.shadowBlur = 4; ctx!.globalAlpha = 0.35;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          ctx!.globalAlpha = 1; ctx!.lineWidth = b * 1.5; ctx!.shadowBlur = 10;
          const sz = Math.max(5, w * 0.2);
          for (const [cx, cy] of [[b, b], [w - b, b], [b, h - b], [w - b, h - b]] as const) {
            ctx!.beginPath(); ctx!.moveTo(cx - sz * 0.6, cy - sz * 0.6); ctx!.lineTo(cx + sz * 0.6, cy + sz * 0.6); ctx!.stroke();
            ctx!.beginPath(); ctx!.moveTo(cx + sz * 0.6, cy - sz * 0.6); ctx!.lineTo(cx - sz * 0.6, cy + sz * 0.6); ctx!.stroke();
          }
          break;
        }
        case 9: { // Two thin rings (outer solid + inner faint)
          ctx!.lineWidth = b * 2.5; ctx!.shadowBlur = 3; ctx!.globalAlpha = 0.55;
          ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, R); ctx!.stroke();
          ctx!.lineWidth = b * 0.7; ctx!.shadowBlur = 8; ctx!.globalAlpha = 1;
          ctx!.beginPath(); ctx!.roundRect(b * 3.5, b * 3.5, w - b * 7, h - b * 7, R); ctx!.stroke();
          break;
        }
      }
      ctx!.shadowBlur = 0; ctx!.globalAlpha = 1;
    }

    // ── UNCOMMON — parameterized by idx ────────────────────────────────────
    const U_SPEED  = [2.5, 2.0, 0.0, 3.0, 1.5, 3.5, 2.2, 0.0, 4.0, 1.0];
    const U_TAIL   = [20,  14,   0,  16,  30,  12,  25,   0,  10,  40];
    const U_DIR    = [ 1,   1,   1,   1,  -1,   1,   1,  -1,   1,   1];
    const U_CNT    = [ 1,   2,   0,   1,   1,   3,   1,   0,   2,   1];
    const U_DASHSP = [ 0,   0,  0.8,  0,   0,   0,   0, 1.2,   0,   0];
    function drawUncommon() {
      ctx!.clearRect(0, 0, w, h);
      const perim = 2 * (w + h);
      const spd = U_SPEED[idx] ?? 2.5;
      const tail = U_TAIL[idx] ?? 20;
      const dir = U_DIR[idx] ?? 1;
      const cnt = U_CNT[idx] ?? 1;
      const dashSp = U_DASHSP[idx] ?? 0;
      ctx!.strokeStyle = color + "25"; ctx!.lineWidth = b;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      if (dashSp > 0) {
        ctx!.setLineDash([6, 4]); ctx!.lineDashOffset = -(t * dashSp) % 10;
        ctx!.strokeStyle = color; ctx!.lineWidth = b * 1.5;
        ctx!.shadowColor = color; ctx!.shadowBlur = 6;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
        ctx!.setLineDash([]); ctx!.shadowBlur = 0;
      } else {
        for (let c = 0; c < cnt; c++) {
          const offset = (c / cnt) * perim;
          const pos = ((t * spd * dir + offset) + perim * 200) % perim;
          for (let i = 0; i < tail; i++) {
            const tp = (pos - dir * i * (perim * 0.1 / tail) + perim * 200) % perim;
            const [px2, py] = perimPt(tp, w, h, b);
            const alpha = (1 - i / tail) ** 1.5;
            ctx!.beginPath(); ctx!.arc(px2, py, b * 0.9, 0, Math.PI * 2);
            ctx!.fillStyle = color + Math.floor(alpha * 200).toString(16).padStart(2, "0");
            ctx!.shadowColor = color; ctx!.shadowBlur = alpha * 7; ctx!.fill();
          }
          const [hx, hy] = perimPt(pos, w, h, b);
          ctx!.beginPath(); ctx!.arc(hx, hy, b * 1.1, 0, Math.PI * 2);
          ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 13; ctx!.fill();
        }
      }
      ctx!.shadowBlur = 0; t++;
    }

    // ── RARE — parameterized by idx ─────────────────────────────────────────
    const R_FREQ  = [40, 32, 48, 36, 44, 28, 55, 60, 38, 50];
    const R_STYLE = [0,  1,  0,  2,  0,  1,  0,  2,  1,  2]; // 0=ripple,1=dual,2=spot
    function drawRare() {
      ctx!.clearRect(0, 0, w, h);
      const freq = R_FREQ[idx] ?? 40;
      const style = R_STYLE[idx] ?? 0;
      if (style === 1) {
        const p1 = 0.5 + 0.5 * Math.sin((t / freq) * Math.PI * 2);
        const p2 = 0.5 + 0.5 * Math.sin((t / freq) * Math.PI * 2 + Math.PI);
        ctx!.strokeStyle = color; ctx!.lineWidth = b; ctx!.shadowColor = color;
        ctx!.shadowBlur = 5 + 7 * p1; ctx!.globalAlpha = 0.3 + 0.7 * p1;
        ctx!.beginPath(); ctx!.roundRect(b * 0.5, b * 0.5, w - b, h - b, 5); ctx!.stroke();
        ctx!.shadowBlur = 5 + 7 * p2; ctx!.globalAlpha = 0.3 + 0.7 * p2;
        ctx!.beginPath(); ctx!.roundRect(b * 2.5, b * 2.5, w - b * 5, h - b * 5, 2); ctx!.stroke();
        ctx!.globalAlpha = 1; ctx!.shadowBlur = 0;
      } else if (style === 2) {
        ctx!.strokeStyle = color + "40"; ctx!.lineWidth = b;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
        const perim = 2 * (w + h), pos = (t * (1.5 + idx * 0.1)) % perim;
        for (let i = 0; i < 12; i++) {
          const tp = (pos - i * (perim * 0.07 / 12) + perim * 10) % perim;
          const [px2, py] = perimPt(tp, w, h, b);
          const alpha = (1 - i / 12) ** 2;
          ctx!.beginPath(); ctx!.arc(px2, py, b + b * alpha * 0.5, 0, Math.PI * 2);
          ctx!.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
          ctx!.shadowColor = color; ctx!.shadowBlur = alpha * 10; ctx!.fill();
        }
        ctx!.shadowBlur = 0;
      } else {
        const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / freq) * Math.PI * 2));
        ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
        ctx!.shadowColor = color; ctx!.shadowBlur = 8 * pulse;
        ctx!.globalAlpha = 0.5 + 0.5 * pulse;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
        ctx!.globalAlpha = 1; ctx!.shadowBlur = 0;
      }
      t++;
    }

    // ── EPIC — parameterized by idx ─────────────────────────────────────────
    const E_SPEED = [80, 65, 95, 55, 40, 100, 70, 45, 85, 60];
    const E_STYLE = [0,  0,  1,  0,  1,  2,   0,  1,  2,  0]; // 0=conic,1=scan,2=diamond
    function drawEpic() {
      ctx!.clearRect(0, 0, w, h);
      const spd = E_SPEED[idx] ?? 80;
      const style = E_STYLE[idx] ?? 0;
      const ang = (t / spd) * Math.PI * 2;
      const cx2 = w / 2, cy2 = h / 2;
      if (style === 1) {
        ctx!.strokeStyle = color + "60"; ctx!.lineWidth = b;
        ctx!.shadowColor = color; ctx!.shadowBlur = 6;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
        const scanY = ((t * (1.2 + idx * 0.1)) % (h + 20)) - 10;
        const sg = ctx!.createLinearGradient(0, scanY - 5, 0, scanY + 5);
        sg.addColorStop(0, color + "00"); sg.addColorStop(0.5, color + "dd"); sg.addColorStop(1, color + "00");
        ctx!.fillStyle = sg; ctx!.fillRect(b, Math.max(b, scanY - 5), w - b * 2, 10);
        ctx!.shadowBlur = 0;
      } else if (style === 2) {
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
        ctx!.shadowBlur = 0;
      } else {
        const grad = ctx!.createConicGradient(ang, cx2, cy2);
        grad.addColorStop(0, color); grad.addColorStop(0.33, color + "80");
        grad.addColorStop(0.66, color + "20"); grad.addColorStop(1, color);
        ctx!.strokeStyle = grad; ctx!.lineWidth = b * 2;
        ctx!.shadowColor = color; ctx!.shadowBlur = 10;
        ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
        const corners2: [number, number][] = [[b,b],[w-b,b],[w-b,h-b],[b,h-b]];
        corners2.forEach(([cx3, cy3], i) => {
          const ph = ang + (i * Math.PI) / 2;
          ctx!.beginPath(); ctx!.arc(cx3 + Math.cos(ph) * b * 2, cy3 + Math.sin(ph) * b * 2, b * 0.8, 0, Math.PI * 2);
          ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = color; ctx!.shadowBlur = 8; ctx!.fill();
        });
        ctx!.shadowBlur = 0;
      }
      t++;
    }

    // ── LEGENDARY — parameterized by idx ────────────────────────────────────
    const L_STYLE = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0]; // 0=sparks,1=arc,2=glitch
    const L_FREQ  = [8, 15, 20, 5, 10, 12, 4, 8, 12, 7];
    function drawLegendary() {
      ctx!.clearRect(0, 0, w, h);
      const style = L_STYLE[idx] ?? 0;
      const freq = L_FREQ[idx] ?? 8;
      ctx!.strokeStyle = color; ctx!.lineWidth = b * 2;
      ctx!.shadowColor = color; ctx!.shadowBlur = 12;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      if (style === 1) {
        if (t % freq < Math.ceil(freq * 0.3)) {
          const corners: [number, number][] = [[b,b],[w-b,b],[w-b,h-b],[b,h-b]];
          const c1 = Math.floor(t / freq) % 4, c2 = (c1 + 1 + Math.floor(t / freq / 2) % 2) % 4;
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
      } else if (style === 2) {
        const glitch = t % freq < 3;
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
        ctx!.globalAlpha = 1;
      } else {
        if (t % freq === 0) {
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
      }
      ctx!.shadowBlur = 0; t++;
    }

    // ── MYTHIC — parameterized by idx ────────────────────────────────────────
    const M_HUE  = [4, 3, 5, 2, 6, 3.5, 4.5, 7, 2.5, 8];
    const M_DENS = [7, 7, 6, 8, 6, 8,   5,   7, 9,   6];
    const M_STYLE = [0, 1, 2, 1, 0, 2, 1, 0, 2, 1]; // 0=topbot,1=all4,2=void
    function drawMythic() {
      ctx!.clearRect(0, 0, w, h);
      const hueSpd = M_HUE[idx] ?? 4;
      const dens = M_DENS[idx] ?? 7;
      const mstyle = M_STYLE[idx] ?? 0;
      const cc = hsl2hex((t / hueSpd) % 360, 100, 60);
      ctx!.strokeStyle = cc; ctx!.lineWidth = b * 1.5;
      ctx!.shadowColor = cc; ctx!.shadowBlur = 16;
      ctx!.beginPath(); ctx!.roundRect(b, b, w - b * 2, h - b * 2, 4); ctx!.stroke();
      ctx!.font = `${Math.max(5, b * 2)}px monospace`; ctx!.fillStyle = cc; ctx!.shadowBlur = 5;
      if (mstyle === 0) {
        for (let x = 0; x < w; x += dens) {
          const ci = Math.floor((t * 0.3 + x) / 4) % CHARS.length;
          ctx!.globalAlpha = 0.6; ctx!.fillText(CHARS[ci], x, b + 2);
          ctx!.fillText(CHARS[(ci + 3) % CHARS.length], x, h - 1);
        }
      } else if (mstyle === 1) {
        for (let x = 0; x < w; x += dens) {
          const ci = Math.floor((t * 0.4 + x) / 4) % CHARS.length;
          ctx!.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin((t + x) / 10));
          ctx!.fillText(CHARS[ci], x, b + 2); ctx!.fillText(CHARS[(ci + 2) % CHARS.length], x, h - 1);
        }
        for (let y = 0; y < h; y += dens) {
          const ci = Math.floor((t * 0.4 + y + 20) / 4) % CHARS.length;
          ctx!.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin((t + y) / 10));
          ctx!.fillText(CHARS[ci], 0, y); ctx!.fillText(CHARS[(ci + 5) % CHARS.length], w - dens, y);
        }
      } else {
        const perim = 2 * (w + h);
        for (let i = 0; i < 6; i++) {
          const pos = (t * 3 + i * (perim / 6)) % perim;
          const [px2, py] = perimPt(pos, w, h, b);
          ctx!.beginPath(); ctx!.arc(px2, py, b * (0.5 + Math.random() * 0.5), 0, Math.PI * 2);
          ctx!.fillStyle = "#ffffff"; ctx!.shadowColor = cc; ctx!.shadowBlur = 12; ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0; t++;
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

    function draw() {
      drawFn();
      if (!isStatic) animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { if (animId) cancelAnimationFrame(animId); };
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
