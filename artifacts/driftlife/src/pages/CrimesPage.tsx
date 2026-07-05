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
        addToast("HEAT CRITICAL — resolve the pursuit event first!", "warning");
        await refreshUser();
        return;
      }
      if (data.success) {
        addToast(`${crimes.find(c => c.id === crimeId)?.name} — success! +${data.dcGained} DC`, "success");
      } else {
        addToast(data.hospitalized ? "Hospitalized!" : "Failed. No DC.", data.hospitalized ? "error" : "warning");
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

  // Derive ActionResult props from lastResult
  const resultVisible = !!(lastResult && !lastResult.pursuitRequired);
  const resultType = lastResult?.success ? "success" : lastResult?.hospitalized ? "fail" : "fail";
  const resultTitle = lastResult?.success
    ? `SUCCESS — +${formatDC(lastResult.dcGained)} DC`
    : lastResult?.hospitalized ? "HOSPITALIZED" : "FAILED";
  const resultDetail = lastResult?.narrative;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* PURSUIT MODAL */}
      <AnimatePresence>
        {user.pursuiteActive && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="w-full max-w-sm rounded-xl p-6 space-y-5"
              style={{ background: "#111118", border: "2px solid #ff6b35", boxShadow: "0 0 50px #ff6b3540, inset 0 0 30px #ff6b3508" }}
            >
              <div className="text-center space-y-1">
                <div className="font-mono text-2xl font-black tracking-widest animate-electric" style={{ color: "#ff6b35" }}>
                  ⚡ PURSUIT ⚡
                </div>
                <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                  Heat critical — {user.heat}/100 — sirens closing in
                </div>
              </div>

              <NeonProgressBar value={user.heat} max={100} color="#ff6b35" showValues={false} height={8} />

              <p className="font-mono text-xs text-center" style={{ color: "#64748b" }}>Choose your move. This cannot be skipped.</p>

              <div className="space-y-3">
                <CyberButton
                  variant="warning"
                  size="md"
                  className="w-full flex-col h-auto py-3"
                  disabled={pursuiting || user.dc < pursuitBribeCost}
                  onClick={() => resolvePursuit("bribe")}
                >
                  <div className="font-bold">💰 BRIBE</div>
                  <div className="text-xs opacity-70 font-normal mt-0.5">
                    {user.dc >= pursuitBribeCost
                      ? `Pay ${pursuitBribeCost.toLocaleString()} DC → heat resets to 40`
                      : `Need ${pursuitBribeCost.toLocaleString()} DC (you have ${user.dc.toLocaleString()})`}
                  </div>
                </CyberButton>

                <CyberButton
                  variant="primary"
                  size="md"
                  className="w-full flex-col h-auto py-3"
                  disabled={pursuiting}
                  onClick={() => resolvePursuit("outrun")}
                >
                  <div className="font-bold">🏎 OUTRUN</div>
                  <div className="text-xs opacity-70 font-normal mt-0.5">Use your car — success depends on power + handling. Heat → 20 if clean.</div>
                </CyberButton>

                <CyberButton
                  variant="danger"
                  size="md"
                  className="w-full flex-col h-auto py-3"
                  disabled={pursuiting}
                  onClick={() => resolvePursuit("busted")}
                >
                  <div className="font-bold">🙅 GIVE UP — BUSTED</div>
                  <div className="text-xs opacity-70 font-normal mt-0.5">Hands on hood. 20 min in holding. Heat → 0.</div>
                </CyberButton>
              </div>

              {pursuiting && (
                <div className="font-mono text-xs text-center animate-pulse" style={{ color: "#64748b" }}>Resolving...</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center">
        <CyberSectionHeader title="Crime Board" accent="#ff2d55" size="lg" className="mb-0 flex-1" />
        <div className="flex gap-4 font-mono text-xs">
          <span style={{ color: "#ff6b35" }}>Nerve: <strong style={{ color: "#e2e8f0" }}>{user.nerve}/{user.maxNerve}</strong></span>
          <span style={{ color: "#64748b" }}>Lv.<strong style={{ color: "#e2e8f0" }}>{user.level}</strong></span>
        </div>
      </div>

      {/* Status alerts */}
      {(isHosp || isJailed) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded font-mono text-xs"
          style={{
            background: isHosp ? "#ff2d5510" : "#f59e0b10",
            border: `1px solid ${isHosp ? "#ff2d5540" : "#f59e0b40"}`,
            color: isHosp ? "#ff2d55" : "#f59e0b",
          }}
        >
          {isHosp ? "You are hospitalized. Visit the hospital to recover early." : "You are in jail. Wait for release or bribe your way out."}
        </motion.div>
      )}

      {/* Wanted level banner */}
      {user.wantedLevel > 0 && (
        <AnimatedCard accent="#ff6b35">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-mono text-xs font-bold mb-0.5" style={{ color: "#ff6b35" }}>
                WANTED LEVEL {user.wantedLevel} {"★".repeat(Math.min(5, user.wantedLevel))}
              </div>
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                Bribe Chief Ralston to clear your record — costs {formatDC(bribeCost)} DC
              </div>
            </div>
            <CyberButton
              variant="warning"
              size="sm"
              loading={bribing}
              disabled={bribing || user.dc < bribeCost}
              onClick={bribe}
            >
              Bribe ({formatDC(bribeCost)} DC)
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* Crime list */}
      <div className="space-y-2">
        {crimes.map((crime, idx) => {
          const meetsLevel = user.level >= crime.minLevel;
          const canAfford = user.nerve >= crime.nerveCost;
          const available = meetsLevel && canAfford && !isHosp && !isJailed;
          const rc = RISK_COLOR[crime.riskLevel] || "#94a3b8";
          const isExpanded = expanded === crime.id;

          return (
            <motion.div
              key={crime.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{ opacity: meetsLevel ? 1 : 0.45 }}
            >
              <AnimatedCard accent={rc} noPad>
                <div className="flex items-center gap-0 p-3">
                  {/* Risk bar */}
                  <div style={{ width: 4, alignSelf: "stretch", borderRadius: "2px 0 0 2px", background: rc, boxShadow: `0 0 6px ${rc}80`, flexShrink: 0, marginLeft: -1 }} />

                  <div className="flex-1 min-w-0 cursor-pointer px-3" onClick={() => setExpanded(isExpanded ? null : crime.id)}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{crime.name}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: `${rc}18`, color: rc, border: `1px solid ${rc}30` }}>
                        {crime.riskLevel.toUpperCase()}
                      </span>
                      {!meetsLevel && <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>Lv.{crime.minLevel}</span>}
                    </div>
                    <div className="flex gap-3 font-mono text-xs flex-wrap">
                      <span style={{ color: "#ff6b35" }}>Nerve: {crime.nerveCost}</span>
                      <span style={{ color: "#f59e0b" }}>{formatDC(crime.dcRange[0])}–{formatDC(crime.dcRange[1])} DC</span>
                      <span style={{ color: "#a855f7" }}>+{crime.xp} XP</span>
                      <span style={{ color: "#64748b" }}>{Math.round(crime.baseSuccess * 100)}% success</span>
                    </div>
                  </div>

                  <CyberButton
                    variant="danger"
                    size="sm"
                    loading={committing === crime.id}
                    disabled={!available || committing !== null}
                    onClick={() => commit(crime.id)}
                    className="flex-shrink-0 mr-3"
                  >
                    Execute
                  </CyberButton>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 pt-2" style={{ borderTop: `1px solid ${rc}20` }}>
                        <p className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>{crime.description}</p>
                        <div className="flex gap-4 font-mono text-xs flex-wrap">
                          <span style={{ color: "#ff2d55" }}>Hospital risk: {Math.round(crime.hospitalRisk * 100)}%</span>
                          <span style={{ color: "#f59e0b" }}>Wanted: +{crime.wantedIncrease}</span>
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

      {/* Action result — slides up from bottom */}
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
