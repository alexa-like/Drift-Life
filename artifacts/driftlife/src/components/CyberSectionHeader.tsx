import { cn } from "@/lib/utils";

interface CyberSectionHeaderProps {
  title: string;
  accent?: string;
  /** Show a blinking cursor after the title */
  cursor?: boolean;
  /** Right-side slot (e.g. a badge or button) */
  right?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<CyberSectionHeaderProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/**
 * Scanline-styled section header with optional blinking cursor.
 * Use at the top of cards and page sections.
 */
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
      className={cn("flex items-center justify-between gap-3 mb-3", className)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Accent line */}
        <span
          className="flex-shrink-0 w-0.5 rounded-full self-stretch"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
        />

        <span
          className={cn("font-mono font-bold uppercase tracking-widest truncate", SIZE[size])}
          style={{ color: accent, textShadow: `0 0 8px ${accent}60` }}
        >
          {title}
          {cursor && (
            <span
              className="ml-0.5 animate-[blink-cursor_1s_ease-in-out_infinite]"
              style={{ color: accent }}
            >
              _
            </span>
          )}
        </span>
      </div>

      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
