import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { District, User } from "../lib/types";

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff", neutral: "#39d353", uncontrolled: "#ff2d55" };
const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid", neutral: "Neutral", uncontrolled: "Uncontrolled" };

interface ChatMsg { username: string; content: string; at: string; }

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; }

export function MapPage({ user, refreshUser, addToast }: Props) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [populations, setPopulations] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [chat, setChat] = useState<Record<string, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<District[]>("/districts").then(d => {
      setDistricts(d);
      // fetch populations
      d.forEach(dist => {
        api.get<{population:number}>(`/districts/${dist.id}`).then(r => {
          setPopulations(p => ({ ...p, [dist.id]: r.population }));
        }).catch(() => {});
      });
    });
  }, []);

  // Fake zone chat messages (would be Socket.io in full impl)
  useEffect(() => {
    if (!expanded) return;
    const mockChats: ChatMsg[] = [
      { username: "System", content: `Welcome to ${expanded.replace(/-/g, " ")}`, at: new Date().toISOString() },
    ];
    setChat(c => ({ ...c, [expanded]: c[expanded] || mockChats }));
  }, [expanded]);

  async function travel(districtId: string) {
    if (traveling) return;
    setTraveling(true);
    try {
      const r = await api.post<any>(`/districts/${districtId}/travel`);
      addToast(r.message, "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setTraveling(false);
    }
  }

  function sendChat() {
    if (!expanded || !chatInput.trim()) return;
    const msg: ChatMsg = { username: user.username, content: chatInput.trim(), at: new Date().toISOString() };
    setChat(c => ({ ...c, [expanded]: [...(c[expanded] || []), msg] }));
    setChatInput("");
    setTimeout(() => { chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, 50);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-mono text-lg font-bold" style={{ color: "#00d4ff" }}>NEW VANTA — DISTRICT MAP</h1>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          You are in: <span style={{ color: "#39d353" }}>{user.district.replace(/-/g, " ").toUpperCase()}</span>
        </p>
      </div>

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
                border: `1px solid ${isCurrent ? fc + "60" : "#1e1e2e"}`,
                borderRadius: 8,
                overflow: "hidden",
                opacity: locked ? 0.5 : 1,
              }}
            >
              {/* Header row */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() => !locked && setExpanded(isExpanded ? null : dist.id)}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: fc, flexShrink: 0, boxShadow: `0 0 6px ${fc}` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: isCurrent ? fc : "#e2e8f0" }}>
                      {dist.name}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: fc + "20", color: fc, fontSize: 10 }}>
                        HERE
                      </span>
                    )}
                    {locked && (
                      <span className="font-mono text-xs" style={{ color: "#64748b", fontSize: 10 }}>LOCKED (Lv.{dist.minLevel})</span>
                    )}
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{dist.primaryActivity}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-xs" style={{ color: fc }}>{FACTION_LABEL[dist.faction]}</div>
                  <div className="font-mono" style={{ color: "#64748b", fontSize: 10 }}>
                    {pop} online · Danger {"⚠️".repeat(dist.dangerLevel)}
                  </div>
                </div>
                <span className="font-mono text-xs" style={{ color: "#64748b", marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</span>
              </button>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #1e1e2e" }}>
                  <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                    {/* Left: district info */}
                    <div className="p-4" style={{ borderRight: "1px solid #1e1e2e" }}>
                      <p className="font-mono text-xs mb-3" style={{ color: "#94a3b8" }}>{dist.description}</p>
                      <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>
                        Travel cost: <span style={{ color: "#f59e0b" }}>{dist.travelEnergyCost} Energy</span>
                      </div>
                      <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
                        NPCs: {dist.npcs.join(", ")}
                      </div>
                      {/* Danger bars */}
                      <div className="flex gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < dist.dangerLevel ? "#ff2d55" : "#1e1e2e" }} />
                        ))}
                      </div>
                      {!isCurrent && !locked && (
                        <button
                          onClick={() => travel(dist.id)}
                          disabled={traveling || user.energy < dist.travelEnergyCost}
                          className="w-full font-mono text-sm py-2 rounded font-bold transition-all"
                          style={{
                            background: user.energy < dist.travelEnergyCost ? "#1e1e2e" : fc + "20",
                            color: user.energy < dist.travelEnergyCost ? "#64748b" : fc,
                            border: `1px solid ${user.energy < dist.travelEnergyCost ? "#1e1e2e" : fc + "60"}`,
                          }}
                        >
                          {traveling ? "Traveling..." : user.energy < dist.travelEnergyCost ? `Need ${dist.travelEnergyCost} Energy` : `Travel Here (${dist.travelEnergyCost} Energy)`}
                        </button>
                      )}
                      {isCurrent && (
                        <div className="font-mono text-xs text-center py-2" style={{ color: "#39d353" }}>
                          You are here
                        </div>
                      )}
                    </div>

                    {/* Right: Zone Chat */}
                    <div className="p-3 flex flex-col" style={{ minHeight: 200 }}>
                      <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>ZONE CHAT</div>
                      <div
                        ref={chatRef}
                        className="flex-1 overflow-y-auto mb-2 font-mono text-xs space-y-1"
                        style={{ maxHeight: 150, minHeight: 80 }}
                      >
                        {(chat[dist.id] || []).map((m, i) => (
                          <div key={i}>
                            <span style={{ color: fc }}>{m.username}:</span>{" "}
                            <span style={{ color: "#e2e8f0" }}>{m.content}</span>
                          </div>
                        ))}
                      </div>
                      {isCurrent && (
                        <div className="flex gap-2">
                          <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendChat()}
                            placeholder="Say something..."
                            className="flex-1 px-2 py-1 rounded font-mono text-xs"
                            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                            maxLength={200}
                          />
                          <button
                            onClick={sendChat}
                            className="px-2 py-1 rounded font-mono text-xs"
                            style={{ background: fc + "20", color: fc, border: `1px solid ${fc}40` }}
                          >
                            Send
                          </button>
                        </div>
                      )}
                      {!isCurrent && (
                        <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>Travel here to join zone chat</div>
                      )}
                    </div>
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
