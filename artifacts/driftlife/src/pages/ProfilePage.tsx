import { useState } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { WantedStars } from "../components/WantedStars";
import { StatBar } from "../components/StatBar";
import { AvatarWithFrame } from "../components/AvatarWithFrame";
import { FRAME_CATALOG as FRAMES, FrameDef, RARITY_COLOR } from "../lib/frames";

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
  const [equippingFrame, setEquippingFrame] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "frames">("stats");

  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));

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
      await api.post("/user/equip-frame", { frameId });
      addToast(frameId ? "Frame equipped!" : "Frame removed", "success");
      refreshUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setEquippingFrame(null);
    }
  }

  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const ownedFrames: FrameDef[] = FRAMES.filter(f => (user.ownedFrames || []).includes(f.id));
  const fc = user.faction ? FACTION_COLOR[user.faction] : "#94a3b8";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Profile header */}
      <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 24 }}>
        <div className="flex items-start gap-5">
          {/* Avatar with frame */}
          <div className="flex-shrink-0">
            <AvatarWithFrame
              username={user.username}
              avatarUrl={user.avatarUrl}
              frameId={(user as any).equippedFrame || null}
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

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[
          { id: "stats" as const, label: "📊 Stats" },
          { id: "frames" as const, label: `🖼️ Frames (${ownedFrames.length})` },
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

      {activeTab === "stats" && (
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "WALLET", value: user.dc, color: "#f59e0b" },
                { label: "BANK", value: user.bankBalance, color: "#39d353" },
                { label: "NOVA CREDITS", value: user.nc, color: "#a855f7" },
              ].map(f => (
                <div key={f.label} style={{ background: "#0a0a0f", borderRadius: 6, padding: "10px 12px" }}>
                  <div className="font-mono" style={{ fontSize: 10, color: "#64748b" }}>{f.label}</div>
                  <div className="font-mono font-bold" style={{ color: f.color }}>{f.value.toLocaleString()}</div>
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

      {activeTab === "frames" && (
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
          <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>AVATAR FRAMES</div>

          {/* Remove frame option */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => equipFrame(null)}
              disabled={equippingFrame !== null}
              className="p-3 rounded font-mono text-xs transition-all"
              style={{
                background: !(user as any).equippedFrame ? "#39d35318" : "#0a0a0f",
                border: `1px solid ${!(user as any).equippedFrame ? "#39d35340" : "#1e1e2e"}`,
                color: !(user as any).equippedFrame ? "#39d353" : "#475569",
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
                const isEquipped = (user as any).equippedFrame === frame.id;
                const rc = RARITY_COLOR[frame.rarity] || "#94a3b8";
                return (
                  <button
                    key={frame.id}
                    onClick={() => equipFrame(frame.id)}
                    disabled={equippingFrame !== null}
                    className="p-3 rounded text-left transition-all"
                    style={{
                      background: isEquipped ? rc + "15" : "#0a0a0f",
                      border: `1px solid ${isEquipped ? rc + "60" : "#1e1e2e"}`,
                      boxShadow: isEquipped ? `0 0 10px ${rc}20` : "none",
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
                        <div className="font-mono font-bold" style={{ fontSize: 11, color: rc }}>
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
