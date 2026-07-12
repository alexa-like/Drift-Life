import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, ChatMessage, Conversation } from "../lib/types";
import { api } from "../lib/api";
import { useSocket } from "../context/SocketContext";
import { CyberButton } from "../components/CyberButton";
import { MentionInput } from "../components/MentionInput";
import { MentionText, GAME_EMOJIS } from "../components/MentionText";
import { SubscriberNameBadge } from "../components/SubscriberNameBadge";

/** Format an achievement ID like "first_blood" → "First Blood" */
function fmtAchievementId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function handleLocNav(loc: string) {
  (window as any).__setPage?.(loc);
}

/** Small context menu shown on right-click / long-press of a message bubble. */
function MessageContextMenu({ x, y, onReport, onMute, onClose }: {
  x: number; y: number;
  onReport: () => void;
  onMute: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 90),
        background: "#111118",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 4,
        zIndex: 200,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        minWidth: 160,
      }}
    >
      <button
        onClick={onReport}
        className="font-mono text-xs w-full text-left"
        style={{ display: "block", padding: "8px 10px", background: "none", border: "none", color: "#e2e8f0", cursor: "pointer", borderRadius: 4 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      >
        🚩 Report message
      </button>
      <button
        onClick={onMute}
        className="font-mono text-xs w-full text-left"
        style={{ display: "block", padding: "8px 10px", background: "none", border: "none", color: "#ff2d55", cursor: "pointer", borderRadius: 4 }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      >
        🔇 Mute player
      </button>
    </div>
  );
}

function MessageBubble({ message, isOwn, onUsernameClick, onReport, onMute }: {
  message: ChatMessage;
  isOwn: boolean;
  onUsernameClick?: (id: string) => void;
  onReport?: (messageId: string) => void;
  onMute?: (userId: string, username: string) => void;
}) {
  const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff2d55", grid: "#00d4ff" };
  const fc = message.faction ? FACTION_COLOR[message.faction] || "#94a3b8" : "#94a3b8";
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleMentionUser(username: string) {
    if (!onUsernameClick) return;
    try {
      const results = await api.get<Array<{ id: string; username: string }>>(`/user/search?q=${encodeURIComponent(username)}`);
      const exact = results.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (exact) onUsernameClick(exact.id);
    } catch { /* ignore */ }
  }

  function openMenuAt(x: number, y: number) {
    if (isOwn || !onReport) return; // can't report/mute yourself
    setMenuPos({ x, y });
  }

  function handleContextMenu(e: React.MouseEvent) {
    if (isOwn || !onReport) return;
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isOwn || !onReport) return;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => openMenuAt(touch.clientX, touch.clientY), 500);
  }

  function clearLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  const menu = menuPos && (
    <MessageContextMenu
      x={menuPos.x}
      y={menuPos.y}
      onClose={() => setMenuPos(null)}
      onReport={() => { setMenuPos(null); onReport?.(message.id); }}
      onMute={() => { setMenuPos(null); message.userId && onMute?.(message.userId, message.username); }}
    />
  );

  return (
    <div
      className="flex flex-col mb-2"
      style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
    >
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        {message.title && (
          <span className="font-mono" style={{ fontSize: 9, color: "#a855f7" }}>[{message.title}]</span>
        )}
        <SubscriberNameBadge
          username={message.username}
          tier={message.subscriptionTier}
          fontSize={12}
          onClick={() => message.userId && onUsernameClick?.(message.userId)}
        />
        {/* Pinned achievement badges */}
        {message.pinnedBadges && message.pinnedBadges.length > 0 && (
          <span className="flex items-center gap-0.5">
            {message.pinnedBadges.slice(0, 3).map(badgeId => (
              <span
                key={badgeId}
                title={fmtAchievementId(badgeId)}
                style={{
                  fontSize: 10, cursor: "default",
                  background: "#39d35315",
                  border: "1px solid #39d35335",
                  borderRadius: 3,
                  padding: "0 3px",
                  color: "#39d353",
                  fontFamily: "monospace",
                }}
              >
                🏅
              </span>
            ))}
          </span>
        )}
        <span className="font-mono" style={{ fontSize: 9, color: "#334155" }}>
          {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div
        className="font-mono text-xs px-3 py-1.5 rounded"
        style={{
          background: isOwn ? "#00d4ff12" : "#111118",
          border: `1px solid ${isOwn ? "#00d4ff30" : "#1e1e2e"}`,
          color: "#e2e8f0",
          maxWidth: "85%",
          wordBreak: "break-word",
        }}
      >
        <MentionText
          text={message.content}
          onUserClick={handleMentionUser}
          onLocationClick={handleLocNav}
        />
      </div>
      {menu}
    </div>
  );
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onInspectPlayer?: (userId: string) => void;
}

