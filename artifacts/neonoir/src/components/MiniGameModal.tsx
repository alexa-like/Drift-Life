import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  type: "typing" | "pattern" | "timing" | "rhythm";
  onComplete: (multiplier: number) => void;
  onSkip: () => void;
}

// Typing Rush — type the phrase before timer runs out
function TypingGame({ onComplete, onSkip }: { onComplete: (m: number) => void; onSkip: () => void }) {
  const phrases = ["BREACH INITIATED", "ACCESS GRANTED", "TRANSFER COMPLETE", "SYSTEM OVERRIDE", "LOCK BYPASSED", "DATA EXTRACTED"];
  const [phrase] = useState(() => phrases[Math.floor(Math.random() * phrases.length)]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(10);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      setTimeLeft(n => {
        if (n <= 1) { clearInterval(t); setDone(true); onComplete(1.0); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [done, onComplete]);

  function handleInput(val: string) {
    setInput(val);
    if (val === phrase) {
      setDone(true);
      const mult = timeLeft >= 8 ? 1.5 : timeLeft >= 5 ? 1.3 : 1.15;
      onComplete(mult);
    }
  }

  return (
    <div>
      <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>Type the phrase to boost your earnings:</div>
      <div className="font-mono text-xl text-center mb-4 py-3 rounded" style={{ color: "#00d4ff", background: "#0a0a0f", border: "1px solid #1e1e2e", letterSpacing: "0.2em" }}>
        {phrase}
      </div>
      <input
        value={input}
        onChange={e => handleInput(e.target.value.toUpperCase())}
        autoFocus
        disabled={done}
        className="w-full px-3 py-2 rounded font-mono text-center"
        style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", letterSpacing: "0.1em" }}
        placeholder="TYPE HERE..."
      />
      <div className="flex justify-between mt-3 font-mono text-xs" style={{ color: "#64748b" }}>
        <span>Time: <span style={{ color: timeLeft <= 3 ? "#ff2d55" : "#f59e0b" }}>{timeLeft}s</span></span>
        <button onClick={onSkip} style={{ color: "#64748b" }}>Skip</button>
      </div>
    </div>
  );
}

// Pattern Match — remember and repeat the button sequence
function PatternGame({ onComplete, onSkip }: { onComplete: (m: number) => void; onSkip: () => void }) {
  const colors = ["#00d4ff", "#ff6b35", "#39d353", "#a855f7"];
  const labels = ["A", "B", "C", "D"];
  const [phase, setPhase] = useState<"show" | "input" | "done">("show");
  const [pattern] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)));
  const [showing, setShowing] = useState(0);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);

  useEffect(() => {
    if (phase !== "show") return;
    let i = 0;
    const interval = setInterval(() => {
      setLit(pattern[i]);
      setTimeout(() => setLit(null), 400);
      i++;
      if (i >= pattern.length) { clearInterval(interval); setTimeout(() => setPhase("input"), 700); }
    }, 700);
    return () => clearInterval(interval);
  }, [phase, pattern]);

  function press(idx: number) {
    if (phase !== "input") return;
    const next = [...userInput, idx];
    setLit(idx);
    setTimeout(() => setLit(null), 200);
    if (next[next.length - 1] !== pattern[next.length - 1]) {
      setPhase("done");
      onComplete(1.0);
      return;
    }
    setUserInput(next);
    if (next.length === pattern.length) {
      setPhase("done");
      onComplete(1.5);
    }
  }

  return (
    <div>
      <div className="font-mono text-xs mb-3 text-center" style={{ color: "#64748b" }}>
        {phase === "show" ? "Watch the pattern..." : phase === "input" ? "Repeat the pattern!" : "Done!"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {colors.map((c, i) => (
          <button
            key={i}
            onClick={() => press(i)}
            className="py-6 rounded font-mono font-bold text-xl transition-all"
            style={{
              background: lit === i ? c + "80" : c + "20",
              border: `2px solid ${c}${lit === i ? "ff" : "40"}`,
              color: c,
              boxShadow: lit === i ? `0 0 20px ${c}60` : "none",
            }}
          >
            {labels[i]}
          </button>
        ))}
      </div>
      <div className="text-center mt-3">
        <button onClick={onSkip} className="font-mono text-xs" style={{ color: "#64748b" }}>Skip</button>
      </div>
    </div>
  );
}

