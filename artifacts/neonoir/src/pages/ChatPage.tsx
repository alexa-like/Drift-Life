import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, ChatMessage, Conversation } from "../lib/types";
import { api } from "../lib/api";
import { useSocket } from "../context/SocketContext";
import { CyberButton } from "../components/CyberButton";
import { MentionInput } from "../components/MentionInput";
import { MentionText, GAME_EMOJIS } from "../components/MentionText";
import { SubscriberNameBadge } from "../components/SubscriberNameBadge";

function fmtAchievementId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function handleLocNav(loc: string) {
  (window as any).__setPage?.(loc);
}

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
      className="clip-card"
      style={{
        position: "fixed",
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 90),
        background: "#111118",
        border: "1px solid #00d4ff50",
        padding: 8,
        zIndex: 200,
        boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
        minWidth: 160,
      }}
    >
      <button
        onClick={onReport}
        className="font-mono text-xs w-full text-left uppercase tracking-widest clip-btn hover:bg-slate-800 transition-colors mb-2"
        style={{ padding: "8px 10px", color: "#e2e8f0" }}
      >
        🚩 REPORT
      </button>
      <button
        onClick={onMute}
        className="font-mono text-xs w-full text-left uppercase tracking-widest clip-btn hover:bg-red-900/20 transition-colors"
        style={{ padding: "8px 10px", color: "#ff2d55" }}
      >
        🔇 MUTE
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
  const fc = message.faction ? FACTION_COLOR[message.faction] || "#00d4ff" : "#00d4ff";
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
    if (isOwn || !onReport) return;
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
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="flex flex-col mb-4 relative group"
      style={{ alignItems: isOwn ? "flex-end" : "flex-start" }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
    >
      <div className="flex items-center gap-2 mb-1 flex-wrap pl-2">
        {message.title && (
          <span className="font-mono uppercase font-bold" style={{ fontSize: 9, color: "#a855f7", textShadow: "0 0 5px #a855f7" }}>[{message.title}]</span>
        )}
        <SubscriberNameBadge
          username={message.username}
          tier={message.subscriptionTier}
          fontSize={12}
          onClick={() => message.userId && onUsernameClick?.(message.userId)}
        />
        {message.pinnedBadges && message.pinnedBadges.length > 0 && (
          <span className="flex items-center gap-1">
            {message.pinnedBadges.slice(0, 3).map(badgeId => (
              <span
                key={badgeId}
                title={fmtAchievementId(badgeId)}
                className="clip-btn"
                style={{
                  fontSize: 10, cursor: "default",
                  background: "#f59e0b20",
                  border: "1px solid #f59e0b50",
                  padding: "2px 4px",
                  color: "#f59e0b",
                  fontFamily: "monospace",
                }}
              >
                ✦
              </span>
            ))}
          </span>
        )}
        <span className="font-mono ml-2 opacity-50 group-hover:opacity-100 transition-opacity" style={{ fontSize: 9, color: "#64748b" }}>
          {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      
      <div
        className="font-mono text-sm px-4 py-2 clip-btn relative overflow-hidden"
        style={{
          background: isOwn ? "#00d4ff10" : "#111118",
          border: `1px solid ${isOwn ? "#00d4ff40" : "#1e1e2e"}`,
          color: "#e2e8f0",
          maxWidth: "85%",
          wordBreak: "break-word",
          boxShadow: isOwn ? "0 0 15px rgba(0,212,255,0.05)" : "none"
        }}
      >
        {/* Subtle scanline on bubble */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "linear-gradient(transparent 50%, rgba(0,0,0,0.2) 50%)", backgroundSize: "100% 4px" }} />
        
        <div className="relative z-10">
          <MentionText
            text={message.content}
            onUserClick={handleMentionUser}
            onLocationClick={handleLocNav}
          />
        </div>
      </div>
      {menu}
    </motion.div>
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
    <div className="flex gap-3 pt-4 border-t border-[#1e1e2e]" style={{ position: "relative" }}>
      {showPicker && (
        <div
          ref={pickerRef}
          className="clip-card"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            background: "#111118",
            border: "1px solid #00d4ff50",
            padding: 12,
            zIndex: 50,
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}
        >
          {EMOJI_ORDER.map(([slug, def]) => (
            <button
              key={slug}
              title={def.displayName}
              onClick={() => insertEmoji(slug)}
              className="clip-btn hover:bg-slate-800 transition-colors flex justify-center py-2 text-xl"
            >
              {def.emoji}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowPicker(p => !p)}
        className="clip-btn bg-[#111118] border border-[#1e1e2e] hover:border-[#00d4ff50] transition-colors px-4 flex items-center text-lg"
      >
        ☻
      </button>

      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#00d4ff] font-bold animate-pulse">{">"}</span>
        <div className="pl-8">
          <MentionInput
            value={text}
            onChange={setText}
            onSubmit={submit}
            placeholder={placeholder || "TRANSMIT DATA..."}
            maxLength={256}
          />
        </div>
      </div>
      
      <CyberButton size="md" variant="primary" onClick={submit}>
        SEND
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
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse shadow-[0_0_8px_#00d4ff]" />
           <span className="font-display font-bold text-sm text-[#00d4ff] uppercase tracking-widest">Global Network</span>
        </div>
        <button
          onClick={onToggleMute}
          className="font-mono text-xs uppercase clip-btn px-3 py-1 border transition-colors"
          style={{
            borderColor: muted ? "#ff2d5550" : "#39d35350",
            color: muted ? "#ff2d55" : "#39d353",
            background: muted ? "#ff2d5510" : "#39d35310"
          }}
        >
          {muted ? "NOTIFS: OFF" : "NOTIFS: ON"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-hide">
        {loading && <div className="font-mono text-sm text-center py-10 text-[#00d4ff] animate-pulse">CONNECTING...</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder="BROADCAST TO GLOBAL..." />
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
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse shadow-[0_0_8px_#f59e0b]" />
           <span className="font-display font-bold text-sm text-[#f59e0b] uppercase tracking-widest">Local: {district}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-hide">
        {loading && <div className="font-mono text-sm text-center py-10 text-[#f59e0b] animate-pulse">CONNECTING...</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={send} placeholder="BROADCAST TO LOCAL..." />
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
  const fc = user.faction ? FACTION_COLOR[user.faction] ?? "#a855f7" : "#a855f7";
  const visible = messages.filter(m => !isMuted(m.userId));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ background: fc, color: fc }} />
           <span className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: fc }}>Faction: {user.faction}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-hide">
        {loading && <div className="font-mono text-sm text-center py-10 animate-pulse" style={{ color: fc }}>CONNECTING...</div>}
        {error   && <div className="font-mono text-sm text-center py-10 text-[#ff2d55] border border-[#ff2d5550] bg-[#ff2d5510] clip-card">{error}</div>}
        {visible.map(m => (
          <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} onReport={onReport} onMute={onMute} />
        ))}
        <div ref={bottomRef} />
      </div>
      {!error && <MessageInput onSend={send} placeholder="ENCRYPTED COMMS..." />}
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
        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-[#1e1e2e]">
          <CyberButton size="sm" variant="ghost" onClick={() => setActiveConv(null)}>
            ◄ BACK
          </CyberButton>
          <span className="font-display font-bold text-lg text-white uppercase tracking-widest">
            {activeConvData?.username || "SECURE_DM"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-hide">
          {loadingMsgs && <div className="font-mono text-sm text-center py-10 text-[#00d4ff] animate-pulse">CONNECTING...</div>}
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} isOwn={m.userId === user.id} onUsernameClick={onInspect} />
          ))}
          <div ref={bottomRef} />
        </div>
        <MessageInput onSend={send} placeholder="DIRECT TRANSMISSION..." />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
           <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#00d4ff] font-bold">{">"}</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
            placeholder="LOCATE OPERATIVE..."
            className="font-mono text-sm w-full py-3 pl-8 bg-[#111118] uppercase tracking-wider"
          />
        </div>
        {searching && <div className="font-mono text-xs mt-2 text-[#00d4ff] animate-pulse">SCANNING NETWORK...</div>}
        {searchResults.length > 0 && (
          <div className="mt-2 clip-card border border-[#1e1e2e] bg-[#0d0d14] max-h-[200px] overflow-y-auto">
            {searchResults.map(r => (
              <button
                key={r.id}
                onClick={() => { setSearch(""); setSearchResults([]); openConversation(r.id); }}
                className="font-mono text-sm w-full text-left px-4 py-3 border-b border-[#1e1e2e] hover:bg-[#1e1e2e] transition-colors flex justify-between uppercase"
                style={{ color: "#e2e8f0" }}
              >
                <span>{r.username}</span>
                <span className="text-[#00d4ff]">LVL {r.level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="font-display font-bold text-[#64748b] text-xs uppercase tracking-widest mb-3">RECENT COMMS</div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-2">
        {loadingConvs ? (
          <div className="font-mono text-sm text-center py-10 text-[#00d4ff] animate-pulse">LOADING...</div>
        ) : conversations.length === 0 ? (
          <div className="font-mono text-sm text-center py-10 text-[#475569] border border-dashed border-[#1e1e2e] clip-card">
            NO SECURE CHANNELS ESTABLISHED
          </div>
        ) : conversations.map(c => {
          const statusColor = c.onlineStatus === "online" ? "#39d353" : c.onlineStatus === "away" ? "#f59e0b" : "#334155";
          return (
            <motion.button
              key={c.userId}
              onClick={() => openConversation(c.userId)}
              whileHover={{ x: 4, borderColor: "#00d4ff" }}
              className="flex items-center gap-4 w-full text-left clip-btn transition-colors group bg-[#111118]"
              style={{ padding: "12px 16px", border: "1px solid #1e1e2e" }}
            >
              <div
                style={{
                  width: 10, height: 10, flexShrink: 0,
                  background: statusColor,
                  boxShadow: c.onlineStatus === "online" ? `0 0 10px ${statusColor}` : "none",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" // Diamond status indicator
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm text-white uppercase tracking-wider mb-1 group-hover:text-[#00d4ff] transition-colors">{c.username}</div>
                <div className="font-mono text-xs text-[#64748b] truncate">{c.lastMessage}</div>
              </div>
              <div className="font-mono text-[10px] text-[#475569] uppercase flex-shrink-0">
                {new Date(c.lastAt).toLocaleDateString()}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const GLOBAL_MUTE_KEY = "neonoir:globalChatMuted";

export function ChatPage({ user, addToast, onInspectPlayer }: Props) {
  const [tab, setTab] = useState<"global" | "district" | "faction" | "messages">("global");
  const [mutedUserIds, setMutedUserIds] = useState<string[]>(user.mutedUsers ?? []);
  const [globalMuted, setGlobalMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(GLOBAL_MUTE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    setMutedUserIds(user.mutedUsers ?? []);
  }, [user.mutedUsers]);

  const isAbroad = user.status === "abroad";
  const district = user.currentLocation || user.district;

  const tabs = [
    { id: "global"   as const, label: "GLOBAL"   },
    ...(isAbroad ? [{ id: "district" as const, label: "LOCAL" }] : []),
    ...(user.faction ? [{ id: "faction"  as const, label: "FACTION" }] : []),
    { id: "messages" as const, label: "SECURE"      },
  ];

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
      addToast(`Muted ${username}. Comms blocked.`, "info");
    } catch {
      setMutedUserIds(prev => prev.filter(id => id !== userId));
      addToast("ERR: Mute failed", "error");
    }
  }

  async function handleReport(messageId: string) {
    try {
      await api.post<any>("/chat/report", { messageId });
      addToast("Report submitted.", "success");
    } catch {
      addToast("ERR: Report failed", "error");
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
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col clip-card border border-[#1e1e2e] bg-[#08080c] relative overflow-hidden z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Decorative background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none data-stream" />

      {/* Tab bar */}
      <div className="flex border-b border-[#1e1e2e] bg-[#0d0d14] relative z-10">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase transition-colors relative"
            style={{ 
              color: tab === t.id ? "#fff" : "#475569",
              background: tab === t.id ? "#111118" : "transparent"
            }}
          >
            {t.label}
            {tab === t.id && (
              <motion.div 
                layoutId="chatTab" 
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00d4ff]" 
                style={{ boxShadow: "0 0 10px #00d4ff" }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 sm:p-6 overflow-hidden relative z-10">
        {tab === "global"   && <GlobalTab   user={user} {...modProps} muted={globalMuted} onToggleMute={toggleGlobalMute} />}
        {tab === "district" && isAbroad && <DistrictTab user={user} {...modProps} />}
        {tab === "faction"  && <FactionTab  user={user} {...modProps} />}
        {tab === "messages" && <MessagesTab user={user} onInspect={onInspectPlayer} />}
      </div>
    </div>
  );
}
