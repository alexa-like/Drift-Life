import { useEffect, useRef } from "react";
import { getFrame, FrameRarity } from "../lib/frames";

export type FrameSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<FrameSize, number> = {
  xs: 28, sm: 36, md: 48, lg: 64, xl: 96,
};

const BORDER_PX: Record<FrameSize, number> = {
  xs: 2, sm: 2, md: 3, lg: 3, xl: 4,
};

interface Props {
  frameId: string | null | undefined;
  size?: FrameSize;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function PlayerFrame({ frameId, size = "md", children, style, className }: Props) {
  const frame = getFrame(frameId);
  const px = SIZE_PX[size];
  const border = BORDER_PX[size];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rarity = frame.rarity as FrameRarity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    let animId: number;
    let t = 0;

    function drawCommon() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = frame.glowColor;
      ctx!.lineWidth = border * 2;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 4;
      ctx!.beginPath();
      ctx!.roundRect(border, border, w - border * 2, h - border * 2, 4);
      ctx!.stroke();
    }

    function drawUncommon() {
      ctx!.clearRect(0, 0, w, h);
      const grad = ctx!.createLinearGradient(
        w * Math.cos((t / 120) * Math.PI * 2),
        h * Math.sin((t / 120) * Math.PI * 2),
        w - w * Math.cos((t / 120) * Math.PI * 2),
        h - h * Math.sin((t / 120) * Math.PI * 2)
      );
      grad.addColorStop(0, frame.glowColor + "30");
      grad.addColorStop(0.5, frame.glowColor);
      grad.addColorStop(1, frame.glowColor + "30");
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = border * 2;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 6;
      ctx!.beginPath();
      ctx!.roundRect(border, border, w - border * 2, h - border * 2, 4);
      ctx!.stroke();
      t++;
    }

    function drawRare() {
      ctx!.clearRect(0, 0, w, h);
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI * 2));
      ctx!.strokeStyle = frame.glowColor;
      ctx!.lineWidth = border * 2;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 8 * pulse;
      ctx!.globalAlpha = 0.5 + 0.5 * pulse;
      ctx!.beginPath();
      ctx!.roundRect(border, border, w - border * 2, h - border * 2, 4);
      ctx!.stroke();
      ctx!.globalAlpha = 1;
      t++;
    }

    function drawEpic() {
      ctx!.clearRect(0, 0, w, h);
      const angle = (t / 80) * Math.PI * 2;
      const cx = w / 2, cy = h / 2;
      const grad = ctx!.createConicGradient(angle, cx, cy);
      grad.addColorStop(0, frame.glowColor);
      grad.addColorStop(0.33, frame.glowColor + "80");
      grad.addColorStop(0.66, frame.glowColor + "20");
      grad.addColorStop(1, frame.glowColor);
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = border * 2;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 10;
      ctx!.beginPath();
      ctx!.roundRect(border, border, w - border * 2, h - border * 2, 4);
      ctx!.stroke();
      t++;
    }

    function drawLegendary() {
      ctx!.clearRect(0, 0, w, h);
      // Base glow
      ctx!.strokeStyle = frame.glowColor;
      ctx!.lineWidth = border * 2;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 12;
      ctx!.beginPath();
      ctx!.roundRect(border, border, w - border * 2, h - border * 2, 4);
      ctx!.stroke();
      // Electric sparks
      if (t % 8 === 0) {
        const numSparks = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numSparks; i++) {
          const side = Math.floor(Math.random() * 4);
          let x1: number, y1: number, x2: number, y2: number;
          if (side === 0) { x1 = Math.random() * w; y1 = border; }
          else if (side === 1) { x1 = w - border; y1 = Math.random() * h; }
          else if (side === 2) { x1 = Math.random() * w; y1 = h - border; }
          else { x1 = border; y1 = Math.random() * h; }
          x2 = x1 + (Math.random() - 0.5) * 12;
          y2 = y1 + (Math.random() - 0.5) * 12;
          ctx!.strokeStyle = "#ffffff";
          ctx!.lineWidth = 1;
          ctx!.shadowBlur = 6;
          ctx!.shadowColor = "#ffffff";
          ctx!.beginPath();
          ctx!.moveTo(x1, y1);
          ctx!.lineTo(x2, y2);
          ctx!.stroke();
        }
      }
      t++;
    }

    function drawMythic() {
      ctx!.clearRect(0, 0, w, h);
      // Matrix rain effect on border
      ctx!.fillStyle = "#0a0a0f10";
      ctx!.fillRect(0, 0, w, h);
      // Cascade characters along border
      const chars = "01アイウエオABCDE#!@$%";
      ctx!.font = `${Math.max(6, border * 3)}px monospace`;
      ctx!.fillStyle = frame.glowColor;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 8;
      // Top edge
      for (let x = 0; x < w; x += 8) {
        const charIdx = Math.floor((t + x) / 4) % chars.length;
        ctx!.fillText(chars[charIdx], x, border + 2);
      }
      // Bottom edge
      for (let x = 0; x < w; x += 8) {
        const charIdx = Math.floor((t + x + 20) / 4) % chars.length;
        ctx!.fillText(chars[charIdx], x, h - 1);
      }
      // Glowing border
      ctx!.strokeStyle = frame.glowColor;
      ctx!.lineWidth = border;
      ctx!.shadowColor = frame.glowColor;
      ctx!.shadowBlur = 16;
      ctx!.beginPath();
      ctx!.roundRect(border / 2, border / 2, w - border, h - border, 4);
      ctx!.stroke();
      t++;
    }

    function draw() {
      if (rarity === "common") { drawCommon(); return; }
      if (rarity === "uncommon") drawUncommon();
      else if (rarity === "rare") drawRare();
      else if (rarity === "epic") drawEpic();
      else if (rarity === "legendary") drawLegendary();
      else if (rarity === "mythic") drawMythic();
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [frame.id, rarity, border]);

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