// Timing Clicker — click the button at the right moment
function TimingGame({ onComplete, onSkip }: { onComplete: (m: number) => void; onSkip: () => void }) {
  const [position, setPosition] = useState(0);
  const [done, setDone] = useState(false);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (done) return;
    let t = 0;
    const step = () => {
      t += 0.03;
      setPosition((Math.sin(t) + 1) / 2);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [done]);

  function click() {
    if (done) return;
    setDone(true);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    // 0.35–0.65 = perfect zone
    const dist = Math.abs(position - 0.5);
    const mult = dist < 0.05 ? 1.6 : dist < 0.10 ? 1.4 : dist < 0.15 ? 1.2 : 1.0;
    onComplete(mult);
  }

  return (
    <div>
      <div className="font-mono text-xs mb-3 text-center" style={{ color: "#64748b" }}>Click when the cursor is in the green zone</div>
      <div className="relative" style={{ height: 60, background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
        {/* Target zone */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: "35%", width: "30%",
          background: "#39d35320", borderLeft: "2px solid #39d35360", borderRight: "2px solid #39d35360",
        }} />
        {/* Moving cursor */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `${position * 90}%`,
          width: 20, height: 40, background: "#00d4ff",
          borderRadius: 4, boxShadow: "0 0 8px #00d4ff80",
          transition: "none",
        }} />
      </div>
      <button
        onClick={click}
        disabled={done}
        className="w-full font-mono font-bold text-lg py-3 rounded transition-all"
        style={{ background: "#00d4ff20", color: "#00d4ff", border: "2px solid #00d4ff60" }}
      >
        CLICK
      </button>
      <div className="text-center mt-3">
        <button onClick={onSkip} className="font-mono text-xs" style={{ color: "#64748b" }}>Skip</button>
      </div>
    </div>
  );
}

// Rhythm Tap — tap on beat
function RhythmGame({ onComplete, onSkip }: { onComplete: (m: number) => void; onSkip: () => void }) {
  const beats = [0, 500, 1000, 1500];
  const [currentBeat, setCurrentBeat] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (!started || done) return;
    startTime.current = performance.now();
    let b = 0;
    const t = setInterval(() => {
      setCurrentBeat(b);
      b++;
      if (b >= beats.length) { clearInterval(t); setTimeout(() => { setDone(true); calcScore(); }, 200); }
    }, 500);
    return () => clearInterval(t);
  }, [started]);

  function calcScore() {
    const avg = taps.reduce((a, b) => a + b, 0) / Math.max(1, taps.length);
    const mult = avg < 50 ? 1.5 : avg < 100 ? 1.3 : 1.1;
    onComplete(mult);
  }

  function tap() {
    if (!started) { setStarted(true); return; }
    if (done) return;
    const expected = beats[currentBeat];
    const actual = performance.now() - startTime.current;
    const diff = Math.abs(actual - expected);
    setTaps(t => [...t, diff]);
  }

  return (
    <div>
      <div className="font-mono text-xs mb-4 text-center" style={{ color: "#64748b" }}>
        {!started ? "Press to start, then tap on each beat" : done ? "Complete!" : `Beat ${currentBeat + 1} / ${beats.length}`}
      </div>
      <div className="flex justify-center gap-3 mb-6">
        {beats.map((_, i) => (
          <div key={i} style={{
            width: 40, height: 40, borderRadius: "50%",
            background: (started && i === currentBeat) ? "#a855f780" : i < currentBeat ? "#a855f730" : "#1e1e2e",
            border: `2px solid ${i === currentBeat && started ? "#a855f7" : "#1e1e2e"}`,
            boxShadow: (started && i === currentBeat) ? "0 0 12px #a855f780" : "none",
            transition: "all 0.1s",
          }} />
        ))}
      </div>
      <button
        onClick={tap}
        disabled={done}
        className="w-full font-mono font-bold text-lg py-4 rounded"
        style={{ background: "#a855f720", color: "#a855f7", border: "2px solid #a855f760", letterSpacing: "0.1em" }}
      >
        {!started ? "START / TAP" : "TAP"}
      </button>
      <div className="text-center mt-3">
        <button onClick={onSkip} className="font-mono text-xs" style={{ color: "#64748b" }}>Skip</button>
      </div>
    </div>
  );
}

const GAME_NAMES: Record<string, string> = {
  typing: "TYPING RUSH",
  pattern: "PATTERN MATCH",
  timing: "TIMING CLICKER",
  rhythm: "RHYTHM TAP",
};

export function MiniGameModal({ type, onComplete, onSkip }: Props) {
  const [result, setResult] = useState<number | null>(null);

  function handleComplete(multiplier: number) {
    setResult(multiplier);
    setTimeout(() => onComplete(multiplier), 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "#0a0a0f90" }}>
      <div style={{ background: "#111118", border: "1px solid #a855f740", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400 }}>
        <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>MINI GAME</div>
        <div className="font-mono font-bold text-lg mb-4" style={{ color: "#a855f7" }}>{GAME_NAMES[type]}</div>
        {result !== null ? (
          <div className="text-center py-6">
            <div className="font-mono font-bold text-3xl" style={{ color: result >= 1.4 ? "#39d353" : result >= 1.2 ? "#f59e0b" : "#94a3b8" }}>
              {result >= 1.4 ? "PERFECT" : result >= 1.2 ? "GOOD" : "OK"}
            </div>
            <div className="font-mono text-sm mt-2" style={{ color: "#a855f7" }}>{result.toFixed(1)}x bonus applied</div>
          </div>
        ) : (
          <>
            {type === "typing" && <TypingGame onComplete={handleComplete} onSkip={onSkip} />}
            {type === "pattern" && <PatternGame onComplete={handleComplete} onSkip={onSkip} />}
            {type === "timing" && <TimingGame onComplete={handleComplete} onSkip={onSkip} />}
            {type === "rhythm" && <RhythmGame onComplete={handleComplete} onSkip={onSkip} />}
          </>
        )}
      </div>
    </div>
  );
}
