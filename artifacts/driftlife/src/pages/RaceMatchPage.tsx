import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUserUpdate: () => void;
  onNavigate: (page: string) => void;
}

type Phase = "idle" | "queuing" | "racing" | "complete";
type RaceMode = "2player" | "4player";

interface CarSnap { carId: string; topSpeed: number; accel: number; handling: number; nitro: number; }
interface RacePlayer {
  userId: string | null; isAI: boolean; aiName: string | null;
  placement: number | null; finishTime: number | null; distancePct: number;
  nitroUsed: number; carSnapshot: CarSnap;
}
interface RaceMatch {
  matchId: string; mode: RaceMode; status: string;
  players: RacePlayer[]; startedAt: string | null;
  trackSeed: number; rewardsGranted: boolean;
}

export default function RaceMatchPage({ user, addToast, onUserUpdate, onNavigate }: Props) {
  const [phase, setPhase]   = useState<Phase>("idle");
  const [mode, setMode]     = useState<RaceMode>("2player");
  const [match, setMatch]   = useState<RaceMatch | null>(null);
  const [shifting, setShifting] = useState(false);
  const [nitroUsed, setNitroUsed] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef   = useRef<number | null>(null);
  const frameRef  = useRef(0);

  const myPlayer = match?.players.find(p => p.userId === user.id);
  const myProgress = myPlayer?.distancePct ?? 0;
  const maxNitro = 3;

  const fetchMatch = useCallback(async (matchId: string) => {
    try {
      const data = await api.get<{ match: RaceMatch }>(`/race/match/${matchId}`);
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        cancelAnimationFrame(animRef.current!);
        onUserUpdate();
      }
      return data.match;
    } catch { return null; }
  }, [onUserUpdate]);

  // Pseudo-3D road renderer
  useEffect(() => {
    if (phase !== "racing" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const seed = match?.trackSeed ?? 0;

    function draw(frame: number) {
      ctx!.clearRect(0, 0, W, H);

      // Sky
      const sky = ctx!.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, "#05050f");
      sky.addColorStop(1, "#0d0d2a");
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, W, H * 0.5);

      // Road segments (pseudo-3D)
      const HORIZON = H * 0.42;
      const ROAD_W_FAR  = W * 0.05;
      const ROAD_W_NEAR = W * 0.7;
      const segments = 80;

      for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const y0 = HORIZON + (H - HORIZON) * Math.pow(t0, 1.5);
        const y1 = HORIZON + (H - HORIZON) * Math.pow(t1, 1.5);
        const w0 = ROAD_W_FAR + (ROAD_W_NEAR - ROAD_W_FAR) * Math.pow(t0, 1.5);
        const w1 = ROAD_W_FAR + (ROAD_W_NEAR - ROAD_W_FAR) * Math.pow(t1, 1.5);
        const x0 = (W - w0) / 2;
        const x1 = (W - w1) / 2;

        // Alternating road stripes
        const stripe = Math.floor((i + Math.floor(frame / 2)) / 3) % 2;
        ctx!.fillStyle = stripe ? "#1a1a3a" : "#141428";
        ctx!.beginPath();
        ctx!.moveTo(x0, y0); ctx!.lineTo(x0 + w0, y0);
        ctx!.lineTo(x1 + w1, y1); ctx!.lineTo(x1, y1);
        ctx!.fill();

        // Road markings
        if (i % 6 < 3) {
          const markX = W / 2;
          const markW = 6;
          ctx!.fillStyle = "#ffff0080";
          ctx!.fillRect(markX - markW / 2, y0, markW, y1 - y0);
        }

        // Neon edge lines
        ctx!.strokeStyle = "#00d4ff60";
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(x0, y0); ctx!.lineTo(x1, y1);
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.moveTo(x0 + w0, y0); ctx!.lineTo(x1 + w1, y1);
        ctx!.stroke();
      }

      // Player car
      const carY = H * 0.7;
      const carX = W / 2;
      const bobY = Math.sin(frame * 0.3) * 2;

      ctx!.fillStyle = "#00d4ff";
      ctx!.beginPath();
      ctx!.roundRect(carX - 20, carY - 12 + bobY, 40, 24, 4);
      ctx!.fill();
      ctx!.fillStyle = "#0a0a1a";
      ctx!.fillRect(carX - 14, carY - 10 + bobY, 12, 14);
      ctx!.fillRect(carX + 2,  carY - 10 + bobY, 12, 14);
      // Wheels
      ctx!.fillStyle = "#1e293b";
      ctx!.fillRect(carX - 22, carY + 6 + bobY, 10, 8);
      ctx!.fillRect(carX + 12, carY + 6 + bobY, 10, 8);

      // Nitro flame
      if (nitroUsed > 0 && frame % 4 < 2) {
        ctx!.fillStyle = "#ff6b35";
        ctx!.beginPath();
        ctx!.moveTo(carX - 8, carY + 12 + bobY);
        ctx!.lineTo(carX + 8, carY + 12 + bobY);
        ctx!.lineTo(carX, carY + 28 + bobY);
        ctx!.fill();
      }

      // Buildings on horizon
      for (let b = 0; b < 8; b++) {
        const bx = ((b * 137 + seed) % W) - 30;
        const bh = 30 + ((b * 73 + seed) % 50);
        ctx!.fillStyle = "#0d0d2a";
        ctx!.fillRect(bx, HORIZON - bh, 25, bh);
        // Neon window dots
        ctx!.fillStyle = "#00d4ff40";
        for (let wy = 0; wy < bh; wy += 8) {
          ctx!.fillRect(bx + 5, HORIZON - bh + wy + 2, 5, 4);
          ctx!.fillRect(bx + 14, HORIZON - bh + wy + 2, 5, 4);
        }
      }

      frameRef.current = frame;
      animRef.current = requestAnimationFrame(() => draw(frame + 1));
    }

    animRef.current = requestAnimationFrame(() => draw(frameRef.current));
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, match?.trackSeed, nitroUsed]);

  // Poll match state
  useEffect(() => {
    if (phase === "racing" && match?.matchId) {
      pollRef.current = setInterval(() => fetchMatch(match.matchId), 2_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, match?.matchId, fetchMatch]);

  async function joinQueue() {
    setPhase("queuing");
    setQueueSize(1);
    try {
      const data = await api.post<{ status: string; matchId?: string; queueSize: number }>("/race/queue/join", { mode });
      setQueueSize(data.queueSize ?? 1);
      if (data.matchId) {
        const m = await fetchMatch(data.matchId);
        if (m) { setPhase("racing"); }
      } else {
        const poll = setInterval(async () => {
          try {
            const s = await api.get<{ inQueue: boolean; queueSize: number; activeMatch: { matchId: string } | null }>("/race/queue/status");
            setQueueSize(s.queueSize ?? 0);
            if (s.activeMatch) {
              clearInterval(poll);
              const m = await fetchMatch(s.activeMatch.matchId);
              if (m) setPhase("racing");
            }
            if (!s.inQueue && !s.activeMatch) { clearInterval(poll); setPhase("idle"); }
          } catch {}
        }, 2_000);
      }
    } catch (err: any) {
      addToast(err.message ?? "Failed to join queue", "error");
      setPhase("idle");
    }
  }

  async function doShift(hit: boolean) {
    if (!match || shifting) return;
    setShifting(true);
    try {
      const data = await api.post<{ match: RaceMatch }>(`/race/match/${match.matchId}/shift`, { hit });
      setMatch(data.match);
      if (data.match.status === "complete") {
        setPhase("complete");
        clearInterval(pollRef.current!);
        onUserUpdate();
      }
    } catch (err: any) {
      addToast(err.message ?? "Shift failed", "error");
    } finally {
      setShifting(false);
    }
  }

  async function doNitro() {
    if (!match || nitroUsed >= maxNitro) return;
    try {
      const data = await api.post<{ match: RaceMatch }>(`/race/match/${match.matchId}/nitro`);
      setMatch(data.match);
      setNitroUsed(prev => prev + 1);
      if (data.match.status === "complete") { setPhase("complete"); clearInterval(pollRef.current!); onUserUpdate(); }
    } catch (err: any) {
      addToast(err.message ?? "Nitro failed", "error");
    }
  }

  // ── Phases ────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏎️</div>
        <h1 style={{ fontFamily: "monospace", fontSize: 22, color: "#a855f7", fontWeight: "bold", letterSpacing: 2, marginBottom: 8 }}>RACE</h1>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", marginBottom: 24 }}>Parallel solo racing. Hit green zones to shift, use nitro to boost.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {(["2player","4player"] as RaceMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, maxWidth: 160, padding: "12px 8px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: mode === m ? "#a855f718" : "#0a0a14", border: `1px solid ${mode === m ? "#a855f7" : "#1e293b"}`, color: mode === m ? "#a855f7" : "#475569" }}>
              {m === "2player" ? "👥 2-Player\n15 energy" : "👥👥 4-Player\n25 energy"}
            </button>
          ))}
        </div>
        {user.energy < (mode === "2player" ? 15 : 25) ? (
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>⚡ Not enough energy</div>
        ) : null}
        <button
          onClick={joinQueue}
          disabled={user.energy < (mode === "2player" ? 15 : 25)}
          style={{ padding: "14px 32px", borderRadius: 10, fontFamily: "monospace", fontSize: 14, fontWeight: "bold", cursor: "pointer", background: "linear-gradient(135deg, #a855f720, #a855f710)", border: "1px solid #a855f760", color: "#a855f7", letterSpacing: 1 }}
        >
          ▶ START RACE
        </button>
      </div>
    );
  }

  if (phase === "queuing") {
    const needed = mode === "2player" ? 2 : 4;
    return (
      <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontFamily: "monospace", fontSize: 16, color: "#a855f7", marginBottom: 8 }}>
          {queueSize}/{needed} racers ready...
        </div>
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, height: 12, margin: "16px auto", maxWidth: 200 }}>
          <div style={{ background: "#a855f7", height: "100%", borderRadius: 8, width: `${(queueSize / needed) * 100}%`, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 24 }}>AI fill after 30 seconds</div>
        <button onClick={async () => { try { await api.post("/race/queue/leave"); } catch {} setPhase("idle"); }} style={{ padding: "10px 24px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #ef4444", color: "#ef4444" }}>Cancel</button>
      </div>
    );
  }

  if (phase === "complete" && match) {
    const myP = match.players.find(p => p.userId === user.id);
    const placement = myP?.placement ?? 4;
    const won = placement === 1;
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{won ? "🏆" : placement === 2 ? "🥈" : placement === 3 ? "🥉" : "😤"}</div>
        <h2 style={{ fontFamily: "monospace", fontSize: 24, fontWeight: "bold", marginBottom: 8, color: won ? "#22c55e" : "#a855f7" }}>
          {won ? "1ST PLACE!" : `${placement}${placement === 2 ? "nd" : placement === 3 ? "rd" : "th"} PLACE`}
        </h2>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
          {placement === 1 ? "+300 DC, +300 XP, +1 Key Shard" : placement === 2 ? "+150 DC, +180 XP" : placement === 3 ? "+80 DC, +100 XP" : "+40 DC, +60 XP"}
        </div>
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 24 }}>
          {match.players.sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99)).map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 12, padding: "6px 0", borderBottom: i < match.players.length - 1 ? "1px solid #1e293b" : "none", color: p.userId === user.id ? "#00d4ff" : "#475569" }}>
              <span>#{p.placement ?? "—"} {p.isAI ? p.aiName : p.userId === user.id ? user.username : "Player"}</span>
              <span>{p.finishTime ? `${(p.finishTime / 1000).toFixed(2)}s` : "DNF"}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => { setMatch(null); setPhase("idle"); setNitroUsed(0); }} style={{ padding: "12px 24px", borderRadius: 8, fontFamily: "monospace", fontSize: 13, cursor: "pointer", background: "#a855f718", border: "1px solid #a855f760", color: "#a855f7" }}>↺ Race Again</button>
          <button onClick={() => onNavigate("mini-garage")} style={{ padding: "12px 20px", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}>← Garage</button>
        </div>
      </div>
    );
  }

  // Racing view
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Canvas */}
      <canvas ref={canvasRef} width={560} height={280} style={{ width: "100%", borderRadius: 12, border: "1px solid #1e293b", display: "block", marginBottom: 12 }} />

      {/* Progress */}
      <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>Progress</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#00d4ff", fontWeight: "bold" }}>{myProgress.toFixed(1)}%</span>
        </div>
        <div style={{ background: "#1e293b", borderRadius: 4, height: 8 }}>
          <div style={{ background: "linear-gradient(90deg, #a855f7, #00d4ff)", height: "100%", borderRadius: 4, width: `${myProgress}%`, transition: "width 0.3s", boxShadow: "0 0 8px #a855f760" }} />
        </div>
      </div>

      {/* Live positions */}
      {match && (
        <div style={{ background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          {[...match.players].sort((a, b) => b.distancePct - a.distancePct).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", width: 16 }}>#{i + 1}</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: p.userId === user.id ? "#00d4ff" : "#64748b", flex: 1 }}>
                {p.isAI ? p.aiName : p.userId === user.id ? user.username : "Player"}
              </span>
              <div style={{ width: 80, background: "#1e293b", borderRadius: 3, height: 5 }}>
                <div style={{ background: p.userId === user.id ? "#00d4ff" : "#475569", height: "100%", borderRadius: 3, width: `${p.distancePct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shift panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8, marginBottom: 8 }}>
        <button onClick={() => doShift(false)} disabled={shifting} style={{ padding: "14px 0", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: "pointer", background: "#0a0a14", border: "1px solid #1e293b", color: "#475569" }}>Miss</button>
        <button
          onClick={() => doShift(true)}
          disabled={shifting}
          style={{ padding: "14px 0", borderRadius: 8, fontFamily: "monospace", fontSize: 14, fontWeight: "bold", cursor: "pointer", background: "linear-gradient(135deg, #22c55e20, #22c55e10)", border: "2px solid #22c55e", color: "#22c55e", boxShadow: "0 0 16px #22c55e40", letterSpacing: 2 }}
        >
          {shifting ? "..." : "⚙ SHIFT"}
        </button>
        <button onClick={doNitro} disabled={nitroUsed >= maxNitro} style={{ padding: "14px 0", borderRadius: 8, fontFamily: "monospace", fontSize: 12, cursor: nitroUsed < maxNitro ? "pointer" : "not-allowed", background: nitroUsed < maxNitro ? "#ff6b3518" : "#0a0a14", border: `1px solid ${nitroUsed < maxNitro ? "#ff6b35" : "#1e293b"}`, color: nitroUsed < maxNitro ? "#ff6b35" : "#374151" }}>
          🔥 {maxNitro - nitroUsed}
        </button>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#374151", textAlign: "center" }}>Press SHIFT to hit green zone</div>
    </div>
  );
}
