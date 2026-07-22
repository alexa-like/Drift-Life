import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CyberButton } from "../components/CyberButton";

type Mode = "login" | "register" | "verify";

interface Props {
  onLogin: (accessToken: string, refreshToken: string, user: User) => void;
}

export function AuthPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

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

  return (
    <div className="flex items-center justify-center p-4 relative overflow-hidden" style={{ minHeight: "calc(100dvh / var(--dl-scale, 1))", background: "var(--dl-bg, #08080c)" }}>
      <div className="dl-page-bg bg-terminal" />
      
      {/* 3D Perspective Grid Background */}
      <div className="absolute inset-0 perspective-[1000px] overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute inset-x-[-50%] bottom-[-50%] top-[50%] dl-bg-grid"
          animate={{ backgroundPosition: ["0px 0px", "0px 40px"] }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ transform: "rotateX(60deg) scale(2)", opacity: 0.5 }}
        />
      </div>

      {/* Matrix Rain effect overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 data-stream" />

      {/* Full screen scanlines */}
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header / Logo */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-5xl sm:text-7xl font-display font-black tracking-widest uppercase glitch-text mb-2" style={{
            color: "#00d4ff",
            textShadow: "0 0 20px #00d4ff, 0 0 40px #00d4ff60",
          }}>
            NEONOIR
          </h1>
          <div className="font-mono text-sm tracking-[0.3em] font-bold text-[#ff2d55] animate-pulse">
            SYSTEM ACCESS // TERMINAL
          </div>
        </motion.div>

        {/* Auth Form Container */}
        <motion.div
          className="clip-card p-8 relative backdrop-blur-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          style={{
            background: "rgba(8, 8, 16, 0.85)",
            border: "1px solid #00d4ff40",
            boxShadow: "0 0 40px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)",
          }}
        >
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00d4ff] opacity-50" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00d4ff] opacity-50" />

          {/* Mode Tabs */}
          {mode !== "verify" && (
            <div className="flex gap-4 mb-8">
              {(["login", "register"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-3 text-sm font-mono font-bold uppercase transition-all duration-300 clip-btn"
                  style={{
                    background: mode === m ? "#00d4ff15" : "#111118",
                    color: mode === m ? "#00d4ff" : "#64748b",
                    border: mode === m ? "1px solid #00d4ff80" : "1px solid #1e1e2e",
                    boxShadow: mode === m ? "0 0 15px rgba(0, 212, 255, 0.2)" : "none",
                    letterSpacing: "0.1em",
                  }}
                >
                  {m === "login" ? "Initialize" : "Register"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {mode === "register" && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#00d4ff] font-bold animate-pulse">{">"}</span>
                <input
                  type="text"
                  placeholder="USERNAME"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="w-full font-mono text-sm uppercase py-3 pl-8 bg-black/50"
                />
              </div>
            )}
            
            {mode !== "verify" && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#00d4ff] font-bold animate-pulse">{">"}</span>
                <input
                  type="email"
                  placeholder="EMAIL_ADDRESS"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full font-mono text-sm uppercase py-3 pl-8 bg-black/50"
                />
              </div>
            )}
            
            {mode !== "verify" && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#00d4ff] font-bold animate-pulse">{">"}</span>
                <input
                  type="password"
                  placeholder="SECURITY_KEY"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full font-mono text-sm py-3 pl-8 bg-black/50"
                />
              </div>
            )}

            {mode === "verify" && (
              <div className="text-center">
                <div className="font-mono text-sm text-[#00d4ff] mb-4">
                  AWAITING TRANSMISSION TO: <br/>
                  <span className="text-white">{pendingEmail}</span>
                </div>
                <input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  required
                  className="w-full py-4 font-mono text-center text-4xl tracking-[0.5em] bg-black/50 clip-btn"
                  style={{
                    border: "1px solid #00d4ff80",
                    color: "#00d4ff",
                    textShadow: "0 0 10px #00d4ff",
                    boxShadow: "inset 0 0 20px #00d4ff20"
                  }}
                />
              </div>
            )}

            {error && (
              <div 
                className="text-xs font-mono px-4 py-3 clip-bar uppercase tracking-wider"
                style={{
                  color: isSuccess ? "#39d353" : "#ff2d55",
                  background: isSuccess ? "#39d35315" : "#ff2d5515",
                  border: `1px solid ${isSuccess ? "#39d353" : "#ff2d55"}`,
                }}
              >
                {isSuccess ? "TRANSMISSION SUCCESS: " : "ERR: "}{error}
              </div>
            )}

            <CyberButton
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {loading ? "CONNECTING..." : mode === "login" ? "ACCESS NETWORK" : mode === "register" ? "CREATE UPLINK" : "VERIFY CODE"}
            </CyberButton>

            {mode === "verify" && (
              <button
                type="button"
                onClick={resendOtp}
                className="text-xs font-mono text-[#64748b] hover:text-[#00d4ff] transition-colors mt-2"
              >
                NO SIGNAL? [ RESEND_CODE ]
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
