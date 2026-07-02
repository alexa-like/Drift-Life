import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface DarkListing { id: string; pseudoHandle: string; itemName: string; price: number; currency: string; stingRisk: number }

const SEQUENCE_SYMBOLS = ["▲", "■", "●", "◆", "★", "✦", "⬟", "⬡"];

export default function NetPage({ user, onUserUpdate }: Props) {
  const [tab, setTab] = useState<"status" | "hack" | "sim" | "dark">("status");
  const [simData, setSimData] = useState<{ sim: number; price: number; history: { price: number; at: string }[] } | null>(null);
  const [darkListings, setDarkListings] = useState<DarkListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warn" } | null>(null);

  // Hack state
  const [hackTargetId, setHackTargetId] = useState("");
  const [hackSession, setHackSession] = useState<{ sessionId: string; sequence: string[]; timeLimit: number } | null>(null);
  const [hackAnswer, setHackAnswer] = useState<string[]>([]);
  const [hackTimer, setHackTimer] = useState(0);

  // SIM state
  const [simAmount, setSimAmount] = useState("");
  const [simMode, setSimMode] = useState<"buy" | "sell">("buy");

  // Dark market
  const [darkNewName, setDarkNewName] = useState("");
  const [darkNewPrice, setDarkNewPrice] = useState("");
  const [darkNewCurrency, setDarkNewCurrency] = useState<"dc" | "sim">("dc");

  useEffect(() => {
    api.get<{ sim: number; price: number; history: { price: number; at: string }[] }>("/net/sim").then(setSimData).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "dark") {
      api.get<DarkListing[]>("/net/dark-market").then(setDarkListings).catch(() => {});
    }
  }, [tab]);

  // Hack countdown timer
  useEffect(() => {
    if (!hackSession) return;
    setHackTimer(hackSession.timeLimit);
    const iv = setInterval(() => {
      setHackTimer(prev => {
        if (prev <= 1) { clearInterval(iv); setHackSession(null); setMessage({ text: "Session expired.", type: "error" }); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [hackSession]);

  async function initiateHack() {
    if (!hackTargetId.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const r = await api.post<any>("/net/hack/initiate", { targetId: hackTargetId.trim() });
      setHackSession({ sessionId: r.sessionId, sequence: r.sequence, timeLimit: r.timeLimit });
      setHackAnswer([]);
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  function addToAnswer(sym: string) {
    if (!hackSession) return;
    if (hackAnswer.length >= hackSession.sequence.length) return;
    setHackAnswer(prev => [...prev, sym]);
  }

  async function submitHack() {
    if (!hackSession) return;
    setLoading(true);
    try {
      const r = await api.post<any>("/net/hack/submit", { sessionId: hackSession.sessionId, answer: hackAnswer });
      if (r.success) {
        setMessage({ text: `Breach successful! +${r.simEarned} SIM | Heat +${r.heatGain}`, type: "success" });
        onUserUpdate({ ...user, sim: r.sim, heat: Math.min(100, user.heat + r.heatGain) });
      } else {
        setMessage({ text: r.message, type: "error" });
      }
      setHackSession(null);
      setHackAnswer([]);
      setHackTargetId("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function upgradeFirewall() {
    try {
      const r = await api.post<any>("/net/firewall/upgrade", {});
      setMessage({ text: r.message, type: "success" });
      onUserUpdate({ ...user, firewallLevel: r.firewallLevel, dc: r.dc });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function tradeSim() {
    const amt = parseInt(simAmount);
    if (!amt || amt < 1) return;
    try {
      const r = await api.post<any>(simMode === "buy" ? "/net/sim/buy" : "/net/sim/sell", { amount: amt });
      setMessage({ text: `${simMode === "buy" ? "Bought" : "Sold"} ${amt} SIM. New price: ${r.newPrice?.toLocaleString()} DC/SIM`, type: "success" });
      onUserUpdate({ ...user, sim: r.sim, dc: r.dc });
      setSimData(prev => prev ? { ...prev, price: r.newPrice, sim: r.sim } : prev);
      setSimAmount("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function listDark() {
    if (!darkNewName || !darkNewPrice) return;
    try {
      const r = await api.post<any>("/net/dark-market/list", {
        itemName: darkNewName, price: parseInt(darkNewPrice), currency: darkNewCurrency,
      });
      setMessage({ text: `Listed as ${r.pseudoHandle}`, type: "success" });
      setDarkNewName(""); setDarkNewPrice("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function buyDark(listingId: string) {
    try {
      const r = await api.post<any>(`/net/dark-market/buy/${listingId}`, {});
      if (r.stung) {
        setMessage({ text: r.message, type: "warn" });
        onUserUpdate({ ...user, heat: r.heat });
      } else {
        setMessage({ text: `Purchased: ${r.item}`, type: "success" });
        onUserUpdate({ ...user, dc: r.dc, sim: r.sim });
        setDarkListings(prev => prev.filter(l => l.id !== listingId));
      }
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  const FIREWALL_COSTS = [0, 5_000, 15_000, 40_000, 100_000, 250_000];
  const nextFirewallCost = FIREWALL_COSTS[(user.firewallLevel ?? 1)] ?? null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">The Net</h1>
          <p className="text-zinc-400 text-sm">Hacking · SIM coin · Dark market</p>
        </div>
        <div className="text-right text-sm text-zinc-400 space-y-0.5">
          <p>SIM: <span className="text-cyan-400 font-mono">{(user.sim ?? 0).toLocaleString()}</span></p>
          <p>Firewall: <span className="text-blue-400 font-mono">Lv{user.firewallLevel ?? 1}</span></p>
          <p>Energy: <span className="text-blue-300">{user.energy}/{user.maxEnergy}</span></p>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : message.type === "warn" ? "bg-yellow-900/50 border border-yellow-600 text-yellow-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["status","hack","sim","dark"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t === "status" ? "Status" : t === "hack" ? "Hack" : t === "sim" ? "SIM" : "Dark Market"}
          </button>
        ))}
      </div>

      {/* STATUS */}
      {tab === "status" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "SIM Balance", value: (user.sim ?? 0).toLocaleString(), color: "text-cyan-400", icon: "⬡" },
              { label: "Firewall Lv", value: user.firewallLevel ?? 1, color: "text-blue-400", icon: "🛡️" },
              { label: "Intelligence", value: user.intelligence ?? 5, color: "text-purple-400", icon: "🧠" },
              { label: "Heat", value: `${user.heat ?? 0}%`, color: "text-red-400", icon: "🔥" },
              { label: "Followers", value: (user.followers ?? 0).toLocaleString(), color: "text-pink-400", icon: "👥" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs text-zinc-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-white">Firewall Defense</h2>
            <p className="text-zinc-400 text-sm">Higher firewall = harder to hack. Each level increases sequence difficulty for attackers.</p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-zinc-700 rounded-full">
                  <div className="h-3 bg-blue-500 rounded-full" style={{ width: `${((user.firewallLevel ?? 1) / 6) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>Lv1</span><span>Lv6</span>
                </div>
              </div>
              {nextFirewallCost !== null && (
                <button onClick={upgradeFirewall} disabled={user.dc < nextFirewallCost}
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${user.dc >= nextFirewallCost ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                  Upgrade ({nextFirewallCost.toLocaleString()} DC)
                </button>
              )}
              {nextFirewallCost === null && <span className="text-green-400 text-sm font-bold">MAX LEVEL</span>}
            </div>
          </div>
        </div>
      )}

      {/* HACK */}
      {tab === "hack" && (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Breach another player's firewall. Earn SIM on success. Costs 3 energy per attempt.</p>

          {!hackSession && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <input value={hackTargetId} onChange={e => setHackTargetId(e.target.value)} placeholder="Target player ID"
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              <button onClick={initiateHack} disabled={loading || !hackTargetId.trim() || user.energy < 3}
                className={`w-full py-2 rounded-lg text-sm font-bold ${!loading && hackTargetId.trim() && user.energy >= 3 ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {loading ? "Connecting…" : user.energy < 3 ? "Need 3 energy" : "Initiate Hack"}
              </button>
            </div>
          )}

          {hackSession && (
            <div className="bg-zinc-950 border border-blue-700 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-blue-400 font-bold font-mono">SEQUENCE BREACH</p>
                <span className={`font-mono font-bold ${hackTimer <= 10 ? "text-red-400 animate-pulse" : "text-zinc-300"}`}>{hackTimer}s</span>
              </div>

              {/* Target sequence */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">MEMORIZE SEQUENCE:</p>
                <div className="flex gap-2 flex-wrap">
                  {hackSession.sequence.map((s, i) => (
                    <div key={i} className="w-10 h-10 bg-zinc-800 border border-blue-600 rounded-lg flex items-center justify-center text-blue-400 font-bold text-lg">
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Player answer */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">YOUR INPUT:</p>
                <div className="flex gap-2 flex-wrap min-h-[2.5rem]">
                  {hackAnswer.map((s, i) => (
                    <div key={i} className="w-10 h-10 bg-zinc-700 border border-zinc-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Symbol keyboard */}
              <div className="grid grid-cols-4 gap-2">
                {SEQUENCE_SYMBOLS.map(sym => (
                  <button key={sym} onClick={() => addToAnswer(sym)}
                    className="h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-white text-xl font-bold transition-all">
                    {sym}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setHackAnswer([])} className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-300">Clear</button>
                <button onClick={submitHack} disabled={hackAnswer.length !== hackSession.sequence.length || loading}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold ${hackAnswer.length === hackSession.sequence.length && !loading ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SIM */}
      {tab === "sim" && simData && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-cyan-700 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-white">SIM Exchange</h2>
              <span className="text-cyan-400 font-mono text-lg">{simData.price.toLocaleString()} DC/SIM</span>
            </div>
            <p className="text-zinc-500 text-xs">Price fluctuates based on buy/sell pressure. Cap: ±15%/hr.</p>

            {/* Price sparkline */}
            {simData.history.length > 1 && (
              <div className="h-16 bg-zinc-800 rounded-lg flex items-end gap-px px-2 py-1">
                {simData.history.slice(-30).map((h, i) => {
                  const prices = simData.history.slice(-30).map(x => x.price);
                  const min = Math.min(...prices), max = Math.max(...prices);
                  const pct = max === min ? 50 : ((h.price - min) / (max - min)) * 100;
                  return (
                    <div key={i} className="flex-1 bg-cyan-500 opacity-70 rounded-t" style={{ height: `${Math.max(4, pct)}%` }} />
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              {(["buy","sell"] as const).map(m => (
                <button key={m} onClick={() => setSimMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize ${simMode === m ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                  {m} SIM
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input type="number" value={simAmount} onChange={e => setSimAmount(e.target.value)} placeholder="Amount"
                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500" />
              <button onClick={tradeSim} disabled={!simAmount}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${simAmount ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {simMode === "buy" ? "Buy" : "Sell"}
              </button>
            </div>

            {simAmount && (
              <p className="text-xs text-zinc-400">
                {simMode === "buy"
                  ? `Cost: ${(parseInt(simAmount) * simData.price).toLocaleString()} DC → +${parseInt(simAmount)} SIM`
                  : `Revenue: ${(parseInt(simAmount) * simData.price).toLocaleString()} DC ← -${parseInt(simAmount)} SIM`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* DARK MARKET */}
      {tab === "dark" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-red-900 rounded-xl p-4 space-y-3">
            <h2 className="text-red-400 font-bold">☠️ Dark Market</h2>
            <p className="text-zinc-500 text-xs">3% sting risk per purchase. Identity anonymized via pseudohandles. Complete 3 runs to unlock.</p>

            {/* List new item */}
            <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
              <p className="text-xs text-zinc-400 font-bold">LIST ITEM</p>
              <input value={darkNewName} onChange={e => setDarkNewName(e.target.value)} placeholder="Item description"
                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none" />
              <div className="flex gap-2">
                <input type="number" value={darkNewPrice} onChange={e => setDarkNewPrice(e.target.value)} placeholder="Price"
                  className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none" />
                <select value={darkNewCurrency} onChange={e => setDarkNewCurrency(e.target.value as any)}
                  className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1.5 text-white text-sm">
                  <option value="dc">DC</option>
                  <option value="sim">SIM</option>
                </select>
                <button onClick={listDark} disabled={!darkNewName || !darkNewPrice}
                  className={`px-3 py-1.5 rounded text-sm font-bold ${darkNewName && darkNewPrice ? "bg-red-700 hover:bg-red-600 text-white" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"}`}>
                  List
                </button>
              </div>
            </div>

            {/* Active listings */}
            {darkListings.length === 0 && <p className="text-zinc-500 text-sm">No active listings.</p>}
            {darkListings.map(l => (
              <div key={l.id} className="bg-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white text-sm font-medium">{l.itemName}</p>
                  <p className="text-zinc-500 text-xs">{l.pseudoHandle}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-bold text-sm">{l.price.toLocaleString()} {l.currency.toUpperCase()}</p>
                  <button onClick={() => buyDark(l.id)}
                    className="mt-1 px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-white font-bold">
                    Buy (3% sting risk)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
