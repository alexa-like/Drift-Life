import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUserUpdate: () => void;
  onNavigate: (page: string) => void;
}

type Phase = "idle" | "queuing" | "found" | "matched" | "complete";
type CombatAction = "attack" | "defend" | "use_item" | "reload" | "special";

interface LoadoutSnap {
  hp: number; damage: number; defense: number; accuracy: number;
  weapon: string | null; armor: string | null;
  consumable1: string | null; consumable2: string | null; ammoType: string | null;
}
interface TurnRecord {
  turnNumber: number; player1Action: string; player2Action: string;
  player1HpAfter: number; player2HpAfter: number;
  player1Effect: string | null; player2Effect: string | null;
  narrative: string;
}
interface ActiveEffect { effect: string; turnsLeft: number; value: number; }

interface Match {
  matchId: string; status: string;
  player1Id: string; player2Id: string | null; isPlayer2AI: boolean; aiName: string | null;
  player1Loadout: LoadoutSnap; player2Loadout: LoadoutSnap;
  player1HP: number; player2HP: number;
  player1CurrentArmorHp?: number; player2CurrentArmorHp?: number;
  player1ConsumablesUsed: string[]; player2ConsumablesUsed: string[];
  player1ActiveEffects: ActiveEffect[]; player2ActiveEffects: ActiveEffect[];
  currentTurn: number; currentTurnDeadline: string;
  turns: TurnRecord[]; winnerId: string | null; rewardsGranted: boolean;
}

// ── Floating damage number ────────────────────────────────────────────────────
interface FloatDmg { id: number; value: number; isCrit: boolean; isHeal: boolean; side: "left" | "right" }
let _floatId = 0;

// ── Idle animation: gentle float ──────────────────────────────────────────────
const COMBAT_CSS = `
@keyframes arenaIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes arenaShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
@keyframes arenaCritShake { 0%,100%{transform:translate(0)} 10%{transform:translate(-12px,4px)} 20%{transform:translate(12px,-4px)} 30%{transform:translate(-10px)} 40%{transform:translate(10px)} 50%{transform:translate(-6px)} }
@keyframes arenaAttackFwd { 0%{transform:translateX(0)} 40%{transform:translateX(32px)} 100%{transform:translateX(0)} }
@keyframes arenaAttackBwd { 0%{transform:translateX(0)} 40%{transform:translateX(-32px)} 100%{transform:translateX(0)} }
@keyframes floatUp { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-60px)} }
@keyframes hitFlash { 0%,100%{filter:none} 30%,70%{filter:brightness(3) saturate(0)} }
@keyframes critFlash { 0%,100%{filter:none} 25%,75%{filter:brightness(4) hue-rotate(0deg)} 50%{filter:brightness(5) hue-rotate(60deg)} }
@keyframes healFlash { 0%,100%{filter:none} 50%{filter:brightness(2) hue-rotate(100deg)} }
@keyframes queuePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.97)} }
@keyframes foundSlide { 0%{opacity:0;transform:translateY(-24px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes barGlow { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 10px currentColor} }
@keyframes streakPop { 0%{transform:scale(0.5)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
@keyframes effectPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
`;

const EFFECT_ICONS: Record<string, { icon: string; color: string }> = {
  burn:       { icon: "🔥", color: "#f97316" },
  bleed:      { icon: "🩸", color: "#dc2626" },
  toxic:      { icon: "☠", color: "#84cc16" },
  shock:      { icon: "⚡", color: "#a855f7" },
  stun:       { icon: "💫", color: "#a855f7" },
  regen:      { icon: "💚", color: "#22c55e" },
  regen_field:{ icon: "💚", color: "#22c55e" },
};

