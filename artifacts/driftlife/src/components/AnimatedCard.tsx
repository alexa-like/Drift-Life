import { forwardRef, ReactNode } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  /** Accent color for border glow on hover */
  accent?: string;
  /** Whether to show shimmer sweep on hover */
  shimmer?: boolean;
  noPad?: boolean;
  children?: ReactNode;
}

/**
 * Cyberpunk surface card.
 * Dims slightly at rest, reveals border glow + optional shimmer on hover.
 */
export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ accent = "#00d4ff", shimmer = true, noPad = false, className, children, style, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        whileHover={{
          boxShadow: `0 0 0 1px ${accent}50, 0 0 18px ${accent}25`,
          borderColor: `${accent}60`,
        }}
        className={cn(
          "relative overflow-hidden rounded-lg transition-colors duration-200",
          !noPad && "p-4",
          className,
        )}
        style={{
          background: "#111118",
          border: "1px solid #1e1e2e",
          ...style,
        }}
        {...props}
      >
        {shimmer && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              background: `linear-gradient(105deg, transparent 40%, ${accent}08 50%, transparent 60%)`,
              backgroundSize: "200% 100%",
              animation: "shimmer 2.4s linear infinite",
            }}
          />
        )}
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";
