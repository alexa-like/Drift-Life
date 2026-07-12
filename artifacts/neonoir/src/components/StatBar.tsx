interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

export function StatBar({ label, value, max, color }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs font-mono">
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "#1e1e2e" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
