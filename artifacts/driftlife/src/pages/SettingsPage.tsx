import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";

interface Props { user: User; refreshUser: () => Promise<User | null>; addToast: (msg: string, t?: string) => void; onLogout: () => void; }

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, padding: 2, cursor: "pointer",
        background: checked ? "#00d4ff" : "#1e1e2e",
        border: `1px solid ${checked ? "#00d4ff" : "#334155"}`,
        display: "flex", alignItems: "center",
        transition: "background 0.2s",
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: "50%", background: "#fff",
        transform: checked ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.2s",
      }} />
    </button>
  );
}

export function SettingsPage({ user, refreshUser, addToast, onLogout }: Props) {
  const [tab, setTab] = useState<"account" | "privacy" | "notifications" | "password" | "reset">("account");
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [changing, setChanging] = useState(false);
  const [resetEmail, setResetEmail] = useState(user.email);
  const [resetToken, setResetToken] = useState("");
  const [resetPass, setResetPass] = useState("");
  const [resetStep, setResetStep] = useState<"request"|"verify">("request");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const [appearOffline, setAppearOffline] = useState(user.appearOffline ?? false);
  const [dmPrivacy, setDmPrivacy] = useState<"anyone"|"nobody">(user.dmPrivacy ?? "anyone");
  const [liteMode, setLiteMode] = useState(user.liteModeEnabled ?? false);
  const [notifPrefs, setNotifPrefs] = useState(user.notificationPrefs ?? {
    achievements: true, dms: true, frameGifts: true, xpBoost: true, weeklyFrame: true,
  });

  async function savePrivacy() {
    setSaving(true);
    try {
      await api.patch<any>("/settings", { appearOffline, dmPrivacy, liteModeEnabled: liteMode });
      await refreshUser();
      addToast("Privacy settings saved", "success");
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSaving(true);
    try {
      await api.patch<any>("/settings", { notificationPrefs: notifPrefs });
      await refreshUser();
      addToast("Notification preferences saved", "success");
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

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
    { id: "account" as const, label: "Account" },
    { id: "privacy" as const, label: "Privacy" },
    { id: "notifications" as const, label: "Notifs" },
    { id: "password" as const, label: "Password" },
    { id: "reset" as const, label: "Reset" },
  ];

  const inputStyle = {
    background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0",
    outline: "none", borderRadius: 6, padding: "8px 12px", width: "100%",
    boxSizing: "border-box" as const, fontFamily: "monospace", fontSize: 13,
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-mono text-lg font-bold" style={{ color: "#00d4ff", letterSpacing: "0.1em", marginBottom: 16 }}>SETTINGS</h1>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono text-xs px-3 py-1.5 rounded"
            style={{
              background: tab === t.id ? "#00d4ff18" : "transparent",
              color: tab === t.id ? "#00d4ff" : "#64748b",
              border: tab === t.id ? "1px solid #00d4ff40" : "1px solid #1e1e2e",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Username", value: user.username },
              { label: "Tag", value: user.tag || "N/A" },
              { label: "Email", value: user.email },
              { label: "Role", value: user.role },
              { label: "Faction", value: user.faction || "None" },
              { label: "Merit Balance", value: `${(user.merit ?? 0).toLocaleString()} M` },
              { label: "Referral Code", value: user.referralCode },
              { label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e", paddingBottom: 10 }}>
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>{f.label}</span>
                <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{f.value}</span>
              </div>
            ))}
            <button onClick={onLogout} className="font-mono text-xs py-2 rounded" style={{ background: "#ff2d5510", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}>
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "privacy" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>Appear Offline</div>
              <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>Hide your online status from other players</div>
            </div>
            <Toggle checked={appearOffline} onChange={setAppearOffline} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>Lite Mode</div>
              <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>Reduce animations for better performance</div>
            </div>
            <Toggle checked={liteMode} onChange={setLiteMode} />
          </div>
          <div>
            <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0", marginBottom: 8 }}>DM Privacy</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["anyone", "Accept DMs"], ["nobody", "No DMs"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDmPrivacy(val as any)}
                  className="font-mono text-xs py-1.5 rounded flex-1"
                  style={{
                    background: dmPrivacy === val ? "#00d4ff18" : "transparent",
                    color: dmPrivacy === val ? "#00d4ff" : "#64748b",
                    border: dmPrivacy === val ? "1px solid #00d4ff40" : "1px solid #1e1e2e",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={savePrivacy}
            disabled={saving}
            className="font-mono text-xs py-2 rounded"
            style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Privacy Settings"}
          </button>
        </div>
      )}

      {tab === "notifications" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "achievements" as const, label: "Achievement unlocks", desc: "Notify when you earn an achievement" },
            { key: "dms" as const, label: "Direct Messages", desc: "Notify when you receive a DM" },
            { key: "frameGifts" as const, label: "Frame Gifts", desc: "Notify when a player gifts you a frame" },
            { key: "xpBoost" as const, label: "XP Boost Alerts", desc: "Notify about active XP bonus events" },
            { key: "weeklyFrame" as const, label: "Weekly Free Frame", desc: "Remind you when the free frame rotates" },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{label}</div>
                <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>{desc}</div>
              </div>
              <Toggle
                checked={notifPrefs[key] !== false}
                onChange={v => setNotifPrefs(prev => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
          <button
            onClick={saveNotifications}
            disabled={saving}
            className="font-mono text-xs py-2 rounded"
            style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Notification Preferences"}
          </button>
        </div>
      )}

      {tab === "password" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>CURRENT PASSWORD</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>NEW PASSWORD</label>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>CONFIRM NEW PASSWORD</label>
              <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} style={inputStyle} />
            </div>
            <button
              onClick={changePassword}
              disabled={changing || !current || !newPass || !newPass2}
              className="font-mono text-sm py-2 rounded"
              style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", cursor: "pointer" }}
            >
              {changing ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>
      )}

      {tab === "reset" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          {resetStep === "request" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                A 6-digit reset code will be sent to your email address.
              </p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>EMAIL</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={sendReset} disabled={sending} className="font-mono text-sm py-2 rounded"
                style={{ background: "#ff6b3520", color: "#ff6b35", border: "1px solid #ff6b3540", cursor: "pointer" }}>
                {sending ? "Sending..." : "Send Reset Code"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>Enter the code from your email and set a new password.</p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>RESET CODE</label>
                <input value={resetToken} onChange={e => setResetToken(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>NEW PASSWORD</label>
                <input type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={verifyReset} disabled={sending} className="font-mono text-sm py-2 rounded"
                style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}>
                {sending ? "Verifying..." : "Reset Password"}
              </button>
              <button onClick={() => setResetStep("request")} className="font-mono text-xs py-1"
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
