import { useState, useEffect } from "react";
import { User, Crime } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const RISK_COLOR: Record<string, string> = { low: "#39d353", medium: "#f59e0b", high: "#ff6b35", extreme: "#ff2d55" };

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

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* PURSUIT MODAL — blocks until resolved when heat >= 80 triggers it */}
      {user.pursuiteActive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-sm rounded-xl p-6 space-y-5" style={{ background: "#111118", border: "2px solid #ff6b35", boxShadow: "0 0 40px #ff6b3540" }}>
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="font-mono text-2xl font-black tracking-widest" style={{ color: "#ff6b35" }}>
                ⚡ PURSUIT ⚡
              </div>
              <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                Heat critical — {user.heat}/100 — sirens closing in
              </div>
            </div>

            {/* Heat bar */}
            <div className="space-y-1">
              <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
                <div className="h-2 rounded-full" style={{ width: `${user.heat}%`, background: "#ff6b35", boxShadow: "0 0 10px #ff6b3580" }} />
              </div>
            </div>

            <p className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
              Choose your move. This cannot be skipped.
            </p>

            <div className="space-y-3">
              {/* Bribe */}
              <button
                onClick={() => resolvePursuit("bribe")}
                disabled={pursuiting || user.dc < pursuitBribeCost}
                className="w-full rounded-lg p-3 font-mono text-sm transition-all"
                style={{
                  background: user.dc >= pursuitBribeCost ? "#f59e0b18" : "#1e1e2e",
                  border: `1px solid ${user.dc >= pursuitBribeCost ? "#f59e0b60" : "#334155"}`,
                  color: user.dc >= pursuitBribeCost ? "#f59e0b" : "#475569",
                  cursor: user.dc >= pursuitBribeCost && !pursuiting ? "pointer" : "not-allowed",
                }}
              >
                <div className="font-bold">💰 BRIBE</div>
                <div className="text-xs opacity-70">
                  {user.dc >= pursuitBribeCost
                    ? `Pay ${pursuitBribeCost.toLocaleString()} DC → heat resets to 40`
                    : `Need ${pursuitBribeCost.toLocaleString()} DC (you have ${user.dc.toLocaleString()})`}
                </div>
              </button>

              {/* Outrun */}
              <button
                onClick={() => resolvePursuit("outrun")}
                disabled={pursuiting}
                className="w-full rounded-lg p-3 font-mono text-sm transition-all"
                style={{
                  background: "#00d4ff18",
                  border: "1px solid #00d4ff60",
                  color: "#00d4ff",
                  cursor: pursuiting ? "not-allowed" : "pointer",
                }}
              >
                <div className="font-bold">🏎️ OUTRUN</div>
                <div className="text-xs opacity-70">
                  Use your car — success depends on power + handling. Heat → 20 if clean.
                </div>
              </button>

              {/* Give up / Busted */}
              <button
                onClick={() => resolvePursuit("busted")}
                disabled={pursuiting}
                className="w-full rounded-lg p-3 font-mono text-sm transition-all"
                style={{
                  background: "#ff2d5512",
                  border: "1px solid #ff2d5540",
                  color: "#ff2d55",
                  cursor: pursuiting ? "not-allowed" : "pointer",
                }}
              >
                <div className="font-bold">🙅 GIVE UP — BUSTED</div>
                <div className="text-xs opacity-70">
                  Hands on hood. 20 min in holding. Heat → 0.
                </div>
              </button>
            </div>

            {pursuiting && (
              <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
                Resolving...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg" style={{ color: "#ff2d55" }}>CRIME BOARD</h2>
        <div className="flex gap-4 font-mono text-xs">
          <span style={{ color: "#ff6b35" }}>Nerve: <strong style={{ color: "#e2e8f0" }}>{user.nerve}/{user.maxNerve}</strong></span>
          <span style={{ color: "#64748b" }}>Level: <strong style={{ color: "#e2e8f0" }}>{user.level}</strong></span>
        </div>
      </div>

      {(isHosp || isJailed) && (
        <div className="p-3 rounded font-mono text-xs" style={{
          background: isHosp ? "#ff2d5510" : "#f59e0b10",
          border: `1px solid ${isHosp ? "#ff2d5540" : "#f59e0b40"}`,
          color: isHosp ? "#ff2d55" : "#f59e0b",
        }}>
          {isHosp ? "You are hospitalized. Visit the hospital to recover early." : "You are in jail. Wait for release or bribe your way out."}
        </div>
      )}

      {user.wantedLevel > 0 && (
        <div className="p-3 rounded font-mono" style={{ background: "#ff6b3510", border: "1px solid #ff6b3540" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-bold mb-0.5" style={{ color: "#ff6b35" }}>
                WANTED LEVEL {user.wantedLevel} {"★".repeat(Math.min(5, user.wantedLevel))}
              </div>
              <div className="text-xs" style={{ color: "#64748b" }}>
                Bribe Chief Ralston to clear your record — costs {formatDC(bribeCost)} DC
              </div>
            </div>
            <button
              onClick={bribe}
              disabled={bribing || user.dc < bribeCost}
              className="px-3 py-1.5 rounded font-mono text-xs font-bold"
              style={{
                background: user.dc >= bribeCost ? "#f59e0b18" : "#1e1e2e",
                color: user.dc >= bribeCost ? "#f59e0b" : "#475569",
                border: `1px solid ${user.dc >= bribeCost ? "#f59e0b40" : "#1e1e2e"}`,
              }}
            >
              {bribing ? "..." : `Bribe (${formatDC(bribeCost)} DC)`}
            </button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="p-4 rounded font-mono" style={{
          background: lastResult.success ? "#39d35310" : "#ff2d5510",
          border: `1px solid ${lastResult.success ? "#39d35340" : "#ff2d5540"}`,
        }}>
          <div className="font-bold text-sm mb-1" style={{ color: lastResult.success ? "#39d353" : "#ff2d55" }}>
            {lastResult.success ? "SUCCESS" : lastResult.hospitalized ? "HOSPITALIZED" : "FAILED"}
          </div>
          <p className="text-xs mb-2" style={{ color: "#94a3b8", fontStyle: "italic" }}>{lastResult.narrative}</p>
          <div className="flex gap-4 text-xs flex-wrap">
            {lastResult.dcGained > 0 && <span style={{ color: "#f59e0b" }}>+{formatDC(lastResult.dcGained)} DC</span>}
            {lastResult.xpGained > 0 && <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>}
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{lastResult.newLevel}</span>}
            {lastResult.hospitalized && <span style={{ color: "#ff2d55" }}>Hospitalized</span>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {crimes.map(crime => {
          const meetsLevel = user.level >= crime.minLevel;
          const canAfford = user.nerve >= crime.nerveCost;
          const available = meetsLevel && canAfford && !isHosp && !isJailed;
          const rc = RISK_COLOR[crime.riskLevel] || "#94a3b8";
          const isExpanded = expanded === crime.id;

          return (
            <div key={crime.id} style={{
              background: "#111118",
              border: `1px solid ${isExpanded ? rc + "50" : "#1e1e2e"}`,
              borderRadius: 8,
              opacity: meetsLevel ? 1 : 0.5,
            }}>
              <div className="flex items-center gap-3 p-3">
                <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: rc, flexShrink: 0 }} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : crime.id)}>
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{crime.name}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: rc + "20", color: rc }}>
                      {crime.riskLevel.toUpperCase()}
                    </span>
                    {!meetsLevel && (
                      <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>Lv.{crime.minLevel}</span>
                    )}
                  </div>
                  <div className="flex gap-3 font-mono text-xs flex-wrap">
                    <span style={{ color: "#ff6b35" }}>Nerve: {crime.nerveCost}</span>
                    <span style={{ color: "#f59e0b" }}>{formatDC(crime.dcRange[0])}–{formatDC(crime.dcRange[1])} DC</span>
                    <span style={{ color: "#a855f7" }}>+{crime.xp} XP</span>
                    <span style={{ color: "#64748b" }}>{Math.round(crime.baseSuccess * 100)}% success</span>
                  </div>
                </div>
                <button
                  onClick={() => commit(crime.id)}
                  disabled={!available || committing !== null}
                  className="px-3 py-1.5 rounded font-mono text-xs font-bold uppercase flex-shrink-0 transition-all"
                  style={{
                    background: available ? "#ff2d5518" : "#1e1e2e",
                    color: available ? "#ff2d55" : "#475569",
                    border: `1px solid ${available ? "#ff2d5540" : "#1e1e2e"}`,
                  }}
                >
                  {committing === crime.id ? "..." : "Execute"}
                </button>
              </div>

              {isExpanded && (
                <div className="px-4 pb-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                  <p className="font-mono text-xs mt-2 mb-2" style={{ color: "#64748b" }}>{crime.description}</p>
                  <div className="flex gap-4 font-mono text-xs flex-wrap">
                    <span style={{ color: "#ff2d55" }}>Hospital risk: {Math.round(crime.hospitalRisk * 100)}%</span>
                    <span style={{ color: "#f59e0b" }}>Wanted: +{crime.wantedIncrease}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
