import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User, Business } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface Career {
  id: string; tier: number; name: string; salaryPerShift: number; energyCost: number;
  statGain: Record<string, number>; description: string; available: boolean;
}

interface BizBlueprint {
  type: string; name: string; dailyIncome: number; launderCapacity: number;
  maxHolding: number; purchaseCost: number;
}

const COURT_TEXT = { fight: "Fight the charges — chance of full dismissal", plead: "Plead guilty — guaranteed 50% sentence reduction" };

export default function CityPage({ user, onUserUpdate }: Props) {
  const [tab, setTab] = useState<"careers" | "businesses" | "court">("careers");
  const [careers, setCareers] = useState<Career[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [catalog, setCatalog] = useState<BizBlueprint[]>([]);
  const [courtInfo, setCourtInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [launderBizId, setLaunderBizId] = useState("");
  const [launderAmount, setLaunderAmount] = useState("");
  const [buyBizType, setBuyBizType] = useState("");
  const [buyBizName, setBuyBizName] = useState("");

  useEffect(() => {
    api.get("/city/careers").then(r => setCareers(r.data)).catch(() => {});
    api.get("/city/businesses/catalog").then(r => setCatalog(r.data)).catch(() => {});
    refreshBiz();
  }, []);

  useEffect(() => {
    if (tab === "court") {
      api.get("/city/court").then(r => setCourtInfo(r.data)).catch(() => {});
    }
  }, [tab]);

  async function refreshBiz() {
    try {
      const r = await api.get("/city/businesses");
      setBusinesses(r.data);
    } catch { /* ignore */ }
  }

  async function doWork(careerId: string) {
    setLoading(true); setMessage(null);
    try {
      const r = await api.post(`/city/careers/${careerId}/work`, {});
      setMessage({ text: `Salary: +${r.data.salary.toLocaleString()} DC${r.data.leveled ? ` | LEVEL UP → ${r.data.newLevel}!` : ""}`, type: "success" });
      onUserUpdate({ ...user, dc: r.data.dc, energy: r.data.energy });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function buyBusiness() {
    if (!buyBizType) return;
    setLoading(true);
    try {
      const r = await api.post("/city/businesses/buy", { type: buyBizType, name: buyBizName || undefined });
      setMessage({ text: r.data.message, type: "success" });
      const bp = catalog.find(c => c.type === buyBizType);
      onUserUpdate({ ...user, dc: user.dc - (bp?.purchaseCost ?? 0) });
      await refreshBiz();
      setBuyBizType(""); setBuyBizName("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function collectBiz(bizId: string) {
    try {
      const r = await api.post(`/city/businesses/${bizId}/collect`, {});
      setMessage({ text: `Collected ${r.data.collected?.toLocaleString()} DC`, type: "success" });
      onUserUpdate({ ...user, dc: r.data.dc });
      await refreshBiz();
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function upgradeBiz(bizId: string) {
    try {
      const r = await api.post(`/city/businesses/${bizId}/upgrade`, {});
      setMessage({ text: r.data.message, type: "success" });
      onUserUpdate({ ...user, dc: r.data.dc });
      await refreshBiz();
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function launderBiz() {
    const amt = parseInt(launderAmount);
    if (!amt || !launderBizId) return;
    try {
      const r = await api.post(`/city/businesses/${launderBizId}/launder`, { amount: amt });
      setMessage({ text: r.data.message, type: "success" });
      onUserUpdate({ ...user, dc: r.data.dc, dirtyDc: r.data.dirtyDc });
      setLaunderAmount("");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doPlead() {
    try {
      const r = await api.post("/city/court/plead", {});
      setMessage({ text: r.data.message, type: "success" });
      onUserUpdate({ ...user, jailUntil: r.data.jailUntil });
      setCourtInfo(null);
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doFight() {
    try {
      const r = await api.post("/city/court/fight", {});
      setMessage({ text: r.data.message, type: r.data.success ? "success" : "error" });
      if (r.data.success) onUserUpdate({ ...user, jailUntil: null });
      else onUserUpdate({ ...user, jailUntil: r.data.jailUntil });
      setCourtInfo(null);
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  const TIER_COLORS = ["", "border-zinc-600", "border-blue-700", "border-yellow-600", "border-orange-500", "border-red-500"];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">City</h1>
          <p className="text-zinc-400 text-sm">Careers · Businesses · Court</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          DC: <span className="text-green-400 font-mono">{user.dc.toLocaleString()}</span><br />
          Dirty: <span className="text-orange-400 font-mono">{(user.dirtyDc ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        {(["careers","businesses","court"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* CAREERS */}
      {tab === "careers" && (
        <div className="space-y-3">
          <p className="text-zinc-500 text-xs">Work shifts for clean DC. Each shift costs energy.</p>
          {careers.map(c => (
            <div key={c.id} className={`bg-zinc-900 border ${TIER_COLORS[c.tier] ?? "border-zinc-700"} rounded-xl p-4 space-y-2`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{c.name}</p>
                  <p className="text-zinc-500 text-xs">{c.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-green-400 font-bold text-sm">{c.salaryPerShift.toLocaleString()} DC</span>
                  <p className="text-zinc-500 text-xs">per shift</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-zinc-400">
                <span>⚡ {c.energyCost} energy</span>
                {Object.entries(c.statGain).map(([s, g]) => (
                  <span key={s}>+{g} {s}</span>
                ))}
                {!c.available && <span className="text-red-400">Lv{c.tier * 5} req</span>}
              </div>
              <button onClick={() => doWork(c.id)} disabled={!c.available || loading || user.energy < c.energyCost}
                className={`w-full py-2 rounded-lg text-sm font-bold ${c.available && !loading && user.energy >= c.energyCost ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                Work Shift
              </button>
            </div>
          ))}
        </div>
      )}

      {/* BUSINESSES */}
      {tab === "businesses" && (
        <div className="space-y-4">
          {/* Owned businesses */}
          {businesses.map(biz => (
            <div key={biz.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{biz.name}</p>
                  <p className="text-zinc-500 text-xs capitalize">{biz.type.replace(/_/g," ")} — Level {biz.level}</p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>+{biz.dailyIncome.toLocaleString()} DC/day</p>
                  <p>Launder rate: {Math.round(biz.launderRate * 100)}% loss</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => collectBiz(biz.id)}
                  className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-bold text-white">
                  Collect {(biz.pendingCollection ?? 0).toLocaleString()} DC
                </button>
                <button onClick={() => upgradeBiz(biz.id)} disabled={biz.level >= biz.maxLevel}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${biz.level < biz.maxLevel ? "bg-blue-700 hover:bg-blue-600 text-white" : "bg-zinc-700 text-zinc-500 cursor-not-allowed"}`}>
                  Upgrade ({biz.upgradeCost.toLocaleString()} DC)
                </button>
                <button onClick={() => setLaunderBizId(prev => prev === biz.id ? "" : biz.id)}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-white">
                  Launder
                </button>
              </div>

              {launderBizId === biz.id && (
                <div className="flex gap-2">
                  <input type="number" value={launderAmount} onChange={e => setLaunderAmount(e.target.value)}
                    placeholder="Dirty DC amount"
                    className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  <button onClick={launderBiz} className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-bold text-white">Go</button>
                </div>
              )}
            </div>
          ))}

          {/* Buy new business */}
          {businesses.length < 3 && (
            <div className="bg-zinc-900 border border-dashed border-zinc-600 rounded-xl p-4 space-y-3">
              <h3 className="font-bold text-zinc-300">Open a New Business</h3>
              <select value={buyBizType} onChange={e => setBuyBizType(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                <option value="">Select type…</option>
                {catalog.map(c => (
                  <option key={c.type} value={c.type}>{c.name} — {c.purchaseCost.toLocaleString()} DC</option>
                ))}
              </select>
              {buyBizType && (
                <>
                  <input value={buyBizName} onChange={e => setBuyBizName(e.target.value)} placeholder="Business name (optional)"
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
                  {catalog.filter(c => c.type === buyBizType).map(c => (
                    <div key={c.type} className="text-xs text-zinc-400 space-y-0.5">
                      <p>💰 {c.dailyIncome.toLocaleString()} DC/day income</p>
                      <p>🧹 {c.launderCapacity.toLocaleString()} dirty DC/day launder capacity</p>
                      <p>📦 Max holding: {c.maxHolding.toLocaleString()} DC</p>
                    </div>
                  ))}
                  <button onClick={buyBusiness} disabled={loading || user.dc < (catalog.find(c => c.type === buyBizType)?.purchaseCost ?? Infinity)}
                    className={`w-full py-2 rounded-lg text-sm font-bold ${!loading && user.dc >= (catalog.find(c => c.type === buyBizType)?.purchaseCost ?? Infinity) ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                    Open Business
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* COURT */}
      {tab === "court" && (
        <div className="space-y-4">
          {courtInfo?.inJail ? (
            <div className="bg-zinc-900 border border-yellow-700 rounded-xl p-5 space-y-4">
              <h2 className="text-yellow-400 font-bold text-lg">⚖️ You're Facing Charges</h2>
              <p className="text-zinc-400 text-sm">
                Sentence remaining: <span className="text-white font-bold">{Math.ceil(courtInfo.remainingMs / 60000)} minutes</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-green-400 font-bold">Plead Guilty</h3>
                  <p className="text-zinc-400 text-sm">{COURT_TEXT.plead}</p>
                  <p className="text-zinc-500 text-xs">New sentence: {Math.ceil(courtInfo.options?.plead?.newDuration / 60000)} min</p>
                  <button onClick={doPlead} className="w-full py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-bold text-white">
                    Plead Guilty
                  </button>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-red-400 font-bold">Fight Charges</h3>
                  <p className="text-zinc-400 text-sm">{COURT_TEXT.fight}</p>
                  <p className="text-zinc-500 text-xs">Success chance: {Math.round((courtInfo.options?.fight?.chance ?? 0) * 100)}% (based on Intelligence)</p>
                  <button onClick={doFight} className="w-full py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-bold text-white">
                    Fight the Charges
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-zinc-400">⚖️ No pending charges. Stay out of trouble.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
