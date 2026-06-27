import { useState, useEffect, useCallback } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  user: User;
  addToast: (msg: string, t?: string) => void;
  onNav: (p: string) => void;
}

interface PlayerRow {
  _id: string;
  username: string;
  tag: string;
  email: string;
  level: number;
  dc: number;
  nc: number;
  bankBalance: number;
  role: string;
  banned: boolean;
  banReason?: string;
  mutedUntil?: string | null;
  faction?: string;
  district?: string;
  createdAt: string;
  lastLogin: string;
}

interface Stats {
  totalPlayers: number;
  onlinePlayers: number;
  bannedPlayers: number;
  totalDcInEconomy?: number;
}

interface FeedRow {
  _id: string;
  type: string;
  actor: string;
  target?: string;
  message: string;
  createdAt: string;
}

interface PatchNote {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  scheduledFor: string | null;
}

const ROLE_COLOR: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#a855f7",
  staff: "#00d4ff",
  player: "#64748b",
};

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };

type Tab = "stats" | "users" | "patch-notes" | "activity" | "items";

export function OwnerPage({ user, addToast, onNav }: Props) {
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banTargetId, setBanTargetId] = useState<string | null>(null);
  const [roleTargetId, setRoleTargetId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("player");
  const [searchQ, setSearchQ] = useState("");
  const [adjustTargetId, setAdjustTargetId] = useState<string | null>(null);
  const [adjustField, setAdjustField] = useState<"dc" | "nc" | "level">("dc");
  const [adjustValue, setAdjustValue] = useState("");
  const [muteTargetId, setMuteTargetId] = useState<string | null>(null);
  const [muteMins, setMuteMins] = useState("60");
  const [recentFeed, setRecentFeed] = useState<FeedRow[]>([]);
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSchedule, setNoteSchedule] = useState("");
  const [publishingNote, setPublishingNote] = useState(false);
  // Items tab
  const [shopItems, setShopItems] = useState<{ id: string; name: string; type: string; rarity: string; basePrice: number; currentPrice: number; overridden: boolean; description: string }[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemPriceEdit, setItemPriceEdit] = useState<string | null>(null);
  const [itemPriceVal, setItemPriceVal] = useState("");
  const [itemPriceFilter, setItemPriceFilter] = useState<string>("all");

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<Stats>("/owner/stats");
      setStats(s);
    } catch (e: any) { addToast(e.message, "error"); }
  }, [addToast]);

  const loadUsers = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      const qs = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
      const res = await api.get<{ users: PlayerRow[]; total: number; pages: number }>(`/owner/users?page=${p}&limit=20${qs}`);
      setUsers(res.users);
      setTotal(res.total);
      setPages(res.pages);
      setPage(p);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }, [addToast]);

  const loadRecentFeed = useCallback(async () => {
    try {
      const rows = await api.get<FeedRow[]>("/owner/feed/recent");
      setRecentFeed(rows);
    } catch { /* silent */ }
  }, []);

  const loadPatchNotes = useCallback(async () => {
    try {
      const notes = await api.get<PatchNote[]>("/owner/patch-notes");
      setPatchNotes(notes);
    } catch { /* silent */ }
  }, []);

  const loadShopItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const items = await api.get<any[]>("/owner/shop-items");
      setShopItems(items);
    } catch { /* silent */ }
    finally { setItemsLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "users") loadUsers(1); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "activity") loadRecentFeed(); }, [tab, loadRecentFeed]);
  useEffect(() => { if (tab === "patch-notes") loadPatchNotes(); }, [tab, loadPatchNotes]);
  useEffect(() => { if (tab === "items") loadShopItems(); }, [tab, loadShopItems]);

  async function banUser(userId: string) {
    if (!banReason.trim()) { addToast("Enter a ban reason", "error"); return; }
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/ban", { userId, reason: banReason });
      addToast(res.message, "success");
      setBanTargetId(null); setBanReason("");
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function unbanUser(userId: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/unban", { userId });
      addToast(res.message, "success");
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function muteUser(userId: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/mute", { userId, minutes: Number(muteMins) || 60 });
      addToast(res.message, "success");
      setMuteTargetId(null); setMuteMins("60");
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function unmuteUser(userId: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/unmute", { userId });
      addToast(res.message, "success");
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function adjustPlayer(userId: string) {
    if (!adjustValue.trim()) { addToast("Enter a value", "error"); return; }
    setActionId(userId);
    try {
      const endpoint = adjustField === "level" ? "/owner/set-level" : adjustField === "nc" ? "/owner/adjust-nc" : "/owner/adjust-dc";
      const body = adjustField === "level"
        ? { userId, level: Number(adjustValue) }
        : { userId, amount: Number(adjustValue) };
      const res = await api.post<{ message: string }>(endpoint, body);
      addToast(res.message, "success");
      setAdjustTargetId(null); setAdjustValue("");
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function setRole(userId: string, role: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/set-role", { userId, role });
      addToast(res.message, "success");
      setRoleTargetId(null);
      loadUsers(page, searchQ);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setActionId(null); }
  }

  async function publishNote() {
    if (!noteTitle.trim() || !noteContent.trim()) { addToast("Title and content required", "error"); return; }
    setPublishingNote(true);
    try {
      await api.post("/owner/patch-notes", {
        title: noteTitle,
        content: noteContent,
        scheduledFor: noteSchedule || undefined,
      });
      addToast("Patch note published", "success");
      setNoteTitle(""); setNoteContent(""); setNoteSchedule("");
      loadPatchNotes();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setPublishingNote(false); }
  }

  async function deleteNote(id: string) {
    try {
      await api.delete(`/owner/patch-notes/${id}`);
      addToast("Deleted", "success");
      loadPatchNotes();
    } catch (e: any) { addToast(e.message, "error"); }
  }

  async function setItemPrice(itemId: string) {
    const price = Number(itemPriceVal);
    if (isNaN(price) || price < 0) { addToast("Enter a valid price (0 to reset)", "error"); return; }
    try {
      const res = await api.post<{ message: string; price: number }>(`/owner/shop-items/${itemId}/price`, { price });
      addToast(res.message, "success");
      setItemPriceEdit(null); setItemPriceVal("");
      loadShopItems();
    } catch (e: any) { addToast(e.message, "error"); }
  }

  async function resetItemPrice(itemId: string) {
    try {
      const res = await api.delete<{ message: string }>(`/owner/shop-items/${itemId}/price`);
      addToast(res.message, "success");
      loadShopItems();
    } catch (e: any) { addToast(e.message, "error"); }
  }

  const isOwner = user.role === "owner";
  const isMuted = (u: PlayerRow) => u.mutedUntil && new Date(u.mutedUntil) > new Date();

  const TABS: { id: Tab; label: string }[] = [
    { id: "stats", label: "Dashboard" },
    { id: "users", label: `Players (${total || "?"})` },
    { id: "activity", label: "Activity" },
    { id: "patch-notes", label: "Patch Notes" },
    { id: "items", label: "Items" },
  ];

  const s = { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div style={{ ...s, borderColor: "#a855f730" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono font-bold" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>VANTA CONTROL — OWNER PANEL</div>
            <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Logged in as <span style={{ color: "#f59e0b" }}>{user.username}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f730", fontSize: 10 }}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>
          <button onClick={() => onNav("dashboard")} className="font-mono text-xs px-3 py-1.5 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="px-4 py-2 rounded font-mono text-xs transition-all"
            style={{ background: tab === t.id ? "#a855f718" : "#111118", color: tab === t.id ? "#a855f7" : "#475569", border: `1px solid ${tab === t.id ? "#a855f740" : "#1e1e2e"}` }}>
            {t.label}
          </button>
        ))}
        {["Economy", "Events", "VantaLog"].map(n => (
          <button key={n} className="px-4 py-2 rounded font-mono text-xs opacity-40 cursor-not-allowed"
            style={{ color: "#475569", border: "1px solid #1e1e2e" }} title="Coming soon — Phase 2">
            {n}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
            {[
              { label: "TOTAL PLAYERS", value: stats?.totalPlayers ?? "—", color: "#00d4ff" },
              { label: "ONLINE (15m)", value: stats?.onlinePlayers ?? "—", color: "#39d353" },
              { label: "BANNED", value: stats?.bannedPlayers ?? "—", color: "#ff2d55" },
              { label: "DC IN ECONOMY", value: stats?.totalDcInEconomy != null ? Math.round(stats.totalDcInEconomy).toLocaleString() + " DC" : "—", color: "#f59e0b" },
            ].map(st => (
              <div key={st.label} style={{ ...s, textAlign: "center" }}>
                <div className="font-mono font-bold text-xl" style={{ color: st.color }}>
                  {st.value}
                </div>
                <div className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.05em" }}>{st.label}</div>
              </div>
            ))}
          </div>
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.1em" }}>QUICK ACTIONS</div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={loadStats} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>
                Refresh
              </button>
              <button onClick={() => { setTab("users"); loadUsers(1); }} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}>
                View Players
              </button>
              <button onClick={() => setTab("activity")} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#ff6b3518", color: "#ff6b35", border: "1px solid #ff6b3540" }}>
                Recent Activity
              </button>
              <button onClick={() => setTab("patch-notes")} className="font-mono text-xs px-4 py-2 rounded" style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>
                Patch Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYERS TAB */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && loadUsers(1, searchQ)}
              placeholder="Search by username, email, or tag..."
              className="flex-1 px-3 py-2 rounded font-mono text-xs"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
            <button onClick={() => loadUsers(1, searchQ)} className="px-3 py-2 rounded font-mono text-xs" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>Search</button>
            {searchQ && <button onClick={() => { setSearchQ(""); loadUsers(1, ""); }} className="px-3 py-2 rounded font-mono text-xs" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>Clear</button>}
          </div>

          {loading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
          ) : (
            <>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u._id} style={{ background: u.banned ? "#ff2d5508" : "#111118", border: `1px solid ${u.banned ? "#ff2d5530" : "#1e1e2e"}`, borderRadius: 8, padding: 14 }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm" style={{ color: u.banned ? "#ff2d55" : "#e2e8f0" }}>{u.username}</span>
                          {u.tag && <span className="font-mono text-xs" style={{ color: "#475569" }}>{u.tag}</span>}
                          {u.faction && <span style={{ fontSize: 12 }}>{FACTION_EMOJI[u.faction] || ""}</span>}
                          <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: ROLE_COLOR[u.role] || "#64748b", background: (ROLE_COLOR[u.role] || "#64748b") + "18", border: `1px solid ${(ROLE_COLOR[u.role] || "#64748b")}30` }}>
                            {u.role}
                          </span>
                          {u.banned && <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: "#ff2d55", background: "#ff2d5520", border: "1px solid #ff2d5540" }}>BANNED</span>}
                          {isMuted(u) && <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: "#ff6b35", background: "#ff6b3520", border: "1px solid #ff6b3540" }}>MUTED</span>}
                        </div>
                        <div className="font-mono mt-1" style={{ fontSize: 11, color: "#64748b" }}>
                          {u.email} · Lv.{u.level} · {(u.dc || 0).toLocaleString()} DC wallet · {(u.bankBalance || 0).toLocaleString()} DC bank
                        </div>
                        {u.banned && u.banReason && (
                          <div className="font-mono mt-0.5" style={{ fontSize: 11, color: "#ff6b35" }}>Ban: {u.banReason}</div>
                        )}
                        <div className="font-mono" style={{ fontSize: 10, color: "#334155" }}>
                          Joined {new Date(u.createdAt).toLocaleDateString()} · Last seen {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"}
                        </div>
                      </div>

                      {u._id !== user.id && (
                        <div className="flex gap-2 flex-wrap flex-shrink-0 items-center">
                          {/* Role */}
                          {isOwner && (
                            roleTargetId === u._id ? (
                              <div className="flex gap-1 items-center">
                                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}>
                                  <option value="player">player</option>
                                  <option value="staff">staff</option>
                                  <option value="admin">admin</option>
                                  <option value="owner">owner</option>
                                </select>
                                <button onClick={() => setRole(u._id, newRole)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                                  {actionId === u._id ? "..." : "Set"}
                                </button>
                                <button onClick={() => setRoleTargetId(null)} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setRoleTargetId(u._id); setNewRole(u.role); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#a855f7", border: "1px solid #a855f730" }}>Role</button>
                            )
                          )}

                          {/* Adjust DC/NC/Level */}
                          {isOwner && (
                            adjustTargetId === u._id ? (
                              <div className="flex gap-1 items-center flex-wrap">
                                <select value={adjustField} onChange={e => setAdjustField(e.target.value as any)} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}>
                                  <option value="dc">DC</option>
                                  <option value="nc">NC</option>
                                  <option value="level">Level</option>
                                </select>
                                <input value={adjustValue} onChange={e => setAdjustValue(e.target.value)} placeholder={adjustField === "level" ? "New level" : "±amount"} type="number" className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #00d4ff40", color: "#e2e8f0", width: 90 }} />
                                <button onClick={() => adjustPlayer(u._id)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>
                                  {actionId === u._id ? "..." : "Apply"}
                                </button>
                                <button onClick={() => { setAdjustTargetId(null); setAdjustValue(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setAdjustTargetId(u._id); setAdjustField("dc"); setAdjustValue(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#00d4ff", border: "1px solid #00d4ff30" }}>Adjust</button>
                            )
                          )}

                          {/* Mute/Unmute */}
                          {isMuted(u) ? (
                            <button onClick={() => unmuteUser(u._id)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#64748b", border: "1px solid #1e1e2e" }}>
                              {actionId === u._id ? "..." : "Unmute"}
                            </button>
                          ) : (
                            muteTargetId === u._id ? (
                              <div className="flex gap-1 items-center">
                                <input value={muteMins} onChange={e => setMuteMins(e.target.value)} type="number" placeholder="mins" className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #ff6b3540", color: "#e2e8f0", width: 70 }} />
                                <button onClick={() => muteUser(u._id)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#ff6b3518", color: "#ff6b35", border: "1px solid #ff6b3540" }}>
                                  {actionId === u._id ? "..." : "Mute"}
                                </button>
                                <button onClick={() => setMuteTargetId(null)} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setMuteTargetId(u._id); setMuteMins("60"); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#ff6b35", border: "1px solid #ff6b3530" }}>Mute</button>
                            )
                          )}

                          {/* Ban/Unban */}
                          {u.banned ? (
                            <button onClick={() => unbanUser(u._id)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>
                              {actionId === u._id ? "..." : "Unban"}
                            </button>
                          ) : (
                            banTargetId === u._id ? (
                              <div className="flex gap-1 items-center">
                                <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ban reason..." className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #ff2d5540", color: "#e2e8f0", width: 140 }} />
                                <button onClick={() => banUser(u._id)} disabled={actionId === u._id} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5540" }}>
                                  {actionId === u._id ? "..." : "Confirm"}
                                </button>
                                <button onClick={() => { setBanTargetId(null); setBanReason(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setBanTargetId(u._id); setBanReason(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}>Ban</button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => loadUsers(page - 1, searchQ)} disabled={page <= 1 || loading} className="font-mono text-xs px-3 py-1.5 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e", opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                  <span className="font-mono text-xs" style={{ color: "#64748b" }}>Page {page} / {pages}</span>
                  <button onClick={() => loadUsers(page + 1, searchQ)} disabled={page >= pages || loading} className="font-mono text-xs px-3 py-1.5 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e", opacity: page >= pages ? 0.4 : 1 }}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {tab === "activity" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Recent crimes and fights in New Vanta</div>
            <button onClick={loadRecentFeed} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>Refresh</button>
          </div>
          {recentFeed.length === 0 ? (
            <div style={s} className="text-center font-mono text-xs" style2={{ color: "#475569" }}>
              <span style={{ color: "#475569" }}>No recent activity</span>
            </div>
          ) : (
            <div className="space-y-2">
              {recentFeed.map(e => (
                <div key={e._id} style={{ background: "#111118", border: `1px solid ${e.type === "fight" ? "#ff2d5530" : "#ff6b3530"}`, borderRadius: 8, padding: 12 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: e.type === "fight" ? "#ff2d55" : "#ff6b35", background: e.type === "fight" ? "#ff2d5518" : "#ff6b3518", border: `1px solid ${e.type === "fight" ? "#ff2d5540" : "#ff6b3540"}` }}>
                      {e.type.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{e.actor}</span>
                    {e.target && <><span style={{ color: "#475569" }}>→</span><span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{e.target}</span></>}
                    <span className="font-mono text-xs ml-auto" style={{ color: "#334155" }}>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.message && <div className="font-mono mt-1" style={{ fontSize: 11, color: "#64748b" }}>{e.message}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ITEMS TAB */}
      {tab === "items" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>
              Set item prices for the Corp Shop. Enter 0 to reset to default.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["all","consumable","weapon","armor","clothing","vehicle","material","badge","card"] as string[]).map(t => (
                <button key={t} onClick={() => setItemPriceFilter(t)}
                  className="px-2.5 py-1 rounded font-mono capitalize"
                  style={{ fontSize: 11, background: itemPriceFilter === t ? "#a855f718" : "transparent", color: itemPriceFilter === t ? "#a855f7" : "#475569", border: `1px solid ${itemPriceFilter === t ? "#a855f740" : "#1e1e2e"}` }}>
                  {t}
                </button>
              ))}
              <button onClick={loadShopItems} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>Refresh</button>
            </div>
          </div>

          {itemsLoading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
          ) : (
            <div className="space-y-2">
              {shopItems
                .filter(i => itemPriceFilter === "all" || i.type === itemPriceFilter)
                .map(item => {
                  const RARITY_CLR: Record<string,string> = { common:"#94a3b8",uncommon:"#39d353",rare:"#00d4ff",epic:"#a855f7",legendary:"#f59e0b",event:"#ff2d55" };
                  const rc = RARITY_CLR[item.rarity] ?? "#94a3b8";
                  return (
                    <div key={item.id} style={{ background: "#111118", border: `1px solid ${item.overridden ? "#f59e0b30" : "#1e1e2e"}`, borderRadius: 8, padding: 12 }}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{item.name}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded capitalize" style={{ color: rc, background: rc+"15", border: `1px solid ${rc}30` }}>{item.rarity}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>{item.type}</span>
                            {item.overridden && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#f59e0b", background: "#f59e0b15", border: "1px solid #f59e0b30" }}>custom price</span>}
                          </div>
                          <div className="font-mono mt-0.5" style={{ fontSize: 11, color: "#475569" }}>{item.description}</div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-sm font-bold" style={{ color: "#f59e0b" }}>{item.currentPrice.toLocaleString()} DC</div>
                            {item.overridden && (
                              <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>default: {item.basePrice.toLocaleString()}</div>
                            )}
                          </div>

                          {itemPriceEdit === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={itemPriceVal}
                                onChange={e => setItemPriceVal(e.target.value)}
                                type="number"
                                min={0}
                                placeholder="New price"
                                autoFocus
                                className="font-mono text-xs px-2 py-1 rounded"
                                style={{ background: "#0a0a0f", border: "1px solid #f59e0b40", color: "#e2e8f0", width: 100 }}
                                onKeyDown={e => { if (e.key === "Enter") setItemPrice(item.id); if (e.key === "Escape") { setItemPriceEdit(null); setItemPriceVal(""); } }}
                              />
                              <button onClick={() => setItemPrice(item.id)} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>Set</button>
                              {item.overridden && (
                                <button onClick={() => resetItemPrice(item.id)} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }} title="Reset to default">↺</button>
                              )}
                              <button onClick={() => { setItemPriceEdit(null); setItemPriceVal(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setItemPriceEdit(item.id); setItemPriceVal(String(item.currentPrice)); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#f59e0b", border: "1px solid #f59e0b30" }}>Edit</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}

      {/* PATCH NOTES TAB */}
      {tab === "patch-notes" && (
        <div className="space-y-4">
          {/* Composer */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.1em" }}>PUBLISH PATCH NOTE</div>
            <div className="space-y-3">
              <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Version title (e.g. v1.2.0 — The Heist Update)"
                className="w-full px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Describe what changed — new features, fixes, balance tweaks..."
                rows={5} className="w-full px-3 py-2 rounded font-mono text-xs resize-y"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1">
                  <label className="font-mono text-xs" style={{ color: "#64748b", whiteSpace: "nowrap" }}>Schedule for:</label>
                  <input value={noteSchedule} onChange={e => setNoteSchedule(e.target.value)} type="datetime-local" className="flex-1 px-3 py-1.5 rounded font-mono text-xs"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#64748b", outline: "none" }} />
                </div>
                <button onClick={publishNote} disabled={publishingNote} className="px-4 py-2 rounded font-mono text-xs font-bold"
                  style={{ background: publishingNote ? "#39d35318" : "#39d35330", color: "#39d353", border: "1px solid #39d35350" }}>
                  {publishingNote ? "Publishing..." : noteSchedule ? "Schedule" : "Publish Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Existing notes */}
          <div className="space-y-3">
            {patchNotes.length === 0 ? (
              <div style={{ ...s, textAlign: "center" }}><span className="font-mono text-xs" style={{ color: "#475569" }}>No patch notes published yet</span></div>
            ) : patchNotes.map(n => (
              <div key={n.id} style={s}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-mono font-bold" style={{ color: "#e2e8f0" }}>{n.title}</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#475569" }}>
                      Published {new Date(n.publishedAt).toLocaleString()}
                      {n.scheduledFor && <span style={{ color: "#f59e0b" }}> · Scheduled for {new Date(n.scheduledFor).toLocaleString()}</span>}
                    </div>
                    <div className="font-mono text-xs mt-2 whitespace-pre-wrap" style={{ color: "#94a3b8", lineHeight: 1.6 }}>{n.content}</div>
                  </div>
                  {isOwner && (
                    <button onClick={() => deleteNote(n.id)} className="font-mono text-xs px-2 py-1 rounded flex-shrink-0" style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
