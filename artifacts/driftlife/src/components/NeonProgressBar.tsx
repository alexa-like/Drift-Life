import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonProgressBarProps {
  value: number;
  max: number;
  color?: string;
  label?: string;
  showValues?: boolean;
  height?: number;
  className?: string;
  animate?: boolean;
}

export function NeonProgressBar({
  value,
  max,
  color = "#00d4ff",
  label,
  showValues = true,
  height = 8,
  className,
  animate = true,
}: NeonProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const isCritical = pct < 20;
  const isFull = pct >= 100;
  const activeColor = isCritical ? "#ff2d55" : color;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || showValues) && (
        <div className="flex justify-between items-end font-mono uppercase tracking-wider">
          {label && (
            <span 
              className={cn("text-[10px] font-bold", isCritical && "animate-pulse")} 
              style={{ color: activeColor, textShadow: `0 0 8px ${activeColor}40` }}
            >
              {label}
            </span>
          )}
          {showValues && (
            <span className="text-[10px]" style={{ color: "#94a3b8" }}>
              <span style={{ color: "#fff" }}>{Math.floor(value).toLocaleString()}</span> / {max.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className="clip-bar relative w-full"
        style={{ background: "#161622", height, border: "1px solid #1e1e2e" }}
      >
        {/* Tick marks */}
        <div className="absolute inset-0 z-10 flex justify-between px-[25%] pointer-events-none">
          <div className="w-px h-full bg-black/50" />
          <div className="w-px h-full bg-black/50" />
          <div className="w-px h-full bg-black/50" />
        </div>

        {/* Fill */}
        <motion.div
          className="h-full relative clip-bar"
          initial={animate ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            background: `linear-gradient(90deg, ${activeColor}40, ${activeColor})`,
            boxShadow: `0 0 10px ${activeColor}60`,
          }}
        >
          {/* Bright leading edge */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-2 bg-white" 
            style={{ 
              boxShadow: `0 0 10px #fff, 0 0 20px ${activeColor}`,
              opacity: isFull ? 0.5 : 1
            }} 
          />
        </motion.div>
        
        {/* Full pulse effect */}
        {isFull && (
          <motion.div 
            className="absolute inset-0 bg-white mix-blend-overlay clip-bar"
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
}
