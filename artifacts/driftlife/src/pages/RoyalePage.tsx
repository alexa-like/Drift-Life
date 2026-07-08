import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { RoyaleItemCard, RoyaleWonItem } from "../components/RoyaleItemCard";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUserUpdate: () => void;
}

type WheelType = "general" | "shooting" | "racing";
type Currency  = "dc" | "nc" | "key";

const WHEEL_CONFIG = {
  general:  { label: "General",  icon: "🎡", color: "#00d4ff", desc: "DC, XP, Keys, Energy, Titles" },
  shooting: { label: "Shooting", icon: "🔫", color: "#ff6b35", desc: "Combat items, weapons, armor" },
  racing:   { label: "Racing",   icon: "🏎️", color: "#a855f7", desc: "Cars, parts, upgrades" },
};

const SPIN_COSTS: Record<WheelType, Record<Currency, number>> = {
  general:  { dc: 300,  nc: 20, key: 1 },
  shooting: { dc: 500,  nc: 30, key: 1 },
  racing:   { dc: 500,  nc: 30, key: 1 },
};

const TIER_COLORS: Record<string, string> = {
  common:    "#6b7280",
  uncommon:  "#22c55e",
  rare:      "#3b82f6",
  epic:      "#a855f7",
  legendary: "#f59e0b",
};

