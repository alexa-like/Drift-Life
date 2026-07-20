import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, FeedEvent } from "../lib/types";
import { EventBanner } from "../components/EventBanner";
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
  level_up: "#f59e0b", hospital: "#ff2d55",
};

export function Dashboard({ user, onNav, addToast, refreshUser }: Props) {
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [dailyStatus, setDailyStatus] = useState<any>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);

  useEffect(() => {
    api.get<FeedEvent[]>("/feed?limit=6").then(setFeed).catch(() => {});
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
  const rankColor = RANK_COLORS[user.rank] ?? "#00d4ff";

  // Contextual action logic
  const jailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const hospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const dailyReady = dailyStatus && !dailyStatus.claimed;
  const heatCritical = (user.heat ?? 0) >= 80;
  const nerveAvail = (user.nerve ?? 0) > 0;
  const energyAvail = (user.energy ?? 0) > 0;
  const dirtyDcPending = (user.dirtyDc ?? 0) > 50_000;

  let ctaCard: { label: string; desc: string; nav?: string; action?: string; color: string; icon: string } | null = null;
  if (jailed)            ctaCard = { label: "FIGHT CHARGES", desc: "You're in jail. Go to court to plead or fight.", nav: "city", color: "#f59e0b", icon: "⚖️" };
  else if (hospitalized) ctaCard = { label: "MEDICAL ATTENTION", desc: "You're hospitalized — pay to discharge early.", nav: "hospital", color: "#ff2d55", icon: "🏥" };
  else if (dailyReady)   ctaCard = { label: "INCOMING DROP", desc: `Day ${dailyStatus.streak} streak — +${dailyStatus.nextReward?.dc?.toLocaleString() ?? "?"} DC available`, action: "daily", color: "#39d353", icon: "📦" };
  else if (heatCritical && dirtyDcPending) ctaCard = { label: "LAUNDER FUNDS", desc: "Heat is critical and you're sitting on dirty money.", nav: "city", color: "#ff2d55", icon: "🔥" };
  else if (nerveAvail)   ctaCard = { label: "HIT THE STREETS", desc: `${user.nerve}/${user.maxNerve} nerve ready — run a crime.`, nav: "crimes", color: "#ff6b35", icon: "🔫" };
  else if (energyAvail)  ctaCard = { label: "WORK SHIFT", desc: `${user.energy}/${user.maxEnergy} energy available — earn clean DC.`, nav: "jobs", color: "#00d4ff", icon: "💼" };
  else if (dirtyDcPending) ctaCard = { label: "LAUNDER FUNDS", desc: `${(user.dirtyDc ?? 0).toLocaleString()} dirty DC sitting idle — clean it.`, nav: "city", color: "#a855f7", icon: "💵" };
  else                   ctaCard = { label: "TRAIN STATS", desc: "Low on resources — build your stats while you wait.", nav: "training", color: "#f59e0b", icon: "🏋️" };

  // Helper for HUD vitals
  const renderVital = (label: string, val: number, max: number, color: string) => (
    <div className="flex-1">
      <NeonProgressBar value={val} max={max} color={color} label={label} height={6} />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-0">
      <div className="dl-page-bg bg-city" />

      {/* ── Event Banner ── */}
      {user.activeEvent && (
        <div className="lg:col-span-12">
          <EventBanner event={user.activeEvent} onNav={onNav} />
        </div>
      )}

      {/* ── Left Column (Stats & Identity) ── */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        
        {/* ID Card */}
        <AnimatedCard accent={rankColor} className="relative overflow-hidden">
          <CyberSectionHeader title="OPERATIVE ID" accent={rankColor} size="sm" className="mb-2" />
          
          <div className="flex items-center gap-4 mb-4">
            <div 
              className="w-16 h-16 clip-nav-item flex items-center justify-center font-display font-bold text-xl relative"
              style={{
                background: `${rankColor}20`,
                color: rankColor,
                border: `1px solid ${rankColor}`,
                boxShadow: `0 0 15px ${rankColor}40`
              }}
            >
              {user.username.slice(0, 2).toUpperCase()}
              {/* Rotating ring */}
              <div className="absolute inset-[-4px] border border-dashed rounded-full animate-spin-slow opacity-30" style={{ borderColor: rankColor }} />
            </div>
            
            <div className="flex-1">
              <div className="font-display font-bold text-xl uppercase tracking-wider text-white mb-1">
                {user.username}
              </div>
              <div className="font-mono text-xs uppercase" style={{ color: rankColor }}>
                [{user.rank}] // LVL {user.level}
              </div>
              <div className="mt-1">
                <WantedStars level={user.wantedLevel} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <NeonProgressBar
              value={user.xp}
              max={user.xpToNext}
              color="#a855f7"
              label="EXP TO NEXT LEVEL"
              height={4}
            />
            
            {/* Vitals HUD row */}
            <div className="flex gap-3 pt-2 border-t border-[#1e1e2e]">
              {renderVital("HP", user.health, user.maxHealth, "#ff2d55")}
              {renderVital("ENG", user.energy, user.maxEnergy, "#00d4ff")}
              {renderVital("NRV", user.nerve, user.maxNerve, "#ff6b35")}
            </div>
          </div>
        </AnimatedCard>

        {/* Financial Data */}
        <AnimatedCard accent="#f59e0b">
          <CyberSectionHeader title="ASSETS" accent="#f59e0b" cursor />
          
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between items-center bg-[#0d0d14] p-2 clip-bar border border-[#1e1e2e]">
              <span className="text-[#64748b]">WALLET</span>
              <span className="font-bold text-[#f59e0b] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                {formatDC(user.dc)} DC
              </span>
            </div>
            <div className="flex justify-between items-center bg-[#0d0d14] p-2 clip-bar border border-[#1e1e2e]">
              <span className="text-[#64748b]">BANK</span>
              <span className="font-bold text-[#39d353] drop-shadow-[0_0_8px_rgba(57,211,83,0.5)]">
                {formatDC(user.bankBalance)} DC
              </span>
            </div>
            {(user.dirtyDc ?? 0) > 0 && (
              <div className="flex justify-between items-center bg-[#1a0f0a] p-2 clip-bar border border-[#ff6b35] animate-pulse">
                <span className="text-[#ff6b35]">DIRTY DC</span>
                <span className="font-bold text-[#ff2d55]">
                  {formatDC(user.dirtyDc)} DC
                </span>
              </div>
            )}
            <div className="flex justify-between items-center bg-[#0d0d14] p-2 clip-bar border border-[#1e1e2e]">
              <span className="text-[#64748b]">N-CREDITS</span>
              <span className="font-bold text-[#a855f7] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                {formatDC(user.nc)} NC
              </span>
            </div>
          </div>
        </AnimatedCard>

      </div>

      {/* ── Right Column (Action & Data) ── */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        
        {/* Command Directive (CTA) */}
        {ctaCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="clip-card p-1 cursor-pointer group"
            style={{
              background: `linear-gradient(45deg, ${ctaCard.color}40, transparent)`,
              boxShadow: `0 0 20px ${ctaCard.color}20`
            }}
            onClick={() => ctaCard!.action === "daily" ? claimDaily() : onNav(ctaCard!.nav!)}
          >
            <div className="bg-[#111118] p-4 flex items-center justify-between clip-card h-full border border-transparent group-hover:border-current transition-colors" style={{ color: ctaCard.color }}>
              <div className="flex items-center gap-4">
                <div className="text-3xl animate-pulse">{ctaCard.icon}</div>
                <div>
                  <div className="font-display font-bold text-lg uppercase tracking-widest text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                    {ctaCard.label}
                  </div>
                  <div className="font-mono text-sm text-[#94a3b8] mt-1">{ctaCard.desc}</div>
                </div>
              </div>
              <div className="font-mono font-bold text-xl opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                ►
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Launch Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: "crimes", label: "CRIMES", color: "#ff2d55" },
            { id: "jobs", label: "JOBS", color: "#39d353" },
            { id: "arena-combat", label: "ARENA", color: "#f59e0b" },
            { id: "market", label: "MARKET", color: "#00d4ff" },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => onNav(action.id)}
              className="clip-btn py-3 px-2 font-display font-bold text-sm tracking-wider uppercase transition-all duration-300 relative overflow-hidden group"
              style={{
                background: `${action.color}15`,
                color: action.color,
                border: `1px solid ${action.color}50`,
              }}
            >
              <div className="absolute inset-0 bg-current opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-current" />
              <span className="relative z-10 group-hover:text-white transition-colors text-shadow-[0_0_8px_currentColor]">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Main Grid: Feed & Combat */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
          
          {/* Network Activity */}
          <AnimatedCard accent="#00d4ff" className="flex flex-col h-full">
            <CyberSectionHeader title="NETWORK LOG" accent="#00d4ff" cursor />
            
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-2">
              {feed.length === 0 ? (
                <div className="font-mono text-sm text-[#475569] text-center py-8">AWAITING DATA...</div>
              ) : (
                feed.map((ev, i) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 bg-[#0d0d14] clip-bar border-l-2 relative"
                    style={{ borderColor: FEED_COLORS[ev.type] || "#475569" }}
                  >
                    <div className="absolute top-0 right-0 p-1 font-mono text-[9px] text-[#475569]">
                      {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="font-mono text-xs text-[#e2e8f0] pr-8">{ev.message}</div>
                    {(ev.dc > 0 || ev.xp > 0) && (
                      <div className="flex gap-3 mt-1.5 text-[10px] font-mono font-bold">
                        {ev.dc > 0 && <span className="text-[#f59e0b] drop-shadow-[0_0_5px_#f59e0b]">+{ev.dc} DC</span>}
                        {ev.xp > 0 && <span className="text-[#a855f7] drop-shadow-[0_0_5px_#a855f7]">+{ev.xp} XP</span>}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
            
            <div className="pt-3 mt-auto border-t border-[#1e1e2e] text-center">
               <button onClick={() => onNav("feed")} className="font-mono text-xs text-[#00d4ff] hover:text-white transition-colors">
                 [ VIEW_FULL_LOG ]
               </button>
            </div>
          </AnimatedCard>

          {/* Combat Rating */}
          <AnimatedCard accent="#ff2d55" className="flex flex-col">
            <CyberSectionHeader title="COMBAT RATING" accent="#ff2d55" />
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "STR", val: user.strength, color: "#ff2d55" },
                { label: "INT", val: user.intelligence, color: "#00d4ff" },
                { label: "CHA", val: user.charisma, color: "#a855f7" },
                { label: "REP", val: user.streetCred, color: "#f59e0b" },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0d0d14] p-3 clip-bar border border-[#1e1e2e] relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }} />
                  <div className="font-mono text-[10px] text-[#64748b] mb-1">{stat.label}</div>
                  <div className="font-display text-xl font-bold text-white drop-shadow-[0_0_8px_currentColor]" style={{ color: stat.color }}>{stat.val}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto bg-[#1a0f12] p-3 clip-bar border border-[#ff2d55] flex justify-between items-center font-mono text-sm">
               <div className="text-center">
                 <div className="text-[#64748b] text-[10px]">WINS</div>
                 <div className="text-[#39d353] font-bold">{user.wins}</div>
               </div>
               <div className="text-center">
                 <div className="text-[#64748b] text-[10px]">LOSSES</div>
                 <div className="text-[#ff2d55] font-bold">{user.losses}</div>
               </div>
               <div className="text-center">
                 <div className="text-[#64748b] text-[10px]">HITS</div>
                 <div className="text-[#00d4ff] font-bold">{user.successfulCrimes}</div>
               </div>
            </div>
          </AnimatedCard>

        </div>
      </div>
    </div>
  );
}
