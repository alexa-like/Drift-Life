import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { WantedStars } from "../components/WantedStars";
import { StatBar } from "../components/StatBar";
import { InventoryPage } from "./InventoryPage";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { ChatFrameRenderer } from "../components/ChatFrameRenderer";
import { getFrame, FRAME_TIER_COLOR, FRAME_TIER_LABEL } from "../lib/chatFrames";

const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
const FACTION_DESC: Record<string, string> = {
  suits: "+10% DC from jobs, +5% Scam/Espionage success, market discount in Downtown Core",
  street: "+10% DC from PvP wins, +5% Robbery/Heist success, extra XP from combat",
  grid: "-10% Energy cost on all jobs, +5% Data Breach/Scam success, Grid market access",
};

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; }

export function ProfilePage({ user, refreshUser, addToast }: Props) {
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio] = useState(user.bio || "");
  const [savingBio, setSavingBio] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "achievements" | "combat-log">("overview");
  const [achievements, setAchievements] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "achievements") {
      api.get<any[]>("/achievements").then(setAchievements).catch(() => {});
    }
  }, [activeTab]);

  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const isElevated = user.role === "owner" || user.role === "admin";

  async function saveBio() {
    setSavingBio(true);
    try {
      await api.patch("/user/me", { bio });
      addToast("Bio updated", "success");
      refreshUser();
      setEditBio(false);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setSavingBio(false);
    }
  }

  async function generateAvatar() {
    if (!avatarPrompt.trim()) return;
    setGeneratingAvatar(true);
    try {
      const faction = user.faction || "street";
      const prompt = encodeURIComponent(`cyberpunk portrait of ${avatarPrompt}, faction: ${faction}, neon city 2047, dark aesthetic, digital art`);
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=256&height=256&nologo=true`;
      await api.patch("/user/me", { avatarUrl: url });
      addToast("Avatar updated", "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setGeneratingAvatar(false);
    }
  }

  async function clearCustomAvatar() {
    try {
      await api.patch("/user/me", { avatarUrl: null });
      addToast("Custom avatar cleared", "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const fc = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Profile header */}
      <div style={{ background: "#111118", borderRadius: 8, padding: 24 }}>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "#1e1e2e", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 28, border: "2px solid #334155",
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : user.username.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono font-bold text-xl" style={{ color: "#e2e8f0" }}>{user.username}</span>
              {user.tag && <span className="font-mono text-xs" style={{ color: "#64748b" }}>{user.tag}</span>}
              {user.faction && (
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: fc + "20", color: fc, border: `1px solid ${fc}40` }}>
                  {FACTION_LABEL[user.faction]}
                </span>
              )}
              {isHosp && (
                <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}>HOSPITALIZED</span>
              )}
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "#f59e0b" }}>
                {user.rank} · Level {user.level} · {user.equippedTitle || "New in Town"}
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                District: {user.district.replace(/-/g, " ")}
              </div>

              {/* XP Bar */}
              <div className="mt-2">
                <div className="flex justify-between font-mono" style={{ fontSize: 10, color: "#64748b" }}>
                  <span>XP</span><span>{user.xp.toLocaleString()}/{user.xpToNext.toLocaleString()}</span>
                </div>
                <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2, marginTop: 2 }}>
                  <div style={{
                    height: 4,
                    width: `${xpPct}%`,
                    background: "linear-gradient(90deg, #00d4ff, #a855f7)",
                    borderRadius: 2,
                    boxShadow: "0 0 6px #00d4ff60",
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <WantedStars level={user.wantedLevel} />
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4">
            {editBio ? (
              <div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={300}
                  rows={3}
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
                <CyberButton size="sm" variant="ghost" onClick={() => setEditBio(true)} className="flex-shrink-0">Edit</CyberButton>
              </div>
            )}
          </div>
        </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "overview"     as const, label: "Overview"     },
          { id: "inventory"    as const, label: "Inventory"    },
          { id: "achievements" as const, label: "Achievements" },
          { id: "combat-log"   as const, label: "Combat Log"   },
        ].map(tab => (
          <CyberButton
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? "primary" : "ghost"}
            glow={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </CyberButton>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <CyberSectionHeader title="STATS" accent="#64748b" size="sm" className="mb-3" />
            <div className="grid grid-cols-2 gap-4">
              <StatBar label="HEALTH" value={user.health} max={user.maxHealth} color="#39d353" />
              <StatBar label="ENERGY" value={user.energy} max={user.maxEnergy} color="#00d4ff" />
              <StatBar label="NERVE" value={user.nerve} max={user.maxNerve} color="#ff6b35" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { label: "STRENGTH",   value: user.strength,     color: "#ff6b35" },
                { label: "CHARISMA",   value: user.charisma,     color: "#a855f7" },
                { label: "INTELLIGENCE", value: user.intelligence, color: "#00d4ff" },
                { label: "STREET CRED", value: user.streetCred,  color: "#f59e0b" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                  <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
                  <div className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Finances */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <CyberSectionHeader title="FINANCES" accent="#f59e0b" size="sm" className="mb-3" />
            <div className={`grid gap-4 ${isElevated ? "grid-cols-3" : "grid-cols-2"}`}>
              {[
                { label: "WALLET", value: user.dc, color: "#f59e0b", show: true },
                { label: "BANK", value: user.bankBalance, color: "#39d353", show: true },
                { label: "UC", value: user.nc, color: "#a855f7", show: isElevated },
              ].filter(f => f.show).map(f => (
                <div key={f.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                  <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{f.label}</div>
                  <div className="font-mono font-bold" style={{ color: f.color }}>{formatDC(f.value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Combat record */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <CyberSectionHeader title="COMBAT RECORD" accent="#ff2d55" size="sm" className="mb-3" />
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Wins",     value: user.wins,              color: "#39d353" },
                { label: "Losses",   value: user.losses,            color: "#ff2d55" },
                { label: "Crimes",   value: user.successfulCrimes,  color: "#ff6b35" },
                { label: "PvP Today", value: user.attacksToday || 0, color: "#94a3b8" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: 10 }}>
                  <div className="font-mono font-bold" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
                  <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity summary */}
          {(() => {
            const totalFights = (user.wins ?? 0) + (user.losses ?? 0);
            const winRate = totalFights > 0 ? ((user.wins ?? 0) / totalFights * 100).toFixed(0) : "—";
            const crimeSuccessRate = (user.totalCrimes ?? 0) > 0
              ? ((user.successfulCrimes ?? 0) / (user.totalCrimes ?? 0) * 100).toFixed(0)
              : "—";
            const raceWinRate = (user.totalRaces ?? 0) > 0
              ? ((user.raceWins ?? 0) / (user.totalRaces ?? 0) * 100).toFixed(0)
              : "—";
            const stats = [
              { label: "FIGHT W/R", value: `${winRate}%`, sub: `${user.wins}W ${user.losses}L`, color: "#39d353" },
              { label: "CRIME RATE", value: `${crimeSuccessRate}%`, sub: `${user.successfulCrimes}/${user.totalCrimes ?? 0}`, color: "#ff6b35" },
              { label: "RACE W/R", value: `${raceWinRate}%`, sub: `${user.raceWins ?? 0}/${user.totalRaces ?? 0}`, color: "#00d4ff" },
              { label: "STREAK", value: `${user.dailyStreak ?? 0}d`, sub: "daily check-in", color: "#f59e0b" },
            ];
            return (
              <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
                <CyberSectionHeader title="ACTIVITY SUMMARY" accent="#64748b" size="sm" className="mb-3" />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {stats.map(s => (
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

          {/* Faction */}
          {user.faction && (
            <div style={{ background: "#111118", border: `1px solid ${fc}30`, borderRadius: 8, padding: 20 }}>
              <div className="font-mono text-xs font-bold mb-2" style={{ color: fc, letterSpacing: "0.1em" }}>
                FACTION — {FACTION_LABEL[user.faction]?.toUpperCase()}
              </div>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>{FACTION_DESC[user.faction]}</p>
            </div>
          )}

          {/* Chat Frame */}
          {(() => {
            const frame = getFrame(user.equippedChatFrame);
            const tierColor = frame ? FRAME_TIER_COLOR[frame.tier] : "#475569";
            return (
              <div style={{ background: "#111118", border: `1px solid ${frame ? tierColor + "40" : "#1e1e2e"}`, borderRadius: 8, padding: 20 }}>
                <div className="flex items-center justify-between mb-3">
                  <CyberSectionHeader title="CHAT FRAME" accent={frame ? tierColor : "#475569"} size="sm" />
                  <a
                    href="#"
                    onClick={e => { e.preventDefault(); (window as any).__setPage?.("chatframes"); }}
                    className="font-mono text-xs"
                    style={{ color: "#475569" }}
                  >
                    Browse Gallery
                  </a>
                </div>
                {frame ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                        {frame.badge && <span style={{ marginRight: 4 }}>{frame.badge}</span>}
                        {frame.name}
                      </span>
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 9, background: tierColor + "20", color: tierColor, border: `1px solid ${tierColor}40` }}>
                        {FRAME_TIER_LABEL[frame.tier]}
                      </span>
                    </div>
                    <ChatFrameRenderer
                      frameId={user.equippedChatFrame}
                      username={user.username}
                      level={user.level}
                      timestamp={new Date().toISOString()}
                    >
                      This is how your messages appear to others in chat.
                    </ChatFrameRenderer>
                  </div>
                ) : (
                  <div className="font-mono text-xs" style={{ color: "#475569" }}>
                    No frame equipped. Visit the Gallery to browse and purchase chat frames.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Avatar generator */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <CyberSectionHeader title="AI AVATAR GENERATOR" accent="#a855f7" size="sm" className="mb-3" />
            <div className="flex gap-2">
              <input
                value={avatarPrompt}
                onChange={e => setAvatarPrompt(e.target.value)}
                placeholder="Describe your character..."
                className="flex-1 px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
              <CyberButton
                size="sm"
                variant="primary"
                loading={generatingAvatar}
                disabled={!avatarPrompt.trim()}
                onClick={generateAvatar}
              >
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
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <CyberSectionHeader title="REFERRAL CODE" accent="#39d353" size="sm" className="mb-2" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm" style={{ color: "#00d4ff", letterSpacing: "0.15em" }}>{user.referralCode}</span>
              <CyberButton size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(user.referralCode); addToast("Copied!", "success"); }}>Copy</CyberButton>
            </div>
            <p className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b" }}>Earn 500 DC + 200 XP per successful referral</p>
          </div>
        </>
      )}

      {activeTab === "achievements" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="font-mono text-xs font-bold mb-1" style={{ color: "#64748b", letterSpacing: "0.1em" }}>ACHIEVEMENTS</div>
          {achievements.length === 0 ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
          ) : (() => {
            const completed = achievements.filter((a: any) => a.completed);
            const total = achievements.length;
            const pct = total ? Math.round((completed.length / total) * 100) : 0;
            const totalMerit = completed.reduce((s: number, a: any) => s + a.meritReward, 0);
            return (
              <>
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{completed.length}/{total} completed</span>
                  <span className="font-mono text-xs" style={{ color: "#39d353" }}>{totalMerit.toLocaleString()} M earned</span>
                </div>
                <div style={{ background: "#0a0a0f", borderRadius: 4, height: 6, marginBottom: 16, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#39d353", transition: "width 0.5s" }} />
                </div>
                <div className="space-y-2">
                  {achievements.filter((a: any) => a.completed).slice(0, 10).map((a: any) => (
                    <div key={a.id} style={{ background: "#0a0a0f", borderRadius: 6, padding: "8px 12px", border: "1px solid #39d35330", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div className="font-mono text-xs font-bold" style={{ color: "#39d353" }}>{a.name}</div>
                        <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>{a.description}</div>
                      </div>
                      <div className="font-mono text-xs font-bold flex-shrink-0" style={{ color: "#39d353" }}>+{a.meritReward} M</div>
                    </div>
                  ))}
                  {completed.length === 0 && (
                    <div className="text-center py-4 font-mono text-xs" style={{ color: "#475569" }}>No achievements completed yet. Keep playing!</div>
                  )}
                  {completed.length > 10 && (
                    <div className="font-mono text-xs text-center mt-2" style={{ color: "#475569" }}>+{completed.length - 10} more — visit Achievements page to see all</div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "inventory" && (
        <InventoryPage user={user} refreshUser={refreshUser as any} addToast={addToast} />
      )}

      {activeTab === "combat-log" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>COMBAT RECORD</div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "WINS",         value: user.wins,             color: "#39d353" },
              { label: "LOSSES",       value: user.losses,           color: "#ff2d55" },
              { label: "TOTAL FIGHTS", value: (user as any).totalFights || 0, color: "#00d4ff" },
              { label: "PVP TODAY",    value: user.attacksToday || 0, color: "#94a3b8" },
              { label: "CRIMES",       value: user.successfulCrimes, color: "#ff6b35" },
              { label: "TOTAL CRIMES", value: (user as any).totalCrimes || 0, color: "#475569" },
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
                <div style={{ width: `${Math.round((user.wins / (user.wins + user.losses)) * 100)}%`, height: "100%", background: "#39d353" }} />
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
