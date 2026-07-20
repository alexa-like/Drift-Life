import { useState, useEffect } from "react";
import { api } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingEvent {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  startsAt: string;
  endsAt: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    bannerImageUrl: string;
    gameDisplayName: string;
  };
  leaderboardRewards: Array<{
    rankFrom: number;
    rankTo: number;
    reward: { dc: number; nc: number; titles: string[] };
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  boss_raid:         "BOSS RAID",
  leaderboard_grind: "LEADERBOARD GRIND",
  collection_hunt:   "COLLECTION HUNT",
  milestone:         "CITY MILESTONE",
  sports:            "SPORTS EVENT",
  lottery:           "LOTTERY",
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  boss_raid:         "💀",
  leaderboard_grind: "🏆",
  collection_hunt:   "🎁",
  milestone:         "🏙️",
  sports:            "⚽",
  lottery:           "🎰",
};

function formatStartCountdown(startsAt: string): string {
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return "Starting soon…";
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `Starts in ${d}d ${h % 24}h`;
  if (h >= 1) return `Starts in ${h}h ${m % 60}m`;
  return `Starts in ${m}m`;
}

function getTopPrize(event: UpcomingEvent): string {
  const top = event.leaderboardRewards?.find(r => r.rankFrom === 1);
  if (!top) return "";
  const parts: string[] = [];
  if (top.reward.dc > 0) parts.push(`${(top.reward.dc / 1000).toFixed(0)}k DC`);
  if (top.reward.nc > 0) parts.push(`${top.reward.nc} NC`);
  if (top.reward.titles?.length) parts.push(top.reward.titles[0]);
  return parts.slice(0, 2).join(" + ");
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: string) => void;
}

export default function UpcomingEventsPage({ onNavigate }: Props) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UpcomingEvent[]>("/events/upcoming")
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-sm animate-pulse" style={{ background: "#111118" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div>
        <div className="font-display font-black text-2xl uppercase tracking-widest" style={{ color: "#00d4ff" }}>
          Upcoming Events
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
          Events scheduled for the city — mark your calendar
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onNavigate("events")}
          className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest"
          style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
        >
          ← Active Event
        </button>
        <button
          onClick={() => onNavigate("events-archive")}
          className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest"
          style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
        >
          Past Events Archive
        </button>
      </div>

      {/* Event cards */}
      {events.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="text-4xl">📅</div>
          <div className="font-mono text-sm" style={{ color: "#475569" }}>No events scheduled yet — check back soon.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const primary = event.theme?.primaryColor || "#00d4ff";
            const accent = event.theme?.accentColor || "#ff2d55";
            const topPrize = getTopPrize(event);

            return (
              <div
                key={event._id}
                className="relative overflow-hidden rounded-sm"
                style={{
                  background: `linear-gradient(135deg, ${event.theme?.backgroundColor || "#08080c"}ee, ${primary}12)`,
                  border: `1px solid ${primary}30`,
                }}
              >
                {/* Banner image background */}
                {event.theme?.bannerImageUrl && (
                  <div
                    className="absolute inset-0 opacity-[0.06] bg-cover bg-center pointer-events-none"
                    style={{ backgroundImage: `url(${event.theme.bannerImageUrl})` }}
                  />
                )}
                {/* Left glow bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ background: `linear-gradient(180deg, transparent, ${primary}, transparent)` }}
                />

                <div className="relative p-4 flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="text-3xl flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-sm"
                    style={{ background: `${primary}15`, border: `1px solid ${primary}30` }}
                  >
                    {EVENT_TYPE_ICONS[event.type] || "🎯"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div
                          className="font-mono text-[10px] tracking-widest uppercase mb-0.5"
                          style={{ color: primary + "99" }}
                        >
                          {EVENT_TYPE_LABELS[event.type] || event.type}
                        </div>
                        <div
                          className="font-display font-bold text-lg uppercase tracking-wide"
                          style={{ color: accent }}
                        >
                          {event.name}
                        </div>
                        {event.description && (
                          <div className="font-mono text-xs mt-1 line-clamp-2" style={{ color: "#64748b" }}>
                            {event.description}
                          </div>
                        )}
                      </div>

                      {/* Countdown */}
                      <div className="text-right flex-shrink-0">
                        <div
                          className="font-mono text-xs font-bold px-2 py-1 rounded-sm"
                          style={{ background: `${primary}15`, color: primary, border: `1px solid ${primary}30` }}
                        >
                          {formatStartCountdown(event.startsAt)}
                        </div>
                        <div className="font-mono text-[10px] mt-1" style={{ color: "#475569" }}>
                          {new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          {" → "}
                          {new Date(event.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>

                    {/* Top prize */}
                    {topPrize && (
                      <div className="mt-2 font-mono text-xs" style={{ color: "#475569" }}>
                        🏆 Top prize: <span style={{ color: accent, fontWeight: "bold" }}>{topPrize}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mystery coming-soon card */}
      <div
        className="p-4 text-center rounded-sm"
        style={{ background: "#08080c", border: "1px dashed #1e1e2e" }}
      >
        <div className="text-2xl mb-2">🔮</div>
        <div className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: "#334155" }}>
          More events coming soon
        </div>
        <div className="font-mono text-[10px] mt-1" style={{ color: "#1e2e3e" }}>Details withheld</div>
      </div>
    </div>
  );
}
