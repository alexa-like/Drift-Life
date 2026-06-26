import { useState, useEffect } from "react";
import { LeaderboardEntry } from "../lib/types";
import { api } from "../lib/api";

type SortType = "level" | "dc" | "wins" | "crimes";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortType, setSortType] = useState<SortType>("level");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardEntry[]>(`/leaderboard?type=${sortType}&limit=20`)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sortType]);

  const SORT_OPTS: { id: SortType; label: string; color: string }[] = [
    { id: "level", label: "Level", color: "#a855f7" },
    { id: "dc", label: "Wealth", color: "#f59e0b" },
    { id: "wins", label: "Wins", color: "#ff6b35" },
    { id: "crimes", label: "Crimes", color: "#ff2d55" },
  ];

  const RANK_MEDALS = ["gold", "silver", "#cd7f32"];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h2 className="text-lg font-mono font-bold" style={{ color: "#f59e0b" }}>Leaderboard</h2>

      <div className="flex gap-2 flex-wrap">
        {SORT_OPTS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setSortType(opt.id)}
            className="px-3 py-1.5 rounded text-xs font-mono"
            style={{
              background: sortType === opt.id ? opt.color + "18" : "transparent",
              color: sortType === opt.id ? opt.color : "#475569",
              border: `1px solid ${sortType === opt.id ? opt.color + "40" : "#1e1e2e"}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs font-mono" style={{ color: "#1e1e2e" }}>
          Loading...
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          <div
            className="grid text-xs font-mono px-4 py-2"
            style={{
              gridTemplateColumns: "2rem 1fr 4rem 5rem 5rem 4rem",
              background: "#0a0a0f",
              color: "#475569",
              borderBottom: "1px solid #1e1e2e",
            }}
          >
            <span>#</span>
            <span>Player</span>
            <span>Level</span>
            <span>DC</span>
            <span>Wins</span>
            <span>Crimes</span>
          </div>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="grid text-xs font-mono px-4 py-3 transition-colors"
              style={{
                gridTemplateColumns: "2rem 1fr 4rem 5rem 5rem 4rem",
                background: i % 2 === 0 ? "#111118" : "#0d0d15",
                borderBottom: "1px solid #1e1e2e",
                color: "#e2e8f0",
              }}
            >
              <span style={{ color: i < 3 ? RANK_MEDALS[i] : "#475569" }}>
                {i < 3 ? ["1st", "2nd", "3rd"][i] : `${i + 1}`}
              </span>
              <span style={{ color: "#e2e8f0" }}>{entry.username}</span>
              <span style={{ color: "#a855f7" }}>{entry.level}</span>
              <span style={{ color: "#f59e0b" }}>{(entry.dc / 1000).toFixed(1)}k</span>
              <span style={{ color: "#39d353" }}>{entry.wins}</span>
              <span style={{ color: "#ff2d55" }}>{entry.crimes}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
