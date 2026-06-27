const BADGE_DEFS: Record<string, { icon: string; label: string; rarity: string; color: string }> = {
  Newbie:         { icon: "★", label: "Newbie",        rarity: "common",    color: "#9CA3AF" },
  "Crime Lord":   { icon: "💀", label: "Crime Lord",   rarity: "uncommon",  color: "#4ADE80" },
  "Rich Kid":     { icon: "💎", label: "Rich Kid",     rarity: "rare",      color: "#60A5FA" },
  Centurion:      { icon: "⚡", label: "Centurion",    rarity: "legendary", color: "#FBBF24" },
  "Ultimate Badge":{ icon: "∞", label: "Ultimate",    rarity: "legendary", color: "#FBBF24" },
  "Street Rat":   { icon: "🐀", label: "Street Rat",  rarity: "uncommon",  color: "#4ADE80" },
  "City Legend":  { icon: "👑", label: "City Legend",  rarity: "legendary", color: "#FBBF24" },
};

const GLOW: Record<string, string> = {
  common: "#9CA3AF",
  uncommon: "#4ADE80",
  rare: "#60A5FA",
  epic: "#C084FC",
  legendary: "#FBBF24",
  mythic: "#00FF41",
};

interface Props {
  badge: string;
  size?: number;
}

export function EmblemBadge({ badge, size = 28 }: Props) {
  const def = BADGE_DEFS[badge] || { icon: "⭐", label: badge, rarity: "common", color: "#9CA3AF" };
  const glow = GLOW[def.rarity] || "#9CA3AF";

  return (
    <div
      title={def.label}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: `${def.color}18`,
        border: `1px solid ${def.color}60`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        boxShadow: `0 0 ${size * 0.2}px ${glow}40`,
        cursor: "default",
        flexShrink: 0,
      }}
    >
      {def.icon}
    </div>
  );
}

export function EmblemRow({ badges, size = 24 }: { badges: string[]; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {badges.slice(0, 3).map((b, i) => (
        <EmblemBadge key={i} badge={b} size={size} />
      ))}
    </div>
  );
}
