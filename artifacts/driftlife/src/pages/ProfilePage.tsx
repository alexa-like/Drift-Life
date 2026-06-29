import { useState, useEffect } from "react";
import { User, Frame } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { WantedStars } from "../components/WantedStars";
import { StatBar } from "../components/StatBar";
import { AvatarWithFrame } from "../components/AvatarWithFrame";
import { FrameCardWrapper } from "../components/FrameCardWrapper";
import { FRAME_CATALOG as FRAMES, FrameDef, RARITY_COLORS as RARITY_COLOR, getFrame } from "../lib/frames";

const FACTION_LABEL: Record<string, string> = { suits: "The Suits", street: "The Street", grid: "The Grid" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };
const FACTION_DESC: Record<string, string> = {
  suits: "+10% DC from jobs, +5% Scam/Espionage success, market discount in Downtown Core",
  street: "+10% DC from PvP wins, +5% Robbery/Heist success, extra XP from combat",
  grid: "-10% Energy cost on all jobs, +5% Data Breach/Scam success, Grid market access",
};

// Preset palette colors players can pick from
const COLOR_PRESETS = [
  "#00d4ff", "#a855f7", "#f59e0b", "#39d353", "#ff2d55",
  "#ff6b35", "#e879f9", "#00FF41", "#06B6D4", "#FBBF24",
  "#DC2626", "#4ADE80", "#818CF8", "#F472B6", "#ffffff",
];

interface Props { user: User; refreshUser: () => void; addToast: (msg: string, t?: string) => void; }

