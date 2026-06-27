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
  email: string;
  level: number;
  dc: number;
  role: string;
  banned: boolean;
  banReason?: string;
  createdAt: string;
  lastLogin: string;
}

interface Stats {
  totalPlayers: number;
  onlinePlayers: number;
  bannedPlayers: number;
}

const ROLE_COLOR: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#a855f7",
  player: "#64748b",
};

export function OwnerPage({ user, addToast, onNav }: Props) {
  const [tab, setTab] = useState<"stats" | "users">("stats");
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

  const loadStats = useCallback(async () => {
    try {
      const s = await api.get<Stats>("/owner/stats");
      setStats(s);
    } catch (e: any) {
      addToast(e.message, "error");
    }
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
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "users") loadUsers(1);
  }, [tab, loadUsers]);

  async function banUser(userId: string) {
    if (!banReason.trim()) { addToast("Enter a ban reason", "error"); return; }
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/ban", { userId, reason: banReason });
      addToast(res.message, "success");
      setBanTargetId(null);
      setBanReason("");
      loadUsers(page);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function unbanUser(userId: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/unban", { userId });
      addToast(res.message, "success");
      loadUsers(page);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionId(null);
    }
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
      setAdjustTargetId(null);
      setAdjustValue("");
      loadUsers(page, searchQ);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionId(null);
    }
  }

  async function setRole(userId: string, role: string) {
    setActionId(userId);
    try {
      const res = await api.post<{ message: string }>("/owner/set-role", { userId, role });
      addToast(res.message, "success");
      setRoleTargetId(null);
      loadUsers(page);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div style={{ background: "#111118", border: "1px solid #a855f730", borderRadius: 8, padding: 20 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono font-bold" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>OWNER PANEL</div>
            <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Logged in as <span style={{ color: "#f59e0b" }}>{user.username}</span>
              <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f730", fontSize: 10 }}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={() => onNav("dashboard")}
            className="font-mono text-xs px-3 py-1.5 rounded"
            style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "stats" as const, label: "Stats" },
          { id: "users" as const, label: `Users (${total || "?"})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded font-mono text-xs transition-all"
            style={{
              background: tab === t.id ? "#a855f718" : "#111118",
              color: tab === t.id ? "#a855f7" : "#475569",
              border: `1px solid ${tab === t.id ? "#a855f740" : "#1e1e2e"}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "TOTAL PLAYERS", value: stats?.totalPlayers ?? "—", color: "#00d4ff" },
              { label: "ONLINE (15m)", value: stats?.onlinePlayers ?? "—", color: "#39d353" },
              { label: "BANNED", value: stats?.bannedPlayers ?? "—", color: "#ff2d55" },
            ].map(s => (
              <div key={s.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20, textAlign: "center" }}>
                <div className="font-mono font-bold text-2xl" style={{ color: s.color }}>
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </div>
                <div className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <div className="font-mono text-xs font-bold mb-4" style={{ color: "#64748b", letterSpacing: "0.1em" }}>QUICK ACTIONS</div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={loadStats}
                className="font-mono text-xs px-4 py-2 rounded"
                style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
              >
                Refresh Stats
              </button>
              <button
                onClick={() => { setTab("users"); loadUsers(1); }}
                className="font-mono text-xs px-4 py-2 rounded"
                style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}
              >
                View All Users
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="flex gap-2">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadUsers(1, searchQ)}
              placeholder="Search by username, email, or tag..."
              className="flex-1 px-3 py-2 rounded font-mono text-xs"
              style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
            />
            <button
              onClick={() => loadUsers(1, searchQ)}
              className="px-3 py-2 rounded font-mono text-xs"
              style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
            >
              Search
            </button>
            {searchQ && (
              <button onClick={() => { setSearchQ(""); loadUsers(1, ""); }} className="px-3 py-2 rounded font-mono text-xs" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>
                Clear
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
          ) : (
            <>
              <div className="space-y-2">
                {users.map(u => (
                  <div
                    key={u._id}
                    style={{
                      background: u.banned ? "#ff2d5508" : "#111118",
                      border: `1px solid ${u.banned ? "#ff2d5530" : "#1e1e2e"}`,
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold" style={{ color: u.banned ? "#ff2d55" : "#e2e8f0" }}>
                            {u.username}
                          </span>
                          <span
                            className="font-mono px-1.5 py-0.5 rounded"
                            style={{
                              fontSize: 10,
                              color: ROLE_COLOR[u.role] || "#64748b",
                              background: (ROLE_COLOR[u.role] || "#64748b") + "18",
                              border: `1px solid ${(ROLE_COLOR[u.role] || "#64748b")}30`,
                            }}
                          >
                            {u.role}
                          </span>
                          {u.banned && (
                            <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: "#ff2d55", background: "#ff2d5520", border: "1px solid #ff2d5540" }}>
                              BANNED
                            </span>
                          )}
                        </div>
                        <div className="font-mono mt-1" style={{ fontSize: 11, color: "#64748b" }}>
                          {u.email} · Lv.{u.level} · {u.dc.toLocaleString()} DC
                        </div>
                        {u.banned && u.banReason && (
                          <div className="font-mono mt-1" style={{ fontSize: 11, color: "#ff6b35" }}>
                            Reason: {u.banReason}
                          </div>
                        )}
                        <div className="font-mono" style={{ fontSize: 10, color: "#334155" }}>
                          Joined {new Date(u.createdAt).toLocaleDateString()} · Last seen {new Date(u.lastLogin).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Actions */}
                      {u._id !== user.id && (
                        <div className="flex gap-2 flex-wrap flex-shrink-0">
                          {/* Role change */}
                          {user.role === "owner" && (
                            <>
                              {roleTargetId === u._id ? (
                                <div className="flex gap-1 items-center">
                                  <select
                                    value={newRole}
                                    onChange={e => setNewRole(e.target.value)}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
                                  >
                                    <option value="player">player</option>
                                    <option value="admin">admin</option>
                                    <option value="owner">owner</option>
                                  </select>
                                  <button
                                    onClick={() => setRole(u._id, newRole)}
                                    disabled={actionId === u._id}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}
                                  >
                                    {actionId === u._id ? "..." : "Set"}
                                  </button>
                                  <button
                                    onClick={() => setRoleTargetId(null)}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ color: "#475569", border: "1px solid #1e1e2e" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setRoleTargetId(u._id); setNewRole(u.role); }}
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ color: "#a855f7", border: "1px solid #a855f730" }}
                                >
                                  Role
                                </button>
                              )}
                            </>
                          )}

                          {/* Adjust DC/NC/Level */}
                          {user.role === "owner" && (
                            <>
                              {adjustTargetId === u._id ? (
                                <div className="flex gap-1 items-center flex-wrap">
                                  <select
                                    value={adjustField}
                                    onChange={e => setAdjustField(e.target.value as any)}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
                                  >
                                    <option value="dc">DC</option>
                                    <option value="nc">NC</option>
                                    <option value="level">Level</option>
                                  </select>
                                  <input
                                    value={adjustValue}
                                    onChange={e => setAdjustValue(e.target.value)}
                                    placeholder={adjustField === "level" ? "New level" : "±amount"}
                                    type="number"
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#0a0a0f", border: "1px solid #00d4ff40", color: "#e2e8f0", width: 90 }}
                                  />
                                  <button
                                    onClick={() => adjustPlayer(u._id)}
                                    disabled={actionId === u._id}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
                                  >
                                    {actionId === u._id ? "..." : "Apply"}
                                  </button>
                                  <button
                                    onClick={() => { setAdjustTargetId(null); setAdjustValue(""); }}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ color: "#475569", border: "1px solid #1e1e2e" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAdjustTargetId(u._id); setAdjustField("dc"); setAdjustValue(""); }}
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ color: "#00d4ff", border: "1px solid #00d4ff30" }}
                                >
                                  Adjust
                                </button>
                              )}
                            </>
                          )}

                          {/* Ban/unban */}
                          {u.banned ? (
                            <button
                              onClick={() => unbanUser(u._id)}
                              disabled={actionId === u._id}
                              className="font-mono text-xs px-2 py-1 rounded"
                              style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}
                            >
                              {actionId === u._id ? "..." : "Unban"}
                            </button>
                          ) : (
                            <>
                              {banTargetId === u._id ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    value={banReason}
                                    onChange={e => setBanReason(e.target.value)}
                                    placeholder="Ban reason..."
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#0a0a0f", border: "1px solid #ff2d5540", color: "#e2e8f0", width: 140 }}
                                  />
                                  <button
                                    onClick={() => banUser(u._id)}
                                    disabled={actionId === u._id}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5540" }}
                                  >
                                    {actionId === u._id ? "..." : "Confirm"}
                                  </button>
                                  <button
                                    onClick={() => { setBanTargetId(null); setBanReason(""); }}
                                    className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ color: "#475569", border: "1px solid #1e1e2e" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setBanTargetId(u._id); setBanReason(""); }}
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}
                                >
                                  Ban
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => loadUsers(page - 1)}
                    disabled={page <= 1 || loading}
                    className="font-mono text-xs px-3 py-1.5 rounded"
                    style={{ color: "#475569", border: "1px solid #1e1e2e", opacity: page <= 1 ? 0.4 : 1 }}
                  >
                    Prev
                  </button>
                  <span className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Page {page} / {pages}
                  </span>
                  <button
                    onClick={() => loadUsers(page + 1)}
                    disabled={page >= pages || loading}
                    className="font-mono text-xs px-3 py-1.5 rounded"
                    style={{ color: "#475569", border: "1px solid #1e1e2e", opacity: page >= pages ? 0.4 : 1 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
