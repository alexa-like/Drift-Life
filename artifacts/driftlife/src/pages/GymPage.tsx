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

const STATS: { key: string; label: string; color: string; icon: string }[] = [
  { key: "strength",     label: "Strength",     color: "bg-red-500",    icon: "💪" },
  { key: "charisma",     label: "Charisma",     color: "bg-pink-500",   icon: "🗣️" },
  { key: "intelligence", label: "Intelligence", color: "bg-blue-500",   icon: "🧠" },
  { key: "streetCred",   label: "Street Cred",  color: "bg-yellow-500", icon: "⭐" },
];

export default function GymPage({ user, onUserUpdate }: Props) {
  const [gyms, setGyms] = useState<GymDef[]>([]);
  const [selectedGym, setSelectedGym] = useState<GymDef | null>(null);
  const [selectedStat, setSelectedStat] = useState<string>("strength");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastGain, setLastGain] = useState<{ stat: string; gain: number } | null>(null);

  useEffect(() => {
    api.get("/gym").then(r => {
      setGyms(r.data);
      setSelectedGym(r.data[0] ?? null);
    }).catch(() => {});
  }, []);

  async function doTrain() {
    if (!selectedGym || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const r = await api.post(`/gym/${selectedGym.id}/train`, { stat: selectedStat });
      const d = r.data;
      setLastGain({ stat: selectedStat, gain: d.statGain });
      setMessage({ text: `+${d.statGain.toFixed(3)} ${d.stat} at ${d.gym} | Mood ${d.mood}% | ×${d.moodMultiplier.toFixed(2)} mood mult`, type: "success" });
      onUserUpdate({ ...user, [selectedStat]: d.newStat, energy: d.energy, dc: d.dc, stress: user.stress - 2 < 0 ? 0 : user.stress - 2 });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const statValue = (key: string) => (user as any)[key] ?? 0;
  const moodMult = 0.7 + (user.mood ?? 100) / 100 * 0.3;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gym</h1>
          <p className="text-zinc-400 text-sm">Train hard. Diminishing returns apply.</p>
        </div>
        <div className="text-right text-sm space-y-1">
          <p className="text-zinc-400">Energy: <span className="text-blue-300 font-mono">{user.energy}/{user.maxEnergy}</span></p>
          <p className="text-zinc-400">Mood: <span className={`font-mono ${(user.mood ?? 100) >= 70 ? "text-green-400" : "text-yellow-400"}`}>{user.mood ?? 100}%</span></p>
          <p className="text-zinc-500 text-xs">×{moodMult.toFixed(2)} gain mult</p>
        </div>
      </div>

      {/* Stress bar */}
      {user.stress > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Stress (reduces gains if {'>'} 70)</span>
            <span>{user.stress}%</span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full">
            <div
              className={`h-2 rounded-full transition-all ${user.stress > 70 ? "bg-red-500" : "bg-purple-500"}`}
              style={{ width: `${user.stress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map(s => (
          <div key={s.key} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-zinc-400">{s.label}</div>
            <div className="text-xl font-bold text-white">{statValue(s.key).toFixed ? statValue(s.key).toFixed(1) : statValue(s.key)}</div>
          </div>
        ))}
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gym selector */}
        <div className="space-y-2">
          <h2 className="text-zinc-300 text-sm font-bold uppercase tracking-wider">Select Gym</h2>
          {gyms.map(gym => (
            <button key={gym.id} onClick={() => setSelectedGym(gym)} disabled={!gym.available}
              className={`w-full text-left p-3 rounded-xl border transition-all ${selectedGym?.id === gym.id ? "border-blue-500 bg-zinc-800" : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"} ${!gym.available ? "opacity-50" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white text-sm">{gym.name}</p>
                  <p className="text-zinc-500 text-xs">{gym.district}</p>
                </div>
                {gym.districtMatch && <span className="text-xs text-green-400">Home</span>}
              </div>
              <div className="mt-1 flex gap-2 text-xs text-zinc-400 flex-wrap">
                <span>💰 {gym.costPerUse.toLocaleString()} DC</span>
                <span>⚡ {gym.energyCostPerTrain}</span>
                {!gym.available && <span className="text-red-400">Lv{gym.minLevel} req</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Stat selector & action */}
        {selectedGym && (
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
              <h2 className="font-bold text-white mb-1">{selectedGym.name}</h2>
              <p className="text-zinc-400 text-sm mb-4">{selectedGym.description}</p>

              {/* Multiplier breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {STATS.map(s => (
                  <div key={s.key} className="bg-zinc-800 rounded-lg p-2 text-center">
                    <div className="text-xs text-zinc-500">{s.label}</div>
                    <div className={`text-sm font-bold ${(selectedGym.multipliers[s.key] ?? 1) >= 1.5 ? "text-green-400" : (selectedGym.multipliers[s.key] ?? 1) < 0.8 ? "text-red-400" : "text-white"}`}>
                      ×{(selectedGym.multipliers[s.key] ?? 1).toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-zinc-300 text-sm font-bold mb-2">Train which stat?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {STATS.map(s => (
                  <button key={s.key} onClick={() => setSelectedStat(s.key)}
                    className={`p-3 rounded-xl border transition-all text-sm font-bold ${selectedStat === s.key ? "border-blue-500 bg-zinc-700 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {s.icon} {s.label}
                    <div className="text-xs text-zinc-500 mt-0.5">×{(selectedGym.multipliers[s.key] ?? 1).toFixed(1)}</div>
                  </button>
                ))}
              </div>

              <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 mb-4 space-y-1">
                <p>Cost: <span className="text-yellow-400">{selectedGym.costPerUse.toLocaleString()} DC</span> + <span className="text-blue-400">{selectedGym.energyCostPerTrain} energy</span></p>
                <p>Gain multiplier: <span className="text-green-400">×{((selectedGym.multipliers[selectedStat] ?? 1) * moodMult).toFixed(2)}</span> (gym ×{(selectedGym.multipliers[selectedStat] ?? 1).toFixed(1)} × mood ×{moodMult.toFixed(2)})</p>
                <p>Current {STATS.find(s => s.key === selectedStat)?.label}: <span className="text-white font-bold">{statValue(selectedStat)}</span></p>
                <p className="text-zinc-500 text-xs">Diminishing returns apply above stat 50.</p>
              </div>

              <button onClick={doTrain} disabled={loading || user.energy < selectedGym.energyCostPerTrain || user.dc < selectedGym.costPerUse}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${!loading && user.energy >= selectedGym.energyCostPerTrain && user.dc >= selectedGym.costPerUse ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {loading ? "Training…" : "Train Now"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
