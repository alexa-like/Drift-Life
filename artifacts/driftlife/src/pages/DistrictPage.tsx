import { useState, useEffect } from "react";
import { User, District } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function DistrictPage({ user, refreshUser, addToast }: Props) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [traveling, setTraveling] = useState<string | null>(null);

  useEffect(() => {
    api.get<District[]>("/districts").then(setDistricts).catch(() => {});
  }, []);

  async function travel(districtId: string) {
    if (districtId === user.district) return;
    setTraveling(districtId);
    try {
      const data = await api.post<any>(`/districts/${districtId}/travel`);
      addToast(data.message, "success");
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setTraveling(null);
    }
  }

  const DANGER_LABELS = ["", "Safe", "Low", "Medium", "High", "Critical"];
  const DANGER_COLORS = ["", "#39d353", "#f59e0b", "#ff6b35", "#ff2d55", "#ff0000"];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#a855f7" }}>Districts of New Vanta</h2>
        <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
          Currently in: <strong style={{ color: "#00d4ff" }}>
            {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </strong>
        </span>
      </div>

      <div className="grid gap-3">
        {districts.map(d => {
          const isCurrent = d.id === user.district;
          const canTravel = user.level >= d.minLevel;

          return (
            <div
              key={d.id}
              className="rounded-lg p-4"
              style={{
                background: "#111118",
                border: `1px solid ${isCurrent ? d.color + "40" : "#1e1e2e"}`,
                boxShadow: isCurrent ? `0 0 12px ${d.color}15` : "none",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="font-mono font-bold" style={{ color: isCurrent ? d.color : "#e2e8f0" }}>
                      {d.name}
                    </span>
                    {isCurrent && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: d.color + "20", color: d.color }}>
                        HERE
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono mb-3" style={{ color: "#475569" }}>{d.description}</p>
                  <div className="flex gap-4 text-xs font-mono flex-wrap">
                    <span>
                      Danger:{" "}
                      <span style={{ color: DANGER_COLORS[d.dangerLevel] }}>
                        {DANGER_LABELS[d.dangerLevel]}
                      </span>
                    </span>
                    <span style={{ color: "#94a3b8" }}>Min Level: {d.minLevel}</span>
                    <span style={{ color: "#475569" }}>
                      NPCs: {d.npcs.join(", ")}
                    </span>
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => travel(d.id)}
                    disabled={!canTravel || !!traveling}
                    className="px-3 py-1.5 rounded text-xs font-mono font-bold flex-shrink-0"
                    style={{
                      background: canTravel ? d.color + "18" : "#1e1e2e",
                      color: canTravel ? d.color : "#475569",
                      border: `1px solid ${canTravel ? d.color + "40" : "#1e1e2e"}`,
                    }}
                  >
                    {traveling === d.id ? "..." : canTravel ? "Travel" : `Lv.${d.minLevel}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
