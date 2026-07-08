import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUserUpdate: () => void;
  onNavigate: (page: string) => void;
}

type Phase = "idle" | "queuing" | "matched" | "complete";
type CombatAction = "attack" | "defend" | "use_item" | "reload" | "special";

interface LoadoutSnap { hp: number; damage: number; defense: number; accuracy: number; weapon: string | null; armor: string | null; }
interface TurnRecord { turnNumber: number; player1Action: string; player2Action: string; player1HpAfter: number; player2HpAfter: number; narrative: string; }
interface Match {
  matchId: string; status: string;
  player1Id: string; player2Id: string | null; isPlayer2AI: boolean; aiName: string | null;
  player1Loadout: LoadoutSnap; player2Loadout: LoadoutSnap;
  player1HP: number; player2HP: number;
  currentTurn: number; currentTurnDeadline: string;
  turns: TurnRecord[]; winnerId: string | null; rewardsGranted: boolean;
}

const ACTION_CONFIG: Record<CombatAction, { label: string; icon: string; color: string }> = {
  attack:   { label: "Attack",   icon: "⚔",  color: "#ef4444" },
  defend:   { label: "Defend",   icon: "🛡",  color: "#3b82f6" },
  use_item: { label: "Use Item", icon: "💊",  color: "#22c55e" },
  reload:   { label: "Reload",   icon: "🔄",  color: "#f59e0b" },
  special:  { label: "Special",  icon: "⚡",  color: "#a855f7" },
};

function HPBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? color : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>HP</span>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: barColor, fontWeight: "bold" }}>{current} / {max}</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ background: barColor, height: "100%", borderRadius: 4, width: `${pct}%`, transition: "width 0.5s ease-out", boxShadow: `0 0 6px ${barColor}60` }} />
      </div>
    </div>
  );
}

