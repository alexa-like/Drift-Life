import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CyberButton } from "../components/CyberButton";

type Mode = "login" | "register" | "verify";

interface Props {
  onLogin: (accessToken: string, refreshToken: string, user: User) => void;
}

const GRID_LINES = 20;

export function AuthPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await api.post<any>("/auth/login", { email, password });
        onLogin(data.accessToken, data.refreshToken, data.user);
      } else if (mode === "register") {
        const data = await api.post<any>("/auth/register", { email, username, password });
        if (data.autoVerified) { onLogin(data.accessToken, data.refreshToken, data.user); return; }
        if (data.needsVerification) { setPendingEmail(data.email ?? email); setMode("verify"); setError(data.message ?? "Check your email for a verification code."); return; }
        setPendingEmail(email);
        setMode("verify");
      } else {
        const data = await api.post<any>("/auth/verify-email", { email: pendingEmail, otp });
        onLogin(data.accessToken, data.refreshToken, data.user);
      }
    } catch (err: any) {
      if (err.data?.needsVerification) {
        const verifyEmail = err.data.email ?? email;
        setPendingEmail(verifyEmail);
        setMode("verify");
        try {
          await api.post("/auth/resend-otp", { email: verifyEmail });
          setError("Your account isn't verified yet. A new code has been sent to your email.");
        } catch {
          setError("Your account isn't verified yet. Tap resend below to get a new code.");
        }
        return;
      }
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    try {
      await api.post("/auth/resend-otp", { email: pendingEmail });
      setError("New code sent");
    } catch (err: any) { setError(err.message); }
  }

  const isSuccess = error.includes("sent");

  const inputStyle: React.CSSProperties = {
    background: "#0a0a0f",
    border: "1px solid #1e1e2e",
    color: "#e2e8f0",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "#0a0a0f" }}>
      {/* Neon grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.07 }}>
        {Array.from({ length: GRID_LINES }).map((_, i) => (
          <div key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: `${(i / GRID_LINES) * 100}%`, height: 1, background: "linear-gradient(90deg, transparent, #00d4ff, transparent)" }} />
        ))}
        {Array.from({ length: GRID_LINES }).map((_, i) => (
          <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${(i / GRID_LINES) * 100}%`, width: 1, background: "linear-gradient(180deg, transparent, #00d4ff, transparent)" }} />
        ))}
      </div>

      {/* Moving scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, #00d4ff40, transparent)",
        top: `${(tick * 1.5) % 100}%`,
        pointerEvents: "none",
        transition: "top 0.08s linear",
      }} />

      {/* Glow orbs */}
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #00d4ff06 0%, transparent 70%)", top: -150, left: -150, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, #a855f706 0%, transparent 70%)", bottom: -100, right: -100, pointerEvents: "none" }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h1 className="text-5xl font-bold font-mono tracking-widest" style={{
            color: "#00d4ff",
            textShadow: "0 0 20px #00d4ff, 0 0 40px #00d4ff60, 0 0 80px #00d4ff20",
            letterSpacing: "0.2em",
          }}>
            DRIFTLIFE
          </h1>
          <div className="font-mono mt-2 text-xs tracking-widest" style={{ color: "#475569" }}>NEW VANTA / 2047</div>
          <div className="font-mono mt-1 text-xs" style={{ color: "#1e1e2e" }}>▓▓▓ ENCRYPTED UPLINK ▓▓▓</div>
        </motion.div>

        {/* Card */}
        <motion.div
          className="rounded-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          style={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            boxShadow: "0 0 40px #00d4ff08, inset 0 1px 0 #ffffff06",
          }}
        >
          {/* Mode tabs */}
          {mode !== "verify" && (
            <div className="flex gap-2 mb-6">
              {(["login", "register"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2 text-xs font-mono rounded uppercase transition-all duration-200"
                  style={{
                    background: mode === m ? "#00d4ff14" : "transparent",
                    color: mode === m ? "#00d4ff" : "#475569",
                    border: mode === m ? "1px solid #00d4ff40" : "1px solid #1e1e2e",
                    boxShadow: mode === m ? "0 0 14px #00d4ff18" : "none",
                    letterSpacing: "0.08em",
                  }}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          {/* Verify mode header */}
          {mode === "verify" && (
            <motion.div
              className="mb-6 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="font-mono text-2xl mb-2" style={{ filter: "grayscale(0)" }}>📨</div>
              <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>
                Verification code sent to{" "}
                <span style={{ color: "#00d4ff" }}>{pendingEmail}</span>
              </p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Username (3-20 chars)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded font-mono text-sm focus:border-cyan-400"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "#00d4ff50"; e.target.style.boxShadow = "0 0 10px #00d4ff15"; }}
                onBlur={e => { e.target.style.borderColor = "#1e1e2e"; e.target.style.boxShadow = "none"; }}
              />
            )}
            {mode !== "verify" && (
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded font-mono text-sm"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "#00d4ff50"; e.target.style.boxShadow = "0 0 10px #00d4ff15"; }}
                onBlur={e => { e.target.style.borderColor = "#1e1e2e"; e.target.style.boxShadow = "none"; }}
              />
            )}
            {mode !== "verify" && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded font-mono text-sm"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "#00d4ff50"; e.target.style.boxShadow = "0 0 10px #00d4ff15"; }}
                onBlur={e => { e.target.style.borderColor = "#1e1e2e"; e.target.style.boxShadow = "none"; }}
              />
            )}
            {mode === "verify" && (
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                required
                className="w-full px-3 py-4 rounded font-mono text-center text-3xl tracking-[0.4em]"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #00d4ff40",
                  color: "#00d4ff",
                  outline: "none",
                  boxShadow: "0 0 14px #00d4ff12",
                }}
                onFocus={e => { e.target.style.borderColor = "#00d4ff80"; e.target.style.boxShadow = "0 0 20px #00d4ff20"; }}
                onBlur={e => { e.target.style.borderColor = "#00d4ff40"; e.target.style.boxShadow = "0 0 14px #00d4ff12"; }}
              />
            )}

            {error && (
              <motion.div
                className="text-xs font-mono text-center px-3 py-2 rounded"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: isSuccess ? "#39d353" : "#ff2d55",
                  background: isSuccess ? "#39d35310" : "#ff2d5510",
                  border: `1px solid ${isSuccess ? "#39d35330" : "#ff2d5530"}`,
                }}
              >
                {isSuccess ? "✓ " : "⚠ "}{error}
              </motion.div>
            )}

            <CyberButton
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-1 uppercase tracking-widest"
            >
              {loading ? "Connecting..." : mode === "login" ? "Access" : mode === "register" ? "Create" : "Verify"}
            </CyberButton>

            {mode === "verify" && (
              <button
                type="button"
                onClick={resendOtp}
                className="text-xs font-mono text-center"
                style={{ color: "#475569" }}
              >
                Didn't get a code?{" "}
                <span style={{ color: "#00d4ff70", textDecoration: "underline" }}>Resend</span>
              </button>
            )}
          </form>
        </motion.div>

        <motion.p
          className="text-center text-xs font-mono mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ color: "#1e1e2e" }}
        >
          CORP-FREE ZONE · E2E ENCRYPTED · NEW VANTA 2047
        </motion.p>
      </div>
    </div>
  );
}
