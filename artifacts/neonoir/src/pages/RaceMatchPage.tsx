import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../shared/api";
import { User } from "../shared/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onUserUpdate: () => void;
  onNavigate: (page: string) => void;
}

interface RacePlayer {
  userId: string | null; isAI: boolean; aiName: string | null;
  placement: number | null; finishTime: number | null;
  distancePct: number; nitroUsed: number; crashCount: number; hitCount?: number;
  carSnapshot: {
    carId: string; topSpeed: number; accel: number; handling: number; nitro: number;
    paint?: string | null; underglow?: string | null;
  };
}
interface RaceMatch {
  matchId: string; mode: "2player" | "4player"; status: string;
  players: RacePlayer[]; trackSeed: number;
  startedAt: string | null; finishedAt: string | null; rewardsGranted: boolean;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; }

// Pre-generated building layout (deterministic, no random in render loop)
const BUILDINGS_LEFT = [
  { x: 0,   w: 38, h: 75, color: "#a855f7" },
  { x: 44,  w: 52, h: 95, color: "#00d4ff" },
  { x: 102, w: 30, h: 58, color: "#f59e0b" },
  { x: 138, w: 44, h: 82, color: "#22c55e" },
];
const BUILDINGS_RIGHT = [
  { rx: 0,  w: 45, h: 88, color: "#00d4ff" },
  { rx: 51, w: 58, h: 110, color: "#a855f7" },
  { rx: 115, w: 35, h: 65, color: "#f59e0b" },
  { rx: 156, w: 42, h: 78, color: "#ff6b35" },
];
// Pre-generate window grids to avoid flickering random in render
type WindowGrid = { wx: number; wy: number; lit: boolean }[];
function makeWindowGrid(bw: number, bh: number, seed: number): WindowGrid {
  const grid: WindowGrid = [];
  let r = seed;
  const rng = () => { r = (r * 1664525 + 1013904223) & 0xffffffff; return (r >>> 0) / 0xffffffff; };
  for (let wy = 8; wy < bh - 10; wy += 12) {
    for (let wx = 5; wx < bw - 5; wx += 9) {
      grid.push({ wx, wy, lit: rng() > 0.35 });
    }
  }
  return grid;
}
const BLDG_L_WINDOWS = BUILDINGS_LEFT.map((b, i) => makeWindowGrid(b.w, b.h, i * 12345));
const BLDG_R_WINDOWS = BUILDINGS_RIGHT.map((b, i) => makeWindowGrid(b.w, b.h, i * 98765));

const PLACEMENT_COLORS: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309", 4: "#475569" };
const PLACEMENT_LABELS: Record<number, string> = { 1: "🥇 1ST PLACE", 2: "🥈 2ND PLACE", 3: "🥉 3RD PLACE", 4: "4TH PLACE" };

// ── Speedometer dial geometry (shared by the animation loop + static JSX) ─────
// 270° sweep from lower-left, up through the top, to lower-right — same
// convention as a real analog speedometer.
const GAUGE_SIZE = 190;
const GAUGE_CX = GAUGE_SIZE / 2;
const GAUGE_CY = GAUGE_SIZE / 2;
const GAUGE_R = 82;
const GAUGE_START = Math.PI * 0.75;
const GAUGE_END = Math.PI * 2.25;
const GAUGE_ARC = GAUGE_END - GAUGE_START;
const GAUGE_NEEDLE_LEN = GAUGE_R - 20;
const GAUGE_DOT_R = GAUGE_R - 6;
// Fixed shift-zone wedge — matches the server's default 35%–65% hit window
const SHIFT_ZONE_LO = 0.35, SHIFT_ZONE_HI = 0.65;

function polar(angle: number, r: number) {
  return { x: GAUGE_CX + Math.cos(angle) * r, y: GAUGE_CY + Math.sin(angle) * r };
}
function arcPath(r: number, t0: number, t1: number): string {
  const a0 = GAUGE_START + t0 * GAUGE_ARC, a1 = GAUGE_START + t1 * GAUGE_ARC;
  const p0 = polar(a0, r), p1 = polar(a1, r);
  const largeArc = (a1 - a0) > Math.PI ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}
