import { useEffect, useRef, ReactNode, CSSProperties } from "react";
import { getFrame, FrameRarity } from "../lib/frames";

interface Props {
  frameId?: string | null;
  colorOverride?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  borderRadius?: number;
}

// Draws frame animations onto a canvas that auto-syncs to its rendered CSS size.
// Each call to draw() uses getBoundingClientRect() to read the actual rendered
// canvas dimensions — this avoids the zero-size init race condition.

function drawFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  t: number,
  rarity: FrameRarity,
  color: string,
  br: number,
) {
  // Sync pixel dimensions to rendered CSS size every frame
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
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

  // ── COMMON — polished static border with corner L-accents ──────────────────
  if (rarity === "common") {
    ctx.strokeStyle = color + "90";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Corner L-accent marks
    const acs = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (const [cx, cy, sx, sy] of [
      [inset, inset, 1, 1],
      [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1],
      [w - inset, h - inset, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * acs, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * acs);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    return;
  }

  // ── UNCOMMON — comet racing around the perimeter ───────────────────────────
  if (rarity === "uncommon") {
    // Dim base border
    ctx.strokeStyle = color + "25";
    ctx.lineWidth = 1.5;
    path(); ctx.stroke();

    // Perimeter length (approx)
    const perim = 2 * (w + h);
    const cometPos = (t * 3) % perim;
    const cometLen = perim * 0.18;

    ctx.save();
    ctx.clip(); // clip to canvas bounds
    path();
    ctx.clip();
    ctx.restore();

    // Draw comet as a gradient along the stroke
    // We'll travel the perimeter and draw segments
    const pts = perimeterPoints(w, h, r, 180);
    const total = pts.length;
    const headIdx = Math.floor((cometPos / perim) * total) % total;

    // Draw trailing glow
    for (let i = 0; i < 40; i++) {
      const idx = (headIdx - i + total) % total;
      const pt = pts[idx];
      const alpha = (1 - i / 40) ** 1.5;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 1.5 + (1 - i / 40) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.shadowColor = color;
      ctx.shadowBlur = alpha * 12;
      ctx.fill();
    }
    // Bright head
    const head = pts[headIdx];
    ctx.beginPath();
    ctx.arc(head[0], head[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }

  // ── RARE — pulsing double-layer glow with ripple ───────────────────────────
  if (rarity === "rare") {
    const pulse = 0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2);

    // Outer halo
    ctx.strokeStyle = color + Math.floor((0.1 + 0.2 * pulse) * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 6 + pulse * 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * pulse;
    path(); ctx.stroke();

    // Inner crisp border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * pulse;
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    path(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Ripple rings every 80 frames
    const ripplePhase = (t % 80) / 80;
    if (ripplePhase < 0.6) {
      ctx.strokeStyle = color + Math.floor((1 - ripplePhase / 0.6) * 80).toString(16).padStart(2, "0");
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1 - ripplePhase / 0.6;
      const exp = ripplePhase * 12;
      ctx.beginPath();
      ctx.roundRect(inset - exp, inset - exp, w - inset * 2 + exp * 2, h - inset * 2 + exp * 2, r + exp);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }

  // ── EPIC — conic gradient spin + orbiting corner sparks ───────────────────
  if (rarity === "epic") {
    const angle = (t / 80) * Math.PI * 2;
    const cx = w / 2, cy = h / 2;

    // Conic gradient border
    const grad = ctx.createConicGradient(angle, cx, cy);
    grad.addColorStop(0, color);
    grad.addColorStop(0.15, "#ffffff");
    grad.addColorStop(0.3, color + "20");
    grad.addColorStop(0.5, color);
    grad.addColorStop(0.65, "#ffffff80");
    grad.addColorStop(0.8, color + "20");
    grad.addColorStop(1, color);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Outer glow layer
    ctx.strokeStyle = color + "30";
    ctx.lineWidth = 8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Corner orbiting sparks
    const corners: [number, number][] = [[inset, inset], [w - inset, inset], [w - inset, h - inset], [inset, h - inset]];
    corners.forEach(([x, y], i) => {
      const phase = angle + (i * Math.PI) / 2;
      const ox = Math.cos(phase) * 6;
      const oy = Math.sin(phase) * 6;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    return;
  }

  // ── LEGENDARY — electric arcs + triple bloom ──────────────────────────────
  if (rarity === "legendary") {
    // Outermost thick bloom
    ctx.strokeStyle = color + "18";
    ctx.lineWidth = 12;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    path(); ctx.stroke();

    // Mid bloom
    ctx.strokeStyle = color + "35";
    ctx.lineWidth = 5;
    ctx.shadowBlur = 18;
    path(); ctx.stroke();

    // Main border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner thin accent
    ctx.strokeStyle = "#ffffff50";
    ctx.lineWidth = 0.5;
    const i2 = 4;
    ctx.beginPath();
    ctx.roundRect(i2, i2, w - i2 * 2, h - i2 * 2, Math.max(0, r - i2));
    ctx.stroke();

    // Corner ornaments
    const orn = 12;
    ctx.strokeStyle = "#ffffff90";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (const [x, y, sx, sy] of [
      [inset, inset, 1, 1], [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x + sx * orn, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * orn);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Electric arc bolts (fire randomly)
    if (t % 5 === 0) {
      const numArcs = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numArcs; i++) {
        const side = Math.floor(Math.random() * 4);
        let x1: number, y1: number;
        if (side === 0) { x1 = Math.random() * w; y1 = inset; }
        else if (side === 1) { x1 = w - inset; y1 = Math.random() * h; }
        else if (side === 2) { x1 = Math.random() * w; y1 = h - inset; }
        else { x1 = inset; y1 = Math.random() * h; }

        // Branching lightning
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        let lx = x1, ly = y1;
        const steps = 3 + Math.floor(Math.random() * 3);
        for (let s = 0; s < steps; s++) {
          lx += (Math.random() - 0.5) * 14;
          ly += (Math.random() - 0.5) * 14;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
    }
    return;
  }

  // ── MYTHIC — matrix rain + full cosmic bloom + color shift ────────────────
  if (rarity === "mythic") {
    // Hue-shifting bloom
    const hShift = (t / 3) % 360;
    const cycleColor = hslToHex(hShift, 100, 60);

    // Outermost bloom
    ctx.strokeStyle = cycleColor + "20";
    ctx.lineWidth = 16;
    ctx.shadowColor = cycleColor;
    ctx.shadowBlur = 35;
    path(); ctx.stroke();

    // Mid glow
    ctx.strokeStyle = color + "50";
    ctx.lineWidth = 6;
    ctx.shadowBlur = 20;
    path(); ctx.stroke();

    // Main border (flickers)
    const flick = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
    ctx.strokeStyle = cycleColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = flick;
    ctx.shadowColor = cycleColor;
    ctx.shadowBlur = 16;
    path(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Inner white accent
    ctx.strokeStyle = "#ffffff30";
    ctx.lineWidth = 0.5;
    const mi = 5;
    ctx.beginPath();
    ctx.roundRect(mi, mi, w - mi * 2, h - mi * 2, Math.max(0, r - mi));
    ctx.stroke();

    // Matrix chars along all 4 edges
    const chars = "01アイウ#!@$%0█▓▒░";
    ctx.font = "bold 7px monospace";
    ctx.shadowColor = cycleColor;
    ctx.shadowBlur = 8;

    const drawEdgeChars = (
      positions: number[],
      getXY: (p: number, ci: number) => [number, number],
      offset: number,
    ) => {
      positions.forEach(p => {
        const speed = (t + p + offset) / 6;
        const ci = Math.floor(speed) % chars.length;
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin((t + p + offset) / 15));
        ctx.globalAlpha = alpha;
        const [x, y] = getXY(p, ci);
        ctx.fillStyle = cycleColor;
        ctx.fillText(chars[ci], x, y);
      });
    };

    // Top edge
    const topPositions = Array.from({ length: Math.floor(w / 9) }, (_, i) => i * 9 + 4);
    drawEdgeChars(topPositions, p => [p, inset + 7], 0);

    // Bottom edge
    drawEdgeChars(topPositions, p => [p, h - inset - 2], 30);

    // Left edge
    const leftPositions = Array.from({ length: Math.floor(h / 9) }, (_, i) => i * 9 + 4);
    drawEdgeChars(leftPositions, p => [inset + 2, p], 15);

    // Right edge
    drawEdgeChars(leftPositions, p => [w - inset - 9, p], 45);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Surge flash (every 120 frames)
    const surgePhase = t % 120;
    if (surgePhase < 8) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (1 - surgePhase / 8) * 0.8;
      ctx.shadowColor = cycleColor;
      ctx.shadowBlur = 30;
      path(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }
}

// Generate evenly-spaced points along a rounded-rect perimeter
function perimeterPoints(w: number, h: number, r: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  const rr = Math.min(r, w / 2, h / 2);
  const inset = 1.5;
  const x0 = inset, y0 = inset;
  const x1 = w - inset, y1 = h - inset;
  const arcLen = (Math.PI / 2) * rr;
  const straight_w = x1 - x0 - 2 * rr;
  const straight_h = y1 - y0 - 2 * rr;
  const perim = 2 * (straight_w + straight_h) + 4 * arcLen;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * perim;
    const pt = perimeterPoint(d, x0, y0, x1, y1, rr, straight_w, straight_h, arcLen, perim);
    pts.push(pt);
  }
  return pts;
}

function perimeterPoint(
  d: number, x0: number, y0: number, x1: number, y1: number,
  rr: number, sw: number, sh: number, arcLen: number, _perim: number,
): [number, number] {
  const seg = [sw, arcLen, sh, arcLen, sw, arcLen, sh, arcLen];
  const starts = [0];
  for (let i = 1; i < seg.length; i++) starts.push(starts[i - 1] + seg[i - 1]);

  let rem = d % (_perim);
  for (let i = 0; i < seg.length; i++) {
    if (rem <= seg[i]) {
      const t = rem / seg[i];
      // Segments: 0=top, 1=top-right arc, 2=right, 3=bottom-right arc,
      //           4=bottom, 5=bottom-left arc, 6=left, 7=top-left arc
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

export function FrameCardWrapper({
  frameId, colorOverride, children, className, style, borderRadius = 8,
}: Props) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity as FrameRarity;
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
      drawFrame(canvas, ctx, tRef.current, rarity, color, borderRadius);
      tRef.current++;
      if (!isStatic) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    // Use RAF for first draw so the container is fully laid out
    animRef.current = requestAnimationFrame(draw);

    // For static frames, also re-draw on resize
    let ro: ResizeObserver | null = null;
    if (isStatic && canvas.parentElement) {
      ro = new ResizeObserver(() => {
        if (!canvas || !ctx) return;
        drawFrame(canvas, ctx, 0, rarity, color, borderRadius);
      });
      ro.observe(canvas.parentElement);
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      ro?.disconnect();
    };
  }, [frameId, rarity, color, borderRadius]);

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
