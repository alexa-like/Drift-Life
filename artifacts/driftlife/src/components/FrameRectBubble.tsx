import { useEffect, useRef } from "react";
import { getFrame } from "../lib/frames";
import { AvatarWithFrame } from "./AvatarWithFrame";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  faction: string | null;
  frame?: string | null;
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

export function FrameRectBubble({ message, isOwn, onUsernameClick }: Props) {
  const frame = getFrame(message.frame);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rarity = frame.rarity;
    if (rarity === "common") return; // No animation for common

    let animId: number;
    let t = 0;

    function draw() {
      const w = canvas!.width = container!.offsetWidth;
      const h = canvas!.height = container!.offsetHeight;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      if (rarity === "uncommon") {
        const grad = ctx.createLinearGradient(
          w * (0.5 + 0.5 * Math.cos((t / 100) * Math.PI * 2)),
          0,
          w * (0.5 - 0.5 * Math.cos((t / 100) * Math.PI * 2)),
          h
        );
        grad.addColorStop(0, frame.glowColor + "20");
        grad.addColorStop(0.5, frame.glowColor + "60");
        grad.addColorStop(1, frame.glowColor + "20");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, 6);
        ctx.stroke();
      } else if (rarity === "rare") {
        const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2));
        ctx.strokeStyle = frame.glowColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = frame.glowColor;
        ctx.shadowBlur = 6 * pulse;
        ctx.globalAlpha = 0.4 + 0.6 * pulse;
        ctx.beginPath();
        ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (rarity === "epic") {
        const angle = (t / 120) * Math.PI * 2;
        const grad = ctx.createConicGradient(angle, w / 2, h / 2);
        grad.addColorStop(0, frame.glowColor);
        grad.addColorStop(0.5, frame.glowColor + "40");
        grad.addColorStop(1, frame.glowColor);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = frame.glowColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, 6);
        ctx.stroke();
      } else if (rarity === "legendary" || rarity === "mythic") {
        ctx.strokeStyle = frame.glowColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = frame.glowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(0.75, 0.75, w - 1.5, h - 1.5, 6);
        ctx.stroke();
        if (t % 12 === 0) {
          for (let i = 0; i < 2; i++) {
            const side = Math.floor(Math.random() * 4);
            let x = side === 0 || side === 2 ? Math.random() * w : side === 1 ? w : 0;
            let y = side === 1 || side === 3 ? Math.random() * h : side === 0 ? 0 : h;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
            ctx.stroke();
          }
        }
      }

      t++;
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [frame.id, frame.rarity]);

  const factionColor = FACTION_COLOR[message.faction || "neutral"] || "#64748b";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        background: isOwn ? "#111118" : "#0d0d15",
        borderRadius: 6,
        padding: "6px 10px",
        marginBottom: 4,
        border: `1px solid ${frame.rarity === "common" ? frame.glowColor + "30" : "transparent"}`,
        boxShadow: frame.rarity !== "common" ? `0 0 8px ${frame.glowColor}20` : "none",
      }}
    >
      {/* Canvas overlay for animated border */}
      {frame.rarity !== "common" && (
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1, borderRadius: 6 }}
        />
      )}
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
                style={{ color: factionColor }}
                onClick={() => onUsernameClick?.(message.userId, message.username)}
              >
                {message.username}
              </button>
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
