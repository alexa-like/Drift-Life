import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";

interface Target {
  id: string;
  username: string;
  avatar: string;
  level: number;
  rank: string;
  district: string;
  wins: number;
  losses: number;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function CombatPage({ user, refreshUser, addToast }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);

  useEffect(() => {
    loadTargets();
  }, []);

  async function loadTargets() {
    setLoadingTargets(true);
    try {
      const data = await api.get<Target[]>("/combat/targets");
      setTargets(data);
    } catch {
      addToast("Failed to load targets", "error");
    } finally {
      setLoadingTargets(false);
    }
  }

  async function attack(targetId: string) {
    setAttacking(targetId);
    setLastResult(null);
    try {
      const data = await api.post<any>("/combat/attack", { targetId });
      setLastResult(data);
      if (data.attackerWins) {
        addToast(data.message, "success");
      } else {
        addToast(data.message, "error");
      }
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setAttacking(null);
    }
  }

  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const blocked = isHospitalized || isJailed;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#ff6b35" }}>Combat</h2>
        <div className="flex gap-4 text-xs font-mono">
          <span style={{ color: "#39d353" }}>HP: <strong>{user.health}/{user.maxHealth}</strong></span>
          <span style={{ color: "#94a3b8" }}>W:{user.wins} L:{user.losses}</span>
        </div>
      </div>

      {blocked && (
        <div className="p-3 rounded text-sm font-mono" style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}>
          {isHospitalized ? "Hospitalized — cannot fight." : "Jailed — cannot fight."}
        </div>
      )}

      {lastResult && (
        <div
          className="p-4 rounded-lg font-mono"
          style={{
            background: lastResult.attackerWins ? "#ff6b3510" : "#ff2d5510",
            border: `1px solid ${lastResult.attackerWins ? "#ff6b3540" : "#ff2d5540"}`,
          }}
        >
          <div className="font-bold text-sm mb-1" style={{ color: lastResult.attackerWins ? "#ff6b35" : "#ff2d55" }}>
            {lastResult.attackerWins ? "VICTORY" : "DEFEAT"}
          </div>
          <p className="text-xs font-mono mb-2" style={{ color: "#94a3b8" }}>{lastResult.message}</p>
          <div className="flex gap-4 text-xs font-mono flex-wrap">
            {lastResult.dcGained > 0 && <span style={{ color: "#f59e0b" }}>+{lastResult.dcGained} DC</span>}
            {lastResult.xpGained > 0 && <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>}
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{lastResult.newLevel}</span>}
            {lastResult.defenderHospitalized && <span style={{ color: "#ff2d55" }}>Enemy hospitalized</span>}
            {lastResult.attackerHospitalized && <span style={{ color: "#ff2d55" }}>You were hospitalized</span>}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-xs font-mono" style={{ color: "#475569" }}>Nearby targets (±5 levels)</span>
        <button
          onClick={loadTargets}
          className="text-xs font-mono px-2 py-1 rounded"
          style={{ color: "#475569", border: "1px solid #1e1e2e" }}
        >
          Refresh
        </button>
      </div>

      {loadingTargets ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#1e1e2e" }}>
          Scanning for targets...
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          No targets found nearby. Level up or explore different districts.
        </div>
      ) : (
        <div className="grid gap-3">
          {targets.map(target => (
            <div
              key={target.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{ background: "#111118", border: "1px solid #1e1e2e" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{target.username}</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>
                    Lv.{target.level}
                  </span>
                </div>
                <div className="text-xs font-mono flex gap-3" style={{ color: "#475569" }}>
                  <span>{target.rank}</span>
                  <span>{target.district.replace(/-/g, " ")}</span>
                  <span style={{ color: "#39d353" }}>W:{target.wins}</span>
                  <span style={{ color: "#ff2d55" }}>L:{target.losses}</span>
                </div>
              </div>
              <button
                onClick={() => attack(target.id)}
                disabled={blocked || !!attacking}
                className="px-4 py-2 rounded text-xs font-mono font-bold uppercase flex-shrink-0 transition-all"
                style={{
                  background: !blocked ? "#ff6b3518" : "#1e1e2e",
                  color: !blocked ? "#ff6b35" : "#475569",
                  border: `1px solid ${!blocked ? "#ff6b3540" : "#1e1e2e"}`,
                }}
              >
                {attacking === target.id ? "..." : "Attack"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
