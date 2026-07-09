// ─── Profile Page (Frame-First Redesign) ──────────────────────────────────────
// Banner zone drives visual identity. Frame accent colors theme the page.
// Tabs: OVERVIEW | STATS | FRAMES | INVENTORY | HISTORY | ACHIEVEMENTS

import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { WantedStars } from "../components/WantedStars";
import { StatBar } from "../components/StatBar";
import { InventoryPage } from "./InventoryPage";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrame } from "../components/ChatFrame";
import { getFrame, FRAMES, RARITY_COLOR, RARITY_LABEL, enrichFrames } from "../lib/chatFrames";
import { SubscriberNameBadge, type SubscriberTier } from "../components/SubscriberNameBadge";
import { BodyArtLayer } from "../components/frame-art";

// Inject header CSS for banner zone (APEX shimmer + Sovereign weave)
const BANNER_CSS = `
@keyframes apexHeaderShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.frame-header-apex {
  background: linear-gradient(90deg, #b8860b 0%, #FFD700 30%, #fffbe6 50%, #FFD700 70%, #b8860b 100%);
  background-size: 200% 100%;
  animation: apexHeaderShimmer 2s linear infinite;
}
.frame-header-sovereign {
  background-color: #4B0082;
  background-image:
    repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 6px),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 6px);
}
@keyframes blackoutBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
`;

const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
const FACTION_DESC: Record<string, string> = {
  suits: "+10% DC from jobs, +5% Scam/Espionage success, market discount in Downtown Core",
  street: "+10% DC from PvP wins, +5% Robbery/Heist success, extra XP from combat",
  grid: "-10% Energy cost on all jobs, +5% Data Breach/Scam success, Grid market access",
};

