import { useState, useEffect } from "react";
import { useParams } from "wouter";

type SpinType = "dc_spin" | "master_royale";

const TIER_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export default function RoyaleCategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [spinType, setSpinType] = useState<SpinType>("dc_spin");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [poolItems, setPoolItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<any>(null);

  const categoryLabel = category?.replace(/_/g, " ").replace(/\w/g, c => c.toUpperCase());

  useEffect(() => {
    // Fetch pool items for display
    fetch("/api/royale/pools/" + category)
      .then(r => r.json())
      .then(data => {
        const items = spinType === "dc_spin" ? data.dcSpin ?? [] : data.masterRoyale ?? [];
        setPoolItems(items);
      })
      .catch(() => {});
  }, [category, spinType]);

  async function handleSpin() {
    setSpinning(true);
    setError(null);
    try {
      const res = await fetch("/api/royale/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, spinType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Spin failed"); setSpinning(false); return; }
      // Simulate spin animation delay
      await new Promise(r => setTimeout(r, 2000));
      setResult(data.won);
      setBalances(data.updatedBalances);
      setShowResult(true);
    } catch (e) {
      setError("Network error");
    } finally {
      setSpinning(false);
    }
  }

  const spinCostLabel = spinType === "dc_spin" ? "500 DC" : "20 NC + 1 Key";
  const spinColor = spinType === "dc_spin" ? "#00E0FF" : "#f59e0b";

  return (
    <div style={{ padding: "1rem", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ color: "#00E0FF", fontFamily: "monospace", marginBottom: "0.5rem" }}>
        {categoryLabel}
      </h1>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setSpinType("dc_spin")}
          style={{
            padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer",
            background: spinType === "dc_spin" ? "#00E0FF22" : "#1a1a2e",
            border: spinType === "dc_spin" ? "2px solid #00E0FF" : "2px solid #333",
            color: spinType === "dc_spin" ? "#00E0FF" : "#666",
            fontWeight: "bold",
          }}
        >DC SPIN</button>
        <button
          onClick={() => setSpinType("master_royale")}
          style={{
            padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer",
            background: spinType === "master_royale" ? "#f59e0b22" : "#1a1a2e",
            border: spinType === "master_royale" ? "2px solid #f59e0b" : "2px solid #333",
            color: spinType === "master_royale" ? "#f59e0b" : "#666",
            fontWeight: "bold",
          }}
        >★ MASTER ROYALE ★</button>
      </div>

      {/* Cost + Spin button */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ color: "#aaa", marginBottom: "0.5rem" }}>Cost: {spinCostLabel}</div>
        <button
          onClick={handleSpin}
          disabled={spinning}
          style={{
            padding: "1rem 3rem", borderRadius: "8px", fontSize: "1.1rem", fontWeight: "bold",
            cursor: spinning ? "not-allowed" : "pointer",
            background: spinning ? "#333" : spinColor + "22",
            border: "2px solid " + spinColor,
            color: spinning ? "#666" : spinColor,
          }}
        >
          {spinning ? "SPINNING..." : "SPIN"}
        </button>
        {error && <div style={{ color: "#ef4444", marginTop: "0.5rem" }}>{error}</div>}
        {balances && (
          <div style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "0.5rem" }}>
            DC: {balances.dc?.toLocaleString()} | NC: {balances.nc} | Keys: {balances.keys} | Shards: {balances.keyShards}
          </div>
        )}
      </div>

      {/* Pool items */}
      <h3 style={{ color: "#fff", marginBottom: "1rem" }}>ITEMS YOU CAN WIN</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {poolItems.map((item: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem", background: "#1a1a2e", borderRadius: "6px" }}>
            <div style={{ width: "36px", height: "36px", background: "#333", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
              {item.tier === "legendary" ? "★" : item.tier === "epic" ? "◆" : "•"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: "0.9rem" }}>{item.name}</div>
              <div style={{ color: TIER_COLORS[item.tier] ?? "#aaa", fontSize: "0.75rem", textTransform: "capitalize" }}>{item.tier}</div>
            </div>
            <div style={{ color: "#aaa", fontSize: "0.8rem" }}>{item.probability?.toFixed(1)}%</div>
          </div>
        ))}
        {poolItems.length === 0 && <div style={{ color: "#666" }}>Pool data loading...</div>}
      </div>

      {/* Result modal */}
      {showResult && result && (
        <div style={{
          position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "#1a1a2e", border: "2px solid " + (TIER_COLORS[result.tier] ?? "#333"), borderRadius: "12px", padding: "2rem", textAlign: "center", maxWidth: "360px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
              {result.tier === "legendary" ? "★" : result.tier === "epic" ? "◆" : "🎁"}
            </div>
            <div style={{ color: TIER_COLORS[result.tier] ?? "#fff", fontWeight: "bold", fontSize: "1.2rem", textTransform: "uppercase", marginBottom: "0.25rem" }}>
              {result.tier}
            </div>
            <div style={{ color: "#fff", fontSize: "1rem", marginBottom: "0.5rem" }}>{result.name ?? result.itemId}</div>
            <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Added to your arena inventory!</div>
            <button
              onClick={() => setShowResult(false)}
              style={{ padding: "0.75rem 2rem", background: "#333", border: "1px solid #666", borderRadius: "6px", color: "#fff", cursor: "pointer" }}
            >CONTINUE</button>
          </div>
        </div>
      )}
    </div>
  );
}
