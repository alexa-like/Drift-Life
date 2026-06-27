import { useEffect, useRef, ReactNode } from "react";
import { getFrame } from "../lib/frames";
import { AvatarWithFrame } from "./AvatarWithFrame";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  faction: string | null;
  frame?: string | null;
  frameColor?: string | null;
  frameRarity?: string;
  title?: string | null;
  content: string;
  at: string;
  districtId?: string;
}

const FACTION_COLOR: Record<string, string> = {
  suits: "#f59e0b",
  street: "#ff6b35",
  grid: "#00d4ff",
  neutral: "#64748b",
};

interface Props {
  message: ChatMessage;
  isOwn?: boolean;
  onUsernameClick?: (userId: string, username: string) => void;
}

function ChatFrameCanvas({ frameId, colorOverride }: { frameId: string | null | undefined; colorOverride?: string | null }) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!frameId || rarity === "common") return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    const r = 6;

    function resize() {
      if (!canvas || !container) return;
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const lw = 1.5;
      const inset = lw / 2;

      if (rarity === "uncommon") {
        const phase = (t / 180) * Math.PI * 2;
        const grad = ctx.createLinearGradient(
          w * (0.5 + 0.5 * Math.cos(phase)), 0,
          w * (0.5 - 0.5 * Math.cos(phase)), h
        );
        grad.addColorStop(0, color + "20");
        grad.addColorStop(0.5, color + "99");
        grad.addColorStop(1, color + "20");
        ctx.strokeStyle = grad;
        ctx.lineWidth = lw;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (rarity === "rare") {
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((t / 45) * Math.PI * 2));
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 * pulse;
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else if (rarity === "epic") {
        const angle = (t / 100) * Math.PI * 2;
        const grad = ctx.createConicGradient(angle, w / 2, h / 2);
        grad.addColorStop(0, color);
        grad.addColorStop(0.25, color + "30");
        grad.addColorStop(0.5, color);
        grad.addColorStop(0.75, color + "30");
        grad.addColorStop(1, color);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lw;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (rarity === "legendary") {
        ctx.strokeStyle = color + "40";
        ctx.lineWidth = 5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(inset - 2, inset - 2, w - lw + 4, h - lw + 4, r + 2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (t % 8 === 0) {
          for (let i = 0; i < 2; i++) {
            const side = Math.floor(Math.random() * 4);
            let x1: number, y1: number;
            if (side === 0) { x1 = Math.random() * w; y1 = inset; }
            else if (side === 1) { x1 = w - inset; y1 = Math.random() * h; }
            else if (side === 2) { x1 = Math.random() * w; y1 = h - inset; }
            else { x1 = inset; y1 = Math.random() * h; }
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.shadowColor = color;
            ctx.shadowBlur = 4;
            ctx.globalAlpha = 0.7 + Math.random() * 0.3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 + (Math.random() - 0.5) * 12, y1 + (Math.random() - 0.5) * 12);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
        }
      } else if (rarity === "mythic") {
        ctx.fillStyle = "#0a0a0f06";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = color + "30";
        ctx.lineWidth = 6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.roundRect(inset - 2, inset - 2, w - lw + 4, h - lw + 4, r + 2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const chars = "01#!アイ@$";
        ctx.font = "6px monospace";
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
        for (let x = 4; x < w - 4; x += 9) {
          const ci = Math.floor((t + x) / 5) % chars.length;
          const alpha = 0.2 + 0.8 * Math.abs(Math.sin((t + x) / 18));
          ctx.globalAlpha = alpha;
          ctx.fillText(chars[ci], x, inset + 5);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      t++;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [frameId, rarity, color]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 6 }}
      />
    </div>
  );
}

export function FrameRectBubble({ message, isOwn, onUsernameClick }: Props) {
  const frame = getFrame(message.frame);
  const color = message.frameColor || frame.glowColor;
  const rarity = frame.rarity;
  const factionColor = FACTION_COLOR[message.faction || "neutral"] || "#64748b";

  const hasEffect = !!message.frame && rarity !== "common";
  const borderColor = message.frame
    ? (rarity === "common" ? color + "40" : "transparent")
    : "#1e1e2e";
  const boxShadow = hasEffect
    ? `0 0 ${rarity === "mythic" ? 16 : rarity === "legendary" ? 12 : rarity === "epic" ? 8 : rarity === "rare" ? 6 : 3}px ${color}25`
    : "none";

  return (
    <div
      style={{
        position: "relative",
        background: isOwn ? "#111118" : "#0d0d15",
        borderRadius: 6,
        padding: "6px 10px",
        marginBottom: 4,
        border: `1px solid ${borderColor}`,
        boxShadow,
      }}
    >
      {message.frame && <ChatFrameCanvas frameId={message.frame} colorOverride={message.frameColor} />}

      <div style={{ position: "relative", zIndex: 2 }}>
        <div className="flex items-start gap-2">
          <AvatarWithFrame
            username={message.username}
            frameId={message.frame}
            size="xs"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <button
                className="font-mono text-xs font-bold hover:underline"
                style={{ color: message.frame ? color : factionColor }}
                onClick={() => onUsernameClick?.(message.userId, message.username)}
              >
                {message.username}
              </button>
              {message.frame && rarity !== "common" && (
                <span
                  className="font-mono px-1 rounded"
                  style={{
                    fontSize: 9,
                    background: color + "20",
                    color,
                    border: `1px solid ${color}40`,
                    textTransform: "capitalize",
                  }}
                >
                  {frame.name}
                </span>
              )}
              {message.title && (
                <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                  [{message.title}]
                </span>
              )}
              <span className="font-mono" style={{ color: "#334155", fontSize: 10 }}>
                {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="font-mono text-xs break-all" style={{ color: "#e2e8f0" }}>
              {message.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
