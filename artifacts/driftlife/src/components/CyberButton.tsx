import { forwardRef, ReactNode, useState, useEffect } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export type CyberVariant = "primary" | "danger" | "warning" | "success" | "ghost" | "purple";

interface CyberButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  children?: ReactNode;
  variant?: CyberVariant;
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  loading?: boolean;
}

const VARIANT_STYLES: Record<CyberVariant, { border: string; color: string; glow: string; bg: string }> = {
  primary: {
    bg:     "rgba(0,212,255,0.06)",
    border: "#00d4ff",
    color:  "#00d4ff",
    glow:   "0 0 20px rgba(0,212,255,0.7), inset 0 0 10px rgba(0,212,255,0.2)",
  },
  danger: {
    bg:     "rgba(255,45,85,0.06)",
    border: "#ff2d55",
    color:  "#ff2d55",
    glow:   "0 0 20px rgba(255,45,85,0.7), inset 0 0 10px rgba(255,45,85,0.2)",
  },
  warning: {
    bg:     "rgba(255,107,53,0.06)",
    border: "#ff6b35",
    color:  "#ff6b35",
    glow:   "0 0 20px rgba(255,107,53,0.7), inset 0 0 10px rgba(255,107,53,0.2)",
  },
  success: {
    bg:     "rgba(57,211,83,0.06)",
    border: "#39d353",
    color:  "#39d353",
    glow:   "0 0 20px rgba(57,211,83,0.7), inset 0 0 10px rgba(57,211,83,0.2)",
  },
  purple: {
    bg:     "rgba(168,85,247,0.06)",
    border: "#a855f7",
    color:  "#a855f7",
    glow:   "0 0 20px rgba(168,85,247,0.7), inset 0 0 10px rgba(168,85,247,0.2)",
  },
  ghost: {
    bg:     "transparent",
    border: "#2a2a3e",
    color:  "#94a3b8",
    glow:   "0 0 10px rgba(148,163,184,0.3)",
  },
};

const SIZE_CLASSES: Record<NonNullable<CyberButtonProps["size"]>, string> = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
};

export const CyberButton = forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ variant = "primary", size = "md", glow = true, loading = false, className, children, disabled, style, ...props }, ref) => {
    const v = VARIANT_STYLES[variant];
    const isDisabled = disabled || loading;
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    return (
      <motion.button
        ref={ref}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={isDisabled ? {} : { scale: 1.02 }}
        whileTap={isDisabled ? {} : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 font-mono font-bold uppercase",
          "transition-all duration-200 select-none cursor-pointer clip-btn overflow-hidden",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          SIZE_CLASSES[size],
          variant === "primary" && !isDisabled && !isHovered && "animate-pulse-glow",
          mounted && "animate-neon-flicker", // Power on flicker on mount
          className,
        )}
        style={{
          background: isHovered && !isDisabled ? v.color : v.bg,
          color: isHovered && !isDisabled ? "#000" : v.color,
          boxShadow: isHovered && !isDisabled && glow ? v.glow : "none",
          border: "none",
          letterSpacing: "0.08em",
          animationDuration: "0.5s", // specific to power-on flicker
          animationIterationCount: 1, // specific to power-on flicker
          ...style,
        }}
        {...props}
      >
        {/* Border element */}
        <div 
          className="absolute inset-0 clip-btn pointer-events-none"
          style={{
            border: `1px solid ${v.border}`,
            opacity: isHovered ? 0 : 1
          }}
        />

        {/* Charge animation line on hover */}
        {isHovered && !isDisabled && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 0.6, ease: "linear" }}
            className="absolute top-0 bottom-0 w-8 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)`,
              transform: "skewX(-20deg)"
            }}
          />
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
            <motion.div
              animate={{ width: ["0%", "100%", "0%"], left: ["0%", "0%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
              className="absolute h-1 top-1/2 -translate-y-1/2"
              style={{ background: v.color, boxShadow: `0 0 12px ${v.color}` }}
            />
          </div>
        )}
        
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </motion.button>
    );
  }
);

CyberButton.displayName = "CyberButton";