const EMOJI_ORDER = Object.entries(GAME_EMOJIS);

function MessageInput({ onSend, placeholder }: { onSend: (text: string) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const lastSent = useRef(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastSent.current < 3000) return;
    lastSent.current = now;
    onSend(trimmed);
    setText("");
    setShowPicker(false);
  }

  function insertEmoji(slug: string) {
    setText(prev => `${prev}:${slug}: `);
    setShowPicker(false);
  }

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div className="flex gap-2 pt-2.5" style={{ position: "relative" }}>
      {/* Emoji picker popover */}
      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            background: "#111118",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 8,
            zIndex: 50,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {EMOJI_ORDER.map(([slug, def]) => (
            <button
              key={slug}
              title={def.displayName}
              onClick={() => insertEmoji(slug)}
              style={{
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: 4,
                padding: "4px 6px",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1e293b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#334155"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
            >
              {def.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Emoji toggle button */}
      <button
        onClick={() => setShowPicker(p => !p)}
        title="Insert game emoji"
        style={{
          background: showPicker ? "#1e293b" : "transparent",
          border: `1px solid ${showPicker ? "#334155" : "#1e293b"}`,
          borderRadius: 6,
          padding: "0 8px",
          cursor: "pointer",
          fontSize: 16,
          color: "#64748b",
          flexShrink: 0,
        }}
      >
        😀
      </button>

      <div className="flex-1">
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={submit}
          placeholder={placeholder || "Message... (@player /location :emoji:)"}
          maxLength={256}
          style={{ background: "#111118" }}
        />
      </div>
      <CyberButton size="sm" variant="primary" onClick={submit}>
        Send
      </CyberButton>
    </div>
  );
}

interface ModProps {
  onInspect?: (id: string) => void;
  onReport: (messageId: string) => void;
  onMute: (userId: string, username: string) => void;
  isMuted: (userId: string) => boolean;
}

function GlobalTab({ user, onInspect, onReport, onMute, isMuted, muted, onToggleMute }: {
  user: User;
} & ModProps & { muted: boolean; onToggleMute: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const { socket } = useSocket();
  const bottomRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatMessage[]>("/chat/global")
      .then(m => { setMessages(m); setLoading(false); })
      .catch(() => setLoading(false));
    socket?.emit("join_global");
    return () => { socket?.emit("leave_global"); };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => setMessages(prev => [...prev.slice(-49), msg]);
    socket.on("global_message", handler);
    return () => { socket.off("global_message", handler); };
  }, [socket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(content: string) {
    try { await api.post<any>("/chat/global", { content }); } catch { /* ignore */ }
  }

  const visible = messages.filter(m => !isMuted(m.userId));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs" style={{ color: "#475569" }}>Global Chat</span>
        <button
          onClick={onToggleMute}
          title={muted ? "Unmute global chat notifications" : "Mute global chat notifications"}
          className="font-mono text-xs"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: muted ? "#ff2d55" : "#475569",
          }}
        >
          {muted ? "🔕 Muted" : "🔔 Notify"}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
        {loading && <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>Loading...</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder="Global chat..." />
    </div>
  );
}

function DistrictTab({ user, onInspect, onReport, onMute, isMuted }: { user: User } & ModProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const { socket } = useSocket();
  const bottomRef  = useRef<HTMLDivElement>(null);
  const district   = user.currentLocation || user.district;

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
      if (msg.districtId === district) setMessages(prev => [...prev.slice(-49), msg]);
    };
    socket.on("chat_message", handler);
    return () => { socket.off("chat_message", handler); };
  }, [socket, district]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(content: string) {
    try { await api.post<any>(`/chat/district/${district}`, { content }); } catch { /* ignore */ }
  }

  const visible = messages.filter(m => !isMuted(m.userId));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="font-mono text-xs mb-2" style={{ color: "#475569" }}>
        District: <span style={{ color: "#00d4ff" }}>{district}</span>
        <span style={{ color: "#334155", marginLeft: 8 }}>— visible while abroad</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
        {loading && <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>Loading...</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder={`${district} chat...`} />
    </div>
  );
}

function FactionTab({ user, onInspect, onReport, onMute, isMuted }: { user: User } & ModProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const { socket } = useSocket();
  const bottomRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatMessage[]>("/chat/faction")
      .then(m => { setMessages(m); setLoading(false); })
      .catch(e => { setError(e?.message ?? "No faction chat available"); setLoading(false); });
    socket?.emit("join_faction", user.faction);
    return () => { socket?.emit("leave_faction", user.faction); };
  }, [socket, user.faction]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => setMessages(prev => [...prev.slice(-49), msg]);
    socket.on("faction_message", handler);
    return () => { socket.off("faction_message", handler); };
  }, [socket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(content: string) {
    try { await api.post<any>("/chat/faction", { content }); } catch { /* ignore */ }
  }

  const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff2d55", grid: "#00d4ff" };
  const fc = user.faction ? FACTION_COLOR[user.faction] ?? "#00d4ff" : "#00d4ff";
  const visible = messages.filter(m => !isMuted(m.userId));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="font-mono text-xs mb-2" style={{ color: "#475569" }}>
        Faction: <span style={{ color: fc }}>◈ {user.faction?.toUpperCase()}</span>
        <span style={{ color: "#334155", marginLeft: 8 }}>— faction-only</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
        {loading && <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>Loading...</div>}
        {error   && <div className="font-mono text-xs text-center py-5" style={{ color: "#ff2d55" }}>{error}</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      {!error && <MessageInput onSend={send} placeholder={`${user.faction ?? "Faction"} chat...`} />}
    </div>
  );
}