type Tab = "overview" | "stats" | "frames" | "inventory" | "history" | "achievements";

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

  // Frame locker state
  const [ownedFrames, setOwnedFrames]   = useState<string[]>(user.ownedChatFrames || []);
  const [equippedFrame, setEquippedFrame] = useState<string | null>(user.equippedChatFrame || null);
  const [equipping, setEquipping]       = useState<string | null>(null);

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
    if (activeTab === "frames") {
      api.get<{ owned: string[]; equipped: string | null }>("/chatframes")
        .then(d => { setOwnedFrames(d.owned); setEquippedFrame((d as any).equipped); })
        .catch(() => {});
    }
  }, [activeTab]);

  // ── Frame helpers ──────────────────────────────────────────────────────────
  const frame = getFrame(equippedFrame);
  const accent = frame?.accentColor ?? "#3A3A5C";
  const noFrameAccent = "#3A3A5C";

  async function equipFrame(frameId: string) {
    const toEquip = equippedFrame === frameId ? "none" : frameId;
    setEquipping(toEquip);
    try {
      const res = await api.post<{ equipped: string | null; message: string }>(`/chatframes/equip/${toEquip}`);
      setEquippedFrame(res.equipped);
      addToast(res.message, "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Failed", "error");
    } finally {
      setEquipping(null);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const xpPct      = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const isElevated = user.role === "owner" || user.role === "admin";
  const fc         = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";
  const isHosp     = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();

  // Frame locker data
  const enriched = enrichFrames(FRAMES, ownedFrames, equippedFrame);
  const lockerEquipped = enriched.find(f => f.equipped);
  const lockerCollection = enriched
    .filter(f => f.owned && !f.equipped)
    .sort((a, b) => {
      if (a.rarity !== b.rarity) return a.rarity === "legendary" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

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
    <div className="space-y-0 max-w-2xl mx-auto">
      <style>{BANNER_CSS}</style>

      {/* ── BANNER ZONE ───────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        height: 120,
        overflow: "hidden",
        borderRadius: "8px 8px 0 0",
        background: frame
          ? (frame.headerVariant === "animated-shimmer" ? "#0D0B00" : frame.headerColor)
          : "#1A1A24",
      }}>
        {/* Header color fill for animated/textured frames */}
        {frame?.headerVariant === "animated-shimmer" && (
          <div className="frame-header-apex" style={{ position: "absolute", inset: 0 }} />
        )}
        {frame?.headerVariant === "textured-weave" && (
          <div className="frame-header-sovereign" style={{ position: "absolute", inset: 0 }} />
        )}

        {/* Ambient body art at 20% opacity */}
        {frame && (
          <div style={{ position: "absolute", inset: 0, opacity: 0.2, zIndex: 1 }}>
            <BodyArtLayer bodyArt={frame.bodyArt} accentColor={accent} />
          </div>
        )}

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
            border: `3px solid ${frame ? accent : "#2A2A3A"}`,
            boxShadow: frame ? `0 0 10px ${accent}55` : undefined,
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
              <SubscriberNameBadge
                username={user.username}
                tier={(user as any).subscriptionTier as SubscriberTier}
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
              {frame && (
                <span className="font-mono px-2 py-0.5 rounded" style={{
                  fontSize: 10, background: `${RARITY_COLOR[frame.rarity]}25`,
                  color: RARITY_COLOR[frame.rarity], border: `1px solid ${RARITY_COLOR[frame.rarity]}50`,
                }}>
                  {RARITY_LABEL[frame.rarity]}
                </span>
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
              {frame && (
                <button
                  onClick={() => setActiveTab("frames")}
                  className="font-mono text-xs rounded px-2 py-0.5"
                  style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40`, cursor: "pointer" }}
                >
                  {frame.name}
                </button>
              )}
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
            background: frame ? accent : noFrameAccent,
            borderRadius: 3, boxShadow: frame ? `0 0 6px ${accent}80` : undefined,
            transition: "width 0.4s ease",
          }} />
        </div>
        <div className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b" }}>
          District: {user.district.replace(/-/g, " ")}
        </div>
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
        {/* Combat stats with accent label */}
        {[
          { label: "Wins",   value: user.wins },
          { label: "Losses", value: user.losses },
          { label: "Crimes", value: user.successfulCrimes },
          { label: "Rep",    value: (user as any).rep ?? 0 },
        ].map(s => (
          <div key={s.label} className="font-mono" style={{ fontSize: 11 }}>
            <span style={{ color: frame ? accent : "#64748b" }}>{s.label} </span>
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
            { id: "frames",        label: "Frames"     },
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
                  color: isActive ? (frame ? accent : "#00E0FF") : "#475569",
                  borderBottom: isActive ? `2px solid ${frame ? accent : "#00E0FF"}` : "2px solid transparent",
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
            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="BIO" accent={frame ? accent : "#64748b"} size="sm" className="mb-3" />
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
            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="AI AVATAR" accent={frame ? accent : "#a855f7"} size="sm" className="mb-3" />
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

            {/* Referral */}
            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="REFERRAL CODE" accent={frame ? accent : "#39d353"} size="sm" className="mb-2" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: frame ? accent : "#00d4ff", letterSpacing: "0.15em" }}>{user.referralCode}</span>
                <CyberButton size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(user.referralCode); addToast("Copied!", "success"); }}>Copy</CyberButton>
              </div>
              <p className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b" }}>Earn 500 DC + 200 XP per successful referral</p>
            </div>
          </>
        )}

        {/* ── STATS ── */}
        {activeTab === "stats" && (
          <>
            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="VITALS" accent={frame ? accent : "#64748b"} size="sm" className="mb-3" />
              <div className="grid grid-cols-2 gap-4">
                <StatBar label="HEALTH" value={user.health} max={user.maxHealth} color="#39d353" />
                <StatBar label="ENERGY" value={user.energy} max={user.maxEnergy} color="#00d4ff" />
                <StatBar label="NERVE"  value={user.nerve}  max={user.maxNerve}  color="#ff6b35" />
              </div>
            </div>

            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="ATTRIBUTES" accent={frame ? accent : "#64748b"} size="sm" className="mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "STRENGTH",    value: user.strength,     color: "#ff6b35" },
                  { label: "CHARISMA",    value: user.charisma,     color: "#a855f7" },
                  { label: "INTELLIGENCE",value: user.intelligence,  color: "#00d4ff" },
                  { label: "STREET CRED", value: user.streetCred,   color: frame ? accent : "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                    <div className="font-mono" style={{ fontSize: 10, color: frame ? accent : "#64748b" }}>{s.label}</div>
                    <div className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
              <CyberSectionHeader title="FINANCES" accent={frame ? accent : "#f59e0b"} size="sm" className="mb-3" />
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
                <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
                  <CyberSectionHeader title="ACTIVITY" accent={frame ? accent : "#64748b"} size="sm" className="mb-3" />
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "FIGHT W/R",  value: `${winRate}%`,            sub: `${user.wins}W ${user.losses}L`,                color: "#39d353" },
                      { label: "CRIME RATE", value: `${crimeSuccessRate}%`,   sub: `${user.successfulCrimes}/${user.totalCrimes ?? 0}`, color: "#ff6b35" },
                      { label: "RACE W/R",   value: `${raceWinRate}%`,        sub: `${user.raceWins ?? 0}/${user.totalRaces ?? 0}`,  color: "#00d4ff" },
                      { label: "STREAK",     value: `${user.dailyStreak ?? 0}d`, sub: "daily check-in",                              color: frame ? accent : "#f59e0b" },
                      ...(user.keys ?? 0) > 0 || (user.keyShards ?? 0) > 0 ? [
                        { label: "KEYS",  value: `🗝️ ${user.keys ?? 0}`, sub: `🔮 ${user.keyShards ?? 0} shards`, color: "#f59e0b" },
                      ] : [],
                    ].map(s => (
                      <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                        <div className="font-mono" style={{ fontSize: 9, color: frame ? accent : "#475569", letterSpacing: "0.08em" }}>{s.label}</div>
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

        {/* ── FRAMES (Frame Locker) ── */}
        {activeTab === "frames" && (
          <div className="space-y-4">
            {/* Go to store link */}
            <div className="flex justify-end">
              <button
                onClick={() => (window as any).__setPage?.("chatframes")}
                className="font-mono text-xs"
                style={{ color: frame ? accent : "#475569", background: "none", border: "none", cursor: "pointer" }}
              >
                Go to Frame Store →
              </button>
            </div>

            {/* Equipped block */}
            <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "50" : "#1e1e2e"}`, borderRadius: 8, padding: 20 }}>
              <div className="font-mono text-xs font-bold mb-3" style={{ color: "#475569", letterSpacing: "0.1em" }}>EQUIPPED</div>
              {lockerEquipped ? (
                <>
                  <ChatFrame
                    frame={lockerEquipped}
                    username={user.username}
                    level={user.level}
                    timestamp={new Date().toISOString()}
                    size="preview"
                  >
                    This is how your messages appear in chat.
                  </ChatFrame>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>{lockerEquipped.name}</span>
                      <span className="font-mono px-2 py-0.5 rounded ml-2" style={{
                        fontSize: 9,
                        background: `${RARITY_COLOR[lockerEquipped.rarity]}18`,
                        color: RARITY_COLOR[lockerEquipped.rarity],
                        border: `1px solid ${RARITY_COLOR[lockerEquipped.rarity]}40`,
                      }}>
                        {RARITY_LABEL[lockerEquipped.rarity]}
                      </span>
                    </div>
                    <CyberButton
                      size="sm" variant="ghost"
                      loading={equipping === "none"}
                      onClick={() => equipFrame(lockerEquipped.id)}
                    >
                      Unequip
                    </CyberButton>
                  </div>
                </>
              ) : (
                <div className="font-mono text-xs" style={{ color: "#475569" }}>
                  No frame equipped —{" "}
                  <button
                    onClick={() => (window as any).__setPage?.("chatframes")}
                    style={{ color: "#00E0FF", background: "none", border: "none", cursor: "pointer" }}
                  >
                    browse the store
                  </button>
                </div>
              )}
            </div>

            {/* Collection grid */}
            {lockerCollection.length > 0 && (
              <div>
                <div className="font-mono text-xs font-bold mb-3" style={{ color: "#475569", letterSpacing: "0.1em" }}>
                  MY COLLECTION ({lockerCollection.length})
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {lockerCollection.map(f => {
                    const rarityColor = RARITY_COLOR[f.rarity];
                    return (
                      <div key={f.id} style={{
                        background: "#111118",
                        border: `1px solid #1e1e2e`,
                        borderRadius: 8,
                        padding: 12,
                        overflow: "hidden",
                      }}>
                        {/* Mini ChatFrame preview */}
                        <ChatFrame frame={f} username={user.username} level={user.level} size="preview">
                          {f.name}
                        </ChatFrame>

                        <div className="mt-2 mb-1">
                          <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{f.name}</div>
                          <span className="font-mono px-1.5 py-0.5 rounded" style={{
                            fontSize: 9,
                            background: `${rarityColor}18`,
                            color: rarityColor,
                            border: `1px solid ${rarityColor}40`,
                          }}>
                            {RARITY_LABEL[f.rarity]}
                          </span>
                        </div>

                        <CyberButton
                          size="sm"
                          variant="primary"
                          loading={equipping === f.id}
                          onClick={() => equipFrame(f.id)}
                          className="w-full mt-1"
                        >
                          Equip
                        </CyberButton>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {lockerCollection.length === 0 && !lockerEquipped && (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#475569" }}>
                You don't own any frames yet.{" "}
                <button
                  onClick={() => (window as any).__setPage?.("chatframes")}
                  style={{ color: "#00E0FF", background: "none", border: "none", cursor: "pointer" }}
                >
                  Visit the Frame Store
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── INVENTORY ── */}
        {activeTab === "inventory" && (
          <InventoryPage user={user} refreshUser={refreshUser as any} addToast={addToast} />
        )}

        {/* ── HISTORY (combat log) ── */}
        {activeTab === "history" && (
          <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
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
                  <div className="font-mono" style={{ fontSize: 10, color: frame ? accent : "#64748b" }}>{s.label}</div>
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
                    height: "100%", background: frame ? accent : "#39d353",
                  }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {activeTab === "achievements" && (
          <div style={{ background: "#111118", border: `1px solid ${frame ? accent + "30" : "#1e1e2e"}`, borderLeft: `3px solid ${frame ? accent : "#2A2A3A"}`, borderRadius: 8, padding: 20 }}>
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
                    <div style={{ width: `${pct}%`, height: "100%", background: frame ? accent : "#39d353", transition: "width 0.5s" }} />
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
  );
}
