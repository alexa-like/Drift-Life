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
  /** Animate the bar on mount */
  animate?: boolean;
}

/**
 * Animated progress bar with neon glow.
 * Replaces the plain StatBar for HP / Energy / Nerve / XP.
 */
export function NeonProgressBar({
  value,
  max,
  color = "#00d4ff",
  label,
  showValues = true,
  height = 6,
  className,
  animate = true,
}: NeonProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {(label || showValues) && (
        <div className="flex justify-between items-center text-xs font-mono">
          {label && <span style={{ color: "#94a3b8" }}>{label}</span>}
          {showValues && (
            <span style={{ color }} className="ml-auto">
              {value.toLocaleString()}/{max.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className="rounded-full overflow-hidden"
        style={{ background: "#1e1e2e", height }}
      >
        {/* Fill */}
        <motion.div
          className="h-full rounded-full"
          initial={animate ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            background: `linear-gradient(90deg, ${color}90, ${color})`,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}
