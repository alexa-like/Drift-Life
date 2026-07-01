import { useEffect, useRef } from "react";
import { getFrame, FrameRarity } from "../lib/frames";
import { AvatarWithFrame } from "./AvatarWithFrame";
import type { ChatMessage } from "../lib/types";

// Re-export so existing callers that import ChatMessage from here still compile
export type { ChatMessage };

const FACTION_COLOR: Record<string, string> = {
  suits: "#f59e0b",
  street: "#ff6b35",
  grid: "#00d4ff",
};

const FACTION_LABEL: Record<string, string> = {
  suits: "SUITS",
  street: "STREET",
  grid: "GRID",
};

interface Props {
  message: ChatMessage;
  isOwn?: boolean;
  onUsernameClick?: (userId: string, username: string) => void;
}

// ─── Rarity strip opacity (common has no canvas so body border is CSS) ────────
const STRIP_OPACITY: Record<FrameRarity, string> = {
  common:    "18",
  uncommon:  "22",
  rare:      "30",
  epic:      "38",
  legendary: "48",
  mythic:    "58",
};

// ─── Canvas drawing ───────────────────────────────────────────────────────────

function drawBubbleFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  t: number,
  rarity: FrameRarity,
  color: string,
) {
  const cRect = canvas.getBoundingClientRect();
  const w = Math.round(cRect.width);
  const h = Math.round(cRect.height);
  if (w === 0 || h === 0) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.clearRect(0, 0, w, h);

  const r = 0; // body div has square bottom corners
  const inset = 1;

  const path = () => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(0, r - inset));
  };

  // common is handled via CSS — should not reach here
  if (rarity === "common") return;

  if (rarity === "uncommon") {
    ctx.strokeStyle = color + "20";
    ctx.lineWidth = 1.5;
    path(); ctx.stroke();

    const perim = 2 * (w + h);
    const pos = (t * 2.5) % perim;
    const pts = bubblePerimPts(w, h, r, 120);
    const total = pts.length;
    const headIdx = Math.floor((pos / perim) * total) % total;

    for (let i = 0; i < 25; i++) {
      const idx = (headIdx - i + total) % total;
      const pt = pts[idx];
      const alpha = (1 - i / 25) ** 1.5;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 1 + (1 - i / 25), 0, Math.PI * 2);
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
      ctx.shadowColor = color;
      ctx.shadowBlur = alpha * 8;
      ctx.fill();
    }
    const head = pts[headIdx];
    ctx.beginPath();
    ctx.arc(head[0], head[1], 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }

  if (rarity === "rare") {
    const pulse = 0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2);
    ctx.strokeStyle = color + "30";
    ctx.lineWidth = 5 + pulse * 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * pulse;
    path(); ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.shadowBlur = 8 * pulse;
    path(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    return;
  }

  if (rarity === "epic") {
    const angle = (t / 80) * Math.PI * 2;
    const grad = ctx.createConicGradient(angle, w / 2, h / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.15, "#ffffff");
    grad.addColorStop(0.3, color + "20");
    grad.addColorStop(0.5, color);
    grad.addColorStop(0.8, color + "20");
    grad.addColorStop(1, color);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = color + "25";
    ctx.lineWidth = 6;
    path(); ctx.stroke();
    return;
  }

  if (rarity === "legendary") {
    ctx.strokeStyle = color + "15";
    ctx.lineWidth = 10;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    path(); ctx.stroke();

    ctx.strokeStyle = color + "40";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    path(); ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    path(); ctx.stroke();
    ctx.shadowBlur = 0;

    if (t % 6 === 0) {
      for (let i = 0; i < 2; i++) {
        const side = Math.floor(Math.random() * 4);
        let x1: number, y1: number;
        if (side === 0) { x1 = Math.random() * w; y1 = inset; }
        else if (side === 1) { x1 = w - inset; y1 = Math.random() * h; }
        else if (side === 2) { x1 = Math.random() * w; y1 = h - inset; }
        else { x1 = inset; y1 = Math.random() * h; }
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 10, y1 + (Math.random() - 0.5) * 10);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;
    }
    return;
  }

  if (rarity === "mythic") {
    const hShift = (t / 3) % 360;
    const cyc = hslToHexBubble(hShift, 100, 60);

    ctx.strokeStyle = cyc + "15";
    ctx.lineWidth = 12;
    ctx.shadowColor = cyc;
    ctx.shadowBlur = 28;
    path(); ctx.stroke();

    ctx.strokeStyle = color + "50";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 16;
    path(); ctx.stroke();

    const flick = 0.7 + 0.3 * Math.abs(Math.sin((t / 8) * Math.PI));
    ctx.strokeStyle = cyc;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = flick;
    ctx.shadowColor = cyc;
    ctx.shadowBlur = 12;
    path(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    const chars = "01#!アイ@$";
    ctx.font = "6px monospace";
    ctx.fillStyle = cyc;
    ctx.shadowColor = cyc;
    ctx.shadowBlur = 6;
    for (let x = 6; x < w - 6; x += 8) {
      const ci = Math.floor((t + x) / 5) % chars.length;
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin((t + x) / 14));
      ctx.globalAlpha = alpha;
      ctx.fillText(chars[ci], x, inset + 5);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function bubblePerimPts(w: number, h: number, r: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  const perim = 2 * (w + h);
  for (let i = 0; i < n; i++) {
    const d = (i / n) * perim;
    pts.push(perimPt(d, w, h, r, perim));
  }
  return pts;
}

function perimPt(d: number, w: number, h: number, r: number, perim: number): [number, number] {
  const inset = 1;
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const rr = Math.min(r, w / 2, h / 2);
  const arcLen = (Math.PI / 2) * rr;
  const sw = x1 - x0 - 2 * rr;
  const sh = y1 - y0 - 2 * rr;
  const segs = [sw, arcLen, sh, arcLen, sw, arcLen, sh, arcLen];

  let rem = d % perim;
  for (let i = 0; i < segs.length; i++) {
    if (rem <= segs[i]) {
      const t = rem / segs[i];
      if (i === 0) return [x0 + rr + t * sw, y0];
      if (i === 1) { const a = -Math.PI / 2 + t * Math.PI / 2; return [x1 - rr + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]; }
      if (i === 2) return [x1, y0 + rr + t * sh];
      if (i === 3) { const a = 0 + t * Math.PI / 2; return [x1 - rr + rr * Math.cos(a), y1 - rr + rr * Math.sin(a)]; }
      if (i === 4) return [x1 - rr - t * sw, y1];
      if (i === 5) { const a = Math.PI / 2 + t * Math.PI / 2; return [x0 + rr + rr * Math.cos(a), y1 - rr + rr * Math.sin(a)]; }
      if (i === 6) return [x0, y1 - rr - t * sh];
      if (i === 7) { const a = Math.PI + t * Math.PI / 2; return [x0 + rr + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]; }
    }
    rem -= segs[i];
  }
  return [x0 + rr, y0];
}

function hslToHexBubble(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const v = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── BubbleCanvas (animated body border) ─────────────────────────────────────
// IntersectionObserver pauses the rAF loop when the message scrolls off-screen.
// Common frames skip this component entirely and use a CSS border instead.

function BubbleCanvas({ frameId, colorOverride }: { frameId: string | null | undefined; colorOverride?: string | null }) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity as FrameRarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!frameId || frameId === "ghostFrame") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx || !runningRef.current) return;
      drawBubbleFrame(canvas, ctx, tRef.current, rarity, color);
      tRef.current++;
      animRef.current = requestAnimationFrame(draw);
    }

    function start() {
      if (runningRef.current) return;
      runningRef.current = true;
      animRef.current = requestAnimationFrame(draw);
    }

    function stop() {
      runningRef.current = false;
      cancelAnimationFrame(animRef.current);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    // Also watch for size changes (for the static-like mythic border chars)
    const ro = new ResizeObserver(() => {
      if (!runningRef.current && canvas && ctx) {
        drawBubbleFrame(canvas, ctx, tRef.current, rarity, color);
      }
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      io.disconnect();
      ro.disconnect();
      stop();
    };
  }, [frameId, rarity, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        borderRadius: 0,
      }}
    />
  );
}

