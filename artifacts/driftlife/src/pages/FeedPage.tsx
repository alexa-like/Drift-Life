import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FeedEvent, User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrameRenderer } from "../components/ChatFrameRenderer";

const TYPE_COLORS: Record<string, string> = {
  post:   "#94a3b8",
  crime:  "#ff6b35",
  job:    "#39d353",
  combat: "#ff2d55",
  system: "#a855f7",
  bank:   "#f59e0b",
  market: "#00d4ff",
};

const FEED_FILTERS: { id: string; label: string }[] = [
  { id: "all",    label: "ALL"    },
  { id: "post",   label: "POSTS"  },
  { id: "crime",  label: "CRIMES" },
  { id: "combat", label: "FIGHTS" },
  { id: "job",    label: "JOBS"   },
];

const REACTIONS = ["like", "laugh", "shock", "respect"] as const;
const REACTION_LABEL: Record<string, string> = { like: "+", laugh: "heh", shock: "!!!", respect: "/\\/" };

interface Props { user?: User; onInspectPlayer?: (id: string) => void; }

export function FeedPage({ user, onInspectPlayer }: Props) {
  const [events,      setEvents]      = useState<FeedEvent[]>([]);
  const [allEvents,   setAllEvents]   = useState<FeedEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [postContent, setPostContent] = useState("");
  const [posting,     setPosting]     = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [typeFilter,  setTypeFilter]  = useState<string>("all");

  const load = () => {
    setLoading(true);
    api.get<FeedEvent[]>("/feed?limit=100")
      .then(data => { setAllEvents(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setEvents(typeFilter === "all" ? allEvents : allEvents.filter(e => e.type === typeFilter));
  }, [typeFilter, allEvents]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function sendPost() {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      await api.post("/feed", { content: postContent.trim() });
      setPostContent("");
      load();
    } catch { /* ignore */ } finally { setPosting(false); }
  }

  async function react(eventId: string, reaction: string) {
    try {
      await api.post(`/feed/${eventId}/react`, { reaction });
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e;
        const r = { ...e.reactions };
        r[reaction as keyof typeof r] = (r[reaction as keyof typeof r] || 0) + 1;
        return { ...e, reactions: r };
      }));
    } catch { /* ignore */ }
  }

  async function sendComment(eventId: string) {
    if (!commentText.trim()) return;
    try {
      await api.post(`/feed/${eventId}/comment`, { content: commentText.trim() });
      setCommentText("");
      load();
      setCommentOpen(null);
    } catch { /* ignore */ }
  }

  async function deletePost(eventId: string) {
    try {
      await api.delete(`/feed/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <CyberSectionHeader
        title="CITY FEED"
        accent="#00d4ff"
        cursor
        right={
          <CyberButton variant="ghost" size="sm" onClick={load} loading={loading}>
            Refresh
          </CyberButton>
        }
      />

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        {FEED_FILTERS.map(f => {
          const color    = TYPE_COLORS[f.id] ?? "#64748b";
          const isActive = typeFilter === f.id;
          const count    = f.id !== "all" ? allEvents.filter(e => e.type === f.id).length : 0;
          return (
            <motion.button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="font-mono text-xs px-3 py-1 rounded transition-colors"
              style={{
                background: isActive ? (f.id === "all" ? "#ffffff08" : `${color}18`) : "transparent",
                color:      isActive ? (f.id === "all" ? "#94a3b8"   : color)        : "#475569",
                border:     `1px solid ${isActive ? (f.id === "all" ? "#1e1e2e" : `${color}40`) : "#1e1e2e"}`,
              }}
            >
              {f.label}
              {count > 0 && <span style={{ marginLeft: 4, opacity: 0.6 }}>{count}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Post composer */}
      <div style={{ background: "#111118", borderRadius: 8, padding: 16, border: "1px solid #1e1e2e" }}>
          <textarea
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="What's happening in New Vanta..."
            className="w-full font-mono text-xs p-2 rounded mb-2"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", resize: "none" }}
          />
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>{postContent.length}/280</span>
            <CyberButton
              size="sm"
              variant="primary"
              loading={posting}
              disabled={!postContent.trim()}
              onClick={sendPost}
            >
              Post
            </CyberButton>
          </div>
      </div>

      {/* Feed events */}
      {loading && events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#1e1e2e" }}>Loading feed...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>
          No posts yet. Be the first to share something in New Vanta.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => {
            const tc          = TYPE_COLORS[ev.type] ?? "#94a3b8";
            const isCommentOpen = commentOpen === ev.id;
            const reactions   = ev.reactions || { like: 0, laugh: 0, shock: 0, respect: 0 };
            const comments    = ev.comments || [];
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
              >
                <div style={{ background: "#111118", borderRadius: 8, border: "1px solid #1e1e2e" }}>
                  {/* Main content */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    {ev.actor && !ev.actorChatFrame ? (
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", background: "#1e1e2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, flexShrink: 0, border: "1px solid #334155",
                      }}>
                        {ev.actorAvatarUrl
                          ? <img src={ev.actorAvatarUrl} alt={ev.actor} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          : ev.actor.charAt(0).toUpperCase()}
                      </div>
                    ) : !ev.actor ? (
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: tc, boxShadow: `0 0 4px ${tc}` }}
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      {ev.actor && ev.actorChatFrame ? (
                        <div className="mb-1 cursor-pointer" onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}>
                          <ChatFrameRenderer frameId={ev.actorChatFrame} username={ev.actor} level={ev.actorLevel} compact>
                            {ev.message}
                          </ChatFrameRenderer>
                        </div>
                      ) : (
                        <>
                          {ev.actor && (
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <button
                                className="font-mono text-xs font-bold hover:underline text-left"
                                style={{ color: "#94a3b8", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                                onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}
                              >
                                {ev.actor}
                              </button>
                            </div>
                          )}
                          <p className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{ev.message}</p>
                        </>
                      )}
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          {ev.dc > 0 && <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>+{formatDC(ev.dc)} DC</span>}
                          {ev.xp > 0 && <span className="font-mono text-xs" style={{ color: "#a855f7" }}>+{ev.xp} XP</span>}
                        </div>
                      </div>
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: "#334155" }}>
                        {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Reaction + comment bar */}
                    <div
                      className="flex items-center gap-3 px-4 pb-2 flex-wrap"
                      style={{ borderTop: "1px solid #1e1e2e08" }}
                    >
                      <div className="flex gap-1">
                        {REACTIONS.map(r => (
                          <button
                            key={r}
                            onClick={() => react(ev.id, r)}
                            className="font-mono rounded px-1.5 py-0.5 transition-all"
                            style={{
                              fontSize: 10,
                              background: reactions[r] > 0 ? "#1e1e2e" : "transparent",
                              border: "1px solid transparent",
                              color: reactions[r] > 0 ? "#94a3b8" : "#334155",
                            }}
                            title={r}
                          >
                            {REACTION_LABEL[r]}
                            {reactions[r] > 0 && (
                              <span style={{ fontSize: 9, color: "#64748b", marginLeft: 2 }}>{reactions[r]}</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCommentOpen(isCommentOpen ? null : ev.id)}
                        className="font-mono text-xs"
                        style={{ color: "#64748b" }}
                      >
                        {comments.length > 0 ? `${comments.length} reply${comments.length > 1 ? "s" : ""}` : "Reply"}
                      </button>
                      <div className="flex-1" />
                      {ev.type === "post" && ev.actorId && user && String(ev.actorId) === user.id && (
                        <button
                          onClick={() => deletePost(ev.id)}
                          className="font-mono text-xs px-2 py-0.5 rounded"
                          style={{ color: "#ff2d55", border: "1px solid #ff2d5530", background: "transparent" }}
                        >
                          Delete
                        </button>
                      )}
                      <span className="font-mono" style={{ fontSize: 10, color: "#1e1e2e" }}>
                        {(() => {
                          const remaining = 86400000 - (Date.now() - new Date(ev.createdAt).getTime());
                          if (remaining <= 0) return "expiring";
                          return `${Math.floor(remaining / 3600000)}h left`;
                        })()}
                      </span>
                    </div>

                    {/* Comments */}
                    {(isCommentOpen || comments.length > 0) && (
                      <div style={{ borderTop: "1px solid #1e1e2e", padding: "8px 16px" }}>
                        {comments.slice(-3).map((c, ci) => (
                          <div key={ci} className="font-mono text-xs mb-1">
                            <span style={{ color: "#00d4ff" }}>{c.username}:</span>{" "}
                            <span style={{ color: "#94a3b8" }}>{c.content}</span>
                          </div>
                        ))}
                        {isCommentOpen && (
                          <div className="flex gap-2 mt-2">
                            <input
                              value={commentText}
                              onChange={e => setCommentText(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && sendComment(ev.id)}
                              placeholder="Reply..."
                              maxLength={280}
                              className="flex-1 px-2 py-1 rounded font-mono text-xs"
                              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                            />
                            <CyberButton size="sm" variant="ghost" onClick={() => sendComment(ev.id)}>
                              Send
                            </CyberButton>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
