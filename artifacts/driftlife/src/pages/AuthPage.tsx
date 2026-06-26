import { useState } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

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
        if (data.needsVerification) {
          setPendingEmail(data.email);
          setMode("verify");
          return;
        }
        onLogin(data.accessToken, data.refreshToken, data.user);
      } else if (mode === "register") {
        await api.post("/auth/register", { email, username, password });
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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#0a0a0f" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold font-mono tracking-widest"
            style={{ color: "#00d4ff", textShadow: "0 0 20px #00d4ff60" }}
          >
            DRIFTLIFE
          </h1>
          <p className="text-xs font-mono mt-2" style={{ color: "#475569" }}>
            NEW VANTA / 2047
          </p>
        </div>

        <div
          className="rounded-lg p-6"
          style={{ background: "#111118", border: "1px solid #1e1e2e" }}
        >
          {/* Tabs */}
          {mode !== "verify" && (
            <div className="flex gap-2 mb-6">
              {(["login", "register"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className="flex-1 py-2 text-xs font-mono rounded transition-all uppercase"
                  style={{
                    background: mode === m ? "#00d4ff18" : "transparent",
                    color: mode === m ? "#00d4ff" : "#475569",
                    border: mode === m ? "1px solid #00d4ff40" : "1px solid #1e1e2e",
                  }}
                >
                  {m === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          {mode === "verify" && (
            <div className="mb-6">
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
                className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
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
                className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
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
                className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
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
                placeholder="6-digit code"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                maxLength={6}
                required
                className="w-full px-3 py-2 rounded font-mono text-center text-2xl tracking-widest outline-none"
                style={{
                  background: "#0a0a0f",
                  border: "1px solid #1e1e2e",
                  color: "#00d4ff",
                }}
              />
            )}

            {error && (
              <p
                className="text-xs font-mono text-center"
                style={{ color: error.includes("sent") ? "#39d353" : "#ff2d55" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-mono text-sm font-bold uppercase transition-all"
              style={{
                background: loading ? "#1e1e2e" : "#00d4ff18",
                color: loading ? "#475569" : "#00d4ff",
                border: "1px solid #00d4ff40",
                boxShadow: loading ? "none" : "0 0 12px #00d4ff20",
              }}
            >
              {loading ? "..." : mode === "login" ? "Access" : mode === "register" ? "Create" : "Verify"}
            </button>

            {mode === "verify" && (
              <button
                type="button"
                onClick={resendOtp}
                className="text-xs font-mono text-center underline"
                style={{ color: "#475569" }}
              >
                Resend code
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs font-mono mt-4" style={{ color: "#1e1e2e" }}>
          CORP-FREE ZONE / ENCRYPTED
        </p>
      </div>
    </div>
  );
}
