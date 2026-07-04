import { useState, useEffect } from "react";
import { User, NPC } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";

interface Target {
  id: string;
  username: string;
  avatar: string;
  faction: string | null;
  level: number;
  rank: string;
  district: string;
  wins: number;
  losses: number;
  wantedLevel: number;
  isHospitalized: boolean;
  attackCooldown: string | null;
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
    try {
      const data = await api.get<NPC[]>("/combat/npcs");
      setNpcs(data);
    } catch { addToast("Failed to load NPCs", "error"); }
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
      const data = await api.get<Target[]>(`/combat/targets?${params}`);
      setTargets(data);
    } catch { addToast("Failed to load targets", "error"); }
    finally { setLoading(false); }
  }

  async function fightNpc(npcId: string) {
    setAttacking(npcId);
    setLastResult(null);
    try {
      const data = await api.post<any>(`/combat/npc/${npcId}`);
      setLastResult({ ...data, mode: "npc" });
      if (data.playerWins) {
        addToast(`Victory! +${formatDC(data.dcGained)} DC`, "success");
      } else {
        addToast(data.hospitalized ? "You were hospitalized!" : "Defeated — you retreated.", data.hospitalized ? "error" : "warning");
      }
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setAttacking(null);
    }
  }

  async function attackPlayer(targetId: string) {
    setAttacking(targetId);
    setLastResult(null);
    try {
      const data = await api.post<any>("/combat/attack", { targetId });
      setLastResult({ ...data, mode: "pvp" });
      if (data.attackerWins) {
        addToast(`Victory! Seized ${formatDC(data.dcGained)} DC`, "success");
      } else {
        addToast(data.attackerHospitalized ? "Defeated — hospitalized." : "Defeated — you survived.", data.attackerHospitalized ? "error" : "warning");
      }
      await refreshUser();
      loadTargets();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setAttacking(null);
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const blocked = isHosp || isJailed;

  const pvpUnlocked = user.level >= 10;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-mono font-bold text-lg" style={{ color: "#ff6b35" }}>COMBAT</h2>
        <div className="flex gap-4 font-mono text-xs">
          <span style={{ color: "#39d353" }}>HP: <strong style={{ color: "#e2e8f0" }}>{user.health}/{user.maxHealth}</strong></span>
          <span style={{ color: "#64748b" }}>W:<strong style={{ color: "#39d353" }}>{user.wins}</strong> L:<strong style={{ color: "#ff2d55" }}>{user.losses}</strong></span>
          <span style={{ color: "#64748b" }}>STR: <strong style={{ color: "#ff6b35" }}>{user.strength}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("npc")} className="font-mono text-sm px-4 py-2 rounded" style={{
          background: tab === "npc" ? "#ff6b3518" : "transparent",
          color: tab === "npc" ? "#ff6b35" : "#64748b",
          border: tab === "npc" ? "1px solid #ff6b3540" : "1px solid #1e1e2e",
        }}>NPC Combat</button>
        <button onClick={() => setTab("pvp")} className="font-mono text-sm px-4 py-2 rounded" style={{
          background: tab === "pvp" ? "#ff6b3518" : "transparent",
          color: tab === "pvp" ? "#ff6b35" : !pvpUnlocked ? "#64748b" : "#64748b",
          border: tab === "pvp" ? "1px solid #ff6b3540" : "1px solid #1e1e2e",
          opacity: !pvpUnlocked ? 0.5 : 1,
        }}>
          PvP — Player vs Player {!pvpUnlocked && "(Lv.10)"}
        </button>
      </div>

      {/* PvP daily limit display */}
      {tab === "pvp" && pvpUnlocked && (
        <div className="font-mono text-xs px-3 py-2 rounded" style={{ background: "#1e1e2e", color: "#64748b" }}>
          Daily PvP: <span style={{ color: user.attacksToday >= 15 ? "#ff2d55" : "#e2e8f0" }}>{user.attacksToday || 0}/15</span> attacks used
        </div>
      )}

      {blocked && (
        <div className="p-3 rounded font-mono text-xs" style={{ background: "#ff2d5510", border: "1px solid #ff2d5540", color: "#ff2d55" }}>
          {isHosp ? "Hospitalized — cannot fight." : "Jailed — cannot fight."}
        </div>
      )}

      {/* Combat result */}
      {lastResult && (
        <div className="p-4 rounded font-mono" style={{
          background: (lastResult.playerWins || lastResult.attackerWins) ? "#ff6b3510" : "#ff2d5510",
          border: `1px solid ${(lastResult.playerWins || lastResult.attackerWins) ? "#ff6b3540" : "#ff2d5540"}`,
        }}>
          <div className="font-bold text-sm mb-1" style={{ color: (lastResult.playerWins || lastResult.attackerWins) ? "#ff6b35" : "#ff2d55" }}>
            {(lastResult.playerWins || lastResult.attackerWins) ? "VICTORY" : "DEFEAT"}
          </div>
          <p className="text-xs mb-2" style={{ color: "#94a3b8", fontStyle: "italic" }}>{lastResult.narrative}</p>
          <div className="flex gap-4 text-xs flex-wrap">
            {lastResult.dcGained > 0 && <span style={{ color: "#f59e0b" }}>+{formatDC(lastResult.dcGained)} DC</span>}
            {lastResult.xpGained > 0 && <span style={{ color: "#a855f7" }}>+{lastResult.xpGained} XP</span>}
            {lastResult.leveled && <span style={{ color: "#00d4ff" }}>LEVEL UP! Lv.{lastResult.newLevel}</span>}
            {(lastResult.defenderHospitalized) && <span style={{ color: "#ff2d55" }}>Enemy hospitalized</span>}
            {(lastResult.hospitalized || lastResult.attackerHospitalized) && <span style={{ color: "#ff2d55" }}>You were hospitalized</span>}
          </div>
          {lastResult.mode === "pvp" && (
            <div className="text-xs mt-2" style={{ color: "#64748b" }}>
              Roll: {lastResult.attackerRoll} vs {lastResult.defenderRoll}
            </div>
          )}
        </div>
      )}

      {/* NPC Tab */}
      {tab === "npc" && (
        <>
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>
              NPCs in {user.district.replace(/-/g, " ")}
            </span>
            <button onClick={loadNpcs} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>Refresh</button>
          </div>
          {loading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#1e1e2e" }}>Scanning area...</div>
          ) : npcs.length === 0 ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>
              No NPCs found in this district. Travel to unlock new encounters.
            </div>
          ) : (
            <div className="space-y-2">
              {npcs.map(npc => {
                const levelReq = Math.max(1, npc.level - 10);
                const available = !blocked && user.level >= levelReq;
                return (
                  <div key={npc.id} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8 }}>
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{npc.name}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>Lv.{npc.level}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff2d5510", color: "#ff2d55" }}>
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
                      <button
                        onClick={() => fightNpc(npc.id)}
                        disabled={!available || attacking !== null}
                        className="px-3 py-1.5 rounded font-mono text-xs font-bold uppercase flex-shrink-0"
                        style={{
                          background: available ? "#ff6b3518" : "#1e1e2e",
                          color: available ? "#ff6b35" : "#475569",
                          border: `1px solid ${available ? "#ff6b3540" : "#1e1e2e"}`,
                        }}
                      >
                        {attacking === npc.id ? "..." : "Fight"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PvP Tab */}
      {tab === "pvp" && pvpUnlocked && (
        <>
          {/* Filter bar */}
          <div className="p-3 rounded space-y-2" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={filterDistrict}
                onChange={e => { setFilterDistrict(e.target.value); loadTargets(e.target.value, levelRange); }}
                className="px-2 py-1 rounded font-mono text-xs focus:outline-none"
                style={{ background: "#0a0a0f", border: "1px solid #2d2d3e", color: "#94a3b8" }}
              >
                {ALL_DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}{d.id === user.district ? " (you)" : ""}</option>
                ))}
              </select>
              <div className="flex gap-1">
                {(["tight", "wide", "any"] as const).map(r => (
                  <button key={r} onClick={() => { setLevelRange(r); loadTargets(filterDistrict, r); }}
                    className="px-2 py-1 rounded font-mono text-xs font-bold"
                    style={{
                      background: levelRange === r ? "#ff6b3518" : "transparent",
                      color: levelRange === r ? "#ff6b35" : "#475569",
                      border: levelRange === r ? "1px solid #ff6b3540" : "1px solid #1e1e2e",
                    }}>
                    {r === "tight" ? "±10" : r === "wide" ? "±25" : "Any"}
                  </button>
                ))}
              </div>
              <button onClick={() => loadTargets()} className="px-2 py-1 rounded font-mono text-xs ml-auto"
                style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>
                Refresh
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-xs" style={{ color: "#64748b" }}>
              {targets.length} targets found
            </span>
          </div>
          {loading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#1e1e2e" }}>Scanning for targets...</div>
          ) : targets.length === 0 ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>
              No targets found in this district. Try a different area.
            </div>
          ) : (
            <div className="space-y-2">
              {targets.map(target => {
                const onCooldown = target.attackCooldown && new Date(target.attackCooldown) > new Date();
                const canAttack = !blocked && !onCooldown && !target.isHospitalized && (user.attacksToday || 0) < 15;
                const fc = target.faction ? FACTION_COLOR[target.faction] : "#94a3b8";
                return (
                  <div key={target.id} style={{
                    background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8,
                    opacity: target.isHospitalized ? 0.5 : 1,
                  }}>
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{target.username}</span>
                          {target.faction && (
                            <span className="font-mono text-xs" style={{ color: fc }}>[{target.faction[0].toUpperCase()}]</span>
                          )}
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#1e1e2e", color: "#94a3b8" }}>Lv.{target.level}</span>
                          {target.isHospitalized && <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>HOSP</span>}
                          {onCooldown && <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>CD</span>}
                        </div>
                        <div className="flex gap-3 font-mono text-xs flex-wrap">
                          <span style={{ color: "#64748b" }}>{target.district.replace(/-/g, " ")}</span>
                          <span style={{ color: "#39d353" }}>W:{target.wins}</span>
                          <span style={{ color: "#ff2d55" }}>L:{target.losses}</span>
                          {target.wantedLevel > 0 && <span style={{ color: "#f59e0b" }}>{"★".repeat(target.wantedLevel)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => attackPlayer(target.id)}
                        disabled={!canAttack || attacking !== null}
                        className="px-3 py-1.5 rounded font-mono text-xs font-bold uppercase flex-shrink-0"
                        style={{
                          background: canAttack ? "#ff6b3518" : "#1e1e2e",
                          color: canAttack ? "#ff6b35" : "#475569",
                          border: `1px solid ${canAttack ? "#ff6b3540" : "#1e1e2e"}`,
                        }}
                      >
                        {attacking === target.id ? "..." : "Attack"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "pvp" && !pvpUnlocked && (
        <div className="text-center py-8 font-mono text-sm" style={{ color: "#475569" }}>
          PvP unlocks at level 10. You are level {user.level}.
        </div>
      )}
    </div>
  );
}
