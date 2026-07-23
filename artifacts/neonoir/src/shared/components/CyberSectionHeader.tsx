import { cn } from "@/shared/utils";

interface CyberSectionHeaderProps {
  title: string;
  accent?: string;
  cursor?: boolean;
  right?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<CyberSectionHeaderProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function CyberSectionHeader({
  title,
  accent = "#00d4ff",
  cursor = false,
  right,
  className,
  size = "md",
}: CyberSectionHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 mb-4 relative", className)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Animated left block */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <span
            className="w-1.5 h-3 animate-neon-flicker clip-btn"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <span
            className="w-1.5 h-1 clip-btn"
            style={{ background: accent, opacity: 0.5 }}
          />
          <span
            className="w-2 h-1 clip-btn ml-[-2px] mt-[1px]"
            style={{ background: accent, opacity: 0.8 }}
          />
        </div>

        <span
          className={cn(
            "font-display font-bold uppercase tracking-widest truncate glitch-text", 
            SIZE[size]
          )}
          style={{ color: "#fff", textShadow: `0 0 10px ${accent}80` }}
        >
          {title}
          {cursor && (
            <span
              className="ml-1 animate-[blink-cursor_1s_ease-in-out_infinite]"
              style={{ color: accent }}
            >
              █
            </span>
          )}
        </span>

        {/* Extending tech line */}
        <div className="flex-1 h-px ml-2 relative overflow-hidden hidden sm:block">
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(90deg, ${accent}80, transparent)`,
              opacity: 0.5 
            }} 
          />
          <div 
            className="absolute top-0 bottom-0 w-16"
            style={{ 
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              animation: "shimmer 1.5s linear infinite"
            }} 
          />
        </div>
      </div>

      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
