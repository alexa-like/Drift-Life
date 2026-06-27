import { useState, useEffect } from "react";
import { LeaderboardEntry } from "../lib/types";
import { api } from "../lib/api";
import { AvatarWithFrame } from "../components/AvatarWithFrame";

type SortType = "level" | "dc" | "wins" | "crimes";

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortType, setSortType] = useState<SortType>("level");
  const [loading, setLoading] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardEntry[]>(`/leaderboard?type=${sortType}&limit=50`)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sortType]);

  const SORT_OPTS: { id: SortType; label: string; color: string }[] = [
    { id: "level",  label: "📊 Level",  color: "#a855f7" },
    { id: "dc",     label: "💰 Wealth", color: "#f59e0b" },
    { id: "wins",   label: "⚔️ Wins",   color: "#ff6b35" },
    { id: "crimes", label: "🎭 Crime",  color: "#ff2d55" },
  ];

  const MEDALS = ["#FFD700", "#C0C0C0", "#CD7F32"];

  function getMetricDisplay(entry: LeaderboardEntry): string {
    if (sortType === "dc") return `${((entry.dc + entry.bankBalance) / 1000).toFixed(1)}k DC`;
    if (sortType === "wins") return `${entry.wins}W`;
    if (sortType === "crimes") return `${entry.crimes} crimes`;
    return `Lv.${entry.level}`;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-lg font-bold" style={{ color: "#f59e0b", textShadow: "0 0 12px #f59e0b40" }}>
          NEW VANTA RANKINGS
        </h1>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Who runs this city</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap mb-4">
        {SORT_OPTS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSortType(opt.id)}
            className="px-3 py-1.5 rounded text-xs font-mono transition-all"
            style={{
              background: sortType === opt.id ? opt.color + "18" : "#111118",
              color: sortType === opt.id ? opt.color : "#475569",
              border: `1px solid ${sortType === opt.id ? opt.color + "50" : "#1e1e2e"}`,
              boxShadow: sortType === opt.id ? `0 0 8px ${opt.color}20` : "none",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 font-mono text-xs" style={{ color: "#334155" }}>
          Pulling city records...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 font-mono text-xs" style={{ color: "#475569" }}>
          No data yet. Start playing.
        </div>
      ) : (
        <div style={{ border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" }}>
          {entries.map((entry, i) => {
            const isTop3 = i < 3;
            const medalColor = isTop3 ? MEDALS[i] : null;
            const fc = entry.faction ? FACTION_COLOR[entry.faction] : "#64748b";
            const metric = getMetricDisplay(entry);

            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                style={{
                  background: isTop3
                    ? `${medalColor}08`
                    : i % 2 === 0 ? "#111118" : "#0d0d15",
                  borderBottom: "1px solid #1e1e2e",
                  borderLeft: isTop3 ? `2px solid ${medalColor}` : "2px solid transparent",
                }}
                onClick={() => setInspectId(entry.id)}
              >
                {/* Rank */}
                <div
                  className="font-mono font-bold flex-shrink-0 text-center"
                  style={{ width: 28, fontSize: 11, color: medalColor || "#334155" }}
                >
                  {isTop3 ? ["👑", "🥈", "🥉"][i] : `${i + 1}`}
                </div>

                {/* Avatar + frame */}
                <AvatarWithFrame
                  username={entry.username}
                  frameId={(entry as any).equippedFrame || null}
                  size="sm"
                />

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-mono font-bold text-sm"
                      style={{ color: isTop3 ? medalColor! : "#e2e8f0" }}
                    >
                      {entry.username}
                    </span>
                    {entry.faction && (
                      <span style={{ color: fc, fontSize: 11 }}>
                        {FACTION_EMOJI[entry.faction]}
                      </span>
                    )}
                    {entry.rankTitle && (
                      <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                        [{entry.rankTitle}]
                      </span>
                    )}
                  </div>
                  <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                    Lv.{entry.level} · {entry.district?.replace(/-/g, " ")}
                  </div>
                </div>

                {/* Metric */}
                <div
                  className="font-mono font-bold flex-shrink-0"
                  style={{ fontSize: 12, color: SORT_OPTS.find(s => s.id === sortType)?.color || "#e2e8f0" }}
                >
                  {metric}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
