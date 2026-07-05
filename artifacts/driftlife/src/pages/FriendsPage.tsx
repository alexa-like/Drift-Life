import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";

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

const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff2d55", grid: "#00d4ff" };

export function FriendsPage({ user, addToast, onInspectPlayer }: Props) {
  const [friends,       setFriends]       = useState<Friend[]>([]);
  const [requests,      setRequests]      = useState<FriendRequest[]>([]);
  const [tab,           setTab]           = useState<"friends" | "requests" | "add">("friends");
  const [loading,       setLoading]       = useState(false);
  const [searchQ,       setSearchQ]       = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [requestId,     setRequestId]     = useState("");

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
    } catch (e: any) { addToast(e.message ?? "Error", "error"); }
  }

  async function declineRequest(reqId: string) {
    try {
      const r = await api.delete<{ message: string }>(`/friends/request/${reqId}`);
      addToast(r.message, "info");
      setRequests(prev => prev.filter(r => r._id !== reqId));
    } catch (e: any) { addToast(e.message ?? "Error", "error"); }
  }

  async function removeFriend(friendId: string) {
    if (!confirm("Remove this friend?")) return;
    try {
      const r = await api.delete<{ message: string }>(`/friends/${friendId}`);
      addToast(r.message, "info");
      setFriends(prev => prev.filter(f => f._id !== friendId));
    } catch (e: any) { addToast(e.message ?? "Error", "error"); }
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
      <AnimatedCard accent={fc} className="flex items-center gap-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden"
          style={{ width: 38, height: 38, background: "#0a0a0f", border: `2px solid ${fc}` }}
        >
          {f.avatarUrl
            ? <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="font-mono font-bold text-sm" style={{ color: fc }}>
                {f.username.slice(0, 2).toUpperCase()}
              </span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
            {f.username}
            <span className="font-normal ml-2" style={{ color: "#475569", fontSize: 11 }}>#{f.tag}</span>
          </div>
          <div className="font-mono text-xs" style={{ color: "#475569" }}>
            Lv.{f.level}
            {f.faction && <span style={{ color: fc, marginLeft: 8 }}>◈ {f.faction.toUpperCase()}</span>}
            {f.district && <span style={{ marginLeft: 8 }}>{f.district}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {onInspectPlayer && (
            <CyberButton size="sm" variant="primary" onClick={() => onInspectPlayer(f._id)}>
              View
            </CyberButton>
          )}
          <CyberButton size="sm" variant="danger" onClick={() => removeFriend(f._id)}>
            Remove
          </CyberButton>
        </div>
      </AnimatedCard>
    );
  }

  const TABS = [
    { id: "friends"  as const, label: `Friends (${friends.length})` },
    { id: "requests" as const, label: requests.length > 0 ? `Requests (${requests.length})` : "Requests" },
    { id: "add"      as const, label: "Add Friend" },
  ];

  return (
    <div className="space-y-4" style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <AnimatedCard accent="#00d4ff">
        <CyberSectionHeader title="CREW NETWORK" accent="#00d4ff" cursor />
        <p className="font-mono text-xs" style={{ color: "#475569" }}>
          Manage your connections in New Vanta.
        </p>
      </AnimatedCard>

      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <motion.button
            key={t.id}
            onClick={() => setTab(t.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative flex-1 font-mono text-xs font-bold py-2 rounded uppercase tracking-wide"
            style={{
              background: tab === t.id ? "#00d4ff20" : "#111118",
              border:     `1px solid ${tab === t.id ? "#00d4ff" : "#1e1e2e"}`,
              color:      tab === t.id ? "#00d4ff" : "#475569",
            }}
          >
            {t.label}
            {t.id === "requests" && requests.length > 0 && (
              <span
                className="absolute flex items-center justify-center font-bold"
                style={{
                  top: -5, right: -5,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#ff2d55", color: "#fff", fontSize: 9,
                }}
              >
                {requests.length}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* FRIENDS TAB */}
      {tab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <AnimatedCard className="text-center py-10">
              <p className="font-mono text-xs" style={{ color: "#334155" }}>
                No friends yet. Use the Add Friend tab to connect with other players.
              </p>
            </AnimatedCard>
          ) : (
            friends.map(f => <FriendCard key={f._id} f={f} />)
          )}
        </div>
      )}

      {/* REQUESTS TAB */}
      {tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <AnimatedCard className="text-center py-10">
              <p className="font-mono text-xs" style={{ color: "#334155" }}>No pending friend requests.</p>
            </AnimatedCard>
          ) : (
            requests.map(req => {
              const f  = req.from;
              const fc = f.faction ? FACTION_COLOR[f.faction] ?? "#64748b" : "#64748b";
              return (
                <AnimatedCard key={req._id} accent="#39d353" className="flex items-center gap-3">
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden"
                    style={{ width: 38, height: 38, background: "#0a0a0f", border: `2px solid ${fc}` }}
                  >
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="font-mono font-bold text-sm" style={{ color: fc }}>
                          {f.username.slice(0, 2).toUpperCase()}
                        </span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
                      {f.username}
                      <span style={{ color: "#475569", fontSize: 11, fontWeight: "normal", marginLeft: 8 }}>#{f.tag}</span>
                    </div>
                    <div className="font-mono text-xs" style={{ color: "#475569" }}>
                      Lv.{f.level}
                      {f.faction && <span style={{ color: fc, marginLeft: 8 }}>◈ {f.faction.toUpperCase()}</span>}
                    </div>
                    <div className="font-mono" style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <CyberButton size="sm" variant="success" onClick={() => acceptRequest(req._id)}>Accept</CyberButton>
                    <CyberButton size="sm" variant="danger"  onClick={() => declineRequest(req._id)}>Decline</CyberButton>
                  </div>
                </AnimatedCard>
              );
            })
          )}
        </div>
      )}

      {/* ADD FRIEND TAB */}
      {tab === "add" && (
        <div className="space-y-4">
          <AnimatedCard accent="#00d4ff">
            <CyberSectionHeader title="SEND BY PLAYER ID" accent="#64748b" size="sm" />
            <div className="flex gap-2">
              <input
                value={requestId}
                onChange={e => setRequestId(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendRequest(); }}
                placeholder="Paste player ID..."
                className="flex-1 px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
              />
              <CyberButton
                variant="primary"
                size="sm"
                loading={loading}
                disabled={!requestId.trim()}
                onClick={sendRequest}
              >
                Send
              </CyberButton>
            </div>
            <p className="font-mono text-xs mt-2" style={{ color: "#334155" }}>
              Find a player's ID by inspecting their profile.
            </p>
          </AnimatedCard>

          <AnimatedCard accent="#00d4ff">
            <CyberSectionHeader title="SEARCH PLAYERS" accent="#64748b" size="sm" />
            <input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }}
              placeholder="Search by username..."
              className="w-full font-mono text-xs px-3 py-2 rounded"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
            />
            {searching && (
              <div className="font-mono text-xs mt-2" style={{ color: "#475569" }}>Searching...</div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1 mt-3">
                {searchResults.map(r => {
                  const fc = r.faction ? FACTION_COLOR[r.faction] ?? "#64748b" : "#64748b";
                  const alreadyFriend = friends.some(f => f._id === (r as any).id || f._id === (r as any)._id);
                  return (
                    <div
                      key={(r as any).id ?? r._id}
                      className="flex items-center gap-3 px-3 py-2 rounded"
                      style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-bold text-xs" style={{ color: "#e2e8f0" }}>{r.username}</span>
                        <span className="font-mono ml-2" style={{ color: "#475569", fontSize: 11 }}>#{r.tag} · Lv.{r.level}</span>
                        {r.faction && <span className="font-mono ml-2" style={{ color: fc, fontSize: 11 }}>◈ {r.faction}</span>}
                      </div>
                      {alreadyFriend ? (
                        <span className="font-mono text-xs" style={{ color: "#39d353" }}>Connected</span>
                      ) : (
                        <CyberButton
                          size="sm"
                          variant="primary"
                          loading={loading}
                          onClick={async () => {
                            const targetId = (r as any).id ?? r._id;
                            setLoading(true);
                            try {
                              const res = await api.post<{ message: string }>("/friends/request", { targetId });
                              addToast(res.message, "success");
                              setSearchQ(""); setSearchResults([]);
                            } catch (e: any) {
                              addToast(e.message ?? "Error sending request", "error");
                            } finally { setLoading(false); }
                          }}
                        >
                          + Add
                        </CyberButton>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </AnimatedCard>
        </div>
      )}
    </div>
  );
}
