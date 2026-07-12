import { forwardRef, ReactNode, useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  accent?: string;
  shimmer?: boolean;
  noPad?: boolean;
  children?: ReactNode;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ accent = "#00d4ff", shimmer = true, noPad = false, className, children, style, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          "relative clip-card transition-all duration-300",
          !noPad && "p-4 sm:p-5",
          className
        )}
        style={{
          background: "#0d0d14",
          border: `1px solid ${isHovered ? accent + '80' : '#1e1e2e'}`,
          ...style,
        }}
        {...props}
      >
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(${accent}10 1px, transparent 1px), linear-gradient(90deg, ${accent}10 1px, transparent 1px)`,
            backgroundSize: "10px 10px"
          }}
        />

        {/* Hover accent edge trace */}
        <motion.div
          className="absolute inset-0 pointer-events-none clip-card"
          animate={{
            boxShadow: isHovered ? `inset 0 0 20px ${accent}20` : "none",
            border: isHovered ? `1px solid ${accent}` : "1px solid transparent"
          }}
          transition={{ duration: 0.2 }}
        />

        {/* Corner cut accent fill */}
        <div 
          className="absolute bottom-0 right-0 pointer-events-none transition-all duration-300"
          style={{
            width: 16, height: 16,
            background: isHovered ? accent : `${accent}40`,
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            boxShadow: isHovered ? `0 0 20px ${accent}` : "none"
          }}
        />

        {/* Top left small accent */}
        <div 
          className="absolute top-0 left-0 pointer-events-none transition-all duration-300"
          style={{
            width: 8, height: 2,
            background: isHovered ? accent : `${accent}40`,
            boxShadow: isHovered ? `0 0 10px ${accent}` : "none"
          }}
        />

        {shimmer && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${accent}15 50%, transparent 100%)`,
              backgroundSize: "200% 100%",
              animation: isHovered ? "shimmer 1.5s linear infinite" : "none",
            }}
          />
        )}
        
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";
