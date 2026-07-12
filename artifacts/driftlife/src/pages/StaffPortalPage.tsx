import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface TierDef {
  name: string;
  color: string;
  subscription: string;
  dailyDc: number;
  weeklyDc: number;
  monthlyDc: number;
  permissions: string[];
}

interface TaskRow {
  id: string;
  label: string;
  target: number;
  progress: number;
}

interface StaffMeData {
  tier: number;
  tierDef: TierDef;
  tasks: TaskRow[];
  totalEarned: number;
  lastClaimedAt: string | null;
  canClaimNow: boolean;
  nextClaimAt: string | null;
  subscription: string | null;
  subscriptionExpiresAt: string | null;
}

const TIER_ICON = ["", "👁", "🛡", "⚡", "👑", "🔱"];

function Countdown({ until }: { until: string | null }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!until) { setLabel(""); return; }
    const calc = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) { setLabel("Ready!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [until]);
  return <span>{label}</span>;
}

export function StaffPortalPage({ user, addToast }: Props) {
  const [data, setData]       = useState<StaffMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<StaffMeData>("/owner/staff/me")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const claim = async () => {
    setClaiming(true);
    try {
      const r = await api.post<{ message: string; dc: number; totalEarned: number }>("/owner/staff/earnings/claim");
      addToast(r.message, "success");
      load();
    } catch (e: any) {
      addToast(e.message || "Failed to claim", "error");
    } finally {
      setClaiming(false);
    }
  };

  const s = { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 };

  if (loading) {
    return <div className="font-mono text-xs text-center py-16" style={{ color: "#64748b" }}>Loading staff portal…</div>;
  }

  if (!data) {
    return (
      <div className="font-mono text-xs text-center py-16 space-y-2">
        <div style={{ color: "#ff2d55" }}>⚠ You are not assigned a staff tier</div>
        <div style={{ color: "#64748b" }}>Contact the owner to receive a staff assignment.</div>
      </div>
    );
  }

  const { tier, tierDef, tasks, totalEarned, canClaimNow, nextClaimAt } = data;

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Header */}
      <div style={{ ...s, borderColor: `${tierDef.color}40` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono font-bold text-lg" style={{ color: tierDef.color }}>
              {TIER_ICON[tier]} STAFF PORTAL — TIER {tier}: {tierDef.name.toUpperCase()}
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Logged in as <span style={{ color: "#f59e0b" }}>{user.username}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: `${tierDef.color}18`, color: tierDef.color, border: `1px solid ${tierDef.color}30` }}>
                {tierDef.name}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Subscription</div>
            <div className="font-mono text-sm font-bold" style={{ color: "#a855f7" }}>
              {tierDef.subscription.replace(/_/g, " ").toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Earnings card */}
      <div style={s}>
        <div className="font-mono font-bold text-xs mb-3" style={{ color: "#f59e0b" }}>DAILY EARNINGS</div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Daily", val: tierDef.dailyDc },
            { label: "Weekly", val: tierDef.weeklyDc },
            { label: "Monthly", val: tierDef.monthlyDc },
          ].map(row => (
            <div key={row.label} className="rounded p-3 text-center" style={{ background: "#0a0a0f", border: "1px solid #1e293b" }}>
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>{row.label}</div>
              <div className="font-mono font-bold text-sm" style={{ color: "#39d353" }}>{formatDC(row.val)} DC</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Total earned all-time</div>
            <div className="font-mono font-bold" style={{ color: "#f59e0b" }}>{formatDC(totalEarned)} DC</div>
          </div>
          <div className="text-right">
            {!canClaimNow && nextClaimAt && (
              <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>
                Next claim: <Countdown until={nextClaimAt} />
              </div>
            )}
            <button
              onClick={claim}
              disabled={!canClaimNow || claiming}
              className="font-mono text-xs px-5 py-2 rounded"
              style={{
                background: canClaimNow ? "#39d35318" : "#1e293b",
                color: canClaimNow ? "#39d353" : "#475569",
                border: `1px solid ${canClaimNow ? "#39d35340" : "#1e293b"}`,
                cursor: canClaimNow ? "pointer" : "not-allowed",
              }}
            >
              {claiming ? "Claiming…" : canClaimNow ? `⚡ Claim +${formatDC(tierDef.dailyDc)} DC` : "✓ Claimed Today"}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div style={s}>
        <div className="font-mono font-bold text-xs mb-3" style={{ color: "#00d4ff" }}>WEEKLY TASKS</div>
        <div className="space-y-3">
          {tasks.map(task => {
            const pct = Math.min(100, Math.round((task.progress / task.target) * 100));
            const done = task.progress >= task.target;
            return (
              <div key={task.id}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-xs" style={{ color: done ? "#39d353" : "#e2e8f0" }}>
                    {done ? "✓ " : ""}{task.label}
                  </span>
                  <span className="font-mono text-xs" style={{ color: done ? "#39d353" : "#64748b" }}>
                    {task.progress}/{task.target}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ background: "#1e293b", height: 4 }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: done ? "#39d353" : "#00d4ff" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permissions */}
      <div style={s}>
        <div className="font-mono font-bold text-xs mb-3" style={{ color: "#a855f7" }}>GRANTED PERMISSIONS</div>
        <div className="flex flex-wrap gap-2">
          {tierDef.permissions.map(p => (
            <span key={p} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f730" }}>
              {p.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
