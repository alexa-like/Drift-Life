import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface PublicProfile {
  id: string;
  username: string;
  tag: string;
  avatar: string;
  avatarUrl: string | null;
  bio: string;
  faction: string | null;
  level: number;
  xp: number;
  xpToNext: number;
  prestige: number;
  strength: number;
  charisma: number;
  intelligence: number;
  streetCred: number;
  equippedTitle: string | null;
  titles: string[];
  wins: number;
  losses: number;
  totalCrimes: number;
  district: string;
  rank: string;
  onlineStatus?: "online" | "away" | "offline";
}

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

interface Props {
  targetId: string | null;
  currentUser: User;
  onClose: () => void;
  onNav?: (page: string) => void;
  addToast: (msg: string, t?: string) => void;
}

export function PlayerInspectModal({ targetId, currentUser, onClose, addToast }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setProfile(null);
    api.get<PublicProfile>(`/user/profile/${targetId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetId]);

  if (!targetId) return null;

  const fc = profile?.faction ? FACTION_COLOR[profile.faction] || "#64748b" : "#64748b";
  const xpPct = profile ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 0;
  const isOwn = profile?.id === currentUser.id;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ background: "#111118", borderRadius: 12 }}>
          <div style={{ borderRadius: 12, padding: 20 }}>
            {loading ? (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#64748b" }}>
                Accessing records...
              </div>
            ) : !profile ? (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#ff2d55" }}>
                Profile not found
              </div>
            ) : (
              <>
                {/* Close button */}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={onClose}
                    className="font-mono text-lg"
                    style={{ color: "#475569", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", background: "#1e1e2e",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, border: "2px solid #334155", flexShrink: 0,
                  }}>
                    {profile.avatarUrl
                      ? <img src={profile.avatarUrl} alt={profile.username} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      : profile.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-mono font-bold text-base" style={{ color: "#e2e8f0" }}>
                        {profile.username}
                      </div>
                      {/* Online status dot */}
                      {(() => {
                        const s = profile.onlineStatus;
                        const color = s === "online" ? "#39d353" : s === "away" ? "#f59e0b" : "#334155";
                        const label = s === "online" ? "Online" : s === "away" ? "Away" : "Offline";
                        return (
                          <div title={label} style={{
                            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                            background: color,
                            boxShadow: s === "online" ? `0 0 6px ${color}` : "none",
                          }} />
                        );
                      })()}
                    </div>
                    {profile.tag && (
                      <div className="font-mono text-xs" style={{ color: "#475569" }}>{profile.tag}</div>
                    )}
                    {profile.equippedTitle && (
                      <div className="font-mono text-xs mt-0.5" style={{ color: "#a855f7" }}>
                        [{profile.equippedTitle}]
                      </div>
                    )}
                    {profile.faction && (
                      <div className="font-mono text-xs mt-1" style={{ color: fc }}>
                        {FACTION_EMOJI[profile.faction]} {profile.faction.toUpperCase()}
                      </div>
                    )}
                    <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                      Lv.{profile.level}{profile.prestige > 0 ? ` ✦${profile.prestige}` : ""} · {profile.rank}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "#475569" }}>
                      {profile.district.replace(/-/g, " ")}
                    </div>
                  </div>
                </div>

                {/* XP bar */}
                <div style={{ background: "#1e1e2e", borderRadius: 4, height: 4, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ width: `${xpPct}%`, height: "100%", background: fc, transition: "width 0.5s" }} />
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div
                    className="font-mono text-xs mb-4 px-3 py-2 rounded"
                    style={{
                      color: "#94a3b8",
                      background: "#0d0d15",
                      border: "1px solid #1e1e2e30",
                    }}
                  >
                    "{profile.bio}"
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "STR",    val: profile.strength,    color: "#ff6b35" },
                    { label: "CHA",    val: profile.charisma,    color: "#a855f7" },
                    { label: "INT",    val: profile.intelligence, color: "#00d4ff" },
                    { label: "CRED",   val: profile.streetCred,  color: "#f59e0b" },
                    { label: "WINS",   val: profile.wins,        color: "#39d353" },
                    { label: "CRIMES", val: profile.totalCrimes, color: "#ff2d55" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px", border: "1px solid #1e1e2e" }}>
                      <div className="font-mono" style={{ color: "#475569", fontSize: 9 }}>{s.label}</div>
                      <div className="font-mono font-bold text-sm" style={{ color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {isOwn && (
                  <div className="font-mono text-xs text-center" style={{ color: "#475569" }}>
                    This is your profile
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
