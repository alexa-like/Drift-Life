import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import type { User, Business, District } from "../lib/types";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
  refreshUser?: () => Promise<User | null>;
  addToast?: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface Career {
  id: string; tier: number; name: string; salaryPerShift: number; energyCost: number;
  statGain: Record<string, number>; description: string; available: boolean;
}
interface BizBlueprint {
  type: string; name: string; dailyIncome: number; launderCapacity: number;
  maxHolding: number; purchaseCost: number;
}
interface Run {
  id: string; name: string; description: string; tier: number; energyCost: number;
  heatGain: number; baseSuccess: number; dcRange: [number, number]; riskLevel: string;
  relevantStat: string; minLevel: number;
}

const CITY_TIER_COLORS: Record<number, string> = { 1: "border-zinc-600", 2: "border-blue-700", 3: "border-yellow-600", 4: "border-orange-500", 5: "border-red-500" };
const RUN_TIER_COLORS: Record<number, string> = { 1: "border-zinc-600", 2: "border-blue-600", 3: "border-yellow-500", 4: "border-orange-500", 5: "border-red-500" };
const RUN_TIER_LABELS: Record<number, string> = { 1: "Ghost", 2: "Street", 3: "Circuit", 4: "Cartel", 5: "Legend" };
const RISK_COLORS: Record<string, string> = { low: "text-green-400", medium: "text-yellow-400", high: "text-orange-400", extreme: "text-red-500" };
const DANGER_LABELS = ["", "Safe", "Low", "Medium", "High", "Critical"];
const DANGER_COLORS = ["", "#39d353", "#f59e0b", "#ff6b35", "#ff2d55", "#ff0000"];
const COURT_TEXT = { fight: "Fight the charges — chance of full dismissal", plead: "Plead guilty — guaranteed 50% sentence reduction" };

type TopTab = "street" | "districts" | "hub" | "court";