export function ProfilePage({ user, refreshUser, addToast }: Props) {
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio] = useState(user.bio || "");
  const [savingBio, setSavingBio] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [equippingFrame, setEquippingFrame] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "achievements" | "frames" | "combat-log">("overview");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [savingColor, setSavingColor] = useState(false);
  const [apiFrames, setApiFrames] = useState<Frame[]>([]);

  useEffect(() => {
    api.get<Frame[]>("/frames").then(setApiFrames).catch(() => {});
  }, [user.ownedFrames]);

  useEffect(() => {
    if (activeTab === "achievements") {
      api.get<any[]>("/achievements").then(setAchievements).catch(() => {});
    }
  }, [activeTab]);

  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const equippedFrameId = user.equippedFrame || null;
  const equippedColor = user.equippedFrameColor || null;
  const equippedFrameDef = equippedFrameId ? getFrame(equippedFrameId) : null;
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

  async function equipFrame(frameId: string | null) {
    const key = frameId ?? "none";
    setEquippingFrame(key);
    try {
      if (frameId) {
        await api.post(`/frames/equip/${frameId}`, {});
        addToast("Frame equipped!", "success");
      } else {
        await api.patch("/user/me", { equippedFrame: null });
        addToast("Frame removed", "success");
      }
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setEquippingFrame(null);
    }
  }

  async function saveFrameColor(color: string | null) {
    setSavingColor(true);
    try {
      await api.patch("/user/me", { equippedFrameColor: color });
      addToast(color ? "Frame color updated!" : "Frame color reset", "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message || "Failed to save color", "error");
    } finally {
      setSavingColor(false);
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const ownedFrames: FrameDef[] = FRAMES.filter(f =>
    apiFrames.length > 0
      ? apiFrames.find(af => af.frameId === f.id)?.owned
      : (user.ownedFrames || []).includes(f.id)
  );
  const fc = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Profile header — wrapped in equipped frame */}
      <FrameCardWrapper
        frameId={equippedFrameId}
        colorOverride={equippedColor}
        borderRadius={8}
      >
        <div style={{ background: "#111118", borderRadius: 8, padding: 24 }}>
          <div className="flex items-start gap-5">
            {/* Avatar with frame */}
            <div className="flex-shrink-0">
              <AvatarWithFrame
                username={user.username}
                avatarUrl={user.avatarUrl}
                frameId={equippedFrameId}
                size="xl"
              />
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
                {equippedFrameDef && (
                  <span
                    className="font-mono text-xs px-2 py-0.5 rounded"
                    style={{
                      background: (equippedColor || equippedFrameDef.glowColor) + "20",
                      color: equippedColor || equippedFrameDef.glowColor,
                      border: `1px solid ${(equippedColor || equippedFrameDef.glowColor)}40`,
                    }}
                  >
                    {equippedFrameDef.name}
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
                  <button onClick={saveBio} disabled={savingBio} className="font-mono text-xs px-3 py-1 rounded" style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35340" }}>
                    {savingBio ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => { setEditBio(false); setBio(user.bio || ""); }} className="font-mono text-xs px-3 py-1 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="font-mono text-xs flex-1" style={{ color: user.bio ? "#94a3b8" : "#64748b", fontStyle: user.bio ? "normal" : "italic" }}>
                  {user.bio || "No bio set."}
                </p>
                <button onClick={() => setEditBio(true)} className="font-mono text-xs px-2 py-0.5 rounded flex-shrink-0" style={{ color: "#00d4ff", border: "1px solid #00d4ff30" }}>
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </FrameCardWrapper>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "overview"    as const, label: "Overview" },
          { id: "achievements" as const, label: `Achievements` },
          { id: "frames"      as const, label: `Frames (${ownedFrames.length})` },
          { id: "combat-log"  as const, label: "Combat Log" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded font-mono text-xs transition-all"
            style={{
              background: activeTab === tab.id ? "#00d4ff18" : "#111118",
              color: activeTab === tab.id ? "#00d4ff" : "#475569",
              border: `1px solid ${activeTab === tab.id ? "#00d4ff40" : "#1e1e2e"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>STATS</div>
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
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>FINANCES</div>
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
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>COMBAT RECORD</div>
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

          {/* Faction */}
          {user.faction && (
            <div style={{ background: "#111118", border: `1px solid ${fc}30`, borderRadius: 8, padding: 20 }}>
              <div className="font-mono text-xs font-bold mb-2" style={{ color: fc, letterSpacing: "0.1em" }}>
                FACTION — {FACTION_LABEL[user.faction]?.toUpperCase()}
              </div>
              <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>{FACTION_DESC[user.faction]}</p>
            </div>
          )}

          {/* Avatar generator */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.1em" }}>AI AVATAR GENERATOR</div>
            <div className="flex gap-2">
              <input
                value={avatarPrompt}
                onChange={e => setAvatarPrompt(e.target.value)}
                placeholder="Describe your character..."
                className="flex-1 px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
              <button
                onClick={generateAvatar}
                disabled={generatingAvatar || !avatarPrompt.trim()}
                className="px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40" }}
              >
                {generatingAvatar ? "..." : "Generate"}
              </button>
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
            <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b", letterSpacing: "0.1em" }}>REFERRAL CODE</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm" style={{ color: "#00d4ff", letterSpacing: "0.15em" }}>{user.referralCode}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(user.referralCode); addToast("Copied!", "success"); }}
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
              >
                Copy
              </button>
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

      {activeTab === "frames" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>YOUR FRAMES</div>

          {/* Collection stats */}
          {(() => {
            const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
            const RARITY_COLORS_MAP: Record<string, string> = { common: "#94a3b8", uncommon: "#39d353", rare: "#00d4ff", epic: "#a855f7", legendary: "#f59e0b", mythic: "#00ff41" };
            const totalFrames = apiFrames.filter(f => !f.mythicAliasOf).length;
            const ownedCount = ownedFrames.length;
            const pct = totalFrames > 0 ? Math.round((ownedCount / totalFrames) * 100) : 0;
            const rarestOwned = RARITY_ORDER.slice().reverse().find(r => ownedFrames.some(f => f.rarity === r));
            return (
              <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>COLLECTED</div>
                      <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 14 }}>{ownedCount}<span style={{ color: "#475569", fontSize: 11 }}>/{totalFrames}</span></div>
                    </div>
                    <div>
                      <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>COMPLETION</div>
                      <div className="font-mono font-bold" style={{ color: "#a855f7", fontSize: 14 }}>{pct}%</div>
                    </div>
                    {rarestOwned && (
                      <div>
                        <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>RAREST OWNED</div>
                        <div className="font-mono font-bold capitalize" style={{ color: RARITY_COLORS_MAP[rarestOwned], fontSize: 12 }}>{rarestOwned}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ background: "#1e1e2e", borderRadius: 4, height: 5, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #a855f7, #00d4ff)", transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })()}

          {/* Color customizer — shown when a frame is equipped */}
          {equippedFrameDef && (
            <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: 14, marginBottom: 16 }}>
              <div className="font-mono text-xs font-bold mb-2" style={{ color: "#94a3b8" }}>
                FRAME COLOR — <span style={{ color: equippedColor || equippedFrameDef.glowColor }}>{equippedFrameDef.name}</span>
              </div>
              <p className="font-mono mb-3" style={{ fontSize: 10, color: "#475569" }}>
                Pick a custom glow color. Animation and design stay the same — only the color changes.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => saveFrameColor(c)}
                    disabled={savingColor}
                    title={c}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: c,
                      border: (equippedColor === c) ? "2px solid #fff" : "2px solid transparent",
                      boxShadow: `0 0 6px ${c}80`,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
                {/* Custom hex input */}
                <input
                  type="color"
                  defaultValue={equippedColor || equippedFrameDef.glowColor}
                  onChange={e => saveFrameColor(e.target.value)}
                  title="Custom color"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: "2px solid #334155",
                    padding: 0,
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
              </div>
              {equippedColor && (
                <button
                  onClick={() => saveFrameColor(null)}
                  disabled={savingColor}
                  className="font-mono text-xs"
                  style={{ color: "#475569" }}
                >
                  Reset to default color
                </button>
              )}
            </div>
          )}

          {/* Remove frame option */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => equipFrame(null)}
              disabled={equippingFrame !== null}
              className="p-3 rounded font-mono text-xs transition-all"
              style={{
                background: !equippedFrameId ? "#39d35318" : "#0a0a0f",
                border: `1px solid ${!equippedFrameId ? "#39d35340" : "#1e1e2e"}`,
                color: !equippedFrameId ? "#39d353" : "#475569",
              }}
            >
              {equippingFrame === "none" ? "Removing..." : "No Frame"}
            </button>
          </div>

          {ownedFrames.length === 0 ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🖼️</div>
              <p>No frames yet. Earn them through crimes, achievements, and events.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ownedFrames.map(frame => {
                const isEquipped = equippedFrameId === frame.id;
                const rc = RARITY_COLOR[frame.rarity] || "#94a3b8";
                const displayColor = isEquipped ? (equippedColor || rc) : rc;
                return (
                  <FrameCardWrapper
                    key={frame.id}
                    frameId={frame.id}
                    colorOverride={isEquipped ? equippedColor : null}
                    borderRadius={6}
                  >
                    <button
                      onClick={() => equipFrame(frame.id)}
                      disabled={equippingFrame !== null}
                      className="p-3 rounded text-left transition-all w-full"
                      style={{
                        background: isEquipped ? displayColor + "15" : "#0a0a0f",
                        borderRadius: 6,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <AvatarWithFrame
                          username={user.username}
                          avatarUrl={user.avatarUrl}
                          frameId={frame.id}
                          size="sm"
                        />
                        <div>
                          <div className="font-mono font-bold" style={{ fontSize: 11, color: displayColor }}>
                            {frame.name}
                            {isEquipped && <span style={{ color: "#39d353", marginLeft: 4 }}>✓</span>}
                          </div>
                          <div className="font-mono" style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>
                            {frame.rarity}
                          </div>
                        </div>
                      </div>
                      {frame.earnedBy && (
                        <p className="font-mono mt-1" style={{ fontSize: 10, color: "#475569" }}>🏆 {frame.earnedBy}</p>
                      )}
                      {equippingFrame === frame.id && (
                        <span className="font-mono text-xs" style={{ color: rc }}>Equipping...</span>
                      )}
                    </button>
                  </FrameCardWrapper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
