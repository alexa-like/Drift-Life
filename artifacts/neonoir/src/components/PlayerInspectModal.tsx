import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { User } from "../shared/types";

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
  onTradeWith?: (player: { id: string; username: string }) => void;
  addToast: (msg: string, t?: string) => void;
}

type ActionModal = "gift-dc" | "gift-nc" | null;

export function PlayerInspectModal({ targetId, currentUser, onClose, onNav, onTradeWith, addToast }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [giftAmount, setGiftAmount] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setProfile(null);
    setFriendSent(false);
    setActionModal(null);
    api.get<PublicProfile>(`/user/profile/${targetId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetId]);

  if (!targetId) return null;

  const fc = profile?.faction ? FACTION_COLOR[profile.faction] || "#64748b" : "#64748b";
  const xpPct = profile ? Math.min(100, Math.round((profile.xp / profile.xpToNext) * 100)) : 0;
  const isOwn = profile?.id === currentUser.id;

  async function sendFriendRequest() {
    if (!profile) return;
    setActionPending(true);
    try {
      await api.post("/friends/request", { targetId: profile.id });
      setFriendSent(true);
      addToast(`Friend request sent to ${profile.username}`, "success");
    } catch (e: any) {
      addToast(e.message ?? "Failed to send request", "error");
    } finally {
      setActionPending(false);
    }
  }

  async function sendGift(type: "dc" | "nc") {
    if (!profile) return;
    const amount = parseInt(giftAmount, 10);
    if (!amount || amount <= 0) { addToast("Enter a valid amount", "error"); return; }
    setActionPending(true);
    try {
      if (type === "nc") {
        await api.post("/store/gift-nc", { recipientUsername: profile.username, amount });
        addToast(`Gifted ${amount} NC to ${profile.username} (10% fee)`, "success");
      } else {
        await api.post("/bank/transfer", { targetUsername: profile.username, amount });
        addToast(`Sent ${amount} DC to ${profile.username} (7% wire fee)`, "success");
      }
      setActionModal(null);
      setGiftAmount("");
    } catch (e: any) {
      addToast(e.message ?? "Transfer failed", "error");
    } finally {
      setActionPending(false);
    }
  }

  const btnStyle = (color: string): React.CSSProperties => ({
    flex: 1,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "bold",
    padding: "7px 6px",
    borderRadius: 6,
    border: `1px solid ${color}40`,
    background: `${color}14`,
    color,
    cursor: "pointer",
    transition: "background 0.15s",
    minWidth: 0,
  });

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
      onClick={() => { setActionModal(null); onClose(); }}
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
                    {(() => {
                      const s = profile.onlineStatus;
                      const color = s === "online" ? "#39d353" : s === "away" ? "#f59e0b" : "#334155";
                      const label = s === "online" ? "Online" : s === "away" ? "Away" : "Offline";
                      const statusDot = (
                        <div title={label} style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: color,
                          boxShadow: s === "online" ? `0 0 6px ${color}` : "none",
                        }} />
                      );
                      return (
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-bold text-base" style={{ color: "#e2e8f0" }}>
                            {profile.username}
                          </div>
                          {statusDot}
                        </div>
                      );
                    })()}
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
                    style={{ color: "#94a3b8", background: "#0d0d15", border: "1px solid #1e1e2e30" }}
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

                {isOwn ? (
                  <div className="font-mono text-xs text-center" style={{ color: "#475569" }}>
                    This is your profile
                  </div>
                ) : (
                  <>
                    {/* Gift amount input (shown when a gift action is active) */}
                    {actionModal && (
                      <div style={{ marginBottom: 10, padding: "10px 12px", background: "#0a0a0f", borderRadius: 8, border: "1px solid #1e293b" }}>
                        <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>
                          {actionModal === "gift-nc"
                            ? "SEND NC (100–10,000 · 10% fee)"
                            : "SEND DC (7% wire fee)"}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="number"
                            min={actionModal === "gift-nc" ? 100 : 1}
                            max={actionModal === "gift-nc" ? 10000 : undefined}
                            value={giftAmount}
                            onChange={e => setGiftAmount(e.target.value)}
                            placeholder={actionModal === "gift-nc" ? "100–10,000" : "Amount"}
                            style={{
                              flex: 1, fontFamily: "monospace", fontSize: 12,
                              background: "#111118", border: "1px solid #334155",
                              color: "#e2e8f0", borderRadius: 6, padding: "6px 10px",
                              outline: "none",
                            }}
                          />
                          <button
                            disabled={actionPending}
                            onClick={() => sendGift(actionModal === "gift-nc" ? "nc" : "dc")}
                            style={{
                              fontFamily: "monospace", fontSize: 12, fontWeight: "bold",
                              padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                              background: actionModal === "gift-nc" ? "#a855f720" : "#00d4ff20",
                              border: `1px solid ${actionModal === "gift-nc" ? "#a855f760" : "#00d4ff60"}`,
                              color: actionModal === "gift-nc" ? "#a855f7" : "#00d4ff",
                              opacity: actionPending ? 0.5 : 1,
                            }}
                          >
                            {actionPending ? "..." : "Send"}
                          </button>
                          <button
                            onClick={() => { setActionModal(null); setGiftAmount(""); }}
                            style={{
                              fontFamily: "monospace", fontSize: 12, padding: "6px 10px",
                              borderRadius: 6, cursor: "pointer",
                              background: "#1e293b", border: "1px solid #334155", color: "#64748b",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons row 1 */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <button
                        disabled={actionPending || friendSent}
                        onClick={sendFriendRequest}
                        style={btnStyle(friendSent ? "#39d353" : "#64748b")}
                      >
                        {friendSent ? "✓ Requested" : "➕ Add Friend"}
                      </button>
                      <button
                        onClick={() => { setActionModal(actionModal === "gift-dc" ? null : "gift-dc"); setGiftAmount(""); }}
                        style={btnStyle(actionModal === "gift-dc" ? "#00d4ff" : "#00d4ff")}
                      >
                        💸 Gift DC
                      </button>
                      <button
                        onClick={() => { setActionModal(actionModal === "gift-nc" ? null : "gift-nc"); setGiftAmount(""); }}
                        style={btnStyle(actionModal === "gift-nc" ? "#a855f7" : "#a855f7")}
                      >
                        💎 Gift NC
                      </button>
                    </div>

                    {/* Action buttons row 2 */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          onClose();
                          if (profile && onTradeWith) {
                            onTradeWith({ id: profile.id, username: profile.username });
                          } else {
                            onNav?.("trade");
                          }
                        }}
                        style={btnStyle("#f59e0b")}
                      >
                        🤝 Trade
                      </button>
                      <button
                        onClick={() => { onClose(); onNav?.("chat"); }}
                        style={btnStyle("#39d353")}
                      >
                        💬 Message
                      </button>
                      <button
                        onClick={() => { onClose(); onNav?.("arena"); }}
                        style={btnStyle("#ff6b35")}
                      >
                        ⚔️ Arena
                      </button>
                      <button
                        onClick={() => { onClose(); onNav?.("racing"); }}
                        style={btnStyle("#ff2d55")}
                      >
                        🏎️ Race
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
