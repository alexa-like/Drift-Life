import { useState, useEffect, useCallback } from "react";
import { User, Job } from "../shared/types";
import { api } from "../shared/api";
import { MiniGameModal } from "../components/MiniGameModal";
import { formatDC } from "../shared/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

function Cooldown({ until }: { until: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [until]);
  if (secs === 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return <span style={{ color: "#f59e0b" }}>{m}:{String(s).padStart(2, "0")}</span>;
}

const MINI_GAME_LABELS: Record<string, { label: string; color: string }> = {
  typing:  { label: "TYPING",  color: "#00d4ff" },
  pattern: { label: "PATTERN", color: "#a855f7" },
  timing:  { label: "TIMING",  color: "#f59e0b" },
  rhythm:  { label: "RHYTHM",  color: "#39d353" },
};

export function JobsPage({ user, refreshUser, addToast }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [miniGame, setMiniGame] = useState<{ type: "typing" | "pattern" | "timing" | "rhythm"; token: string } | null>(null);
  const [filterDistrict, setFilterDistrict] = useState<"all" | "here" | "any">("all");

  const loadJobs = useCallback(() => {
    api.get<Job[]>("/jobs").then(setJobs).catch(() => {});
  }, []);

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 30000);
    return () => clearInterval(t);
  }, [loadJobs]);

  async function work(jobId: string) {
    setWorking(jobId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/jobs/${jobId}/work`);
      setLastResult(data);
      addToast(`${jobs.find(j => j.id === jobId)?.name} — +${data.dcGained} DC${data.leveled ? " + LEVEL UP!" : ""}`, "success");
      await refreshUser();
      loadJobs();
      if (data.miniGameTriggered && data.miniGameType && data.miniGameToken) {
        setMiniGame({ type: data.miniGameType, token: data.miniGameToken });
      }
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setWorking(null);
    }
  }

  async function handleMiniGameComplete(multiplier: number) {
    const token = miniGame?.token;
    setMiniGame(null);
    if (multiplier > 1.0 && token) {
      try {
        // Server derives the DC bonus itself from a 0-100 score bound to the
        // session token issued at /work — the client can no longer just POST
        // a raw multiplier for free DC.
        const score = Math.round(((multiplier - 1) / 0.6) * 100);
        const r = await api.post<any>("/jobs/minigame/complete", { token, score });
        if (r.bonus > 0) {
          addToast(`Mini-game bonus: +${r.bonus} DC`, "success");
          await refreshUser();
        }
      } catch { /* ignore */ }
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();

  const filtered = jobs.filter(j => {
    if (filterDistrict === "here") return j.districtMatch;
    if (filterDistrict === "any") return j.district === "any";
    return true;
  });

  const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
  const fc = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg bg-hack" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {miniGame && (
        <MiniGameModal
          type={miniGame.type}
          onComplete={handleMiniGameComplete}
          onSkip={() => setMiniGame(null)}
        />
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-mono font-bold text-lg" style={{ color: "#39d353" }}>JOBS</h2>
        <div className="flex gap-2 items-center font-mono text-xs">
          <span style={{ color: "#00d4ff" }}>Energy: <strong style={{ color: "#e2e8f0" }}>{user.energy}/{user.maxEnergy}</strong></span>
          <span style={{ color: "#64748b" }}>District: <strong style={{ color: "#94a3b8" }}>{user.district.replace(/-/g, " ")}</strong></span>
        </div>
      </div>

      {user.faction && (
        <div className="px-3 py-2 rounded font-mono text-xs" style={{ background: fc + "10", border: `1px solid ${fc}30`, color: fc }}>
          {user.faction === "suits" && "Suits: +10% DC on all jobs"}
          {user.faction === "street" && "Street: Standard job rates"}
          {user.faction === "grid" && "Grid: -10% Energy cost on jobs"}
        </div>
      )}

      {(isHosp || isJailed) && (
        <div className="p-3 rounded font-mono text-xs" style={{
          background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55"
        }}>
          {isHosp ? "Hospitalized — cannot work." : "Jailed — cannot work."}
        </div>
      )}

      {lastResult && (
        <div className="p-3 rounded font-mono" style={{ background: "#39d35310", border: "1px solid #39d35340" }}>
          <div className="font-bold text-sm mb-1" style={{ color: "#39d353" }}>Job Complete</div>
          <div className="flex gap-4 text-xs flex-wrap">
            <span style={{ color: "#f59e0b" }}>+{formatDC(lastResult.dcGained)} DC</span>
            <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{lastResult.newLevel}</span>}
            {lastResult.miniGameTriggered && <span style={{ color: "#a855f7" }}>Mini-game triggered!</span>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {([["all", "All Jobs"], ["here", "Available Here"], ["any", "Any District"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilterDistrict(v)}
            className="font-mono text-xs px-2 py-1 rounded"
            style={{
              background: filterDistrict === v ? "#39d35318" : "transparent",
              color: filterDistrict === v ? "#39d353" : "#64748b",
              border: filterDistrict === v ? "1px solid #39d35340" : "1px solid #1e1e2e",
            }}>
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(job => {
          const canEnergy = user.energy >= job.energyCost;
          const available = job.available && canEnergy && !isHosp && !isJailed;
          const busyThis = working === job.id;
          const mg = MINI_GAME_LABELS[job.miniGame];

          return (
            <div key={job.id} style={{
              background: "#111118",
              border: `1px solid ${available ? "#1e1e2e" : "#0a0a0f"}`,
              borderRadius: 8,
              opacity: job.districtMatch || job.district === "any" ? 1 : 0.45,
            }}>
              <div className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{job.name}</span>
                    {/* Mini-game type badge */}
                    {mg && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{
                        background: mg.color + "15",
                        color: mg.color,
                        border: `1px solid ${mg.color}30`,
                        fontSize: "0.6rem",
                        letterSpacing: "0.05em",
                      }}>
                        {mg.label}
                      </span>
                    )}
                    {!job.districtMatch && job.district !== "any" && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#f59e0b10", color: "#f59e0b" }}>
                        {job.district.replace(/-/g, " ")}
                      </span>
                    )}
                    {user.level < job.minLevel && (
                      <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>Lv.{job.minLevel}</span>
                    )}
                  </div>
                  <p className="font-mono text-xs mb-1" style={{ color: "#475569" }}>{job.description}</p>
                  <div className="flex gap-3 font-mono text-xs flex-wrap">
                    <span style={{ color: "#00d4ff" }}>Energy: {job.energyCost}</span>
                    <span style={{ color: "#f59e0b" }}>{formatDC(job.dcMin)}–{formatDC(job.dcMax)} DC</span>
                    <span style={{ color: "#a855f7" }}>+{job.xpPerJob} XP</span>
                    {job.onCooldown && job.cooldownUntil && (
                      <span style={{ color: "#64748b" }}>CD: <Cooldown until={job.cooldownUntil} /></span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => work(job.id)}
                  disabled={!available || working !== null}
                  className="px-3 py-1.5 rounded font-mono text-xs font-bold uppercase flex-shrink-0 transition-all"
                  style={{
                    background: available ? "#39d35318" : "#1e1e2e",
                    color: available ? "#39d353" : "#475569",
                    border: `1px solid ${available ? "#39d35340" : "#1e1e2e"}`,
                  }}
                >
                  {busyThis ? "..." : job.onCooldown ? "CD" : "Work"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
