import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AvatarWithFrame } from "./AvatarWithFrame";
import { EmblemRow } from "./EmblemBadge";
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
  equippedFrame: string | null;
  equippedTitle: string | null;
  titles: string[];
  wins: number;
  losses: number;
  totalCrimes: number;
  district: string;
  rank: string;
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
  const [attacking, setAttacking] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    api.get<PublicProfile>(`/user/profile/${targetId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetId]);

  if (!targetId) return null;

  const fc = profile?.faction ? FACTION_COLOR[profile.faction] || "#64748b" : "#64748b";
  const xpPct = profile ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 0;
  const isOwn = profile?.id === currentUser.id;

  async function attackPlayer() {
    if (!profile) return;
    setAttacking(true);
    try {
      const r = await api.post<any>(`/combat/pvp/${profile.id}`);
      addToast(r.narrative || (r.won ? "You won the fight!" : "You lost the fight."), r.won ? "success" : "error");
      onClose();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setAttacking(false);
    }
  }

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
      <div
        style={{
          background: "#111118",
          border: `1px solid ${fc}40`,
          borderRadius: 12,
          padding: 20,
          maxWidth: 360,
          width: "100%",
          boxShadow: `0 0 40px ${fc}20`,
        }}
        onClick={e => e.stopPropagation()}
      >
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
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <AvatarWithFrame
                username={profile.username}
                avatarUrl={profile.avatarUrl}
                frameId={profile.equippedFrame}
                size="xl"
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-base" style={{ color: "#e2e8f0" }}>
                  {profile.username}
                </div>
                <div className="font-mono text-xs" style={{ color: "#475569" }}>{profile.tag}</div>
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
                  Lv.{profile.level} {profile.prestige > 0 ? `✦${profile.prestige}` : ""} · {profile.rank}
                </div>
              </div>
              <button
                onClick={onClose}
                className="font-mono text-lg"
                style={{ color: "#475569", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* XP bar */}
            <div style={{ background: "#1e1e2e", borderRadius: 4, height: 4, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ width: `${xpPct}%`, height: "100%", background: fc, transition: "width 0.5s" }} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "STR", val: profile.strength },
                { label: "CHA", val: profile.charisma },
                { label: "INT", val: profile.intelligence },
                { label: "CRED", val: profile.streetCred },
                { label: "WINS", val: profile.wins },
                { label: "CRIMES", val: profile.totalCrimes },
              ].map(s => (
                <div key={s.label} style={{ background: "#0d0d15", borderRadius: 6, padding: "6px 10px" }}>
                  <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>{s.label}</div>
                  <div className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="font-mono text-xs mb-4 px-2 py-2 rounded" style={{ color: "#94a3b8", background: "#0d0d15", border: "1px solid #1e1e2e" }}>
                {profile.bio}
              </div>
            )}

            {/* District */}
            <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>
              📍 {profile.district.replace(/-/g, " ")}
            </div>

            {/* Actions */}
            {!isOwn && (
              <div className="flex gap-2 flex-wrap">
                {currentUser.level >= 10 && (
                  <button
                    onClick={attackPlayer}
                    disabled={attacking}
                    className="px-3 py-1.5 font-mono text-xs rounded font-bold transition-all"
                    style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}
                  >
                    {attacking ? "Attacking..." : "⚔️ Attack"}
                  </button>
                )}
                <button
                  className="px-3 py-1.5 font-mono text-xs rounded transition-all"
                  style={{ background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40" }}
                  onClick={onClose}
                >
                  💬 Message
                </button>
                <button
                  className="px-3 py-1.5 font-mono text-xs rounded transition-all"
                  style={{ background: "#1e1e2e", color: "#64748b", border: "1px solid #1e1e2e" }}
                  onClick={onClose}
                >
                  👤 Follow
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
