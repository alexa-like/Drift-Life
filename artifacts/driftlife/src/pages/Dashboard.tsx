import { useState, useEffect } from "react";
import { User, FeedEvent } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { StatBar } from "../components/StatBar";
import { WantedStars } from "../components/WantedStars";

interface Props {
  user: User;
  onNav: (id: string) => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  refreshUser: () => Promise<User | null>;
}

export function Dashboard({ user, onNav, addToast, refreshUser }: Props) {
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [dailyStatus, setDailyStatus] = useState<any>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);

  useEffect(() => {
    api.get<FeedEvent[]>("/feed?limit=8").then(setFeed).catch(() => {});
    api.get<any>("/daily/status").then(setDailyStatus).catch(() => {});
  }, []);

  async function claimDaily() {
    setClaimingDaily(true);
    try {
      const data = await api.post<any>("/daily/claim");
      addToast(`Daily reward claimed! +${data.dcGained} DC, +${data.xpGained} XP (Day ${data.streak})`, "success");
      setDailyStatus({ ...dailyStatus, claimed: true, streak: data.streak });
      refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setClaimingDaily(false);
    }
  }

  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const xpPct = Math.round((user.xp / user.xpToNext) * 100);

  const RANK_COLORS: Record<string, string> = {
    "Street Rat": "#94a3b8",
    "Drifter": "#39d353",
    "Runner": "#00d4ff",
    "Enforcer": "#a855f7",
    "Ghost": "#ff6b35",
    "Legend": "#f59e0b",
  };
  const rankColor = RANK_COLORS[user.rank] ?? "#94a3b8";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Left — Player Card */}
      <div className="md:col-span-1 flex flex-col gap-4">
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg" style={{ color: "#e2e8f0" }}>{user.username}</span>
                <WantedStars level={user.wantedLevel} />
              </div>
              <span className="text-xs font-mono" style={{ color: rankColor }}>
                {user.rank} / Level {user.level}
              </span>
            </div>
            <div
              className="w-12 h-12 rounded flex items-center justify-center text-2xl"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
            >
              {user.avatar === "ghost" ? "👻" : "🤖"}
            </div>
          </div>

          {/* XP Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span style={{ color: "#475569" }}>XP</span>
              <span style={{ color: "#a855f7" }}>{user.xp}/{user.xpToNext} ({xpPct}%)</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #a855f7, #00d4ff)" }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-2">
            <StatBar label="HP" value={user.health} max={user.maxHealth} color="#39d353" />
            <StatBar label="Energy" value={user.energy} max={user.maxEnergy} color="#00d4ff" />
            <StatBar label="Nerve" value={user.nerve} max={user.maxNerve} color="#ff6b35" />
          </div>

          {/* Status alerts */}
          {isHospitalized && (
            <div className="mt-3 p-2 rounded text-xs font-mono" style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}>
              HOSPITALIZED — <button onClick={() => onNav("hospital")} className="underline">visit hospital</button>
            </div>
          )}
          {isJailed && !isHospitalized && (
            <div className="mt-3 p-2 rounded text-xs font-mono" style={{ background: "#f59e0b10", border: "1px solid #f59e0b40", color: "#f59e0b" }}>
              IN JAIL — wait for release or pay bail
            </div>
          )}
        </div>

        {/* Currency panel */}
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <h3 className="text-xs font-mono uppercase mb-3" style={{ color: "#475569" }}>Finances</h3>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>Wallet</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>{formatDC(user.dc)} DC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>Bank</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#39d353" }}>{formatDC(user.bankBalance)} DC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>UC (NeoCoins)</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#a855f7" }}>{formatDC(user.nc)} UC</span>
            </div>
          </div>
          <button
            onClick={() => onNav("bank")}
            className="mt-3 w-full py-1 rounded text-xs font-mono transition-all"
            style={{ background: "#1e1e2e", color: "#94a3b8", border: "1px solid #1e1e2e" }}
          >
            Manage Bank
          </button>
        </div>

        {/* Combat stats */}
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <h3 className="text-xs font-mono uppercase mb-3" style={{ color: "#475569" }}>Combat Record</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "STR", val: user.strength, color: "#ff6b35" },
              { label: "CHA", val: user.charisma, color: "#a855f7" },
              { label: "INT", val: user.intelligence, color: "#00d4ff" },
              { label: "REP", val: user.streetCred, color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xs font-mono" style={{ color: "#475569" }}>{s.label}</div>
                <div className="text-lg font-mono font-bold" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs font-mono">
            <span style={{ color: "#39d353" }}>W: {user.wins}</span>
            <span style={{ color: "#ff2d55" }}>L: {user.losses}</span>
            <span style={{ color: "#94a3b8" }}>Crimes: {user.successfulCrimes}</span>
          </div>
        </div>

        {/* Daily reward */}
        {dailyStatus && (
          <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <h3 className="text-xs font-mono uppercase mb-2" style={{ color: "#475569" }}>Daily Reward</h3>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-mono" style={{ color: "#94a3b8" }}>
                  Streak: <span style={{ color: "#f59e0b" }}>{dailyStatus.streak} days</span>
                </div>
                {!dailyStatus.claimed && dailyStatus.nextReward && (
                  <div className="text-xs font-mono mt-1" style={{ color: "#39d353" }}>
                    +{dailyStatus.nextReward.dc} DC / +{dailyStatus.nextReward.xp} XP
                  </div>
                )}
              </div>
              {!dailyStatus.claimed ? (
                <button
                  onClick={claimDaily}
                  disabled={claimingDaily}
                  className="px-3 py-1.5 rounded text-xs font-mono font-bold"
                  style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}
                >
                  {claimingDaily ? "..." : "Claim"}
                </button>
              ) : (
                <span className="text-xs font-mono" style={{ color: "#475569" }}>Claimed</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right — Feed + Quick actions */}
      <div className="md:col-span-2 flex flex-col gap-4">
        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: "crimes", label: "Commit Crime", color: "#ff2d55", icon: "skull" },
            { id: "jobs", label: "Work a Job", color: "#39d353", icon: "work" },
            { id: "combat", label: "Attack", color: "#ff6b35", icon: "fight" },
            { id: "market", label: "Market", color: "#00d4ff", icon: "shop" },
          ].map(a => (
            <button
              key={a.id}
              onClick={() => onNav(a.id)}
              className="p-3 rounded-lg text-xs font-mono font-bold uppercase text-center transition-all hover:opacity-90"
              style={{
                background: `${a.color}10`,
                color: a.color,
                border: `1px solid ${a.color}30`,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Live feed */}
        <div className="rounded-lg p-4 flex-1" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-mono uppercase" style={{ color: "#475569" }}>City Feed</h3>
            <button onClick={() => onNav("feed")} className="text-xs font-mono" style={{ color: "#475569" }}>view all</button>
          </div>
          <div className="flex flex-col gap-2">
            {feed.length === 0 && (
              <p className="text-xs font-mono text-center py-8" style={{ color: "#1e1e2e" }}>
                No activity yet. Be the first.
              </p>
            )}
            {feed.map(ev => {
              const typeColors: Record<string, string> = {
                crime: "#ff2d55", fight: "#ff6b35", job: "#39d353",
                market: "#00d4ff", bank: "#f59e0b", system: "#a855f7",
                level_up: "#f59e0b", hospital: "#ff2d55", frame_gift: "#a855f7",
              };
              const typeColor = typeColors[ev.type] ?? "#94a3b8";

              const frameColor = ev.actorFrameColor || null;
              const borderColor = frameColor || typeColor;
              const isLegendary = false;

              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 py-1.5"
                  style={{
                    borderLeft: `3px solid ${borderColor}`,
                    paddingLeft: 8,
                    marginLeft: -4,
                    background: borderColor !== typeColor ? `${borderColor}08` : "transparent",
                    borderBottom: "1px solid #1e1e2e",
                    animation: isLegendary ? "feedBorderPulse 2s ease-in-out infinite" : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono" style={{ color: "#e2e8f0" }}>{ev.message}</p>
                    {(ev.dc > 0 || ev.xp > 0) && (
                      <div className="flex gap-3 mt-0.5">
                        {ev.dc > 0 && <span className="text-xs font-mono" style={{ color: "#f59e0b" }}>+{ev.dc} DC</span>}
                        {ev.xp > 0 && <span className="text-xs font-mono" style={{ color: "#a855f7" }}>+{ev.xp} XP</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: "#334155" }}>
                    {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* District info */}
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-mono uppercase" style={{ color: "#475569" }}>Current District</span>
              <div className="text-sm font-mono font-bold mt-0.5" style={{ color: "#00d4ff" }}>
                {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>
            <button
              onClick={() => onNav("district")}
              className="px-3 py-1.5 rounded text-xs font-mono"
              style={{ background: "#1e1e2e", color: "#94a3b8", border: "1px solid #1e1e2e" }}
            >
              Travel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
