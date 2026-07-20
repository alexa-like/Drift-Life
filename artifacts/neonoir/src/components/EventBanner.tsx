import { useState, useEffect } from "react";

export interface ActiveEventTheme {
  eventId: string;
  eventName: string;
  eventType: string;
  endsAt: string;
  gameDisplayName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  bannerImageUrl: string;
  chatBadgeText: string;
  chatBadgeColor: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  boss_raid:         "BOSS RAID",
  leaderboard_grind: "LEADERBOARD GRIND",
  collection_hunt:   "COLLECTION HUNT",
  milestone:         "CITY MILESTONE",
  sports:            "SPORTS EVENT",
  lottery:           "LOTTERY",
};

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "ENDED";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d remaining`;
  if (h >= 1) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

interface Props {
  event: ActiveEventTheme;
  onNav?: (page: string) => void;
}

export function EventBanner({ event, onNav }: Props) {
  const [countdown, setCountdown] = useState(() => formatCountdown(event.endsAt));

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(event.endsAt)), 30_000);
    return () => clearInterval(id);
  }, [event.endsAt]);

  const primary = event.primaryColor || "#00d4ff";
  const accent  = event.accentColor  || "#ff2d55";
  const bg      = event.backgroundColor || "#08080c";

  return (
    <div
      className="relative w-full overflow-hidden mb-4"
      style={{
        background: `linear-gradient(135deg, ${bg}ee, ${primary}18, ${accent}0a)`,
        border: `1px solid ${primary}40`,
        borderRadius: 2,
      }}
    >
      {/* Faint banner image */}
      {event.bannerImageUrl && (
        <div
          className="absolute inset-0 opacity-[0.07] bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${event.bannerImageUrl})` }}
        />
      )}

      {/* Animated left-edge glow bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{ background: `linear-gradient(180deg, transparent, ${primary}, transparent)` }}
      />

      <div className="relative flex items-center gap-3 px-4 py-2.5">
        {/* Pulsing dot */}
        <div
          className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ background: primary, boxShadow: `0 0 8px ${primary}` }}
        />

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <span
            className="font-mono text-[10px] tracking-widest uppercase"
            style={{ color: primary + "99" }}
          >
            {EVENT_TYPE_LABELS[event.eventType] || event.eventType.replace(/_/g, " ").toUpperCase()}
          </span>
          <span className="font-mono text-[10px] mx-1.5" style={{ color: "#475569" }}>·</span>
          <span
            className="font-display font-bold text-sm tracking-wider uppercase"
            style={{ color: accent }}
          >
            {event.eventName}
          </span>
        </div>

        {/* Countdown + CTA */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-xs" style={{ color: primary + "88" }}>
            {countdown}
          </span>
          {onNav && (
            <button
              onClick={() => onNav("events")}
              className="font-mono text-[10px] px-2 py-0.5 clip-btn uppercase tracking-widest transition-opacity hover:opacity-70"
              style={{
                color: primary,
                border: `1px solid ${primary}40`,
                background: `${primary}10`,
              }}
            >
              ENTER ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
