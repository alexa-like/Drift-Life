import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, NPC } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { ActionResult } from "../components/ActionResult";

interface Target {
  id: string; username: string; avatar: string; faction: string | null;
  level: number; rank: string; district: string; wins: number; losses: number;
  wantedLevel: number; isHospitalized: boolean; attackCooldown: string | null;
}

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

const ALL_DISTRICTS = [
  { id: "residential-north", name: "Residential North" },
  { id: "industrial-east",   name: "Industrial East" },
  { id: "the-boulevard",     name: "The Boulevard" },
  { id: "port-district",     name: "Port District" },
  { id: "downtown-core",     name: "Downtown Core" },
  { id: "tech-quarter",      name: "Tech Quarter" },
  { id: "the-outskirts",     name: "The Outskirts" },
];

export function CombatPage({ user, refreshUser, addToast }: Props) {
  const [tab, setTab] = useState<"npc" | "pvp">("npc");
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [attacking, setAttacking] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterDistrict, setFilterDistrict] = useState(user.district);
  const [levelRange, setLevelRange] = useState<"tight" | "wide" | "any">("tight");

  useEffect(() => {
    if (tab === "npc") loadNpcs();
    else loadTargets();
  }, [tab]);

  async function loadNpcs() {
    setLoading(true);
    try { setNpcs(await api.get<NPC[]>("/combat/npcs")); }
    catch { addToast("Failed to load NPCs", "error"); }
    finally { setLoading(false); }
  }

  async function loadTargets(districtOverride?: string, range?: "tight" | "wide" | "any") {
    setLoading(true);
    const dist = districtOverride ?? filterDistrict;
    const lvlRange = range ?? levelRange;
    const minLevel = lvlRange === "tight" ? Math.max(1, user.level - 10) : lvlRange === "wide" ? Math.max(1, user.level - 25) : 1;
    const maxLevel = lvlRange === "tight" ? user.level + 10 : lvlRange === "wide" ? user.level + 25 : 999;
    try {
      const params = new URLSearchParams({ district: dist, minLevel: String(minLevel), maxLevel: String(maxLevel) });
      setTargets(await api.get<Target[]>(`/combat/targets?${params}`));
    } catch { addToast("Failed to load targets", "error"); }
    finally { setLoading(false); }
  }

  async function fightNpc(npcId: string) {
    setAttacking(npcId); setLastResult(null);
    try {
      const data = await api.post<any>(`/combat/npc/${npcId}`);
      setLastResult({ ...data, mode: "npc" });
      if (data.playerWins) addToast(`Victory! +${formatDC(data.dcGained)} DC`, "success");
      else addToast(data.hospitalized ? "You were hospitalized!" : "Defeated — you retreated.", data.hospitalized ? "error" : "warning");
      await refreshUser();
    } catch (err: any) { addToast(err.message, "error"); }
    finally { setAttacking(null); }
  }

  async function attackPlayer(targetId: string) {
    setAttacking(targetId); setLastResult(null);
    try {
      const data = await api.post<any>("/combat/attack", { targetId });
      setLastResult({ ...data, mode: "pvp" });
      if (data.attackerWins) addToast(`Victory! Seized ${formatDC(data.dcGained)} DC`, "success");
      else addToast(data.attackerHospitalized ? "Defeated — hospitalized." : "Defeated — you survived.", data.attackerHospitalized ? "error" : "warning");
      await refreshUser();
      loadTargets();
    } catch (err: any) { addToast(err.message, "error"); }
    finally { setAttacking(null); }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const blocked = isHosp || isJailed;
  const pvpUnlocked = user.level >= 10;

  const won = lastResult?.playerWins || lastResult?.attackerWins;
  const resultVisible = !!lastResult;
  const resultTitle = won
    ? `VICTORY — +${formatDC(lastResult?.dcGained ?? 0)} DC`
    : (lastResult?.hospitalized || lastResult?.attackerHospitalized) ? "DEFEAT — HOSPITALIZED" : "DEFEAT";

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <CyberSectionHeader title="Combat" accent="#ff6b35" size="lg" className="mb-0" />
        <div className="flex gap-4 font-mono text-xs">
          <span style={{ color: "#39d353" }}>HP: <strong style={{ color: "#e2e8f0" }}>{user.health}/{user.maxHealth}</strong></span>
          <span style={{ color: "#64748b" }}>W:<strong style={{ color: "#39d353" }}>{user.wins}</strong> L:<strong style={{ color: "#ff2d55" }}>{user.losses}</strong></span>
          <span style={{ color: "#64748b" }}>STR: <strong style={{ color: "#ff6b35" }}>{user.strength}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <CyberButton variant={tab === "npc" ? "warning" : "ghost"} size="sm" onClick={() => setTab("npc")}>
          NPC Combat
        </CyberButton>
        <CyberButton
          variant={tab === "pvp" ? "warning" : "ghost"}
          size="sm"
          disabled={!pvpUnlocked}
          onClick={() => setTab("pvp")}
        >
          PvP {!pvpUnlocked && "(Lv.10)"}
        </CyberButton>
      </div>

      {/* PvP daily limit */}
      {tab === "pvp" && pvpUnlocked && (
        <div className="font-mono text-xs px-3 py-2 rounded" style={{ background: "#1e1e2e", color: "#64748b" }}>
          Daily PvP:{" "}
          <span style={{ color: user.attacksToday >= 15 ? "#ff2d55" : "#e2e8f0" }}>
            {user.attacksToday || 0}/15
          </span>{" "}attacks used
        </div>
      )}

      {blocked && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-3 rounded font-mono text-xs"
          style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}
        >
          {isHosp ? "Hospitalized — cannot fight." : "Jailed — cannot fight."}
        </motion.div>
      )}

      {/* NPC Tab */}
      {tab === "npc" && (
        <>
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>NPCs in {user.district.replace(/-/g, " ")}</span>
            <CyberButton variant="ghost" size="sm" onClick={loadNpcs}>Refresh</CyberButton>
          </div>

          {loading ? (
            <div className="text-center py-10 font-mono text-xs animate-pulse" style={{ color: "#1e1e2e" }}>Scanning area...</div>
          ) : npcs.length === 0 ? (
            <div className="text-center py-10 font-mono text-xs" style={{ color: "#475569" }}>
              No NPCs found in this district. Travel to unlock new encounters.
            </div>
          ) : (
            <div className="space-y-2">
              {npcs.map((npc, idx) => {
                const levelReq = Math.max(1, npc.level - 10);
                const available = !blocked && user.level >= levelReq;
                return (
                  <motion.div key={npc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <AnimatedCard accent="#ff6b35">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{npc.name}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>Lv.{npc.level}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff2d5510", color: "#ff2d55", border: "1px solid #ff2d5530" }}>
                              {npc.dropRarity.toUpperCase().replace(/_/g, "/")}
                            </span>
                          </div>
                          <p className="font-mono text-xs mb-1" style={{ color: "#475569" }}>{npc.description}</p>
                          <div className="flex gap-3 font-mono text-xs flex-wrap">
                            <span style={{ color: "#39d353" }}>HP: {npc.hp}</span>
                            <span style={{ color: "#ff6b35" }}>STR: {npc.strength}</span>
                            <span style={{ color: "#f59e0b" }}>{formatDC(npc.dcMin)}–{formatDC(npc.dcMax)} DC</span>
                            <span style={{ color: "#a855f7" }}>+{npc.xp} XP</span>
                          </div>
                        </div>
                        <CyberButton
                          variant="warning"
                          size="sm"
                          loading={attacking === npc.id}
                          disabled={!available || attacking !== null}
                          onClick={() => fightNpc(npc.id)}
                        >
                          Fight
                        </CyberButton>
                      </div>
                    </AnimatedCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PvP Tab */}
      {tab === "pvp" && pvpUnlocked && (
        <>
          <AnimatedCard accent="#ff6b35">
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={filterDistrict}
                onChange={e => { setFilterDistrict(e.target.value); loadTargets(e.target.value, levelRange); }}
                className="px-2 py-1.5 rounded font-mono text-xs focus:outline-none"
                style={{ background: "#0a0a0f", border: "1px solid #2d2d3e", color: "#94a3b8" }}
              >
                {ALL_DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.id === user.district ? " (you)" : ""}</option>
                ))}
              </select>
              <div className="flex gap-1">
                {(["tight", "wide", "any"] as const).map(r => (
                  <CyberButton
                    key={r}
                    variant={levelRange === r ? "warning" : "ghost"}
                    size="sm"
                    onClick={() => { setLevelRange(r); loadTargets(filterDistrict, r); }}
                  >
                    {r === "tight" ? "±10" : r === "wide" ? "±25" : "Any"}
                  </CyberButton>
                ))}
              </div>
              <CyberButton variant="ghost" size="sm" onClick={() => loadTargets()} className="ml-auto">
                Refresh
              </CyberButton>
            </div>
          </AnimatedCard>

          <div className="font-mono text-xs" style={{ color: "#64748b" }}>{targets.length} targets found</div>

          {loading ? (
            <div className="text-center py-10 font-mono text-xs animate-pulse" style={{ color: "#1e1e2e" }}>Scanning for targets...</div>
          ) : targets.length === 0 ? (
            <div className="text-center py-10 font-mono text-xs" style={{ color: "#475569" }}>No targets found. Try a different area.</div>
          ) : (
            <div className="space-y-2">
              {targets.map((target, idx) => {
                const onCooldown = target.attackCooldown && new Date(target.attackCooldown) > new Date();
                const canAttack = !blocked && !onCooldown && !target.isHospitalized && (user.attacksToday || 0) < 15;
                const fc = target.faction ? FACTION_COLOR[target.faction] : "#94a3b8";
                return (
                  <motion.div
                    key={target.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    style={{ opacity: target.isHospitalized ? 0.45 : 1 }}
                  >
                    <AnimatedCard accent="#ff6b35">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{target.username}</span>
                            {target.faction && <span className="font-mono text-xs" style={{ color: fc }}>[{target.faction[0].toUpperCase()}]</span>}
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>Lv.{target.level}</span>
                            {target.isHospitalized && <span className="font-mono text-xs px-1 rounded" style={{ color: "#ff2d55", background: "#ff2d5512" }}>HOSP</span>}
                            {onCooldown && <span className="font-mono text-xs px-1 rounded" style={{ color: "#f59e0b", background: "#f59e0b12" }}>CD</span>}
                          </div>
                          <div className="flex gap-3 font-mono text-xs flex-wrap">
                            <span style={{ color: "#64748b" }}>{target.district.replace(/-/g, " ")}</span>
                            <span style={{ color: "#39d353" }}>W:{target.wins}</span>
                            <span style={{ color: "#ff2d55" }}>L:{target.losses}</span>
                            {target.wantedLevel > 0 && <span style={{ color: "#f59e0b" }}>{"★".repeat(target.wantedLevel)}</span>}
                          </div>
                        </div>
                        <CyberButton
                          variant="warning"
                          size="sm"
                          loading={attacking === target.id}
                          disabled={!canAttack || attacking !== null}
                          onClick={() => attackPlayer(target.id)}
                        >
                          Attack
                        </CyberButton>
                      </div>
                    </AnimatedCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "pvp" && !pvpUnlocked && (
        <div className="text-center py-10 font-mono text-sm" style={{ color: "#475569" }}>
          PvP unlocks at level 10. You are level {user.level}.
        </div>
      )}

      {/* Combat result */}
      <ActionResult
        visible={resultVisible}
        type={won ? "success" : "fail"}
        title={resultTitle}
        detail={lastResult?.narrative}
        onDismiss={() => setLastResult(null)}
      />
    </div>
  );
}
