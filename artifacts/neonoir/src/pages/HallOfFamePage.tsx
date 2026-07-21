/**
 * HallOfFamePage — Frozen season leaderboard snapshots.
 * Route: /hall-of-fame
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { CyberSectionHeader } from "../components/CyberSectionHeader";

interface SeasonSummary {
  _id: string;
  seasonName: string;
  eventId: string;
  endsAt: string;
}

interface HofEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  seasonLevel: number;
  teamId?: string;
}

interface SeasonDetail {
  _id: string;
  seasonName: string;
  eventId: string;
  endsAt: string;
  hallOfFame: HofEntry[];
}

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const MEDAL_LABELS = ["CHAMPION", "RUNNER-UP", "THIRD"];

export default function HallOfFamePage() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load season list on mount
  useEffect(() => {
    api.get<SeasonSummary[]>("/seasons/hall-of-fame")
      .then(data => {
        setSeasons(data);
        if (data.length > 0) setSelectedId(data[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingSeasons(false));
  }, []);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setDetail(null);
    api.get<SeasonDetail>(`/seasons/hall-of-fame/${selectedId}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const top3 = detail?.hallOfFame?.slice(0, 3) ?? [];
  const rest = detail?.hallOfFame?.slice(3) ?? [];

  return (
    <div className="max-w-2xl mx-auto relative z-10 space-y-6 pb-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Header */}
      <div>
        <CyberSectionHeader title="Hall of Fame" accent="#FFD700" size="lg" cursor className="mb-1" />
        <p className="font-mono text-xs" style={{ color: "#64748b" }}>
          Season champions — frozen in history
        </p>
      </div>

      {/* Season selector */}
      {loadingSeasons ? (
        <div className="font-mono text-xs animate-pulse" style={{ color: "#334155" }}>
          Loading seasons...
        </div>
      ) : seasons.length === 0 ? (
        <div
          className="font-mono text-sm text-center py-16"
          style={{ color: "#475569" }}
        >
          No seasons have ended yet. Check back after the first season concludes.
        </div>
      ) : (
        <>
          {/* Dropdown */}
          <div
            className="p-4 rounded-sm"
            style={{ background: "#111118", border: "1px solid #FFD70030" }}
          >
            <label
              className="font-mono text-xs block mb-2"
              style={{ color: "#64748b", letterSpacing: "0.1em" }}
            >
              SELECT SEASON
            </label>
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full font-mono text-sm px-3 py-2 rounded"
              style={{
                background: "#0a0a0f",
                border: "1px solid #1e1e2e",
                color: "#FFD700",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {seasons.map(s => (
                <option key={s._id} value={s._id}>
                  {s.seasonName} — {new Date(s.endsAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </option>
              ))}
            </select>
          </div>

          {/* Loading */}
          {loadingDetail && (
            <div className="font-mono text-xs text-center py-8 animate-pulse" style={{ color: "#334155" }}>
              Pulling records from the grid...
            </div>
          )}

          {/* Hall of Fame */}
          {!loadingDetail && detail && (
            <div className="space-y-4">
              {/* Season header */}
              <div
                className="px-5 py-4 rounded-sm relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #08080c, #FFD70008)",
                  border: "1px solid #FFD70030",
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "linear-gradient(180deg, transparent, #FFD700, transparent)" }} />
                <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "#FFD70080" }}>
                  SEASON ARCHIVE
                </div>
                <div
                  className="font-display font-black text-xl uppercase tracking-wider mt-0.5"
                  style={{ color: "#FFD700" }}
                >
                  {detail.seasonName}
                </div>
                <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                  Ended {new Date(detail.endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                  {" · "}
                  {detail.hallOfFame.length} champions recorded
                </div>
              </div>

              {/* Top 3 podium */}
              {top3.length > 0 && (
                <div className="space-y-3">
                  {top3.map((entry, i) => {
                    const color = MEDAL_COLORS[i];
                    return (
                      <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        style={{
                          background: `linear-gradient(135deg, ${color}08 0%, #111118 100%)`,
                          border: `1px solid ${color}40`,
                          borderLeft: `3px solid ${color}`,
                          borderRadius: 8,
                          padding: "14px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        {/* Rank */}
                        <div
                          className="font-mono font-black flex-shrink-0 text-center"
                          style={{ width: 36, fontSize: i === 0 ? 28 : 22, color, textShadow: `0 0 12px ${color}80` }}
                        >
                          {entry.rank}
                        </div>

                        {/* Avatar circle */}
                        <div
                          style={{
                            width: i === 0 ? 48 : 36, height: i === 0 ? 48 : 36,
                            borderRadius: "50%",
                            background: "#1e1e2e",
                            flexShrink: 0,
                            border: `2px solid ${color}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: i === 0 ? 18 : 14,
                            color,
                            fontWeight: "bold",
                            fontFamily: "monospace",
                          }}
                        >
                          {entry.username.charAt(0).toUpperCase()}
                        </div>

                        {/* Identity */}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold" style={{ fontSize: i === 0 ? 16 : 14, color, textShadow: `0 0 8px ${color}60` }}>
                            {entry.username}
                          </div>
                          <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>
                            {MEDAL_LABELS[i]} · Season Level {entry.seasonLevel}
                            {i === 0 && (
                              <span style={{ color: "#FFD700", marginLeft: 8 }}>🏆 Hall of Fame</span>
                            )}
                          </div>
                        </div>

                        {/* Points */}
                        <div className="flex-shrink-0 text-right">
                          <div className="font-mono font-bold" style={{ fontSize: 14, color }}>
                            {entry.points.toLocaleString()}
                          </div>
                          <div className="font-mono" style={{ fontSize: 9, color: "#475569" }}>pts</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Rest of list (4–50) */}
              {rest.length > 0 && (
                <div style={{ border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" }}>
                  {rest.map((entry, idx) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 + idx * 0.015 }}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        background: idx % 2 === 0 ? "#111118" : "#0d0d15",
                        borderBottom: "1px solid #1e1e2e",
                        borderLeft: "3px solid #FFD70020",
                      }}
                    >
                      <div className="font-mono font-bold flex-shrink-0 text-center" style={{ width: 28, fontSize: 11, color: "#334155" }}>
                        {entry.rank}
                      </div>
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "#1e1e2e", flexShrink: 0,
                          border: "1px solid #FFD70020",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, color: "#FFD70060",
                          fontWeight: "bold", fontFamily: "monospace",
                        }}
                      >
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                          {entry.username}
                        </span>
                        <div className="font-mono" style={{ fontSize: 9, color: "#475569" }}>
                          Lv.{entry.seasonLevel} season
                        </div>
                      </div>
                      <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 12, color: "#FFD70080" }}>
                        {entry.points.toLocaleString()} pts
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {detail.hallOfFame.length === 0 && (
                <div className="font-mono text-sm text-center py-8" style={{ color: "#475569" }}>
                  No Hall of Fame data for this season.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
