import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AvatarWithFrame } from "./AvatarWithFrame";
import { FrameCardWrapper } from "./FrameCardWrapper";
import { getFrame, RARITY_COLORS as RARITY_COLOR } from "../lib/frames";
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
  equippedFrameColor: string | null;
  equippedTitle: string | null;
  titles: string[];
  wins: number;
  losses: number;
  totalCrimes: number;
  district: string;
  rank: string;
  onlineStatus?: "online" | "away" | "offline";
}

interface OwnedFrame { id: string; name: string; rarity: string; }

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
  const [showGift, setShowGift] = useState(false);
  const [myFrames, setMyFrames] = useState<OwnedFrame[]>([]);
  const [selectedGiftFrame, setSelectedGiftFrame] = useState("");
  const [gifting, setGifting] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setProfile(null);
    setShowGift(false);
    setSelectedGiftFrame("");
    api.get<PublicProfile>(`/user/profile/${targetId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetId]);

  useEffect(() => {
    if (showGift && myFrames.length === 0) {
      api.get<{ ownedFrames: string[] }>("/user/me").then(me => {
        const owned: OwnedFrame[] = (me.ownedFrames || []).map((fid: string) => {
          const def = getFrame(fid);
          return def ? { id: fid, name: def.name, rarity: def.rarity } : { id: fid, name: fid, rarity: "common" };
        });
        setMyFrames(owned);
      }).catch(() => {});
    }
  }, [showGift, myFrames.length]);

  if (!targetId) return null;

  const frameId = profile?.equippedFrame || null;
  const frameDef = frameId ? getFrame(frameId) : null;
  const frameColor = profile?.equippedFrameColor || frameDef?.glowColor || null;
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

  async function giftFrame() {
    if (!profile || !selectedGiftFrame) return;
    setGifting(true);
    try {
      const r = await api.post<{ message: string }>("/frames/gift", { frameId: selectedGiftFrame, recipientId: profile.id });
      addToast(r.message, "success");
      setShowGift(false);
      setSelectedGiftFrame("");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setGifting(false);
    }
  }

  const RARITY_CLR: Record<string, string> = {
    common: "#9ca3af", uncommon: "#4ade80", rare: "#60a5fa",
    epic: "#c084fc", legendary: "#fbbf24", mythic: "#00ff41",
  };

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
        <FrameCardWrapper
          frameId={frameId}
          colorOverride={frameColor}
          borderRadius={12}
          style={{ background: "#111118" }}
        >
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
                  <AvatarWithFrame
                    username={profile.username}
                    avatarUrl={profile.avatarUrl}
                    frameId={frameId}
                    size="xl"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-mono font-bold text-base" style={{ color: frameColor || "#e2e8f0" }}>
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
                    {frameDef && (
                      <div
                        className="font-mono text-xs mt-0.5 px-1.5 py-0.5 rounded inline-block"
                        style={{
                          background: (frameColor || frameDef.glowColor) + "20",
                          color: frameColor || frameDef.glowColor,
                          border: `1px solid ${(frameColor || frameDef.glowColor)}40`,
                          textTransform: "capitalize",
                          fontSize: 10,
                        }}
                      >
                        {frameDef.name} · {frameDef.rarity}
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
                  <div style={{ width: `${xpPct}%`, height: "100%", background: frameColor || fc, transition: "width 0.5s" }} />
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div
                    className="font-mono text-xs mb-4 px-3 py-2 rounded"
                    style={{
                      color: "#94a3b8",
                      background: "#0d0d15",
                      border: `1px solid ${frameColor || "#1e1e2e"}30`,
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

                {/* Gift Frame panel */}
                {!isOwn && showGift && (
                  <div style={{ background: "#0d0d15", border: "1px solid #a855f730", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div className="font-mono text-xs font-bold mb-2" style={{ color: "#a855f7" }}>GIFT A FRAME</div>
                    {myFrames.length === 0 ? (
                      <div className="font-mono text-xs" style={{ color: "#475569" }}>You have no frames to gift.</div>
                    ) : (
                      <>
                        <select
                          value={selectedGiftFrame}
                          onChange={e => setSelectedGiftFrame(e.target.value)}
                          className="w-full font-mono text-xs px-2 py-1.5 rounded mb-2"
                          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                        >
                          <option value="">-- Select a frame --</option>
                          {myFrames.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} ({f.rarity})
                            </option>
                          ))}
                        </select>
                        {selectedGiftFrame && (() => {
                          const def = getFrame(selectedGiftFrame);
                          const rc = def ? RARITY_CLR[def.rarity] || "#9ca3af" : "#9ca3af";
                          void RARITY_COLOR;
                          return (
                            <div className="font-mono mb-2" style={{ fontSize: 10, color: rc }}>
                              {def?.name} · {def?.rarity} · Permanently transferred. This cannot be undone.
                            </div>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={giftFrame}
                            disabled={gifting || !selectedGiftFrame}
                            className="flex-1 px-3 py-1.5 rounded font-mono text-xs font-bold"
                            style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
                          >
                            {gifting ? "Sending..." : "Confirm Gift"}
                          </button>
                          <button
                            onClick={() => { setShowGift(false); setSelectedGiftFrame(""); }}
                            className="px-3 py-1.5 rounded font-mono text-xs"
                            style={{ color: "#475569", border: "1px solid #1e1e2e" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
                        {attacking ? "Attacking..." : "Attack"}
                      </button>
                    )}
                    {(currentUser.ownedFrames || []).length > 0 && !showGift && (
                      <button
                        onClick={() => setShowGift(true)}
                        className="px-3 py-1.5 font-mono text-xs rounded transition-all"
                        style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f730" }}
                      >
                        Gift Frame
                      </button>
                    )}
                  </div>
                )}
                {isOwn && (
                  <div className="font-mono text-xs text-center" style={{ color: "#475569" }}>
                    This is your profile
                  </div>
                )}
              </>
            )}
          </div>
        </FrameCardWrapper>
      </div>
    </div>
  );
}
