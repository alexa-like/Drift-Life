import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { District, User } from "../lib/types";
import { useSocket } from "../context/SocketContext";
import { FrameRectBubble, ChatMessage } from "../components/FrameRectBubble";

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff", neutral: "#39d353", uncontrolled: "#ff2d55" };
const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid", neutral: "Neutral", uncontrolled: "Uncontrolled" };

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; onInspectPlayer?: (id: string) => void; }

export function MapPage({ user, refreshUser, addToast, onInspectPlayer }: Props) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [populations, setPopulations] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [chat, setChat] = useState<Record<string, ChatMessage[]>>({});
  const [globalChat, setGlobalChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [globalInput, setGlobalInput] = useState("");
  const [showGlobal, setShowGlobal] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const globalRef = useRef<HTMLDivElement>(null);
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

  // Join current district chat room on load
  useEffect(() => {
    if (!socket || !user.district) return;
    socket.emit("join_district", user.district);
    return () => { socket.emit("leave_district", user.district); };
  }, [socket, user.district]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onDistrictMsg = (msg: ChatMessage) => {
      setChat(c => ({ ...c, [msg.districtId!]: [...(c[msg.districtId!] || []).slice(-99), msg] }));
      setTimeout(() => { chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
    };

    const onGlobalMsg = (msg: ChatMessage) => {
      setGlobalChat(c => [...c.slice(-99), msg]);
      setTimeout(() => { globalRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
    };

    socket.on("chat_message", onDistrictMsg);
    socket.on("global_message", onGlobalMsg);
    socket.on("chat_error", (err: string) => addToast(err, "error"));

    return () => {
      socket.off("chat_message", onDistrictMsg);
      socket.off("global_message", onGlobalMsg);
      socket.off("chat_error");
    };
  }, [socket]);

  // When expanded changes, join that district room
  useEffect(() => {
    if (!socket || !expanded) return;
    socket.emit("join_district", expanded);
    // Add system welcome
    setChat(c => ({
      ...c,
      [expanded]: c[expanded] || [{
        id: `sys-${expanded}`,
        userId: "system",
        username: "System",
        faction: null,
        content: `Zone chat for ${expanded.replace(/-/g, " ")} — ${user.district === expanded ? "you are here" : "travel here to send messages"}`,
        at: new Date().toISOString(),
      }],
    }));
  }, [socket, expanded]);

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

  function sendDistrictChat() {
    if (!expanded || !chatInput.trim() || !socket) return;
    socket.emit("chat_message", { districtId: expanded, content: chatInput.trim() });
    setChatInput("");
  }

  function sendGlobalChat() {
    if (!globalInput.trim() || !socket) return;
    socket.emit("global_message", {
      content: globalInput.trim(),
      equippedFrame: user.equippedFrame,
    });
    setGlobalInput("");
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
        <button
          onClick={() => setShowGlobal(g => !g)}
          className="font-mono text-xs px-3 py-1.5 rounded"
          style={{
            background: showGlobal ? "#00d4ff18" : "#0d0d15",
            color: showGlobal ? "#00d4ff" : "#64748b",
            border: `1px solid ${showGlobal ? "#00d4ff40" : "#1e1e2e"}`,
          }}
        >
          🌐 Global Chat
        </button>
      </div>

      {/* Global Chat Panel */}
      {showGlobal && (
        <div
          style={{
            background: "#111118",
            border: "1px solid #00d4ff30",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            boxShadow: "0 0 16px #00d4ff10",
          }}
        >
          <div className="font-mono text-xs mb-2" style={{ color: "#00d4ff" }}>🌐 GLOBAL CHAT</div>
          <div
            ref={globalRef}
            style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8 }}
          >
            {globalChat.length === 0 ? (
              <div className="font-mono text-xs" style={{ color: "#334155" }}>Global chat is quiet...</div>
            ) : (
              globalChat.map(m => (
                <FrameRectBubble
                  key={m.id}
                  message={m}
                  isOwn={m.userId === user.id}
                  onUsernameClick={(userId) => onInspectPlayer?.(userId)}
                />
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={globalInput}
              onChange={e => setGlobalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendGlobalChat()}
              placeholder="Say something to New Vanta..."
              className="flex-1 px-2 py-1.5 rounded font-mono text-xs"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              maxLength={280}
            />
            <button
              onClick={sendGlobalChat}
              className="px-3 py-1.5 rounded font-mono text-xs font-bold"
              style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40" }}
            >
              Send
            </button>
          </div>
        </div>
      )}

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
                        ● HERE
                      </span>
                    )}
                    {locked && (
                      <span className="font-mono text-xs" style={{ color: "#64748b", fontSize: 10 }}>🔒 Lv.{dist.minLevel}</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    {/* Left: district info */}
                    <div className="p-4" style={{ borderRight: "1px solid #1e1e2e" }}>
                      <p className="font-mono text-xs mb-3" style={{ color: "#94a3b8" }}>{dist.description}</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                          <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>TRAVEL COST</div>
                          <div className="font-mono font-bold text-xs" style={{ color: "#f59e0b" }}>{dist.travelEnergyCost} ⚡</div>
                        </div>
                        <div style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                          <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>FACTION</div>
                          <div className="font-mono font-bold text-xs" style={{ color: fc }}>{FACTION_LABEL[dist.faction]}</div>
                        </div>
                      </div>
                      <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
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
                            ? `Need ${dist.travelEnergyCost}⚡`
                            : `→ Travel Here (${dist.travelEnergyCost}⚡)`}
                        </button>
                      )}
                      {isCurrent && (
                        <div className="font-mono text-xs text-center py-2 rounded" style={{ color: fc, background: fc + "10", border: `1px solid ${fc}30` }}>
                          ● You are here
                        </div>
                      )}
                    </div>

                    {/* Right: Zone Chat */}
                    <div className="p-3 flex flex-col" style={{ minHeight: 220 }}>
                      <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>
                        ZONE CHAT — {dist.name.toUpperCase()}
                      </div>
                      <div
                        ref={chatRef}
                        className="flex-1 overflow-y-auto mb-2"
                        style={{ maxHeight: 160, minHeight: 80 }}
                      >
                        {(chat[dist.id] || []).map(m => (
                          <FrameRectBubble
                            key={m.id}
                            message={m}
                            isOwn={m.userId === user.id}
                            onUsernameClick={(userId) => onInspectPlayer?.(userId)}
                          />
                        ))}
                        {(chat[dist.id] || []).length === 0 && (
                          <div className="font-mono text-xs" style={{ color: "#334155" }}>Zone chat is quiet...</div>
                        )}
                      </div>
                      {isCurrent ? (
                        <div className="flex gap-2">
                          <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendDistrictChat()}
                            placeholder="Say something..."
                            className="flex-1 px-2 py-1 rounded font-mono text-xs"
                            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                            maxLength={280}
                          />
                          <button
                            onClick={sendDistrictChat}
                            className="px-2 py-1 rounded font-mono text-xs"
                            style={{ background: fc + "20", color: fc, border: `1px solid ${fc}40` }}
                          >
                            Send
                          </button>
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-center py-1" style={{ color: "#334155" }}>
                          Travel here to join zone chat
                        </div>
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
