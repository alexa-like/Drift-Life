import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FeedEvent, User } from "../lib/types";
import { api } from "../lib/api";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { MentionText } from "../components/MentionText";
import { ChatFrameRenderer } from "../components/ChatFrameRenderer";

interface Props { user?: User; onInspectPlayer?: (id: string) => void; }

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  crime:       { label: "🔫 CRIMES",    color: "#ff6b35" },
  fight:       { label: "⚔️ ARENA",     color: "#ff2d55" },
  race:        { label: "🏁 RACING",    color: "#00d4ff" },
  market:      { label: "💰 MARKET",    color: "#ffd700" },
  bank:        { label: "🏦 BANK",      color: "#22c55e" },
  achievement: { label: "🏆 ACHIEVE",   color: "#a855f7" },
  level_up:    { label: "⬆️ LEVEL",     color: "#22c55e" },
  hospital:    { label: "🏥 HOSPITAL",  color: "#f43f5e" },
  travel:      { label: "✈️ TRAVEL",    color: "#38bdf8" },
  daily:       { label: "📅 DAILY",     color: "#64748b" },
  system:      { label: "📡 SYSTEM",    color: "#00d4ff" },
  hack:        { label: "💻 NET",       color: "#a3e635" },
  garage:      { label: "🚗 GARAGE",    color: "#fb923c" },
  job:         { label: "💼 JOB",       color: "#94a3b8" },
  post:        { label: "📝 PLAYER",    color: "#39d353" },
};

function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function FeedPage({ user, onInspectPlayer }: Props) {
  const [events,  setEvents]  = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [draft,   setDraft]   = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  const load = useCallback((p = 1, append = false) => {
    setLoading(true);
    api.get<FeedEvent[]>(`/feed?page=${p}&limit=30`)
      .then(data => {
        if (append) {
          setEvents(prev => [...prev, ...data]);
        } else {
          setEvents(data);
        }
        setHasMore(data.length === 30);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(1);
    const interval = setInterval(() => load(1), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  }

  function handleUserMention(username: string) {
    const found = events.find(e => e.actor?.toLowerCase() === username.toLowerCase());
    if (found && found.actorId) onInspectPlayer?.(found.actorId);
  }

  function handleLocationMention(loc: string) {
    (window as any).__setPage?.(loc);
  }

  async function submitPost() {
    const trimmed = draft.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setPostErr(null);
    try {
      await api.post("/feed/post", { message: trimmed });
      setDraft("");
      load(1);
    } catch (err: any) {
      setPostErr(err.message ?? "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <CyberSectionHeader
        title="CITY FEED"
        accent="#00d4ff"
        cursor
        right={
          <CyberButton variant="ghost" size="sm" onClick={() => load(1)} loading={loading}>
            Refresh
          </CyberButton>
        }
      />

      {/* Terminal description */}
      <p className="font-mono text-xs px-1" style={{ color: "#475569" }}>
        Live broadcast — city-wide events, plus posts from players.
      </p>

      {/* Composer — public post, shown with the player's equipped frame */}
      {user && (
        <div
          style={{
            background: "#0a0a12",
            border: "1px solid #1e1e2e",
            borderRadius: 6,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Say something to the city…"
            maxLength={500}
            rows={2}
            className="font-mono w-full"
            style={{
              background: "#0d0d15",
              border: "1px solid #1e1e2e",
              borderRadius: 4,
              color: "#e2e8f0",
              fontSize: 12,
              padding: "8px 10px",
              resize: "none",
              outline: "none",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="font-mono" style={{ fontSize: 10, color: postErr ? "#ff2d55" : "#334155" }}>
              {postErr ?? `${draft.length}/500`}
            </span>
            <CyberButton
              variant="primary"
              size="sm"
              loading={posting}
              disabled={!draft.trim() || posting}
              onClick={submitPost}
            >
              Post
            </CyberButton>
          </div>
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#1e1e2e" }}>
          Loading feed...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 font-mono text-xs" style={{ color: "#475569" }}>
          No city events yet. Check back soon.
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {events.map((ev, i) => {
              const isPinned = (ev as any).pinned;

              // Player self-posts render with their equipped chat frame (name
              // animations, colors, etc.) instead of the generic system badge.
              if (ev.type === "post") {
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.25), duration: 0.18 }}
                  >
                    <div
                      onClick={() => ev.actorId && onInspectPlayer?.(ev.actorId)}
                      style={{ cursor: ev.actorId ? "pointer" : "default" }}
                    >
                      <ChatFrameRenderer
                        frameId={ev.actorChatFrame}
                        username={ev.actor}
                        level={ev.actorLevel}
                        timestamp={ev.createdAt}
                      >
                        <MentionText
                          text={ev.message}
                          onUserClick={handleUserMention}
                          onLocationClick={handleLocationMention}
                        />
                      </ChatFrameRenderer>
                    </div>
                  </motion.div>
                );
              }

              const badge = CATEGORY_BADGE[ev.type] ?? { label: "🌐 CITY", color: "#64748b" };
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.25), duration: 0.18 }}
                >
                  <div
                    style={{
                      background: isPinned ? "#0d1a2e" : "#0a0a12",
                      borderRadius: 6,
                      border: `1px solid ${isPinned ? "#1e3a5f" : "#1e1e2e"}`,
                      padding: "10px 14px",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Category badge */}
                    <span
                      className="font-mono flex-shrink-0"
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: badge.color,
                        background: `${badge.color}18`,
                        border: `1px solid ${badge.color}40`,
                        borderRadius: 3,
                        padding: "2px 5px",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {isPinned ? "📌 " : ""}{badge.label}
                    </span>

                    {/* Message */}
                    <span className="font-mono flex-1" style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>
                      <MentionText
                        text={ev.message}
                        onUserClick={handleUserMention}
                        onLocationClick={handleLocationMention}
                      />
                    </span>

                    {/* Timestamp */}
                    <span
                      className="font-mono flex-shrink-0"
                      style={{ fontSize: 9, color: "#334155", marginTop: 2 }}
                    >
                      {timeAgo(ev.createdAt)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <CyberButton
                variant="ghost"
                size="sm"
                onClick={loadMore}
                loading={loading}
              >
                Load more
              </CyberButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