function MessagesTab({ user, onInspect }: { user: User; onInspect?: (id: string) => void }) {
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [activeConv,     setActiveConv]     = useState<string | null>(null);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [loadingConvs,   setLoadingConvs]   = useState(true);
  const [loadingMsgs,    setLoadingMsgs]    = useState(false);
  const [search,         setSearch]         = useState("");
  const [searchResults,  setSearchResults]  = useState<any[]>([]);
  const [searching,      setSearching]      = useState(false);
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
      if (partnerId === activeConv) setMessages(prev => [...prev.slice(-49), message]);
      setConversations(prev => {
        const idx = prev.findIndex(c => c.userId === partnerId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lastMessage: message.content, lastAt: message.at };
          return updated;
        }
        return prev;
      });
    };
    socket.on("dm_message", handler);
    return () => { socket.off("dm_message", handler); };
  }, [socket, activeConv]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function openConversation(userId: string) {
    setActiveConv(userId);
    setLoadingMsgs(true);
    try { setMessages(await api.get<ChatMessage[]>(`/chat/dm/${userId}`)); }
    catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  }

  async function send(content: string) {
    if (!activeConv) return;
    try {
      await api.post<any>(`/chat/dm/${activeConv}`, { content });
      const optimistic: ChatMessage = {
        id: Date.now().toString(), userId: user.id, username: user.username,
        faction: user.faction,
        title: user.equippedTitle,
        content, at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(-49), optimistic]);
    } catch { /* ignore */ }
  }

  async function doSearch(q: string) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<any[]>(`/user/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.filter((r: any) => r.id !== user.id));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  const activeConvData = conversations.find(c => c.userId === activeConv);

  if (activeConv) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setActiveConv(null)}
            className="font-mono text-xs"
            style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            &larr; Back
          </button>
          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
            {activeConvData?.username || "DM"}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 4 }}>
          {loadingMsgs && <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>Loading...</div>}
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} />
          ))}
          <div ref={bottomRef} />
        </div>
        <MessageInput onSend={send} placeholder="Direct message..." />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {/* Search */}
      <div className="mb-3">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
          placeholder="Search players to message..."
          className="font-mono text-xs w-full px-3 py-2 rounded"
          style={{ background: "#111118", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
        />
        {searching && <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>Searching...</div>}
        {searchResults.length > 0 && (
          <div className="mt-1 rounded overflow-hidden" style={{ border: "1px solid #1e1e2e", background: "#111118" }}>
            {searchResults.map(r => (
              <button
                key={r.id}
                onClick={() => { setSearch(""); setSearchResults([]); openConversation(r.id); }}
                className="font-mono text-xs w-full text-left px-3 py-2"
                style={{ display: "block", background: "none", border: "none", borderBottom: "1px solid #1e1e2e", color: "#e2e8f0", cursor: "pointer" }}
              >
                {r.username}
                <span style={{ color: "#475569", marginLeft: 8 }}>Lv.{r.level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation list */}
      {loadingConvs ? (
        <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="font-mono text-xs text-center py-5" style={{ color: "#475569" }}>
          No conversations. Search for a player above to start messaging.
        </div>
      ) : conversations.map(c => {
        const statusColor = c.onlineStatus === "online" ? "#39d353" : c.onlineStatus === "away" ? "#f59e0b" : "#334155";
        const statusLabel = c.onlineStatus === "online" ? "Online" : c.onlineStatus === "away" ? "Away" : "Offline";
        return (
          <motion.button
            key={c.userId}
            onClick={() => openConversation(c.userId)}
            whileHover={{ x: 2, boxShadow: "0 0 0 1px #00d4ff20" }}
            className="flex items-center gap-3 w-full text-left rounded mb-1"
            style={{
              padding: "10px 12px", background: "#111118",
              border: "1px solid #1e1e2e", cursor: "pointer",
            }}
          >
            <div
              title={statusLabel}
              style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: statusColor,
                boxShadow: c.onlineStatus === "online" ? `0 0 6px ${statusColor}` : "none",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-mono font-bold text-xs" style={{ color: "#e2e8f0" }}>{c.username}</div>
              <div className="font-mono text-xs truncate" style={{ color: "#475569" }}>{c.lastMessage}</div>
            </div>
            <div className="font-mono flex-shrink-0" style={{ fontSize: 10, color: "#334155" }}>
              {new Date(c.lastAt).toLocaleDateString()}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

const GLOBAL_MUTE_KEY = "driftlife:globalChatMuted";

export function ChatPage({ user, addToast, onInspectPlayer }: Props) {
  const [tab, setTab] = useState<"global" | "district" | "faction" | "messages">("global");
  const [mutedUserIds, setMutedUserIds] = useState<string[]>(user.mutedUsers ?? []);
  const [globalMuted, setGlobalMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(GLOBAL_MUTE_KEY) === "1"; } catch { return false; }
  });

  // Re-sync from the server-provided user object (e.g. after a fresh /me refetch)
  // so mutes made elsewhere or restored across sessions stay accurate.
  useEffect(() => {
    setMutedUserIds(user.mutedUsers ?? []);
  }, [user.mutedUsers]);

  const isAbroad = user.status === "abroad";
  const district = user.currentLocation || user.district;

  const tabs = [
    { id: "global"   as const, label: "Global"   },
    ...(isAbroad ? [{ id: "district" as const, label: district.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ") }] : []),
    ...(user.faction ? [{ id: "faction"  as const, label: user.faction.charAt(0).toUpperCase() + user.faction.slice(1) }] : []),
    { id: "messages" as const, label: "DMs"      },
  ];

  // If the player returns home while the district tab is active, fall back to Global.
  useEffect(() => {
    if (tab === "district" && !isAbroad) setTab("global");
  }, [tab, isAbroad]);

  function isMuted(userId: string) {
    return mutedUserIds.includes(userId);
  }

  async function handleMute(userId: string, username: string) {
    if (isMuted(userId)) return;
    setMutedUserIds(prev => [...prev, userId]);
    try {
      await api.post<any>(`/chat/mute/${userId}`, {});
      addToast(`Muted ${username}. Their messages are now hidden from your view.`, "info");
    } catch {
      setMutedUserIds(prev => prev.filter(id => id !== userId));
      addToast("Failed to mute player", "error");
    }
  }

  async function handleReport(messageId: string) {
    try {
      await api.post<any>("/chat/report", { messageId });
      addToast("Report submitted.", "success");
    } catch {
      addToast("Failed to submit report", "error");
    }
  }

  function toggleGlobalMute() {
    setGlobalMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(GLOBAL_MUTE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  const modProps = { onInspect: onInspectPlayer, onReport: handleReport, onMute: handleMute, isMuted };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      <div className="flex gap-1.5 mb-3">
        {tabs.map(t => (
          <CyberButton
            key={t.id}
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            glow={tab === t.id}
            className="flex-1"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </CyberButton>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "global"   && <GlobalTab   user={user} {...modProps} muted={globalMuted} onToggleMute={toggleGlobalMute} />}
        {tab === "district" && isAbroad && <DistrictTab user={user} {...modProps} />}
        {tab === "faction"  && <FactionTab  user={user} {...modProps} />}
        {tab === "messages" && <MessagesTab user={user} onInspect={onInspectPlayer} />}
      </div>
    </div>
  );
}
