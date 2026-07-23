import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils";

interface StatCounterProps {
  value: number;
  /** Duration in ms (default 700) */
  duration?: number;
  /** Optional formatter (e.g. formatDC) */
  format?: (n: number) => string;
  /** Tailwind / inline color */
  color?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/** Animated rolling number — counts from previous value to new value on change. */
export function StatCounter({
  value,
  duration = 700,
  format,
  color,
  className,
  prefix = "",
  suffix = "",
}: StatCounterProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef<number | null>(null);

  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    const end   = value;
    const t0    = performance.now();

    function step(now: number) {
      const t = Math.min((now - t0) / duration, 1);
      // ease-in-out quad
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(start + (end - start) * e));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  const formatted = format ? format(display) : display.toLocaleString();

  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      style={color ? { color } : undefined}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}
