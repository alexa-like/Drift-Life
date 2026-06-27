import { useEffect, useRef, ReactNode } from "react";
import { getFrame, FrameRarity } from "../lib/frames";

interface Props {
  frameId?: string | null;
  colorOverride?: string | null;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  borderRadius?: number;
}

export function FrameCardWrapper({
  frameId,
  colorOverride,
  children,
  className,
  style,
  borderRadius = 8,
}: Props) {
  const frame = getFrame(frameId);
  const color = colorOverride || frame.glowColor;
  const rarity = frame.rarity as FrameRarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!frameId) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    const r = borderRadius;

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

      const lw = 2;
      const inset = lw / 2;

      if (rarity === "common") {
        ctx.strokeStyle = color + "70";
        ctx.lineWidth = lw;
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
      }

      if (rarity === "uncommon") {
        const phase = (t / 180) * Math.PI * 2;
        const x1 = w * (0.5 + 0.5 * Math.cos(phase));
        const y1 = 0;
        const x2 = w * (0.5 - 0.5 * Math.cos(phase));
        const y2 = h;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, color + "20");
        grad.addColorStop(0.4, color + "90");
        grad.addColorStop(0.6, color + "90");
        grad.addColorStop(1, color + "20");
        ctx.strokeStyle = grad;
        ctx.lineWidth = lw;
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (rarity === "rare") {
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((t / 45) * Math.PI * 2));
        ctx.strokeStyle = color;
        ctx.lineWidth = lw + pulse;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12 * pulse;
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Outer soft halo
        ctx.strokeStyle = color + "20";
        ctx.lineWidth = 6;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.roundRect(inset - 3, inset - 3, w - lw + 6, h - lw + 6, r + 2);
        ctx.stroke();
      } else if (rarity === "epic") {
        const angle = (t / 100) * Math.PI * 2;
        const cx = w / 2, cy = h / 2;
        const grad = ctx.createConicGradient(angle, cx, cy);
        grad.addColorStop(0, color);
        grad.addColorStop(0.25, color + "30");
        grad.addColorStop(0.5, color);
        grad.addColorStop(0.75, color + "30");
        grad.addColorStop(1, color);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lw + 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Corner accent sparks
        if (t % 20 === 0) {
          const corners = [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]];
          corners.forEach(([cx2, cy2]) => {
            ctx.fillStyle = "#fff";
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx2, cy2, 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.shadowBlur = 0;
        }
      } else if (rarity === "legendary") {
        // Thick outer glow
        ctx.strokeStyle = color + "40";
        ctx.lineWidth = 6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.roundRect(inset - 2, inset - 2, w - lw + 4, h - lw + 4, r + 2);
        ctx.stroke();

        // Main border
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Electric sparks along border
        if (t % 6 === 0) {
          for (let i = 0; i < 3; i++) {
            const side = Math.floor(Math.random() * 4);
            let x1: number, y1: number;
            if (side === 0) { x1 = Math.random() * w; y1 = inset; }
            else if (side === 1) { x1 = w - inset; y1 = Math.random() * h; }
            else if (side === 2) { x1 = Math.random() * w; y1 = h - inset; }
            else { x1 = inset; y1 = Math.random() * h; }
            const x2 = x1 + (Math.random() - 0.5) * 16;
            const y2 = y1 + (Math.random() - 0.5) * 16;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.globalAlpha = 0.6 + Math.random() * 0.4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
        }
      } else if (rarity === "mythic") {
        // Fade trail
        ctx.fillStyle = "#0a0a0f08";
        ctx.fillRect(0, 0, w, h);

        // Outer bloom
        ctx.strokeStyle = color + "30";
        ctx.lineWidth = 8;
        ctx.shadowColor = color;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.roundRect(inset - 3, inset - 3, w - lw + 6, h - lw + 6, r + 3);
        ctx.stroke();

        // Main border
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(inset, inset, w - lw, h - lw, r);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cascading matrix characters along edges
        const chars = "01アイウ#!@$%";
        ctx.font = "7px monospace";
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        // top edge
        for (let x = 4; x < w - 4; x += 10) {
          const ci = Math.floor((t + x) / 5) % chars.length;
          const alpha = 0.3 + 0.7 * Math.abs(Math.sin((t + x) / 20));
          ctx.globalAlpha = alpha;
          ctx.fillText(chars[ci], x, inset + 6);
        }
        // bottom edge
        for (let x = 4; x < w - 4; x += 10) {
          const ci = Math.floor((t + x + 15) / 5) % chars.length;
          const alpha = 0.3 + 0.7 * Math.abs(Math.sin((t + x + 15) / 20));
          ctx.globalAlpha = alpha;
          ctx.fillText(chars[ci], x, h - inset - 1);
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
  }, [frameId, rarity, color, borderRadius]);

  const hasFrame = !!frameId;
  const boxShadow = hasFrame && rarity !== "common"
    ? `0 0 ${rarity === "mythic" ? 20 : rarity === "legendary" ? 14 : rarity === "epic" ? 10 : rarity === "rare" ? 8 : 4}px ${color}30`
    : undefined;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        borderRadius,
        boxShadow,
        ...style,
      }}
    >
      {hasFrame && (
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
