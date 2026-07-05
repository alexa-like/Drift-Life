import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, FeedEvent } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { WantedStars } from "../components/WantedStars";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { NeonProgressBar } from "../components/NeonProgressBar";
import { StatCounter } from "../components/StatCounter";
import { CyberButton } from "../components/CyberButton";

interface Props {
  user: User;
  onNav: (id: string) => void;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  refreshUser: () => Promise<User | null>;
}

const RANK_COLORS: Record<string, string> = {
  "Street Rat": "#94a3b8",
  "Drifter":    "#39d353",
  "Runner":     "#00d4ff",
  "Enforcer":   "#a855f7",
  "Ghost":      "#ff6b35",
  "Legend":     "#f59e0b",
};

const FEED_COLORS: Record<string, string> = {
  crime: "#ff2d55", fight: "#ff6b35", job: "#39d353",
  market: "#00d4ff", bank: "#f59e0b", system: "#a855f7",
  level_up: "#f59e0b", hospital: "#ff2d55", frame_gift: "#a855f7",
};

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
  const rankColor = RANK_COLORS[user.rank] ?? "#94a3b8";

  // Contextual action
  const jailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const hospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const dailyReady = dailyStatus && !dailyStatus.claimed;
  const heatCritical = (user.heat ?? 0) >= 80;
  const nerveAvail = (user.nerve ?? 0) > 0;
  const energyAvail = (user.energy ?? 0) > 0;
  const dirtyDcPending = (user.dirtyDc ?? 0) > 50_000;

  let ctaCard: { label: string; desc: string; nav?: string; action?: string; color: string } | null = null;
  if (jailed)            ctaCard = { label: "Fight the Charges", desc: "You're in jail. Go to court to plead or fight.", nav: "city", color: "#f59e0b" };
  else if (hospitalized) ctaCard = { label: "Visit Hospital", desc: "You're hospitalized — pay to discharge early.", nav: "hospital", color: "#ff2d55" };
  else if (dailyReady)   ctaCard = { label: "Claim Daily Reward", desc: `Day ${dailyStatus.streak} streak — +${dailyStatus.nextReward?.dc?.toLocaleString() ?? "?"} DC`, action: "daily", color: "#f59e0b" };
  else if (heatCritical && dirtyDcPending) ctaCard = { label: "Launder Dirty DC", desc: "Heat is critical and you're sitting on dirty money.", nav: "city", color: "#ff2d55" };
  else if (nerveAvail)   ctaCard = { label: "Run a Crime", desc: `${user.nerve}/${user.maxNerve} nerve ready — hit the streets.`, nav: "city", color: "#ff6b35" };
  else if (energyAvail)  ctaCard = { label: "Work a Shift", desc: `${user.energy}/${user.maxEnergy} energy available — earn clean DC.`, nav: "jobs", color: "#39d353" };
  else if (dirtyDcPending) ctaCard = { label: "Launder Dirty DC", desc: `${(user.dirtyDc ?? 0).toLocaleString()} dirty DC sitting idle — clean it.`, nav: "city", color: "#a855f7" };
  else                   ctaCard = { label: "Train at the Gym", desc: "Low on resources — build your stats while you wait.", nav: "gym", color: "#00d4ff" };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* ── Left column ── */}
      <div className="md:col-span-1 flex flex-col gap-4">

        {/* Player ID card */}
        <AnimatedCard accent={rankColor}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono font-bold text-lg" style={{ color: "#e2e8f0" }}>{user.username}</span>
                <WantedStars level={user.wantedLevel} />
              </div>
              <span className="text-xs font-mono tracking-wider" style={{ color: rankColor, textShadow: `0 0 8px ${rankColor}60` }}>
                {user.rank} · Lv.{user.level}
              </span>
            </div>
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center font-mono font-bold text-sm flex-shrink-0"
              style={{
                background: `${rankColor}10`,
                border: `1px solid ${rankColor}40`,
                color: rankColor,
                letterSpacing: "0.05em",
                boxShadow: `0 0 12px ${rankColor}20`,
              }}
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* XP */}
          <div className="mb-4">
            <NeonProgressBar
              value={user.xp}
              max={user.xpToNext}
              color="#a855f7"
              label="XP"
              height={5}
            />
          </div>

          {/* Vitals */}
          <div className="flex flex-col gap-2.5">
            <NeonProgressBar value={user.health}  max={user.maxHealth}  color="#39d353" label="HP"     />
            <NeonProgressBar value={user.energy}  max={user.maxEnergy}  color="#00d4ff" label="Energy" />
            <NeonProgressBar value={user.nerve}   max={user.maxNerve}   color="#ff6b35" label="Nerve"  />
            {((user.heat ?? 0) > 0 || (user.stress ?? 0) > 0) && (
              <>
                <NeonProgressBar
                  value={user.heat ?? 0} max={100}
                  color={(user.heat ?? 0) >= 80 ? "#ff2d55" : (user.heat ?? 0) >= 50 ? "#ff6b35" : "#f59e0b"}
                  label={(user.heat ?? 0) >= 80 ? "Heat [CRIT]" : "Heat"}
                />
                <NeonProgressBar value={user.stress ?? 0} max={100} color="#a855f7" label="Stress" />
              </>
            )}
          </div>

          {/* Status alerts */}
          {isHospitalized && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 px-3 py-2 rounded text-xs font-mono flex items-center justify-between"
              style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}
            >
              <span>HOSPITALIZED</span>
              <button onClick={() => onNav("hospital")} className="underline opacity-80 hover:opacity-100">visit hospital</button>
            </motion.div>
          )}
          {isJailed && !isHospitalized && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 px-3 py-2 rounded text-xs font-mono"
              style={{ background: "#f59e0b10", border: "1px solid #f59e0b40", color: "#f59e0b" }}
            >
              IN JAIL — wait for release or pay bail
            </motion.div>
          )}
        </AnimatedCard>

        {/* Finances */}
        <AnimatedCard accent="#f59e0b">
          <CyberSectionHeader title="Finances" accent="#f59e0b" />
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>Wallet</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>
                <StatCounter value={user.dc} format={formatDC} color="#f59e0b" suffix=" DC" />
              </span>
            </div>
            {(user.dirtyDc ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>Dirty DC</span>
                <span className="text-sm font-mono font-bold" style={{ color: "#f97316" }}>
                  <StatCounter value={user.dirtyDc} format={formatDC} color="#f97316" suffix=" DC" />
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>Bank</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#39d353" }}>
                <StatCounter value={user.bankBalance} format={formatDC} color="#39d353" suffix=" DC" />
              </span>
            </div>
            {(user.sim ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>SIM</span>
                <span className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>
                  <StatCounter value={user.sim} format={formatDC} color="#22d3ee" />
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>UC (NeoCoins)</span>
              <span className="text-sm font-mono font-bold" style={{ color: "#a855f7" }}>
                <StatCounter value={user.nc} format={formatDC} color="#a855f7" suffix=" UC" />
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
            <CyberButton variant="ghost" size="sm" className="w-full" onClick={() => onNav("bank")}>
              Manage Bank
            </CyberButton>
          </div>
        </AnimatedCard>

        {/* Combat stats */}
        <AnimatedCard accent="#ff6b35">
          <CyberSectionHeader title="Combat Record" accent="#ff6b35" />
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "STR", val: user.strength,    color: "#ff6b35" },
              { label: "CHA", val: user.charisma,    color: "#a855f7" },
              { label: "INT", val: user.intelligence, color: "#00d4ff" },
              { label: "REP", val: user.streetCred,  color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="text-center py-2 rounded" style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                <div className="text-xs font-mono mb-1" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                <div className="text-lg font-mono font-bold" style={{ color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-mono pt-2" style={{ borderTop: "1px solid #1e1e2e" }}>
            <span style={{ color: "#39d353" }}>W: {user.wins}</span>
            <span style={{ color: "#ff2d55" }}>L: {user.losses}</span>
            <span style={{ color: "#94a3b8" }}>Crimes: {user.successfulCrimes}</span>
          </div>
        </AnimatedCard>

        {/* Daily reward */}
        {dailyStatus && (
          <AnimatedCard accent="#f59e0b">
            <div className="flex justify-between items-start mb-3">
              <div>
                <CyberSectionHeader title="Daily Reward" accent="#f59e0b" className="mb-0" />
                <div className="text-xs font-mono mt-1" style={{ color: "#64748b" }}>
                  Streak:{" "}
                  <span style={{ color: "#f59e0b", textShadow: "0 0 8px #f59e0b60" }}>
                    {dailyStatus.streak ?? 0} days
                  </span>
                </div>
              </div>
              {!dailyStatus.claimed ? (
                <CyberButton
                  variant="warning"
                  size="sm"
                  loading={claimingDaily}
                  onClick={claimDaily}
                  className="animate-pulse-glow"
                >
                  Claim
                </CyberButton>
              ) : (
                <span className="text-xs font-mono" style={{ color: "#475569" }}>Claimed</span>
              )}
            </div>

            {/* 7-day calendar */}
            {(() => {
              const schedule = dailyStatus.rewardSchedule ?? [1,2,3,4,5,6,7].map((d: number) => ({ day: d, dc: d * 50, xp: d * 10 }));
              const streak = dailyStatus.streak ?? 0;
              const posInCycle = streak % 7;
              const todayDay = dailyStatus.claimed ? posInCycle : (posInCycle + 1);
              return (
                <div className="grid grid-cols-7 gap-1">
                  {schedule.map((slot: any) => {
                    const dayNum = slot.day;
                    const isToday = dayNum === todayDay || (posInCycle === 0 && dayNum === 7 && !dailyStatus.claimed);
                    const isPast = dayNum < todayDay || (dailyStatus.claimed && dayNum <= posInCycle) || (dailyStatus.claimed && dayNum === todayDay);
                    const isMilestone = slot.itemRarity != null;
                    return (
                      <div key={dayNum} className="flex flex-col items-center gap-0.5 transition-all duration-200" style={{
                        background: isToday ? "#f59e0b14" : isPast ? "#39d35308" : "#0a0a0f",
                        border: `1px solid ${isToday ? "#f59e0b50" : isPast ? "#39d35330" : "#1e1e2e"}`,
                        borderRadius: 4,
                        padding: "4px 2px",
                        boxShadow: isToday ? "0 0 8px #f59e0b20" : "none",
                      }}>
                        <div className="font-mono" style={{ fontSize: 8, color: isToday ? "#f59e0b" : isPast ? "#39d353" : "#334155" }}>D{dayNum}</div>
                        <div style={{ fontSize: 8, color: isPast ? "#39d353" : isToday ? "#f59e0b" : isMilestone ? "#f59e0b" : "#64748b" }}>
                          {isPast ? "✓" : isMilestone ? "*" : "+"}
                        </div>
                        <div className="font-mono" style={{ fontSize: 7, color: isPast ? "#39d35380" : isToday ? "#f59e0b" : "#334155", textAlign: "center", lineHeight: 1.2 }}>
                          {(slot.dc / 1000).toFixed(slot.dc < 1000 ? 1 : 0)}k
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {!dailyStatus.claimed && dailyStatus.nextReward && (
              <div className="text-xs font-mono mt-2" style={{ color: "#39d353" }}>
                Today: +{dailyStatus.nextReward.dc?.toLocaleString()} DC / +{dailyStatus.nextReward.xp} XP
                {dailyStatus.nextReward.bonus && <span style={{ color: "#f59e0b" }}> + {dailyStatus.nextReward.bonus}</span>}
              </div>
            )}
          </AnimatedCard>
        )}
      </div>

      {/* ── Right column ── */}
      <div className="md:col-span-2 flex flex-col gap-4">

        {/* CTA banner */}
        {ctaCard && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: `0 0 20px ${ctaCard.color}20` }}
            whileTap={{ scale: 0.99 }}
            onClick={() => ctaCard!.action === "daily" ? claimDaily() : onNav(ctaCard!.nav!)}
            disabled={ctaCard.action === "daily" && claimingDaily}
            className="p-4 rounded-lg flex items-center justify-between gap-4 text-left w-full"
            style={{
              background: `${ctaCard.color}0c`,
              border: `1px solid ${ctaCard.color}30`,
              boxShadow: `inset 0 0 20px ${ctaCard.color}05`,
            }}
          >
            <div>
              <div className="font-mono font-bold text-sm" style={{ color: ctaCard.color, letterSpacing: "0.05em" }}>{ctaCard.label}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{ctaCard.desc}</div>
            </div>
            <span
              className="font-mono text-xs flex-shrink-0 px-3 py-1.5 rounded font-bold uppercase"
              style={{ background: `${ctaCard.color}20`, color: ctaCard.color, border: `1px solid ${ctaCard.color}30`, letterSpacing: "0.08em" }}
            >
              {ctaCard.action === "daily" && claimingDaily ? "..." : "→ Go"}
            </span>
          </motion.button>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: "crimes", label: "Commit Crime", variant: "danger"  as const },
            { id: "jobs",   label: "Work a Job",   variant: "success" as const },
            { id: "combat", label: "Attack",        variant: "warning" as const },
            { id: "market", label: "Market",        variant: "primary" as const },
          ].map(a => (
            <CyberButton key={a.id} variant={a.variant} size="sm" className="w-full uppercase" onClick={() => onNav(a.id)}>
              {a.label}
            </CyberButton>
          ))}
        </div>

        {/* City Feed */}
        <AnimatedCard accent="#00d4ff" className="flex-1" noPad>
          <div className="p-4 pb-2 flex items-center justify-between">
            <CyberSectionHeader title="City Feed" accent="#00d4ff" cursor className="mb-0 flex-1" />
            <button onClick={() => onNav("feed")} className="text-xs font-mono ml-2 flex-shrink-0" style={{ color: "#475569" }}>
              view all
            </button>
          </div>
          <div className="flex flex-col">
            {feed.length === 0 && (
              <p className="text-xs font-mono text-center py-8" style={{ color: "#1e1e2e" }}>No activity yet. Be the first.</p>
            )}
            {feed.map((ev, idx) => {
              const typeColor = FEED_COLORS[ev.type] ?? "#94a3b8";
              const borderColor = ev.actorFrameColor || typeColor;
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  className="flex items-start gap-2 py-2 px-4"
                  style={{
                    borderLeft: `3px solid ${borderColor}60`,
                    background: ev.actorFrameColor ? `${borderColor}06` : "transparent",
                    borderBottom: "1px solid #1e1e2e",
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
                </motion.div>
              );
            })}
          </div>
        </AnimatedCard>

        {/* District */}
        <AnimatedCard accent="#00d4ff">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#475569" }}>Current District</div>
              <div className="text-sm font-mono font-bold" style={{ color: "#00d4ff", textShadow: "0 0 8px #00d4ff40" }}>
                {user.district.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </div>
            </div>
            <CyberButton variant="ghost" size="sm" onClick={() => onNav("city")}>Travel</CyberButton>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
