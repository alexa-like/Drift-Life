import { useState, useEffect } from "react";
import { User } from "../shared/types";
import { api } from "../shared/api";
import { formatDC } from "../shared/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNav: (page: string) => void;
}

// Daily rewards per day in cycle (1-7) — matches server STREAK_REWARDS
const DAILY_REWARDS = [
  { day: 1, dc: 100,  xp: 20,  bonus: null,               label: "Day 1" },
  { day: 2, dc: 150,  xp: 30,  bonus: null,               label: "Day 2" },
  { day: 3, dc: 200,  xp: 40,  bonus: null,               label: "Day 3" },
  { day: 4, dc: 250,  xp: 50,  bonus: null,               label: "Day 4" },
  { day: 5, dc: 300,  xp: 60,  bonus: null,               label: "Day 5" },
  { day: 6, dc: 400,  xp: 80,  bonus: null,               label: "Day 6" },
  { day: 7, dc: 500,  xp: 100, bonus: "Common Item Drop",  label: "Day 7 ★", special: true },
  { day: 14, dc: 1000, xp: 200, bonus: "Uncommon Item Drop", label: "Day 14 ★★", special: true },
  { day: 21, dc: 1500, xp: 300, bonus: "Rare Item Drop",   label: "Day 21 ★★★", special: true },
  { day: 30, dc: 2000, xp: 500, bonus: "Epic Item Drop",   label: "Day 30 ★★★★", special: true },
];

