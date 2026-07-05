import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FeedEvent, User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrameRenderer } from "../components/ChatFrameRenderer";
import { MentionInput } from "../components/MentionInput";
import { MentionText } from "../components/MentionText";

const REACTIONS = ["like", "laugh", "shock", "respect"] as const;
const REACTION_LABEL: Record<string, string> = { like: "+", laugh: "heh", shock: "!!!", respect: "/\\/" };

interface Props { user?: User; onInspectPlayer?: (id: string) => void; }

export function FeedPage({ user, onInspectPlayer }: Props) {
  const [events,      setEvents]      = useState<FeedEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [postContent, setPostContent] = useState("");
  const [posting,     setPosting]     = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.get<FeedEvent[]>("/feed?limit=100")
      .then(data => setEvents(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

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

  function handleUserMention(username: string) {
    const found = events.find(e => e.actor?.toLowerCase() === username.toLowerCase());
    if (found && found.actorId) onInspectPlayer?.(found.actorId);
  }

  function handleLocationMention(loc: string) {
    (window as any).__setPage?.(loc);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
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

      {/* Post composer */}
      <div style={{ background: "#111118", borderRadius: 8, padding: 16, border: "1px solid #1e1e2e" }}>
        <MentionInput
          value={postContent}
          onChange={setPostContent}
          onSubmit={sendPost}
          placeholder="What's happening in New Vanta... (@player /location)"
          maxLength={280}
          multiline
        />
        <div className="flex justify-between items-center mt-2">
          <span className="font-mono text-xs" style={{ color: "#64748b" }}>
            {postContent.length}/280 · <span style={{ color: "#475569" }}>@player · /location</span>
          </span>
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

      {/* Feed events — posts only */}
      {loading && events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#1e1e2e" }}>Loading feed...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>
          No posts yet. Be the first to share something in New Vanta.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => {
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
                    {/* Avatar / frame */}
                    {ev.actorChatFrame ? null : (
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", background: "#1e1e2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, flexShrink: 0, border: "1px solid #334155",
                      }}>
                        {ev.actorAvatarUrl
                          ? <img src={ev.actorAvatarUrl} alt={ev.actor} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          : (ev.actor?.charAt(0).toUpperCase() ?? "?")}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {ev.actorChatFrame ? (
                        <div className="mb-1 cursor-pointer" onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}>
                          <ChatFrameRenderer frameId={ev.actorChatFrame} username={ev.actor} level={ev.actorLevel} compact>
                            <MentionText
                              text={ev.message}
                              onUserClick={handleUserMention}
                              onLocationClick={handleLocationMention}
                            />
                          </ChatFrameRenderer>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <button
                              className="font-mono text-xs font-bold hover:underline text-left"
                              style={{ color: "#94a3b8", background: "none", border: "none", padding: 0, cursor: ev.actorId ? "pointer" : "default" }}
                              onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}
                            >
                              {ev.actor}
                            </button>
                          </div>
                          <p className="font-mono text-xs" style={{ color: "#e2e8f0" }}>
                            <MentionText
                              text={ev.message}
                              onUserClick={handleUserMention}
                              onLocationClick={handleLocationMention}
                            />
                          </p>
                        </>
                      )}
                    </div>

                    <span className="font-mono text-xs flex-shrink-0" style={{ color: "#334155" }}>
                      {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Reaction + comment bar */}
                  <div
                    className="flex items-center gap-3 px-4 pb-2 flex-wrap"
                    style={{ borderTop: "1px solid #1e1e2e30" }}
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
                      style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
                    >
                      {comments.length > 0 ? `${comments.length} reply${comments.length > 1 ? "s" : ""}` : "Reply"}
                    </button>
                    <div className="flex-1" />
                    {ev.type === "post" && ev.actorId && user && String(ev.actorId) === user.id && (
                      <button
                        onClick={() => deletePost(ev.id)}
                        className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{ color: "#ff2d55", border: "1px solid #ff2d5530", background: "transparent", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    )}
                    <span className="font-mono" style={{ fontSize: 9, color: "#334155" }}>
                      {(() => {
                        const remaining = 86400000 - (Date.now() - new Date(ev.createdAt).getTime());
                        if (remaining <= 0) return "expiring";
                        const h = Math.floor(remaining / 3600000);
                        const m = Math.floor((remaining % 3600000) / 60000);
                        return h > 0 ? `${h}h left` : `${m}m left`;
                      })()}
                    </span>
                  </div>

                  {/* Comments */}
                  {(isCommentOpen || comments.length > 0) && (
                    <div style={{ borderTop: "1px solid #1e1e2e", padding: "8px 16px" }}>
                      {comments.slice(-3).map((c, ci) => (
                        <div key={ci} className="font-mono text-xs mb-1">
                          <span style={{ color: "#00d4ff" }}>{c.username}:</span>{" "}
                          <span style={{ color: "#94a3b8" }}>
                            <MentionText
                              text={c.content}
                              onUserClick={handleUserMention}
                              onLocationClick={handleLocationMention}
                            />
                          </span>
                        </div>
                      ))}
                      {isCommentOpen && (
                        <div style={{ position: "relative" }} className="mt-2">
                          <MentionInput
                            value={commentText}
                            onChange={setCommentText}
                            onSubmit={() => sendComment(ev.id)}
                            placeholder="Reply... (@player /location)"
                            maxLength={280}
                          />
                          <div className="flex justify-end mt-1">
                            <CyberButton size="sm" variant="ghost" onClick={() => sendComment(ev.id)}>
                              Send
                            </CyberButton>
                          </div>
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
