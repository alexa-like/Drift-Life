/**
 * HackPage — Tier 9.1
 * Intelligence-based hacking system: hack players or corps to steal DC/items.
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { AnimatedCard } from "../components/AnimatedCard";
import { formatDC } from "../lib/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface HackStatus {
  hackDefenseLevel: number;
  nextUpgradeCost: number;
  intelligence: number;
  lastHackedAt: string | null;
  corps: CorpTarget[];
}

interface CorpTarget {
  id: string;
  name: string;
  poolCap: number;
  poolRemaining: number;
  difficulty: number;
  resetAt: string;
}

interface HackHistory {
  id: string;
  targetId: string;
  targetUsername: string;
  outcome: "success" | "fail";
  difficulty: number;
  cooldownUntil: string;
}

interface HackResult {
  success: boolean;
  outcome: string;
  stolenDc: number;
  stolenItem: string | null;
  targetName: string;
}

const DIFF_LABELS = ["", "Easy", "Medium", "Hard", "Expert", "Elite"];
const DIFF_COLORS = ["", "#39d353", "#f59e0b", "#ff6b35", "#ff2d55", "#ef4444"];

export default function HackPage({ user, refreshUser, addToast }: Props) {
  const [status, setStatus] = useState<HackStatus | null>(null);
  const [history, setHistory] = useState<HackHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Player hack state
  const [playerTargetId, setPlayerTargetId] = useState("");
  const [hackingPlayer, setHackingPlayer] = useState(false);

  // Corp hack state
  const [hackingCorp, setHackingCorp] = useState<string | null>(null);

  // Upgrade state
  const [upgrading, setUpgrading] = useState(false);

  // Last result
  const [lastResult, setLastResult] = useState<HackResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, hist] = await Promise.all([
        api.get<HackStatus>("/hack/status"),
        api.get<HackHistory[]>("/hack/history").catch(() => []),
      ]);
      setStatus(st);
      setHistory(hist);
    } catch (err: any) {
      addToast(err.message || "Failed to load hacking data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleHackPlayer() {
    if (!playerTargetId.trim()) return addToast("Enter a player ID", "warning");
    setHackingPlayer(true);
    setLastResult(null);
    try {
      const data = await api.post<HackResult>("/hack/target", {
        targetId: playerTargetId.trim(),
        targetType: "player",
      });
      setLastResult(data);
      if (data.success) {
        addToast(`Breach successful! ${data.stolenDc > 0 ? `+${data.stolenDc.toLocaleString()} DC` : ""}${data.stolenItem ? ` + ${data.stolenItem}` : ""}`, "success");
      } else {
        addToast("Hack failed — " + data.outcome, "warning");
      }
      await refreshUser();
      await load();
    } catch (err: any) {
      addToast(err.message || "Hack failed", "error");
    } finally {
      setHackingPlayer(false);
    }
  }

  async function handleHackCorp(corpId: string) {
    setHackingCorp(corpId);
    setLastResult(null);
    try {
      const data = await api.post<HackResult>("/hack/target", {
        targetId: corpId,
        targetType: "corp",
      });
      setLastResult(data);
      if (data.success) {
        addToast(`Corp breached! +${data.stolenDc.toLocaleString()} DC extracted`, "success");
      } else {
        addToast("Hack failed — " + data.outcome, "warning");
      }
      await refreshUser();
      await load();
    } catch (err: any) {
      addToast(err.message || "Hack failed", "error");
    } finally {
      setHackingCorp(null);
    }
  }

  async function handleUpgradeDefense() {
    setUpgrading(true);
    try {
      const data = await api.post<any>("/hack/upgrade-defense", {});
      addToast(data.message, "success");
      await refreshUser();
      await load();
    } catch (err: any) {
      addToast(err.message || "Upgrade failed", "error");
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#111118] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const intelligence = status?.intelligence ?? user.intelligence ?? 5;
  const canHack = intelligence >= 5;

  return (
    <div className="max-w-3xl mx-auto space-y-5 relative z-10">
      <div className="dl-page-bg" style={{ background: "radial-gradient(circle at center, #001a0d 0%, #08080c 100%)" }} />

      <CyberSectionHeader title="NEURAL HACK TERMINAL" accent="#39d353" cursor />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Intelligence", value: intelligence, color: "#39d353" },
          { label: "Defense Level", value: status?.hackDefenseLevel ?? 0, color: "#00d4ff" },
          { label: "Firewall Cost", value: `${(status?.nextUpgradeCost ?? 0).toLocaleString()} DC`, color: "#f59e0b" },
          { label: "Corp Targets", value: status?.corps.length ?? 3, color: "#a855f7" },
        ].map(stat => (
          <AnimatedCard key={stat.label} noPad>
            <div className="p-3 text-center">
              <div className="font-mono text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="font-mono text-[10px] text-slate-500 mt-0.5">{stat.label.toUpperCase()}</div>
            </div>
          </AnimatedCard>
        ))}
      </div>

      {!canHack && (
        <div className="p-4 rounded-lg border border-red-900/50 bg-red-950/20 font-mono text-sm text-red-400">
          ⚠ Need at least 5 Intelligence to run hacks. Train at the Gym to increase Intelligence.
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border font-mono text-sm"
          style={{
            background: lastResult.success ? "#001a0d" : "#1a0000",
            borderColor: lastResult.success ? "#39d353" : "#ef4444",
            color: lastResult.success ? "#39d353" : "#ef4444",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{lastResult.success ? "🔓" : "🔒"}</span>
            <div>
              <div className="font-bold">{lastResult.success ? "BREACH SUCCESSFUL" : "INTRUSION FAILED"}</div>
              <div className="mt-1 text-slate-300">{lastResult.outcome}</div>
              {lastResult.stolenDc > 0 && (
                <div className="mt-1 text-amber-400 font-bold">+{formatDC(lastResult.stolenDc)} DC stolen</div>
              )}
              {lastResult.stolenItem && (
                <div className="mt-1 text-purple-400">+ Item stolen: {lastResult.stolenItem}</div>
              )}
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="ml-auto text-slate-600 hover:text-slate-400"
            >✕</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Player Hack */}
        <div className="space-y-3">
          <CyberSectionHeader title="HACK PLAYER" accent="#ff2d55" />
          <AnimatedCard>
            <div className="space-y-3">
              <p className="font-mono text-xs text-slate-400">
                Target a player's wallet. 6-hour cooldown per target. Success rate based on your Intelligence vs their Defense Level.
              </p>
              <div>
                <label className="font-mono text-xs text-slate-500 block mb-1">TARGET PLAYER ID</label>
                <input
                  className="w-full bg-[#0a0a14] border border-slate-700 rounded px-3 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:border-[#ff2d55]"
                  placeholder="Paste player ID..."
                  value={playerTargetId}
                  onChange={e => setPlayerTargetId(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleHackPlayer(); }}
                />
              </div>
              <div className="text-xs font-mono text-slate-500">
                Success chance: {Math.round(Math.min(85, Math.max(30, intelligence / 100 * 100 + 30)))}% base (before target defense)
              </div>
              <CyberButton
                variant="danger"
                size="sm"
                loading={hackingPlayer}
                disabled={!canHack || hackingPlayer || !playerTargetId.trim()}
                onClick={handleHackPlayer}
                className="w-full"
              >
                🔓 INITIATE BREACH
              </CyberButton>
            </div>
          </AnimatedCard>
        </div>

        {/* Firewall Upgrade */}
        <div className="space-y-3">
          <CyberSectionHeader title="FIREWALL" accent="#00d4ff" />
          <AnimatedCard>
            <div className="space-y-3">
              <p className="font-mono text-xs text-slate-400">
                Upgrade your firewall to reduce your chances of being successfully hacked. Each level costs 5,000 × current level DC.
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 h-2 rounded-full bg-[#111118]"
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((status?.hackDefenseLevel ?? 0) / 10) * 100)}%`,
                      background: "linear-gradient(90deg, #00d4ff, #39d353)",
                    }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-[#00d4ff]">
                  Lv.{status?.hackDefenseLevel ?? 0}
                </span>
              </div>
              <CyberButton
                variant="primary"
                size="sm"
                loading={upgrading}
                disabled={upgrading || (user.dc < (status?.nextUpgradeCost ?? 0))}
                onClick={handleUpgradeDefense}
                className="w-full"
              >
                🛡 UPGRADE FIREWALL — {(status?.nextUpgradeCost ?? 0).toLocaleString()} DC
              </CyberButton>
            </div>
          </AnimatedCard>
        </div>
      </div>

      {/* Corp Targets */}
      <div className="space-y-3">
        <CyberSectionHeader title="CORPORATION TARGETS" accent="#a855f7" />
        <p className="font-mono text-xs text-slate-500 px-1">
          Corps reset their data vaults hourly. Lower drama than player hacking — good for steady income.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(status?.corps ?? []).map(corp => {
            const poolPct = Math.round((corp.poolRemaining / corp.poolCap) * 100);
            const diffIdx = Math.min(5, corp.difficulty);
            const resetIn = Math.max(0, Math.round((new Date(corp.resetAt).getTime() - Date.now()) / 60_000));

            return (
              <AnimatedCard key={corp.id} noPad accent="#a855f7">
                <div className="p-4 space-y-2">
                  <div className="font-mono font-bold text-sm text-slate-200">{corp.name}</div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs" style={{ color: DIFF_COLORS[diffIdx] }}>
                      {DIFF_LABELS[diffIdx]} difficulty
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {resetIn}m reset
                    </span>
                  </div>

                  {/* Pool bar */}
                  <div>
                    <div className="flex justify-between font-mono text-[10px] mb-1">
                      <span className="text-slate-500">VAULT</span>
                      <span className="text-amber-400">{corp.poolRemaining.toLocaleString()} DC</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#111118]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${poolPct}%`,
                          background: poolPct > 50 ? "#39d353" : poolPct > 20 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>

                  <CyberButton
                    variant="ghost"
                    size="sm"
                    loading={hackingCorp === corp.id}
                    disabled={!canHack || !!hackingCorp || corp.poolRemaining <= 0}
                    onClick={() => handleHackCorp(corp.id)}
                    className="w-full"
                  >
                    {corp.poolRemaining <= 0 ? "Vault Empty" : "BREACH"}
                  </CyberButton>
                </div>
              </AnimatedCard>
            );
          })}
        </div>
      </div>

      {/* Hack History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <CyberSectionHeader title="RECENT OPERATIONS" accent="#475569" />
          <div className="space-y-2">
            {history.slice(0, 10).map(h => (
              <div
                key={h.id}
                className="flex items-center gap-3 px-4 py-2 rounded bg-[#0a0a14] border border-slate-800 font-mono text-xs"
              >
                <span style={{ color: h.outcome === "success" ? "#39d353" : "#ef4444" }}>
                  {h.outcome === "success" ? "🔓" : "🔒"}
                </span>
                <span className="text-slate-400 flex-1">
                  {h.outcome === "success" ? "Breached" : "Failed vs"}{" "}
                  <span className="text-slate-200">{h.targetUsername}</span>
                </span>
                <span className="text-slate-600">
                  cooldown until {new Date(h.cooldownUntil).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