export function DailyPage({ user, refreshUser, addToast, onNav }: Props) {
  const [status, setStatus] = useState<{ claimed: boolean; streak: number; nextClaimAt: string | null } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    api.get<any>("/daily/status").then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!status?.nextClaimAt) return;
    const calc = () => {
      const diff = new Date(status.nextClaimAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [status]);

  async function claimDaily() {
    setClaiming(true);
    setResult(null);
    try {
      const data = await api.post<any>("/daily/claim");
      setResult(data);
      setStatus(s => s ? { ...s, claimed: true, streak: data.streak, nextClaimAt: data.nextClaimAt } : s);
      addToast(`Daily claimed! +${formatDC(data.dcGained)} DC (Day ${data.streak})`, "success");
      refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setClaiming(false);
    }
  }

  const streak = status?.streak ?? user.dailyStreak ?? 0;
  const dayInCycle = ((streak - 1) % 7) + 1;
  const todayReward = DAILY_REWARDS.find(r => r.day === dayInCycle) ?? DAILY_REWARDS[0];
  const nextReward = DAILY_REWARDS.find(r => r.day === (dayInCycle % 7) + 1) ?? DAILY_REWARDS[0];

  return (
    <div className="max-w-lg mx-auto space-y-5 relative z-10">
      <div className="dl-page-bg bg-vault" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      <div>
        <h1 className="font-mono font-bold text-lg" style={{ color: "#f59e0b" }}>DAILY REWARD</h1>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Return every 24 hours to keep your streak alive.</p>
      </div>

      {/* Streak display */}
      <div style={{ background: "#111118", border: "1px solid #f59e0b30", borderRadius: 8, padding: 20 }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-mono font-bold text-3xl" style={{ color: "#f59e0b" }}>{streak}</div>
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>day streak</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Day in cycle</div>
            <div className="font-mono font-bold text-xl" style={{ color: "#e2e8f0" }}>{dayInCycle}/7</div>
          </div>
        </div>

        {/* Weekly progress */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {DAILY_REWARDS.map(r => {
            const isPast = r.day < dayInCycle;
            const isCurrent = r.day === dayInCycle;
            return (
              <div key={r.day} className="text-center">
                <div
                  className="rounded font-mono text-xs font-bold py-2"
                  style={{
                    background: isPast ? "#f59e0b30" : isCurrent ? "#f59e0b20" : "#1e1e2e",
                    border: `1px solid ${isCurrent ? "#f59e0b80" : isPast ? "#f59e0b30" : "#1e1e2e"}`,
                    color: isCurrent ? "#f59e0b" : isPast ? "#f59e0b80" : "#64748b",
                    fontSize: 10,
                  }}
                >
                  {isPast ? "✓" : r.day}
                </div>
                <div className="font-mono mt-0.5" style={{ fontSize: 9, color: "#64748b" }}>D{r.day}</div>
              </div>
            );
          })}
        </div>

        {/* Today's reward */}
        <div style={{ background: "#0a0a0f", border: "1px solid #f59e0b40", borderRadius: 6, padding: 16 }} className="mb-4">
          <div className="font-mono text-xs mb-2" style={{ color: "#f59e0b" }}>TODAY'S REWARD {todayReward.special ? "— MILESTONE" : ""}</div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <span className="font-mono font-bold text-xl" style={{ color: "#f59e0b" }}>+{formatDC(todayReward.dc)}</span>
              <span className="font-mono text-xs ml-1" style={{ color: "#64748b" }}>DC</span>
            </div>
            <div>
              <span className="font-mono font-bold text-xl" style={{ color: "#a855f7" }}>+{todayReward.xp}</span>
              <span className="font-mono text-xs ml-1" style={{ color: "#64748b" }}>XP</span>
            </div>
            {todayReward.bonus && (
              <div className="font-mono text-sm px-2 py-0.5 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff30" }}>
                {todayReward.bonus}
              </div>
            )}
          </div>
        </div>

        {/* Claim button */}
        {status?.claimed ? (
          <div>
            <div className="font-mono text-sm text-center py-3 rounded mb-2" style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}>
              Reward claimed for today
            </div>
            {timeLeft && (
              <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
                Next reward in: <span style={{ color: "#f59e0b" }}>{timeLeft}</span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={claimDaily}
            disabled={claiming}
            className="w-full font-mono font-bold text-sm py-3 rounded transition-all"
            style={{ background: "#f59e0b20", color: "#f59e0b", border: "2px solid #f59e0b60" }}
          >
            {claiming ? "Claiming..." : "Claim Daily Reward"}
          </button>
        )}
      </div>

      {/* Claim result */}
      {result && (
        <div style={{ background: "#111118", border: "1px solid #f59e0b40", borderRadius: 8, padding: 20 }}>
          <div className="font-mono font-bold mb-2" style={{ color: "#f59e0b" }}>Reward Received!</div>
          <div className="space-y-1 font-mono text-sm">
            <div style={{ color: "#e2e8f0" }}>+{formatDC(result.dcGained)} DC</div>
            <div style={{ color: "#a855f7" }}>+{result.xpGained} XP</div>
            {result.bonus && <div style={{ color: "#00d4ff" }}>Bonus: {result.bonus}</div>}
            {result.leveled && <div style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{result.newLevel}</div>}
            <div style={{ color: "#64748b" }}>Streak: {result.streak} days</div>
          </div>
        </div>
      )}

      {/* Next reward preview */}
      {status?.claimed && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
          <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>NEXT REWARD (Day {nextReward.day})</div>
          <div className="flex gap-3 font-mono text-sm flex-wrap">
            <span style={{ color: "#f59e0b" }}>+{formatDC(nextReward.dc)} DC</span>
            <span style={{ color: "#a855f7" }}>+{nextReward.xp} XP</span>
            {nextReward.bonus && <span style={{ color: "#00d4ff" }}>{nextReward.bonus}</span>}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
        <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>QUICK LINKS</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Crimes", page: "crimes", color: "#ff2d55" },
            { label: "Jobs", page: "jobs", color: "#39d353" },
            { label: "Combat", page: "combat", color: "#ff6b35" },
          ].map(l => (
            <button key={l.page} onClick={() => onNav(l.page)} className="font-mono text-xs py-2 rounded text-center"
              style={{ background: l.color + "18", color: l.color, border: `1px solid ${l.color}40` }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
