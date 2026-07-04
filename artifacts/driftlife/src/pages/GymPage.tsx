import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface GymDef {
  id: string;
  name: string;
  district: string;
  costPerUse: number;
  energyCostPerTrain: number;
  minLevel: number;
  description: string;
  multipliers: Record<string, number>;
  available: boolean;
  districtMatch: boolean;
}

const STATS: { key: string; label: string; color: string }[] = [
  { key: "strength",     label: "STRENGTH",     color: "#ff6b35" },
  { key: "charisma",     label: "CHARISMA",     color: "#a855f7" },
  { key: "intelligence", label: "INTELLIGENCE", color: "#00d4ff" },
  { key: "streetCred",   label: "STREET CRED",  color: "#f59e0b" },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, (value / 200) * 100);
  return (
    <div style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 14px" }}>
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono" style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>{label}</span>
        <span className="font-mono font-bold" style={{ color, fontSize: 14 }}>{typeof value === "number" ? value.toFixed(1) : value}</span>
      </div>
      <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: 3, background: color, borderRadius: 2, transition: "width 0.4s ease", boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

export default function GymPage({ user, onUserUpdate }: Props) {
  const [gyms, setGyms] = useState<GymDef[]>([]);
  const [selectedGym, setSelectedGym] = useState<GymDef | null>(null);
  const [selectedStat, setSelectedStat] = useState<string>("strength");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastGain, setLastGain] = useState<{ stat: string; gain: number } | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    api.get<GymDef[]>("/gym").then(r => {
      setGyms(r);
      setSelectedGym(r.find(g => g.available) ?? r[0] ?? null);
    }).catch(() => {});
  }, []);

  async function doTrain() {
    if (!selectedGym || loading) return;
    setLoading(true);
    setMessage(null);
    setLastGain(null);
    try {
      const d = await api.post<any>(`/gym/${selectedGym.id}/train`, { stat: selectedStat });
      setLastGain({ stat: selectedStat, gain: d.statGain });
      setMessage({ text: `+${d.statGain.toFixed(3)} ${d.stat.toUpperCase()} — ${d.gym} — Mood ${d.mood}% (×${d.moodMultiplier.toFixed(2)})`, type: "success" });
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      onUserUpdate({ ...user, [selectedStat]: d.newStat, energy: d.energy, dc: d.dc, stress: Math.max(0, (user.stress ?? 0) + 2) });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Training failed", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const statValue = (key: string): number => (user as any)[key] ?? 0;
  const moodMult = 0.7 + ((user.mood ?? 100) / 100) * 0.3;
  const canTrain = !loading && selectedGym && user.energy >= (selectedGym?.energyCostPerTrain ?? 0) && user.dc >= (selectedGym?.costPerUse ?? 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-mono font-bold text-lg" style={{ color: "#94a3b8", letterSpacing: "0.05em" }}>GYM</h2>
          <p className="font-mono text-xs" style={{ color: "#334155" }}>Build stats. Diminishing returns apply above 50.</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>
            ENERGY <span style={{ color: "#00d4ff" }}>{user.energy}</span>/<span style={{ color: "#334155" }}>{user.maxEnergy}</span>
            &nbsp;&nbsp;MOOD <span style={{ color: (user.mood ?? 100) >= 70 ? "#39d353" : "#f59e0b" }}>{user.mood ?? 100}%</span>
            &nbsp;&nbsp;<span style={{ color: "#64748b" }}>×{moodMult.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Stress bar */}
      {(user.stress ?? 0) > 0 && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 16px" }}>
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>STRESS — reduces gains above 70%</span>
            <span className="font-mono text-xs font-bold" style={{ color: (user.stress ?? 0) > 70 ? "#ff2d55" : "#a855f7" }}>{user.stress ?? 0}%</span>
          </div>
          <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2 }}>
            <div style={{ width: `${user.stress ?? 0}%`, height: 3, background: (user.stress ?? 0) > 70 ? "#ff2d55" : "#a855f7", borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Stat summary */}
      <div className="grid grid-cols-2 gap-3" style={{ transition: "opacity 0.2s", opacity: flash ? 0.5 : 1 }}>
        {STATS.map(s => <StatBar key={s.key} label={s.label} value={statValue(s.key)} color={s.color} />)}
      </div>

      {/* Flash gain indicator */}
      {lastGain && (
        <div className="font-mono text-center py-1" style={{ color: "#39d353", fontSize: 13, letterSpacing: "0.05em" }}>
          +{lastGain.gain.toFixed(3)} {lastGain.stat.toUpperCase()}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="font-mono text-xs px-4 py-3 rounded" style={{
          background: message.type === "success" ? "#39d35318" : "#ff2d5518",
          border: `1px solid ${message.type === "success" ? "#39d35340" : "#ff2d5540"}`,
          color: message.type === "success" ? "#39d353" : "#ff2d55",
        }}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gym selector */}
        <div className="space-y-2">
          <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b", letterSpacing: "0.1em" }}>SELECT GYM</div>
          {gyms.map(gym => (
            <button
              key={gym.id}
              onClick={() => gym.available && setSelectedGym(gym)}
              disabled={!gym.available}
              className="w-full text-left rounded transition-all"
              style={{
                padding: "10px 14px",
                background: selectedGym?.id === gym.id ? "#00d4ff0d" : "#111118",
                border: `1px solid ${selectedGym?.id === gym.id ? "#00d4ff40" : "#1e1e2e"}`,
                borderRadius: 8,
                opacity: gym.available ? 1 : 0.4,
                cursor: gym.available ? "pointer" : "not-allowed",
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono text-xs font-bold" style={{ color: selectedGym?.id === gym.id ? "#00d4ff" : "#94a3b8" }}>{gym.name}</div>
                  <div className="font-mono mt-0.5" style={{ fontSize: 10, color: "#475569" }}>{gym.district}</div>
                </div>
                {gym.districtMatch && (
                  <span className="font-mono px-1 rounded" style={{ fontSize: 9, background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>HOME</span>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <span className="font-mono" style={{ fontSize: 10, color: "#f59e0b" }}>{gym.costPerUse.toLocaleString()} DC</span>
                <span className="font-mono" style={{ fontSize: 10, color: "#00d4ff" }}>{gym.energyCostPerTrain} NRG</span>
                {!gym.available && <span className="font-mono" style={{ fontSize: 10, color: "#ff2d55" }}>LVL {gym.minLevel}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Stat selector & action */}
        {selectedGym && (
          <div className="lg:col-span-2 space-y-3">
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
              <div className="font-mono font-bold text-xs mb-0.5" style={{ color: "#94a3b8" }}>{selectedGym.name}</div>
              <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>{selectedGym.description}</div>

              {/* Gym multiplier breakdown */}
              <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b", letterSpacing: "0.1em" }}>GYM MULTIPLIERS</div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {STATS.map(s => {
                  const mult = selectedGym.multipliers[s.key] ?? 1;
                  const color = mult >= 1.5 ? "#39d353" : mult < 0.8 ? "#ff2d55" : "#94a3b8";
                  return (
                    <div key={s.key} style={{ background: "#0a0a0f", borderRadius: 6, padding: "8px", textAlign: "center" }}>
                      <div className="font-mono mb-0.5" style={{ fontSize: 9, color: "#64748b" }}>{s.label.split(" ")[0]}</div>
                      <div className="font-mono font-bold" style={{ color, fontSize: 13 }}>×{mult.toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Stat selector */}
              <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b", letterSpacing: "0.1em" }}>TRAIN</div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {STATS.map(s => {
                  const mult = selectedGym.multipliers[s.key] ?? 1;
                  const effectiveMult = mult * moodMult;
                  const isSelected = selectedStat === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSelectedStat(s.key)}
                      className="text-left rounded transition-all"
                      style={{
                        padding: "10px 12px",
                        background: isSelected ? s.color + "14" : "#0a0a0f",
                        border: `1px solid ${isSelected ? s.color + "50" : "#1e1e2e"}`,
                        borderRadius: 6,
                      }}
                    >
                      <div className="font-mono text-xs font-bold" style={{ color: isSelected ? s.color : "#475569" }}>{s.label}</div>
                      <div className="font-mono mt-0.5" style={{ fontSize: 10, color: "#64748b" }}>
                        <span style={{ color: "#94a3b8" }}>{statValue(s.key).toFixed(1)}</span>
                        &nbsp;·&nbsp;×{effectiveMult.toFixed(2)} total
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Cost summary */}
              <div className="font-mono text-xs px-3 py-2 rounded mb-4" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                <div className="flex justify-between">
                  <span style={{ color: "#64748b" }}>Cost</span>
                  <span>
                    <span style={{ color: "#f59e0b" }}>{selectedGym.costPerUse.toLocaleString()} DC</span>
                    <span style={{ color: "#475569" }}> + </span>
                    <span style={{ color: "#00d4ff" }}>{selectedGym.energyCostPerTrain} energy</span>
                  </span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span style={{ color: "#64748b" }}>Effective multiplier</span>
                  <span style={{ color: "#39d353" }}>×{((selectedGym.multipliers[selectedStat] ?? 1) * moodMult).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={doTrain}
                disabled={!canTrain}
                className="w-full font-mono font-bold text-sm py-3 rounded transition-all"
                style={{
                  background: canTrain ? "#00d4ff18" : "#1e1e2e",
                  border: `1px solid ${canTrain ? "#00d4ff40" : "#1e1e2e"}`,
                  color: canTrain ? "#00d4ff" : "#334155",
                  cursor: canTrain ? "pointer" : "not-allowed",
                  letterSpacing: "0.08em",
                }}
              >
                {loading ? "TRAINING..." : canTrain ? "TRAIN NOW" : user.energy < (selectedGym.energyCostPerTrain ?? 0) ? "NO ENERGY" : "INSUFFICIENT DC"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
