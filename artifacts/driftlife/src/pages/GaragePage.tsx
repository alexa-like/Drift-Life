import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api";
import type { User, Car } from "../lib/types";

interface Props {
  user: User;
  onUserUpdate: (u: User) => void;
}

interface CarCatalogEntry { make: string; model: string; year: number; power: number; handling: number; grip: number; nitro: number; price: number; description: string; index: number }
interface PartEntry { id: string; type: string; quality: string; stat: string; baseCost: number; description: string }

const STAT_ICONS: Record<string, string> = { power: "⚡", handling: "🎮", grip: "🔒", nitro: "🚀", durability: "🛡️" };
const QUALITY_COLORS: Record<string, string> = { common: "text-zinc-300", rare: "text-blue-400", legendary: "text-yellow-400" };

export default function GaragePage({ user, onUserUpdate }: Props) {
  const [cars, setCars] = useState<Car[]>([]);
  const [catalog, setCatalog] = useState<CarCatalogEntry[]>([]);
  const [parts, setParts] = useState<PartEntry[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [tab, setTab] = useState<"garage" | "buy" | "tune" | "races">("garage");
  const [tuneStat, setTuneStat] = useState<string>("power");
  const [tunePartId, setTunePartId] = useState<string>("");
  const TUNE_ENERGY_COST = 3;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [raceMode, setRaceMode] = useState<"drag" | "circuit" | "drift">("drag");
  const [opponentId, setOpponentId] = useState("");
  const [pinkSlip, setPinkSlip] = useState(false);
  const [buyName, setBuyName] = useState("");
  const [racePhase, setRacePhase] = useState<"setup" | "minigame" | "result">("setup");
  const [raceBonus, setRaceBonus] = useState(0);
  const [raceResult, setRaceResult] = useState<any>(null);
  const [pendingRaces, setPendingRaces] = useState<{ raceId: string; challenger: string; raceType: string; prize: number; link: string }[]>([]);
  const [acceptingRace, setAcceptingRace] = useState<string | null>(null);
  const [acceptRaceId, setAcceptRaceId] = useState("");

  useEffect(() => {
    refreshCars();
    api.get<CarCatalogEntry[]>("/garage/catalog").then(r => setCatalog(r)).catch(() => {});
    api.get<PartEntry[]>("/garage/parts").then(r => setParts(r)).catch(() => {});
    // Load notifications to surface incoming pink-slip challenges
    api.get<any[]>("/notifications").then(notifs => {
      const raceNotifs = notifs.filter(n => n.link && n.link.startsWith("/races/accept/"));
      const parsed = raceNotifs.map(n => ({
        raceId: n.link.replace("/races/accept/", ""),
        challenger: n.message ?? "Challenger",
        raceType: "pink-slip",
        prize: 0,
        link: n.link,
      }));
      setPendingRaces(parsed);
    }).catch(() => {});
  }, []);

  async function refreshCars() {
    try {
      const r = await api.get<Car[]>("/garage");
      setCars(r);
      setSelectedCar(prev => r.find((c: Car) => c.id === prev?.id) ?? r[0] ?? null);
    } catch { /* ignore */ }
  }

  async function buyCar(idx: number) {
    if (loading) return;
    setLoading(true);
    try {
      const r = await api.post<{ message: string }>("/garage/buy", { carIndex: idx, name: buyName || undefined });
      setMessage({ text: r.message, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dc: user.dc - catalog[idx].price });
      setTab("garage");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function tuneCar() {
    if (!selectedCar || loading) return;
    setLoading(true);
    try {
      const r = await api.post<{ gain: number; dc: number; energy: number }>(`/garage/${selectedCar.id}/tune`, {
        stat: tuneStat, partId: tunePartId || undefined,
      });
      setMessage({ text: `+${r.gain.toFixed(3)} ${tuneStat} — ${selectedCar.name}`, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dc: r.dc, energy: r.energy });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    } finally { setLoading(false); }
  }

  async function setActive(carId: string) {
    try {
      await api.post("/garage/set-active", { carId });
      setCars(prev => prev.map(c => ({ ...c, isActive: c.id === carId })));
      onUserUpdate({ ...user, activeCar: carId });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function chopCar(carId: string) {
    if (!confirm("Chop this car for parts? This is irreversible.")) return;
    try {
      const r = await api.post<{ message: string; dirtyDc?: number }>(`/garage/${carId}/chop`, {});
      setMessage({ text: r.message, type: "success" });
      await refreshCars();
      onUserUpdate({ ...user, dirtyDc: r.dirtyDc ?? user.dirtyDc });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
    }
  }

  async function acceptRace(raceId: string) {
    setAcceptingRace(raceId);
    try {
      const r = await api.post<any>(`/races/accept/${raceId}`, {});
      const d = r;
      // The accepting player is the defender. Backend returns challengerWins.
      const defenderWins = !d.challengerWins;
      const resultText = d.raceType === "drift"
        ? `${d.winner} wins!`
        : `${d.winner} wins!`;
      setRaceResult({ ...d, resultText, bonus: 0, challengerWins: d.challengerWins, defenderPerspective: true });
      // Pink-slip races have no DC prize — just update race stats
      if (defenderWins) {
        onUserUpdate({ ...user, totalRaces: (user.totalRaces ?? 0) + 1, raceWins: (user.raceWins ?? 0) + 1 });
      } else {
        onUserUpdate({ ...user, totalRaces: (user.totalRaces ?? 0) + 1 });
      }
      setPendingRaces(prev => prev.filter(pr => pr.raceId !== raceId));
      setRacePhase("result");
      setMessage({ text: "Race accepted and resolved!", type: "success" });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Failed to accept race", type: "error" });
    } finally { setAcceptingRace(null); }
  }

  async function startRace(bonus = 0) {
    if (!opponentId.trim()) return;
    setLoading(true);
    try {
      const r = await api.post<any>("/races/start", {
        defenderId: opponentId.trim(), raceType: raceMode, isPinkSlip: pinkSlip,
        launchBonus: raceMode === "drag" ? bonus : 0,
        cornerBonus: raceMode === "circuit" || raceMode === "drift" ? bonus : 0,
      });
      const d = r;
      if (d.raceId) {
        setRaceResult({ pinkSlipChallenge: true, raceId: d.raceId });
      } else {
        const resultText = d.raceType === "drift"
          ? `${d.winner} wins! ${d.challengerScore} vs ${d.defenderScore} pts`
          : `${d.winner} wins! ${d.challengerTime}s vs ${d.defenderTime}s`;
        setRaceResult({ ...d, resultText, bonus });
        if (d.challengerWins) {
          onUserUpdate({ ...user, dc: user.dc + (d.prize ?? 0), totalRaces: (user.totalRaces ?? 0) + 1, raceWins: (user.raceWins ?? 0) + 1 });
        } else {
          onUserUpdate({ ...user, dc: user.dc - (d.prize ?? 0), totalRaces: (user.totalRaces ?? 0) + 1 });
        }
      }
      setRacePhase("result");
    } catch (e: any) {
      setMessage({ text: e.response?.data?.message ?? "Error", type: "error" });
      setRacePhase("setup");
    } finally { setLoading(false); }
  }

  // ── Racing minigame components ──────────────────────────────────────────────
  function DragMinigame({ onComplete }: { onComplete: (bonus: number) => void }) {
    const [pos, setPos] = useState(0);           // 0-100
    const [done, setDone] = useState(false);
    const [captured, setCaptured] = useState<number | null>(null);
    const frameRef = useRef<number | null>(null);
    const startRef = useRef(performance.now());

    useEffect(() => {
      function tick() {
        const elapsed = (performance.now() - startRef.current) / 1000;
        // Oscillate: sine wave, period = 2s
        const p = 50 + 48 * Math.sin(elapsed * Math.PI);
        setPos(p);
        frameRef.current = requestAnimationFrame(tick);
      }
      frameRef.current = requestAnimationFrame(tick);
      return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    }, []);

    function launch() {
      if (done) return;
      setDone(true);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      setCaptured(pos);
      // Green zone: 42-58 (centred)
      const deviation = Math.abs(pos - 50);
      const bonus = deviation <= 8 ? Math.max(0, 0.3 * (1 - deviation / 8)) : 0;
      setTimeout(() => onComplete(bonus), 800);
    }

    return (
      <div className="space-y-4 p-4 rounded-xl" style={{ background: "#0a0a0f", border: "1px solid #ff6b3540" }}>
        <div className="font-mono text-sm font-bold text-center" style={{ color: "#ff6b35" }}>DRAG — PERFECT LAUNCH</div>
        <p className="font-mono text-xs text-center" style={{ color: "#64748b" }}>Click LAUNCH when the bar is in the green zone</p>
        {/* Track */}
        <div className="relative h-8 rounded-lg" style={{ background: "#1e1e2e" }}>
          {/* Green zone */}
          <div className="absolute top-0 bottom-0 rounded" style={{ left: "42%", width: "16%", background: "#39d35330" }} />
          {/* Indicator */}
          <div
            className="absolute top-1 bottom-1 w-3 rounded"
            style={{
              left: `${pos}%`,
              transform: "translateX(-50%)",
              background: captured !== null
                ? (Math.abs(captured - 50) <= 8 ? "#39d353" : "#ff2d55")
                : "#ff6b35",
              boxShadow: "0 0 8px currentColor",
              transition: "background 0.2s",
            }}
          />
        </div>
        {captured !== null ? (
          <div className="font-mono text-xs text-center" style={{ color: Math.abs(captured - 50) <= 8 ? "#39d353" : "#64748b" }}>
            {Math.abs(captured - 50) <= 8 ? "CLEAN LAUNCH!" : "Off the mark."}
          </div>
        ) : (
          <button
            onClick={launch}
            className="w-full py-3 rounded-xl font-mono font-black text-lg uppercase tracking-widest"
            style={{ background: "#ff6b3518", color: "#ff6b35", border: "1px solid #ff6b3560", cursor: "pointer" }}
          >
            LAUNCH!
          </button>
        )}
      </div>
    );
  }

  function CircuitMinigame({ onComplete }: { onComplete: (bonus: number) => void }) {
    const PROMPTS = useRef(
      Array.from({ length: 3 }, () => (Math.random() > 0.5 ? "LEFT" : "RIGHT"))
    ).current;
    const [idx, setIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(100); // 0-100 %
    const [feedback, setFeedback] = useState<"" | "hit" | "miss">("");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const advance = useCallback((hit: boolean) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setFeedback(hit ? "hit" : "miss");
      const newScore = score + (hit ? 1 : 0);
      const newIdx = idx + 1;
      setTimeout(() => {
        setFeedback("");
        if (newIdx >= PROMPTS.length) {
          onComplete((newScore / PROMPTS.length) * 0.5);
        } else {
          setIdx(newIdx);
          setScore(newScore);
          setTimeLeft(100);
        }
      }, 500);
    }, [idx, score, PROMPTS, onComplete]);

    useEffect(() => {
      setTimeLeft(100);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 2) { advance(false); return 100; }
          return prev - 2;
        });
      }, 60);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [idx]);

    const prompt = PROMPTS[idx];
    return (
      <div className="space-y-4 p-4 rounded-xl" style={{ background: "#0a0a0f", border: "1px solid #00d4ff40" }}>
        <div className="font-mono text-sm font-bold text-center" style={{ color: "#00d4ff" }}>CIRCUIT — CORNERING ({idx + 1}/{PROMPTS.length})</div>
        <div className="h-2 rounded" style={{ background: "#1e1e2e" }}>
          <div className="h-2 rounded transition-none" style={{ width: `${timeLeft}%`, background: timeLeft > 50 ? "#39d353" : timeLeft > 25 ? "#f59e0b" : "#ff2d55" }} />
        </div>
        <div
          className="text-center font-mono font-black text-4xl"
          style={{ color: feedback === "hit" ? "#39d353" : feedback === "miss" ? "#ff2d55" : "#e2e8f0", letterSpacing: 4 }}
        >
          {feedback === "hit" ? "✓" : feedback === "miss" ? "✗" : `TURN ${prompt}!`}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["LEFT", "RIGHT"] as const).map(dir => (
            <button
              key={dir}
              onClick={() => advance(dir === prompt)}
              disabled={!!feedback}
              className="py-4 rounded-xl font-mono font-bold text-lg"
              style={{
                background: dir === "LEFT" ? "#a855f718" : "#ff6b3518",
                color: dir === "LEFT" ? "#a855f7" : "#ff6b35",
                border: `1px solid ${dir === "LEFT" ? "#a855f740" : "#ff6b3540"}`,
                cursor: feedback ? "not-allowed" : "pointer",
              }}
            >
              {dir === "LEFT" ? "← LEFT" : "RIGHT →"}
            </button>
          ))}
        </div>
        <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
          Score: {score}/{idx} correct
        </div>
      </div>
    );
  }

  function DriftMinigame({ onComplete }: { onComplete: (bonus: number) => void }) {
    const [angle, setAngle] = useState(50);    // 0-100
    const [hits, setHits] = useState(0);
    const [attempt, setAttempt] = useState(0);
    const [feedback, setFeedback] = useState<"" | "hit" | "miss">("");
    const frameRef = useRef<number | null>(null);
    const startRef = useRef(performance.now());
    const TOTAL = 3;

    useEffect(() => {
      function tick() {
        const t = (performance.now() - startRef.current) / 1000;
        setAngle(50 + 45 * Math.sin(t * 1.5));
        frameRef.current = requestAnimationFrame(tick);
      }
      frameRef.current = requestAnimationFrame(tick);
      return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    }, []);

    function drift() {
      if (feedback) return;
      const inZone = angle >= 35 && angle <= 65;
      const newHits = hits + (inZone ? 1 : 0);
      const newAttempt = attempt + 1;
      setFeedback(inZone ? "hit" : "miss");
      setTimeout(() => {
        setFeedback("");
        if (newAttempt >= TOTAL) {
          if (frameRef.current) cancelAnimationFrame(frameRef.current);
          onComplete((newHits / TOTAL) * 0.5);
        } else {
          setHits(newHits);
          setAttempt(newAttempt);
        }
      }, 600);
    }

    return (
      <div className="space-y-4 p-4 rounded-xl" style={{ background: "#0a0a0f", border: "1px solid #a855f740" }}>
        <div className="font-mono text-sm font-bold text-center" style={{ color: "#a855f7" }}>DRIFT — LOCK THE ANGLE ({attempt + 1}/{TOTAL})</div>
        <p className="font-mono text-xs text-center" style={{ color: "#64748b" }}>Click DRIFT when the angle indicator is in the purple zone</p>
        <div className="relative h-6 rounded-lg" style={{ background: "#1e1e2e" }}>
          <div className="absolute top-0 bottom-0 rounded" style={{ left: "35%", width: "30%", background: "#a855f730" }} />
          <div
            className="absolute top-1 bottom-1 w-3 rounded"
            style={{
              left: `${angle}%`,
              transform: "translateX(-50%)",
              background: feedback ? (feedback === "hit" ? "#39d353" : "#ff2d55") : "#a855f7",
              boxShadow: "0 0 8px currentColor",
            }}
          />
        </div>
        <div className="font-mono text-xs text-center" style={{
          color: feedback === "hit" ? "#39d353" : feedback === "miss" ? "#ff2d55" : "#64748b",
          minHeight: "1.2rem",
        }}>
          {feedback === "hit" ? "CLEAN LINE!" : feedback === "miss" ? "Lost it." : ""}
        </div>
        <button
          onClick={drift}
          disabled={!!feedback}
          className="w-full py-3 rounded-xl font-mono font-black text-lg uppercase tracking-widest"
          style={{
            background: "#a855f718",
            color: "#a855f7",
            border: "1px solid #a855f760",
            cursor: feedback ? "not-allowed" : "pointer",
          }}
        >
          DRIFT!
        </button>
        <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
          {hits} / {attempt} good lines
        </div>
      </div>
    );
  }

  const StatBar = ({ label, value, max = 100, icon }: { label: string; value: number; max?: number; icon: string }) => (
    <div>
      <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
        <span>{icon} {label}</span>
        <span className="font-mono text-white">{value.toFixed ? value.toFixed(1) : value}</span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full">
        <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Garage</h1>
          <p className="text-zinc-400 text-sm">Cars. Tuning. Street racing.</p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          DC: <span className="text-green-400 font-mono">{user.dc.toLocaleString()}</span>
          <br />Energy: <span className="text-blue-300">{user.energy}/{user.maxEnergy}</span>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-900/50 border border-green-600 text-green-300" : "bg-red-900/50 border border-red-600 text-red-300"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["garage", "buy", "tune", "races"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {t === "garage" ? "My Cars" : t === "buy" ? "Buy Car" : t === "tune" ? "Tune" : "Race"}
          </button>
        ))}
      </div>

      {/* MY CARS */}
      {tab === "garage" && (
        <div className="space-y-3">
          {cars.length === 0 && (
            <div className="text-center py-10">
              <p className="text-zinc-400">No cars yet.</p>
              <button onClick={() => setTab("buy")} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">Browse Cars</button>
            </div>
          )}
          {cars.map(car => (
            <div key={car.id} className={`bg-zinc-900 border rounded-xl p-4 space-y-3 ${car.isActive ? "border-blue-500" : "border-zinc-700"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏎️</span>
                    <div>
                      <p className="font-bold text-white">{car.name}</p>
                      <p className="text-xs text-zinc-500">{car.year} {car.make} {car.model}</p>
                    </div>
                    {car.isActive && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Active</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>🏁 {car.raceWins}W / {car.raceLosses}L</p>
                  {car.impoundedUntil && new Date(car.impoundedUntil) > new Date() && (
                    <p className="text-red-400">Impounded</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBar label="Power"    value={car.power}    max={50} icon="⚡" />
                <StatBar label="Handling" value={car.handling} max={50} icon="🎮" />
                <StatBar label="Grip"     value={car.grip}     max={50} icon="🔒" />
                <StatBar label="Nitro"    value={car.nitro}    max={50} icon="🚀" />
              </div>
              <StatBar label="Durability" value={car.durability} max={car.maxDurability} icon="🛡️" />

              <div className="flex gap-2 flex-wrap">
                {!car.isActive && (
                  <button onClick={() => setActive(car.id)} className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold text-white">Set Active</button>
                )}
                <button onClick={() => { setSelectedCar(car); setTab("tune"); }} className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-white">Tune</button>
                <button onClick={() => chopCar(car.id)} className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300">Chop</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUY CAR */}
      {tab === "buy" && (
        <div className="space-y-3">
          <input value={buyName} onChange={e => setBuyName(e.target.value)} placeholder="Custom name (optional)"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 mb-2" />
          {catalog.map(c => (
            <div key={c.index} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{c.make} {c.model}</p>
                  <p className="text-zinc-500 text-xs">{c.year} — {c.description}</p>
                </div>
                <span className="text-green-400 font-bold text-sm">{c.price.toLocaleString()} DC</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-zinc-400">
                <span>⚡ {c.power}</span>
                <span>🎮 {c.handling}</span>
                <span>🔒 {c.grip}</span>
                <span>🚀 {c.nitro}</span>
              </div>
              <button onClick={() => buyCar(c.index)} disabled={user.dc < c.price || loading || cars.length >= 5}
                className={`w-full py-2 rounded-lg text-sm font-bold ${user.dc >= c.price && !loading && cars.length < 5 ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {cars.length >= 5 ? "Garage Full" : user.dc < c.price ? "Not enough DC" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TUNE */}
      {tab === "tune" && (
        <div className="space-y-4">
          {/* Car selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cars.map(c => (
              <button key={c.id} onClick={() => setSelectedCar(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border ${selectedCar?.id === c.id ? "border-blue-500 bg-zinc-800 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-400"}`}>
                {c.name}
              </button>
            ))}
          </div>

          {selectedCar && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-4">
              <h2 className="font-bold text-white">{selectedCar.name}</h2>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Stat to tune:</p>
                <div className="grid grid-cols-5 gap-2">
                  {["power","handling","grip","nitro","durability"].map(s => (
                    <button key={s} onClick={() => setTuneStat(s)}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all ${tuneStat === s ? "border-blue-500 bg-zinc-700 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {STAT_ICONS[s]} {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Install part (optional — improves gain rate):</p>
                <select value={tunePartId} onChange={e => setTunePartId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="">No part (manual tuning)</option>
                  {parts.filter(p => {
                    const statMap: Record<string, string[]> = {
                      power: ["turbo_kit"], handling: ["sport_suspension"], grip: ["racing_slicks"], nitro: ["nos_canister"]
                    };
                    return (statMap[tuneStat] ?? []).includes(p.type);
                  }).map(p => (
                    <option key={p.id} value={p.id}>{p.quality.toUpperCase()} {p.type.replace(/_/g," ")} — {p.baseCost.toLocaleString()} DC</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-zinc-400 text-sm mb-1">Energy cost: <span className="text-blue-300">{TUNE_ENERGY_COST}</span></p>
              </div>

              <button onClick={tuneCar} disabled={loading || user.energy < TUNE_ENERGY_COST}
                className={`w-full py-3 rounded-xl font-bold ${!loading && user.energy >= TUNE_ENERGY_COST ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}>
                {loading ? "Tuning…" : `Tune ${STAT_ICONS[tuneStat]} ${tuneStat}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* RACES */}
      {tab === "races" && (
        <div className="space-y-4">
          {/* Incoming pink-slip challenges */}
          {(pendingRaces.length > 0 || true) && (
            <div className="bg-zinc-900 border border-yellow-700/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-yellow-400 text-sm">🏆 Incoming Race Challenges</h3>
                <span className="text-zinc-500 text-xs">Accept using the race ID from your notifications</span>
              </div>
              {pendingRaces.map(pr => (
                <div key={pr.raceId} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{pr.challenger}</p>
                    <p className="text-zinc-400 text-xs font-mono">ID: {pr.raceId}</p>
                  </div>
                  <button
                    onClick={() => acceptRace(pr.raceId)}
                    disabled={acceptingRace === pr.raceId}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded text-xs disabled:opacity-50"
                  >
                    {acceptingRace === pr.raceId ? "Accepting…" : "Accept"}
                  </button>
                </div>
              ))}
              {pendingRaces.length === 0 && (
                <p className="text-zinc-500 text-xs">No pending challenges found in your notifications.</p>
              )}
              {/* Manual accept by ID */}
              <div className="flex gap-2 pt-1">
                <input
                  value={acceptRaceId}
                  onChange={e => setAcceptRaceId(e.target.value)}
                  placeholder="Paste race ID to accept manually…"
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-yellow-500 font-mono"
                />
                <button
                  onClick={() => { if (acceptRaceId.trim()) { acceptRace(acceptRaceId.trim()); setAcceptRaceId(""); } }}
                  disabled={!acceptRaceId.trim() || !!acceptingRace}
                  className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded text-xs disabled:opacity-40"
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {!selectedCar && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
              <p className="text-zinc-400 text-sm">Get a car from the Garage tab first.</p>
            </div>
          )}

          {selectedCar && racePhase === "setup" && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-white text-lg">Street Race</h2>
                <span className="text-zinc-400 text-xs font-mono">{cars.find(c => c.isActive)?.name ?? selectedCar.name}</span>
              </div>

              <div>
                <p className="text-zinc-400 text-sm mb-2">Race type:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["drag","circuit","drift"] as const).map(rt => (
                    <button key={rt} onClick={() => setRaceMode(rt)}
                      className={`py-2 rounded-lg text-sm font-bold border capitalize ${raceMode === rt ? "border-blue-500 bg-zinc-700 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {rt === "drag" ? "🏁 Drag" : rt === "circuit" ? "🔄 Circuit" : "💨 Drift"}
                    </button>
                  ))}
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {raceMode === "drag" ? "Perfect launch timing = up to 0.3s advantage"
                    : raceMode === "circuit" ? "3 corner prompts — react in time = up to 50% bonus"
                    : "3 drift locks — hit the sweet zone = up to 50% style bonus"}
                </p>
              </div>

              <input value={opponentId} onChange={e => setOpponentId(e.target.value)} placeholder="Opponent player ID or tag"
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />

              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={pinkSlip} onChange={e => setPinkSlip(e.target.checked)} className="accent-red-500" />
                <span>Pink-Slip race <span className="text-red-400">(winner takes loser's car)</span></span>
              </label>

              <button
                onClick={() => setRacePhase("minigame")}
                disabled={!opponentId.trim()}
                className={`w-full py-3 rounded-xl font-bold text-lg ${opponentId.trim() ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}`}
              >
                {pinkSlip ? "🏆 Start Pink-Slip Minigame" : "🎮 Start Minigame"}
              </button>
            </div>
          )}

          {selectedCar && racePhase === "minigame" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-zinc-400 text-sm font-mono">vs <strong className="text-white">{opponentId}</strong></span>
                <button onClick={() => setRacePhase("setup")} className="text-zinc-500 text-xs hover:text-zinc-300">← Back</button>
              </div>
              {raceMode === "drag" && (
                <DragMinigame onComplete={(bonus) => { setRaceBonus(bonus); startRace(bonus); }} />
              )}
              {raceMode === "circuit" && (
                <CircuitMinigame onComplete={(bonus) => { setRaceBonus(bonus); startRace(bonus); }} />
              )}
              {raceMode === "drift" && (
                <DriftMinigame onComplete={(bonus) => { setRaceBonus(bonus); startRace(bonus); }} />
              )}
              {loading && (
                <div className="text-center font-mono text-sm text-zinc-400 py-2 animate-pulse">Resolving race...</div>
              )}
            </div>
          )}

          {racePhase === "result" && raceResult && (
            <div className={`rounded-xl p-5 space-y-4 border ${raceResult.challengerWins ? "border-green-600 bg-green-900/20" : "border-red-700 bg-red-900/20"}`}>
              {raceResult.pinkSlipChallenge ? (
                <div>
                  <div className="font-bold text-yellow-400 text-lg">Pink-Slip Challenge Sent</div>
                  <div className="text-zinc-400 text-sm">Race ID: {raceResult.raceId} — opponent must accept.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className={`font-bold text-xl ${raceResult.challengerWins ? "text-green-400" : "text-red-400"}`}>
                    {raceResult.challengerWins ? "🏆 VICTORY" : "💀 DEFEAT"}
                  </div>
                  <div className="font-mono text-sm text-zinc-300">{raceResult.resultText}</div>
                  {raceResult.bonus > 0 && (
                    <div className="font-mono text-xs text-blue-400">
                      Minigame bonus: +{(raceResult.bonus * 100).toFixed(0)}%
                    </div>
                  )}
                  {raceResult.prize > 0 && (
                    <div className={`font-mono text-sm font-bold ${raceResult.challengerWins ? "text-green-400" : "text-red-400"}`}>
                      {raceResult.challengerWins ? "+" : "-"}{raceResult.prize?.toLocaleString()} DC
                    </div>
                  )}
                  {raceResult.pinkSlip && raceResult.transferredCar && (
                    <div className="font-mono text-xs text-yellow-400">
                      🏎️ {raceResult.challengerWins ? `You won ${raceResult.transferredCar}!` : `${raceResult.transferredCar} transferred.`}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => { setRacePhase("setup"); setRaceResult(null); setRaceBonus(0); refreshCars(); }}
                className="w-full py-2 rounded-lg font-mono text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600"
              >
                Race Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
