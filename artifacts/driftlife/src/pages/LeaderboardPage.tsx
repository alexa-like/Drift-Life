import { useState, useEffect, useRef } from "react";
import { LeaderboardEntry } from "../lib/types";
import { api } from "../lib/api";
import { AvatarWithFrame } from "../components/AvatarWithFrame";
import { formatDC } from "../lib/format";

type SortType = "level" | "dc" | "wins" | "crimes";

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
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, w, h);
      tRef.current++;
      const t = tRef.current;

      if (rank === 0) {
        const angle = (t / 120) * Math.PI * 2;
        const grad = ctx.createConicGradient(angle, w / 2, h / 2);
        grad.addColorStop(0, color + "ff");
        grad.addColorStop(0.2, color + "40");
        grad.addColorStop(0.5, color + "ff");
        grad.addColorStop(0.8, color + "20");
        grad.addColorStop(1, color + "ff");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.shadowBlur = 0;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t / 60) * Math.PI));
        ctx.strokeStyle = color + Math.floor(pulse * 60).toString(16).padStart(2, "0");
        ctx.lineWidth = 6;
        ctx.strokeRect(1, 1, w - 2, h - 2);
      } else if (rank === 1) {
        const pulse = 0.5 + 0.5 * Math.sin((t / 50) * Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 + pulse * 8;
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else {
        const pulse = 0.5 + 0.5 * Math.sin((t / 70) * Math.PI * 2);
        ctx.strokeStyle = color + "60";
        ctx.lineWidth = 3 + pulse * 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, rank]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}

function useWeeklyReset() {
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      // Next Monday 00:00 UTC
      const next = new Date(now);
      next.setUTCHours(0, 0, 0, 0);
      const day = next.getUTCDay(); // 0=Sun, 1=Mon
      next.setUTCDate(next.getUTCDate() + ((8 - day) % 7 || 7));
      const diff = next.getTime() - Date.now();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    }
    calc();
    const iv = setInterval(calc, 30000);
    return () => clearInterval(iv);
  }, []);
  return countdown;
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortType, setSortType] = useState<SortType>("level");
  const [loading, setLoading] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const weeklyCountdown = useWeeklyReset();
  void inspectId;

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardEntry[]>(`/leaderboard?type=${sortType}&limit=50`)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sortType]);

  const SORT_OPTS: { id: SortType; label: string; color: string }[] = [
    { id: "level",  label: "Level",  color: "#a855f7" },
    { id: "dc",     label: "Wealth", color: "#f59e0b" },
    { id: "wins",   label: "Wins",   color: "#ff6b35" },
    { id: "crimes", label: "Crime",  color: "#ff2d55" },
  ];

  function getMetricDisplay(entry: LeaderboardEntry): string {
    if (sortType === "dc") return `${formatDC(entry.dc + entry.bankBalance)} DC`;
    if (sortType === "wins") return `${entry.wins}W`;
    if (sortType === "crimes") return `${entry.crimes} crimes`;
    return `Lv.${entry.level}`;
  }

  const topEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex justify-between items-end flex-wrap gap-2">
        <div>
          <h1 className="font-mono text-lg font-bold" style={{ color: "#f59e0b", textShadow: "0 0 12px #f59e0b40" }}>
            NEW VANTA RANKINGS
          </h1>
          <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Who runs this city</p>
        </div>
        {weeklyCountdown && (
          <div className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#111118", border: "1px solid #1e1e2e", color: "#64748b" }}>
            WEEKLY RESET IN <span style={{ color: "#f59e0b" }}>{weeklyCountdown}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
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
        <>
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
                      style={{
                        background: `linear-gradient(135deg, ${medalColor}0a 0%, #111118 100%)`,
                        borderRadius: 4,
                      }}
                      onClick={() => setInspectId(entry.id)}
                    >
                      <div
                        className="font-mono font-bold flex-shrink-0 text-center"
                        style={{ width: 36, fontSize: rankSize, color: medalColor, textShadow: `0 0 12px ${medalColor}80`, lineHeight: 1 }}
                      >
                        {i === 0 ? "1" : i === 1 ? "2" : "3"}
                      </div>
                      <AvatarWithFrame
                        username={entry.username}
                        avatarUrl={(entry as any).avatarUrl}
                        frameId={(entry as any).equippedFrame || null}
                        frameColor={(entry as any).equippedFrameColor || null}
                        size={i === 0 ? "lg" : "md"}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold" style={{ fontSize: i === 0 ? 16 : 14, color: medalColor, textShadow: `0 0 8px ${medalColor}60` }}>
                            {entry.username}
                          </span>
                          {entry.faction && (
                            <span style={{ color: fc, fontSize: 11 }}>{entry.faction.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                          {TOP3_LABELS[i]} · Lv.{entry.level} · {entry.district?.replace(/-/g, " ")}
                        </div>
                        {entry.rankTitle && (
                          <div className="font-mono" style={{ color: "#334155", fontSize: 10 }}>[{entry.rankTitle}]</div>
                        )}
                      </div>
                      <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 14, color: medalColor }}>
                        {metric}
                      </div>
                    </div>
                  </AnimatedBorderRow>
                );
              })}
            </div>
          )}

          {restEntries.length > 0 && (
            <div style={{ border: "1px solid #1e1e2e", borderRadius: 8, overflow: "hidden" }}>
              {restEntries.map((entry, idx) => {
                const i = idx + 3;
                const fc = entry.faction ? FACTION_COLOR[entry.faction] : "#64748b";
                const metric = getMetricDisplay(entry);
                const frameColor = (entry as any).equippedFrameColor || null;
                const borderColor = frameColor || fc;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                    style={{
                      background: idx % 2 === 0 ? "#111118" : "#0d0d15",
                      borderBottom: "1px solid #1e1e2e",
                      borderLeft: `2px solid ${borderColor}30`,
                    }}
                    onClick={() => setInspectId(entry.id)}
                  >
                    <div className="font-mono font-bold flex-shrink-0 text-center" style={{ width: 28, fontSize: 11, color: "#334155" }}>
                      {i + 1}
                    </div>
                    <AvatarWithFrame
                      username={entry.username}
                      avatarUrl={(entry as any).avatarUrl}
                      frameId={(entry as any).equippedFrame || null}
                      frameColor={frameColor}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                          {entry.username}
                        </span>
                        {entry.faction && (
                          <span style={{ color: fc, fontSize: 10 }}>{entry.faction.toUpperCase()}</span>
                        )}
                        {entry.rankTitle && (
                          <span className="font-mono" style={{ color: "#475569", fontSize: 10 }}>[{entry.rankTitle}]</span>
                        )}
                      </div>
                      <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>
                        Lv.{entry.level} · {entry.district?.replace(/-/g, " ")}
                      </div>
                    </div>
                    <div className="font-mono font-bold flex-shrink-0" style={{ fontSize: 12, color: SORT_OPTS.find(s => s.id === sortType)?.color || "#e2e8f0" }}>
                      {metric}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
