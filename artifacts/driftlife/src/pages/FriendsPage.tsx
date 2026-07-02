import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
  onInspectPlayer?: (userId: string) => void;
}

interface Friend {
  _id: string;
  username: string;
  tag: string;
  avatar: string;
  avatarUrl?: string | null;
  level: number;
  faction: string | null;
  equippedFrame?: string | null;
  district?: string;
}

interface FriendRequest {
  _id: string;
  from: Friend;
  createdAt: string;
}

const s = { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff2d55", grid: "#00d4ff" };

export function FriendsPage({ user, addToast, onInspectPlayer }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tab, setTab] = useState<"friends" | "requests" | "add">("friends");
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestId, setRequestId] = useState("");

  async function loadFriends() {
    try {
      const [fr, reqs] = await Promise.all([
        api.get<Friend[]>("/friends"),
        api.get<FriendRequest[]>("/friends/requests"),
      ]);
      setFriends(fr);
      setRequests(reqs);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadFriends(); }, []);

  async function sendRequest() {
    if (!requestId.trim()) return;
    setLoading(true);
    try {
      const r = await api.post<{ message: string }>("/friends/request", { targetId: requestId.trim() });
      addToast(r.message, "success");
      setRequestId("");
    } catch (e: any) {
      addToast(e.message ?? "Error sending request", "error");
    } finally { setLoading(false); }
  }

  async function acceptRequest(reqId: string) {
    try {
      const r = await api.post<{ message: string }>("/friends/accept", { requestId: reqId });
      addToast(r.message, "success");
      loadFriends();
    } catch (e: any) {
      addToast(e.message ?? "Error", "error");
    }
  }

  async function declineRequest(reqId: string) {
    try {
      const r = await api.delete<{ message: string }>(`/friends/request/${reqId}`);
      addToast(r.message, "info");
      setRequests(prev => prev.filter(r => r._id !== reqId));
    } catch (e: any) {
      addToast(e.message ?? "Error", "error");
    }
  }

  async function removeFriend(friendId: string) {
    if (!confirm("Remove this friend?")) return;
    try {
      const r = await api.delete<{ message: string }>(`/friends/${friendId}`);
      addToast(r.message, "info");
      setFriends(prev => prev.filter(f => f._id !== friendId));
    } catch (e: any) {
      addToast(e.message ?? "Error", "error");
    }
  }

  async function doSearch(q: string) {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<Friend[]>(`/user/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.filter((r: any) => r.id !== user.id));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  function FriendCard({ f }: { f: Friend }) {
    const fc = f.faction ? FACTION_COLOR[f.faction] ?? "#64748b" : "#64748b";
    return (
      <div style={{ ...s, display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "#0a0a0f", border: `2px solid ${fc}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, overflow: "hidden",
          }}
        >
          {f.avatarUrl ? <img src={f.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : f.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 13 }}>
            {f.username}
            <span className="font-normal ml-2" style={{ color: "#475569", fontSize: 11 }}>#{f.tag}</span>
          </div>
          <div className="font-mono" style={{ color: "#475569", fontSize: 11 }}>
            Lv.{f.level}
            {f.faction && <span style={{ color: fc, marginLeft: 8 }}>◈ {f.faction.toUpperCase()}</span>}
            {f.district && <span style={{ marginLeft: 8 }}>{f.district}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {onInspectPlayer && (
            <button
              onClick={() => onInspectPlayer(f._id)}
              className="font-mono text-xs px-2 py-1 rounded"
              style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff30", cursor: "pointer" }}
            >
              View
            </button>
          )}
          <button
            onClick={() => removeFriend(f._id)}
            className="font-mono text-xs px-2 py-1 rounded"
            style={{ background: "#ff2d5514", color: "#ff2d55", border: "1px solid #ff2d5530", cursor: "pointer" }}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: "friends" as const, label: `Friends (${friends.length})` },
    { id: "requests" as const, label: requests.length > 0 ? `Requests (${requests.length})` : "Requests" },
    { id: "add" as const, label: "Add Friend" },
  ];

  return (
    <div className="space-y-4" style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ ...s, borderColor: "#00d4ff20" }}>
        <div className="font-mono font-bold" style={{ color: "#00d4ff", letterSpacing: "0.08em" }}>CREW NETWORK</div>
        <div className="font-mono text-xs mt-1" style={{ color: "#475569" }}>
          Manage your connections in New Vanta.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono text-xs font-bold"
            style={{
              flex: 1, padding: "8px 0", borderRadius: 6, cursor: "pointer",
              background: tab === t.id ? "#00d4ff20" : "#111118",
              border: `1px solid ${tab === t.id ? "#00d4ff" : "#1e1e2e"}`,
              color: tab === t.id ? "#00d4ff" : "#475569",
              textTransform: "uppercase", letterSpacing: "0.06em",
              position: "relative",
            }}
          >
            {t.label}
            {t.id === "requests" && requests.length > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                background: "#ff2d55", color: "#fff",
                borderRadius: "50%", width: 16, height: 16,
                fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: "bold",
              }}>{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* FRIENDS TAB */}
      {tab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div style={{ ...s, textAlign: "center", padding: 40 }}>
              <div className="font-mono text-xs" style={{ color: "#334155" }}>
                No friends yet. Use the Add Friend tab to connect with other players.
              </div>
            </div>
          ) : (
            friends.map(f => <FriendCard key={f._id} f={f} />)
          )}
        </div>
      )}

      {/* REQUESTS TAB */}
      {tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div style={{ ...s, textAlign: "center", padding: 40 }}>
              <div className="font-mono text-xs" style={{ color: "#334155" }}>No pending friend requests.</div>
            </div>
          ) : (
            requests.map(req => {
              const f = req.from;
              const fc = f.faction ? FACTION_COLOR[f.faction] ?? "#64748b" : "#64748b";
              return (
                <div key={req._id} style={{ ...s, borderColor: "#39d35320" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "#0a0a0f", border: `2px solid ${fc}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, overflow: "hidden",
                    }}>
                      {f.avatarUrl
                        ? <img src={f.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : f.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 13 }}>
                        {f.username}
                        <span style={{ color: "#475569", fontSize: 11, fontWeight: "normal", marginLeft: 8 }}>#{f.tag}</span>
                      </div>
                      <div className="font-mono" style={{ color: "#475569", fontSize: 11 }}>
                        Lv.{f.level}
                        {f.faction && <span style={{ color: fc, marginLeft: 8 }}>◈ {f.faction.toUpperCase()}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => acceptRequest(req._id)}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRequest(req._id)}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{ background: "#ff2d5514", color: "#ff2d55", border: "1px solid #ff2d5530", cursor: "pointer" }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                  <div className="font-mono" style={{ color: "#334155", fontSize: 10, marginTop: 6 }}>
                    Sent {new Date(req.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ADD FRIEND TAB */}
      {tab === "add" && (
        <div className="space-y-4">
          {/* Send by ID */}
          <div style={{ ...s }}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.08em" }}>
              SEND BY PLAYER ID
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={requestId}
                onChange={e => setRequestId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendRequest(); }}
                placeholder="Paste player ID..."
                className="font-mono text-xs"
                style={{
                  flex: 1, background: "#0a0a0f", border: "1px solid #1e1e2e",
                  borderRadius: 6, color: "#e2e8f0", padding: "8px 12px", outline: "none",
                }}
              />
              <button
                onClick={sendRequest}
                disabled={loading || !requestId.trim()}
                className="font-mono text-xs font-bold"
                style={{
                  padding: "8px 16px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
                  background: requestId.trim() ? "#00d4ff20" : "#111118",
                  color: requestId.trim() ? "#00d4ff" : "#334155",
                  border: `1px solid ${requestId.trim() ? "#00d4ff40" : "#1e1e2e"}`,
                  flexShrink: 0,
                }}
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="font-mono text-xs mt-2" style={{ color: "#334155" }}>
              Find a player's ID by inspecting their profile.
            </div>
          </div>

          {/* Search by name */}
          <div style={{ ...s }}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.08em" }}>
              SEARCH PLAYERS
            </div>
            <input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }}
              placeholder="Search by username..."
              className="font-mono text-xs"
              style={{
                width: "100%", background: "#0a0a0f", border: "1px solid #1e1e2e",
                borderRadius: 6, color: "#e2e8f0", padding: "8px 12px", outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searching && (
              <div className="font-mono text-xs mt-2" style={{ color: "#475569" }}>Searching…</div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1 mt-2">
                {searchResults.map(r => {
                  const fc = r.faction ? FACTION_COLOR[r.faction] ?? "#64748b" : "#64748b";
                  const alreadyFriend = friends.some(f => f._id === (r as any).id || f._id === (r as any)._id);
                  return (
                    <div
                      key={(r as any).id ?? r._id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 6,
                        background: "#0a0a0f", border: "1px solid #1e1e2e",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="font-mono font-bold" style={{ color: "#e2e8f0", fontSize: 12 }}>{r.username}</span>
                        <span className="font-mono ml-2" style={{ color: "#475569", fontSize: 11 }}>#{r.tag} · Lv.{r.level}</span>
                        {r.faction && <span className="font-mono ml-2" style={{ color: fc, fontSize: 11 }}>◈ {r.faction}</span>}
                      </div>
                      {alreadyFriend ? (
                        <span className="font-mono text-xs" style={{ color: "#39d353" }}>Friends ✓</span>
                      ) : (
                        <button
                          onClick={async () => {
                            const targetId = (r as any).id ?? r._id;
                            setLoading(true);
                            try {
                              const res = await api.post<{ message: string }>("/friends/request", { targetId });
                              addToast(res.message, "success");
                              setSearchQ("");
                              setSearchResults([]);
                            } catch (e: any) {
                              addToast(e.message ?? "Error sending request", "error");
                            } finally { setLoading(false); }
                          }}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff30", cursor: "pointer", flexShrink: 0 }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
