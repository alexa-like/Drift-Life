import { forwardRef, ReactNode } from "react";
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
    glow:   "0 0 12px #00d4ff50, inset 0 0 8px #00d4ff10",
  },
  danger: {
    bg:     "rgba(255,45,85,0.06)",
    border: "#ff2d55",
    color:  "#ff2d55",
    glow:   "0 0 12px #ff2d5550, inset 0 0 8px #ff2d5510",
  },
  warning: {
    bg:     "rgba(255,107,53,0.06)",
    border: "#ff6b35",
    color:  "#ff6b35",
    glow:   "0 0 12px #ff6b3550, inset 0 0 8px #ff6b3510",
  },
  success: {
    bg:     "rgba(57,211,83,0.06)",
    border: "#39d353",
    color:  "#39d353",
    glow:   "0 0 12px #39d35350, inset 0 0 8px #39d35310",
  },
  purple: {
    bg:     "rgba(168,85,247,0.06)",
    border: "#a855f7",
    color:  "#a855f7",
    glow:   "0 0 12px #a855f750, inset 0 0 8px #a855f710",
  },
  ghost: {
    bg:     "transparent",
    border: "#2a2a3e",
    color:  "#94a3b8",
    glow:   "none",
  },
};

const SIZE_CLASSES: Record<NonNullable<CyberButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const CyberButton = forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ variant = "primary", size = "md", glow = true, loading = false, className, children, disabled, style, ...props }, ref) => {
    const v = VARIANT_STYLES[variant];
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileHover={isDisabled ? {} : { scale: 1.02, boxShadow: glow ? v.glow : undefined }}
        whileTap={isDisabled ? {} : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded font-mono font-semibold",
          "transition-colors duration-150 select-none cursor-pointer",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          SIZE_CLASSES[size],
          className,
        )}
        style={{
          background: v.bg,
          border: `1px solid ${v.border}`,
          color: v.color,
          letterSpacing: "0.04em",
          ...style,
        }}
        {...props}
      >
        {loading && (
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${v.color} transparent transparent transparent` }}
          />
        )}
        {children}
      </motion.button>
    );
  }
);

CyberButton.displayName = "CyberButton";
