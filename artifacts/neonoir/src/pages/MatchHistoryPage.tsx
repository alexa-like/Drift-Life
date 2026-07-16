/**
 * Match History — Tier 8
 * Shows last 20 combat matches and last 20 race matches for the logged-in player.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface CombatEntry {
  type: "combat";
  matchId: string;
  isAI: boolean;
  opponentName: string;
  opponentId?: string;
  result: "win" | "loss" | "draw";
  turns: number;
  energyCost: number;
  createdAt: string;
}

interface RaceEntry {
  type: "race";
  matchId: string;
  mode: string;
  placement: number | null;
  totalPlayers: number;
  hasAI: boolean;
  result: "win" | "top" | "loss";
  finishTime: number | null;
  energyCost: number;
  createdAt: string;
}

type HistoryEntry = CombatEntry | RaceEntry;

interface HistoryData {
  combat: CombatEntry[];
  races: RaceEntry[];
}

const RESULT_STYLE: Record<string, { color: string; label: string }> = {
  win:  { color: "#39d353", label: "WIN" },
  top:  { color: "#f59e0b", label: "TOP" },
  loss: { color: "#ff2d55", label: "LOSS" },
  draw: { color: "#64748b", label: "DRAW" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(ms: number | null) {
  if (ms === null) return "—";
  const s = (ms / 1000).toFixed(2);
  return `${s}s`;
}

function PlacementBadge({ place, total }: { place: number | null; total: number }) {
  if (!place) return <span style={{ color: "#475569", fontFamily: "monospace", fontSize: 11 }}>—</span>;
  const colors = ["#f59e0b", "#94a3b8", "#cd7c2e"];
  const color = colors[place - 1] ?? "#475569";
  return (
    <span className="font-mono font-bold" style={{ color, fontSize: 13 }}>
      #{place}<span style={{ color: "#334155", fontSize: 10 }}>/{total}</span>
    </span>
  );
}

function CombatRow({ m }: { m: CombatEntry }) {
  const rs = RESULT_STYLE[m.result] ?? RESULT_STYLE.draw;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "#0d0d15", border: "1px solid #1e1e2e",
      borderLeft: `3px solid ${rs.color}`,
      borderRadius: 8, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>⚔️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 13 }}>
            vs {m.opponentName}
          </span>
        </div>
        <div className="font-mono" style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
          {m.turns} turns · ⚡{m.energyCost} · {timeAgo(m.createdAt)}
        </div>
      </div>
      <span className="font-mono font-bold" style={{ color: rs.color, fontSize: 12, letterSpacing: "0.08em", flexShrink: 0 }}>
        {rs.label}
      </span>
    </div>
  );
}

function RaceRow({ m }: { m: RaceEntry }) {
  const rs = RESULT_STYLE[m.result] ?? RESULT_STYLE.loss;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "#0d0d15", border: "1px solid #1e1e2e",
      borderLeft: `3px solid ${rs.color}`,
      borderRadius: 8, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🏎️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 13 }}>
            {m.mode === "2player" ? "2-Player Race" : "4-Player Race"}
          </span>
        </div>
        <div className="font-mono" style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
          {m.finishTime ? `${formatTime(m.finishTime)} finish` : "DNF"} · ⚡{m.energyCost} · {timeAgo(m.createdAt)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <PlacementBadge place={m.placement} total={m.totalPlayers} />
        <span className="font-mono font-bold" style={{ color: rs.color, fontSize: 10, letterSpacing: "0.08em" }}>
          {rs.label}
        </span>
      </div>
    </div>
  );
}

type TabId = "all" | "combat" | "race";

export default function MatchHistoryPage() {
  const [data, setData]     = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<TabId>("all");

  useEffect(() => {
    api.get<HistoryData>("/match-history")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allEntries: HistoryEntry[] = data
    ? ([...data.combat, ...data.races] as HistoryEntry[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const combatEntries = data?.combat ?? [];
  const raceEntries   = data?.races ?? [];

  const combatWins = combatEntries.filter(m => m.result === "win").length;
  const raceWins   = raceEntries.filter(m => m.result === "win").length;
  const bestFinish = raceEntries
    .filter(m => m.finishTime !== null)
    .reduce((best, m) => (m.finishTime! < best ? m.finishTime! : best), Infinity);

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: allEntries.length },
    { id: "combat", label: "Combat", count: combatEntries.length },
    { id: "race",   label: "Races",  count: raceEntries.length },
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }} className="relative z-10">
      <div className="dl-page-bg bg-arena" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="font-mono font-bold" style={{
          color: "#00d4ff", fontSize: 20, letterSpacing: "0.12em",
          textTransform: "uppercase", textShadow: "0 0 20px #00d4ff60",
        }}>
          Match History
        </h1>
        <p className="font-mono" style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
          Last 20 combat matches and last 20 races
        </p>
      </div>

      {/* Summary stats */}
      {data && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "COMBAT WINS",  value: `${combatWins}/${combatEntries.length}`, color: "#ff2d55" },
            { label: "RACE WINS",    value: `${raceWins}/${raceEntries.length}`,   color: "#00d4ff" },
            { label: "BEST FINISH",  value: bestFinish < Infinity ? `${(bestFinish/1000).toFixed(2)}s` : "—", color: "#39d353" },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, minWidth: 100,
              background: "#0d0d15", border: `1px solid ${s.color}20`,
              borderTop: `2px solid ${s.color}`, borderRadius: 6, padding: "10px 12px",
            }}>
              <div className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>{s.label}</div>
              <div className="font-mono font-bold" style={{ fontSize: 18, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono"
            style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 5, cursor: "pointer",
              background: tab === t.id ? "#00d4ff15" : "transparent",
              color: tab === t.id ? "#00d4ff" : "#475569",
              border: `1px solid ${tab === t.id ? "#00d4ff40" : "#1e1e2e"}`,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 5, color: tab === t.id ? "#00d4ff80" : "#334155" }}>({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="font-mono text-xs text-center py-16 animate-pulse" style={{ color: "#334155" }}>
          Loading match history…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tab === "all" && allEntries.map((m, i) => (
            m.type === "combat"
              ? <CombatRow key={m.matchId + i} m={m} />
              : <RaceRow   key={m.matchId + i} m={m} />
          ))}
          {tab === "combat" && combatEntries.map((m, i) => <CombatRow key={m.matchId + i} m={m} />)}
          {tab === "race"   && raceEntries.map((m, i)   => <RaceRow   key={m.matchId + i} m={m} />)}
          {((tab === "all" && allEntries.length === 0) ||
            (tab === "combat" && combatEntries.length === 0) ||
            (tab === "race" && raceEntries.length === 0)) && (
            <div className="font-mono text-xs text-center py-16" style={{ color: "#475569" }}>
              No matches yet — jump into the Arena or Race Hub to play
            </div>
          )}
        </div>
      )}
    </div>
  );
}