// Major speed ticks (0, 20, 40 … 140) with numbers, plus minor unlabeled ticks
const GAUGE_MAJOR_TICKS = Array.from({ length: 8 }, (_, i) => {
  const t = i / 7;
  const angle = GAUGE_START + t * GAUGE_ARC;
  const outer = polar(angle, GAUGE_R);
  const inner = polar(angle, GAUGE_R - 10);
  const label = polar(angle, GAUGE_R - 22);
  return { t, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, lx: label.x, ly: label.y, value: i * 20 };
});
const GAUGE_MINOR_TICKS = Array.from({ length: 29 }, (_, i) => {
  const t = i / 28;
  const angle = GAUGE_START + t * GAUGE_ARC;
  const outer = polar(angle, GAUGE_R);
  const inner = polar(angle, GAUGE_R - 5);
  return { t, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
});

const RACE_CSS = `
@keyframes nitroFlare { 0%{opacity:1;transform:scaleX(1)} 100%{opacity:0;transform:scaleX(1.4)} }
@keyframes shiftHit  { 0%{background:#22c55e40} 50%{background:#22c55e60} 100%{background:transparent} }
@keyframes shiftMiss { 0%{background:#ef444430} 50%{background:#ef444450} 100%{background:transparent} }
@keyframes placeBanner { 0%{opacity:0;transform:scale(0.6)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
@keyframes carBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
@keyframes burnout { 0%,100%{transform:rotate(-1deg)} 50%{transform:rotate(1deg)} }
@keyframes arrowUp { 0%{opacity:0;transform:translate(-50%,4px)} 30%{opacity:1;transform:translate(-50%,-2px)} 100%{opacity:0;transform:translate(-50%,-10px)} }
@keyframes arrowDown { 0%{opacity:0;transform:translate(-50%,-4px)} 30%{opacity:1;transform:translate(-50%,2px)} 100%{opacity:0;transform:translate(-50%,10px)} }
`;

// ── Canvas renderer ───────────────────────────────────────────────────────────
function renderFrame(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  scrollOffset: number,
  match: RaceMatch | null,
  userId: string,
  nitroActive: boolean,
  animTime: number,    // accumulated ms — drives wheel spin + body bob
  crashAlpha: number,  // 0–1 red flash on crash
  swerveOffset: number, // lateral crash offset (px)
  sparks: Spark[],     // crash spark particles
  carImage: HTMLImageElement | null, // player's actual customized car art, once loaded
  paintColor: string,      // player's paint color (hex)
  underglowColor: string,  // player's underglow color (hex)
) {
  ctx.clearRect(0, 0, W, H);
  const horizonY = H * 0.38;
  const vpX = W / 2;

  // Sky
  const skyG = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyG.addColorStop(0, "#030308");
  skyG.addColorStop(1, "#0d0520");
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, W, horizonY);

  // Horizon glow
  const hGlow = ctx.createLinearGradient(0, horizonY - 24, 0, horizonY);
  hGlow.addColorStop(0, "rgba(0,212,255,0)");
  hGlow.addColorStop(1, "rgba(0,212,255,0.12)");
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, horizonY - 24, W, 24);

  // Buildings left
  for (let bi = 0; bi < BUILDINGS_LEFT.length; bi++) {
    const b = BUILDINGS_LEFT[bi];
    const by = horizonY - b.h;
    ctx.fillStyle = "#07070f";
    ctx.fillRect(b.x, by, b.w, b.h);
    ctx.strokeStyle = b.color + "50";
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, by, b.w, b.h);
    const wins = BLDG_L_WINDOWS[bi];
    for (const w of wins) {
      if (w.lit) {
        ctx.fillStyle = b.color + "35";
        ctx.fillRect(b.x + w.wx, by + w.wy, 5, 6);
      }
    }
  }

  // Buildings right
  for (let bi = 0; bi < BUILDINGS_RIGHT.length; bi++) {
    const b = BUILDINGS_RIGHT[bi];
    const bx = W - b.rx - b.w;
    const by = horizonY - b.h;
    ctx.fillStyle = "#07070f";
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.strokeStyle = b.color + "50";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, b.w, b.h);
    const wins = BLDG_R_WINDOWS[bi];
    for (const w of wins) {
      if (w.lit) {
        ctx.fillStyle = b.color + "35";
        ctx.fillRect(bx + w.wx, by + w.wy, 5, 6);
      }
    }
  }

  // Road surface
  const rBotL = W * 0.06, rBotR = W * 0.94;
  const rTopL = vpX - 14, rTopR = vpX + 14;

  ctx.beginPath();
  ctx.moveTo(rTopL, horizonY); ctx.lineTo(rTopR, horizonY);
  ctx.lineTo(rBotR, H); ctx.lineTo(rBotL, H);
  ctx.closePath();
  ctx.fillStyle = "#1a1a2e";
  ctx.fill();

  // Perspective road stripes
  const SEG = 10;
  const off = scrollOffset % 1;
  for (let i = 0; i < SEG; i++) {
    if (i % 2 === 0) continue;
    const t1 = ((i + off) % SEG) / SEG;
    const t2 = ((i + 1 + off) % SEG) / SEG;
    if (t2 < t1) continue;
    const p1 = t1 * t1;
    const p2 = t2 * t2;
    const y1 = horizonY + (H - horizonY) * (1 - p1);
    const y2 = horizonY + (H - horizonY) * (1 - p2);
    const xl1 = rTopL + (rBotL - rTopL) * (1 - p1);
    const xr1 = rTopR + (rBotR - rTopR) * (1 - p1);
    const xl2 = rTopL + (rBotL - rTopL) * (1 - p2);
    const xr2 = rTopR + (rBotR - rTopR) * (1 - p2);
    ctx.beginPath();
    ctx.moveTo(xl2, y2); ctx.lineTo(xr2, y2);
    ctx.lineTo(xr1, y1); ctx.lineTo(xl1, y1);
    ctx.closePath();
    ctx.fillStyle = "#12122a";
    ctx.fill();
  }

  // Edge lines
  ctx.strokeStyle = "#f59e0b80";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rTopL, horizonY); ctx.lineTo(rBotL, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rTopR, horizonY); ctx.lineTo(rBotR, H); ctx.stroke();

  // Center dashes
  const DASHES = 7;
  for (let i = 0; i < DASHES; i++) {
    const t = ((i + scrollOffset * 0.7) % DASHES) / DASHES;
    const persp = Math.pow(t, 1.8);
    const cy = horizonY + (H - horizonY) * (1 - persp);
    const dashH = (1 - persp) * 18 + 2;
    const dashW = (1 - persp) * 3 + 1;
    const alpha = Math.min(1, (1 - persp) * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
    ctx.fillRect(vpX - dashW / 2, cy - dashH / 2, dashW, dashH);
  }

  // Each racer runs their own parallel lane — no other racers or obstacles are
  // rendered on the road, only the player's own car (see the position bar in
  // the HUD for live standings against everyone else).

  // Nitro trail
  if (nitroActive) {
    const grad = ctx.createLinearGradient(vpX - 22, H - 28, vpX - 60, H - 20);
    grad.addColorStop(0, "#ff6b35cc");
    grad.addColorStop(0.4, "#f59e0b80");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(vpX - 22, H - 28);
    ctx.lineTo(vpX - 22, H - 18);
    ctx.lineTo(vpX - 65, H - 23);
    ctx.closePath();
    ctx.fill();
  }

  // Player car (bottom-center) — body bobbing based on animTime, rendered with
  // the player's actual car art + their garage paint/underglow customization.
  const bobY = Math.sin(animTime * 0.006) * 2;
  drawCar(ctx, vpX + swerveOffset, H - 24 + bobY, 52, 30, paintColor, true, animTime, carImage, underglowColor);

  // ── Crash flash overlay ────────────────────────────────────────────────────
  if (crashAlpha > 0) {
    ctx.fillStyle = `rgba(239,68,68,${Math.min(0.45, crashAlpha * 0.45)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Crash spark particles ──────────────────────────────────────────────────
  if (sparks.length > 0) {
    ctx.save();
    for (const spark of sparks) {
      ctx.globalAlpha = Math.min(1, spark.life);
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 1.5 + spark.life * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = spark.color;
      ctx.shadowColor = spark.color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.restore();
  }

  // Speed is now shown on the big interactive speedometer dial in the HUD below
  // the canvas, not as a decorative gauge here.
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  color: string,
  isPlayer: boolean,
  animTime = 0,
  carImage: HTMLImageElement | null = null,
  underglowColor?: string,
) {
  const hw = w / 2, hh = h / 2;

  // ── Real car art path (player only, once their garage image has loaded) ────
  if (isPlayer && carImage && carImage.complete && carImage.naturalWidth > 0) {
    const glow = underglowColor || color;
    // Underglow — a soft colored pool beneath the car, from the player's garage customization
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy + hh * 0.75, hw * 1.05, hh * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();

    // Fit the actual car image (its own art/paint baked in) into the bounding box,
    // preserving aspect ratio, anchored so the wheels sit near cy.
    const ratio = carImage.naturalWidth / carImage.naturalHeight;
    let drawW = w * 1.6, drawH = drawW / ratio;
    if (drawH > h * 2.2) { drawH = h * 2.2; drawW = drawH * ratio; }
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.drawImage(carImage, cx - drawW / 2, cy - drawH * 0.68, drawW, drawH);
    ctx.restore();
    return;
  }

  // ── Fallback schematic car (used until the image loads, or for traffic) ────
  // Body
  ctx.fillStyle = isPlayer ? "#0d1a2e" : "#0a0a14";
  ctx.beginPath();
  ctx.roundRect(cx - hw, cy - hh, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = isPlayer ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(cx - hw, cy - hh, w, h, 4);
  ctx.stroke();
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = isPlayer ? 8 : 4;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Windshield
  ctx.fillStyle = color + "50";
  ctx.fillRect(cx - hw * 0.45, cy - hh * 0.55, hw * 0.9, hh * 0.7);
  // Wheels (spinning for player car)
  const wheelR = w * 0.12;
  ctx.fillStyle = "#0a0a14";
  ctx.strokeStyle = color + "80";
  ctx.lineWidth = 1;
  const wheelPositions: [number, number][] = [[-hw * 0.6, -hh * 0.8], [hw * 0.6, -hh * 0.8], [-hw * 0.6, hh * 0.6], [hw * 0.6, hh * 0.6]];
  wheelPositions.forEach(([wx, wy]) => {
    ctx.beginPath();
    ctx.arc(cx + wx, cy + wy, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isPlayer && animTime > 0) {
      // Spinning spoke to show wheel rotation
      const angle = (animTime * 0.015) % (Math.PI * 2);
      ctx.save();
      ctx.translate(cx + wx, cy + wy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -wheelR * 0.75);
      ctx.lineTo(0, wheelR * 0.75);
      ctx.strokeStyle = color + "60";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RaceMatchPage({ user, addToast, onUserUpdate, onNavigate }: Props) {
  const [phase, setPhase] = useState<"loading" | "racing" | "finished">("loading");
  const [match, setMatch] = useState<RaceMatch | null>(null);
  const [gear, setGear] = useState(0);
  const [lastShift, setLastShift] = useState<"hit" | "miss" | "crash" | null>(null);
  const [nitroCount, setNitroCount] = useState(3);
  const [nitroFlash, setNitroFlash] = useState(false);
  const [acting, setActing] = useState(false);
  const [rankFlash, setRankFlash] = useState<Record<string, "up" | "down">>({});
  const prevRanksRef = useRef<Record<string, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedNeedleRef = useRef<SVGLineElement>(null);   // big dial needle — reflects actual car speed
  const timingDotRef = useRef<SVGCircleElement>(null);   // fast-sweeping shift-timing indicator
  const matchRef = useRef<RaceMatch | null>(null);
  const scrollRef = useRef(0);
  const speedRef = useRef(0);      // 0–1 current visual speed — only changes via player actions
  const gearRef = useRef(0);       // current gear (0-indexed) — only advances on a successful (hit) shift
  const sweepStartRef = useRef(Date.now());
  const sweepDurRef = useRef(2400); // ms for one sweep
  const carImageRef = useRef<HTMLImageElement | null>(null);
  const carImageIdRef = useRef<string | null>(null);
  const animTimeRef = useRef(0);     // accumulated animation time for wheel spin + bob
  const crashAlphaRef = useRef(0);   // 0–1 crash flash intensity, decays each frame
  const swerveRef = useRef(0);       // lateral crash offset (px), decays each frame
  const sparksRef = useRef<Spark[]>([]);  // crash spark particles
  const nitroActiveRef = useRef(false);
  const nitroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchIdRef = useRef<string | null>(null);

  // Update matchRef whenever match state changes
  useEffect(() => { matchRef.current = match; }, [match]);

  // ── Load the player's actual customized car art whenever their car changes ─
  const myCarId = match?.players.find(p => p.userId?.toString() === user.id)?.carSnapshot?.carId ?? null;
  useEffect(() => {
    if (!myCarId || carImageIdRef.current === myCarId) return;
    carImageIdRef.current = myCarId;
    const img = new Image();
    img.onload = () => { carImageRef.current = img; };
    img.onerror = () => { carImageRef.current = null; };
    img.src = `/assets/cars/${myCarId}.png`;
  }, [myCarId]);

  // ── Canvas animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "racing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTs = 0;
    function loop(ts: number) {
      const dt = Math.min(50, ts - lastTs);
      lastTs = ts;

      // Speed only changes via explicit player actions (shift/crash/finish) — it never
      // drifts on its own. It ramps gradually toward the current gear's target speed,
      // like a real car accelerating, rather than jumping instantly.
      const me = matchRef.current?.players.find(p => p.userId?.toString() === user.id);
      const finished = me?.finishTime != null;
      const targetSpeed = finished ? 0 : gearRef.current / 6;
      speedRef.current += (targetSpeed - speedRef.current) * (finished ? 0.02 : 0.035);
      scrollRef.current = (scrollRef.current + speedRef.current * dt * 0.006) % 1;

      // Accumulate animation time (for wheel spin + body bob)
      animTimeRef.current += dt;
      // Decay crash flash
      if (crashAlphaRef.current > 0) {
        crashAlphaRef.current = Math.max(0, crashAlphaRef.current - 0.05);
      }
      // Decay crash swerve
      if (swerveRef.current !== 0) {
        swerveRef.current *= 0.82;
        if (Math.abs(swerveRef.current) < 0.5) swerveRef.current = 0;
      }
      // Advance spark particles
      if (sparksRef.current.length > 0) {
        sparksRef.current = sparksRef.current
          .map(s => ({ ...s, x: s.x + s.vx * dt * 0.05, y: s.y + s.vy * dt * 0.05, life: s.life - dt * 0.004 }))
          .filter(s => s.life > 0);
      }

      const W = canvas!.width, H = canvas!.height;
      const myCarSnap = me?.carSnapshot;
      renderFrame(ctx!, W, H, scrollRef.current, matchRef.current, user.id, nitroActiveRef.current,
        animTimeRef.current, crashAlphaRef.current, swerveRef.current, sparksRef.current,
        carImageRef.current, myCarSnap?.paint || "#00d4ff", myCarSnap?.underglow || "#00d4ff");

      // ── Drive the interactive speedometer dial (DOM refs, no re-render) ──────
      const speedFrac = Math.min(1, Math.max(0, speedRef.current));
      const speedAngle = GAUGE_START + speedFrac * GAUGE_ARC;
      if (speedNeedleRef.current) {
        speedNeedleRef.current.setAttribute("x2", String(GAUGE_CX + Math.cos(speedAngle) * GAUGE_NEEDLE_LEN));
        speedNeedleRef.current.setAttribute("y2", String(GAUGE_CY + Math.sin(speedAngle) * GAUGE_NEEDLE_LEN));
      }
      const elapsed = Date.now() - sweepStartRef.current;
      const sweep = sweepDurRef.current;
      const raw = (elapsed % (sweep * 2)) / sweep; // 0→1→0 bounce
      const posFrac = raw > 1 ? 2 - raw : raw;
      const dotAngle = GAUGE_START + posFrac * GAUGE_ARC;
      if (timingDotRef.current) {
        timingDotRef.current.setAttribute("cx", String(GAUGE_CX + Math.cos(dotAngle) * GAUGE_DOT_R));
        timingDotRef.current.setAttribute("cy", String(GAUGE_CY + Math.sin(dotAngle) * GAUGE_DOT_R));
      }

      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, user.id]);

  // ── Poll match state ───────────────────────────────────────────────────────
  const fetchMatch = useCallback(async (id: string) => {
    try {
      const data = await api.get<{ match: RaceMatch }>(`/race/match/${id}`);
      const m = data.match;
      setMatch(m);
      const me = m.players.find(p => p.userId?.toString() === user.id);
      if (me) setNitroCount(3 - (me.nitroUsed ?? 0));
      if (m.status === "complete") {
        setPhase("finished");
        onUserUpdate();
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      } else if (m.status === "abandoned") {
        // Match was cancelled (nobody connected in time) — stop polling and return to hub
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
        onNavigate("race-hub");
      }
    } catch { /* ignore */ }
  }, [user.id, onUserUpdate]);

  // ── Discover match on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.get<{
          inQueue: boolean;
          activeMatch: { matchId: string; status: string } | null;
        }>("/race/queue/status");

        if (cancelled) return;
        if (!status.activeMatch) {
          addToast("No active race found", "error");
          onNavigate("race-hub");
          return;
        }
        matchIdRef.current = status.activeMatch.matchId;
        await fetchMatch(status.activeMatch.matchId);
        if (!cancelled) {
          // Reset all per-race UI state so a second race starts clean
          setGear(0);
          gearRef.current = 0;
          speedRef.current = 0;
          sweepStartRef.current = Date.now();
          sweepDurRef.current = 2400;
          animTimeRef.current = 0;
          crashAlphaRef.current = 0;
          setPhase("racing");
          pollRef.current = setInterval(() => {
            if (matchIdRef.current) fetchMatch(matchIdRef.current);
          }, 1500);
        }
      } catch {
        if (!cancelled) {
          addToast("Failed to load race", "error");
          onNavigate("race-hub");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
    };
  }, []); // eslint-disable-line

  // ── Shift action ───────────────────────────────────────────────────────────
  // Speed/gear only change on the server's authoritative result:
  //  - Hit (green zone): speed increases and the gear advances — the sweep resets
  //    so the next gear's timing cycle starts fresh from zero.
  //  - Miss: speed and gear stay exactly as they are; the sweep keeps running
  //    uninterrupted (no reset, no penalty).
  //  - Crash: a genuine driving mistake — separate from a plain miss — knocks the
  //    car down a gear.
  const handleShift = useCallback(async () => {
    const meNow = matchRef.current?.players.find(p => p.userId?.toString() === user.id);
    if (acting || !matchIdRef.current || phase !== "racing" || meNow?.finishTime != null) return;

    setActing(true);
    try {
      // Server determines hit/miss/crash authoritatively — client sends no hit value
      const data = await api.post<{ match: RaceMatch; hit: boolean; crashed: boolean }>(`/race/match/${matchIdRef.current}/shift`, {});
      if (data.crashed) {
        setLastShift("crash");
        crashAlphaRef.current = 1.0;  // trigger red flash on canvas
        // Crash swerve — random left or right
        swerveRef.current = (Math.random() > 0.5 ? 1 : -1) * 22;
        // Spawn spark particles at player car canvas position
        const cnv = canvasRef.current;
        const cx = cnv ? cnv.width / 2 : 300;
        const cy = cnv ? cnv.height - 28 : 252;
        sparksRef.current = Array.from({ length: 20 }, () => ({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 220,
          vy: -(Math.random() * 160 + 40),
          life: 0.6 + Math.random() * 0.5,
          color: Math.random() > 0.5 ? "#f59e0b" : "#ff6b35",
        }));
        gearRef.current = Math.max(0, gearRef.current - 1);
        setGear(gearRef.current);
        setTimeout(() => setLastShift(null), 800);
      } else if (data.hit) {
        gearRef.current = Math.min(6, gearRef.current + 1);
        setGear(gearRef.current);
        sweepStartRef.current = Date.now();
        sweepDurRef.current = Math.max(900, 2400 - gearRef.current * 150);
        setLastShift("hit");
        setTimeout(() => setLastShift(null), 600);
      } else {
        // Missed the shift zone — speed/gear unchanged, sweep keeps running as-is
        setLastShift("miss");
        setTimeout(() => setLastShift(null), 600);
      }
      setMatch(data.match);
      const me = data.match.players.find(p => p.userId?.toString() === user.id);
      if (me) setNitroCount(3 - (me.nitroUsed ?? 0));
      if (data.match.status === "complete") {
        setPhase("finished");
        onUserUpdate();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (err: any) {
      addToast(err.message ?? "Shift failed", "error");
    } finally {
      setActing(false);
    }
  }, [acting, phase, user.id, addToast, onUserUpdate]);

  // ── Nitro action ───────────────────────────────────────────────────────────
  const handleNitro = useCallback(async () => {
    const meNow = matchRef.current?.players.find(p => p.userId?.toString() === user.id);
    if (acting || !matchIdRef.current || phase !== "racing" || nitroCount <= 0 || meNow?.finishTime != null) return;
    nitroActiveRef.current = true;
    setNitroFlash(true);
    if (nitroTimerRef.current) clearTimeout(nitroTimerRef.current);
    nitroTimerRef.current = setTimeout(() => {
      nitroActiveRef.current = false;
      setNitroFlash(false);
    }, 800);

    setActing(true);
    try {
      const data = await api.post<{ match: RaceMatch }>(`/race/match/${matchIdRef.current}/nitro`, {});
      setMatch(data.match);
      const me = data.match.players.find(p => p.userId?.toString() === user.id);
      setNitroCount(me ? 3 - (me.nitroUsed ?? 0) : 0);
      if (data.match.status === "complete") {
        setPhase("finished");
        onUserUpdate();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (err: any) {
      addToast(err.message ?? "Nitro failed", "error");
    } finally {
      setActing(false);
    }
  }, [acting, phase, nitroCount, user.id, addToast, onUserUpdate]);

  // Keyboard SHIFT = spacebar, NITRO = N
  useEffect(() => {
    if (phase !== "racing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleShift(); }
      if (e.code === "KeyN")  { e.preventDefault(); handleNitro(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleShift, handleNitro]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const me = match?.players.find(p => p.userId?.toString() === user.id);
  const myPct = me?.distancePct ?? 0;
  const myPlacement = me?.placement ?? null;
  // Player crossed the finish line, but the match isn't complete yet (others still racing)
  const myFinished = me?.finishTime != null;

  const leaderboard = match ? [...match.players].sort((a, b) => {
    if (a.placement !== null && b.placement !== null) return a.placement - b.placement;
    if (a.placement !== null) return -1;
    if (b.placement !== null) return 1;
    return b.distancePct - a.distancePct;
  }) : [];

  const myRank = leaderboard.findIndex(p => p.userId?.toString() === user.id) + 1;

  // Stable per-player key + display name. Opponents never reveal whether they're
  // an AI or a human — everyone just shows their (human-sounding) name.
  const playerKey = (p: RacePlayer) => p.userId?.toString() ?? p.aiName ?? "racer";
  const displayName = (p: RacePlayer) => {
    const isMe = p.userId?.toString() === user.id;
    if (isMe) return user.username;
    return p.aiName || "Racer";
  };

  // ── Track rank changes between polls to flash an overtake arrow ──────────────
  useEffect(() => {
    if (!match) return undefined;
    const next: Record<string, number> = {};
    const flashes: Record<string, "up" | "down"> = {};
    leaderboard.forEach((p, i) => {
      const key = playerKey(p);
      next[key] = i;
      const prev = prevRanksRef.current[key];
      if (prev !== undefined && prev !== i) flashes[key] = i < prev ? "up" : "down";
    });
    prevRanksRef.current = next;
    if (Object.keys(flashes).length > 0) {
      setRankFlash(flashes);
      const t = setTimeout(() => setRankFlash({}), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [match]); // eslint-disable-line

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "8px 8px 24px" }} className="relative z-10">
      <div className="dl-page-bg bg-race" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <style>{RACE_CSS}</style>

      {/* Loading */}
      {phase === "loading" && (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "monospace", color: "#475569" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏎</div>
          Loading race…
        </div>
      )}

      {/* Racing phase */}
      {phase === "racing" && (
        <>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#00d4ff", fontWeight: "bold" }}>
              {myFinished ? "🏁 FINISHED" : `GEAR ${gear}`} &nbsp;
              <span style={{ fontSize: 10, color: "#334155" }}>
                {match?.mode === "4player" ? "4-PLAYER RACE" : "2-PLAYER RACE"}
              </span>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b" }}>
              P{myRank} &nbsp; {myPct.toFixed(1)}%
            </div>
          </div>

          {/* Canvas */}
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #1e293b" }}>
            <canvas
              ref={canvasRef}
              width={600} height={280}
              style={{ display: "block", width: "100%", height: "auto", background: "#030308" }}
            />
            {/* Nitro flare overlay */}
            {nitroFlash && (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to right, rgba(255,107,53,0.15), transparent)",
                animation: "nitroFlare 0.8s ease-out forwards",
                pointerEvents: "none",
              }} />
            )}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 6, background: "#0d0d1a", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg, #00d4ff, #a855f7)",
              width: `${myPct}%`, transition: "width 0.4s ease",
            }} />
          </div>

          {/* Position bar — live standings, badges slide to their new slot on overtakes */}
          <div style={{
            position: "relative", marginTop: 8,
            height: 54, width: leaderboard.length * 66,
          }}>
            {leaderboard.map((p, i) => {
              const key = playerKey(p);
              const isMe = p.userId?.toString() === user.id;
              const name = displayName(p);
              const pct = p.distancePct.toFixed(0);
              const color = PLACEMENT_COLORS[i + 1] ?? "#475569";
              const flash = rankFlash[key];
              return (
                <div key={key} style={{
                  position: "absolute", top: 0, left: 0, width: 58,
                  transform: `translateX(${i * 66}px)`,
                  transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isMe ? "#00d4ff20" : "#0a0a14",
                      border: `2px solid ${isMe ? "#00d4ff" : color}`,
                      boxShadow: isMe ? "0 0 10px #00d4ff60" : "none",
                      fontFamily: "monospace", fontWeight: "bold", fontSize: 12,
                      color: isMe ? "#00d4ff" : color,
                    }}>
                      {i + 1}
                    </div>
                    {flash && (
                      <span style={{
                        position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                        fontSize: 11, color: flash === "up" ? "#22c55e" : "#ef4444",
                        animation: flash === "up" ? "arrowUp 1s ease forwards" : "arrowDown 1s ease forwards",
                      }}>
                        {flash === "up" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: "monospace", fontSize: 8, maxWidth: 58, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isMe ? "#00d4ff" : "#64748b",
                  }}>
                    {name}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 8, color: "#334155" }}>{pct}%</div>
                </div>
              );
            })}
          </div>

          {/* Waiting-for-others panel — shown once the player finishes but the match hasn't ended */}
          {myFinished ? (
            <div style={{
              marginTop: 14, background: "#0a0a14", border: "1px solid #22c55e40",
              borderRadius: 10, padding: "20px 16px", textAlign: "center",
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🏁</div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#22c55e", fontWeight: "bold" }}>
                You finished{me?.finishTime != null ? ` in ${(me.finishTime / 1000).toFixed(2)}s` : ""}!
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 4 }}>
                Waiting for the other racers to cross the line…
              </div>
            </div>
          ) : (
          <div style={{
            marginTop: 14, background: "#0a0a14",
            border: `1px solid ${lastShift === "crash" ? "#ef444460" : "#1e293b"}`,
            borderRadius: 10, padding: "14px 14px 12px",
            animation: lastShift === "hit" ? "shiftHit 0.6s ease" : lastShift === "miss" ? "shiftMiss 0.6s ease" : lastShift === "crash" ? "shiftMiss 0.8s ease" : "none",
          }}>
            {/* Controls: speedometer dial (click = shift) + NITRO */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center" }}>
              {/* Speedometer dial */}
              <div
                onClick={handleShift}
                role="button"
                aria-label="Shift gear"
                style={{
                  position: "relative", width: GAUGE_SIZE, height: GAUGE_SIZE, flexShrink: 0,
                  cursor: acting ? "default" : "pointer",
                  filter: lastShift === "hit" ? "drop-shadow(0 0 10px #22c55e80)"
                    : (lastShift === "miss" || lastShift === "crash") ? "drop-shadow(0 0 10px #ef444480)" : "none",
                  transition: "filter 0.15s",
                }}
              >
                <svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
                  {/* Dial face */}
                  <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R + 6} fill="#0a0a14" stroke="#1e293b" strokeWidth={1} />
                  {/* Fixed green shift-zone wedge */}
                  <path d={arcPath(GAUGE_R - 2, SHIFT_ZONE_LO, SHIFT_ZONE_HI)} stroke="#22c55e" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.85} />
                  {/* Minor ticks */}
                  {GAUGE_MINOR_TICKS.map((t, i) => (
                    <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#334155" strokeWidth={1} />
                  ))}
                  {/* Major ticks + numbers */}
                  {GAUGE_MAJOR_TICKS.map((t, i) => (
                    <g key={i}>
                      <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#94a3b8" strokeWidth={1.5} />
                      <text x={t.lx} y={t.ly} fill="#64748b" fontSize={9} fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">{t.value}</text>
                    </g>
                  ))}
                  {/* Fast-sweeping shift-timing dot */}
                  <circle ref={timingDotRef} cx={GAUGE_CX} cy={GAUGE_CY - GAUGE_DOT_R} r={4} fill="#ffffff">
                    <title>Shift timing</title>
                  </circle>
                  {/* Big speed needle */}
                  <line ref={speedNeedleRef} x1={GAUGE_CX} y1={GAUGE_CY} x2={GAUGE_CX} y2={GAUGE_CY - GAUGE_NEEDLE_LEN} stroke="#e2e8f0" strokeWidth={2.5} strokeLinecap="round" />
                  <circle cx={GAUGE_CX} cy={GAUGE_CY} r={5} fill="#475569" />
                </svg>
                {/* Digital gear readout, LCD-style */}
                <div style={{
                  position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)",
                  background: "#020204", border: "1px solid #1e293b", borderRadius: 4,
                  padding: "2px 10px", textAlign: "center",
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 7, color: "#334155", letterSpacing: 1 }}>GEAR</div>
                  <div style={{
                    fontFamily: "monospace", fontSize: 18, fontWeight: "bold", lineHeight: 1,
                    color: lastShift === "hit" ? "#22c55e" : (lastShift === "miss" || lastShift === "crash") ? "#ef4444" : "#00d4ff",
                  }}>
                    {gear}
                  </div>
                </div>
              </div>

              {/* NITRO button */}
              <button
                onClick={handleNitro}
                disabled={acting || nitroCount <= 0}
                style={{
                  width: 64, height: 64, borderRadius: 8, cursor: nitroCount > 0 ? "pointer" : "not-allowed",
                  fontFamily: "monospace", fontSize: 10, fontWeight: "bold", flexShrink: 0,
                  background: nitroFlash ? "#ff6b3520" : nitroCount > 0 ? "linear-gradient(135deg, #ff6b3518, #ff6b3508)" : "#0a0a14",
                  border: `2px solid ${nitroFlash ? "#ff6b35" : nitroCount > 0 ? "#ff6b3560" : "#1e293b"}`,
                  color: nitroCount > 0 ? "#ff6b35" : "#334155",
                  boxShadow: nitroFlash ? "0 0 16px #ff6b3560" : "none",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                }}
              >
                <span style={{ fontSize: 18 }}>🔥</span>
                <span>×{nitroCount}</span>
              </button>
            </div>

            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#334155", marginTop: 10, textAlign: "center" }}>
              SPACE = shift &nbsp;·&nbsp; N = nitro &nbsp;·&nbsp; Tap the dial when the pointer lights up the green zone
            </div>
          </div>
          )}
        </>
      )}

      {/* Finished phase */}
      {phase === "finished" && match && (() => {
        // Base rewards table (mirrors backend constants, shown as estimates before daily cap)
        const BASE_REWARDS: Record<number, { dc: number; xp: number; keyShards: number }> = {
          1: { dc: 300, xp: 300, keyShards: 1 },
          2: { dc: 150, xp: 180, keyShards: 0 },
          3: { dc:  80, xp: 100, keyShards: 0 },
          4: { dc:  40, xp:  60, keyShards: 0 },
        };
        const myRewards = BASE_REWARDS[myPlacement ?? 4] ?? BASE_REWARDS[4];
        const plColor = PLACEMENT_COLORS[myPlacement ?? 4] ?? "#475569";

        return (
        <div style={{ textAlign: "center", padding: "24px 16px" }}>
          {/* Placement banner */}
          <div style={{
            display: "inline-block", padding: "20px 40px", borderRadius: 12, marginBottom: 24,
            background: `${plColor}18`,
            border: `2px solid ${plColor}60`,
            animation: "placeBanner 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            {/* Winner burnout animation */}
            {myPlacement === 1 ? (
              <div style={{ fontSize: 40, marginBottom: 6, animation: "burnout 0.15s ease infinite", display: "inline-block" }}>🏎</div>
            ) : (
              <div style={{ fontFamily: "monospace", fontSize: 32, marginBottom: 4 }}>
                {myPlacement === 2 ? "🥈" : myPlacement === 3 ? "🥉" : "🏁"}
              </div>
            )}
            <div style={{
              fontFamily: "monospace", fontSize: 22, fontWeight: "bold", letterSpacing: 3,
              color: plColor,
            }}>
              {PLACEMENT_LABELS[myPlacement ?? 4] ?? "FINISHED"}
            </div>
            {me?.finishTime != null && (
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 6 }}>
                Time: {(me.finishTime / 1000).toFixed(2)}s
              </div>
            )}
          </div>

          {/* Final leaderboard */}
          <div style={{ background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginBottom: 10 }}>FINAL STANDINGS</div>
            {leaderboard.map((p, i) => {
              const isMe = p.userId?.toString() === user.id;
              const name = displayName(p);
              const pl = p.placement ?? (i + 1);
              const plColor = PLACEMENT_COLORS[pl] ?? "#475569";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid #1e293b" : "none",
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: "bold", color: plColor, width: 24 }}>{pl}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: isMe ? "#00d4ff" : "#64748b", flex: 1 }}>{name}</span>
                  {p.finishTime != null && (
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#334155" }}>
                      {(p.finishTime / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Rewards breakdown */}
          <div style={{
            background: "#0a0a14", border: "1px solid #1e293b", borderRadius: 8,
            padding: "14px 16px", marginBottom: 20, textAlign: "left",
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#475569", marginBottom: 8 }}>REWARDS EARNED</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#fbbf24" }}>+{myRewards.dc} DC</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#a855f7" }}>+{myRewards.xp} XP</div>
              {myRewards.keyShards > 0 && (
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#00d4ff" }}>+{myRewards.keyShards} Key Shard</div>
              )}
              {myPlacement === 1 && (
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b", opacity: 0.7 }}>10% chance +1 Key 🎰</div>
              )}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#334155", marginTop: 6 }}>
              Exact amount (with daily cap) in your inbox notification
            </div>
          </div>

          <button
            onClick={() => onNavigate("race-hub")}
            style={{
              padding: "12px 32px", borderRadius: 8, cursor: "pointer",
              fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
              background: "#00d4ff18", border: "1px solid #00d4ff60", color: "#00d4ff",
            }}
          >
            ← Back to Race Hub
          </button>
        </div>
        );
      })()}
    </div>
  );
}
