import { useState, useEffect } from "react";
import { User, Crime } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function CrimesPage({ user, refreshUser, addToast }: Props) {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [committing, setCommitting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    api.get<Crime[]>("/crimes").then(setCrimes).catch(() => {});
  }, []);

  async function commit(crimeId: string) {
    setCommitting(crimeId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/crimes/${crimeId}/commit`);
      setLastResult(data);
      if (data.success) {
        addToast(data.message, "success");
      } else {
        addToast(data.message, data.jailed ? "error" : "warning");
      }
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setCommitting(null);
    }
  }

  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();

  const RARITY_COLORS = ["#39d353", "#00d4ff", "#a855f7", "#f59e0b", "#ff2d55"];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#ff2d55" }}>Crime Board</h2>
        <div className="flex gap-4 text-xs font-mono">
          <span style={{ color: "#ff6b35" }}>Nerve: <strong style={{ color: "#e2e8f0" }}>{user.nerve}/{user.maxNerve}</strong></span>
          <span style={{ color: "#94a3b8" }}>Level: <strong style={{ color: "#e2e8f0" }}>{user.level}</strong></span>
        </div>
      </div>

      {(isHospitalized || isJailed) && (
        <div className="p-3 rounded text-sm font-mono" style={{
          background: isHospitalized ? "#ff2d5510" : "#f59e0b10",
          border: `1px solid ${isHospitalized ? "#ff2d5540" : "#f59e0b40"}`,
          color: isHospitalized ? "#ff2d55" : "#f59e0b",
        }}>
          {isHospitalized ? "You are hospitalized. Visit the hospital to recover." : "You are in jail. Wait for release."}
        </div>
      )}

      {lastResult && (
        <div
          className="p-4 rounded-lg font-mono"
          style={{
            background: lastResult.success ? "#39d35310" : "#ff2d5510",
            border: `1px solid ${lastResult.success ? "#39d35340" : "#ff2d5540"}`,
          }}
        >
          <div className="text-sm font-bold mb-1" style={{ color: lastResult.success ? "#39d353" : "#ff2d55" }}>
            {lastResult.message}
          </div>
          <div className="flex gap-4 text-xs">
            {lastResult.dcGained > 0 && <span style={{ color: "#f59e0b" }}>+{lastResult.dcGained} DC</span>}
            {lastResult.xpGained > 0 && <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>}
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Now Lv.{lastResult.newLevel}</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {crimes.map((crime, idx) => {
          const canAfford = user.nerve >= crime.nerveCost;
          const meetsLevel = user.level >= crime.minLevel;
          const available = canAfford && meetsLevel && !isHospitalized && !isJailed;
          const busyThis = committing === crime.id;

          return (
            <div
              key={crime.id}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{
                background: "#111118",
                border: `1px solid ${available ? "#1e1e2e" : "#0f0f18"}`,
                opacity: meetsLevel ? 1 : 0.5,
              }}
            >
              <div
                className="w-2 h-12 rounded-full flex-shrink-0"
                style={{ background: RARITY_COLORS[Math.min(idx, 4)], opacity: 0.7 }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                    {crime.name}
                  </span>
                  {!meetsLevel && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#ff2d5510", color: "#ff2d55" }}>
                      Lv.{crime.minLevel}
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono mb-2" style={{ color: "#475569" }}>{crime.description}</p>
                <div className="flex gap-4 text-xs font-mono flex-wrap">
                  <span style={{ color: "#ff6b35" }}>Nerve: {crime.nerveCost}</span>
                  <span style={{ color: "#f59e0b" }}>DC: {crime.dcRange[0]}-{crime.dcRange[1]}</span>
                  <span style={{ color: "#a855f7" }}>XP: +{crime.xp}</span>
                  <span style={{ color: "#94a3b8" }}>Success: {Math.round(crime.successRate * 100)}%</span>
                </div>
              </div>
              <button
                onClick={() => commit(crime.id)}
                disabled={!available || !!committing}
                className="px-4 py-2 rounded text-xs font-mono font-bold uppercase flex-shrink-0 transition-all"
                style={{
                  background: available ? "#ff2d5518" : "#1e1e2e",
                  color: available ? "#ff2d55" : "#475569",
                  border: `1px solid ${available ? "#ff2d5540" : "#1e1e2e"}`,
                }}
              >
                {busyThis ? "..." : "Execute"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