export default function ArenaCombatPage({ user, addToast, onUserUpdate, onNavigate }: Props) {
  const [phase, setPhase]   = useState<Phase>("idle");
  const [match, setMatch]   = useState<Match | null>(null);
  const [acting, setActing] = useState(false);
  const [turnTimer, setTurnTimer] = useState(15);
  const [lastAction, setLastAction] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const isP1 = match?.player1Id === user.id;

  const fetchMatch = useCallback(async (matchId: string) => {
    try {
      const data = await api.get<{ match: Match }>(`/arena/match/${matchId}`);
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        clearInterval(timerRef.current!);
        onUserUpdate();
      }
      return data.match;
    } catch { return null; }
  }, [onUserUpdate]);

  // Poll every 2s when in active match
  useEffect(() => {
    if (phase === "matched" && match?.matchId) {
      pollRef.current = setInterval(() => fetchMatch(match.matchId), 2_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, match?.matchId, fetchMatch]);

  // Turn timer
  useEffect(() => {
    if (phase !== "matched" || match?.status !== "active") return;
    const deadline = match.currentTurnDeadline ? new Date(match.currentTurnDeadline).getTime() : Date.now() + 15_000;
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
      setTurnTimer(secs);
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, match?.currentTurn, match?.currentTurnDeadline, match?.status]);

  // Scroll turn log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [match?.turns.length]);

  async function joinQueue() {
    setPhase("queuing");
    try {
      const data = await api.post<{ status: string; matchId?: string }>("/arena/queue/join");
      if (data.matchId) {
        const m = await fetchMatch(data.matchId);
        if (m) { setPhase("matched"); }
      } else {
        // Poll queue status
        const poll = setInterval(async () => {
          try {
            const status = await api.get<{ inQueue: boolean; activeMatch: { matchId: string } | null }>("/arena/queue/status");
            if (status.activeMatch) {
              clearInterval(poll);
              const m = await fetchMatch(status.activeMatch.matchId);
              if (m) setPhase("matched");
            }
            if (!status.inQueue && !status.activeMatch) {
              clearInterval(poll);
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
    try { await api.post("/arena/queue/leave"); } catch {}
    setPhase("idle");
  }

  async function doAction(action: CombatAction) {
    if (!match || acting) return;
    setActing(true);
    setLastAction(action);
    try {
      const data = await api.post<{ match: Match }>(`/arena/match/${match.matchId}/action`, { action });
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        clearInterval(timerRef.current!);
        onUserUpdate();
      }
    } catch (err: any) {
      addToast(err.message ?? "Action failed", "error");
    } finally {
      setActing(false);
    }
  }

  // ── Render phases ──────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
        <h1 style={{ fontFamily: "monospace", fontSize: 22, color: "#ff6b35", fontWeight: "bold", letterSpacing: 2, marginBottom: 8 }}>COMBAT ARENA</h1>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", marginBottom: 24 }}>1v1 turn-based combat. Skill, loadout, and luck.</p>
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 24, display: "flex", gap: 16, justifyContent: "center" }}>
          {[{ label: "Energy Cost", value: "10 ⚡" }, { label: "Win Reward", value: "+150 DC" }, { label: "Turn Timer", value: "15s" }].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: "#e2e8f0" }}>{s.value}</div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {user.energy < 10 ? (
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>⚡ Not enough energy (need 10)</div>
        ) : null}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={joinQueue}
            disabled={user.energy < 10}
            style={{
              padding: "14px 32px", borderRadius: 10, fontFamily: "monospace", fontSize: 14, fontWeight: "bold",
              cursor: user.energy >= 10 ? "pointer" : "not-allowed",
              background: user.energy >= 10 ? "linear-gradient(135deg, #ff6b3520, #ff6b3510)" : "#1a1a2e",
              border: `1px solid ${user.energy >= 10 ? "#ff6b35" : "#1e293b"}`,
              color: user.energy >= 10 ? "#ff6b35" : "#374151", letterSpacing: 1,
            }}
          >
            ▶ FIND MATCH
          </button>
          <button onClick={() => onNavigate("arena")} style={{ padding: "14px 20px", borderRadius: 10, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}>
            ← Loadout
          </button>
        </div>
      </div>
    );
  }

  if (phase === "queuing") {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontFamily: "monospace", fontSize: 16, color: "#ff6b35", marginBottom: 8, animation: "pulse 1.5s infinite" }}>
          ◈ Searching for opponent...
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 32 }}>AI fill after 30 seconds</div>
        <button onClick={leaveQueue} style={{ padding: "10px 24px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #ef4444", color: "#ef4444" }}>
          Cancel
        </button>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  }

  if (phase === "complete" && match) {
    const won = match.winnerId === user.id;
    const draw = !match.winnerId;
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{draw ? "🤝" : won ? "🏆" : "💀"}</div>
        <h2 style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "bold", marginBottom: 8, color: draw ? "#f59e0b" : won ? "#22c55e" : "#ef4444" }}>
          {draw ? "DRAW" : won ? "VICTORY!" : "DEFEATED"}
        </h2>
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8" }}>
            {draw ? "+80 DC, +100 XP" : won ? "+150 DC, +200 XP, +1 Key Shard" : "+40 DC, +60 XP"}
          </div>
          {won && <div style={{ fontFamily: "monospace", fontSize: 11, color: "#22c55e", marginTop: 4 }}>
            Win streak: {(user as any).combatWinStreak ?? "—"} 🔥
          </div>}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => { setMatch(null); setPhase("idle"); }} style={{ padding: "12px 24px", borderRadius: 8, fontFamily: "monospace", fontSize: 13, cursor: "pointer", background: "#ff6b3518", border: "1px solid #ff6b3560", color: "#ff6b35" }}>
            ↺ Play Again
          </button>
          <button onClick={() => onNavigate("arena")} style={{ padding: "12px 20px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}>
            ← Loadout
          </button>
        </div>
      </div>
    );
  }

  if (phase === "matched" && match) {
    const myHP     = isP1 ? match.player1HP : match.player2HP;
    const oppHP    = isP1 ? match.player2HP : match.player1HP;
    const myMax    = isP1 ? match.player1Loadout.hp : match.player2Loadout.hp;
    const oppMax   = isP1 ? match.player2Loadout.hp : match.player1Loadout.hp;
    const oppName  = match.isPlayer2AI ? match.aiName : "Opponent";

    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Combatants */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, marginBottom: 20, alignItems: "center" }}>
          <div style={{ background: "#0d0d1a", border: "1px solid #00d4ff30", borderRadius: 10, padding: 12 }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#00d4ff", marginBottom: 8 }}>{user.username}</div>
            <HPBar current={myHP} max={myMax} color="#00d4ff" />
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginTop: 6 }}>
              DMG: {isP1 ? match.player1Loadout.damage : match.player2Loadout.damage} · DEF: {isP1 ? match.player1Loadout.defense : match.player2Loadout.defense}
            </div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 18, color: "#ff6b35", textAlign: "center" }}>VS</div>
          <div style={{ background: "#0d0d1a", border: "1px solid #ff6b3530", borderRadius: 10, padding: 12 }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: "bold", color: "#ff6b35", marginBottom: 8 }}>{oppName}</div>
            <HPBar current={oppHP} max={oppMax} color="#ff6b35" />
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginTop: 6 }}>
              DMG: {isP1 ? match.player2Loadout.damage : match.player1Loadout.damage} · DEF: {isP1 ? match.player2Loadout.defense : match.player1Loadout.defense}
            </div>
          </div>
        </div>

        {/* Turn info */}
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>Turn {match.currentTurn}</span>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: turnTimer <= 5 ? "#ef4444" : "#f59e0b" }}>
            ⏱ {turnTimer}s
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {(Object.entries(ACTION_CONFIG) as [CombatAction, typeof ACTION_CONFIG[CombatAction]][]).map(([act, cfg]) => (
            <button
              key={act}
              onClick={() => doAction(act)}
              disabled={acting || match.status !== "active"}
              style={{
                padding: "12px 8px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: acting ? "not-allowed" : "pointer",
                background: lastAction === act ? `${cfg.color}20` : "#0a0a14",
                border: `1px solid ${lastAction === act ? cfg.color : "#1e293b"}`,
                color: acting ? "#374151" : cfg.color,
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 2 }}>{cfg.icon}</div>
              <div>{cfg.label}</div>
            </button>
          ))}
        </div>

        {/* Turn log */}
        <div ref={logRef} style={{ background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 8, padding: 12, height: 140, overflowY: "auto" }}>
          {match.turns.length === 0 ? (
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#374151" }}>Match started — make your move!</div>
          ) : (
            match.turns.slice(-20).map((turn, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", marginBottom: 4, padding: "3px 0", borderBottom: "1px solid #1e293b30" }}>
                <span style={{ color: "#475569" }}>T{turn.turnNumber}:</span> {turn.narrative}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}
