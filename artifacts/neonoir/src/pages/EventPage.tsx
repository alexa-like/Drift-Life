import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../shared/api";
import { useSocket } from "../shared/context/SocketContext";
import { User } from "../shared/types";
import { useSwipe } from "../shared/hooks/useSwipe";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EventTheme {
  gameDisplayName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  bannerImageUrl: string;
  chatBadgeText: string;
  chatBadgeColor: string;
}

interface BossPhase {
  name: string;
  triggerAtHpPercent: number;
  description: string;
  abilityEffect?: string;
}

interface ActiveEventData {
  id: string;
  name: string;
  slug: string;
  type: "boss_raid" | "leaderboard_grind" | "collection_hunt" | "milestone" | "sports" | "lottery";
  description: string;
  status: string;
  startsAt: string;
  endsAt: string;
  theme: EventTheme;
  pointSources: Array<{ action: string; points: number }>;
  boss: {
    name: string;
    imageUrl: string;
    totalHp: number;
    currentHp: number;
    phases: BossPhase[];
    strikeEnergyCost: number;
    strikeCooldownSeconds: number;
  } | null;
  collectible: {
    name: string;
    dropSources: string[];
    dropChance: number;
    setSize: number;
  } | null;
  milestones: Array<{ label: string; target: number; action: string }>;
  teams?: Array<{ id: string; name: string; color: string }>;
  lottery?: { ticketSource: string; ticketsPerAction: number; winnersCount: number };
  leaderboardRewards: Array<{
    rankFrom: number;
    rankTo: number;
    reward: { dc: number; nc: number; titles: string[] };
  }>;
}

interface PlayerProgress {
  points: number;
  bossDamageDealt: number;
  collectiblesFound: number;
  ticketsEarned: number;
  oneTimeRewardsClaimed: string[];
  lastStrikeAt: string | null;
}

interface ActiveEventResponse {
  event: ActiveEventData;
  playerProgress: PlayerProgress | null;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  points: number;
  bossDamageDealt: number;
  collectiblesFound: number;
  teamId?: string;
}

interface LeaderboardResponse {
  eventId: string;
  eventName: string;
  top: LeaderboardEntry[];
  myRank: number | null;
  myPoints: number;
}

