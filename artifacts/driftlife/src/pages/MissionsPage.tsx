import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface MissionReward { dc: number; xp: number; keyShards: number }
interface Mission {
  id: string;
  label: string;
  description: string;
  type: string;
  target: number;
  rewards: MissionReward;
  progress: number;
  completed: boolean;
  claimed: boolean;
}
interface DailyMissionsResponse {
  date: string;
  resetAt: string;
  missions: Mission[];
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

function useCountdown(targetIso: string) {
  const [text, setText] = useState("");
  useEffect(() => {
    function calc() {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setText("Now"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setText(`${h}h ${m}m ${s}s`);
    }
    calc();
    const id = setInterval(calc, 1_000);
    return () => clearInterval(id);
  }, [targetIso]);
  return text;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
    </div>
  );
}

const TYPE_COLOR: Record<string, string> = {
  combat_win: "#ff2d55",
  combat_play: "#ff6b35",
  consumable: "#a855f7",
  race_play: "#00d4ff",
  race_win: "#f59e0b",
  nitro_use: "#f97316",
  royale_spin: "#8b5cf6",
  login: "#39d353",
  dc_earned: "#f59e0b",
  nc_claim: "#ff2d55",
  crime_play: "#ef4444",
};

export function MissionsPage({ user, refreshUser, addToast }: Props) {
  const [data, setData] = useState<DailyMissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const countdown = useCountdown(data?.resetAt ?? new Date(Date.now() + 3_600_000).toISOString());

  async function load() {
    try {
      const r = await api.get<DailyMissionsResponse>("/missions/daily");
      setData(r);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function claim(id: string) {
    if (claiming) return;
    setClaiming(id);
    try {
      const r = await api.post<{ message: string; rewards: { dc: number; xp: number; keyShards: number } }>(`/missions/claim/${id}`);
      const rw = r.rewards;
      addToast(`Mission complete! +${rw.dc} DC, +${rw.xp} XP${rw.keyShards ? `, +${rw.keyShards} Key Shards` : ""}`, "success");
      await load();
      await refreshUser();
    } catch (e: any) {
      addToast(e?.message ?? "Failed to claim mission", "error");
    } finally {
      setClaiming(null);
    }
  }

  const completed = data?.missions.filter(m => m.completed).length ?? 0;
  const claimed   = data?.missions.filter(m => m.claimed).length ?? 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 className="font-mono font-bold" style={{ color: "#00d4ff", fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Daily Missions
          </h1>
          {data && (
            <div className="font-mono" style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>
              {claimed}/{data.missions.length} claimed &nbsp;·&nbsp; Resets in{" "}
              <span style={{ color: "#f59e0b" }}>{countdown}</span>
            </div>
          )}
        </div>
        <button
          onClick={load}
          className="font-mono text-xs"
          style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4, color: "#475569", padding: "6px 12px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {/* Overall progress bar */}
      {data && (
        <div style={{ height: 6, background: "#1e1e2e", borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
          <div style={{
            width: `${data.missions.length ? (claimed / data.missions.length) * 100 : 0}%`,
            height: "100%", background: "linear-gradient(90deg,#00d4ff,#a855f7)", borderRadius: 3, transition: "width 0.5s",
          }} />
        </div>
      )}

      {/* Missions list */}
      {loading ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>
          Loading missions…
        </div>
      ) : !data || data.missions.length === 0 ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>
          No missions available today.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.missions.map(m => {
            const color = TYPE_COLOR[m.type] ?? "#64748b";
            const pct   = Math.min(100, m.target > 0 ? Math.round((m.progress / m.target) * 100) : 0);
            return (
              <div
                key={m.id}
                style={{
                  background: m.claimed ? "#0a0a0f" : "#0d0d15",
                  border: `1px solid ${m.completed && !m.claimed ? color + "60" : "#1e1e2e"}`,
                  borderLeft: `3px solid ${m.claimed ? "#1e1e2e" : color}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  opacity: m.claimed ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span className="font-mono font-bold" style={{ color: m.claimed ? "#475569" : "#e2e8f0", fontSize: 13 }}>
                        {m.label}
                      </span>
                      <span className="font-mono" style={{ fontSize: 9, color, background: color + "20", padding: "1px 5px", borderRadius: 3, letterSpacing: "0.08em" }}>
                        {m.type.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>
                    <p className="font-mono" style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>{m.description}</p>

                    {/* Rewards row */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {m.rewards.dc > 0 && (
                        <span className="font-mono" style={{ fontSize: 10, color: "#f59e0b" }}>+{m.rewards.dc.toLocaleString()} DC</span>
                      )}
                      {m.rewards.xp > 0 && (
                        <span className="font-mono" style={{ fontSize: 10, color: "#39d353" }}>+{m.rewards.xp.toLocaleString()} XP</span>
                      )}
                      {m.rewards.keyShards > 0 && (
                        <span className="font-mono" style={{ fontSize: 10, color: "#00d4ff" }}>+{m.rewards.keyShards} Key Shard{m.rewards.keyShards !== 1 ? "s" : ""}</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <ProgressBar value={m.progress} max={m.target} color={m.claimed ? "#1e1e2e" : color} />
                    <div className="font-mono" style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                      {m.progress.toLocaleString()} / {m.target.toLocaleString()} ({pct}%)
                    </div>
                  </div>

                  {/* Claim / status button */}
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    {m.claimed ? (
                      <span className="font-mono" style={{ fontSize: 10, color: "#39d353", border: "1px solid #39d353", padding: "3px 8px", borderRadius: 4 }}>
                        CLAIMED
                      </span>
                    ) : m.completed ? (
                      <button
                        onClick={() => claim(m.id)}
                        disabled={claiming === m.id}
                        className="font-mono font-bold"
                        style={{
                          background: color, color: "#000", fontSize: 11,
                          border: "none", borderRadius: 4, padding: "5px 12px",
                          cursor: claiming ? "wait" : "pointer",
                          boxShadow: `0 0 12px ${color}80`,
                        }}
                      >
                        {claiming === m.id ? "…" : "CLAIM"}
                      </button>
                    ) : (
                      <span className="font-mono" style={{ fontSize: 10, color: "#334155" }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="font-mono" style={{ color: "#334155", fontSize: 10, marginTop: 24, textAlign: "center" }}>
        Missions are assigned fresh each day. Progress tracks automatically as you play.
      </p>
    </div>
  );
}

export default MissionsPage;
