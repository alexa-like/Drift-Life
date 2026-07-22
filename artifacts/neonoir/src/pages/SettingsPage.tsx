import { useState, useEffect, useRef } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import {
  isPushSupported,
  getPushPermission,
  getSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isWebView,
} from "../lib/pushNotifications";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";
import { usePreferences, DEFAULT_SCALE, MIN_SCALE, MAX_SCALE } from "../context/PreferencesContext";
import { ConnectionsPage } from "./ConnectionsPage";
import { ConfirmDialog } from "../components/ConfirmDialog";

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

// ── 6.4a — Telegram Link / Unlink Section ─────────────────────────────────────
function TelegramSection({
  user,
  addToast,
  refreshUser,
}: {
  user: User;
  addToast: (msg: string, t?: string) => void;
  refreshUser: () => Promise<User | null>;
}) {
  const [linked,       setLinked]       = useState(user.telegramLinked ?? false);
  const [tgUsername,   setTgUsername]   = useState<string | null>(user.telegramUsername ?? null);
  const [code,         setCode]         = useState<string | null>(null);
  const [countdown,    setCountdown]    = useState(0);
  const [linkLoading,  setLinkLoading]  = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll /api/telegram/status every 5 s while waiting for user to send bot code
  useEffect(() => {
    if (!code || linked) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ linked: boolean; telegramUsername: string | null }>("/telegram/status");
        if (res.linked) {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          setLinked(true);
          setTgUsername(res.telegramUsername);
          setCode(null);
          addToast("Telegram linked! You'll now receive bot notifications.", "success");
          refreshUser().catch(() => {});
        }
      } catch { /* silent — do not surface poll errors */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [code, linked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown tick
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          clearInterval(pollRef.current!);
          setCode(null);
          addToast("Link code expired. Generate a new one.", "warning");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLinkInit() {
    setLinkLoading(true);
    try {
      const res = await api.post<{ code: string; expiresInMinutes: number }>("/telegram/link-init");
      setCode(res.code);
      setCountdown((res.expiresInMinutes ?? 10) * 60);
    } catch (e: any) {
      addToast(e.message || "Failed to generate link code", "error");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleUnlink() {
    setUnlinkLoading(true);
    try {
      await api.post("/telegram/unlink");
      setLinked(false);
      setTgUsername(null);
      setUnlinkConfirm(false);
      addToast("Telegram unlinked.", "success");
      refreshUser().catch(() => {});
    } catch (e: any) {
      addToast(e.message || "Failed to unlink Telegram", "error");
    } finally {
      setUnlinkLoading(false);
    }
  }

  function fmtCountdown(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  }

  // ── Linked state ───────────────────────────────────────────────────────────
  if (linked) {
    return (
      <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>📱</span>
          <div>
            <div className="font-mono text-xs font-bold" style={{ color: "#39d353" }}>✅ TELEGRAM LINKED</div>
            {tgUsername && (
              <div className="font-mono text-xs mt-0.5" style={{ color: "#94a3b8" }}>@{tgUsername}</div>
            )}
          </div>
        </div>
        <div className="font-mono text-xs" style={{ color: "#64748b", lineHeight: 1.6 }}>
          Notifications for DMs, auction bids, gang wars and more are sent to your Telegram. You can also use{" "}
          <span style={{ color: "#00d4ff" }}>/balance</span>,{" "}
          <span style={{ color: "#00d4ff" }}>/status</span>, and{" "}
          <span style={{ color: "#00d4ff" }}>/quests</span> in the bot.
        </div>
        {!unlinkConfirm ? (
          <CyberButton variant="danger" size="sm" onClick={() => setUnlinkConfirm(true)}>
            Unlink Telegram
          </CyberButton>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="font-mono text-xs" style={{ color: "#ff2d55" }}>
              Are you sure? You'll lose Telegram notifications and bot access.
            </div>
            <div className="flex gap-2">
              <CyberButton variant="danger" size="sm" loading={unlinkLoading} onClick={handleUnlink}>
                Confirm Unlink
              </CyberButton>
              <CyberButton variant="ghost" size="sm" onClick={() => setUnlinkConfirm(false)}>
                Cancel
              </CyberButton>
            </div>
          </div>
        )}
      </AnimatedCard>
    );
  }

  // ── Code shown — waiting for user to send to bot ───────────────────────────
  if (code) {
    return (
      <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
        <div className="font-mono text-xs font-bold" style={{ color: "#00d4ff" }}>LINK TELEGRAM</div>
        <div className="font-mono text-xs" style={{ color: "#94a3b8", lineHeight: 1.6 }}>
          Open <span style={{ color: "#00d4ff" }}>@NeonoirBot</span> on Telegram and send:
        </div>
        {/* Prominent code display */}
        <div
          className="font-mono text-center py-4 clip-card"
          style={{
            background: "#0a0a0f",
            border: "1px solid #00d4ff50",
            letterSpacing: 6,
            fontSize: 22,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          /link {code}
        </div>
        <div className="flex items-center justify-between">
          <div
            className="font-mono text-xs"
            style={{ color: countdown < 60 ? "#ff2d55" : "#64748b" }}
          >
            Expires in {fmtCountdown(countdown)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#39d353] animate-pulse" />
            <span className="font-mono text-xs" style={{ color: "#39d353" }}>Waiting…</span>
          </div>
        </div>
        <CyberButton
          variant="ghost"
          size="sm"
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setCode(null);
            setCountdown(0);
          }}
        >
          Cancel
        </CyberButton>
      </AnimatedCard>
    );
  }

  // ── Default — not linked ───────────────────────────────────────────────────
  return (
    <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 24 }}>📱</span>
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>LINK TELEGRAM</div>
          <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
            Connect your Telegram account to Neonoir
          </div>
        </div>
      </div>
      <div className="font-mono text-xs" style={{ color: "#64748b", lineHeight: 1.6 }}>
        Linking gives you notifications for DMs, bids, gang wars, and more — even when the game is closed.
        Also enables NC pack and subscription purchases via Telegram Stars.
      </div>
      <CyberButton variant="primary" loading={linkLoading} onClick={handleLinkInit}>
        Link Telegram
      </CyberButton>
    </AnimatedCard>
  );
}

export function SettingsPage({ user, refreshUser, addToast, onLogout }: Props) {
  const [tab,        setTab]      = useState<"account" | "appearance" | "privacy" | "notifications" | "connect" | "password" | "reset" | "navigation" | "telegram">("account");
  const [navOrder,    setNavOrder]    = useState<string[]>(user.navOrder ?? []);
  const [defaultPage, setDefaultPage] = useState<string>(user.defaultPage ?? "dashboard");
  const [savingNav,   setSavingNav]   = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("neonoir_sounds_enabled") === "true");
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

  // 12.3 — Referral stats
  const [referralStats, setReferralStats] = useState<{
    referralCode: string;
    referralLink: string;
    totalSignups: number;
    reachedLevel5: number;
    pendingRewards: number;
  } | null>(null);

  useEffect(() => {
    api.get<{
      referralCode: string;
      referralLink: string;
      totalSignups: number;
      reachedLevel5: number;
      pendingRewards: number;
    }>("/referral").then(setReferralStats).catch(() => {});
  }, []);

  const [appearOffline, setAppearOffline] = useState(user.appearOffline ?? false);
  const [dmPrivacy,     setDmPrivacy]     = useState<"anyone"|"nobody">(user.dmPrivacy ?? "anyone");
  const [liteMode,      setLiteMode]      = useState(user.liteModeEnabled ?? false);
  const [notifPrefs,    setNotifPrefs]    = useState(user.notificationPrefs ?? {
    achievements: true, dms: true, xpBoost: true,
    combat: true, crimes: true, faction: true, banking: true,
    auction: true, events: true, mentions: true,
  });

  // ── Push notification state ──────────────────────────────────────────────
  const [pushSupported,   setPushSupported]   = useState(false);
  const [pushPermission,  setPushPermission]  = useState<NotificationPermission>("default");
  const [pushSubscribed,  setPushSubscribed]  = useState(false);
  const [pushLoading,     setPushLoading]     = useState(false);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      setPushPermission(getPushPermission());
      getSubscriptionStatus().then(setPushSubscribed);
    }
  }, []);

  async function handlePushSubscribe() {
    setPushLoading(true);
    const result = await subscribeToPush();
    setPushPermission(getPushPermission());
    if (result.success) {
      setPushSubscribed(true);
      addToast("Push notifications enabled", "success");
    } else {
      addToast(result.error ?? "Failed to enable push notifications", "error");
    }
    setPushLoading(false);
  }

  async function handlePushUnsubscribe() {
    setPushLoading(true);
    await unsubscribeFromPush();
    setPushSubscribed(false);
    addToast("Push notifications disabled", "success");
    setPushLoading(false);
  }

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

  const { scale, setScale, theme, setTheme } = usePreferences();

  const ALL_NAV_ITEMS = [
    { id: "dashboard", label: "Home" }, { id: "feed", label: "Feed" }, { id: "chat", label: "Chat" },
    { id: "crimes", label: "Crimes" }, { id: "jobs", label: "Jobs" }, { id: "arena", label: "Arena" },
    { id: "garage", label: "Garage" }, { id: "inventory", label: "Inventory" }, { id: "store", label: "Store" },
    { id: "leaderboard", label: "Leaders" }, { id: "missions", label: "Missions" }, { id: "travel", label: "Travel" },
    { id: "daily", label: "Daily" }, { id: "achievements", label: "Awards" }, { id: "friends", label: "Friends" },
    { id: "profile", label: "Profile" }, { id: "settings", label: "Settings" }, { id: "auction", label: "Auction" },
    { id: "guilds", label: "Crew" }, { id: "faction", label: "Faction" }, { id: "business", label: "Biz" },
    { id: "training", label: "Training" }, { id: "loadout", label: "Loadout" }, { id: "city", label: "City" },
    { id: "notifications", label: "Alerts" },
  ];

  const effectiveNavOrder = navOrder.length > 0 ? navOrder : ALL_NAV_ITEMS.map(n => n.id);

  function moveNavItem(idx: number, dir: -1 | 1) {
    const order = [...effectiveNavOrder];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    setNavOrder(order);
  }

  async function saveNavPrefs() {
    setSavingNav(true);
    try {
      await api.patch("/settings/nav", { navOrder: effectiveNavOrder, defaultPage });
      await refreshUser();
      addToast("Navigation preferences saved!", "success");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingNav(false); }
  }

  const TABS = [
    { id: "account"       as const, label: "Account"    },
    { id: "appearance"    as const, label: "Appearance" },
    { id: "privacy"       as const, label: "Privacy"    },
    { id: "notifications" as const, label: "Notifs"     },
    { id: "connect"       as const, label: "Connect"    },
    { id: "telegram"      as const, label: "Telegram"   },
    { id: "password"      as const, label: "Password"   },
    { id: "reset"         as const, label: "Reset"      },
    { id: "navigation"    as const, label: "Nav"        },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }} className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
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

      {/* Appearance */}
      {tab === "appearance" && (
        <AnimatedCard accent="#a855f7" className="flex flex-col gap-5">

          {/* UI Scale */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div>
                <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>UI Scale</div>
                <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>
                  Zoom the whole game UI — smaller fits more on screen
                </div>
              </div>
              <span className="font-mono text-xs font-bold" style={{ color: "#a855f7", minWidth: 38, textAlign: "right" }}>
                {Math.round(scale * 100)}%
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.05}
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#a855f7", cursor: "pointer" }}
            />

            {/* Preset buttons */}
            <div className="flex gap-2 mt-2">
              {[
                { label: "60%",  v: 0.6  },
                { label: "75%",  v: 0.75 },
                { label: "85%",  v: 0.85 },
                { label: "100%", v: 1.0  },
                { label: "115%", v: 1.15 },
              ].map(({ label, v }) => (
                <button
                  key={v}
                  onClick={() => setScale(v)}
                  style={{
                    flex: 1,
                    fontFamily: "monospace", fontSize: 11, fontWeight: "bold",
                    padding: "5px 2px", borderRadius: 6, cursor: "pointer",
                    background: Math.abs(scale - v) < 0.01 ? "#a855f720" : "#1e1e2e",
                    border: `1px solid ${Math.abs(scale - v) < 0.01 ? "#a855f7" : "#334155"}`,
                    color: Math.abs(scale - v) < 0.01 ? "#a855f7" : "#64748b",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Reset to default */}
            {Math.abs(scale - DEFAULT_SCALE) > 0.01 && (
              <button
                onClick={() => setScale(DEFAULT_SCALE)}
                style={{
                  marginTop: 6, fontFamily: "monospace", fontSize: 10,
                  color: "#475569", background: "none", border: "none",
                  cursor: "pointer", padding: 0,
                }}
              >
                ↺ Reset to default (85%)
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1e1e2e" }} />

          {/* Color Theme */}
          <div>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: "#e2e8f0" }}>Color Theme</div>
            <div className="font-mono mb-3" style={{ color: "#64748b", fontSize: 11 }}>
              Dark mode is the default. Day mode inverts the palette for a bright background.
            </div>
            <div className="flex gap-3">
              {([
                { id: "dark"  as const, label: "🌙 Dark",  desc: "Night / Cyberpunk" },
                { id: "light" as const, label: "☀️ Day",   desc: "Bright / Inverted" },
              ]).map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                    background: theme === id ? "#a855f718" : "#1e1e2e",
                    border: `2px solid ${theme === id ? "#a855f7" : "#334155"}`,
                    boxShadow: theme === id ? "0 0 12px #a855f730" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  <div className="font-mono text-sm font-bold" style={{ color: theme === id ? "#a855f7" : "#64748b" }}>
                    {label}
                  </div>
                  <div className="font-mono" style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            className="font-mono text-xs px-3 py-2 rounded"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#475569" }}
          >
            ⚡ Scale and theme are saved to this device — each player can set their own.
          </div>
        </AnimatedCard>
      )}

      {/* Account */}
      {tab === "account" && (
        <>
          <AnimatedCard accent="#00d4ff">
            <div className="flex flex-col gap-3">
              {[
                { label: "Username",     value: user.username },
                { label: "Tag",          value: user.tag || "N/A" },
                { label: "Email",        value: user.email },
                { label: "Role",         value: user.role },
                { label: "Faction",      value: user.faction || "None" },
                { label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
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
              <CyberButton variant="danger" size="sm" onClick={() => setLogoutConfirm(true)} className="mt-1">
                Log Out
              </CyberButton>
            </div>
          </AnimatedCard>

          {/* 12.3 — Referral Section */}
          <AnimatedCard accent="#39d353">
            <div className="flex flex-col gap-3">
              <CyberSectionHeader title="REFERRAL" accent="#39d353" size="sm" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold" style={{ color: "#00d4ff", letterSpacing: "0.15em" }}>
                  {referralStats?.referralCode ?? user.referralCode}
                </span>
                <CyberButton size="sm" variant="ghost" onClick={() => {
                  const link = referralStats?.referralLink ?? `https://neonoir.app/register?ref=${user.referralCode}`;
                  navigator.clipboard?.writeText(link);
                  addToast("Referral link copied!", "success");
                }}>Copy Link</CyberButton>
              </div>
              <p className="font-mono" style={{ fontSize: 10, color: "#475569", wordBreak: "break-all" }}>
                {referralStats?.referralLink ?? `https://neonoir.app/register?ref=${user.referralCode}`}
              </p>
              {referralStats && (
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { label: "SIGNUPS", value: referralStats.totalSignups, color: "#f59e0b" },
                    { label: "ACTIVE (LV5+)", value: referralStats.reachedLevel5, color: "#39d353" },
                    { label: "PENDING", value: referralStats.pendingRewards, color: "#a855f7" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center", background: "#0a0a0f", borderRadius: 6, padding: "8px 4px", border: "1px solid #1e293b" }}>
                      <div className="font-mono font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                      <div className="font-mono mt-1" style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.05em" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>
                Earn 500 NC (first referral) or 300 NC when each person you invite reaches Level 5.
              </p>
            </div>
          </AnimatedCard>
        </>
      )}

      {logoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to keep playing."
          confirmLabel="Log Out"
          danger
          onConfirm={onLogout}
          onCancel={() => setLogoutConfirm(false)}
        />
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

          {/* ── Browser Push Notifications ─────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>
                Browser Push Notifications
              </div>
              {pushSubscribed && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9, fontWeight: "bold", letterSpacing: "0.05em",
                    color: "#22c55e", background: "#22c55e18",
                    border: "1px solid #22c55e40", borderRadius: 4, padding: "1px 6px",
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
            <div className="font-mono mb-3" style={{ color: "#64748b", fontSize: 11 }}>
              {isWebView()
                ? "Push notifications are not available inside webtoapp / WebView wrappers. Open Neonoir in Chrome or Safari, or install it as a PWA (Add to Home Screen) for full push support."
                : !pushSupported
                ? "Not supported in this browser. Open Neonoir in Chrome or Safari, or install it as a PWA for push support."
                : pushPermission === "denied"
                ? "Blocked — open your browser's site settings and allow notifications for this site."
                : pushSubscribed
                ? "You'll receive notifications even when the app is closed or minimized."
                : "Get notified about DMs, combat results, crimes, and more — even when Neonoir is closed."}
            </div>
            {pushSupported && pushPermission !== "denied" && (
              <CyberButton
                variant={pushSubscribed ? "ghost" : "primary"}
                size="sm"
                glow={!pushSubscribed}
                loading={pushLoading}
                onClick={pushSubscribed ? handlePushUnsubscribe : handlePushSubscribe}
              >
                {pushSubscribed ? "🔕 Disable Push Notifications" : "🔔 Enable Push Notifications"}
              </CyberButton>
            )}
            {!isWebView() && pushPermission === "denied" && (
              <div
                className="font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#ff6b3518", border: "1px solid #ff6b3540", color: "#ff6b35" }}
              >
                ⚠ Notifications blocked. Go to your browser's site settings to re-enable them.
              </div>
            )}
            {isWebView() && (
              <div
                className="font-mono text-xs px-3 py-2 rounded"
                style={{ background: "#a855f718", border: "1px solid #a855f740", color: "#a855f7" }}
              >
                💡 For push notifications, open Neonoir in your browser and use "Add to Home Screen" to install it as a PWA — or visit the game URL directly in Chrome.
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #1e1e2e" }} />

          {/* ── Per-type notification toggles ──────────────────────────── */}
          <div className="font-mono text-xs font-bold" style={{ color: "#64748b", letterSpacing: "0.08em" }}>
            NOTIFY ME ABOUT
          </div>
          {([
            { key: "achievements" as const, label: "Achievement Unlocks",  desc: "When you earn an achievement"               },
            { key: "dms"          as const, label: "Direct Messages",      desc: "When someone sends you a DM"               },
            { key: "mentions"     as const, label: "@Mentions",            desc: "When someone @mentions you in chat"         },
            { key: "auction"      as const, label: "Auction Alerts",       desc: "Outbids and auction wins"                   },
            { key: "events"       as const, label: "Live Events",          desc: "Event starts, ends, and boss phase shifts"  },
            { key: "combat"       as const, label: "Combat Results",       desc: "Win/loss results, bounty hits"              },
            { key: "crimes"       as const, label: "Crime Outcomes",       desc: "Crime success, failure, or jail alerts"     },
            { key: "faction"      as const, label: "Faction & Gang Wars",  desc: "Turf wars, faction messages, war declarations" },
            { key: "banking"      as const, label: "Banking Alerts",       desc: "Transfers received and large deposits"      },
            { key: "xpBoost"      as const, label: "XP Boost Alerts",      desc: "When an XP bonus event goes live"           },
          ] as const).map(({ key, label, desc }) => (
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

          <div style={{ borderTop: "1px solid #1e1e2e" }} />

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>Sound Effects</div>
              <div className="font-mono" style={{ color: "#64748b", fontSize: 11 }}>Play audio feedback on game actions</div>
            </div>
            <Toggle
              checked={soundEnabled}
              onChange={v => { setSoundEnabled(v); localStorage.setItem("neonoir_sounds_enabled", v ? "true" : "false"); }}
            />
          </div>

          <CyberButton variant="primary" loading={saving} onClick={saveNotifications}>
            Save Notification Preferences
          </CyberButton>
        </AnimatedCard>
      )}

      {/* Connect (platform verification & linking) */}
      {tab === "connect" && (
        <div style={{ margin: "0 -16px" }}>
          <ConnectionsPage user={user} />
        </div>
      )}

      {/* 6.4a — Telegram link/unlink flow */}
      {tab === "telegram" && (
        <TelegramSection user={user} addToast={addToast} refreshUser={refreshUser} />
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

      {/* Navigation */}
      {tab === "navigation" && (
        <AnimatedCard accent="#00d4ff" className="flex flex-col gap-4">
          <div>
            <div className="font-mono font-bold text-sm mb-1" style={{ color: "#00d4ff" }}>NAV CUSTOMIZATION</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>Reorder your nav bar icons with the ↑↓ buttons. Changes apply after saving.</div>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {effectiveNavOrder.map((id, i) => {
                const item = ALL_NAV_ITEMS.find(n => n.id === id);
                if (!item) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#111118", borderRadius: 4, border: "1px solid #1e1e2e" }}>
                    <span className="font-mono text-xs" style={{ color: "#64748b", width: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <span className="font-mono text-xs" style={{ color: "#e2e8f0", flex: 1 }}>{item.label}</span>
                    <button onClick={() => moveNavItem(i, -1)} disabled={i === 0}
                      style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#1e293b" : "#64748b", fontFamily: "monospace", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>↑</button>
                    <button onClick={() => moveNavItem(i, 1)} disabled={i === effectiveNavOrder.length - 1}
                      style={{ background: "none", border: "none", cursor: i === effectiveNavOrder.length - 1 ? "default" : "pointer", color: i === effectiveNavOrder.length - 1 ? "#1e293b" : "#64748b", fontFamily: "monospace", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>↓</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs mb-2" style={{ color: "#94a3b8" }}>Default Landing Page</div>
            <select value={defaultPage} onChange={e => setDefaultPage(e.target.value)}
              style={{ background: "#111118", color: "#e2e8f0", border: "1px solid #00d4ff40", borderRadius: 4, padding: "6px 10px", fontFamily: "monospace", fontSize: 11, width: "100%" }}>
              {["dashboard","feed","chat","crimes","jobs","arena","garage","inventory","store","leaderboard","missions","travel","daily","achievements","friends","profile","settings","auction","guilds","faction","business","training","loadout","city"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <CyberButton variant="primary" loading={savingNav} onClick={saveNavPrefs}>
            💾 Save Navigation
          </CyberButton>
          <button className="font-mono text-xs" onClick={() => setNavOrder([])}
            style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", alignSelf: "center" }}>
            ↺ Reset to Default Order
          </button>
        </AnimatedCard>
      )}
    </div>
  );
}
