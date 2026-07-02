import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User, Run } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

const TIER_COLORS: Record<number, string> = {
  1: "border-zinc-600",
  2: "border-blue-600",
  3: "border-yellow-500",
  4: "border-orange-500",
  5: "border-red-500",
};

const TIER_LABELS: Record<number, string> = {
  1: "Ghost",
  2: "Street",
  3: "Circuit",
  4: "Cartel",
  5: "Legend",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  extreme: "text-red-500",
};

export default function StreetPage({ user, onUserUpdate }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warn" } | null>(null);
  const [jailList, setJailList] = useState<any[]>([]);
  const [tab, setTab] = useState<"runs" | "jail" | "launder">("runs");
  const [launderAmount, setLaunderAmount] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [pursuit, setPursuit] = useState(user.pursuiteActive ?? false);

  useEffect(() => {
    api.get<Run[]>("/crimes").then(setRuns).catch(() => {});
    api.get<Record<string, number>>("/crimes/mastery").then(setMastery).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "jail") {
      api.get<any[]>("/crimes/jail-list").then(setJailList).catch(() => {});
    }
  }, [tab]);

  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();

  async function doRun(run: Run) {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const d = await api.post<any>(`/crimes/${run.id}/commit`, {});

      if (d.pursuitRequired) {
        setPursuit(true);
        setMessage({ text: "🚨 HEAT CRITICAL — Resolve the pursuit before running again!", type: "warn" });
        return;
      }

      let msg = d.narrative;
      if (d.success) {
        msg += ` +${d.dirtyDcGained?.toLocaleString()} dirty DC / +${d.xpGained} XP`;
        if (d.leveled) msg += ` | LEVEL UP → ${d.newLevel}!`;
        if (d.mastery) msg += ` | Mastery: ${d.mastery.toFixed(1)}%`;
        if (d.heatGained) msg += ` | Heat +${d.heatGained}`;
        if (d.pursuitWarning) msg += " ⚠️ Heat approaching critical!";
      }

      setMessage({ text: msg, type: d.success ? "success" : "error" });
      if (d.user) onUserUpdate({ ...user, ...d.user });
      if (d.mastery !== undefined) setMastery(prev => ({ ...prev, [run.id]: d.mastery }));
    } catch (e: any) {
      const msg = e.response?.data?.message ?? "Error";
      setMessage({ text: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function resolvePursuit(outcome: "bribe" | "outrun" | "busted") {
    try {
      const r = await api.post<any>("/crimes/pursuit/resolve", { outcome });
      setMessage({ text: r.message, type: "success" });
      setPursuit(false);
      onUserUpdate({ ...user, pursuiteActive: false, heat: r.heat });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doEscape() {
    try {
      const r = await api.post<any>("/crimes/escape", {});
      setMessage({ text: r.message, type: r.success ? "success" : "error" });
      if (r.success) onUserUpdate({ ...user, jailUntil: null });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doBribe() {
    try {
      const r = await api.post<any>("/crimes/bribe", {});
      setMessage({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, wantedLevel: 0, heat: r.heat });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doLaunder() {
    const amt = parseInt(launderAmount);
    if (!amt || amt < 1) return;
    try {
      const r = await api.post<any>("/crimes/launder", { amount: amt });
      setMessage({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, dirtyDc: r.dirtyDc });
      setLaunderAmount("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doBailout(targetId: string) {
    try {
      const r = await api.post<any>(`/crimes/bail/${targetId}`, {});
      setMessage({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: user.dc - r.bailCost });
      setJailList(prev => prev.filter(p => p.id !== targetId));
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  const filteredRuns = selectedTier ? runs.filter(r => r.tier === selectedTier) : runs;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">The Street</h1>
          <p className="text-zinc-400 text-sm">Runs. Scores. Heat.</p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-zinc-400">HEAT</span>
            <div className="w-28 h-2 bg-zinc-700 rounded-full">
              <div
                className={`h-2 rounded-full transition-all ${user.heat >= 80 ? "bg-red-500 animate-pulse" : user.heat >= 50 ? "bg-orange-400" : "bg-yellow-400"}`}
                style={{ width: `${user.heat}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${user.heat >= 80 ? "text-red-400" : "text-yellow-300"}`}>{user.heat}%</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xs text-zinc-400">STRESS</span>
            <div className="w-28 h-2 bg-zinc-700 rounded-full">
              <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${user.stress}%` }} />
            </div>
            <span className="text-xs text-zinc-300">{user.stress}%</span>
          </div>
          <div className="text-xs text-zinc-400">
            <span className="text-green-400 font-mono">{(user.dirtyDc ?? 0).toLocaleString()}</span> dirty DC
          </div>
          <div className="text-xs text-zinc-400">Energy: <span className="text-blue-300">{user.energy}/{user.maxEnergy}</span></div>
        </div>
      </div>

      {/* Pursuit event overlay */}
      {pursuit && (
        <div className="bg-red-900/60 border border-red-500 rounded-xl p-4 animate-pulse">
          <p className="font-bold text-red-300 text-lg mb-3">🚨 PURSUIT ACTIVE — Resolve before next run</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => resolvePursuit("bribe")} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-bold">💰 Bribe ({Math.floor(user.heat * 500).toLocaleString()} DC)</button>
            <button onClick={() => resolvePursuit("outrun")} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold">🏎 Outrun</button>
            <button onClick={() => resolvePursuit("busted")} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 rounded-lg text-sm font-bold">🤚 Surrender</button>
          </div>
        </div>
      )}

      {/* Status banners */}
      {isJailed && (
        <div className="bg-zinc-800 border border-zinc-600 rounded-xl p-4">
          <p className="text-yellow-400 font-bold">⛓ In Jail — {new Date(user.jailUntil!).toLocaleTimeString()}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={doEscape} className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">Escape Attempt</button>
            <button onClick={doBribe} className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs">Bribe Guard</button>
            <button onClick={() => setTab("jail")} className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs">Jail List</button>
          </div>
        </div>
      )}

      {isHospitalized && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-3">
          <p className="text-red-400 font-bold">🏥 Hospitalized — {new Date(user.hospitalizedUntil!).toLocaleTimeString()}</p>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : message.type === "warn" ? "bg-yellow-900/50 border border-yellow-600 text-yellow-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["runs", "jail", "launder"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t === "runs" ? "Runs" : t === "jail" ? "Jail List" : "Launder"}
          </button>
        ))}
      </div>

      {tab === "runs" && (
        <>
          {/* Tier filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedTier(null)}
              className={`px-3 py-1 rounded text-xs font-bold ${!selectedTier ? "bg-white text-black" : "bg-zinc-800 text-zinc-400"}`}>All</button>
            {[1, 2, 3, 4, 5].map(tier => (
              <button key={tier} onClick={() => setSelectedTier(tier === selectedTier ? null : tier)}
                className={`px-3 py-1 rounded text-xs font-bold border ${TIER_COLORS[tier]} ${selectedTier === tier ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-300"}`}>
                T{tier} {TIER_LABELS[tier]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRuns.map(run => {
              const canRun = !isJailed && !isHospitalized && !pursuit && user.energy >= run.energyCost && user.level >= run.minLevel;
              const m = mastery[run.id] ?? 0;
              return (
                <div key={run.id} className={`bg-zinc-900 border ${TIER_COLORS[run.tier]} rounded-xl p-4 space-y-3`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-400">T{run.tier}</span>
                        <h3 className="font-bold text-white">{run.name}</h3>
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5">{run.description}</p>
                    </div>
                    <span className={`text-xs font-bold ${RISK_COLORS[run.riskLevel]}`}>{run.riskLevel.toUpperCase()}</span>
                  </div>

                  {/* Mastery bar */}
                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Mastery</span>
                      <span>{m.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full">
                      <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, m)}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>⚡ {run.energyCost}</span>
                    <span>🔥 +{run.heatGain} heat</span>
                    <span>💚 {(run.baseSuccess * 100).toFixed(0)}% base</span>
                    <span>💰 {run.dcRange[0].toLocaleString()}–{run.dcRange[1].toLocaleString()}</span>
                    <span>📊 {run.relevantStat}</span>
                  </div>

                  {user.level < run.minLevel && (
                    <p className="text-xs text-red-400">Requires level {run.minLevel}</p>
                  )}

                  <button
                    onClick={() => doRun(run)}
                    disabled={!canRun || loading}
                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${canRun && !loading ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                    {loading ? "Running…" : `Execute Run`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "jail" && (
        <div className="space-y-2">
          <p className="text-zinc-400 text-sm">Players currently in jail. Bail them out for a fee.</p>
          {jailList.length === 0 && <p className="text-zinc-500 text-sm">Nobody's locked up right now.</p>}
          {jailList.map(p => {
            const remainingMin = Math.ceil((new Date(p.jailUntil).getTime() - Date.now()) / 60000);
            const bailCost = Math.floor(remainingMin * 1_000 * 1.5);
            return (
              <div key={p.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{p.username} <span className="text-zinc-500 text-xs">Lv{p.level}</span></p>
                  <p className="text-xs text-zinc-400">{remainingMin} min remaining</p>
                </div>
                <button onClick={() => doBailout(p.id)}
                  className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-xs font-bold text-white">
                  Bail ({bailCost.toLocaleString()} DC)
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "launder" && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
          <h2 className="text-white font-bold text-lg">Launder Dirty DC</h2>
          <p className="text-zinc-400 text-sm">Convert dirty DC to clean DC. Requires a business. Loss rate varies by business type and level.</p>
          <div className="bg-zinc-800 rounded-lg p-3 text-sm space-y-1">
            <p className="text-zinc-300">Dirty DC available: <span className="text-orange-400 font-bold">{(user.dirtyDc ?? 0).toLocaleString()}</span></p>
            <p className="text-zinc-300">Clean DC: <span className="text-green-400 font-bold">{user.dc.toLocaleString()}</span></p>
          </div>
          {(user.businesses?.length ?? 0) === 0 ? (
            <p className="text-zinc-500 text-sm">You need a business (City → Businesses) to launder money.</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="number" value={launderAmount} onChange={e => setLaunderAmount(e.target.value)}
                placeholder="Amount to launder"
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={doLaunder}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-bold text-white">
                Launder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
