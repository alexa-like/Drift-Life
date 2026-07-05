import { useState } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, t?: string) => void;
  onLogout: () => void;
}

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
        flexShrink: 0,
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

const INPUT = {
  background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0",
  outline: "none", borderRadius: 6, padding: "8px 12px", width: "100%",
  boxSizing: "border-box" as const, fontFamily: "monospace", fontSize: 13,
};

export function SettingsPage({ user, refreshUser, addToast, onLogout }: Props) {
  const [tab,        setTab]      = useState<"account" | "privacy" | "notifications" | "password" | "reset">("account");
  const [current,   setCurrent]  = useState("");
  const [newPass,   setNewPass]  = useState("");
  const [newPass2,  setNewPass2] = useState("");
  const [changing,  setChanging] = useState(false);
  const [resetEmail, setResetEmail] = useState(user.email);
  const [resetToken, setResetToken] = useState("");
  const [resetPass,  setResetPass]  = useState("");
  const [resetStep,  setResetStep]  = useState<"request"|"verify">("request");
  const [sending,  setSending]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const [appearOffline, setAppearOffline] = useState(user.appearOffline ?? false);
  const [dmPrivacy,     setDmPrivacy]     = useState<"anyone"|"nobody">(user.dmPrivacy ?? "anyone");
  const [liteMode,      setLiteMode]      = useState(user.liteModeEnabled ?? false);
  const [notifPrefs,    setNotifPrefs]    = useState(user.notificationPrefs ?? {
    achievements: true, dms: true, xpBoost: true,
  });

  async function savePrivacy() {
    setSaving(true);
    try {
      await api.patch<any>("/settings", { appearOffline, dmPrivacy, liteModeEnabled: liteMode });
      await refreshUser();
      addToast("Privacy settings saved", "success");
    } catch { addToast("Failed to save settings", "error"); }
    finally { setSaving(false); }
  }

  async function saveNotifications() {
    setSaving(true);
    try {
      await api.patch<any>("/settings", { notificationPrefs: notifPrefs });
      await refreshUser();
      addToast("Notification preferences saved", "success");
    } catch { addToast("Failed to save settings", "error"); }
    finally { setSaving(false); }
  }

  async function changePassword() {
    if (newPass !== newPass2) { addToast("Passwords don't match", "error"); return; }
    if (newPass.length < 6)  { addToast("Password must be at least 6 characters", "error"); return; }
    setChanging(true);
    try {
      await api.post("/user/change-password", { currentPassword: current, newPassword: newPass });
      addToast("Password changed", "success");
      setCurrent(""); setNewPass(""); setNewPass2("");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setChanging(false); }
  }

  async function sendReset() {
    setSending(true);
    try {
      await api.post("/auth/forgot-password", { email: resetEmail });
      addToast("Reset code sent to your email", "success");
      setResetStep("verify");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSending(false); }
  }

  async function verifyReset() {
    if (resetPass.length < 6) { addToast("Password must be at least 6 characters", "error"); return; }
    setSending(true);
    try {
      await api.post("/auth/reset-password", { email: resetEmail, token: resetToken, password: resetPass });
      addToast("Password reset. Please log in again.", "success");
      onLogout();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSending(false); }
  }

  const TABS = [
    { id: "account"       as const, label: "Account"  },
    { id: "privacy"       as const, label: "Privacy"  },
    { id: "notifications" as const, label: "Notifs"   },
    { id: "password"      as const, label: "Password" },
    { id: "reset"         as const, label: "Reset"    },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }} className="space-y-4">
      <CyberSectionHeader title="SETTINGS" accent="#00d4ff" cursor />

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <CyberButton
            key={t.id}
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            glow={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </CyberButton>
        ))}
      </div>

      {/* Account */}
      {tab === "account" && (
        <AnimatedCard accent="#00d4ff">
          <div className="flex flex-col gap-3">
            {[
              { label: "Username",      value: user.username },
              { label: "Tag",           value: user.tag || "N/A" },
              { label: "Email",         value: user.email },
              { label: "Role",          value: user.role },
              { label: "Faction",       value: user.faction || "None" },
              { label: "Merit Balance", value: `${(user.merit ?? 0).toLocaleString()} M` },
              { label: "Referral Code", value: user.referralCode },
              { label: "Member since",  value: new Date(user.createdAt).toLocaleDateString() },
            ].map(f => (
              <div
                key={f.label}
                className="flex justify-between items-center pb-2"
                style={{ borderBottom: "1px solid #1e1e2e" }}
              >
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>{f.label}</span>
                <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{f.value}</span>
              </div>
            ))}
            <CyberButton variant="danger" size="sm" onClick={onLogout} className="mt-1">
              Log Out
            </CyberButton>
          </div>
        </AnimatedCard>
      )}

      {/* Privacy */}
      {tab === "privacy" && (
        <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
          {[
            { label: "Appear Offline", desc: "Hide your online status from other players", val: appearOffline, set: setAppearOffline },
            { label: "Lite Mode",      desc: "Reduce animations for better performance",   val: liteMode,      set: setLiteMode      },
          ].map(({ label, desc, val, set }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{label}</div>
                <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>{desc}</div>
              </div>
              <Toggle checked={val} onChange={set} />
            </div>
          ))}
          <div>
            <div className="font-mono text-xs font-bold mb-2" style={{ color: "#e2e8f0" }}>DM Privacy</div>
            <div className="flex gap-2">
              {(["anyone", "nobody"] as const).map(val => (
                <CyberButton
                  key={val}
                  size="sm"
                  variant={dmPrivacy === val ? "primary" : "ghost"}
                  className="flex-1"
                  onClick={() => setDmPrivacy(val)}
                >
                  {val === "anyone" ? "Accept DMs" : "No DMs"}
                </CyberButton>
              ))}
            </div>
          </div>
          <CyberButton variant="primary" loading={saving} onClick={savePrivacy}>
            Save Privacy Settings
          </CyberButton>
        </AnimatedCard>
      )}

      {/* Notifications */}
      {tab === "notifications" && (
        <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
          {[
            { key: "achievements" as const, label: "Achievement unlocks",  desc: "Notify when you earn an achievement"         },
            { key: "dms"          as const, label: "Direct Messages",      desc: "Notify when you receive a DM"                },
            { key: "xpBoost"      as const, label: "XP Boost Alerts",      desc: "Notify about active XP bonus events"         },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3">
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
          <CyberButton variant="primary" loading={saving} onClick={saveNotifications}>
            Save Notification Preferences
          </CyberButton>
        </AnimatedCard>
      )}

      {/* Password */}
      {tab === "password" && (
        <AnimatedCard accent="#00d4ff" className="flex flex-col gap-3">
          {[
            { label: "CURRENT PASSWORD", val: current,  set: setCurrent,  type: "password" },
            { label: "NEW PASSWORD",     val: newPass,  set: setNewPass,  type: "password" },
            { label: "CONFIRM NEW",      val: newPass2, set: setNewPass2, type: "password" },
          ].map(f => (
            <div key={f.label}>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>{f.label}</label>
              <input
                type={f.type}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                style={INPUT}
              />
            </div>
          ))}
          <CyberButton
            variant="primary"
            loading={changing}
            disabled={!current || !newPass || !newPass2}
            onClick={changePassword}
          >
            Change Password
          </CyberButton>
        </AnimatedCard>
      )}

      {/* Reset */}
      {tab === "reset" && (
        <AnimatedCard accent="#ff6b35" className="flex flex-col gap-3">
          {resetStep === "request" ? (
            <>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                A 6-digit reset code will be sent to your email address.
              </p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>EMAIL</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={INPUT} />
              </div>
              <CyberButton variant="warning" loading={sending} onClick={sendReset}>
                Send Reset Code
              </CyberButton>
            </>
          ) : (
            <>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                Enter the code from your email and set a new password.
              </p>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>RESET CODE</label>
                <input value={resetToken} onChange={e => setResetToken(e.target.value)} style={INPUT} />
              </div>
              <div>
                <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>NEW PASSWORD</label>
                <input type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} style={INPUT} />
              </div>
              <CyberButton variant="success" loading={sending} onClick={verifyReset}>
                Reset Password
              </CyberButton>
              <button
                onClick={() => setResetStep("request")}
                className="font-mono text-xs"
                style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer" }}
              >
                Back
              </button>
            </>
          )}
        </AnimatedCard>
      )}
    </div>
  );
}
