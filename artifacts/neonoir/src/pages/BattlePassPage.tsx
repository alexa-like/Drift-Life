import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { User } from "../lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PassReward { dc: number; nc: number; cosmeticId?: string; title?: string; badge?: string; }

interface PassLevel {
  level: number;
  xpRequired: number;
  freeReward: PassReward;
  premiumReward: PassReward;
  isMilestone: boolean;
}

interface BattlePassData {
  _id: string;
  seasonName: string;
  ncCost: number;
  totalLevels: number;
  levels: PassLevel[];
  xpSources: Array<{ action: string; xp: number }>;
  xpMultiplier: number;
  startsAt: string;
  endsAt: string;
  status: string;
}

interface ActivePassResponse {
  pass: BattlePassData | null;
  playerLevel: number;
  playerXp: number;
  isPremium: boolean;
  claimedRewards: string[];
  isDoubleXp: boolean;
}

interface QuestEntry {
  questId: string;
  progress: number;
  completed: boolean;
  claimedAt: string | null;
  assignedAt?: string;
  assignedWeek?: string;
  template: {
    _id: string;
    title: string;
    description: string;
    action: string;
    targetCount: number;
    reward: { dc: number; nc: number; seasonXp: number; eventPoints?: number };
    difficulty: "easy" | "medium" | "hard";
    type: string;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

function rewardLabel(r: PassReward): string {
  const parts: string[] = [];
  if (r.dc > 0)     parts.push(`${formatDC(r.dc)} DC`);
  if (r.nc > 0)     parts.push(`${r.nc} NC`);
  if (r.title)      parts.push(r.title);
  if (r.badge)      parts.push(r.badge);
  if (r.cosmeticId) parts.push("Cosmetic");
  return parts.join(" + ") || "—";
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#39d353", medium: "#f59e0b", hard: "#ff2d55",
};

function questResetLabel(quest: QuestEntry): string {
  if (!quest.assignedAt) return "";
  const assigned = new Date(quest.assignedAt);
  const nextReset = new Date(assigned);
  nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  nextReset.setUTCHours(0, 0, 0, 0);
  const diff = nextReset.getTime() - Date.now();
  if (diff <= 0) return "Resetting...";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `Resets in ${h}h ${m}m`;
}

// ── Level card ─────────────────────────────────────────────────────────────────

interface LevelCardProps {
  lvl: PassLevel;
  playerLevel: number;
  isPremium: boolean;
  claimedRewards: string[];
  isActive: boolean;
  onClaim: (level: number, track: "free" | "premium") => void;
  claiming: string | null;
}

function LevelCard({ lvl, playerLevel, isPremium, claimedRewards, isActive, onClaim, claiming }: LevelCardProps) {
  const reached = playerLevel >= lvl.level;
  const freeClaimed = claimedRewards.includes(`level_${lvl.level}_free`);
  const premClaimed = claimedRewards.includes(`level_${lvl.level}_premium`);
  const isMilestone = lvl.isMilestone;

  const borderColor = isActive ? "#00d4ff" : isMilestone ? "#f59e0b" : "#1e1e2e";
  const bgColor     = isActive ? "#00d4ff12" : isMilestone ? "#f59e0b08" : "#08080c";
  const minW        = isMilestone ? 110 : 88;

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-sm overflow-hidden"
      style={{
        minWidth: minW,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        boxShadow: isActive ? "0 0 18px #00d4ff30" : isMilestone ? "0 0 10px #f59e0b20" : "none",
      }}
    >
      {/* Level number */}
      <div
        className="text-center py-1 font-mono text-xs font-bold"
        style={{
          background: isActive ? "#00d4ff20" : isMilestone ? "#f59e0b18" : "#111118",
          color: isActive ? "#00d4ff" : isMilestone ? "#f59e0b" : "#475569",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {isMilestone ? `★ ${lvl.level}` : lvl.level}
      </div>

      {/* Free track */}
      <div className="p-2 space-y-1 flex-1" style={{ borderBottom: "1px solid #111118" }}>
        <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#475569" }}>Free</div>
        <div className="font-mono text-[10px]" style={{ color: reached ? "#e2e8f0" : "#334155" }}>
          {rewardLabel(lvl.freeReward)}
        </div>
        {reached && !freeClaimed && (
          <button
            onClick={() => onClaim(lvl.level, "free")}
            disabled={!!claiming}
            className="w-full font-mono text-[9px] py-0.5 rounded-sm uppercase"
            style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35330", cursor: claiming ? "not-allowed" : "pointer" }}
          >
            {claiming === `${lvl.level}_free` ? "…" : "Claim"}
          </button>
        )}
        {freeClaimed && <div className="font-mono text-[9px] text-center" style={{ color: "#39d353" }}>✓</div>}
      </div>

      {/* Premium track */}
      <div className="p-2 space-y-1" style={{ background: isPremium ? "#a855f708" : "#05050a" }}>
        <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: isPremium ? "#a855f7" : "#334155" }}>Premium</div>
        <div className="font-mono text-[10px]" style={{ color: isPremium && reached ? "#e2e8f0" : "#334155" }}>
          {isPremium ? rewardLabel(lvl.premiumReward) : "🔒 Premium"}
        </div>
        {isPremium && reached && !premClaimed && (
          <button
            onClick={() => onClaim(lvl.level, "premium")}
            disabled={!!claiming}
            className="w-full font-mono text-[9px] py-0.5 rounded-sm uppercase"
            style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f730", cursor: claiming ? "not-allowed" : "pointer" }}
          >
            {claiming === `${lvl.level}_premium` ? "…" : "Claim"}
          </button>
        )}
        {premClaimed && <div className="font-mono text-[9px] text-center" style={{ color: "#a855f7" }}>✓</div>}
      </div>
    </div>
  );
}

// ── Quest card ─────────────────────────────────────────────────────────────────

function QuestCard({ quest, onClaim, claiming }: { quest: QuestEntry; onClaim: (id: string) => void; claiming: string | null }) {
  const t = quest.template;
  if (!t) return null;
  const pct = t.targetCount > 0 ? Math.min(100, (quest.progress / t.targetCount) * 100) : 0;
  const dColor = DIFFICULTY_COLOR[t.difficulty] ?? "#64748b";

  return (
    <div
      className="p-3 rounded-sm space-y-2"
      style={{
        background: quest.completed ? "#08140a" : "#08080c",
        border: `1px solid ${quest.completed ? "#39d35330" : "#1e1e2e"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: quest.completed ? "#39d353" : "#e2e8f0" }}>
            {quest.completed && "✓ "}{t.title}
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: "#475569" }}>{t.description}</div>
        </div>
        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm flex-shrink-0 uppercase" style={{ background: `${dColor}18`, color: dColor, border: `1px solid ${dColor}30` }}>
          {t.difficulty}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between font-mono text-[10px] mb-1" style={{ color: "#64748b" }}>
          <span>{quest.progress} / {t.targetCount}</span>
          {quest.assignedAt && <span style={{ color: "#334155" }}>{questResetLabel(quest)}</span>}
        </div>
        <div className="h-1.5 bg-[#0a0a0f] rounded-sm overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          <motion.div
            className="h-full"
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            style={{ background: quest.completed ? "#39d353" : "#00d4ff", boxShadow: `0 0 6px ${quest.completed ? "#39d353" : "#00d4ff"}` }}
          />
        </div>
      </div>

      {/* Reward */}
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px]" style={{ color: "#64748b" }}>
          {t.reward.dc > 0    && <span style={{ color: "#f59e0b" }}>+{formatDC(t.reward.dc)} DC </span>}
          {t.reward.nc > 0    && <span style={{ color: "#a855f7" }}>+{t.reward.nc} NC </span>}
          {t.reward.seasonXp > 0 && <span style={{ color: "#00d4ff" }}>+{t.reward.seasonXp} BP XP</span>}
        </div>
        {quest.completed && !quest.claimedAt && (
          <button
            onClick={() => onClaim(quest.questId)}
            disabled={!!claiming}
            className="font-mono text-[10px] px-3 py-1 rounded-sm uppercase font-bold"
            style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340", cursor: claiming ? "not-allowed" : "pointer" }}
          >
            {claiming === quest.questId ? "…" : "Claim"}
          </button>
        )}
        {quest.claimedAt && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm" style={{ color: "#39d353", background: "#39d35310", border: "1px solid #39d35325" }}>Claimed ✓</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type TabId = "pass" | "quests";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
  onNavigate: (page: string) => void;
}

export default function BattlePassPage({ user, addToast, onNavigate }: Props) {
  const [tab, setTab] = useState<TabId>("pass");

  // ── Pass state ──
  const [passData, setPassData] = useState<ActivePassResponse | null>(null);
  const [passLoading, setPassLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  // ── Quest state ──
  const [quests, setQuests] = useState<{ daily: QuestEntry[]; weekly: QuestEntry[] } | null>(null);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [questClaiming, setQuestClaiming] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);

  // ── Fetch pass ──
  useEffect(() => {
    api.get<ActivePassResponse>("/battle-pass/active")
      .then(setPassData)
      .catch(() => setPassData({ pass: null, playerLevel: 0, playerXp: 0, isPremium: false, claimedRewards: [], isDoubleXp: false }))
      .finally(() => setPassLoading(false));
  }, []);

  // ── Fetch quests ──
  useEffect(() => {
    if (tab !== "quests" || quests) return;
    setQuestsLoading(true);
    api.get<{ daily: QuestEntry[]; weekly: QuestEntry[] }>("/quests")
      .then(setQuests)
      .catch(() => setQuests({ daily: [], weekly: [] }))
      .finally(() => setQuestsLoading(false));
  }, [tab, quests]);

  // Scroll to current level on load
  useEffect(() => {
    if (!passData?.pass || !trackRef.current) return;
    const idx = Math.max(0, passData.playerLevel - 2);
    const card = trackRef.current.querySelectorAll("[data-lvl]")[idx] as HTMLElement | undefined;
    if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [passData]);

  // ── Claim reward ──
  async function handleClaim(level: number, track: "free" | "premium") {
    const key = `${level}_${track}`;
    setClaiming(key);
    try {
      const res = await api.post<{ ok: boolean; reward: PassReward }>(`/battle-pass/claim/${level}/${track}`);
      addToast(`Claimed: ${rewardLabel(res.reward)}`, "success");
      setPassData(prev => prev ? ({
        ...prev,
        claimedRewards: [...prev.claimedRewards, `level_${level}_${track}`],
      }) : prev);
    } catch (e: any) {
      addToast(e.message ?? "Claim failed", "error");
    } finally {
      setClaiming(null);
    }
  }

  // ── Buy premium ──
  async function handleBuyPremium() {
    if (!passData?.pass) return;
    setBuying(true);
    try {
      await api.post<{ ok: boolean; ncRemaining: number }>("/battle-pass/buy-premium");
      addToast(`Premium pass unlocked! Cosmetics & titles — no stat advantages.`, "success");
      setPassData(prev => prev ? { ...prev, isPremium: true } : prev);
    } catch (e: any) {
      addToast(e.message ?? "Purchase failed", "error");
    } finally {
      setBuying(false);
    }
  }

  // ── Claim quest ──
  async function handleQuestClaim(questId: string) {
    setQuestClaiming(questId);
    try {
      const res = await api.post<{ ok: boolean; reward: { dc: number; nc: number; seasonXp: number } }>(`/quests/${questId}/claim`);
      const { dc, nc, seasonXp } = res.reward;
      const parts: string[] = [];
      if (dc)       parts.push(`${formatDC(dc)} DC`);
      if (nc)       parts.push(`${nc} NC`);
      if (seasonXp) parts.push(`${seasonXp} BP XP`);
      addToast(`Quest complete! +${parts.join(", ")}`, "success");
      // Refresh quests
      setQuests(null);
      api.get<{ daily: QuestEntry[]; weekly: QuestEntry[] }>("/quests").then(setQuests).catch(() => {});
    } catch (e: any) {
      addToast(e.message ?? "Claim failed", "error");
    } finally {
      setQuestClaiming(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const pass = passData?.pass;

  return (
    <div className="max-w-5xl mx-auto pb-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-display font-black text-2xl uppercase tracking-widest" style={{ color: "#a855f7" }}>
            {pass ? pass.seasonName : "Battle Pass"}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
            {pass
              ? `Season ends ${new Date(pass.endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
              : "No active season — check back when an event is running"}
          </div>
        </div>
        {pass && passData && (
          <div className="flex flex-col items-end gap-2">
            {/* 2x XP badge */}
            {passData.isDoubleXp && (
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm animate-pulse uppercase"
                style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                ⚡ 2× XP ACTIVE
              </span>
            )}
            {/* Premium CTA */}
            {!passData.isPremium && (
              <div className="text-right space-y-1">
                <div className="font-mono text-[10px]" style={{ color: "#64748b" }}>
                  Cosmetics &amp; titles only — zero gameplay advantages
                </div>
                <button
                  onClick={handleBuyPremium}
                  disabled={buying}
                  className="font-mono text-xs font-bold px-4 py-1.5 rounded-sm uppercase tracking-widest"
                  style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f750", cursor: buying ? "not-allowed" : "pointer" }}
                >
                  {buying ? "Processing…" : `Upgrade to Premium — ${pass.ncCost} NC`}
                </button>
              </div>
            )}
            {passData.isPremium && (
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-sm" style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f750" }}>
                ★ PREMIUM PASS
              </span>
            )}
          </div>
        )}
      </div>

      {/* XP progress bar (when pass is active) */}
      {pass && passData && (
        <div className="p-3 rounded-sm" style={{ background: "#08080c", border: "1px solid #1e1e2e" }}>
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="font-display font-black text-xl" style={{ color: "#00d4ff" }}>Lv {passData.playerLevel}</div>
              <div className="font-mono text-xs" style={{ color: "#475569" }}>{passData.playerXp.toLocaleString()} season XP</div>
            </div>
            {passData.playerLevel < pass.totalLevels && (() => {
              const nextLvl = pass.levels.find(l => l.level === passData.playerLevel + 1);
              if (!nextLvl) return null;
              const pct = nextLvl.xpRequired > 0 ? Math.min(100, (passData.playerXp / nextLvl.xpRequired) * 100) : 0;
              return (
                <div className="font-mono text-[10px]" style={{ color: "#64748b" }}>
                  {passData.playerXp.toLocaleString()} / {nextLvl.xpRequired.toLocaleString()} XP to next level ({pct.toFixed(1)}%)
                </div>
              );
            })()}
            {passData.playerLevel >= pass.totalLevels && (
              <span className="font-mono text-xs font-bold" style={{ color: "#f59e0b" }}>MAX LEVEL ★</span>
            )}
          </div>
          {passData.playerLevel < pass.totalLevels && (() => {
            const nextLvl = pass.levels.find(l => l.level === passData.playerLevel + 1);
            if (!nextLvl) return null;
            const pct = nextLvl.xpRequired > 0 ? Math.min(100, (passData.playerXp / nextLvl.xpRequired) * 100) : 0;
            return (
              <div className="h-2 bg-[#0a0a0f] rounded-sm overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
                <motion.div
                  className="h-full"
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  style={{ background: "linear-gradient(90deg, #a855f7, #00d4ff)", boxShadow: "0 0 8px #a855f760" }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "#1e1e2e" }}>
        {(["pass", "quests"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-3 font-display font-bold text-sm tracking-widest uppercase relative"
            style={{ color: tab === t ? "#a855f7" : "#475569" }}
          >
            {t === "pass" ? "Battle Pass" : "Daily & Weekly Quests"}
            {tab === t && (
              <motion.div layoutId="bpTab" className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: "#a855f7", boxShadow: "0 0 8px #a855f7" }} />
            )}
          </button>
        ))}
      </div>

      {/* ── PASS TAB ─────────────────────────────────────────────────────────── */}
      {tab === "pass" && (
        <div>
          {passLoading ? (
            <div className="h-40 rounded-sm animate-pulse" style={{ background: "#111118" }} />
          ) : !pass ? (
            <div className="py-16 text-center space-y-4">
              <div className="text-5xl">🌟</div>
              <div className="font-display font-black text-xl uppercase tracking-widest" style={{ color: "#a855f7" }}>
                No Active Season
              </div>
              <div className="font-mono text-sm" style={{ color: "#475569" }}>
                A battle pass only runs during events. <br />
                Check back when the next event launches.
              </div>
              <button onClick={() => onNavigate("events-upcoming")}
                className="font-mono text-xs px-5 py-2 clip-btn uppercase"
                style={{ color: "#00d4ff", border: "1px solid #00d4ff40", background: "#00d4ff10" }}>
                View Upcoming Events
              </button>
            </div>
          ) : (
            <div>
              {/* Track legend */}
              <div className="flex gap-4 mb-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "#94a3b8" }}>
                  <div className="w-2 h-2 rounded-sm" style={{ background: "#39d353" }} /> Free track
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "#94a3b8" }}>
                  <div className="w-2 h-2 rounded-sm" style={{ background: "#a855f7" }} /> Premium track
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "#94a3b8" }}>
                  <div className="w-2 h-2 rounded-sm" style={{ background: "#f59e0b" }} /> ★ Milestone
                </div>
              </div>

              {/* Horizontal scrollable track */}
              <div
                ref={trackRef}
                className="flex gap-2 overflow-x-auto pb-3"
                style={{ scrollbarColor: "#1e1e2e #08080c" }}
              >
                {pass.levels.map(lvl => (
                  <div key={lvl.level} data-lvl={lvl.level}>
                    <LevelCard
                      lvl={lvl}
                      playerLevel={passData!.playerLevel}
                      isPremium={passData!.isPremium}
                      claimedRewards={passData!.claimedRewards}
                      isActive={passData!.playerLevel === lvl.level}
                      onClaim={handleClaim}
                      claiming={claiming}
                    />
                  </div>
                ))}
                {pass.levels.length === 0 && (
                  <div className="font-mono text-xs py-8 text-center flex-1" style={{ color: "#334155" }}>
                    No levels configured yet — owner must set up the pass.
                  </div>
                )}
              </div>

              {/* XP Sources reference */}
              <div className="mt-4 p-3 rounded-sm" style={{ background: "#08080c", border: "1px solid #1e1e2e" }}>
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#475569" }}>
                  XP Sources {passData?.isDoubleXp && <span style={{ color: "#f59e0b" }}>— 2× XP active!</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {pass.xpSources.map(src => {
                    const xp = Math.round(src.xp * (pass.xpMultiplier ?? 1));
                    return (
                      <div key={src.action} className="flex justify-between font-mono text-[10px] px-2 py-1 rounded-sm"
                        style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                        <span style={{ color: "#64748b" }}>{src.action.replace(/_/g, " ")}</span>
                        <span style={{ color: "#00d4ff" }}>+{xp} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QUESTS TAB ─────────────────────────────────────────────────────────── */}
      {tab === "quests" && (
        <div className="space-y-6">
          {questsLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-sm animate-pulse" style={{ background: "#111118" }} />)}
            </div>
          )}

          {!questsLoading && quests && (
            <>
              {/* Daily */}
              <div>
                <div className="font-display font-bold text-base uppercase tracking-widest mb-3" style={{ color: "#00d4ff" }}>
                  Daily Quests
                </div>
                {quests.daily.length === 0 ? (
                  <div className="font-mono text-xs py-4 text-center" style={{ color: "#334155" }}>No daily quests assigned.</div>
                ) : (
                  <div className="space-y-3">
                    {quests.daily.map(q => (
                      <QuestCard key={q.questId} quest={q} onClaim={handleQuestClaim} claiming={questClaiming} />
                    ))}
                  </div>
                )}
              </div>

              {/* Weekly */}
              <div>
                <div className="font-display font-bold text-base uppercase tracking-widest mb-3" style={{ color: "#a855f7" }}>
                  Weekly Quests
                </div>
                {quests.weekly.length === 0 ? (
                  <div className="font-mono text-xs py-4 text-center" style={{ color: "#334155" }}>No weekly quests assigned.</div>
                ) : (
                  <div className="space-y-3">
                    {quests.weekly.map(q => (
                      <QuestCard key={q.questId} quest={q} onClaim={handleQuestClaim} claiming={questClaiming} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
