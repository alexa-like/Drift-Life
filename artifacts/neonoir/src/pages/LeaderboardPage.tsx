import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { LeaderboardEntry } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { PrestigeBadge } from "../components/PrestigeBadge";
import { CyberSkeleton } from "../components/CyberSkeleton";

type SortType = "level" | "dc" | "wins" | "crimes";
type BoardTab = "city" | "minigame" | "mostWanted" | "hallOfFame";

interface BountyEntry {
  id: string;
  placerName: string;
  targetId: string;
  targetName: string;
  amount: number;
  expiresAt: string;
  createdAt: string;
}

function MostWanted() {
  const [bounties, setBounties] = useState<BountyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<BountyEntry[]>("/bounties?page=0")
      .then(data => setBounties(data.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <CyberSkeleton count={10} />;
  }
  if (bounties.length === 0) {
    return <div className="text-center py-16 font-mono text-xs" style={{ color: "#475569" }}>No active bounties. The city is quiet... for now.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>
        Top 10 players with active bounties — claimed automatically via Arena
      </div>
      {bounties.map((b, i) => {
        const daysLeft = Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / 86_400_000));
        return (
          <div key={b.id} style={{
            background: "#111118",
            border: "1px solid #ff2d5530",
            borderLeft: `3px solid #ff2d55${i === 0 ? "cc" : i < 3 ? "88" : "44"}`,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div className="font-mono font-bold flex-shrink-0" style={{ width: 24, fontSize: 12, color: "#334155" }}>
              {i + 1}
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#1A1A24", flexShrink: 0,
              border: "2px solid #ff2d5530", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, color: "#ff2d55",
            }}>
              💀
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-bold" style={{ fontSize: 14, color: "#ff2d55" }}>{b.targetName}</div>
              <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>
                Placed by {b.placerName} · {daysLeft}d left
              </div>
            </div>
            <div className="font-mono font-bold flex-shrink-0 text-right">
              <div style={{ fontSize: 16, color: "#f59e0b" }}>{b.amount.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>DC</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MiniLBType = "combat_wins" | "combat_streak" | "race_wins" | "race_fastest_2p" | "race_fastest_4p";
interface MiniLBEntry { _id: string; userId: string; username: string; avatar: string; score: number; rank: number }
interface MiniLBResponse { type: MiniLBType; label: string; nextReset: string; entries: MiniLBEntry[]; myEntry: (MiniLBEntry & { rank: number | null }) | null }

const MINI_TYPES: { id: MiniLBType; label: string; color: string; asc: boolean }[] = [
  { id: "combat_wins",      label: "Combat Wins",    color: "#ff2d55", asc: false },
  { id: "combat_streak",   label: "Best Streak",    color: "#ff6b35", asc: false },
  { id: "race_wins",       label: "Race Wins",      color: "#00d4ff", asc: false },
  { id: "race_fastest_2p", label: "Fastest 2p",     color: "#f59e0b", asc: true  },
  { id: "race_fastest_4p", label: "Fastest 4p",     color: "#a855f7", asc: true  },
];

function formatScore(type: MiniLBType, score: number): string {
  if (type === "race_fastest_2p" || type === "race_fastest_4p") {
    const ms = score;
    const s  = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${s}.${String(cs).padStart(2,"0")}s`;
  }
  return String(score);
}

function MiniLeaderboard() {
  const [activeType, setActiveType] = useState<MiniLBType>("combat_wins");
  const [data, setData] = useState<MiniLBResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<MiniLBResponse>(`/mini-leaderboard/${activeType}?limit=50`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [activeType]);

  const cfg = MINI_TYPES.find(t => t.id === activeType)!;

  function useCountdown(isoDate: string | undefined) {
    const [text, setText] = useState("");
    useEffect(() => {
      if (!isoDate) return;
      function calc() {
        const diff = new Date(isoDate!).getTime() - Date.now();
        if (diff <= 0) { setText("now"); return; }
        const d = Math.floor(diff / 86_400_000);
        const h = Math.floor((diff % 86_400_000) / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        setText(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
      }
      calc();
      const iv = setInterval(calc, 30_000);
      return () => clearInterval(iv);
    }, [isoDate]);
    return text;
  }

  const countdown = useCountdown(data?.nextReset);

  return (
    <div>
      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {MINI_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className="font-mono text-xs"
            style={{
              padding: "4px 10px", borderRadius: 4, cursor: "pointer",
              background: activeType === t.id ? t.color + "20" : "#111118",
              border: `1px solid ${activeType === t.id ? t.color : "#1e1e2e"}`,
              color: activeType === t.id ? t.color : "#475569",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-mono font-bold" style={{ color: cfg.color, fontSize: 13, letterSpacing: "0.1em" }}>
          {cfg.label.toUpperCase()} — WEEKLY
        </h3>
        {countdown && (
          <span className="font-mono" style={{ fontSize: 10, color: "#475569" }}>
            RESET IN <span style={{ color: "#f59e0b" }}>{countdown}</span>
          </span>
        )}
      </div>

      {/* Rewards info */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {[{ rank: "🥇", r: "5 Keys + 5,000 DC" }, { rank: "🥈", r: "3 Keys + 2,000 DC" }, { rank: "🥉", r: "1 Key + 1,000 DC" }].map(({ rank, r }) => (
          <div key={rank} className="font-mono" style={{ fontSize: 10, color: "#64748b", background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4, padding: "3px 8px" }}>
            {rank} {r}
          </div>
        ))}
      </div>

      {loading ? (
        <CyberSkeleton count={5} />
      ) : !data || data.entries.length === 0 ? (
        <div className="font-mono text-xs text-center py-8" style={{ color: "#475569" }}>
          No entries yet this week. Be the first!
        </div>
      ) : (
        <div style={{ border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" }}>
          {data.entries.map((e, idx) => {
            const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
            const rowColor = idx < 3 ? medalColors[idx] : cfg.color;
            const isMe = data.myEntry?.userId === e.userId;
            return (
              <motion.div
                key={e._id ?? e.userId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: isMe ? cfg.color + "10" : idx % 2 === 0 ? "#111118" : "#0d0d15",
                  borderBottom: "1px solid #1e1e2e",
                  borderLeft: `3px solid ${rowColor}${isMe ? "ff" : "30"}`,
                }}
              >
                <div className="font-mono font-bold flex-shrink-0 text-center" style={{ width: 24, fontSize: 12, color: idx < 3 ? rowColor : "#334155" }}>
                  {e.rank}
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#1e1e2e", flexShrink: 0,
                  border: `1px solid ${rowColor}30`, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: rowColor,
                }}>
                  {e.username?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm" style={{ color: isMe ? cfg.color : "#e2e8f0" }}>{e.username}</span>
                    {isMe && <span className="font-mono" style={{ fontSize: 9, color: cfg.color, border: `1px solid ${cfg.color}`, padding: "1px 4px", borderRadius: 3 }}>YOU</span>}
                  </div>
                </div>
                <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 12, color: rowColor }}>
                  {formatScore(activeType, e.score)}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* My rank (if outside top 50) */}
      {data?.myEntry && !data.entries.some(e => e.userId === data.myEntry?.userId) && (
        <div className="font-mono text-xs mt-3 text-center" style={{ color: "#475569" }}>
          Your rank: <span style={{ color: cfg.color }}>#{data.myEntry.rank}</span> with{" "}
          <span style={{ color: cfg.color }}>{formatScore(activeType, data.myEntry.score)}</span>
        </div>
      )}
    </div>
  );
}

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
const TOP3_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const TOP3_LABELS = ["CHAMPION", "RUNNER-UP", "THIRD"];

function AnimatedBorderRow({ color, children, rank }: { color: string; children: React.ReactNode; rank: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, w, h);
      tRef.current++;
      const t = tRef.current;

      if (rank === 0) {
        const angle = (t / 120) * Math.PI * 2;
        const grad = ctx.createConicGradient(angle, w / 2, h / 2);
        grad.addColorStop(0, color + "ff"); grad.addColorStop(0.2, color + "40");
        grad.addColorStop(0.5, color + "ff"); grad.addColorStop(0.8, color + "20");
        grad.addColorStop(1, color + "ff");
        ctx.strokeStyle = grad; ctx.lineWidth = 2;
        ctx.shadowColor = color; ctx.shadowBlur = 8;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.shadowBlur = 0;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t / 60) * Math.PI));
        ctx.strokeStyle = color + Math.floor(pulse * 60).toString(16).padStart(2, "0");
        ctx.lineWidth = 6; ctx.strokeRect(1, 1, w - 2, h - 2);
      } else if (rank === 1) {
        const pulse = 0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.shadowColor = color; ctx.shadowBlur = 6 + pulse * 8;
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      } else {
        const pulse = 0.5 + 0.5 * Math.sin((t / 70) * Math.PI * 2);
        ctx.strokeStyle = color + "60"; ctx.lineWidth = 3 + pulse * 3;
        ctx.shadowColor = color; ctx.shadowBlur = 10 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [color, rank]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

function useWeeklyReset() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date(), next = new Date(now);
      next.setUTCHours(0, 0, 0, 0);
      const day = next.getUTCDay();
      next.setUTCDate(next.getUTCDate() + ((8 - day) % 7 || 7));
      const diff = next.getTime() - Date.now();
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
      setCountdown(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    }
    calc();
    const iv = setInterval(calc, 30000);
    return () => clearInterval(iv);
  }, []);
  return countdown;
}

const SORT_OPTS: { id: SortType; label: string; color: string }[] = [
  { id: "level",  label: "Level",  color: "#a855f7" },
  { id: "dc",     label: "Wealth", color: "#f59e0b" },
  { id: "wins",   label: "Wins",   color: "#ff6b35" },
  { id: "crimes", label: "Crime",  color: "#ff2d55" },
];

export function LeaderboardPage({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const [tab, setTab] = useState<BoardTab>("city");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortType, setSortType] = useState<SortType>("level");
  const [loading, setLoading] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const weeklyCountdown = useWeeklyReset();
  void inspectId;

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardEntry[]>(`/leaderboard?type=${sortType}&limit=50`)
      .then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, [sortType]);

  const activeSort = SORT_OPTS.find(s => s.id === sortType)!;

  function getMetricDisplay(entry: LeaderboardEntry): string {
    if (sortType === "dc") return `${formatDC(entry.dc + entry.bankBalance)} DC`;
    if (sortType === "wins") return `${entry.wins}W`;
    if (sortType === "crimes") return `${entry.crimes} crimes`;
    return `Lv.${entry.level}`;
  }

  const topEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  return (
    <div className="max-w-2xl mx-auto relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Header */}
      <div className="mb-4 flex justify-between items-end flex-wrap gap-3">
        <div>
          <CyberSectionHeader title="New Vanta Rankings" accent="#f59e0b" size="lg" cursor className="mb-1" />
          <p className="font-mono text-xs" style={{ color: "#64748b" }}>Who runs this city</p>
        </div>
      </div>

      {/* Main tab: City vs Mini-Game vs Most Wanted vs Hall of Fame */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ["city",       "City Rankings",    "#f59e0b"],
          ["minigame",   "Mini-Game Weekly", "#00d4ff"],
          ["mostWanted", "Most Wanted 💀",   "#ff2d55"],
          ["hallOfFame", "🏆 Hall of Fame",  "#FFD700"],
        ] as const).map(([id, label, color]) => (
          <button
            key={id}
            onClick={() => {
              if (id === "hallOfFame") {
                onNavigate?.("hall-of-fame");
              } else {
                setTab(id as BoardTab);
              }
            }}
            className="font-mono font-bold text-xs"
            style={{
              padding: "6px 14px", borderRadius: 4, cursor: "pointer",
              background: tab === id ? (color as string) + "20" : "#111118",
              border: `1px solid ${tab === id ? color : "#1e1e2e"}`,
              color: tab === id ? color as string : "#475569",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mini-game leaderboard */}
      {tab === "minigame" && <MiniLeaderboard />}

      {/* Most Wanted */}
      {tab === "mostWanted" && <MostWanted />}

      {/* City rankings */}
      {tab === "city" && <>
      {/* Sort filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {SORT_OPTS.map(opt => (
          <CyberButton
            key={opt.id}
            variant={sortType === opt.id ? (
              opt.id === "level" ? "purple" :
              opt.id === "dc"    ? "warning" :
              opt.id === "wins"  ? "warning" : "danger"
            ) : "ghost"}
            size="sm"
            onClick={() => setSortType(opt.id)}
          >
            {opt.label}
          </CyberButton>
        ))}
      </div>

      {loading ? (
        <CyberSkeleton count={15} />
      ) : entries.length === 0 ? (
        <div className="text-center py-16 font-mono text-xs" style={{ color: "#475569" }}>No data yet. Start playing.</div>
      ) : (
        <>
          {/* Top 3 */}
          {topEntries.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {topEntries.map((entry, i) => {
                const medalColor = TOP3_COLORS[i];
                const fc = entry.faction ? FACTION_COLOR[entry.faction] : "#64748b";
                const metric = getMetricDisplay(entry);
                const rankSize = [32, 26, 24][i];
                return (
                  <AnimatedBorderRow key={entry.id} color={medalColor} rank={i}>
                    <div
                      className="flex items-center gap-3 px-4 py-4 cursor-pointer"
                      style={{ background: `linear-gradient(135deg, ${medalColor}0a 0%, #111118 100%)`, borderRadius: 4 }}
                      onClick={() => setInspectId(entry.id)}
                    >
                      <div className="font-mono font-bold flex-shrink-0 text-center"
                        style={{ width: 36, fontSize: rankSize, color: medalColor, textShadow: `0 0 12px ${medalColor}80`, lineHeight: 1 }}>
                        {i + 1}
                      </div>
                      <div style={{
                        width: i === 0 ? 48 : 36, height: i === 0 ? 48 : 36,
                        borderRadius: "50%", background: "#1e1e2e", flexShrink: 0,
                        border: `2px solid ${medalColor}40`, overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: i === 0 ? 18 : 14, color: medalColor,
                      }}>
                        {(entry as any).avatarUrl
                          ? <img src={(entry as any).avatarUrl} alt={entry.username} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : entry.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold" style={{ fontSize: i === 0 ? 16 : 14, color: medalColor, textShadow: `0 0 8px ${medalColor}60` }}>
                            {entry.username}
                          </span>
                          {entry.prestige ? <PrestigeBadge prestige={entry.prestige} size="sm" /> : null}
                          {entry.faction && <span style={{ color: fc, fontSize: 11 }}>{entry.faction.toUpperCase()}</span>}
                        </div>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                          {TOP3_LABELS[i]} · Lv.{entry.level} · {entry.district?.replace(/-/g, " ")}
                        </div>
                        {entry.rankTitle && <div className="font-mono" style={{ color: "#334155", fontSize: 10 }}>[{entry.rankTitle}]</div>}
                      </div>
                      <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 14, color: medalColor }}>{metric}</div>
                    </div>
                  </AnimatedBorderRow>
                );
              })}
            </div>
          )}

          {/* Rest of list */}
          {restEntries.length > 0 && (
            <div style={{ border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" }}>
              {restEntries.map((entry, idx) => {
                const i = idx + 3;
                const fc = entry.faction ? FACTION_COLOR[entry.faction] : "#64748b";
                const metric = getMetricDisplay(entry);
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{
                      background: idx % 2 === 0 ? "#111118" : "#0d0d15",
                      borderBottom: "1px solid #1e1e2e",
                      borderLeft: `3px solid ${fc}30`,
                      transition: "background 0.15s",
                    }}
                    whileHover={{ backgroundColor: "#16161f" } as any}
                    onClick={() => setInspectId(entry.id)}
                  >
                    <div className="font-mono font-bold flex-shrink-0 text-center" style={{ width: 28, fontSize: 11, color: "#334155" }}>
                      {i + 1}
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: "#1e1e2e", flexShrink: 0,
                      border: `1px solid ${fc}30`, overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: fc,
                    }}>
                      {(entry as any).avatarUrl
                        ? <img src={(entry as any).avatarUrl} alt={entry.username} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{entry.username}</span>
                        {entry.prestige ? <PrestigeBadge prestige={entry.prestige} size="sm" /> : null}
                        {entry.faction && <span style={{ color: fc, fontSize: 10 }}>{entry.faction.toUpperCase()}</span>}
                        {entry.rankTitle && <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>[{entry.rankTitle}]</span>}
                      </div>
                      <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                        Lv.{entry.level} · {entry.district?.replace(/-/g, " ")}
                      </div>
                    </div>
                    <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 12, color: activeSort.color }}>
                      {metric}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
      </>}
    </div>
  );
}
