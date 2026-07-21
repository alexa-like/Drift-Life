// ─── Profile Page ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { WantedStars } from "../components/WantedStars";
import { StatBar } from "../components/StatBar";
import { InventoryPage } from "./InventoryPage";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { PlayerNameBadge, type SubscriberTier } from "../components/PlayerNameBadge";
import { PrestigeConfirmModal } from "../components/PrestigeConfirmModal";

// Inject header CSS for banner zone (APEX shimmer + Sovereign weave)
const PRESTIGE_GLOW_CSS = `
@keyframes prestigeBtnGlow {
  0%, 100% { box-shadow: 0 0 8px #FFD70088, 0 0 20px #FFD70033; border-color: #FFD700bb; }
  50%       { box-shadow: 0 0 18px #FFD700cc, 0 0 36px #FFD70055; border-color: #fffbe6; }
}
.prestige-btn-eligible {
  animation: prestigeBtnGlow 1.8s ease-in-out infinite;
}
`;


const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
const FACTION_DESC: Record<string, string> = {
  suits: "+10% DC from jobs, +5% Scam/Espionage success, market discount in Downtown Core",
  street: "+10% DC from PvP wins, +5% Robbery/Heist success, extra XP from combat",
  grid: "-10% Energy cost on all jobs, +5% Data Breach/Scam success, Grid market access",
};

type Tab = "overview" | "stats" | "inventory" | "history" | "achievements";

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; }

