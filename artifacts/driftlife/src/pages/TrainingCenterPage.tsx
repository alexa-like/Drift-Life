/**
 * Training Center — Tier 7
 * Replaces the old stat gym. Three skill training types:
 *   - Combat Drills     → permanent accuracy bonus
 *   - Racing Practice   → gear-shift timing window bonus
 *   - Endurance Training → energy regen speed bonus
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface TrainingTypeDef {
  id: string;
  label: string;
  description: string;
  energyCost: number;
  dailyLimit: number;
  sessionsToday: number;
  currentBonus: number;
  maxBonus: number;
  icon: string;
  xpGain: number;
}

interface TrainingData {
  energy: number;
  maxEnergy: number;
  combatAccuracyBonus: number;
  raceGearBonus: number;
  energyRegenBonus: number;
  trainingTypes: TrainingTypeDef[];
  resetAt: string | null;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const TYPE_CONFIG: Record<string, { color: string; statLabel: string; effect: string }> = {
  combat_drills:      { color: "#ff2d55", statLabel: "Accuracy Bonus",   effect: "Increases hit chance in combat by a flat %" },
  racing_practice:    { color: "#00d4ff", statLabel: "Gear Window",      effect: "Widens the green shift zone in races"        },
  endurance_training: { color: "#39d353", statLabel: "Regen Speed",      effect: "Reduces energy regeneration interval"        },
};

function BonusBar({
  current, max, color,
}: { current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div style={{ height: 5, background: "#1e1e2e", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div
        style={{
          width: `${pct}%`, height: "100%",
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius: 3, transition: "width 0.5s",
          boxShadow: pct > 0 ? `0 0 8px ${color}60` : "none",
        }}
      />
    </div>
  );
}

function useCountdown(isoDate: string | null) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!isoDate) return;
    function calc() {
      const diff = new Date(isoDate!).getTime() - Date.now();
      if (diff <= 0) { setText("now"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setText(`${h}h ${m}m ${s}s`);
    }
    calc();
    const iv = setInterval(calc, 1_000);
    return () => clearInterval(iv);
  }, [isoDate]);
  return text;
}

function EnergyBar({ energy, max }: { energy: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (energy / max) * 100) : 0;
  return (
    <div style={{ background: "#0d0d15", border: "1px solid #1e1e2e", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span className="font-mono" style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>ENERGY</span>
        <span className="font-mono font-bold" style={{ fontSize: 13, color: "#f59e0b" }}>
          {energy} / {max}
        </span>
      </div>
      <div style={{ height: 6, background: "#1e1e2e", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
          borderRadius: 3, transition: "width 0.4s",
          boxShadow: pct > 0 ? "0 0 8px #f59e0b60" : "none",
        }} />
      </div>
    </div>
  );
}

function StatSummaryCard({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{
      flex: 1, background: "#0d0d15", border: `1px solid ${color}30`,
      borderTop: `2px solid ${color}`, borderRadius: 6, padding: "10px 12px",
    }}>
      <div className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <div className="font-mono font-bold" style={{ fontSize: 16, color, lineHeight: 1 }}>
        +{(value * 100).toFixed(1)}%
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: "#334155", marginTop: 3 }}>
        {pct.toFixed(0)}% of max
      </div>
      <BonusBar current={value} max={max} color={color} />
    </div>
  );
}

export default function TrainingCenterPage({ user, refreshUser, addToast }: Props) {
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ type: string; message: string } | null>(null);
  const countdown = useCountdown(data?.resetAt ?? null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<TrainingData>("/training/");
      setData(r);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function train(typeId: string) {
    if (training) return;
    setTraining(typeId);
    setLastResult(null);
    try {
      const r = await api.post<{ message: string; newBonus: number; energyLeft: number; sessionsLeft: number }>(
        "/training/train",
        { trainingType: typeId },
      );
      const cfg = TYPE_CONFIG[typeId];
      addToast(r.message, "success");
      setLastResult({ type: typeId, message: r.message });
      await load();
      await refreshUser();
    } catch (e: any) {
      const msg = e?.message ?? "Training failed";
      addToast(msg, "error");
    } finally {
      setTraining(null);
    }
  }

  if (loading) {
    return (
      <div className="font-mono text-xs text-center py-20 animate-pulse" style={{ color: "#334155" }}>
        Loading Training Center…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 className="font-mono font-bold" style={{
              color: "#00d4ff", fontSize: 20, letterSpacing: "0.12em",
              textTransform: "uppercase", textShadow: "0 0 20px #00d4ff60",
            }}>
              Training Center
            </h1>
            <p className="font-mono" style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
              Permanent skill bonuses — {countdown ? `resets in ${countdown}` : "resets at midnight UTC"}
            </p>
          </div>
          <button
            onClick={load}
            className="font-mono text-xs"
            style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 4, color: "#475569", padding: "5px 10px", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Energy bar ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <EnergyBar energy={data?.energy ?? user.energy} max={data?.maxEnergy ?? user.maxEnergy} />
      </div>

      {/* ── Stat summary row ─────────────────────────────────────────────────── */}
      {data && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <StatSummaryCard
            label="Combat Accuracy"
            value={data.combatAccuracyBonus}
            max={0.25}
            color={TYPE_CONFIG.combat_drills.color}
          />
          <StatSummaryCard
            label="Gear Timing"
            value={data.raceGearBonus}
            max={0.25}
            color={TYPE_CONFIG.racing_practice.color}
          />
          <StatSummaryCard
            label="Energy Regen"
            value={data.energyRegenBonus}
            max={0.15}
            color={TYPE_CONFIG.endurance_training.color}
          />
        </div>
      )}

      {/* ── Training cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(data?.trainingTypes ?? []).map(t => {
          const cfg = TYPE_CONFIG[t.id] ?? { color: "#64748b", statLabel: t.id, effect: "" };
          const sessionsLeft = t.dailyLimit - t.sessionsToday;
          const atMax = t.currentBonus >= t.maxBonus;
          const noEnergy = (data?.energy ?? 0) < t.energyCost;
          const noSessions = sessionsLeft <= 0;
          const disabled = atMax || noEnergy || noSessions || !!training;
          const isTraining = training === t.id;
          const pct = t.maxBonus > 0 ? Math.min(100, (t.currentBonus / t.maxBonus) * 100) : 0;

          return (
            <div
              key={t.id}
              style={{
                background: "#0d0d15",
                border: `1px solid ${atMax ? "#39d353" : cfg.color}30`,
                borderLeft: `3px solid ${atMax ? "#39d353" : cfg.color}`,
                borderRadius: 10,
                padding: "16px 18px",
                opacity: (noSessions && !atMax) ? 0.65 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {/* Icon */}
                <div style={{
                  fontSize: 28, flexShrink: 0, width: 44, height: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: cfg.color + "15", borderRadius: 8,
                  border: `1px solid ${cfg.color}30`,
                }}>
                  {t.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 14 }}>{t.label}</span>
                    {atMax && (
                      <span className="font-mono" style={{ fontSize: 9, color: "#39d353", border: "1px solid #39d353", padding: "1px 5px", borderRadius: 3 }}>
                        MAXED
                      </span>
                    )}
                  </div>
                  <p className="font-mono" style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>{t.description}</p>
                  <p className="font-mono" style={{ color: "#334155", fontSize: 10, marginBottom: 8, fontStyle: "italic" }}>
                    {cfg.effect}
                  </p>

                  {/* Bonus progress */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="font-mono" style={{ fontSize: 10, color: "#475569" }}>{cfg.statLabel}</span>
                      <span className="font-mono font-bold" style={{ fontSize: 11, color: atMax ? "#39d353" : cfg.color }}>
                        +{(t.currentBonus * 100).toFixed(1)}% / +{(t.maxBonus * 100).toFixed(0)}%
                      </span>
                    </div>
                    <BonusBar current={t.currentBonus} max={t.maxBonus} color={atMax ? "#39d353" : cfg.color} />
                    <div className="font-mono" style={{ fontSize: 9, color: "#334155", marginTop: 3 }}>
                      {pct.toFixed(0)}% to max
                      {!atMax && ` · ${Math.ceil((t.maxBonus - t.currentBonus) / (t.maxBonus / t.dailyLimit / 25))} sessions remaining`}
                    </div>
                  </div>

                  {/* Cost + session info row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="font-mono" style={{ fontSize: 10, color: "#f59e0b" }}>⚡ {t.energyCost}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: "#39d353" }}>+{t.xpGain} XP</span>
                      <span className="font-mono" style={{ fontSize: 10, color: noSessions ? "#ef4444" : "#475569" }}>
                        {t.sessionsToday}/{t.dailyLimit} today
                      </span>
                    </div>
                  </div>
                </div>

                {/* Train button */}
                <div style={{ flexShrink: 0, paddingTop: 2 }}>
                  {atMax ? (
                    <div className="font-mono" style={{ fontSize: 10, color: "#39d353", textAlign: "center" }}>✓ MAXED</div>
                  ) : (
                    <button
                      onClick={() => train(t.id)}
                      disabled={disabled}
                      className="font-mono font-bold"
                      style={{
                        background: disabled ? "#1e1e2e" : cfg.color + "20",
                        color: disabled ? "#334155" : cfg.color,
                        border: `1px solid ${disabled ? "#1e1e2e" : cfg.color}`,
                        borderRadius: 6, padding: "8px 16px", fontSize: 12,
                        cursor: disabled ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                        minWidth: 80,
                        ...(disabled ? {} : { boxShadow: `0 0 12px ${cfg.color}30` }),
                      }}
                    >
                      {isTraining ? "…" : noSessions ? "DONE" : noEnergy ? "NO ENERGY" : "TRAIN"}
                    </button>
                  )}
                </div>
              </div>

              {/* Last result flash */}
              {lastResult?.type === t.id && (
                <div className="font-mono" style={{ fontSize: 11, color: cfg.color, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${cfg.color}20` }}>
                  {lastResult.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <p className="font-mono" style={{ color: "#1e1e2e", fontSize: 10, marginTop: 24, textAlign: "center" }}>
        Training bonuses are permanent and apply automatically in Combat and Races.
        Daily limits reset at midnight UTC.
      </p>
    </div>
  );
}
