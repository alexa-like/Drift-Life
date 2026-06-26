import { useState } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; onLogout: () => void; }

export function SettingsPage({ user, refreshUser, addToast, onLogout }: Props) {
  const [tab, setTab] = useState<"account" | "password" | "reset">("account");
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [changing, setChanging] = useState(false);
  const [resetEmail, setResetEmail] = useState(user.email);
  const [resetToken, setResetToken] = useState("");
  const [resetPass, setResetPass] = useState("");
  const [resetStep, setResetStep] = useState<"request"|"verify">("request");
  const [sending, setSending] = useState(false);

  async function changePassword() {
    if (newPass !== newPass2) { addToast("Passwords don't match", "error"); return; }
    if (newPass.length < 6) { addToast("Password must be at least 6 characters", "error"); return; }
    setChanging(true);
    try {
      await api.post("/user/change-password", { currentPassword: current, newPassword: newPass });
      addToast("Password changed", "success");
      setCurrent(""); setNewPass(""); setNewPass2("");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setChanging(false);
    }
  }

  async function sendReset() {
    setSending(true);
    try {
      await api.post("/auth/forgot-password", { email: resetEmail });
      addToast("Reset code sent to your email", "success");
      setResetStep("verify");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  async function verifyReset() {
    if (resetPass.length < 6) { addToast("Password must be at least 6 characters", "error"); return; }
    setSending(true);
    try {
      await api.post("/auth/reset-password", { email: resetEmail, token: resetToken, password: resetPass });
      addToast("Password reset. Please log in again.", "success");
      onLogout();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  const tabs = [
    { id: "account", label: "Account" },
    { id: "password", label: "Change Password" },
    { id: "reset", label: "Reset Password" },
  ] as const;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="font-mono text-lg font-bold" style={{ color: "#00d4ff" }}>SETTINGS</h1>

      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono text-xs px-3 py-1 rounded"
            style={{
              background: tab === t.id ? "#00d4ff18" : "transparent",
              color: tab === t.id ? "#00d4ff" : "#64748b",
              border: tab === t.id ? "1px solid #00d4ff30" : "1px solid #1e1e2e",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="space-y-3">
            {[
              { label: "Username", value: user.username },
              { label: "Tag", value: user.tag || "N/A" },
              { label: "Email", value: user.email },
              { label: "Role", value: user.role },
              { label: "Faction", value: user.faction || "None" },
              { label: "Referral Code", value: user.referralCode },
              { label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
            ].map(f => (
              <div key={f.label} className="flex justify-between items-center" style={{ borderBottom: "1px solid #1e1e2e", paddingBottom: 8 }}>
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>{f.label}</span>
                <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "password" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>CURRENT PASSWORD</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>NEW PASSWORD</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>CONFIRM NEW PASSWORD</label>
              <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)}
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
            </div>
            <button
              onClick={changePassword}
              disabled={changing || !current || !newPass || !newPass2}
              className="w-full font-mono text-sm py-2 rounded"
              style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40" }}
            >
              {changing ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>
      )}

      {tab === "reset" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          {resetStep === "request" ? (
            <div className="space-y-3">
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                A 6-digit reset code will be sent to your email address.
              </p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>EMAIL</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono text-sm"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
              </div>
              <button onClick={sendReset} disabled={sending} className="w-full font-mono text-sm py-2 rounded"
                style={{ background: "#ff6b3520", color: "#ff6b35", border: "1px solid #ff6b3540" }}>
                {sending ? "Sending..." : "Send Reset Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>Enter the code from your email and set a new password.</p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>RESET CODE</label>
                <input value={resetToken} onChange={e => setResetToken(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono text-sm"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
              </div>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>NEW PASSWORD</label>
                <input type="password" value={resetPass} onChange={e => setResetPass(e.target.value)}
                  className="w-full px-3 py-2 rounded font-mono text-sm"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
              </div>
              <button onClick={verifyReset} disabled={sending} className="w-full font-mono text-sm py-2 rounded"
                style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}>
                {sending ? "Verifying..." : "Reset Password"}
              </button>
              <button onClick={() => setResetStep("request")} className="w-full font-mono text-xs py-1"
                style={{ color: "#64748b" }}>Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
