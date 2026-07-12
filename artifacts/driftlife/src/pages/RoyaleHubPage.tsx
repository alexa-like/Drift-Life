const CATEGORIES = [
  { id: "pistols", label: "Pistols", icon: "🔫", color: "#ef4444" },
  { id: "smgs", label: "SMGs", icon: "💨", color: "#f97316" },
  { id: "assault_rifles", label: "Assault Rifles", icon: "🎯", color: "#eab308" },
  { id: "shotguns", label: "Shotguns", icon: "💥", color: "#84cc16" },
  { id: "sniper_rifles", label: "Sniper Rifles", icon: "🔭", color: "#22c55e" },
  { id: "lmgs", label: "LMGs", icon: "⚡", color: "#06b6d4" },
  { id: "body_armor", label: "Body Armor", icon: "🛡️", color: "#3b82f6" },
  { id: "consumables", label: "Consumables", icon: "💊", color: "#8b5cf6" },
  { id: "ammo", label: "Ammo", icon: "🔴", color: "#ec4899" },
  { id: "race_cars", label: "Race Cars", icon: "🏎️", color: "#14b8a6" },
  { id: "car_parts", label: "Car Parts", icon: "⚙️", color: "#f59e0b" },
];

interface Props {
  onSelectCategory: (categoryId: string) => void;
}

export default function RoyaleHubPage({ onSelectCategory }: Props) {
  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto" }} className="relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <h1 style={{ color: "#00E0FF", fontFamily: "monospace", fontSize: "1.5rem", marginBottom: "1rem" }}>
        ★ MASTER ROYALE
      </h1>
      <p style={{ color: "#aaa", marginBottom: "2rem" }}>
        Spin for arena weapons, armor, ammo, and more. DC Spin for Common–Rare. Master Royale for Rare–Legendary.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            style={{
              background: "#1a1a2e",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "1.5rem 1rem",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = cat.color;
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px " + cat.color + "66";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "#333";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{cat.icon}</div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "0.9rem" }}>{cat.label}</div>
            <div style={{ color: "#666", fontSize: "0.75rem", marginTop: "0.25rem" }}>SPIN</div>
          </div>
        ))}
      </div>
    </div>
  );
}
