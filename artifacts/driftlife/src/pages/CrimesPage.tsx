import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Crime } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { ActionResult } from "../components/ActionResult";
import { NeonProgressBar } from "../components/NeonProgressBar";
import { WantedStars } from "@/components/WantedStars";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RISK_COLOR: Record<string, string> = {
  low: "#39d353", medium: "#f59e0b", high: "#ff6b35", extreme: "#ff2d55",
};

export function CrimesPage({ user, refreshUser, addToast }: Props) {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [committing, setCommitting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bribing, setBribing] = useState(false);
  const [pursuiting, setPursuiting] = useState(false);

  useEffect(() => {
    api.get<Crime[]>("/crimes").then(setCrimes).catch(() => {});
  }, []);

  async function commit(crimeId: string) {
    setCommitting(crimeId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/crimes/${crimeId}/commit`);
      setLastResult({ ...data, crimeId });
      if (data.pursuitRequired) {
        addToast("HEAT CRITICAL — PURSUIT INITIATED!", "warning");
        await refreshUser();
        return;
      }
      if (data.success) {
        addToast(`DATA ACQUIRED: +${data.dcGained} DC`, "success");
      } else {
        addToast(data.hospitalized ? "SYSTEM SHOCK: HOSPITALIZED" : "OPERATION FAILED", data.hospitalized ? "error" : "warning");
      }
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setCommitting(null);
    }
  }

  async function bribe() {
    setBribing(true);
    try {
      const data = await api.post<any>("/crimes/bribe");
      addToast(data.message, "success");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setBribing(false);
    }
  }

  async function resolvePursuit(outcome: "bribe" | "outrun" | "busted") {
    setPursuiting(true);
    try {
      const data = await api.post<any>("/crimes/pursuit/resolve", { outcome });
      addToast(data.message, outcome === "busted" ? "error" : outcome === "outrun" && data.jailUntil ? "error" : "success");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setPursuiting(false);
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const bribeCost = user.wantedLevel > 0 ? Math.pow(user.wantedLevel, 2) * 1000 : 0;
  const pursuitBribeCost = Math.floor(user.heat * 500);

  const resultVisible = !!(lastResult && !lastResult.pursuitRequired);
  const resultType = lastResult?.success ? "success" : lastResult?.hospitalized ? "fail" : "fail";
  const resultTitle = lastResult?.success
    ? `SUCCESS // +${formatDC(lastResult.dcGained)} DC`
    : lastResult?.hospitalized ? "HOSPITALIZED" : "FAILED";
  const resultDetail = lastResult?.narrative;

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative z-10">
      <div className="dl-page-bg bg-combat" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* PURSUIT MODAL */}
      <AnimatePresence>
        {user.pursuiteActive && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(10,10,15,0.95)", backdropFilter: "blur(10px)" }}
          >
            {/* Flashing scanlines for pursuit */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(255,45,85,0.05)_50%)] bg-[length:100%_4px] mix-blend-overlay animate-pulse" />
            
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md clip-card p-8 space-y-6 relative overflow-hidden"
              style={{ background: "#0d0d14", border: "2px solid #ff2d55", boxShadow: "0 0 50px rgba(255,45,85,0.3), inset 0 0 20px rgba(255,45,85,0.1)" }}
            >
              <div className="text-center space-y-2">
                <div className="font-display text-4xl font-black tracking-widest text-[#ff2d55] glitch-text uppercase drop-shadow-[0_0_15px_#ff2d55]">
                  Pursuit Active
                </div>
                <div className="font-mono text-sm text-[#ff2d55] animate-pulse uppercase tracking-widest">
                  Warning: NCPD Intercept Imminent
                </div>
              </div>

              <div className="bg-[#1a0f12] p-4 clip-bar border border-[#ff2d55]">
                <NeonProgressBar value={user.heat} max={100} color="#ff2d55" label="HEAT LEVEL" height={10} />
              </div>

              <div className="space-y-3">
                <CyberButton
                  variant="warning"
                  size="lg"
                  className="w-full justify-between"
                  disabled={pursuiting || user.dc < pursuitBribeCost}
                  onClick={() => resolvePursuit("bribe")}
                >
                  <span>PAYOFF</span>
                  <span>{formatDC(pursuitBribeCost)} DC</span>
                </CyberButton>

                <CyberButton
                  variant="primary"
                  size="lg"
                  className="w-full justify-between"
                  disabled={pursuiting}
                  onClick={() => resolvePursuit("outrun")}
                >
                  <span>EVADE</span>
                  <span className="opacity-50">USE VEHICLE</span>
                </CyberButton>

                <CyberButton
                  variant="danger"
                  size="lg"
                  className="w-full justify-between"
                  disabled={pursuiting}
                  onClick={() => resolvePursuit("busted")}
                >
                  <span>SURRENDER</span>
                  <span className="opacity-50">JAIL TIME</span>
                </CyberButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-end border-b border-[#1e1e2e] pb-4">
        <CyberSectionHeader title="TARGET SELECTION" accent="#ff2d55" size="lg" className="mb-0" cursor />
        <div className="flex gap-6 font-mono text-sm bg-[#111118] px-4 py-2 clip-bar border border-[#1e1e2e]">
          <span className="text-[#ff6b35]">NRV <strong className="text-white drop-shadow-[0_0_8px_#ff6b35]">{user.nerve}/{user.maxNerve}</strong></span>
          <span className="text-[#00d4ff]">LVL <strong className="text-white drop-shadow-[0_0_8px_#00d4ff]">{user.level}</strong></span>
        </div>
      </div>

      {/* Status alerts */}
      {(isHosp || isJailed) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="p-4 clip-bar font-mono text-sm uppercase tracking-widest text-center"
          style={{
            background: isHosp ? "#ff2d5515" : "#f59e0b15",
            border: `1px solid ${isHosp ? "#ff2d55" : "#f59e0b"}`,
            color: isHosp ? "#ff2d55" : "#f59e0b",
            boxShadow: `0 0 20px ${isHosp ? "#ff2d5530" : "#f59e0b30"}`
          }}
        >
          {isHosp ? "[ ERR: OPERATIVE HOSPITALIZED ]" : "[ ERR: OPERATIVE INCARCERATED ]"}
        </motion.div>
      )}

      {/* Wanted level banner */}
      {user.wantedLevel > 0 && (
        <AnimatedCard accent="#f59e0b" className="animate-pulse-glow">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-display text-xl font-bold mb-1 text-[#f59e0b] uppercase drop-shadow-[0_0_10px_#f59e0b]">
                WANTED LEVEL: <WantedStars level={user.wantedLevel} />
              </div>
              <div className="font-mono text-xs text-[#94a3b8] uppercase">
                Bribe authorities to clear record. Cost: {formatDC(bribeCost)} DC
              </div>
            </div>
            <CyberButton
              variant="warning"
              size="md"
              loading={bribing}
              disabled={bribing || user.dc < bribeCost}
              onClick={bribe}
            >
              BRIBE ({formatDC(bribeCost)})
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* Crime Grid */}
      <div className="grid grid-cols-1 gap-4">
        {crimes.map((crime, idx) => {
          const meetsLevel = user.level >= crime.minLevel;
          const canAfford = user.nerve >= crime.nerveCost;
          const available = meetsLevel && canAfford && !isHosp && !isJailed;
          const rc = RISK_COLOR[crime.riskLevel] || "#00d4ff";
          const isExpanded = expanded === crime.id;

          return (
            <motion.div
              key={crime.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ opacity: meetsLevel ? 1 : 0.5 }}
              className="relative"
            >
              <AnimatedCard accent={rc} noPad className="overflow-visible">
                {/* Left color bar indicator */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 clip-card"
                  style={{ background: rc, boxShadow: `0 0 10px ${rc}` }}
                />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 pl-6">
                  
                  {/* Info block */}
                  <div className="flex-1 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : crime.id)}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-display font-bold text-lg text-white uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                        {crime.name}
                      </span>
                      <span 
                        className="font-mono text-[10px] px-2 py-1 clip-btn font-bold uppercase tracking-widest" 
                        style={{ background: `${rc}20`, color: rc, border: `1px solid ${rc}50` }}
                      >
                        {crime.riskLevel}
                      </span>
                      {!meetsLevel && <span className="font-mono text-xs text-[#ff2d55] ml-auto">REQ LVL {crime.minLevel}</span>}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-wide">
                      <span className="flex items-center gap-2">
                        <span className="text-[#64748b]">NRV</span>
                        <span className="text-[#ff6b35] font-bold">{crime.nerveCost}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[#64748b]">PAY</span>
                        <span className="text-[#f59e0b] font-bold">{formatDC(crime.dcRange[0])}-{formatDC(crime.dcRange[1])}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[#64748b]">EXP</span>
                        <span className="text-[#a855f7] font-bold">+{crime.xp}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[#64748b]">SR</span>
                        <span className="text-[#39d353] font-bold">{Math.round(crime.baseSuccess * 100)}%</span>
                      </span>
                    </div>
                  </div>

                  {/* Action block */}
                  <div className="sm:w-32 flex-shrink-0">
                     <CyberButton
                      variant="danger"
                      size="md"
                      loading={committing === crime.id}
                      disabled={!available || committing !== null}
                      onClick={() => commit(crime.id)}
                      className="w-full h-full min-h-[48px]"
                    >
                      EXECUTE
                    </CyberButton>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-[#0d0d14] border-t border-[#1e1e2e]"
                    >
                      <div className="p-4 pl-6">
                        <p className="font-mono text-sm text-[#94a3b8] mb-4 leading-relaxed uppercase">
                          {crime.description}
                        </p>
                        <div className="flex gap-6 font-mono text-xs uppercase bg-[#111118] p-3 clip-bar border border-[#1e1e2e] inline-flex">
                          <span className="text-[#ff2d55]">HOSPITAL RISK: <strong className="text-white">{Math.round(crime.hospitalRisk * 100)}%</strong></span>
                          <span className="text-[#f59e0b]">HEAT GAIN: <strong className="text-white">+{crime.wantedIncrease}</strong></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </AnimatedCard>
            </motion.div>
          );
        })}
      </div>

      <ActionResult
        visible={resultVisible}
        type={resultType}
        title={resultTitle}
        detail={resultDetail}
        onDismiss={() => setLastResult(null)}
      />
    </div>
  );
}
