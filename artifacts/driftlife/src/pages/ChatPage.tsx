import { useState, useEffect, useRef, useCallback } from "react";
import { User, ChatMessage, Conversation } from "../lib/types";
import { api } from "../lib/api";
import { useSocket } from "../context/SocketContext";
import { getFrame } from "../lib/frames";
import { RARITY_COLORS } from "../lib/frames";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onInspectPlayer?: (userId: string) => void;
}

const FACTION_COLOR: Record<string, string> = {
  suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff", neutral: "#64748b",
};

function MessageBubble({ msg, currentUserId, onUserClick }: {
  msg: ChatMessage;
  currentUserId: string;
  onUserClick?: (userId: string) => void;
}) {
  const isOwn = msg.userId === currentUserId;
  const frame = getFrame(msg.frame);
  const color = msg.frameColor || frame.glowColor;
  const factionColor = FACTION_COLOR[msg.faction || "neutral"] || "#64748b";
  const nameColor = msg.frame ? color : factionColor;

  const rarity = frame.rarity;
  const glowIntensity = rarity === "mythic" ? 12 : rarity === "legendary" ? 8 : rarity === "epic" ? 6 : rarity === "rare" ? 4 : 2;
  const headerBg = msg.frame && rarity !== "common"
    ? `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)`
    : "transparent";

  return (
    <div style={{
      background: isOwn ? "#111118" : "#0d0d15",
      border: `1px solid ${msg.frame && rarity !== "common" ? color + "30" : "#1e1e2e"}`,
      borderRadius: 6,
      marginBottom: 4,
      overflow: "hidden",
      boxShadow: msg.frame ? `0 0 ${glowIntensity}px ${color}20` : "none",
    }}>
      {msg.frame && rarity !== "common" && (
        <div style={{
          background: headerBg,
          borderBottom: `1px solid ${color}25`,
          padding: "4px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
            <span className="font-mono" style={{ color, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: "bold" }}>
              {frame.name}
            </span>
          </div>
          <span className="font-mono" style={{ color: color + "60", fontSize: 9, textTransform: "capitalize" }}>
            {rarity}
          </span>
        </div>
      )}
      <div style={{ padding: "6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
          <button
            onClick={() => onUserClick?.(msg.userId)}
            className="font-mono font-bold"
            style={{ color: nameColor, fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {msg.username}
          </button>
          {msg.title && (
            <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>[{msg.title}]</span>
          )}
          <span className="font-mono" style={{ color: "#334155", fontSize: 10 }}>
            {new Date(msg.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="font-mono text-xs break-all" style={{ color: "#e2e8f0", lineHeight: 1.5 }}>{msg.content}</p>
      </div>
    </div>
  );
}

function MessageInput({ onSend, placeholder }: { onSend: (text: string) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const lastSent = useRef(0);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastSent.current < 3000) return;
    lastSent.current = now;
    onSend(trimmed);
    setText("");
  }

  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 0 0" }}>
      <input
        value={text}
        onChange={e => setText(e.target.value.slice(0, 256))}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        className="font-mono text-xs"
        placeholder={placeholder || "Message..."}
        style={{
          flex: 1, background: "#111118", border: "1px solid #1e1e2e", borderRadius: 6,
          color: "#e2e8f0", padding: "8px 12px", outline: "none",
        }}
      />
      <button
        onClick={submit}
        className="font-mono text-xs font-bold"
        style={{
          background: "#00d4ff20", border: "1px solid #00d4ff40", borderRadius: 6,
          color: "#00d4ff", padding: "8px 14px", cursor: "pointer", flexShrink: 0,
        }}
      >
        Send
      </button>
    </div>
  );
}

function GlobalTab({ user, onInspect }: { user: User; onInspect?: (id: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatMessage[]>("/chat/global")
      .then(m => { setMessages(m); setLoading(false); })
      .catch(() => setLoading(false));
    socket?.emit("join_global");
    return () => { socket?.emit("leave_global"); };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-49), msg]);
    };
    socket.on("global_message", handler);
    return () => { socket.off("global_message", handler); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(content: string) {
    try {
      await api.post<any>("/chat/global", { content });
    } catch (err: any) {
      console.warn("send global error", err);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
        {loading && <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", padding: 20 }}>Loading...</div>}
        {messages.map(m => (
          <MessageBubble key={m.id} msg={m} currentUserId={user.id} onUserClick={onInspect} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder="Global chat..." />
    </div>
  );
}

function DistrictTab({ user, onInspect }: { user: User; onInspect?: (id: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const district = user.district;

  useEffect(() => {
    api.get<ChatMessage[]>(`/chat/district/${district}`)
      .then(m => { setMessages(m); setLoading(false); })
      .catch(() => setLoading(false));
    socket?.emit("join_district", district);
    return () => { socket?.emit("leave_district", district); };
  }, [socket, district]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      if (msg.districtId === district) {
        setMessages(prev => [...prev.slice(-49), msg]);
      }
    };
    socket.on("chat_message", handler);
    return () => { socket.off("chat_message", handler); };
  }, [socket, district]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(content: string) {
    try {
      await api.post<any>(`/chat/district/${district}`, { content });
    } catch (err: any) {
      console.warn("send district error", err);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="font-mono text-xs" style={{ color: "#475569", marginBottom: 8 }}>
        District: <span style={{ color: "#00d4ff" }}>{district}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
        {loading && <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", padding: 20 }}>Loading...</div>}
        {messages.map(m => (
          <MessageBubble key={m.id} msg={m} currentUserId={user.id} onUserClick={onInspect} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder={`${district} chat...`} />
    </div>
  );
}

function MessagesTab({ user, onInspect }: { user: User; onInspect?: (id: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { socket } = useSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Conversation[]>("/chat/dm/conversations")
      .then(c => { setConversations(c); setLoadingConvs(false); })
      .catch(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ partnerId, message }: { partnerId: string; message: ChatMessage }) => {
      if (partnerId === activeConv) {
        setMessages(prev => [...prev.slice(-49), message]);
      }
      setConversations(prev => {
        const existing = prev.findIndex(c => c.userId === partnerId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], lastMessage: message.content, lastAt: message.at };
          return updated;
        }
        return prev;
      });
    };
    socket.on("dm_message", handler);
    return () => { socket.off("dm_message", handler); };
  }, [socket, activeConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(userId: string) {
    setActiveConv(userId);
    setLoadingMsgs(true);
    try {
      const msgs = await api.get<ChatMessage[]>(`/chat/dm/${userId}`);
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function send(content: string) {
    if (!activeConv) return;
    try {
      await api.post<any>(`/chat/dm/${activeConv}`, { content });
      const optimistic: ChatMessage = {
        id: Date.now().toString(),
        userId: user.id,
        username: user.username,
        faction: user.faction,
        frame: (user.equippedFrames?.chat && user.equippedFrames.chat !== "ghostFrame") ? user.equippedFrames.chat : user.equippedFrame,
        frameColor: user.equippedFrameColor,
        title: user.equippedTitle,
        content,
        at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(-49), optimistic]);
    } catch (err: any) {
      console.warn("dm send error", err);
    }
  }

  async function doSearch(q: string) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<any[]>(`/user/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.filter((r: any) => r.id !== user.id));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const activeConvData = conversations.find(c => c.userId === activeConv);

  if (activeConv) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => setActiveConv(null)}
            className="font-mono text-xs"
            style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            &larr; Back
          </button>
          <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 13 }}>
            {activeConvData?.username || "DM"}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
          {loadingMsgs && <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", padding: 20 }}>Loading...</div>}
          {messages.map(m => (
            <MessageBubble key={m.id} msg={m} currentUserId={user.id} onUserClick={onInspect} />
          ))}
          <div ref={bottomRef} />
        </div>
        <MessageInput onSend={send} placeholder="Direct message..." />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
          placeholder="Search players to message..."
          className="font-mono text-xs"
          style={{
            width: "100%", background: "#111118", border: "1px solid #1e1e2e", borderRadius: 6,
            color: "#e2e8f0", padding: "8px 12px", outline: "none", boxSizing: "border-box",
          }}
        />
        {searchResults.length > 0 && (
          <div style={{ marginTop: 4, border: "1px solid #1e1e2e", borderRadius: 6, background: "#111118" }}>
            {searchResults.map(r => (
              <button
                key={r.id}
                onClick={() => { setSearch(""); setSearchResults([]); openConversation(r.id); }}
                className="font-mono text-xs"
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                  background: "none", border: "none", color: "#e2e8f0", cursor: "pointer",
                  borderBottom: "1px solid #1e1e2e",
                }}
              >
                {r.username}
                <span style={{ color: "#475569", marginLeft: 8 }}>Lv.{r.level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingConvs ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", padding: 20 }}>Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="font-mono text-xs" style={{ color: "#475569", textAlign: "center", padding: 20 }}>
          No conversations yet. Search for a player above to start messaging.
        </div>
      ) : (
        conversations.map(c => {
          const statusColor = c.onlineStatus === "online" ? "#39d353" : c.onlineStatus === "away" ? "#f59e0b" : "#334155";
          const statusLabel = c.onlineStatus === "online" ? "Online" : c.onlineStatus === "away" ? "Away" : "Offline";
          return (
          <button
            key={c.userId}
            onClick={() => openConversation(c.userId)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", marginBottom: 4,
              background: "#111118", border: "1px solid #1e1e2e", borderRadius: 6,
              cursor: "pointer", textAlign: "left",
            }}
          >
            {/* Online status dot */}
            <div title={statusLabel} style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: statusColor,
              boxShadow: c.onlineStatus === "online" ? `0 0 6px ${statusColor}` : "none",
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 12 }}>{c.username}</div>
              <div className="font-mono text-xs" style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.lastMessage}
              </div>
            </div>
            <div className="font-mono" style={{ color: "#334155", fontSize: 10, flexShrink: 0 }}>
              {new Date(c.lastAt).toLocaleDateString()}
            </div>
          </button>
        );})
      )}
    </div>
  );
}

export function ChatPage({ user, addToast, onInspectPlayer }: Props) {
  const [tab, setTab] = useState<"global" | "district" | "messages">("global");

  const tabs = [
    { id: "global" as const, label: "Global" },
    { id: "district" as const, label: "District" },
    { id: "messages" as const, label: "Messages" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono text-xs font-bold"
            style={{
              flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer",
              background: tab === t.id ? "#00d4ff20" : "#111118",
              border: `1px solid ${tab === t.id ? "#00d4ff" : "#1e1e2e"}`,
              color: tab === t.id ? "#00d4ff" : "#475569",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "global" && <GlobalTab user={user} onInspect={onInspectPlayer} />}
        {tab === "district" && <DistrictTab user={user} onInspect={onInspectPlayer} />}
        {tab === "messages" && <MessagesTab user={user} onInspect={onInspectPlayer} />}
      </div>
    </div>
  );
}
