interface Props {
  prestige: number;
  size?: "sm" | "md" | "lg";
}

const PRESTIGE_COLORS: Record<number, string> = {
  1: "#CD7F32",
  2: "#C0C0C0",
  3: "#FFD700",
  4: "#E5E4E2",
};

export function PrestigeBadge({ prestige, size = "md" }: Props) {
  if (!prestige || prestige <= 0) return null;

  const isRainbow = prestige >= 5;
  const color = PRESTIGE_COLORS[prestige] ?? "#00E0FF";

  const paddingStyle = size === "sm"
    ? { padding: "1px 4px", fontSize: "0.7rem" }
    : size === "lg"
    ? { padding: "4px 10px", fontSize: "1rem" }
    : { padding: "2px 6px", fontSize: "0.8rem" };

  const style: React.CSSProperties = isRainbow
    ? {
        ...paddingStyle,
        borderRadius: "4px",
        fontWeight: "bold",
        background: "linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6,#ec4899)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        border: "1px solid #666",
        display: "inline-flex",
        alignItems: "center",
      }
    : {
        ...paddingStyle,
        borderRadius: "4px",
        fontWeight: "bold",
        backgroundColor: color + "22",
        color,
        border: "1px solid " + color,
        display: "inline-flex",
        alignItems: "center",
      };

  return <span style={style}>P{prestige}</span>;
}

export default PrestigeBadge;
