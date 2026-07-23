import { useState, useEffect } from "react";
import { api } from "../shared/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArchiveListItem {
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
  };
  archive?: {
    totalParticipants?: number;
    bossKilled?: boolean;
    totalDamageDealt?: number;
  };
}

interface ArchiveDetail extends ArchiveListItem {
  archive: {
    finalLeaderboard: Array<{ rank: number; userId: string; username: string; points: number }>;
    bossKilled: boolean;
    bossKilledAt?: string;
    milestoneReached?: number;
    totalParticipants: number;
    totalDamageDealt?: number;
  };
  leaderboardRewards: Array<{
    rankFrom: number;
    rankTo: number;
    reward: { dc: number; nc: number; titles: string[] };
  }>;
  boss?: { name: string; totalHp: number };
  milestones?: Array<{ label: string; target: number }>;
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

// ── Detail view ────────────────────────────────────────────────────────────────

function ArchiveDetailView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [event, setEvent] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ArchiveDetail>(`/events/archive/${slug}`)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>← Back</button>
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-sm animate-pulse" style={{ background: "#111118" }} />)}
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>← Back</button>
        <div className="font-mono text-sm text-center py-8" style={{ color: "#475569" }}>Event not found.</div>
      </div>
    );
  }

  const primary = event.theme?.primaryColor || "#00d4ff";
  const accent = event.theme?.accentColor || "#ff2d55";
  const top10 = event.archive?.finalLeaderboard?.slice(0, 10) ?? [];

  return (
    <div className="space-y-5 pb-8">
      <button onClick={onBack} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>← Back to Archive</button>

      {/* Banner */}
      <div
        className="relative overflow-hidden rounded-sm px-5 py-5"
        style={{
          background: `linear-gradient(135deg, ${event.theme?.backgroundColor || "#08080c"}ee, ${primary}15)`,
          border: `1px solid ${primary}40`,
        }}
      >
        {event.theme?.bannerImageUrl && (
          <div className="absolute inset-0 opacity-[0.07] bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${event.theme.bannerImageUrl})` }} />
        )}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, transparent, ${primary}, transparent)` }} />
        <div className="relative">
          <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: primary + "99" }}>
            {EVENT_TYPE_LABELS[event.type] || event.type} · ARCHIVED
          </div>
          <div className="font-display font-black text-2xl uppercase tracking-wider mt-0.5" style={{ color: accent }}>
            {event.name}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
            {new Date(event.startsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            {" → "}
            {new Date(event.endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
          {event.description && (
            <div className="font-mono text-xs mt-2" style={{ color: "#64748b" }}>{event.description}</div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-sm text-center" style={{ background: "#08080c", border: `1px solid ${primary}20` }}>
          <div className="font-display font-bold text-xl" style={{ color: primary }}>
            {(event.archive?.totalParticipants ?? 0).toLocaleString()}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#475569" }}>Participants</div>
        </div>
        {event.type === "boss_raid" && (
          <div className="p-3 rounded-sm text-center" style={{ background: "#08080c", border: `1px solid ${event.archive?.bossKilled ? "#39d353" : "#ff2d55"}20` }}>
            <div className="font-display font-bold text-xl" style={{ color: event.archive?.bossKilled ? "#39d353" : "#ff2d55" }}>
              {event.archive?.bossKilled ? "☠ SLAIN" : "SURVIVED"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#475569" }}>Boss Status</div>
          </div>
        )}
        {event.type === "boss_raid" && event.archive?.totalDamageDealt && (
          <div className="p-3 rounded-sm text-center" style={{ background: "#08080c", border: `1px solid #ff2d5520` }}>
            <div className="font-display font-bold text-xl" style={{ color: "#ff2d55" }}>
              {(event.archive.totalDamageDealt / 1_000_000).toFixed(1)}M
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#475569" }}>Total Damage</div>
          </div>
        )}
      </div>

      {/* Boss kill time */}
      {event.type === "boss_raid" && event.archive?.bossKilled && event.archive?.bossKilledAt && (
        <div className="p-3 rounded-sm font-mono text-xs" style={{ background: "#08080c", border: "1px solid #39d35320", color: "#39d353" }}>
          ☠ Boss defeated at {new Date(event.archive.bossKilledAt).toLocaleString()}
        </div>
      )}

      {/* Milestone */}
      {event.type === "milestone" && event.archive?.milestoneReached !== undefined && (
        <div className="p-3 rounded-sm font-mono text-sm" style={{ background: "#08080c", border: `1px solid ${primary}20`, color: primary }}>
          🏙️ Milestone tier reached: {event.archive.milestoneReached}
        </div>
      )}

      {/* Final top-10 leaderboard */}
      <div className="space-y-3">
        <div className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: primary }}>Final Top 10</div>
        {top10.length === 0 ? (
          <div className="font-mono text-xs" style={{ color: "#334155" }}>No leaderboard data recorded.</div>
        ) : (
          <div className="space-y-1">
            {top10.map(entry => (
              <div
                key={entry.rank}
                className="flex items-center gap-3 px-3 py-2 rounded-sm"
                style={{
                  background: entry.rank <= 3 ? `${primary}08` : "#08080c",
                  border: entry.rank <= 3 ? `1px solid ${primary}20` : "1px solid #111118",
                }}
              >
                <span
                  className="font-mono font-bold text-sm"
                  style={{
                    color: entry.rank === 1 ? "#f59e0b" : entry.rank === 2 ? "#94a3b8" : entry.rank === 3 ? "#cd7f32" : "#475569",
                    minWidth: 28,
                  }}
                >
                  #{entry.rank}
                </span>
                <span className="font-mono text-sm flex-1 truncate" style={{ color: "#e2e8f0" }}>{entry.username}</span>
                <span className="font-mono text-xs font-bold" style={{ color: primary }}>{entry.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reward table */}
      {event.leaderboardRewards?.length > 0 && (
        <div className="space-y-2">
          <div className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: primary }}>Rewards</div>
          <div className="space-y-1">
            {event.leaderboardRewards.map(r => (
              <div key={r.rankFrom} className="flex items-center gap-3 px-3 py-1.5 rounded-sm font-mono text-xs" style={{ background: "#08080c", border: "1px solid #111118" }}>
                <span style={{ color: accent, minWidth: 80 }}>Rank {r.rankFrom}–{r.rankTo}</span>
                <span style={{ color: "#64748b" }}>
                  {r.reward.dc > 0 && `${r.reward.dc.toLocaleString()} DC`}
                  {r.reward.nc > 0 && ` · ${r.reward.nc} NC`}
                  {r.reward.titles?.map(t => ` · ${t}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: string) => void;
}

export default function EventArchivePage({ onNavigate }: Props) {
  const [events, setEvents] = useState<ArchiveListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);

  useEffect(() => {
    api.get<ArchiveListItem[]>("/events/archive")
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (detailSlug) {
    return <ArchiveDetailView slug={detailSlug} onBack={() => setDetailSlug(null)} />;
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-sm animate-pulse" style={{ background: "#111118" }} />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div>
        <div className="font-display font-black text-2xl uppercase tracking-widest" style={{ color: "#00d4ff" }}>
          Past Events
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
          The city's history — every war fought, every boss defeated
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onNavigate("events")} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>← Active Event</button>
        <button onClick={() => onNavigate("events-upcoming")} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>Upcoming</button>
        <button onClick={() => onNavigate("hall-of-fame")} className="font-mono text-xs px-4 py-1.5 clip-btn uppercase tracking-widest" style={{ color: "#FFD700", border: "1px solid #FFD70040" }}>🏆 Hall of Fame</button>
      </div>

      {/* Grid */}
      {events.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="text-4xl">📜</div>
          <div className="font-mono text-sm" style={{ color: "#475569" }}>No events in the archive yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map(event => {
            const primary = event.theme?.primaryColor || "#00d4ff";
            const accent = event.theme?.accentColor || "#ff2d55";
            return (
              <button
                key={event._id}
                onClick={() => setDetailSlug(event.slug)}
                className="relative overflow-hidden rounded-sm text-left transition-opacity hover:opacity-80 active:opacity-60"
                style={{
                  background: `linear-gradient(135deg, ${event.theme?.backgroundColor || "#08080c"}ee, ${primary}10)`,
                  border: `1px solid ${primary}25`,
                }}
              >
                {event.theme?.bannerImageUrl && (
                  <div className="absolute inset-0 opacity-[0.05] bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${event.theme.bannerImageUrl})` }} />
                )}
                <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: primary + "80" }} />
                <div className="relative p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{EVENT_TYPE_ICONS[event.type] || "🎯"}</span>
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: primary + "80" }}>
                        {EVENT_TYPE_LABELS[event.type] || event.type}
                      </div>
                      <div className="font-display font-bold text-base truncate" style={{ color: accent }}>{event.name}</div>
                      <div className="font-mono text-[10px] mt-0.5" style={{ color: "#475569" }}>
                        {new Date(event.startsAt).toLocaleDateString()} – {new Date(event.endsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {event.archive?.totalParticipants !== undefined && (
                      <span className="font-mono text-[10px]" style={{ color: "#64748b" }}>
                        👥 {event.archive.totalParticipants.toLocaleString()} participants
                      </span>
                    )}
                    {event.type === "boss_raid" && (
                      <span className="font-mono text-[10px]" style={{ color: event.archive?.bossKilled ? "#39d353" : "#ff2d55" }}>
                        {event.archive?.bossKilled ? "☠ Boss killed" : "Boss survived"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
