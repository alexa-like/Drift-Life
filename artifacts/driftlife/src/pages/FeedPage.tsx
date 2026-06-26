import { useState, useEffect } from "react";
import { FeedEvent } from "../lib/types";
import { api } from "../lib/api";

const TYPE_COLORS: Record<string, string> = {
  crime: "#ff2d55",
  fight: "#ff6b35",
  job: "#39d353",
  market: "#00d4ff",
  bank: "#f59e0b",
  system: "#a855f7",
  level_up: "#f59e0b",
  hospital: "#ff2d55",
};

export function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<FeedEvent[]>("/feed?limit=50")
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-mono font-bold" style={{ color: "#94a3b8" }}>City Feed</h2>
        <button
          onClick={load}
          className="text-xs font-mono px-2 py-1 rounded"
          style={{ color: "#475569", border: "1px solid #1e1e2e" }}
        >
          Refresh
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#1e1e2e" }}>Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#475569" }}>
          No events yet. Start playing to fill the feed.
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          {events.map((ev, i) => (
            <div
              key={ev.id}
              className="flex items-start gap-3 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "#111118" : "#0d0d15",
                borderBottom: "1px solid #1e1e2e",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  background: TYPE_COLORS[ev.type] ?? "#94a3b8",
                  boxShadow: `0 0 4px ${TYPE_COLORS[ev.type] ?? "#94a3b8"}`,
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono" style={{ color: "#e2e8f0" }}>{ev.message}</p>
                <div className="flex gap-3 mt-0.5">
                  {ev.dc > 0 && <span className="text-xs font-mono" style={{ color: "#f59e0b" }}>+{ev.dc} DC</span>}
                  {ev.xp > 0 && <span className="text-xs font-mono" style={{ color: "#a855f7" }}>+{ev.xp} XP</span>}
                </div>
              </div>
              <span className="text-xs font-mono flex-shrink-0" style={{ color: "#334155" }}>
                {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