function ActiveEffectBadges({ effects }: { effects: ActiveEffect[] }) {
  if (!effects || effects.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
      {effects.map((eff, i) => {
        const cfg = EFFECT_ICONS[eff.effect] ?? { icon: "✨", color: "#94a3b8" };
        return (
          <span key={i} style={{
            fontFamily: "monospace", fontSize: 9, color: cfg.color,
            background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`,
            borderRadius: 4, padding: "1px 5px",
            animation: "effectPulse 1.5s ease-in-out infinite",
          }}>
            {cfg.icon} {eff.effect} {eff.turnsLeft}T
          </span>
        );
      })}
    </div>
  );
}

function HPBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? color : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b" }}>HP</span>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: barColor, fontWeight: "bold" }}>
          {current} <span style={{ color: "#475569" }}>/ {max}</span>
        </span>
      </div>
      <div style={{ background: "#0f172a", borderRadius: 4, height: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
        <div style={{
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          height: "100%", borderRadius: 4,
          width: `${pct}%`,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 8px ${barColor}60`,
        }} />
      </div>
    </div>
  );
}

function ArmorBar({ current, max }: { current: number; max: number }) {
  if (current === 0 && max === 0) return null;
  const pct = Math.max(0, Math.min(100, max > 0 ? (current / max) * 100 : 0));
  const barColor = pct > 50 ? "#60a5fa" : pct > 20 ? "#94a3b8" : "#475569";
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#64748b" }}>🛡 ARMOR</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: barColor, fontWeight: "bold" }}>
          {current} <span style={{ color: "#334155" }}>/ {max}</span>
        </span>
      </div>
      <div style={{ background: "#0f172a", borderRadius: 3, height: 5, overflow: "hidden", border: "1px solid #1e293b" }}>
        <div style={{
          background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
          height: "100%", borderRadius: 3,
          width: `${pct}%`,
          transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 6px ${barColor}50`,
        }} />
      </div>
    </div>
  );
}

// ── Character art: big tier-colored silhouette with weapon glyph ──────────────
function CharacterBadge({ name, color, isLeft, animState }: {
  name: string; color: string; isLeft: boolean;
  animState: "idle" | "attack" | "hit" | "crit" | "dead";
}) {
  const anim = animState === "attack"
    ? (isLeft ? "arenaAttackFwd 0.4s ease" : "arenaAttackBwd 0.4s ease")
    : animState === "crit"
    ? "arenaCritShake 0.5s ease"
    : animState === "hit"
    ? "arenaShake 0.35s ease"
    : "arenaIdle 2.4s ease-in-out infinite";

  const flashFilter = animState === "hit" ? { animation: "hitFlash 0.35s ease" }
    : animState === "crit" ? { animation: "critFlash 0.5s ease" }
    : {};

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      animation: anim, ...flashFilter,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        border: `3px solid ${color}`,
        background: `radial-gradient(circle at 35% 35%, ${color}25, ${color}08)`,
        boxShadow: `0 0 20px ${color}30, inset 0 0 12px ${color}10`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32,
        opacity: animState === "dead" ? 0.35 : 1,
        filter: animState === "dead" ? "grayscale(1)" : "none",
        transition: "opacity 0.5s, filter 0.5s",
      }}>
        {animState === "dead" ? "💀" : "🥷"}
      </div>
      <span style={{
        fontFamily: "monospace", fontSize: 10, color, fontWeight: "bold",
        letterSpacing: 1, maxWidth: 90, textAlign: "center",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{name}</span>
    </div>
  );
}

export default function ArenaCombatPage({ user, addToast, onUserUpdate, onNavigate }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [match, setMatch] = useState<Match | null>(null);
  const [acting, setActing] = useState(false);
  const [turnTimer, setTurnTimer] = useState(15);
  const [lastAction, setLastAction] = useState<CombatAction | "">("");
  const [floatDmgs, setFloatDmgs] = useState<FloatDmg[]>([]);
  const [p1Anim, setP1Anim] = useState<"idle" | "attack" | "hit" | "crit" | "dead">("idle");
  const [p2Anim, setP2Anim] = useState<"idle" | "attack" | "hit" | "crit" | "dead">("idle");
  const [screenShake, setScreenShake] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const isP1 = match?.player1Id === user.id;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function spawnFloat(value: number, isCrit: boolean, isHeal: boolean, side: "left" | "right") {
    const id = ++_floatId;
    setFloatDmgs(prev => [...prev, { id, value, isCrit, isHeal, side }]);
    setTimeout(() => setFloatDmgs(prev => prev.filter(f => f.id !== id)), 1200);
  }

  function triggerAnimFromTurn(newMatch: Match, oldMatch: Match | null) {
    if (!oldMatch) return;
    const lastTurn = newMatch.turns[newMatch.turns.length - 1];
    if (!lastTurn) return;

    const p1Effect = lastTurn.player1Effect;
    const p2Effect = lastTurn.player2Effect;

    // Determine who attacked whom
    const p1DmgTaken = oldMatch.player1HP - newMatch.player1HP;
    const p2DmgTaken = oldMatch.player2HP - newMatch.player2HP;

    if (p2DmgTaken > 0) {
      // P1 attacked P2
      setP1Anim("attack"); setTimeout(() => setP1Anim("idle"), 450);
      setP2Anim(p2Effect === "crit" ? "crit" : "hit"); setTimeout(() => setP2Anim(newMatch.player2HP <= 0 ? "dead" : "idle"), 500);
      const side = isP1 ? "right" : "left";
      spawnFloat(p2DmgTaken, p2Effect === "crit", false, side);
      if (p2DmgTaken > 40 || p2Effect === "crit") { setScreenShake(true); setTimeout(() => setScreenShake(false), 500); }
    }
    if (p1DmgTaken > 0) {
      // P2 attacked P1
      setP2Anim("attack"); setTimeout(() => setP2Anim(newMatch.player2HP <= 0 ? "dead" : "idle"), 450);
      setP1Anim(p1Effect === "crit" ? "crit" : "hit"); setTimeout(() => setP1Anim(newMatch.player1HP <= 0 ? "dead" : "idle"), 500);
      const side = isP1 ? "left" : "right";
      spawnFloat(p1DmgTaken, p1Effect === "crit", false, side);
      if (p1DmgTaken > 40 || p1Effect === "crit") { setScreenShake(true); setTimeout(() => setScreenShake(false), 500); }
    }
    // Heals
    if (lastTurn.player1Effect === "heal") {
      const oldHP = oldMatch.player1HP;
      const newHP = newMatch.player1HP;
      if (newHP > oldHP) spawnFloat(newHP - oldHP, false, true, isP1 ? "left" : "right");
    }
    if (lastTurn.player2Effect === "heal") {
      const oldHP = oldMatch.player2HP;
      const newHP = newMatch.player2HP;
      if (newHP > oldHP) spawnFloat(newHP - oldHP, false, true, isP1 ? "right" : "left");
    }
  }

  const fetchMatch = useCallback(async (matchId: string, prevMatch?: Match | null) => {
    try {
      const data = await api.get<{ match: Match }>(`/arena/match/${matchId}`);
      triggerAnimFromTurn(data.match, prevMatch ?? null);
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        clearInterval(timerRef.current!);
        onUserUpdate();
      }
      return data.match;
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUserUpdate, isP1]);

  // Poll active match every 2s
  useEffect(() => {
    if (phase === "matched" && match?.matchId) {
      pollRef.current = setInterval(() => {
        setMatch(prev => { fetchMatch(match.matchId, prev); return prev; });
      }, 2_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, match?.matchId]); // eslint-disable-line

  // Turn timer countdown
  useEffect(() => {
    if (phase !== "matched" || match?.status !== "active") return;
    const deadline = match.currentTurnDeadline ? new Date(match.currentTurnDeadline).getTime() : Date.now() + 15_000;
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
      setTurnTimer(secs);
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, match?.currentTurn, match?.currentTurnDeadline, match?.status]);

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [match?.turns.length]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(pollRef.current!);
    clearInterval(timerRef.current!);
    clearInterval(queuePollRef.current!);
  }, []);

  // ── Queue join ─────────────────────────────────────────────────────────────
  async function joinQueue() {
    setPhase("queuing");
    try {
      const data = await api.post<{ status: string; matchId?: string }>("/arena/queue/join");
      if (data.matchId) {
        const m = await fetchMatch(data.matchId);
        if (m) { setPhase("found"); setTimeout(() => setPhase("matched"), 2_000); }
      } else {
        queuePollRef.current = setInterval(async () => {
          try {
            const status = await api.get<{ inQueue: boolean; activeMatch: { matchId: string } | null }>("/arena/queue/status");
            if (status.activeMatch) {
              clearInterval(queuePollRef.current!);
              const m = await fetchMatch(status.activeMatch.matchId);
              if (m) { setPhase("found"); setTimeout(() => setPhase("matched"), 2_000); }
            }
            if (!status.inQueue && !status.activeMatch) {
              clearInterval(queuePollRef.current!);
              setPhase("idle");
            }
          } catch {}
        }, 2_000);
      }
    } catch (err: any) {
      addToast(err.message ?? "Failed to join queue", "error");
      setPhase("idle");
    }
  }

  async function leaveQueue() {
    clearInterval(queuePollRef.current!);
    try { await api.post("/arena/queue/leave"); } catch {}
    setPhase("idle");
  }

  async function doAction(action: CombatAction) {
    if (!match || acting) return;
    setActing(true);
    setLastAction(action);
    const prevMatch = match;
    const sentTurn = match.currentTurn; // optimistic guard: reject stale responses
    try {
      const data = await api.post<{ match: Match }>(`/arena/match/${match.matchId}/action`, {
        action,
        expectedTurn: sentTurn, // server rejects if turn has already advanced
      });
      if (data.match.currentTurn <= sentTurn && data.match.status === "active") {
        // Server returned same turn — ignore (shouldn't happen, but guard against it)
        setActing(false);
        return;
      }
      triggerAnimFromTurn(data.match, prevMatch);
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        clearInterval(timerRef.current!);
        onUserUpdate();
      }
    } catch (err: any) {
      if ((err as any)?.status === 409) {
        // Turn already resolved by another submission — refresh state silently
        if (prevMatch) fetchMatch(prevMatch.matchId, prevMatch);
      } else {
        addToast(err.message ?? "Action failed", "error");
      }
    } finally {
      setActing(false);
    }
  }

  // ── Consumable availability ────────────────────────────────────────────────
  function hasConsumable(): boolean {
    if (!match) return false;
    const myLoadout = isP1 ? match.player1Loadout : match.player2Loadout;
    const used = isP1 ? (match.player1ConsumablesUsed ?? []) : (match.player2ConsumablesUsed ?? []);
    return !!(
      (myLoadout.consumable1 && !used.includes(myLoadout.consumable1)) ||
      (myLoadout.consumable2 && !used.includes(myLoadout.consumable2))
    );
  }

  const ACTION_DEFS: Array<{ action: CombatAction; label: string; icon: string; color: string; desc: string; disabled?: boolean }> = [
    { action: "attack",   label: "Attack",   icon: "⚔",  color: "#ef4444", desc: "Standard attack" },
    { action: "defend",   label: "Defend",   icon: "🛡",  color: "#3b82f6", desc: "-50% next hit" },
    { action: "use_item", label: "Use Item", icon: "💊",  color: "#22c55e", desc: "Heal HP", disabled: !hasConsumable() },
    { action: "reload",   label: "Reload",   icon: "🔄",  color: "#f59e0b", desc: "60% dmg + setup" },
    { action: "special",  label: "Special",  icon: "⚡",  color: "#a855f7", desc: "150% dmg" },
  ];

  // ── Render: Idle ───────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", paddingTop: 32 }}>
        <style>{COMBAT_CSS}</style>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>⚔️</div>
          <h1 style={{ fontFamily: "monospace", fontSize: 24, color: "#ff6b35", fontWeight: "bold", letterSpacing: 3, margin: 0 }}>COMBAT ARENA</h1>
          <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 6 }}>1v1 turn-based. Skill, loadout, and nerve.</p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Energy Cost", value: "10 ⚡" },
            { label: "Win Reward", value: "+150 DC" },
            { label: "Turn Timer", value: "15s ⏱" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: "bold", color: "#e2e8f0" }}>{s.value}</div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action guide */}
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 8 }}>AVAILABLE ACTIONS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { icon: "⚔", label: "Attack", desc: "Standard damage" },
              { icon: "🛡", label: "Defend", desc: "Halve next hit taken" },
              { icon: "💊", label: "Use Item", desc: "Heal with consumable" },
              { icon: "🔄", label: "Reload", desc: "Setup big next turn" },
              { icon: "⚡", label: "Special", desc: "150% damage burst" },
            ].map(a => (
              <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#e2e8f0" }}>{a.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Streak */}
        {user.combatWinStreak > 0 && (
          <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: "#f59e0b", marginBottom: 12 }}>
            🔥 Win streak: {user.combatWinStreak} (+{Math.min(user.combatWinStreak * 50, 300)} DC bonus)
          </div>
        )}

        {/* Energy warning */}
        {user.energy < 10 && (
          <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "#ef4444", marginBottom: 12 }}>
            ⚡ Not enough energy (need 10, have {user.energy})
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={joinQueue}
            disabled={user.energy < 10}
            style={{
              padding: "14px 36px", borderRadius: 10,
              fontFamily: "monospace", fontSize: 14, fontWeight: "bold", letterSpacing: 1,
              cursor: user.energy >= 10 ? "pointer" : "not-allowed",
              background: user.energy >= 10 ? "linear-gradient(135deg,#ff6b3525,#ff6b3510)" : "#0d0d1a",
              border: `1px solid ${user.energy >= 10 ? "#ff6b35" : "#1e293b"}`,
              color: user.energy >= 10 ? "#ff6b35" : "#374151",
              transition: "all 0.2s",
            }}
          >▶ FIND MATCH</button>
          <button
            onClick={() => onNavigate("arena")}
            style={{ padding: "14px 20px", borderRadius: 10, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}
          >← Loadout</button>
        </div>
      </div>
    );
  }

  // ── Render: Queuing ────────────────────────────────────────────────────────
  if (phase === "queuing") {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", paddingTop: 70 }}>
        <style>{COMBAT_CSS}</style>
        <div style={{ animation: "queuePulse 1.6s ease-in-out infinite" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, color: "#ff6b35", marginBottom: 6, letterSpacing: 2 }}>SEARCHING…</div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 32 }}>AI opponent fills in after 30 seconds</div>
        </div>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: "#ff6b35", margin: "0 4px",
            animation: `queuePulse 1.2s ease-in-out ${i * 0.25}s infinite`,
          }} />
        ))}
        <div style={{ marginTop: 32 }}>
          <button
            onClick={leaveQueue}
            style={{ padding: "10px 28px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #ef4444", color: "#ef4444" }}
          >✕ Cancel</button>
        </div>
      </div>
    );
  }

  // ── Render: Match Found announcement ──────────────────────────────────────
  if (phase === "found" && match) {
    const oppName = match.isPlayer2AI ? match.aiName : "Opponent";
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
        <style>{COMBAT_CSS}</style>
        <div style={{ animation: "foundSlide 0.4s ease" }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#22c55e", letterSpacing: 3, marginBottom: 8 }}>MATCH FOUND</div>
          <div style={{ background: "#0d0d1a", border: "1px solid #22c55e30", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>🥷</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#00d4ff", fontWeight: "bold" }}>{user.username}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>You</div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 20, color: "#ff6b35", fontWeight: "bold" }}>VS</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>🥷</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ff6b35", fontWeight: "bold" }}>{oppName}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>{match.isPlayer2AI ? "AI Opponent" : "Player"}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
              Starting in 2 seconds…
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Complete ───────────────────────────────────────────────────────
  if (phase === "complete" && match) {
    const won = match.winnerId === user.id;
    const draw = !match.winnerId;
    const streak = user.combatWinStreak;
    const streakBonus = won ? Math.min((streak) * 50, 300) : 0;

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 32 }}>
        <style>{COMBAT_CSS}</style>
        <div style={{ animation: "foundSlide 0.35s ease" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{draw ? "🤝" : won ? "🏆" : "💀"}</div>
          <h2 style={{
            fontFamily: "monospace", fontSize: 26, fontWeight: "bold", marginBottom: 4, letterSpacing: 3,
            color: draw ? "#f59e0b" : won ? "#22c55e" : "#ef4444",
          }}>{draw ? "DRAW" : won ? "VICTORY!" : "DEFEATED"}</h2>

          <div style={{ background: "#0d0d1a", border: `1px solid ${draw ? "#f59e0b30" : won ? "#22c55e30" : "#ef444430"}`, borderRadius: 12, padding: 20, marginBottom: 20, marginTop: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
              {draw ? "+80 DC, +100 XP" : won ? `+${150 + streakBonus} DC, +200 XP, +1 Key Shard` : "+40 DC, +60 XP"}
            </div>
            {won && streak > 0 && (
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b", animation: "streakPop 0.5s ease" }}>
                🔥 Win streak: {streak} · Streak bonus: +{streakBonus} DC
              </div>
            )}
          </div>

          {/* Turn log recap */}
          {match.turns.length > 0 && (
            <div style={{ background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 8, padding: 12, marginBottom: 20, maxHeight: 120, overflowY: "auto", textAlign: "left" }}>
              {match.turns.slice(-8).map((t, i) => (
                <div key={i} style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 3 }}>
                  <span style={{ color: "#334155" }}>T{t.turnNumber}:</span> {t.narrative}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => { setMatch(null); setPhase("idle"); setP1Anim("idle"); setP2Anim("idle"); }}
              style={{ padding: "12px 28px", borderRadius: 8, fontFamily: "monospace", fontSize: 13, cursor: "pointer", background: "#ff6b3518", border: "1px solid #ff6b3560", color: "#ff6b35", fontWeight: "bold" }}
            >↺ Play Again</button>
            <button
              onClick={() => onNavigate("arena")}
              style={{ padding: "12px 20px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}
            >← Loadout</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Active Match ───────────────────────────────────────────────────
  if (phase === "matched" && match) {
    const myHP    = isP1 ? match.player1HP : match.player2HP;
    const oppHP   = isP1 ? match.player2HP : match.player1HP;
    const myMax   = isP1 ? match.player1Loadout.hp : match.player2Loadout.hp;
    const oppMax  = isP1 ? match.player2Loadout.hp : match.player1Loadout.hp;
    const myArmorCur  = isP1 ? (match.player1CurrentArmorHp ?? match.player1Loadout.armorHp ?? 0) : (match.player2CurrentArmorHp ?? match.player2Loadout.armorHp ?? 0);
    const myArmorMax  = isP1 ? (match.player1Loadout.armorHp ?? 0) : (match.player2Loadout.armorHp ?? 0);
    const oppArmorCur = isP1 ? (match.player2CurrentArmorHp ?? match.player2Loadout.armorHp ?? 0) : (match.player1CurrentArmorHp ?? match.player1Loadout.armorHp ?? 0);
    const oppArmorMax = isP1 ? (match.player2Loadout.armorHp ?? 0) : (match.player1Loadout.armorHp ?? 0);
    const oppName = match.isPlayer2AI ? (match.aiName ?? "AI") : "Opponent";

    const leftAnim  = isP1 ? p1Anim : p2Anim;
    const rightAnim = isP1 ? p2Anim : p1Anim;

    const timerDanger = turnTimer <= 5;
    const timerPct = (turnTimer / 15) * 100;

    return (
      <div style={{
        maxWidth: 620, margin: "0 auto",
        animation: screenShake ? "arenaCritShake 0.45s ease" : undefined,
      }}>
        <style>{COMBAT_CSS}</style>

        {/* Floating damage numbers */}
        <div style={{ position: "relative", height: 0, overflow: "visible" }}>
          {floatDmgs.map(f => (
            <div key={f.id} style={{
              position: "absolute",
              left: f.side === "left" ? "20%" : "65%",
              top: -40,
              fontFamily: "monospace",
              fontSize: f.isCrit ? 22 : 16,
              fontWeight: "bold",
              color: f.isHeal ? "#22c55e" : f.isCrit ? "#fbbf24" : "#ef4444",
              textShadow: f.isCrit ? "0 0 12px #fbbf24" : undefined,
              animation: "floatUp 1.1s ease forwards",
              pointerEvents: "none",
              zIndex: 50,
            }}>
              {f.isHeal ? "+" : "-"}{f.value}{f.isCrit ? " CRIT!" : ""}
            </div>
          ))}
        </div>

        {/* Combatant panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginBottom: 16, alignItems: "start" }}>
          {/* My panel */}
          <div style={{ background: "#0d0d1a", border: "1px solid #00d4ff25", borderRadius: 10, padding: 14 }}>
            <CharacterBadge
              name={user.username}
              color="#00d4ff"
              isLeft={isP1}
              animState={isP1 ? p1Anim : p2Anim}
            />
            <div style={{ marginTop: 10 }}>
              <HPBar current={myHP} max={myMax} color="#00d4ff" />
              {myArmorMax > 0 && <ArmorBar current={myArmorCur} max={myArmorMax} />}
              <ActiveEffectBadges effects={isP1 ? (match.player1ActiveEffects ?? []) : (match.player2ActiveEffects ?? [])} />
              <div style={{ display: "flex", gap: 12, marginTop: 6, justifyContent: "center" }}>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>
                  ⚔ {isP1 ? match.player1Loadout.damage : match.player2Loadout.damage}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>
                  🛡 {isP1 ? match.player1Loadout.defense : match.player2Loadout.defense}
                </span>
              </div>
            </div>
          </div>

          {/* VS + timer */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 16 }}>
            <span style={{ fontFamily: "monospace", fontSize: 14, color: "#ff6b35", fontWeight: "bold" }}>VS</span>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: "bold", color: timerDanger ? "#ef4444" : "#f59e0b", minWidth: 36, textAlign: "center" }}>
              {turnTimer}
            </div>
            <div style={{ width: 4, height: 60, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "100%", background: timerDanger ? "#ef4444" : "#f59e0b", height: `${timerPct}%`, transition: "height 0.5s linear", marginTop: "auto" }} />
            </div>
          </div>

          {/* Opponent panel */}
          <div style={{ background: "#0d0d1a", border: "1px solid #ff6b3525", borderRadius: 10, padding: 14 }}>
            <CharacterBadge
              name={oppName}
              color="#ff6b35"
              isLeft={!isP1}
              animState={isP1 ? p2Anim : p1Anim}
            />
            <div style={{ marginTop: 10 }}>
              <HPBar current={oppHP} max={oppMax} color="#ff6b35" />
              {oppArmorMax > 0 && <ArmorBar current={oppArmorCur} max={oppArmorMax} />}
              <ActiveEffectBadges effects={isP1 ? (match.player2ActiveEffects ?? []) : (match.player1ActiveEffects ?? [])} />
              <div style={{ display: "flex", gap: 12, marginTop: 6, justifyContent: "center" }}>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>
                  ⚔ {isP1 ? match.player2Loadout.damage : match.player1Loadout.damage}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>
                  🛡 {isP1 ? match.player2Loadout.defense : match.player1Loadout.defense}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Turn info */}
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>Turn {match.currentTurn}</span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
            {match.isPlayer2AI ? "vs AI" : "vs Player"}
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: timerDanger ? "#ef4444" : "#475569" }}>
            {acting ? "…" : "Your turn"}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 12 }}>
          {ACTION_DEFS.map(({ action, label, icon, color, desc, disabled }) => {
            const isActive = lastAction === action && acting;
            const isOff = disabled || acting || match.status !== "active";
            return (
              <button
                key={action}
                onClick={() => doAction(action)}
                disabled={isOff}
                title={desc}
                style={{
                  padding: "10px 4px", borderRadius: 8,
                  fontFamily: "monospace", fontSize: 11,
                  cursor: isOff ? "not-allowed" : "pointer",
                  background: isActive ? `${color}25` : disabled ? "#080810" : "#0a0a14",
                  border: `1px solid ${isActive ? color : disabled ? "#1e293b30" : "#1e293b"}`,
                  color: isOff ? "#374151" : color,
                  transition: "all 0.15s",
                  opacity: disabled ? 0.35 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Turn log */}
        <div
          ref={logRef}
          style={{ background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 12px", height: 130, overflowY: "auto" }}
        >
          {match.turns.length === 0 ? (
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#374151" }}>Match started — choose your action.</div>
          ) : (
            match.turns.slice(-30).map((turn, i) => {
              const isCrit  = turn.player1Effect === "crit"  || turn.player2Effect === "crit";
              const isHeal  = turn.player1Effect === "heal"  || turn.player2Effect === "heal";
              const isStun  = turn.narrative.includes("stunned") || turn.narrative.includes("STUN") || turn.narrative.includes("SHOCK");
              const isBurn  = turn.narrative.includes("burn") || turn.narrative.includes("BURN");
              const isAuto  = turn.narrative.includes("[AUTO]");
              const color = isCrit ? "#fbbf24" : isHeal ? "#22c55e" : isStun ? "#a855f7" : isBurn ? "#f97316" : isAuto ? "#374151" : "#475569";
              return (
                <div key={i} style={{
                  fontFamily: "monospace", fontSize: 10,
                  color,
                  marginBottom: 4, padding: "2px 0",
                  borderBottom: "1px solid #1e293b20",
                }}>
                  <span style={{ color: "#334155" }}>T{turn.turnNumber}: </span>
                  {turn.narrative}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return null;
}
