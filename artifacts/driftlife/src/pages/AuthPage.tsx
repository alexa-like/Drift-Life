import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

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
        if (data.needsVerification) {
          setPendingEmail(data.email);
          setMode("verify");
          return;
        }
        onLogin(data.accessToken, data.refreshToken, data.user);
      } else if (mode === "register") {
        const data = await api.post<any>("/auth/register", { email, username, password });
        if (data.autoVerified) {
          onLogin(data.accessToken, data.refreshToken, data.user);
          return;
        }
        setPendingEmail(email);
        setMode("verify");
      } else {
        const data = await api.post<any>("/auth/verify-email", {
          email: pendingEmail,
          otp,
        });
        onLogin(data.accessToken, data.refreshToken, data.user);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    try {
      await api.post("/auth/resend-otp", { email: pendingEmail });
      setError("New code sent");
    } catch (err: any) {
      setError(err.message);
    }
  }

  const isSuccess = error.includes("sent");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "#0a0a0f" }}
    >
      {/* Neon grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.08 }}>
        {Array.from({ length: GRID_LINES }).map((_, i) => (
          <div key={`h${i}`} style={{
            position: "absolute",
            left: 0, right: 0,
            top: `${(i / GRID_LINES) * 100}%`,
            height: 1,
            background: "linear-gradient(90deg, transparent, #00d4ff, transparent)",
          }} />
        ))}
        {Array.from({ length: GRID_LINES }).map((_, i) => (
          <div key={`v${i}`} style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: `${(i / GRID_LINES) * 100}%`,
            width: 1,
            background: "linear-gradient(180deg, transparent, #00d4ff, transparent)",
          }} />
        ))}
      </div>

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, #00d4ff30, transparent)",
          top: `${(tick * 1.5) % 100}%`,
          pointerEvents: "none",
          transition: "top 0.08s linear",
        }}
      />

      {/* Glowing orbs */}
      <div style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, #00d4ff08 0%, transparent 70%)",
        top: "-100px", left: "-100px", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 350, height: 350, borderRadius: "50%",
        background: "radial-gradient(circle, #a855f708 0%, transparent 70%)",
        bottom: "-80px", right: "-80px", pointerEvents: "none",
      }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold font-mono tracking-widest animate-fade-in-up"
            style={{
              color: "#00d4ff",
              textShadow: "0 0 20px #00d4ff, 0 0 40px #00d4ff60, 0 0 80px #00d4ff20",
              letterSpacing: "0.2em",
            }}
          >
            DRIFTLIFE
          </h1>
          <div className="font-mono mt-2 text-xs tracking-widest" style={{ color: "#475569" }}>
            NEW VANTA / 2047
          </div>
          <div className="font-mono mt-1 text-xs" style={{ color: "#1e1e2e" }}>
            ▓▓▓ ENCRYPTED UPLINK ▓▓▓
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-lg p-6 animate-fade-in-up"
          style={{
            background: "#111118",
            border: "1px solid #1e1e2e",
            boxShadow: "0 0 30px #00d4ff08, inset 0 1px 0 #ffffff08",
            animationDelay: "0.1s",
          }}
        >
          {/* Tabs */}
          {mode !== "verify" && (
            <div className="flex gap-2 mb-6">
              {(["login", "register"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2 text-xs font-mono rounded uppercase transition-all"
                  style={{
                    background: mode === m ? "#00d4ff18" : "transparent",
                    color: mode === m ? "#00d4ff" : "#475569",
                    border: mode === m ? "1px solid #00d4ff40" : "1px solid #1e1e2e",
                    boxShadow: mode === m ? "0 0 12px #00d4ff15" : "none",
                  }}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          {mode === "verify" && (
            <div className="mb-6">
              <div className="text-center mb-2" style={{ fontSize: 28 }}>📨</div>
              <p className="text-xs font-mono text-center" style={{ color: "#94a3b8" }}>
                Verification code sent to{" "}
                <span style={{ color: "#00d4ff" }}>{pendingEmail}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Username (3-20 chars)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded font-mono text-sm"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                }}
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
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                }}
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
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#e2e8f0",
                }}
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
                className="w-full px-3 py-3 rounded font-mono text-center text-2xl tracking-widest"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #00d4ff30",
                  color: "#00d4ff",
                  boxShadow: "0 0 10px #00d4ff10",
                }}
              />
            )}

            {error && (
              <div
                className="text-xs font-mono text-center px-3 py-2 rounded"
                style={{
                  color: isSuccess ? "#39d353" : "#ff2d55",
                  background: isSuccess ? "#39d35310" : "#ff2d5510",
                  border: `1px solid ${isSuccess ? "#39d35330" : "#ff2d5530"}`,
                }}
              >
                {isSuccess ? "✓ " : "⚠ "}{error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-mono text-sm font-bold uppercase transition-all"
              style={{
                background: loading ? "#1e1e2e" : "#00d4ff18",
                color: loading ? "#475569" : "#00d4ff",
                border: "1px solid #00d4ff40",
                boxShadow: loading ? "none" : "0 0 16px #00d4ff20",
                letterSpacing: "0.1em",
              }}
            >
              {loading ? "Connecting..." : mode === "login" ? "Access" : mode === "register" ? "Create" : "Verify"}
            </button>

            {mode === "verify" && (
              <button
                type="button"
                onClick={resendOtp}
                className="text-xs font-mono text-center"
                style={{ color: "#475569" }}
              >
                Didn't get a code? <span style={{ color: "#00d4ff80", textDecoration: "underline" }}>Resend</span>
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs font-mono mt-4" style={{ color: "#1e1e2e" }}>
          CORP-FREE ZONE · E2E ENCRYPTED · NEW VANTA 2047
        </p>
      </div>
    </div>
  );
}
