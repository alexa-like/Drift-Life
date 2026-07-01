import { useState, useEffect } from "react";
import { FeedEvent, User } from "../lib/types";
import { api } from "../lib/api";
import { FrameCardWrapper } from "../components/FrameCardWrapper";
import { AvatarWithFrame } from "../components/AvatarWithFrame";
import { formatDC } from "../lib/format";
import { getFrame } from "../lib/frames";

const TYPE_COLORS: Record<string, string> = {
  crime: "#ff2d55", fight: "#ff6b35", job: "#39d353",
  market: "#00d4ff", bank: "#f59e0b", system: "#a855f7",
  level_up: "#f59e0b", hospital: "#ff2d55", post: "#94a3b8",
};
const REACTIONS = ["like", "laugh", "shock", "respect"] as const;
const REACTION_EMOJI: Record<string, string> = { like: "👍", laugh: "😂", shock: "😱", respect: "🫡" };

interface Props { user?: User; onInspectPlayer?: (id: string) => void; }

export function FeedPage({ user, onInspectPlayer }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = () => {
    setLoading(true);
    api.get<FeedEvent[]>("/feed?limit=50")
      .then(setEvents).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function sendPost() {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      await api.post("/feed", { content: postContent.trim() });
      setPostContent("");
      load();
    } catch { /* ignore */ } finally {
      setPosting(false);
    }
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

  // composer frame is the current user's feed-surface frame
  const myFrame = (user?.equippedFrames?.feed && user.equippedFrames.feed !== "ghostFrame") ? user.equippedFrames.feed : (user?.equippedFrame || null);
  const myFrameColor = user?.equippedFrameColor || null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg" style={{ color: "#94a3b8" }}>CITY FEED</h2>
        <button onClick={load} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>
          Refresh
        </button>
      </div>

      {/* Post composer — wrapped in user's own frame */}
      <FrameCardWrapper frameId={myFrame} colorOverride={myFrameColor}>
        <div style={{ background: "#111118", borderRadius: 8, padding: 16 }}>
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
            <button
              onClick={sendPost}
              disabled={posting || !postContent.trim()}
              className="font-mono text-xs px-3 py-1 rounded"
              style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff30" }}
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </FrameCardWrapper>

      {loading && events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#1e1e2e" }}>Loading feed...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>
          No events yet. Start playing to fill the feed.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => {
            const tc = TYPE_COLORS[ev.type] ?? "#94a3b8";
            const isCommentOpen = commentOpen === ev.id;
            const reactions = ev.reactions || { like: 0, laugh: 0, shock: 0, respect: 0 };
            const comments = ev.comments || [];
            const evFrame = ev.actorFrame || null;
            const evFrameColor = ev.actorFrameColor || null;
            const evFrameDef = evFrame ? getFrame(evFrame) : null;

            return (
              <FrameCardWrapper
                key={ev.id}
                frameId={evFrame}
                colorOverride={evFrameColor}
                borderRadius={8}
              >
                <div style={{ background: "#111118", borderRadius: 8 }}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Actor avatar with frame */}
                    {ev.actor && (
                      <AvatarWithFrame
                        username={ev.actor}
                        avatarUrl={ev.actorAvatarUrl}
                        frameId={evFrame}
                        frameColor={evFrameColor}
                        size="xs"
                      />
                    )}
                    {!ev.actor && (
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: tc, boxShadow: `0 0 4px ${tc}` }} />
                    )}
                    <div className="flex-1 min-w-0">
                      {ev.actor && (
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <button
                            className="font-mono text-xs font-bold hover:underline text-left"
                            style={{ color: evFrameDef ? (evFrameColor || evFrameDef.glowColor) : "#94a3b8", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                            onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}
                          >
                            {ev.actor}
                          </button>
                          {evFrameDef && (
                            <span
                              className="font-mono px-1 rounded"
                              style={{
                                fontSize: 9,
                                background: (evFrameColor || evFrameDef.glowColor) + "20",
                                color: evFrameColor || evFrameDef.glowColor,
                                border: `1px solid ${(evFrameColor || evFrameDef.glowColor)}40`,
                                textTransform: "capitalize",
                              }}
                            >
                              {evFrameDef.name}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{ev.message}</p>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {ev.dc > 0 && <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>+{formatDC(ev.dc)} DC</span>}
                        {ev.xp > 0 && <span className="font-mono text-xs" style={{ color: "#a855f7" }}>+{ev.xp} XP</span>}
                      </div>
                    </div>
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: "#334155" }}>
                      {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Reactions + comments bar */}
                  <div className="flex items-center gap-3 px-4 pb-2 flex-wrap" style={{ borderTop: "1px solid #1e1e2e08" }}>
                    <div className="flex gap-1">
                      {REACTIONS.map(r => (
                        <button
                          key={r}
                          onClick={() => react(ev.id, r)}
                          className="font-mono rounded px-1.5 py-0.5 transition-all"
                          style={{ fontSize: 12, background: reactions[r] > 0 ? "#1e1e2e" : "transparent", border: "1px solid transparent" }}
                          title={r}
                        >
                          {REACTION_EMOJI[r]}{reactions[r] > 0 && <span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>{reactions[r]}</span>}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCommentOpen(isCommentOpen ? null : ev.id)}
                      className="font-mono text-xs"
                      style={{ color: "#64748b" }}
                    >
                      {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Reply"}
                    </button>
                    <div className="flex-1" />
                    {ev.type === "post" && ev.actorId && user && String(ev.actorId) === user.id && (
                      <button
                        onClick={() => deletePost(ev.id)}
                        className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{ color: "#ff2d55", border: "1px solid #ff2d5530", background: "transparent" }}
                        title="Delete post"
                      >
                        Delete
                      </button>
                    )}
                    <span className="font-mono text-xs" style={{ color: "#1e1e2e", fontSize: 10 }}>
                      {(() => {
                        const diff = Date.now() - new Date(ev.createdAt).getTime();
                        const remaining = 86400000 - diff;
                        if (remaining <= 0) return "expiring";
                        const h = Math.floor(remaining / 3600000);
                        return `${h}h left`;
                      })()}
                    </span>
                  </div>

                  {/* Comments */}
                  {(isCommentOpen || comments.length > 0) && (
                    <div style={{ borderTop: "1px solid #1e1e2e", padding: "8px 16px" }}>
                      {comments.slice(-3).map((c, i) => (
                        <div key={i} className="font-mono text-xs mb-1">
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
                          <button onClick={() => sendComment(ev.id)} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>Send</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FrameCardWrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