// ─── FrameRectBubble — two-zone chat card ─────────────────────────────────────

export function FrameRectBubble({ message, isOwn, onUsernameClick }: Props) {
  const frame = getFrame(message.frame);
  // Effective color: player's custom override > catalog glowColor
  const color = message.frameColor || frame.glowColor;
  const rarity = frame.rarity;
  const hasFrame = !!message.frame && message.frame !== "ghostFrame";

  // ── Header strip background ──────────────────────────────────────────────
  const headerBackground = (() => {
    if (!hasFrame) return isOwn ? "#111118" : "#0d0d15";
    // Custom color bypasses headerBg even for mythic (player's choice wins)
    if (!message.frameColor && rarity === "mythic" && frame.headerBg) {
      return frame.headerBg;
    }
    return color + STRIP_OPACITY[rarity];
  })();

  // ── Message text color ───────────────────────────────────────────────────
  // Custom frameColor tints text for any tier; catalog textColor for non-custom.
  const effectiveTextColor = (() => {
    if (!hasFrame) return "#c4c9d4";
    if (message.frameColor) return message.frameColor;
    return frame.textColor || "#c4c9d4";
  })();

  // ── Outer card glow & border ─────────────────────────────────────────────
  const outerGlow = hasFrame
    ? `0 0 ${rarity === "mythic" ? 14 : rarity === "legendary" ? 10 : rarity === "epic" ? 6 : 3}px ${color}20`
    : "none";
  const outerBorder = hasFrame
    ? `1px solid ${color}28`
    : `1px solid #1a1a2e`;

  // ── Common frame body border (CSS, no canvas) ────────────────────────────
  const commonBodyStyle = hasFrame && rarity === "common"
    ? { borderTop: `1px solid ${color}40`, boxShadow: `inset 0 0 6px ${color}10` }
    : {};

  // ── Faction tag ──────────────────────────────────────────────────────────
  const factionTag = message.tag
    ? message.tag.toUpperCase()
    : (message.faction ? FACTION_LABEL[message.faction] : null);
  const factionColor = FACTION_COLOR[message.faction || ""] || "#475569";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 4,
        border: outerBorder,
        boxShadow: outerGlow,
      }}
    >
      {/* ══ ZONE 1: Header strip ══════════════════════════════════════════════ */}
      <div
        style={{
          position: "relative",
          background: headerBackground,
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 30,
          borderBottom: hasFrame ? `1px solid ${color}18` : "1px solid #13131f",
        }}
      >
        {/* Avatar */}
        <AvatarWithFrame
          username={message.username}
          frameId={message.frame}
          frameColor={message.frameColor}
          size="xs"
        />

        {/* Username */}
        <button
          className="font-mono text-xs font-bold hover:underline"
          style={{
            color: hasFrame ? color : factionColor,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            lineHeight: 1,
            flexShrink: 0,
          }}
          onClick={() => onUsernameClick?.(message.userId, message.username)}
        >
          {message.username}
        </button>

        {/* Faction / gang tag */}
        {factionTag && (
          <span
            className="font-mono"
            style={{ fontSize: 9, color: factionColor, opacity: 0.75, flexShrink: 0 }}
          >
            [{factionTag}]
          </span>
        )}

        {/* Player title */}
        {message.title && (
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "#475569", flexShrink: 0 }}
          >
            [{message.title}]
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Frame label — hidden for ghost / no frame */}
        {hasFrame && (
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              color,
              opacity: 0.75,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {frame.name}
          </span>
        )}

        {/* Frame icon */}
        {hasFrame && (
          <span
            style={{
              fontSize: 13,
              color,
              lineHeight: 1,
              flexShrink: 0,
              textShadow: `0 0 8px ${color}80`,
            }}
          >
            {frame.icon}
          </span>
        )}
      </div>

      {/* ══ ZONE 2: Body bubble ═══════════════════════════════════════════════ */}
      <div
        style={{
          position: "relative",
          background: isOwn ? "#111118" : "#0d0d15",
          overflow: "hidden",
          ...commonBodyStyle,
        }}
      >
        {/* Canvas animation sits behind text (z-index 1).
            Common frames skip canvas — rendered as pure CSS above. */}
        {hasFrame && rarity !== "common" && (
          <BubbleCanvas frameId={message.frame} colorOverride={message.frameColor} />
        )}

        {/* Text layer (z-index 2) */}
        <div style={{ position: "relative", zIndex: 2, padding: "5px 10px 6px" }}>
          <p
            className="font-mono text-xs break-all"
            style={{ color: effectiveTextColor, margin: 0, lineHeight: 1.45 }}
          >
            {message.content}
          </p>

          {/* Footer row: level (left) + timestamp (right) */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2, gap: 8 }}>
            {message.level !== undefined && (
              <span className="font-mono" style={{ color: "#2d3748", fontSize: 9 }}>
                Lv.{message.level}
              </span>
            )}
            <span className="font-mono" style={{ color: "#2d3748", fontSize: 9 }}>
              {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