export default function RoyalePage({ user, addToast, onUserUpdate }: Props) {
  const [wheel, setWheel]       = useState<WheelType>("general");
  const [currency, setCurrency] = useState<Currency>("dc");
  const [count, setCount]       = useState<1 | 10>(1);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults]   = useState<RoyaleWonItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [pity, setPity]         = useState<Record<WheelType, { spinsSinceLastRare: number; spinsSinceLastEpic: number }>>({
    general:  { spinsSinceLastRare: 0, spinsSinceLastEpic: 0 },
    shooting: { spinsSinceLastRare: 0, spinsSinceLastEpic: 0 },
    racing:   { spinsSinceLastRare: 0, spinsSinceLastEpic: 0 },
  });
  const [balances, setBalances] = useState({ dc: user.dc, nc: user.nc, keys: user.keys ?? 0, keyShards: user.keyShards ?? 0 });

  const loadPity = useCallback(async () => {
    try {
      const data = await api.get<{ pity: any }>("/royale/pity");
      setPity(prev => ({ ...prev, ...data.pity }));
    } catch {}
  }, []);

  useEffect(() => { loadPity(); }, [loadPity]);

  const cfg  = WHEEL_CONFIG[wheel];
  const cost = SPIN_COSTS[wheel][currency];
  const totalCost = count === 10 ? cost * 9 : cost;
  const currencyLabel = currency === "key" ? "Key" : currency.toUpperCase();

  const canAfford =
    currency === "dc"  ? balances.dc >= totalCost :
    currency === "nc"  ? balances.nc >= totalCost :
    balances.keys >= totalCost;

  async function handleSpin() {
    if (spinning || !canAfford) return;
    setSpinning(true);
    setResults([]);
    setRevealed(false);

    try {
      const data = await api.post<{
        wonItems: RoyaleWonItem[];
        pity: { spinsSinceLastRare: number; spinsSinceLastEpic: number };
        balances: { dc: number; nc: number; keys: number; keyShards: number };
      }>("/royale/spin", { royaleType: wheel, currency, count });

      setResults(data.wonItems);
      setPity(prev => ({ ...prev, [wheel]: data.pity }));
      if (data.balances) setBalances(data.balances);
      onUserUpdate();

      // Flip all cards with a small delay
      setTimeout(() => setRevealed(true), 100);
      // Auto-flip individual cards
      data.wonItems.forEach((_, i) => {
        // The reveal animation plays automatically via CSS
      });
    } catch (err: any) {
      addToast(err.message ?? "Spin failed", "error");
    } finally {
      setSpinning(false);
    }
  }

  const currentPity = pity[wheel];
  const pityRare = 15 - currentPity.spinsSinceLastRare;
  const pityEpic = 50 - currentPity.spinsSinceLastEpic;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "monospace", fontSize: 22, color: "#00d4ff", fontWeight: "bold", letterSpacing: 3, textShadow: "0 0 20px #00d4ff60" }}>
          ◈ ROYALE WHEEL ◈
        </h1>
        <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>Spin to win items, currency, and rare prizes</p>
      </div>

      {/* Balances */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20,
        background: "#0d0d1a", border: "1px solid #1e1e2e", borderRadius: 10, padding: 12,
      }}>
        {[
          { label: "DC",     value: balances.dc.toLocaleString(),   color: "#f59e0b" },
          { label: "NC",     value: balances.nc.toLocaleString(),   color: "#a855f7" },
          { label: "Keys",   value: balances.keys.toLocaleString(), color: "#00d4ff" },
          { label: "Shards", value: balances.keyShards.toLocaleString(), color: "#22c55e" },
        ].map(b => (
          <div key={b.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: b.color }}>{b.value}</div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>{b.label}</div>
          </div>
        ))}
      </div>

      {/* Wheel tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(Object.entries(WHEEL_CONFIG) as [WheelType, typeof cfg][]).map(([type, c]) => (
          <button
            key={type}
            onClick={() => { setWheel(type); setResults([]); }}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 8, fontFamily: "monospace", fontSize: 12,
              cursor: "pointer", transition: "all 0.2s",
              background: wheel === type ? `${c.color}18` : "#0d0d1a",
              border: `1px solid ${wheel === type ? c.color : "#1e1e2e"}`,
              color: wheel === type ? c.color : "#475569",
              boxShadow: wheel === type ? `0 0 12px ${c.color}30` : "none",
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontWeight: "bold" }}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* Spin config */}
      <div style={{
        background: "#0d0d1a", border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: 20, marginBottom: 20,
        boxShadow: `0 0 20px ${cfg.color}10`,
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: cfg.color, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          {cfg.icon} {cfg.label} Royale — {cfg.desc}
        </div>

        {/* Currency buttons */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 8 }}>CURRENCY</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["dc","nc","key"] as Currency[]).map(c => {
              const singleCost = SPIN_COSTS[wheel][c];
              const label = c === "key" ? "🗝️ Key" : c === "nc" ? "💜 NC" : "💰 DC";
              const bal = c === "dc" ? balances.dc : c === "nc" ? balances.nc : balances.keys;
              const enough = bal >= singleCost;
              return (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: 8, fontFamily: "monospace", fontSize: 11,
                    cursor: "pointer", transition: "all 0.2s",
                    background: currency === c ? "#ffffff18" : "#0a0a14",
                    border: `1px solid ${currency === c ? "#fff" : "#1e1e2e"}`,
                    color: currency === c ? "#fff" : enough ? "#64748b" : "#374151",
                    opacity: enough ? 1 : 0.5,
                  }}
                >
                  <div>{label}</div>
                  <div style={{ color: "#a855f7", fontSize: 9, marginTop: 2 }}>{singleCost}/spin</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Count toggle */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 8 }}>SPINS</div>
          <div style={{ display: "flex", gap: 8 }}>
            {([1, 10] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, fontFamily: "monospace", fontSize: 12,
                  cursor: "pointer", transition: "all 0.2s",
                  background: count === n ? `${cfg.color}18` : "#0a0a14",
                  border: `1px solid ${count === n ? cfg.color : "#1e1e2e"}`,
                  color: count === n ? cfg.color : "#475569",
                }}
              >
                {n === 10 ? "×10 (9× cost)" : "×1"}
              </button>
            ))}
          </div>
        </div>

        {/* Pity info */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#0a0a14", borderRadius: 8, padding: "8px 10px", border: "1px solid #3b82f620" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1 }}>Rare Pity</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#60a5fa", fontWeight: "bold" }}>
              {pityRare <= 0 ? "GUARANTEED NOW" : `${pityRare} spins`}
            </div>
          </div>
          <div style={{ flex: 1, background: "#0a0a14", borderRadius: 8, padding: "8px 10px", border: "1px solid #a855f720" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#a855f7", textTransform: "uppercase", letterSpacing: 1 }}>Epic Pity</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#c084fc", fontWeight: "bold" }}>
              {pityEpic <= 0 ? "GUARANTEED NOW" : `${pityEpic} spins`}
            </div>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={spinning || !canAfford}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, fontFamily: "monospace",
            fontSize: 15, fontWeight: "bold", cursor: canAfford && !spinning ? "pointer" : "not-allowed",
            background: canAfford && !spinning ? `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}18)` : "#1a1a2e",
            border: `2px solid ${canAfford && !spinning ? cfg.color : "#1e1e2e"}`,
            color: canAfford && !spinning ? cfg.color : "#374151",
            boxShadow: canAfford && !spinning ? `0 0 20px ${cfg.color}40` : "none",
            transition: "all 0.2s",
            letterSpacing: 2,
          }}
        >
          {spinning ? "▷▷ SPINNING ◁◁" : canAfford
            ? `◈ SPIN ×${count} — ${totalCost.toLocaleString()} ${currencyLabel}`
            : `⚠ Need ${totalCost.toLocaleString()} ${currencyLabel}`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#00d4ff", marginBottom: 16, textAlign: "center", letterSpacing: 2 }}>
            ✦ RESULTS ✦
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {results.map((item, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <RoyaleItemCard item={item} index={i} revealed={revealed} />
              </div>
            ))}
          </div>
          {/* Summary */}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {results.map((item, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "monospace", fontSize: 10, padding: "3px 8px", borderRadius: 6,
                  color: TIER_COLORS[item.tier] ?? "#fff",
                  border: `1px solid ${TIER_COLORS[item.tier] ?? "#fff"}40`,
                  background: `${TIER_COLORS[item.tier]}10`,
                }}
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Drop rates info */}
      <div style={{ marginTop: 16, background: "#0a0a14", borderRadius: 10, padding: 12, border: "1px solid #1e1e2e" }}>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Drop Rates</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { tier: "common",    rate: "60%", color: "#6b7280" },
            { tier: "uncommon",  rate: "25%", color: "#22c55e" },
            { tier: "rare",      rate: "10%", color: "#3b82f6" },
            { tier: "epic",      rate: "4%",  color: "#a855f7" },
            { tier: "legendary", rate: "1%",  color: "#f59e0b" },
          ].map(({ tier, rate, color }) => (
            <div key={tier} style={{ fontFamily: "monospace", fontSize: 10 }}>
              <span style={{ color }}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
              <span style={{ color: "#374151" }}> {rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
