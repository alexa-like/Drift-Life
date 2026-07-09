import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FeedEvent, User } from "../lib/types";
import { api } from "../lib/api";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { MentionText } from "../components/MentionText";

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
        Live broadcast — city-wide events feed. Read-only.
      </p>

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
              const badge = CATEGORY_BADGE[ev.type] ?? { label: "🌐 CITY", color: "#64748b" };
              const isPinned = (ev as any).pinned;
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
