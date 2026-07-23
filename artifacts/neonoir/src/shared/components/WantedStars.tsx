interface Props {
  level: number;
  max?: number;
}

export function WantedStars({ level, max = 5 }: Props) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-sm"
          style={{
            background: i < level ? "#ff2d55" : "#1e1e2e",
            boxShadow: i < level ? "0 0 6px #ff2d5580" : "none",
          }}
        />
      ))}
    </div>
  );
}
