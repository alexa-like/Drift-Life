interface Props {
  onSelectStore: (storeId: string) => void;
}

const STORES = [
  { id: "iron_wolf", name: "Iron Wolf Armory", keeper: 'Marcus "Iron" Cole', emoji: "🔫", color: "#ef4444", tagline: "Enhancement gear, no bullshit." },
  { id: "steelshield", name: "Steelshield Outfitters", keeper: "Yuki Tanaka", emoji: "👕", color: "#8b5cf6", tagline: "Fashion that fights back." },
  { id: "neon_motors", name: "Neon Motors", keeper: 'Rico "Speed" Vega', emoji: "🚗", color: "#06b6d4", tagline: "The finest rides in the city." },
  { id: "district_pharma", name: "District Pharma", keeper: "Dr. Elena Reyes", emoji: "💊", color: "#22c55e", tagline: "Precisely what you need." },
  { id: "combat_zone", name: "Combat Zone Supply", keeper: '"The Sergeant"', emoji: "⚔️", color: "#f97316", tagline: "Gear for the arena. No questions." },
  { id: "chrome_garage", name: "Chrome Garage", keeper: 'Jay "Torque"', emoji: "⚙️", color: "#f59e0b", tagline: "Parts that win races." },
];

export default function ShopHubPage({ onSelectStore }: Props) {
  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto" }} className="relative z-10">
      <div className="dl-page-bg bg-market" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <h1 style={{ color: "#00E0FF", fontFamily: "monospace", marginBottom: "0.5rem" }}>CITY SHOPS</h1>
      <p style={{ color: "#aaa", marginBottom: "2rem" }}>Six specialty vendors. Restocks every 6 hours.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: "1rem" }}>
        {STORES.map(store => (
          <div key={store.id} style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: "10px", padding: "1.5rem", cursor: "pointer" }}
            onClick={() => onSelectStore(store.id)}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = store.color; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#333"; }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{store.emoji}</div>
            <div style={{ color: "#fff", fontWeight: "bold" }}>{store.name}</div>
            <div style={{ color: store.color, fontSize: "0.85rem" }}>{store.keeper}</div>
            <div style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.5rem" }}>{store.tagline}</div>
            <button style={{ marginTop: "1rem", padding: "0.4rem 1rem", background: store.color + "22", border: "1px solid " + store.color, color: store.color, borderRadius: "4px", cursor: "pointer", width: "100%" }}>VISIT</button>
          </div>
        ))}
      </div>
    </div>
  );
}