interface DamageNumber {
  id: number;
  damage: number;
  x: number; // 20–70 %
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  boss_raid:         "BOSS RAID",
  leaderboard_grind: "LEADERBOARD GRIND",
  collection_hunt:   "COLLECTION HUNT",
  milestone:         "CITY MILESTONE",
  sports:            "SPORTS EVENT",
  lottery:           "LOTTERY",
};

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "ENDED";
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d}d ${h % 24}h remaining`;
  if (h >= 1) return `${h}h ${m % 60}m remaining`;
  return `${m}m ${s % 60}s remaining`;
}

function getRewardForRank(rewards: ActiveEventData["leaderboardRewards"], rank: number | null) {
  if (!rank) return null;
  return rewards.find(r => rank >= r.rankFrom && rank <= r.rankTo) ?? null;
}

// ── Cooldown hook ──────────────────────────────────────────────────────────────

function useCooldownSeconds(lastStrikeAt: string | null, cooldownSeconds: number): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!lastStrikeAt) { setRemaining(0); return; }
    function calc() {
      const elapsed = (Date.now() - new Date(lastStrikeAt!).getTime()) / 1000;
      const rem = Math.max(0, cooldownSeconds - elapsed);
      setRemaining(Math.ceil(rem));
    }
    calc();
    if (remaining <= 0) return;
    const iv = setInterval(calc, 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastStrikeAt, cooldownSeconds]);
  return remaining;
}

// ── Countdown display ──────────────────────────────────────────────────────────

function LiveCountdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState(() => formatCountdown(endsAt));
  useEffect(() => {
    const iv = setInterval(() => setLabel(formatCountdown(endsAt)), 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span>{label}</span>;
}

// ── Boss HP bar with animated fill ────────────────────────────────────────────

function BossHpBar({ currentHp, totalHp, primary }: { currentHp: number; totalHp: number; primary: string }) {
  const pct = totalHp > 0 ? Math.max(0, Math.min(100, (currentHp / totalHp) * 100)) : 0;
  const color = pct > 50 ? "#ff2d55" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-full" style={{ height: 28, background: "#0a0a0f", border: `1px solid ${primary}30`, borderRadius: 2, overflow: "hidden" }}>
      <motion.div
        className="absolute inset-y-0 left-0"
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 20px ${color}60` }}
      />
      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold" style={{ color: "#e2e8f0", textShadow: "0 1px 4px #000" }}>
        {currentHp.toLocaleString()} / {totalHp.toLocaleString()} HP
        <span className="ml-2" style={{ color: "#94a3b8" }}>({pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

// ── Boss Panel ─────────────────────────────────────────────────────────────────

interface BossPanelProps {
  event: ActiveEventData;
  progress: PlayerProgress | null;
  bossHp: number;
  primary: string;
  accent: string;
  onStrike: () => void;
  striking: boolean;
  damageNumbers: DamageNumber[];
  phaseAlert: string | null;
  bossKilled: boolean;
  lastStrikeAt: string | null;
}

function BossPanel({ event, progress, bossHp, primary, accent, onStrike, striking, damageNumbers, phaseAlert, bossKilled, lastStrikeAt }: BossPanelProps) {
  const boss = event.boss!;
  const cooldownSecs = useCooldownSeconds(lastStrikeAt, boss.strikeCooldownSeconds);
  const onCooldown = cooldownSecs > 0;
  const currentPhase = boss.phases
    .slice()
    .sort((a, b) => b.triggerAtHpPercent - a.triggerAtHpPercent)
    .find(p => (bossHp / boss.totalHp) * 100 <= p.triggerAtHpPercent);

  return (
    <div className="space-y-4">
      {/* Boss name + image */}
      <div className="flex items-center gap-4">
        {boss.imageUrl && (
          <img
            src={boss.imageUrl}
            alt={boss.name}
            className="rounded-sm object-cover flex-shrink-0"
            style={{ width: 64, height: 64, border: `2px solid ${primary}40`, boxShadow: `0 0 20px ${primary}30` }}
          />
        )}
        <div>
          <div className="font-display font-black text-xl uppercase tracking-widest" style={{ color: primary, textShadow: `0 0 20px ${primary}` }}>
            {bossKilled ? "☠ DEFEATED" : boss.name}
          </div>
          {currentPhase && !bossKilled && (
            <div className="font-mono text-xs mt-0.5" style={{ color: accent }}>
              ⚡ Phase: {currentPhase.name} — {currentPhase.description}
            </div>
          )}
        </div>
      </div>

      {/* HP bar + floating damage numbers */}
      <div className="relative">
        <BossHpBar currentHp={bossHp} totalHp={boss.totalHp} primary={primary} />
        {/* Floating damage numbers */}
        <AnimatePresence>
          {damageNumbers.map(d => (
            <motion.div
              key={d.id}
              className="absolute font-mono font-black pointer-events-none select-none"
              style={{ left: `${d.x}%`, top: 0, fontSize: 20, color: "#ff2d55", textShadow: "0 0 15px #ff2d55", zIndex: 10 }}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -56 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            >
              -{d.damage.toLocaleString()}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Phase alert overlay */}
      <AnimatePresence>
        {phaseAlert && (
          <motion.div
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0" style={{ background: `${accent}15` }} />
            <motion.div
              className="relative font-display font-black text-3xl uppercase text-center px-8 py-4"
              style={{ color: accent, textShadow: `0 0 40px ${accent}`, border: `2px solid ${accent}60`, background: "#0a0a0f", borderRadius: 4 }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              ⚡ PHASE SHIFT
              <div className="font-mono text-base mt-1" style={{ color: "#e2e8f0" }}>{phaseAlert}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Boss killed celebration */}
      <AnimatePresence>
        {bossKilled && (
          <motion.div
            className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} />
            <motion.div
              className="relative text-center px-12 py-8"
              style={{ border: `2px solid ${primary}`, background: "#0a0a0f", borderRadius: 4, boxShadow: `0 0 60px ${primary}` }}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            >
              <div className="text-5xl mb-3">💀</div>
              <div className="font-display font-black text-3xl uppercase tracking-widest" style={{ color: primary, textShadow: `0 0 30px ${primary}` }}>
                BOSS DEFEATED
              </div>
              <div className="font-mono text-sm mt-2" style={{ color: "#94a3b8" }}>Rewards are being distributed to all participants</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strike button */}
      {!bossKilled && (
        <div className="flex flex-col items-center gap-2">
          <motion.button
            onClick={onStrike}
            disabled={onCooldown || striking}
            className="relative font-display font-black text-xl uppercase tracking-widest px-12 py-5 clip-btn transition-colors"
            whileTap={!onCooldown && !striking ? { scale: 0.93 } : undefined}
            whileHover={!onCooldown && !striking ? { scale: 1.03 } : undefined}
            style={{
              background: onCooldown || striking
                ? "#111118"
                : `linear-gradient(135deg, ${primary}30, ${accent}20)`,
              border: `2px solid ${onCooldown || striking ? "#1e1e2e" : primary}`,
              color: onCooldown || striking ? "#475569" : primary,
              boxShadow: onCooldown || striking ? "none" : `0 0 30px ${primary}40`,
              cursor: onCooldown || striking ? "not-allowed" : "pointer",
              minWidth: 280,
            }}
          >
            {striking ? "STRIKING…" : onCooldown ? `COOLDOWN — ${cooldownSecs}s` : `⚡ STRIKE BOSS — ${boss.strikeEnergyCost} ENG`}
          </motion.button>
          {progress && (
            <div className="font-mono text-xs" style={{ color: "#475569" }}>
              Your total damage: <span style={{ color: primary }}>{(progress.bossDamageDealt ?? 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Collection Hunt panel ──────────────────────────────────────────────────────

function CollectionPanel({ event, progress, primary, accent }: { event: ActiveEventData; progress: PlayerProgress | null; primary: string; accent: string }) {
  const collectible = event.collectible!;
  const found = progress?.collectiblesFound ?? 0;
  const pct = collectible.setSize > 0 ? Math.min(100, (found / collectible.setSize) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="font-display font-bold text-lg uppercase" style={{ color: primary }}>{collectible.name}</div>
      <div className="font-mono text-xs" style={{ color: "#64748b" }}>
        Drop chance per action: <span style={{ color: accent }}>{(collectible.dropChance * 100).toFixed(1)}%</span>
        {" · "}Set size: <span style={{ color: accent }}>{collectible.setSize}</span>
      </div>
      <div>
        <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#94a3b8" }}>
          <span>Your collection</span>
          <span style={{ color: primary }}>{found} / {collectible.setSize}</span>
        </div>
        <div className="relative h-5 bg-[#0a0a0f] rounded-sm overflow-hidden" style={{ border: `1px solid ${primary}30` }}>
          <motion.div
            className="absolute inset-y-0 left-0"
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            style={{ background: `linear-gradient(90deg, ${primary}60, ${accent})`, boxShadow: `0 0 10px ${primary}` }}
          />
        </div>
      </div>
      {found >= collectible.setSize && (
        <div className="font-mono text-sm font-bold text-center py-2" style={{ color: accent, border: `1px solid ${accent}40`, background: `${accent}10` }}>
          🏆 SET COMPLETE — Reward pending event end
        </div>
      )}
    </div>
  );
}

// ── Milestone panel ────────────────────────────────────────────────────────────

function MilestonePanel({ event, progress, primary, accent }: { event: ActiveEventData; progress: PlayerProgress | null; primary: string; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="font-display font-bold text-lg uppercase" style={{ color: primary }}>City Milestones</div>
      {event.milestones.map((m, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between font-mono text-xs" style={{ color: "#94a3b8" }}>
            <span>{m.label}</span>
            <span style={{ color: accent }}>Target: {m.target.toLocaleString()}</span>
          </div>
          <div className="h-4 bg-[#0a0a0f] rounded-sm overflow-hidden" style={{ border: `1px solid ${primary}30` }}>
            <div className="h-full animate-pulse" style={{ width: "30%", background: `linear-gradient(90deg, ${primary}60, ${accent})` }} />
          </div>
          <div className="font-mono text-[10px]" style={{ color: "#475569" }}>Action: {m.action}</div>
        </div>
      ))}
      <div className="font-mono text-xs" style={{ color: "#475569" }}>
        Your contribution: <span style={{ color: primary }}>{(progress?.points ?? 0).toLocaleString()} pts</span>
      </div>
    </div>
  );
}

// ── Sports panel ───────────────────────────────────────────────────────────────

function SportsPanel({ event, progress, primary, accent }: { event: ActiveEventData; progress: PlayerProgress | null; primary: string; accent: string }) {
  return (
    <div className="space-y-4">
      <div className="font-display font-bold text-lg uppercase" style={{ color: primary }}>Team Standings</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(event.teams ?? []).map(team => (
          <div
            key={team.id}
            className="p-3 rounded-sm flex items-center gap-3"
            style={{ background: `${team.color}10`, border: `1px solid ${team.color}40` }}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: team.color, boxShadow: `0 0 8px ${team.color}` }} />
            <span className="font-mono text-sm font-bold" style={{ color: team.color }}>{team.name}</span>
          </div>
        ))}
      </div>
      <div className="font-mono text-xs" style={{ color: "#475569" }}>
        Your points: <span style={{ color: accent }}>{(progress?.points ?? 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Lottery panel ──────────────────────────────────────────────────────────────

function LotteryPanel({ event, progress, primary, accent }: { event: ActiveEventData; progress: PlayerProgress | null; primary: string; accent: string }) {
  const tickets = progress?.ticketsEarned ?? 0;
  return (
    <div className="space-y-4">
      <div className="font-display font-bold text-lg uppercase" style={{ color: primary }}>Lottery</div>
      <div className="p-4 text-center rounded-sm" style={{ background: `${primary}08`, border: `1px solid ${primary}30` }}>
        <div className="font-display font-black text-4xl" style={{ color: primary, textShadow: `0 0 20px ${primary}` }}>{tickets.toLocaleString()}</div>
        <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>YOUR TICKETS</div>
      </div>
      {event.lottery && (
        <div className="font-mono text-xs space-y-1" style={{ color: "#64748b" }}>
          <div>Winners: <span style={{ color: accent }}>{event.lottery.winnersCount}</span></div>
          <div>Earn tickets by: <span style={{ color: accent }}>{event.lottery.ticketSource}</span></div>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard grind panel ────────────────────────────────────────────────────

function GrindPanel({ event, progress, primary, accent }: { event: ActiveEventData; progress: PlayerProgress | null; primary: string; accent: string }) {
  return (
    <div className="space-y-3">
      <div className="font-display font-bold text-lg uppercase" style={{ color: primary }}>Points Race</div>
      <div className="p-4 text-center rounded-sm" style={{ background: `${primary}08`, border: `1px solid ${primary}30` }}>
        <div className="font-display font-black text-4xl" style={{ color: primary, textShadow: `0 0 20px ${primary}` }}>{(progress?.points ?? 0).toLocaleString()}</div>
        <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>YOUR POINTS</div>
      </div>
      <div className="font-mono text-xs" style={{ color: "#64748b" }}>
        Point sources: {event.pointSources.map(p => `${p.action} (+${p.points})`).join(" · ")}
      </div>
    </div>
  );
}

// ── Leaderboard section ────────────────────────────────────────────────────────

function EventLeaderboard({ data, primary, accent }: { data: LeaderboardResponse | null; primary: string; accent: string }) {
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  if (!data) return <div className="font-mono text-xs text-center py-4 animate-pulse" style={{ color: "#334155" }}>Loading leaderboard…</div>;

  const entries = data.top.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(data.top.length / PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-display font-bold text-sm uppercase tracking-widest" style={{ color: primary }}>Leaderboard</div>
        {data.myRank && (
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>
            Your rank: <span style={{ color: accent, fontWeight: "bold" }}>#{data.myRank}</span>
            {" · "}<span style={{ color: primary }}>{data.myPoints.toLocaleString()} pts</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        {entries.map(entry => {
          const isMe = entry.rank === data.myRank;
          return (
            <div
              key={entry.rank}
              className="flex items-center gap-3 px-3 py-2 rounded-sm"
              style={{
                background: isMe ? `${accent}18` : entry.rank <= 3 ? `${primary}08` : "#08080c",
                border: isMe ? `1px solid ${accent}50` : entry.rank <= 3 ? `1px solid ${primary}20` : "1px solid #111118",
              }}
            >
              <span
                className="font-mono font-bold text-sm flex-shrink-0"
                style={{ color: entry.rank === 1 ? "#f59e0b" : entry.rank === 2 ? "#94a3b8" : entry.rank === 3 ? "#cd7f32" : "#475569", minWidth: 28 }}
              >
                #{entry.rank}
              </span>
              <span className="font-mono text-sm flex-1 truncate" style={{ color: isMe ? accent : "#e2e8f0" }}>
                {entry.username}{isMe && " (you)"}
              </span>
              <span className="font-mono text-xs font-bold" style={{ color: primary }}>{entry.points.toLocaleString()} pts</span>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center pt-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className="font-mono text-xs px-2 py-1 rounded-sm"
              style={{ background: page === i ? `${primary}20` : "#111118", color: page === i ? primary : "#475569", border: `1px solid ${page === i ? primary + "40" : "#1e1e2e"}` }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reward preview ─────────────────────────────────────────────────────────────

function RewardPreview({ event, myRank, primary, accent }: { event: ActiveEventData; myRank: number | null; primary: string; accent: string }) {
  const reward = getRewardForRank(event.leaderboardRewards, myRank);
  return (
    <div className="p-4 rounded-sm" style={{ background: "#08080c", border: `1px solid ${primary}20` }}>
      <div className="font-mono text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: primary }}>
        {myRank ? `Your Reward at Rank #${myRank}` : "Top Rewards"}
      </div>
      {reward ? (
        <div className="space-y-1 font-mono text-xs">
          {reward.reward.dc > 0 && <div style={{ color: "#f59e0b" }}>+{reward.reward.dc.toLocaleString()} DC</div>}
          {reward.reward.nc > 0 && <div style={{ color: "#a855f7" }}>+{reward.reward.nc.toLocaleString()} NC</div>}
          {reward.reward.titles?.map(t => <div key={t} style={{ color: accent }}>Title: {t}</div>)}
        </div>
      ) : (
        <div className="space-y-1 font-mono text-xs">
          {event.leaderboardRewards.slice(0, 3).map(r => (
            <div key={r.rankFrom} style={{ color: "#64748b" }}>
              <span style={{ color: primary }}>Rank {r.rankFrom}–{r.rankTo}:</span>
              {r.reward.dc > 0 && ` ${r.reward.dc.toLocaleString()} DC`}
              {r.reward.nc > 0 && ` ${r.reward.nc.toLocaleString()} NC`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigate: (page: string) => void;
}

export default function EventPage({ user, addToast, onNavigate }: Props) {
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<ActiveEventResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [bossHp, setBossHp] = useState(0);
  const [striking, setStriking] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [phaseAlert, setPhaseAlert] = useState<string | null>(null);
  const [bossKilled, setBossKilled] = useState(false);
  const [lastStrikeAt, setLastStrikeAt] = useState<string | null>(null);
  // 13.4 — Tab state for swipe navigation between event panel and leaderboard
  const [panelTab, setPanelTab] = useState<"event" | "leaderboard">("event");
  const swipeHandlers = useSwipe(
    () => setPanelTab("leaderboard"),
    () => setPanelTab("event"),
  );

  const damageIdRef = useRef(0);
  const phaseAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch active event ──────────────────────────────────────────────────────
  const fetchEvent = useCallback(async () => {
    try {
      const data = await api.get<ActiveEventResponse | null>("/events/active");
      setEventData(data);
      if (data?.event?.boss) {
        setBossHp(data.event.boss.currentHp);
        if (data.event.boss.currentHp <= 0) setBossKilled(true);
      }
      if (data?.playerProgress?.lastStrikeAt) {
        setLastStrikeAt(data.playerProgress.lastStrikeAt);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch leaderboard ───────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.get<LeaderboardResponse>("/events/leaderboard");
      setLeaderboard(data);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchEvent();
    fetchLeaderboard();
    const iv = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(iv);
  }, [fetchEvent, fetchLeaderboard]);

  // ── WebSocket: boss HP updates ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    function onBossHpUpdate(payload: { eventId: string; currentHp: number; totalHp: number; bossKilled: boolean; phaseChange: string | null }) {
      setBossHp(Math.max(0, payload.currentHp));
      if (payload.bossKilled) setBossKilled(true);
      if (payload.phaseChange) {
        setPhaseAlert(payload.phaseChange);
        if (phaseAlertTimerRef.current) clearTimeout(phaseAlertTimerRef.current);
        phaseAlertTimerRef.current = setTimeout(() => setPhaseAlert(null), 3500);
      }
    }
    socket.on("boss_hp_update", onBossHpUpdate);
    return () => { socket.off("boss_hp_update", onBossHpUpdate); };
  }, [socket]);

  // ── Strike boss ─────────────────────────────────────────────────────────────
  async function handleStrike() {
    if (striking) return;
    setStriking(true);
    try {
      const res = await api.post<{
        damage: number;
        bossHpRemaining: number;
        bossKilled: boolean;
        phaseChange: string | null;
        retaliationHpLoss: number;
        pointsEarned: number;
        flashMultiplier: string | null;
      }>("/events/strike-boss");

      setBossHp(Math.max(0, res.bossHpRemaining));
      if (res.bossKilled) setBossKilled(true);

      const now = new Date().toISOString();
      setLastStrikeAt(now);

      // Floating damage number
      const id = damageIdRef.current++;
      const x = 20 + Math.floor(Math.random() * 50);
      setDamageNumbers(prev => [...prev, { id, damage: res.damage, x }]);
      setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1300);

      // Toasts
      let msg = `Hit for ${res.damage.toLocaleString()} damage`;
      if (res.flashMultiplier) msg += ` (${res.flashMultiplier} flash!)`;
      if (res.retaliationHpLoss > 0) msg += ` · Boss retaliated for ${res.retaliationHpLoss} HP`;
      addToast(msg, res.bossKilled ? "success" : "info");

      if (res.phaseChange) {
        setPhaseAlert(res.phaseChange);
        if (phaseAlertTimerRef.current) clearTimeout(phaseAlertTimerRef.current);
        phaseAlertTimerRef.current = setTimeout(() => setPhaseAlert(null), 3500);
      }

      // Refresh leaderboard
      fetchLeaderboard();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Strike failed";
      addToast(msg, "error");
    } finally {
      setStriking(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-sm animate-pulse" style={{ background: "#111118" }} />
        ))}
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="text-5xl">🌃</div>
        <div className="font-display font-black text-2xl uppercase tracking-widest" style={{ color: "#00d4ff" }}>
          No Active Event
        </div>
        <div className="font-mono text-sm" style={{ color: "#475569" }}>
          The city is quiet for now. Check back soon.
        </div>
        <button
          onClick={() => onNavigate("events-upcoming")}
          className="font-mono text-xs px-6 py-2 clip-btn uppercase tracking-widest"
          style={{ color: "#00d4ff", border: "1px solid #00d4ff40", background: "#00d4ff10" }}
        >
          View Upcoming Events ›
        </button>
      </div>
    );
  }

  const { event, playerProgress } = eventData;
  const primary = event.theme.primaryColor || "#00d4ff";
  const accent = event.theme.accentColor || "#ff2d55";

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8" {...swipeHandlers}>

      {/* ── Event banner ──────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-sm"
        style={{
          background: `linear-gradient(135deg, ${event.theme.backgroundColor || "#08080c"}ee, ${primary}20, ${accent}0a)`,
          border: `1px solid ${primary}40`,
          minHeight: 100,
        }}
      >
        {event.theme.bannerImageUrl && (
          <div
            className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: `url(${event.theme.bannerImageUrl})` }}
          />
        )}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, transparent, ${primary}, transparent)` }} />
        <div className="relative px-5 py-4 space-y-1">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10px] tracking-widest uppercase" style={{ color: primary + "99" }}>
                {EVENT_TYPE_LABELS[event.type] || event.type}
              </div>
              <div className="font-display font-black text-2xl uppercase tracking-wider" style={{ color: accent, textShadow: `0 0 20px ${accent}50` }}>
                {event.name}
              </div>
              {event.description && (
                <div className="font-mono text-xs mt-1 max-w-xl" style={{ color: "#64748b" }}>{event.description}</div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#475569" }}>Ends in</div>
              <div className="font-mono text-sm font-bold" style={{ color: primary }}>
                <LiveCountdown endsAt={event.endsAt} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Your stats bar ─────────────────────────────────────────────────── */}
      {playerProgress && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Your Points", value: playerProgress.points.toLocaleString(), color: primary },
            { label: "Boss Damage", value: (playerProgress.bossDamageDealt ?? 0).toLocaleString(), color: "#ff2d55", show: event.type === "boss_raid" },
            { label: "Collectibles", value: `${playerProgress.collectiblesFound ?? 0} / ${event.collectible?.setSize ?? 0}`, color: accent, show: event.type === "collection_hunt" },
            { label: "Tickets", value: (playerProgress.ticketsEarned ?? 0).toLocaleString(), color: "#a855f7", show: event.type === "lottery" },
          ]
            .filter(s => s.show !== false)
            .map(stat => (
              <div key={stat.label} className="p-3 rounded-sm text-center" style={{ background: "#08080c", border: `1px solid ${stat.color}20` }}>
                <div className="font-display font-bold text-lg" style={{ color: stat.color }}>{stat.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>{stat.label}</div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── 13.4 Tab switcher (swipe L/R on mobile to switch) ───────────────── */}
      <div className="flex gap-1" style={{ borderBottom: `1px solid ${primary}30` }}>
        {(["event", "leaderboard"] as const).map(t => (
          <button
            key={t}
            onClick={() => setPanelTab(t)}
            className="font-mono uppercase text-xs tracking-widest px-4 py-2 transition-colors"
            style={{
              color: panelTab === t ? primary : "#475569",
              borderBottom: `2px solid ${panelTab === t ? primary : "transparent"}`,
              background: "transparent",
              fontWeight: panelTab === t ? "bold" : "normal",
            }}
          >
            {t === "event" ? "Event" : "Leaderboard"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9px] self-center" style={{ color: "#1e1e2e" }}>
          swipe ←→
        </span>
      </div>

      {/* ── Type-specific main panel ────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {panelTab === "event" && (
          <motion.div
            key="event-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.12 } }}
            className="space-y-5"
          >
            <div className="p-4 rounded-sm" style={{ background: "#0a0a0f", border: `1px solid ${primary}20` }}>
              {event.type === "boss_raid" && event.boss && (
                <BossPanel
                  event={event}
                  progress={playerProgress}
                  bossHp={bossHp}
                  primary={primary}
                  accent={accent}
                  onStrike={handleStrike}
                  striking={striking}
                  damageNumbers={damageNumbers}
                  phaseAlert={phaseAlert}
                  bossKilled={bossKilled}
                  lastStrikeAt={lastStrikeAt}
                />
              )}
              {event.type === "collection_hunt" && event.collectible && (
                <CollectionPanel event={event} progress={playerProgress} primary={primary} accent={accent} />
              )}
              {event.type === "milestone" && (
                <MilestonePanel event={event} progress={playerProgress} primary={primary} accent={accent} />
              )}
              {event.type === "sports" && (
                <SportsPanel event={event} progress={playerProgress} primary={primary} accent={accent} />
              )}
              {event.type === "lottery" && (
                <LotteryPanel event={event} progress={playerProgress} primary={primary} accent={accent} />
              )}
              {event.type === "leaderboard_grind" && (
                <GrindPanel event={event} progress={playerProgress} primary={primary} accent={accent} />
              )}
            </div>
            {/* ── Reward at your current rank ─────────────────────────────────── */}
            <RewardPreview event={event} myRank={leaderboard?.myRank ?? null} primary={primary} accent={accent} />
          </motion.div>
        )}

        {panelTab === "leaderboard" && (
          <motion.div
            key="leaderboard-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, x: 20, transition: { duration: 0.12 } }}
          >
            {/* ── Event leaderboard ──────────────────────────────────────────── */}
            <div className="p-4 rounded-sm" style={{ background: "#08080c", border: `1px solid ${primary}20` }}>
              <EventLeaderboard data={leaderboard} primary={primary} accent={accent} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav links ───────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => onNavigate("events-upcoming")}
          className="font-mono text-xs px-4 py-2 clip-btn uppercase tracking-widest"
          style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
        >
          Upcoming Events
        </button>
        <button
          onClick={() => onNavigate("events-archive")}
          className="font-mono text-xs px-4 py-2 clip-btn uppercase tracking-widest"
          style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
        >
          Past Events Archive
        </button>
      </div>
    </div>
  );
}