export function ProfilePage({ user, refreshUser, addToast }: Props) {
  const [editBio, setEditBio]     = useState(false);
  const [bio, setBio]             = useState(user.bio || "");
  const [savingBio, setSavingBio] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [pinnedBadges, setPinnedBadges] = useState<string[]>((user as any).pinnedBadges ?? []);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [bountyTotal, setBountyTotal]   = useState(0);
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [seasonInfo, setSeasonInfo]     = useState<any>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Prestige
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [prestiging, setPrestiging]               = useState(false);

  async function handlePrestige() {
    setPrestiging(true);
    try {
      await api.post("/user/prestige", {});
      addToast("🏆 Prestige unlocked! Welcome to Prestige " + ((user.prestige ?? 0) + 1), "success");
      setShowPrestigeModal(false);
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Prestige failed", "error");
    } finally {
      setPrestiging(false);
    }
  }

  async function togglePin(achievementId: string) {
    const isPinned = pinnedBadges.includes(achievementId);
    setPinningId(achievementId);
    try {
      if (isPinned) {
        await api.post("/user/badges/unpin", { achievementId });
        setPinnedBadges(prev => prev.filter(id => id !== achievementId));
      } else {
        if (pinnedBadges.length >= 3) {
          // Shift oldest
          const newPins = [...pinnedBadges.slice(1), achievementId];
          await api.post("/user/badges/pin", { achievementId });
          setPinnedBadges(newPins);
        } else {
          await api.post("/user/badges/pin", { achievementId });
          setPinnedBadges(prev => [...prev, achievementId]);
        }
      }
      addToast(isPinned ? "Badge unpinned" : "Badge pinned to profile", "success");
    } catch {
      // Optimistic: just toggle locally if API not yet implemented
      if (isPinned) {
        setPinnedBadges(prev => prev.filter(id => id !== achievementId));
      } else {
        setPinnedBadges(prev => prev.length < 3 ? [...prev, achievementId] : [...prev.slice(1), achievementId]);
      }
    } finally {
      setPinningId(null);
    }
  }

  useEffect(() => {
    if (activeTab === "achievements") {
      api.get<any[]>("/achievements").then(setAchievements).catch(() => {});
    }
    if (activeTab === "history" && !historyLoaded) {
      setHistoryLoaded(true);
      api.get<any[]>("/profile/event-history").then(setEventHistory).catch(() => {});
      api.get<any>("/profile/season-history").then(setSeasonInfo).catch(() => {});
    }
  }, [activeTab]);

  // Fetch active bounties on this player for the header badge
  useEffect(() => {
    api.get<any>("/bounties/mine")
      .then(d => {
        const total = (d.onMe ?? [])
          .filter((b: any) => b.status === "active")
          .reduce((s: number, b: any) => s + b.amount, 0);
        setBountyTotal(total);
      })
      .catch(() => {});
  }, []);

  const accent = "#3A3A5C";

  // ── Derived ────────────────────────────────────────────────────────────────
  const xpPct      = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const isElevated = user.role === "owner" || user.role === "admin";
  const fc         = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";
  const isHosp     = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();

  // ── Async actions ──────────────────────────────────────────────────────────
  async function saveBio() {
    setSavingBio(true);
    try {
      await api.patch("/user/me", { bio });
      addToast("Bio updated", "success");
      refreshUser(); setEditBio(false);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingBio(false); }
  }

  async function generateAvatar() {
    if (!avatarPrompt.trim()) return;
    setGeneratingAvatar(true);
    try {
      const faction = user.faction || "street";
      const prompt = encodeURIComponent(`cyberpunk portrait of ${avatarPrompt}, faction: ${faction}, neon city 2047, dark aesthetic, digital art`);
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=256&height=256&nologo=true`;
      await api.patch("/user/me", { avatarUrl: url });
      addToast("Avatar updated", "success"); refreshUser();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setGeneratingAvatar(false); }
  }

  async function clearCustomAvatar() {
    try {
      await api.patch("/user/me", { avatarUrl: null });
      addToast("Custom avatar cleared", "success"); refreshUser();
    } catch (e: any) { addToast(e.message, "error"); }
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
    <div className="space-y-0 max-w-2xl mx-auto relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <style>{PRESTIGE_GLOW_CSS}</style>

      {/* ── BANNER ZONE ───────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        height: 120,
        overflow: "hidden",
        borderRadius: "8px 8px 0 0",
        background: "#1A1A24",
      }}>
        {/* Dark gradient overlay for readability */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)",
        }} />

        {/* Username block */}
        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, zIndex: 3, display: "flex", alignItems: "flex-end", gap: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
            border: "3px solid #2A2A3A",
            background: "#1e1e2e", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 24, overflow: "hidden",
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : user.username.charAt(0).toUpperCase()}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PlayerNameBadge
                username={user.username}
                subscriptionTier={(user as any).subscriptionTier as SubscriberTier}
                equippedNameFlair={(user as any).equippedNameFlair ?? null}
                cosmeticData={(user as any).equippedNameFlair && (user as any)._cosmeticData
                  ? (user as any)._cosmeticData
                  : null}
                fontSize="1.125rem"
                className="text-white"
              />
              {/* Pinned achievement badges */}
              {pinnedBadges.length > 0 && achievements.length > 0 && (
                <div className="flex items-center gap-1">
                  {pinnedBadges.map(badgeId => {
                    const ach = achievements.find((a: any) => a.id === badgeId);
                    if (!ach) return null;
                    return (
                      <span
                        key={badgeId}
                        title={ach.name}
                        className="font-mono px-1.5 py-0.5 rounded"
                        style={{
                          fontSize: 9, background: "#39d35320",
                          color: "#39d353", border: "1px solid #39d35340",
                          cursor: "default",
                        }}
                      >
                        🏅 {ach.name}
                      </span>
                    );
                  })}
                </div>
              )}
              {(user as any).subscriptionTier === "apex_sovereign" && (
                <span className="font-mono px-2 py-0.5 rounded" style={{
                  fontSize: 10, background: "#FFD70025",
                  color: "#FFD700", border: "1px solid #FFD70050",
                }}>
                  ♛ APEX
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {user.faction && (
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: fc + "20", color: fc, border: `1px solid ${fc}40` }}>
                  {FACTION_LABEL[user.faction]}
                </span>
              )}
            </div>
          </div>

          {/* Wanted stars + hospitalized */}
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <WantedStars level={user.wantedLevel} />
            {isHosp && (
              <div className="font-mono text-xs mt-1 px-2 py-0.5 rounded" style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}>
                HOSP
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── XP BAR ──────────────────────────────────────────────── */}
      <div style={{ background: "#111118", padding: "10px 16px", borderBottom: "1px solid #1e1e2e" }}>
        <div className="flex justify-between font-mono mb-1" style={{ fontSize: 10, color: "#64748b" }}>
          <span>{user.rank} · Level {user.level} · {user.equippedTitle || "New in Town"}</span>
          <span>{user.xp.toLocaleString()}/{user.xpToNext.toLocaleString()} XP</span>
        </div>
        <div style={{ height: 5, background: "#1A1A24", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${xpPct}%`,
            background: accent,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }} />
        </div>
        <div className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b" }}>
          District: {user.district.replace(/-/g, " ")}
        </div>
        {/* Presence / last active */}
        {(() => {
          if (user.appearOffline) return null;
          const rawLast = (user as any).lastActiveAt;
          if (!rawLast) return null;
          const last = new Date(rawLast);
          const diffMs = Date.now() - last.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          let presenceLabel: string;
          let presenceColor: string;
          if (diffMin < 5) {
            presenceLabel = "● Online now";
            presenceColor = "#39d353";
          } else if (diffMin < 30) {
            presenceLabel = `◌ Active ${diffMin}m ago`;
            presenceColor = "#f59e0b";
          } else if (diffMin < 1440) {
            const h = Math.floor(diffMin / 60);
            presenceLabel = `◌ Active ${h}h ago`;
            presenceColor = "#64748b";
          } else {
            const days = Math.floor(diffMin / 1440);
            presenceLabel = `○ Last seen ${days}d ago`;
            presenceColor = "#334155";
          }
          return (
            <div className="font-mono mt-1" style={{ fontSize: 10, color: presenceColor }}>
              {presenceLabel}
            </div>
          );
        })()}
      </div>

      {/* ── STAT STRIP ──────────────────────────────────────────── */}
      <div style={{
        background: "#0D0D14", borderBottom: "1px solid #1e1e2e",
        padding: "10px 16px",
        display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
      }}>
        {/* Wallets — keep own colors, never accent override */}
        {[
          { label: "DC", value: formatDC(user.dc), color: "#f59e0b" },
          { label: "NC", value: user.nc.toLocaleString(), color: "#a855f7" },
        ].map(w => (
          <div key={w.label} className="font-mono" style={{ fontSize: 11 }}>
            <span style={{ color: "#475569" }}>{w.label} </span>
            <span style={{ color: w.color, fontWeight: "bold" }}>{w.value}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 16, background: "#1e1e2e" }} />
        {/* Combat stats */}
        {[
          { label: "Wins",   value: user.wins },
          { label: "Losses", value: user.losses },
          { label: "Crimes", value: user.successfulCrimes },
          { label: "Rep",    value: (user as any).rep ?? 0 },
        ].map(s => (
          <div key={s.label} className="font-mono" style={{ fontSize: 11 }}>
            <span style={{ color: "#64748b" }}>{s.label} </span>
            <span style={{ color: "#e2e8f0" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div style={{ background: "#111118", borderBottom: "1px solid #1e1e2e" }}>
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {([
            { id: "overview",      label: "Overview"   },
            { id: "stats",         label: "Stats"      },
            { id: "inventory",     label: "Inventory"  },
            { id: "history",       label: "History"    },
            { id: "achievements",  label: "Achievements" },
          ] as { id: Tab; label: string }[]).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="font-mono text-xs px-4 py-3 whitespace-nowrap flex-shrink-0"
                style={{
                  color: isActive ? "#00E0FF" : "#475569",
                  borderBottom: isActive ? "2px solid #00E0FF" : "2px solid transparent",
                  background: "none",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  cursor: "pointer",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <div className="space-y-4 pt-4">

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <>
            {/* Bio */}
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="BIO" accent="#64748b" size="sm" className="mb-3" />
              {editBio ? (
                <div>
                  <textarea
                    value={bio} onChange={e => setBio(e.target.value)}
                    maxLength={300} rows={3}
                    className="w-full font-mono text-xs p-2 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", resize: "vertical" }}
                    placeholder="Write your bio... (max 300 chars)"
                  />
                  <div className="flex gap-2 mt-2">
                    <CyberButton size="sm" variant="success" loading={savingBio} onClick={saveBio}>Save</CyberButton>
                    <CyberButton size="sm" variant="ghost" onClick={() => { setEditBio(false); setBio(user.bio || ""); }}>Cancel</CyberButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="font-mono text-xs flex-1" style={{ color: user.bio ? "#94a3b8" : "#64748b", fontStyle: user.bio ? "normal" : "italic" }}>
                    {user.bio || "No bio set."}
                  </p>
                  <CyberButton size="sm" variant="ghost" onClick={() => setEditBio(true)}>Edit</CyberButton>
                </div>
              )}
            </div>

            {/* Faction */}
            {user.faction && (
              <div style={{ background: "#111118", border: `1px solid ${fc}30`, borderLeft: `3px solid ${fc}`, borderRadius: 8, padding: 20 }}>
                <div className="font-mono text-xs font-bold mb-2" style={{ color: fc, letterSpacing: "0.1em" }}>
                  FACTION — {FACTION_LABEL[user.faction]?.toUpperCase()}
                </div>
                <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>{FACTION_DESC[user.faction]}</p>
              </div>
            )}

            {/* Avatar */}
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="AI AVATAR" accent="#a855f7" size="sm" className="mb-3" />
              <div className="flex gap-2">
                <input
                  value={avatarPrompt} onChange={e => setAvatarPrompt(e.target.value)}
                  placeholder="Describe your character..."
                  className="flex-1 px-3 py-2 rounded font-mono text-xs"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
                <CyberButton size="sm" variant="primary" loading={generatingAvatar} disabled={!avatarPrompt.trim()} onClick={generateAvatar}>
                  Generate
                </CyberButton>
              </div>
              {user.avatarUrl && (
                <button onClick={clearCustomAvatar} className="mt-2 font-mono text-xs" style={{ color: "#64748b" }}>
                  Clear custom avatar
                </button>
              )}
              <p className="font-mono mt-2" style={{ fontSize: 10, color: "#64748b" }}>Powered by Pollinations AI</p>
            </div>

            {/* Prestige */}
            <div style={{ background: "#111118", border: "1px solid #FFD70030", borderLeft: "3px solid #FFD70066", borderRadius: 8, padding: 20 }}>
              <style>{PRESTIGE_GLOW_CSS}</style>
              <CyberSectionHeader title="PRESTIGE" accent="#FFD700" size="sm" className="mb-3" />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-mono text-xs" style={{ color: "#94a3b8", marginBottom: 4 }}>
                    Current Prestige: <span style={{ color: "#FFD700", fontWeight: "bold" }}>
                      {user.prestige ? `P${user.prestige}` : "None"}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>
                    Requires Level 100 to prestige. You are Level {user.level}.
                  </div>
                </div>
                <button
                  onClick={() => setShowPrestigeModal(true)}
                  className={user.level >= 100 ? "prestige-btn-eligible" : ""}
                  style={{
                    padding: "0.5rem 1.25rem", borderRadius: 8,
                    background: user.level >= 100 ? "#FFD70018" : "#1e1e2e",
                    border: `1px solid ${user.level >= 100 ? "#FFD700aa" : "#334155"}`,
                    color: user.level >= 100 ? "#FFD700" : "#475569",
                    fontFamily: "monospace", fontWeight: "bold", fontSize: "0.8rem",
                    cursor: "pointer", letterSpacing: "0.05em",
                  }}
                >
                  👑 PRESTIGE {user.prestige ? user.prestige + 1 : 1}
                </button>
              </div>
            </div>

            {/* Referral */}
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="REFERRAL CODE" accent="#39d353" size="sm" className="mb-2" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: "#00d4ff", letterSpacing: "0.15em" }}>{user.referralCode}</span>
                <CyberButton size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(user.referralCode); addToast("Copied!", "success"); }}>Copy</CyberButton>
              </div>
              <p className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b" }}>Earn 500 DC + 200 XP per successful referral</p>
            </div>
          </>
        )}

        {/* ── STATS ── */}
        {activeTab === "stats" && (
          <>
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="VITALS" accent="#64748b" size="sm" className="mb-3" />
              <div className="grid grid-cols-2 gap-4">
                <StatBar label="HEALTH" value={user.health} max={user.maxHealth} color="#39d353" />
                <StatBar label="ENERGY" value={user.energy} max={user.maxEnergy} color="#00d4ff" />
                <StatBar label="NERVE"  value={user.nerve}  max={user.maxNerve}  color="#ff6b35" />
              </div>
            </div>

            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="ATTRIBUTES" accent="#64748b" size="sm" className="mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "STRENGTH",    value: user.strength,     color: "#ff6b35" },
                  { label: "CHARISMA",    value: user.charisma,     color: "#a855f7" },
                  { label: "INTELLIGENCE",value: user.intelligence,  color: "#00d4ff" },
                  { label: "STREET CRED", value: user.streetCred,   color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                    <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
                    <div className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="FINANCES" accent="#f59e0b" size="sm" className="mb-3" />
              <div className={`grid gap-4 ${isElevated ? "grid-cols-3" : "grid-cols-2"}`}>
                {[
                  { label: "WALLET", value: formatDC(user.dc),         color: "#f59e0b", show: true },
                  { label: "BANK",   value: formatDC(user.bankBalance), color: "#39d353", show: true },
                  { label: "NC",     value: user.nc.toLocaleString(),   color: "#a855f7", show: isElevated },
                ].filter(f => f.show).map(f => (
                  <div key={f.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                    <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{f.label}</div>
                    <div className="font-mono font-bold" style={{ color: f.color }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity summary */}
            {(() => {
              const totalFights = (user.wins ?? 0) + (user.losses ?? 0);
              const winRate = totalFights > 0 ? ((user.wins ?? 0) / totalFights * 100).toFixed(0) : "—";
              const crimeSuccessRate = (user.totalCrimes ?? 0) > 0
                ? ((user.successfulCrimes ?? 0) / (user.totalCrimes ?? 0) * 100).toFixed(0) : "—";
              const raceWinRate = (user.totalRaces ?? 0) > 0
                ? ((user.raceWins ?? 0) / (user.totalRaces ?? 0) * 100).toFixed(0) : "—";
              return (
                <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
                  <CyberSectionHeader title="ACTIVITY" accent="#64748b" size="sm" className="mb-3" />
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "FIGHT W/R",  value: `${winRate}%`,            sub: `${user.wins}W ${user.losses}L`,                color: "#39d353" },
                      { label: "CRIME RATE", value: `${crimeSuccessRate}%`,   sub: `${user.successfulCrimes}/${user.totalCrimes ?? 0}`, color: "#ff6b35" },
                      { label: "RACE W/R",   value: `${raceWinRate}%`,        sub: `${user.raceWins ?? 0}/${user.totalRaces ?? 0}`,  color: "#00d4ff" },
                      { label: "STREAK",     value: `${user.dailyStreak ?? 0}d`, sub: "daily check-in",                              color: "#f59e0b" },
                      ...(user.keys ?? 0) > 0 || (user.keyShards ?? 0) > 0 ? [
                        { label: "KEYS",  value: `🗝️ ${user.keys ?? 0}`, sub: `🔮 ${user.keyShards ?? 0} shards`, color: "#f59e0b" },
                      ] : [],
                    ].map(s => (
                      <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                        <div className="font-mono" style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em" }}>{s.label}</div>
                        <div className="font-mono font-bold mt-0.5" style={{ fontSize: 18, color: s.color }}>{s.value}</div>
                        <div className="font-mono" style={{ fontSize: 9, color: "#334155" }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* ── INVENTORY ── */}
        {activeTab === "inventory" && (
          <InventoryPage user={user} refreshUser={refreshUser as any} addToast={addToast} />
        )}

        {/* ── HISTORY (combat log) ── */}
        {activeTab === "history" && (
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>COMBAT RECORD</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "WINS",         value: user.wins,                         color: "#39d353" },
                { label: "LOSSES",       value: user.losses,                       color: "#ff2d55" },
                { label: "TOTAL FIGHTS", value: (user as any).totalFights || 0,    color: "#00d4ff" },
                { label: "PVP TODAY",    value: user.attacksToday || 0,            color: "#94a3b8" },
                { label: "CRIMES",       value: user.successfulCrimes,             color: "#ff6b35" },
                { label: "TOTAL CRIMES", value: (user as any).totalCrimes || 0,   color: "#475569" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                  <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
                  <div className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {user.wins + user.losses > 0 && (
              <div style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                <div className="font-mono text-xs" style={{ color: "#64748b" }}>WIN RATE</div>
                <div className="font-mono font-bold" style={{ color: "#e2e8f0" }}>
                  {Math.round((user.wins / (user.wins + user.losses)) * 100)}%
                </div>
                <div style={{ background: "#1e1e2e", borderRadius: 4, height: 4, marginTop: 6, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.round((user.wins / (user.wins + user.losses)) * 100)}%`,
                    height: "100%", background: "#39d353",
                  }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === "achievements" && (
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderLeft: "3px solid #2A2A3A", borderRadius: 8, padding: 20 }}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: "#64748b", letterSpacing: "0.1em" }}>ACHIEVEMENTS</div>
            {achievements.length === 0 ? (
              <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
            ) : (() => {
              const completed = achievements.filter((a: any) => a.completed);
              const total = achievements.length;
              const pct = total ? Math.round((completed.length / total) * 100) : 0;
              const totalDC = completed.reduce((s: number, a: any) => s + (a.dcReward ?? 0), 0);
              return (
                <>
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{completed.length}/{total} completed</span>
                    <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>{totalDC.toLocaleString()} DC earned</span>
                  </div>
                  <div style={{ background: "#0a0a0f", borderRadius: 4, height: 6, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#39d353", transition: "width 0.5s" }} />
                  </div>
                  {pinnedBadges.length > 0 && (
                    <div className="font-mono text-xs mb-3" style={{ color: "#475569" }}>
                      📌 Pinned: {pinnedBadges.length}/3 badges shown in your profile header
                    </div>
                  )}
                  <div className="space-y-2">
                    {achievements.filter((a: any) => a.completed).slice(0, 20).map((a: any) => {
                      const isPinned = pinnedBadges.includes(a.id);
                      return (
                      <div key={a.id} style={{ background: "#0a0a0f", borderRadius: 6, padding: "8px 12px", border: `1px solid ${isPinned ? "#39d35360" : "#39d35330"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div className="font-mono text-xs font-bold" style={{ color: "#39d353" }}>{a.name}</div>
                          <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>{a.description}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="font-mono text-xs font-bold" style={{ color: "#f59e0b" }}>+{a.dcReward ?? 0} DC</div>
                          <button
                            onClick={() => togglePin(a.id)}
                            disabled={pinningId === a.id}
                            title={isPinned ? "Unpin badge" : "Pin to profile (max 3)"}
                            style={{
                              background: isPinned ? "#39d35320" : "transparent",
                              border: `1px solid ${isPinned ? "#39d35360" : "#1e293b"}`,
                              borderRadius: 4, cursor: "pointer",
                              padding: "2px 6px", fontSize: 12,
                              opacity: pinningId === a.id ? 0.5 : 1,
                            }}
                          >
                            📌
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    {completed.length === 0 && (
                      <div className="text-center py-4 font-mono text-xs" style={{ color: "#475569" }}>No achievements yet. Keep playing!</div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>

    {/* Prestige confirm modal */}
    {showPrestigeModal && (
      <PrestigeConfirmModal
        user={user}
        onClose={() => setShowPrestigeModal(false)}
        onConfirm={handlePrestige}
        confirming={prestiging}
      />
    )}
    </>
  );
}