export default function CityPage({ user, onUserUpdate, refreshUser, addToast }: Props) {
  const [topTab, setTopTab] = useState<TopTab>("street");

  // HUB state
  const [hubTab, setHubTab] = useState<"careers" | "businesses">("careers");
  const [careers, setCareers] = useState<Career[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [catalog, setCatalog] = useState<BizBlueprint[]>([]);
  const [courtInfo, setCourtInfo] = useState<any>(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubMsg, setHubMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [launderBizId, setLaunderBizId] = useState("");
  const [launderAmount, setLaunderAmount] = useState("");
  const [buyBizType, setBuyBizType] = useState("");
  const [buyBizName, setBuyBizName] = useState("");

  // DISTRICTS state
  const [districts, setDistricts] = useState<District[]>([]);
  const [traveling, setTraveling] = useState<string | null>(null);

  // STREET state
  const [runs, setRuns] = useState<Run[]>([]);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [streetLoading, setStreetLoading] = useState(false);
  const [streetMsg, setStreetMsg] = useState<{ text: string; type: "success" | "error" | "warn" } | null>(null);
  const [jailList, setJailList] = useState<any[]>([]);
  const [streetTab, setStreetTab] = useState<"runs" | "jail" | "launder">("runs");
  const [streetLaunderAmount, setStreetLaunderAmount] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [pursuit, setPursuit] = useState((user as any).pursuiteActive ?? false);

  useEffect(() => {
    api.get<Career[]>("/city/careers").then(setCareers).catch(() => {});
    api.get<BizBlueprint[]>("/city/businesses/catalog").then(setCatalog).catch(() => {});
    refreshBiz();
    api.get<District[]>("/districts").then(setDistricts).catch(() => {});
    api.get<Run[]>("/crimes").then(setRuns).catch(() => {});
    api.get<Record<string, number>>("/crimes/mastery").then(setMastery).catch(() => {});
  }, []);

  useEffect(() => {
    if (topTab === "court") api.get<any>("/city/court").then(setCourtInfo).catch(() => {});
    if (topTab === "street" && streetTab === "jail") api.get<any[]>("/crimes/jail-list").then(setJailList).catch(() => {});
  }, [topTab, streetTab]);

  const toast = (msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
    if (addToast) addToast(msg, type);
  };

  async function refreshBiz() {
    try { setBusinesses(await api.get<Business[]>("/city/businesses")); } catch {}
  }

  async function doWork(careerId: string) {
    setHubLoading(true); setHubMsg(null);
    try {
      const r = await api.post<any>(`/city/careers/${careerId}/work`, {});
      setHubMsg({ text: `+${r.salary.toLocaleString()} DC${r.leveled ? ` | LEVEL UP → ${r.newLevel}!` : ""}`, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, energy: r.energy });
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
    finally { setHubLoading(false); }
  }

  async function buyBusiness() {
    if (!buyBizType) return;
    setHubLoading(true);
    try {
      const r = await api.post<any>("/city/businesses/buy", { type: buyBizType, name: buyBizName || undefined });
      setHubMsg({ text: r.message, type: "success" });
      const bp = catalog.find(c => c.type === buyBizType);
      onUserUpdate({ ...user, dc: user.dc - (bp?.purchaseCost ?? 0) });
      await refreshBiz();
      setBuyBizType(""); setBuyBizName("");
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
    finally { setHubLoading(false); }
  }

  async function collectBiz(bizId: string) {
    try {
      const r = await api.post<any>(`/city/businesses/${bizId}/collect`, {});
      setHubMsg({ text: `Collected ${r.collected?.toLocaleString()} DC`, type: "success" });
      onUserUpdate({ ...user, dc: r.dc });
      await refreshBiz();
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function upgradeBiz(bizId: string) {
    try {
      const r = await api.post<any>(`/city/businesses/${bizId}/upgrade`, {});
      setHubMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc });
      await refreshBiz();
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function launderBiz() {
    const amt = parseInt(launderAmount);
    if (!amt || !launderBizId) return;
    try {
      const r = await api.post<any>(`/city/businesses/${launderBizId}/launder`, { amount: amt });
      setHubMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, dirtyDc: r.dirtyDc });
      setLaunderAmount("");
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function doPlead() {
    try {
      const r = await api.post<any>("/city/court/plead", {});
      setHubMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, jailUntil: r.jailUntil });
      setCourtInfo(null);
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function doFight() {
    try {
      const r = await api.post<any>("/city/court/fight", {});
      setHubMsg({ text: r.message, type: r.success ? "success" : "error" });
      if (r.success) onUserUpdate({ ...user, jailUntil: null });
      else onUserUpdate({ ...user, jailUntil: r.jailUntil });
      setCourtInfo(null);
    } catch (e: any) { setHubMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function travel(districtId: string) {
    if (districtId === user.district) return;
    setTraveling(districtId);
    try {
      const data = await api.post<any>(`/districts/${districtId}/travel`);
      toast(data.message, "success");
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      toast(err.message, "error");
    } finally { setTraveling(null); }
  }

  async function returnHome() {
    setTraveling("__return_home__");
    try {
      const data = await api.post<any>("/districts/return-home");
      toast(data.message, "success");
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      toast(err.message, "error");
    } finally { setTraveling(null); }
  }

  async function doRun(run: Run) {
    if (streetLoading) return;
    setStreetLoading(true); setStreetMsg(null);
    try {
      const d = await api.post<any>(`/crimes/${run.id}/commit`, {});
      if (d.pursuitRequired) {
        setPursuit(true);
        setStreetMsg({ text: "HEAT CRITICAL — Resolve the pursuit before running again!", type: "warn" });
        return;
      }
      let msg = d.narrative;
      if (d.success) {
        msg += ` +${d.dirtyDcGained?.toLocaleString()} dirty DC / +${d.xpGained} XP`;
        if (d.leveled) msg += ` | LEVEL UP → ${d.newLevel}!`;
        if (d.mastery) msg += ` | Mastery: ${d.mastery.toFixed(1)}%`;
        if (d.heatGained) msg += ` | Heat +${d.heatGained}`;
        if (d.pursuitWarning) msg += " — Heat approaching critical!";
      }
      setStreetMsg({ text: msg, type: d.success ? "success" : "error" });
      if (d.user) onUserUpdate({ ...user, ...d.user });
      if (d.mastery !== undefined) setMastery(prev => ({ ...prev, [run.id]: d.mastery }));
    } catch (e: any) {
      setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setStreetLoading(false); }
  }

  async function resolvePursuit(outcome: "bribe" | "outrun" | "busted") {
    try {
      const r = await api.post<any>("/crimes/pursuit/resolve", { outcome });
      setStreetMsg({ text: r.message, type: "success" });
      setPursuit(false);
      onUserUpdate({ ...user, pursuiteActive: false, heat: r.heat, jailUntil: r.jailUntil ?? user.jailUntil, dc: r.dc ?? user.dc });
    } catch (e: any) {
      setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function doEscape() {
    try {
      const r = await api.post<any>("/crimes/escape", {});
      setStreetMsg({ text: r.message, type: r.success ? "success" : "error" });
      if (r.success) onUserUpdate({ ...user, jailUntil: null });
    } catch (e: any) { setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function doBribe() {
    try {
      const r = await api.post<any>("/crimes/bribe", {});
      setStreetMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, wantedLevel: 0, heat: r.heat });
    } catch (e: any) { setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function doStreetLaunder() {
    const amt = parseInt(streetLaunderAmount);
    if (!amt || amt < 1) return;
    try {
      const r = await api.post<any>("/crimes/launder", { amount: amt });
      setStreetMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: r.dc, dirtyDc: r.dirtyDc });
      setStreetLaunderAmount("");
    } catch (e: any) { setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  async function doBailout(targetId: string) {
    try {
      const r = await api.post<any>(`/crimes/bail/${targetId}`, {});
      setStreetMsg({ text: r.message, type: "success" });
      onUserUpdate({ ...user, dc: user.dc - r.bailCost });
      setJailList(prev => prev.filter(p => p.id !== targetId));
    } catch (e: any) { setStreetMsg({ text: e.response?.data?.message ?? "Error", type: "error" }); }
  }

  const isJailed = !!(user.jailUntil && new Date(user.jailUntil) > new Date());
  const isHospitalized = !!(user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date());
  const filteredRuns = selectedTier ? runs.filter(r => r.tier === selectedTier) : runs;

  const TOP_TABS: { id: TopTab; label: string; color: string }[] = [
    { id: "street", label: "Street", color: "#ff6b35" },
    { id: "districts", label: "Districts", color: "#a855f7" },
    { id: "hub", label: "City Hub", color: "#00d4ff" },
    { id: "court", label: "Court", color: "#f59e0b" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <AnimatedCard accent="#ff6b35">
        <CyberSectionHeader
          title="NEW VANTA"
          accent="#ff6b35"
          cursor
          right={
            <div className="font-mono text-xs flex gap-3">
              <span style={{ color: "#f59e0b" }}>{user.dc.toLocaleString()} DC</span>
              <span style={{ color: "#f97316" }}>{(user.dirtyDc ?? 0).toLocaleString()} dirty</span>
            </div>
          }
        />
        <p className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
          {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} — Runs · Districts · Careers · Court
        </p>
      </AnimatedCard>

      {/* Top-level tab bar */}
      <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TOP_TABS.map(t => (
          <motion.button
            key={t.id}
            onClick={() => setTopTab(t.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative flex-shrink-0 px-3 py-1.5 rounded font-mono text-sm font-bold uppercase tracking-wide transition-colors"
            style={{
              background: topTab === t.id ? `${t.color}18` : "transparent",
              color:      topTab === t.id ? t.color : "#475569",
              border:     `1px solid ${topTab === t.id ? t.color + "50" : "#1e1e2e"}`,
            }}
          >
            {t.label}
            {t.id === "court" && isJailed && (
              <span
                className="absolute flex items-center justify-center font-bold"
                style={{ top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#f59e0b", color: "#000", fontSize: 8 }}
              >!</span>
            )}
          </motion.button>
        ))}
      </div>

      {/* STREET TAB */}
      {topTab === "street" && (
        <div className="space-y-4">
          {/* Status bars */}
          <div className="flex gap-4 flex-wrap font-mono text-xs p-3 rounded" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="flex items-center gap-2">
              <span style={{ color: "#475569" }}>HEAT</span>
              <div className="w-24 h-1.5 rounded-full" style={{ background: "#1e1e2e" }}>
                <div className="h-1.5 rounded-full transition-all" style={{
                  width: `${user.heat ?? 0}%`,
                  background: (user.heat ?? 0) >= 80 ? "#ef4444" : (user.heat ?? 0) >= 50 ? "#f97316" : "#eab308",
                }} />
              </div>
              <span style={{ color: (user.heat ?? 0) >= 80 ? "#ef4444" : "#f59e0b" }}>{user.heat ?? 0}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: "#475569" }}>STRESS</span>
              <div className="w-24 h-1.5 rounded-full" style={{ background: "#1e1e2e" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${user.stress ?? 0}%`, background: "#a855f7" }} />
              </div>
              <span style={{ color: "#a855f7" }}>{user.stress ?? 0}%</span>
            </div>
            <span style={{ color: "#475569" }}>Energy: <span style={{ color: "#00d4ff" }}>{user.energy}/{user.maxEnergy}</span></span>
            <span style={{ color: "#475569" }}>Dirty DC: <span style={{ color: "#f97316" }}>{(user.dirtyDc ?? 0).toLocaleString()}</span></span>
          </div>

          {/* Pursuit overlay */}
          {pursuit && (
            <AnimatedCard accent="#ff2d55">
              <p className="font-mono font-bold mb-3" style={{ color: "#ff2d55" }}>PURSUIT ACTIVE — Resolve before next run</p>
              <div className="flex gap-2 flex-wrap">
                <CyberButton variant="warning" size="sm" onClick={() => resolvePursuit("bribe")}>
                  Bribe ({Math.floor((user.heat ?? 0) * 500).toLocaleString()} DC)
                </CyberButton>
                <CyberButton variant="primary" size="sm" onClick={() => resolvePursuit("outrun")}>Outrun</CyberButton>
                <CyberButton variant="ghost"   size="sm" onClick={() => resolvePursuit("busted")}>Surrender</CyberButton>
              </div>
            </AnimatedCard>
          )}

          {/* Status banners */}
          {isJailed && (() => {
            const releaseTime = new Date(user.jailUntil!);
            const remainMs = releaseTime.getTime() - Date.now();
            const remainMin = Math.ceil(remainMs / 60000);
            const escapeChancePct = Math.round((0.20 + ((user.streetCred ?? 1) / 20) * 0.01) * 100);
            const bribeCost = Math.pow(user.wantedLevel, 2) * 1_000 + Math.floor((user.heat ?? 0) * 200);
            return (
              <div className="p-4 rounded space-y-3" style={{ background: "#f59e0b0d", border: "1px solid #f59e0b40" }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono font-bold text-sm" style={{ color: "#f59e0b" }}>INCARCERATED</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                      Release: {releaseTime.toLocaleTimeString()} ({remainMin} min)
                      {user.wantedLevel >= 2 && <span style={{ color: "#ff2d55" }}> — WANTED x{user.wantedLevel}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setTopTab("court")}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ color: "#94a3b8", border: "1px solid #1e1e2e" }}
                  >
                    Court
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <CyberButton variant="success" size="sm" onClick={doEscape}>
                    Escape ({escapeChancePct}% chance) · Risk +10 min
                  </CyberButton>
                  <CyberButton variant="warning" size="sm" onClick={doBribe}>
                    Bribe Guard ({bribeCost.toLocaleString()} DC)
                  </CyberButton>
                </div>
              </div>
            );
          })()}
          {isHospitalized && (
            <div className="p-4 rounded" style={{ background: "#ff2d5510", border: "1px solid #ff2d5540" }}>
              <div className="font-mono font-bold text-sm" style={{ color: "#ff2d55" }}>HOSPITALIZED</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                Discharge: {new Date(user.hospitalizedUntil!).toLocaleTimeString()} — visit Hospital to pay for early release
              </div>
            </div>
          )}

          {/* Street message */}
          {streetMsg && (
            <div className="px-4 py-3 rounded font-mono text-sm" style={{
              background: streetMsg.type === "success" ? "#39d35318" : streetMsg.type === "warn" ? "#f59e0b18" : "#ff2d5518",
              border: `1px solid ${streetMsg.type === "success" ? "#39d35340" : streetMsg.type === "warn" ? "#f59e0b40" : "#ff2d5540"}`,
              color: streetMsg.type === "success" ? "#39d353" : streetMsg.type === "warn" ? "#f59e0b" : "#ff2d55",
            }}>
              {streetMsg.text}
            </div>
          )}

          {/* Street sub-tabs */}
          <div className="flex gap-1.5">
            {(["runs", "jail", "launder"] as const).map(t => (
              <CyberButton
                key={t}
                size="sm"
                variant={streetTab === t ? "warning" : "ghost"}
                glow={streetTab === t}
                onClick={() => setStreetTab(t)}
              >
                {t === "runs" ? "Runs" : t === "jail" ? "Jail List" : "Launder"}
              </CyberButton>
            ))}
          </div>

          {streetTab === "runs" && (
            <>
              <div className="flex gap-1.5 flex-wrap">
                <motion.button
                  onClick={() => setSelectedTier(null)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="font-mono text-xs px-3 py-1 rounded font-bold"
                  style={{
                    background: !selectedTier ? "#e2e8f018" : "transparent",
                    color: !selectedTier ? "#e2e8f0" : "#64748b",
                    border: `1px solid ${!selectedTier ? "#e2e8f040" : "#1e1e2e"}`,
                  }}
                >
                  All Tiers
                </motion.button>
                {[1, 2, 3, 4, 5].map(tier => {
                  const TIER_HEX: Record<number, string> = { 1: "#64748b", 2: "#3b82f6", 3: "#eab308", 4: "#f97316", 5: "#ef4444" };
                  const tc = TIER_HEX[tier] ?? "#64748b";
                  const active = selectedTier === tier;
                  return (
                    <motion.button
                      key={tier}
                      onClick={() => setSelectedTier(active ? null : tier)}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="font-mono text-xs px-3 py-1 rounded font-bold"
                      style={{
                        background: active ? tc + "20" : "transparent",
                        color: active ? tc : "#64748b",
                        border: `1px solid ${active ? tc + "50" : "#1e1e2e"}`,
                      }}
                    >
                      T{tier} {RUN_TIER_LABELS[tier]}
                    </motion.button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredRuns.map(run => {
                  const canRun = !isJailed && !isHospitalized && !pursuit && user.energy >= run.energyCost && user.level >= run.minLevel;
                  const m = mastery[run.id] ?? 0;
                  return (
                    <div key={run.id} className={`rounded-xl p-4 space-y-3 border ${RUN_TIER_COLORS[run.tier]}`} style={{ background: "#111118" }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold" style={{ color: "#64748b" }}>T{run.tier}</span>
                            <span className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{run.name}</span>
                          </div>
                          <p className="font-mono text-xs mt-0.5" style={{ color: "#475569" }}>{run.description}</p>
                        </div>
                        <span className={`font-mono text-xs font-bold ${RISK_COLORS[run.riskLevel]}`}>{run.riskLevel.toUpperCase()}</span>
                      </div>

                      <div>
                        <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#475569" }}>
                          <span>Mastery</span><span>{m.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "#1e1e2e" }}>
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, m)}%`, background: "#00d4ff" }} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 font-mono text-xs" style={{ color: "#64748b" }}>
                        <span style={{ color: "#00d4ff" }}>{run.energyCost} NRG</span>
                        <span style={{ color: "#ff2d55" }}>+{run.heatGain} HEAT</span>
                        <span>{(run.baseSuccess * 100).toFixed(0)}% BASE</span>
                        <span style={{ color: "#f59e0b" }}>{run.dcRange[0].toLocaleString()}–{run.dcRange[1].toLocaleString()} DC</span>
                        <span style={{ color: "#a855f7" }}>{run.relevantStat.toUpperCase()}</span>
                      </div>
                      {user.level < run.minLevel && (
                        <p className="font-mono text-xs" style={{ color: "#ff2d55" }}>Requires level {run.minLevel}</p>
                      )}

                      <CyberButton
                        variant="warning"
                        className="w-full"
                        disabled={!canRun}
                        loading={streetLoading}
                        onClick={() => doRun(run)}
                      >
                        Execute Run
                      </CyberButton>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {streetTab === "jail" && (
            <div className="space-y-2">
              <p className="font-mono text-xs" style={{ color: "#64748b" }}>Players in jail. Pay their bail to free them.</p>
              {jailList.length === 0 && <p className="font-mono text-xs text-center py-8" style={{ color: "#1e1e2e" }}>Nobody's locked up right now.</p>}
              {jailList.map(p => {
                const remainingMin = Math.ceil((new Date(p.jailUntil).getTime() - Date.now()) / 60000);
                const bailCost = Math.floor(remainingMin * 1_000 * 1.5);
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                    <div>
                      <p className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{p.username} <span style={{ color: "#64748b", fontSize: 11 }}>Lv{p.level}</span></p>
                      <p className="font-mono text-xs" style={{ color: "#64748b" }}>{remainingMin} min remaining</p>
                    </div>
                    <button onClick={() => doBailout(p.id)}
                      className="px-3 py-1.5 rounded font-mono text-xs font-bold"
                      style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                      Bail ({bailCost.toLocaleString()} DC)
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {streetTab === "launder" && (
            <div className="p-6 rounded-xl space-y-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <h2 className="font-mono font-bold" style={{ color: "#39d353" }}>Launder Dirty DC</h2>
              <p className="font-mono text-xs" style={{ color: "#64748b" }}>Convert dirty DC to clean DC via your businesses. Loss rate varies by business type and level.</p>
              <div className="p-3 rounded font-mono text-sm space-y-1" style={{ background: "#0a0a0f" }}>
                <p style={{ color: "#94a3b8" }}>Dirty DC: <span style={{ color: "#f97316", fontWeight: "bold" }}>{(user.dirtyDc ?? 0).toLocaleString()}</span></p>
                <p style={{ color: "#94a3b8" }}>Clean DC: <span style={{ color: "#39d353", fontWeight: "bold" }}>{user.dc.toLocaleString()}</span></p>
              </div>
              {(user as any).businesses?.length === 0 ? (
                <p className="font-mono text-xs" style={{ color: "#475569" }}>Need a business (City Hub → Businesses) to launder money.</p>
              ) : (
                <div className="flex gap-2">
                  <input type="number" value={streetLaunderAmount} onChange={e => setStreetLaunderAmount(e.target.value)}
                    placeholder="Amount to launder"
                    className="flex-1 px-3 py-2 rounded font-mono text-sm focus:outline-none"
                    style={{ background: "#1e1e2e", border: "1px solid #2d2d3e", color: "#e2e8f0" }} />
                  <button onClick={doStreetLaunder}
                    className="px-4 py-2 rounded font-mono text-sm font-bold"
                    style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>
                    Launder
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DISTRICTS TAB */}
      {topTab === "districts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-mono font-bold" style={{ color: "#a855f7" }}>Districts of New Vanta</h2>
            <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>
              Currently: <strong style={{ color: "#00d4ff" }}>
                {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </strong>
            </span>
          </div>

          {user.status === "abroad" ? (
            <div className="rounded-lg p-6 text-center space-y-3" style={{ background: "#111118", border: "1px solid #00d4ff40" }}>
              <div className="font-mono font-bold" style={{ color: "#00d4ff" }}>🌍 You are abroad in {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
              <p className="font-mono text-xs" style={{ color: "#64748b" }}>You must return to Downtown before traveling to another district.</p>
              <CyberButton variant="primary" size="md" loading={traveling === "__return_home__"} disabled={!!traveling} onClick={returnHome}>
                Return to Downtown
              </CyberButton>
            </div>
          ) : (
          <div className="grid gap-3">
            {districts.map(d => {
              const isCurrent = d.id === user.district;
              const canTravel = user.level >= d.minLevel;
              return (
                <div key={d.id} className="rounded-lg p-4" style={{
                  background: "#111118",
                  border: `1px solid ${isCurrent ? d.color + "40" : "#1e1e2e"}`,
                  boxShadow: isCurrent ? `0 0 12px ${d.color}10` : "none",
                }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="font-mono font-bold" style={{ color: isCurrent ? d.color : "#e2e8f0" }}>{d.name}</span>
                        {isCurrent && (
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: d.color + "20", color: d.color }}>HERE</span>
                        )}
                      </div>
                      <p className="font-mono text-xs mb-3" style={{ color: "#475569" }}>{d.description}</p>
                      <div className="flex gap-4 font-mono text-xs flex-wrap">
                        <span>Danger: <span style={{ color: DANGER_COLORS[d.dangerLevel] }}>{DANGER_LABELS[d.dangerLevel]}</span></span>
                        <span style={{ color: "#94a3b8" }}>Min Lv.{d.minLevel}</span>
                        {d.npcs?.length > 0 && <span style={{ color: "#475569" }}>NPCs: {d.npcs.join(", ")}</span>}
                      </div>
                    </div>
                    {!isCurrent && (
                      <CyberButton
                        size="sm"
                        variant={canTravel ? "primary" : "ghost"}
                        loading={traveling === d.id}
                        disabled={!canTravel || (!!traveling && traveling !== d.id)}
                        className="flex-shrink-0"
                        onClick={() => travel(d.id)}
                      >
                        {canTravel ? "Travel" : `Lv.${d.minLevel}`}
                      </CyberButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* HUB TAB */}
      {topTab === "hub" && (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {(["careers", "businesses"] as const).map(t => (
              <CyberButton
                key={t}
                size="sm"
                variant={hubTab === t ? "primary" : "ghost"}
                glow={hubTab === t}
                className="capitalize"
                onClick={() => setHubTab(t)}
              >
                {t}
              </CyberButton>
            ))}
          </div>

          {hubMsg && (
            <div className="px-4 py-3 rounded font-mono text-sm" style={{
              background: hubMsg.type === "success" ? "#39d35318" : "#ff2d5518",
              border: `1px solid ${hubMsg.type === "success" ? "#39d35340" : "#ff2d5540"}`,
              color: hubMsg.type === "success" ? "#39d353" : "#ff2d55",
            }}>
              {hubMsg.text}
            </div>
          )}

          {hubTab === "careers" && (
            <div className="space-y-3">
              <p className="font-mono text-xs" style={{ color: "#64748b" }}>Work shifts for clean DC. Each shift costs energy.</p>
              {careers.map(c => (
                <div key={c.id} className={`rounded-xl p-4 space-y-2 border ${CITY_TIER_COLORS[c.tier] ?? "border-zinc-700"}`} style={{ background: "#111118" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{c.name}</p>
                      <p className="font-mono text-xs" style={{ color: "#64748b" }}>{c.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm" style={{ color: "#39d353" }}>{c.salaryPerShift.toLocaleString()} DC</span>
                      <p className="font-mono text-xs" style={{ color: "#64748b" }}>per shift</p>
                    </div>
                  </div>
                  <div className="flex gap-3 font-mono text-xs" style={{ color: "#64748b" }}>
                    <span style={{ color: "#00d4ff" }}>{c.energyCost} NRG</span>
                    {Object.entries(c.statGain).map(([s, g]) => <span key={s}>+{g} {s}</span>)}
                    {!c.available && <span style={{ color: "#ff2d55" }}>Lv{c.tier * 5} req</span>}
                  </div>
                  <CyberButton
                    variant="primary"
                    className="w-full"
                    disabled={!c.available || user.energy < c.energyCost}
                    loading={hubLoading}
                    onClick={() => doWork(c.id)}
                  >
                    Work Shift
                  </CyberButton>
                </div>
              ))}
            </div>
          )}

          {hubTab === "businesses" && (
            <div className="space-y-4">
              {businesses.map(biz => (
                <div key={biz.id} className="rounded-xl p-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{biz.name}</p>
                      <p className="font-mono text-xs capitalize" style={{ color: "#64748b" }}>{biz.type.replace(/_/g, " ")} — Lv.{biz.level}</p>
                    </div>
                    <div className="text-right font-mono text-xs" style={{ color: "#64748b" }}>
                      <p>+{biz.dailyIncome.toLocaleString()} DC/day</p>
                      <p>Launder loss: {Math.round(biz.launderRate * 100)}%</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <CyberButton size="sm" variant="success" onClick={() => collectBiz(biz.id)}>
                      Collect {(biz.pendingCollection ?? 0).toLocaleString()} DC
                    </CyberButton>
                    <CyberButton size="sm" variant="primary" disabled={biz.level >= biz.maxLevel} onClick={() => upgradeBiz(biz.id)}>
                      Upgrade ({biz.upgradeCost.toLocaleString()} DC)
                    </CyberButton>
                    <CyberButton size="sm" variant="ghost" onClick={() => setLaunderBizId(prev => prev === biz.id ? "" : biz.id)}>
                      Launder
                    </CyberButton>
                  </div>
                  {launderBizId === biz.id && (
                    <div className="flex gap-2">
                      <input type="number" value={launderAmount} onChange={e => setLaunderAmount(e.target.value)}
                        placeholder="Dirty DC amount"
                        className="flex-1 px-3 py-2 rounded font-mono text-sm focus:outline-none"
                        style={{ background: "#0a0a0f", border: "1px solid #2d2d3e", color: "#e2e8f0" }} />
                      <CyberButton size="sm" variant="success" onClick={launderBiz}>Go</CyberButton>
                    </div>
                  )}
                </div>
              ))}

              {businesses.length < 3 && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "#111118", border: "1px dashed #1e1e2e" }}>
                  <h3 className="font-mono font-bold" style={{ color: "#94a3b8" }}>Open a New Business</h3>
                  <select value={buyBizType} onChange={e => setBuyBizType(e.target.value)}
                    className="w-full px-3 py-2 rounded font-mono text-sm focus:outline-none"
                    style={{ background: "#0a0a0f", border: "1px solid #2d2d3e", color: "#e2e8f0" }}>
                    <option value="">Select type…</option>
                    {catalog.map(c => <option key={c.type} value={c.type}>{c.name} — {c.purchaseCost.toLocaleString()} DC</option>)}
                  </select>
                  {buyBizType && (
                    <>
                      <input value={buyBizName} onChange={e => setBuyBizName(e.target.value)} placeholder="Business name (optional)"
                        className="w-full px-3 py-2 rounded font-mono text-sm focus:outline-none"
                        style={{ background: "#0a0a0f", border: "1px solid #2d2d3e", color: "#e2e8f0" }} />
                      {catalog.filter(c => c.type === buyBizType).map(c => (
                        <div key={c.type} className="font-mono text-xs space-y-0.5" style={{ color: "#64748b" }}>
                          <p>{c.dailyIncome.toLocaleString()} DC/day income</p>
                          <p>{c.launderCapacity.toLocaleString()} dirty DC/day launder cap</p>
                          <p>Max holding: {c.maxHolding.toLocaleString()} DC</p>
                        </div>
                      ))}
                      <CyberButton
                        variant="primary"
                        className="w-full"
                        loading={hubLoading}
                        disabled={user.dc < (catalog.find(c => c.type === buyBizType)?.purchaseCost ?? Infinity)}
                        onClick={buyBusiness}
                      >
                        Open Business
                      </CyberButton>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COURT TAB */}
      {topTab === "court" && (
        <div className="space-y-4">
          {hubMsg && (
            <div className="px-4 py-3 rounded font-mono text-sm" style={{
              background: hubMsg.type === "success" ? "#39d35318" : "#ff2d5518",
              border: `1px solid ${hubMsg.type === "success" ? "#39d35340" : "#ff2d5540"}`,
              color: hubMsg.type === "success" ? "#39d353" : "#ff2d55",
            }}>
              {hubMsg.text}
            </div>
          )}
          {courtInfo?.inJail ? (
            <div className="p-5 rounded-xl space-y-4" style={{ background: "#111118", border: "1px solid #f59e0b40" }}>
              <h2 className="font-mono font-bold text-lg" style={{ color: "#f59e0b" }}>Facing Charges</h2>
              <p className="font-mono text-sm" style={{ color: "#94a3b8" }}>
                Sentence remaining: <span style={{ color: "#e2e8f0", fontWeight: "bold" }}>{Math.ceil(courtInfo.remainingMs / 60000)} minutes</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl space-y-3" style={{ background: "#0a0a0f", border: "1px solid #39d35340" }}>
                  <h3 className="font-mono font-bold" style={{ color: "#39d353" }}>Plead Guilty</h3>
                  <p className="font-mono text-xs" style={{ color: "#64748b" }}>{COURT_TEXT.plead}</p>
                  <p className="font-mono text-xs" style={{ color: "#475569" }}>New sentence: {Math.ceil(courtInfo.options?.plead?.newDuration / 60000)} min</p>
                  <CyberButton variant="success" className="w-full" onClick={doPlead}>Plead Guilty</CyberButton>
                </div>
                <div className="p-4 rounded-xl space-y-3" style={{ background: "#0a0a0f", border: "1px solid #ff2d5540" }}>
                  <h3 className="font-mono font-bold" style={{ color: "#ff2d55" }}>Fight Charges</h3>
                  <p className="font-mono text-xs" style={{ color: "#64748b" }}>{COURT_TEXT.fight}</p>
                  <p className="font-mono text-xs" style={{ color: "#475569" }}>Success: {Math.round((courtInfo.options?.fight?.chance ?? 0) * 100)}% (based on INT)</p>
                  <CyberButton variant="danger" className="w-full" onClick={doFight}>Fight the Charges</CyberButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 font-mono" style={{ color: "#475569" }}>
              No pending charges. Stay out of trouble.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
