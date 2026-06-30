import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { District, User } from "../lib/types";
import { useSocket } from "../context/SocketContext";

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff", neutral: "#39d353", uncontrolled: "#ff2d55" };
const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid", neutral: "Neutral", uncontrolled: "Uncontrolled" };

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; onInspectPlayer?: (id: string) => void; }

export function MapPage({ user, refreshUser, addToast }: Props) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [populations, setPopulations] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    api.get<District[]>("/districts").then(d => {
      setDistricts(d);
      d.forEach(dist => {
        api.get<{ population: number }>(`/districts/${dist.id}`)
          .then(r => setPopulations(p => ({ ...p, [dist.id]: r.population })))
          .catch(() => {});
      });
    });
  }, []);

  // Keep district presence updated for population counts
  useEffect(() => {
    if (!socket || !user.district) return;
    socket.emit("join_district", user.district);
    return () => { socket.emit("leave_district", user.district); };
  }, [socket, user.district]);

  async function travel(districtId: string) {
    if (traveling) return;
    setTraveling(true);
    try {
      const r = await api.post<any>(`/districts/${districtId}/travel`);
      addToast(r.message, "success");
      if (socket) {
        socket.emit("leave_district", user.district);
        socket.emit("join_district", districtId);
      }
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setTraveling(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-mono text-lg font-bold" style={{ color: "#00d4ff", textShadow: "0 0 12px #00d4ff40" }}>
            NEW VANTA — DISTRICT MAP
          </h1>
          <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
            You are in: <span style={{ color: "#39d353", fontWeight: "bold" }}>{user.district.replace(/-/g, " ").toUpperCase()}</span>
          </p>
        </div>
      </div>

      {/* District Cards */}
      <div className="grid gap-3">
        {districts.map(dist => {
          const isCurrent = user.district === dist.id;
          const locked = user.level < dist.minLevel;
          const isExpanded = expanded === dist.id;
          const fc = FACTION_COLOR[dist.faction] || "#94a3b8";
          const pop = populations[dist.id] ?? 0;

          return (
            <div
              key={dist.id}
              style={{
                background: "#111118",
                border: `1px solid ${isCurrent ? fc + "50" : "#1e1e2e"}`,
                borderRadius: 8,
                overflow: "hidden",
                opacity: locked ? 0.5 : 1,
                boxShadow: isCurrent ? `0 0 12px ${fc}15` : "none",
              }}
            >
              {/* Header row */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() => !locked && setExpanded(isExpanded ? null : dist.id)}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: fc, flexShrink: 0,
                  boxShadow: `0 0 8px ${fc}`,
                  animation: isCurrent ? "pulse 2s infinite" : "none",
                }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: isCurrent ? fc : "#e2e8f0" }}>
                      {dist.name}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: fc + "20", color: fc, border: `1px solid ${fc}40`, fontSize: 10 }}>
                        HERE
                      </span>
                    )}
                    {locked && (
                      <span className="font-mono text-xs" style={{ color: "#64748b", fontSize: 10 }}>LV.{dist.minLevel} REQ</span>
                    )}
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{dist.primaryActivity}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs font-bold" style={{ color: fc }}>{FACTION_LABEL[dist.faction]}</div>
                  <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                    {pop} online
                  </div>
                </div>
                {/* Danger bars */}
                <div className="flex gap-0.5 flex-shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{
                      width: 4, height: 12, borderRadius: 2,
                      background: i < dist.dangerLevel ? "#ff2d55" : "#1e1e2e",
                      boxShadow: i < dist.dangerLevel ? "0 0 4px #ff2d5580" : "none",
                    }} />
                  ))}
                </div>
                <span className="font-mono text-xs" style={{ color: "#475569", marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</span>
              </button>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #1e1e2e" }}>
                  <div className="p-4">
                    <p className="font-mono text-xs mb-3" style={{ color: "#94a3b8" }}>{dist.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>TRAVEL COST</div>
                        <div className="font-mono font-bold text-xs" style={{ color: "#f59e0b" }}>{dist.travelEnergyCost} energy</div>
                      </div>
                      <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>FACTION</div>
                        <div className="font-mono font-bold text-xs" style={{ color: fc }}>{FACTION_LABEL[dist.faction]}</div>
                      </div>
                      <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>DANGER</div>
                        <div className="font-mono font-bold text-xs" style={{ color: "#ff2d55" }}>{dist.dangerLevel}/5</div>
                      </div>
                      <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>POPULATION</div>
                        <div className="font-mono font-bold text-xs" style={{ color: "#39d353" }}>{pop} online</div>
                      </div>
                    </div>
                    <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>
                      NPCs: <span style={{ color: "#94a3b8" }}>{dist.npcs.join(", ")}</span>
                    </div>
                    {!isCurrent && !locked && (
                      <button
                        onClick={() => travel(dist.id)}
                        disabled={traveling || user.energy < dist.travelEnergyCost}
                        className="w-full font-mono text-sm py-2 rounded font-bold transition-all"
                        style={{
                          background: user.energy < dist.travelEnergyCost ? "#1e1e2e" : fc + "20",
                          color: user.energy < dist.travelEnergyCost ? "#475569" : fc,
                          border: `1px solid ${user.energy < dist.travelEnergyCost ? "#1e1e2e" : fc + "60"}`,
                          boxShadow: user.energy >= dist.travelEnergyCost ? `0 0 12px ${fc}20` : "none",
                        }}
                      >
                        {traveling ? "Traveling..." : user.energy < dist.travelEnergyCost
                          ? `Need ${dist.travelEnergyCost} energy`
                          : `Travel Here (${dist.travelEnergyCost} energy)`}
                      </button>
                    )}
                    {isCurrent && (
                      <div className="font-mono text-xs text-center py-2 rounded" style={{ color: fc, background: fc + "10", border: `1px solid ${fc}30` }}>
                        You are here
                      </div>
                    )}
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
