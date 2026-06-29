import { useState, useEffect, useCallback } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";

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

type Tab = "stats" | "users" | "patch-notes" | "activity" | "items" | "frames" | "grants";

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
  // Frames tab
  const [framesList, setFramesList] = useState<{
    frameId: string; displayName: string; rarity: string; currency: string;
    price: number; salePrice: number | null; saleExpiry: string | null;
    isFree: boolean; isWeeklyFree: boolean; isFeatured: boolean; isVisible: boolean;
    isCustom: boolean; glowColor: string; description: string; ownedByCount: number;
  }[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [framePriceEdit, setFramePriceEdit] = useState<string | null>(null);
  const [framePriceVal, setFramePriceVal] = useState("");
  const [framesRarityFilter, setFramesRarityFilter] = useState<string>("all");
  const [savingFrame, setSavingFrame] = useState<string | null>(null);
  const [frameSaleEdit, setFrameSaleEdit] = useState<string | null>(null);
  const [frameSaleVal, setFrameSaleVal] = useState("");
  const [frameSaleExpiry, setFrameSaleExpiry] = useState("");
  const [createFrameOpen, setCreateFrameOpen] = useState(false);
  const [newFrame, setNewFrame] = useState({ frameId: "", displayName: "", rarity: "common", glowColor: "#00d4ff", animationType: "static", price: 0, currency: "dc", description: "" });
  const [creatingFrame, setCreatingFrame] = useState(false);
  const [revokeFrameId, setRevokeFrameId] = useState("");
  const [revokeSearch, setRevokeSearch] = useState("");
  const [revokeUsers, setRevokeUsers] = useState<{_id: string; username: string; level: number}[]>([]);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokeTargetName, setRevokeTargetName] = useState("");
  const [revokingFrame, setRevokingFrame] = useState(false);
  // Grants tab
  const [grantSearch, setGrantSearch] = useState("");
  const [grantUsers, setGrantUsers] = useState<{ _id: string; username: string; level: number }[]>([]);
  const [grantSearching, setGrantSearching] = useState(false);
  const [grantTargetId, setGrantTargetId] = useState<string | null>(null);
  const [grantTargetName, setGrantTargetName] = useState("");
  const [grantMeritAmt, setGrantMeritAmt] = useState("");
  const [grantXpAmt, setGrantXpAmt] = useState("");
  const [grantingMerit, setGrantingMerit] = useState(false);
  const [grantingXp, setGrantingXp] = useState(false);
  const [xpBoostInfo, setXpBoostInfo] = useState<{ active: boolean; multiplier: number; expiresAt?: string } | null>(null);
  const [boostMultiplier, setBoostMultiplier] = useState("2");
  const [boostHours, setBoostHours] = useState("4");
  const [settingBoost, setSettingBoost] = useState(false);
  const [grantFrameId, setGrantFrameId] = useState("");
  const [grantingFrame, setGrantingFrame] = useState(false);

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

  const loadFrames = useCallback(async () => {
    setFramesLoading(true);
    try {
      const frames = await api.get<any[]>("/owner/frames");
      setFramesList(frames);
    } catch { /* silent */ }
    finally { setFramesLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "users") loadUsers(1); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "activity") loadRecentFeed(); }, [tab, loadRecentFeed]);
  useEffect(() => { if (tab === "patch-notes") loadPatchNotes(); }, [tab, loadPatchNotes]);
  useEffect(() => { if (tab === "items") loadShopItems(); }, [tab, loadShopItems]);
  useEffect(() => { if (tab === "frames") loadFrames(); }, [tab, loadFrames]);
  useEffect(() => {
    if (tab === "grants") {
      api.get<{ active: boolean; multiplier: number; expiresAt?: string }>("/owner/xp-boost")
        .then(setXpBoostInfo).catch(() => {});
    }
  }, [tab]);

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

  async function searchGrantUsers() {
    if (!grantSearch.trim()) return;
    setGrantSearching(true);
    try {
      const res = await api.get<{ users: { _id: string; username: string; level: number }[] }>(`/owner/users?page=1&limit=10&q=${encodeURIComponent(grantSearch.trim())}`);
      setGrantUsers(res.users);
    } catch { setGrantUsers([]); }
    finally { setGrantSearching(false); }
  }

  async function grantMerit() {
    if (!grantTargetId || !grantMeritAmt) { addToast("Select player and enter amount", "error"); return; }
    setGrantingMerit(true);
    try {
      const r = await api.post<{ message: string }>("/owner/grant/merit", { userId: grantTargetId, amount: Number(grantMeritAmt) });
      addToast(r.message, "success");
      setGrantMeritAmt("");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setGrantingMerit(false); }
  }

  async function grantXp() {
    if (!grantTargetId || !grantXpAmt) { addToast("Select player and enter amount", "error"); return; }
    setGrantingXp(true);
    try {
      const r = await api.post<{ message: string }>("/owner/grant/xp", { userId: grantTargetId, amount: Number(grantXpAmt) });
      addToast(r.message, "success");
      setGrantXpAmt("");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setGrantingXp(false); }
  }

  async function setXpBoost() {
    setSettingBoost(true);
    try {
      const r = await api.post<{ message: string; multiplier: number; expiresAt: string }>("/owner/xp-boost", { multiplier: Number(boostMultiplier), durationHours: Number(boostHours) });
      addToast(r.message, "success");
      setXpBoostInfo({ active: Number(boostMultiplier) !== 1, multiplier: r.multiplier, expiresAt: r.expiresAt });
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSettingBoost(false); }
  }

  async function grantFrame() {
    if (!grantTargetId || !grantFrameId) { addToast("Select player and frame", "error"); return; }
    setGrantingFrame(true);
    try {
      const r = await api.post<{ message: string }>("/frames/owner/grant", { userId: grantTargetId, frameId: grantFrameId });
      addToast(r.message, "success");
      setGrantFrameId("");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setGrantingFrame(false); }
  }

  async function deleteNote(id: string) {
    try {
      await api.delete(`/owner/patch-notes/${id}`);
      addToast("Deleted", "success");
      loadPatchNotes();
    } catch (e: any) { addToast(e.message, "error"); }
  }

  async function setFramePrice(frameId: string) {
    const price = Number(framePriceVal);
    if (isNaN(price) || price < 0) { addToast("Enter a valid price", "error"); return; }
    setSavingFrame(frameId);
    try {
      await api.patch<{ message: string }>(`/frames/owner/${frameId}`, { price });
      addToast("Frame price updated", "success");
      setFramePriceEdit(null); setFramePriceVal("");
      loadFrames();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingFrame(null); }
  }

  async function patchFrame(frameId: string, data: Record<string, unknown>) {
    setSavingFrame(frameId);
    try {
      await api.patch<{ message: string }>(`/frames/owner/${frameId}`, data);
      addToast("Frame updated", "success");
      loadFrames();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingFrame(null); }
  }

  async function setSalePrice(frameId: string) {
    if (!frameSaleVal) { addToast("Enter a sale price", "error"); return; }
    setSavingFrame(frameId);
    try {
      await api.patch<{ message: string }>(`/frames/owner/${frameId}`, {
        salePrice: Number(frameSaleVal),
        saleExpiry: frameSaleExpiry || null,
      });
      addToast("Sale price set", "success");
      setFrameSaleEdit(null); setFrameSaleVal(""); setFrameSaleExpiry("");
      loadFrames();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingFrame(null); }
  }

  async function clearSalePrice(frameId: string) {
    setSavingFrame(frameId);
    try {
      await api.patch<{ message: string }>(`/frames/owner/${frameId}`, { salePrice: null, saleExpiry: null });
      addToast("Sale cleared", "success");
      loadFrames();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingFrame(null); }
  }

  async function createNewFrame() {
    if (!newFrame.frameId || !newFrame.displayName) { addToast("Frame ID and name required", "error"); return; }
    setCreatingFrame(true);
    try {
      await api.post<{ message: string }>("/frames/owner/create", newFrame);
      addToast("Frame created", "success");
      setCreateFrameOpen(false);
      setNewFrame({ frameId: "", displayName: "", rarity: "common", glowColor: "#00d4ff", animationType: "static", price: 0, currency: "dc", description: "" });
      loadFrames();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setCreatingFrame(false); }
  }

  async function searchRevokeUsers() {
    if (!revokeSearch.trim()) return;
    try {
      const res = await api.get<{ users: {_id: string; username: string; level: number}[] }>(`/owner/users?page=1&limit=10&q=${encodeURIComponent(revokeSearch.trim())}`);
      setRevokeUsers(res.users);
    } catch { setRevokeUsers([]); }
  }

  async function doRevokeFrame() {
    if (!revokeFrameId || !revokeTargetId) { addToast("Select frame ID and player", "error"); return; }
    setRevokingFrame(true);
    try {
      const r = await api.post<{ message: string }>("/frames/owner/revoke", { frameId: revokeFrameId, userId: revokeTargetId });
      addToast(r.message, "success");
      setRevokeTargetId(null); setRevokeTargetName(""); setRevokeFrameId(""); setRevokeSearch(""); setRevokeUsers([]);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setRevokingFrame(false); }
  }

  async function deleteCustomFrame(frameId: string) {
    if (!confirm(`Delete custom frame "${frameId}"? This cannot be undone.`)) return;
    try {
      await api.delete<{ message: string }>(`/frames/owner/${frameId}`);
      addToast("Frame deleted", "success");
      loadFrames();
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
    { id: "stats",       label: "Dashboard" },
    { id: "users",       label: `Players (${total || "?"})` },
    { id: "activity",   label: "Activity" },
    { id: "patch-notes", label: "Patch Notes" },
    { id: "items",       label: "Items" },
    { id: "frames",      label: "Frames" },
    { id: "grants",      label: "Grants" },
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
              { label: "DC IN ECONOMY", value: stats?.totalDcInEconomy != null ? formatDC(Math.round(stats.totalDcInEconomy)) + " DC" : "—", color: "#f59e0b" },
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
                          {u.email} · Lv.{u.level} · {formatDC(u.dc || 0)} DC wallet · {formatDC(u.bankBalance || 0)} DC bank
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
            <div style={{ ...s, textAlign: "center" }} className="font-mono text-xs">
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
                            <div className="font-mono text-sm font-bold" style={{ color: "#f59e0b" }}>{formatDC(item.currentPrice)} DC</div>
                            {item.overridden && (
                              <div className="font-mono" style={{ fontSize: 10, color: "#475569" }}>default: {formatDC(item.basePrice)}</div>
                            )}
                          </div>

                          {isOwner && itemPriceEdit === item.id ? (
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
                          ) : isOwner ? (
                            <button onClick={() => { setItemPriceEdit(item.id); setItemPriceVal(String(item.currentPrice)); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#f59e0b", border: "1px solid #f59e0b30" }}>Edit</button>
                          ) : null}
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

      {/* FRAMES TAB */}
      {tab === "frames" && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"] as string[]).map(r => (
                <button key={r} onClick={() => setFramesRarityFilter(r)}
                  className="px-2.5 py-1 rounded font-mono capitalize"
                  style={{ fontSize: 11, background: framesRarityFilter === r ? "#a855f718" : "transparent", color: framesRarityFilter === r ? "#a855f7" : "#475569", border: `1px solid ${framesRarityFilter === r ? "#a855f740" : "#1e1e2e"}` }}>
                  {r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCreateFrameOpen(o => !o)} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>
                {createFrameOpen ? "Cancel" : "+ New Frame"}
              </button>
              <button onClick={loadFrames} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>Refresh</button>
            </div>
          </div>

          {/* Create new frame form */}
          {createFrameOpen && (
            <div style={{ ...s, borderColor: "#39d35330" }}>
              <div className="font-mono text-xs font-bold mb-3" style={{ color: "#39d353", letterSpacing: "0.1em" }}>CREATE CUSTOM FRAME</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Frame ID (snake_case)</label>
                  <input value={newFrame.frameId} onChange={e => setNewFrame(p => ({ ...p, frameId: e.target.value }))}
                    placeholder="e.g. vanta_gold" className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Display Name</label>
                  <input value={newFrame.displayName} onChange={e => setNewFrame(p => ({ ...p, displayName: e.target.value }))}
                    placeholder="e.g. Vanta Gold" className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Rarity</label>
                  <select value={newFrame.rarity} onChange={e => setNewFrame(p => ({ ...p, rarity: e.target.value }))}
                    className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}>
                    {["common","uncommon","rare","epic","legendary","mythic"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Currency</label>
                  <select value={newFrame.currency} onChange={e => setNewFrame(p => ({ ...p, currency: e.target.value }))}
                    className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}>
                    <option value="dc">DC (DarkCoin)</option>
                    <option value="nc">NC (NanoCred)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Price</label>
                  <input type="number" value={newFrame.price} onChange={e => setNewFrame(p => ({ ...p, price: Number(e.target.value) }))}
                    className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Glow Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newFrame.glowColor} onChange={e => setNewFrame(p => ({ ...p, glowColor: e.target.value }))}
                      style={{ width: 36, height: 28, border: "1px solid #1e1e2e", background: "transparent", cursor: "pointer", borderRadius: 4 }} />
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{newFrame.glowColor}</span>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>Description</label>
                  <input value={newFrame.description} onChange={e => setNewFrame(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short description shown in store" className="w-full font-mono text-xs px-2 py-1.5 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }} />
                </div>
              </div>
              <button onClick={createNewFrame} disabled={creatingFrame} className="mt-3 font-mono text-xs px-4 py-2 rounded font-bold"
                style={{ background: "#39d35330", color: "#39d353", border: "1px solid #39d35350" }}>
                {creatingFrame ? "Creating..." : "Create Frame"}
              </button>
            </div>
          )}

          {/* Revoke frame section */}
          <div style={{ ...s, borderColor: "#ff2d5520" }}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#ff2d55", letterSpacing: "0.1em" }}>REVOKE FRAME FROM PLAYER</div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <input value={revokeFrameId} onChange={e => setRevokeFrameId(e.target.value)}
                placeholder="Frame ID (e.g. ghost_wire)" className="font-mono text-xs px-2 py-1.5 rounded flex-1"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", minWidth: 150 }} />
              <input value={revokeSearch} onChange={e => setRevokeSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchRevokeUsers()}
                placeholder="Search player..." className="font-mono text-xs px-2 py-1.5 rounded flex-1"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", minWidth: 140 }} />
              <button onClick={searchRevokeUsers} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530" }}>Search</button>
            </div>
            {revokeUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {revokeUsers.map(u => (
                  <button key={u._id} onClick={() => { setRevokeTargetId(u._id); setRevokeTargetName(u.username); setRevokeUsers([]); }}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ background: revokeTargetId === u._id ? "#ff2d5520" : "#0a0a0f", border: `1px solid ${revokeTargetId === u._id ? "#ff2d5540" : "#1e1e2e"}`, color: "#e2e8f0" }}>
                    {u.username} — Lv.{u.level}
                  </button>
                ))}
              </div>
            )}
            {revokeTargetId && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#ff2d5510", border: "1px solid #ff2d5530", color: "#ff2d55" }}>
                  Target: <span className="font-bold">{revokeTargetName}</span>
                  <button onClick={() => { setRevokeTargetId(null); setRevokeTargetName(""); }} className="ml-2" style={{ color: "#475569" }}>× clear</button>
                </div>
                <button onClick={doRevokeFrame} disabled={revokingFrame || !revokeFrameId} className="font-mono text-xs px-4 py-1.5 rounded font-bold"
                  style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}>
                  {revokingFrame ? "Revoking..." : "Revoke Frame"}
                </button>
              </div>
            )}
          </div>

          {/* Frame list */}
          {framesLoading ? (
            <div className="text-center py-8 font-mono text-xs" style={{ color: "#475569" }}>Loading...</div>
          ) : (
            <div className="space-y-2">
              {framesList
                .filter(f => framesRarityFilter === "all" || f.rarity === framesRarityFilter)
                .map(frame => {
                  const RARITY_CLR: Record<string, string> = { common: "#9ca3af", uncommon: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24", mythic: "#00ff41" };
                  const rc = RARITY_CLR[frame.rarity] ?? "#9ca3af";
                  const saving = savingFrame === frame.frameId;
                  return (
                    <div key={frame.frameId} style={{ background: "#111118", border: `1px solid ${frame.isCustom ? "#a855f730" : "#1e1e2e"}`, borderRadius: 8, padding: "10px 14px" }}>
                      {/* Row 1: identity + badges + owner count */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{frame.displayName}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded capitalize" style={{ color: rc, background: rc + "15", border: `1px solid ${rc}30` }}>{frame.rarity}</span>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>{(frame.currency || "dc").toUpperCase()}</span>
                            {frame.isFree && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#39d353", background: "#39d35315", border: "1px solid #39d35330" }}>FREE</span>}
                            {frame.isCustom && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#a855f7", background: "#a855f715", border: "1px solid #a855f730" }}>CUSTOM</span>}
                            {!frame.isVisible && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#ff2d55", background: "#ff2d5515", border: "1px solid #ff2d5530" }}>HIDDEN</span>}
                            {frame.isFeatured && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#f59e0b", background: "#f59e0b15", border: "1px solid #f59e0b30" }}>FEATURED</span>}
                            {frame.isWeeklyFree && <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ color: "#00d4ff", background: "#00d4ff15", border: "1px solid #00d4ff30" }}>WEEKLY FREE</span>}
                          </div>
                          <div className="font-mono mt-0.5" style={{ fontSize: 10, color: "#475569" }}>
                            ID: {frame.frameId} · {frame.ownedByCount} player{frame.ownedByCount !== 1 ? "s" : ""} own this
                            {frame.glowColor && <span style={{ color: frame.glowColor }}> · ●</span>}
                          </div>
                        </div>

                        {/* Toggle buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                          <button onClick={() => patchFrame(frame.frameId, { isVisible: !frame.isVisible })}
                            disabled={saving}
                            className="font-mono text-xs px-2 py-1 rounded"
                            style={{ background: frame.isVisible ? "#39d35318" : "#ff2d5518", color: frame.isVisible ? "#39d353" : "#ff2d55", border: `1px solid ${frame.isVisible ? "#39d35340" : "#ff2d5540"}` }}>
                            {frame.isVisible ? "Visible" : "Hidden"}
                          </button>
                          <button onClick={() => patchFrame(frame.frameId, { isFeatured: !frame.isFeatured })}
                            disabled={saving}
                            className="font-mono text-xs px-2 py-1 rounded"
                            style={{ background: frame.isFeatured ? "#f59e0b18" : "transparent", color: frame.isFeatured ? "#f59e0b" : "#475569", border: `1px solid ${frame.isFeatured ? "#f59e0b40" : "#1e1e2e"}` }}>
                            {frame.isFeatured ? "★ Featured" : "☆ Feature"}
                          </button>
                          <button onClick={() => patchFrame(frame.frameId, { isWeeklyFree: !frame.isWeeklyFree })}
                            disabled={saving}
                            className="font-mono text-xs px-2 py-1 rounded"
                            style={{ background: frame.isWeeklyFree ? "#00d4ff18" : "transparent", color: frame.isWeeklyFree ? "#00d4ff" : "#475569", border: `1px solid ${frame.isWeeklyFree ? "#00d4ff40" : "#1e1e2e"}` }}>
                            {frame.isWeeklyFree ? "Free/wk ON" : "Free/wk"}
                          </button>
                          {frame.isCustom && (
                            <button onClick={() => deleteCustomFrame(frame.frameId)}
                              className="font-mono text-xs px-2 py-1 rounded"
                              style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row 2: price editing + sale */}
                      {!frame.isFree && (
                        <div className="flex items-center gap-3 flex-wrap mt-2 pt-2" style={{ borderTop: "1px solid #1e1e2e" }}>
                          {/* Base price */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" style={{ color: "#64748b" }}>Price:</span>
                            {framePriceEdit === frame.frameId ? (
                              <>
                                <input value={framePriceVal} onChange={e => setFramePriceVal(e.target.value)}
                                  type="number" min={0} autoFocus
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #f59e0b40", color: "#e2e8f0", width: 80 }}
                                  onKeyDown={e => { if (e.key === "Enter") setFramePrice(frame.frameId); if (e.key === "Escape") { setFramePriceEdit(null); setFramePriceVal(""); } }} />
                                <button onClick={() => setFramePrice(frame.frameId)} disabled={saving} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>Save</button>
                                <button onClick={() => { setFramePriceEdit(null); setFramePriceVal(""); }} className="font-mono text-xs px-1.5 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-xs font-bold" style={{ color: "#f59e0b" }}>{frame.price}</span>
                                <button onClick={() => { setFramePriceEdit(frame.frameId); setFramePriceVal(String(frame.price)); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#f59e0b", border: "1px solid #f59e0b30" }}>Edit</button>
                              </>
                            )}
                          </div>

                          {/* Sale price */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" style={{ color: "#64748b" }}>Sale:</span>
                            {frameSaleEdit === frame.frameId ? (
                              <>
                                <input value={frameSaleVal} onChange={e => setFrameSaleVal(e.target.value)}
                                  type="number" min={0} placeholder="sale price" autoFocus
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #ff2d5540", color: "#e2e8f0", width: 80 }} />
                                <input value={frameSaleExpiry} onChange={e => setFrameSaleExpiry(e.target.value)}
                                  type="datetime-local"
                                  className="font-mono text-xs px-2 py-1 rounded"
                                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#64748b" }} />
                                <button onClick={() => setSalePrice(frame.frameId)} disabled={saving} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5540" }}>Set</button>
                                <button onClick={() => { setFrameSaleEdit(null); setFrameSaleVal(""); setFrameSaleExpiry(""); }} className="font-mono text-xs px-1.5 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>✕</button>
                              </>
                            ) : frame.salePrice != null ? (
                              <>
                                <span className="font-mono text-xs font-bold" style={{ color: "#ff2d55" }}>{frame.salePrice}</span>
                                {frame.saleExpiry && <span className="font-mono text-xs" style={{ color: "#475569" }}>until {new Date(frame.saleExpiry).toLocaleDateString()}</span>}
                                <button onClick={() => { setFrameSaleEdit(frame.frameId); setFrameSaleVal(String(frame.salePrice)); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}>Edit</button>
                                <button onClick={() => clearSalePrice(frame.frameId)} disabled={saving} className="font-mono text-xs px-1.5 py-1 rounded" style={{ color: "#475569", border: "1px solid #1e1e2e" }}>Clear</button>
                              </>
                            ) : (
                              <button onClick={() => { setFrameSaleEdit(frame.frameId); setFrameSaleVal(""); setFrameSaleExpiry(""); }} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}>Set Sale</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* GRANTS TAB */}
      {tab === "grants" && (
        <div className="space-y-4">
          {/* XP Boost */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#f59e0b", letterSpacing: "0.1em" }}>SERVER XP BOOST</div>
            {xpBoostInfo?.active && (
              <div className="font-mono text-xs mb-3 px-3 py-2 rounded" style={{ background: "#f59e0b18", border: "1px solid #f59e0b30", color: "#f59e0b" }}>
                ACTIVE: {xpBoostInfo.multiplier}x XP — expires {xpBoostInfo.expiresAt ? new Date(xpBoostInfo.expiresAt).toLocaleString() : "—"}
              </div>
            )}
            {!xpBoostInfo?.active && (
              <div className="font-mono text-xs mb-3" style={{ color: "#475569" }}>No boost currently active (1x XP)</div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="font-mono text-xs" style={{ color: "#64748b" }}>Multiplier</label>
                <select value={boostMultiplier} onChange={e => setBoostMultiplier(e.target.value)} className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }}>
                  <option value="1">1x (cancel)</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="font-mono text-xs" style={{ color: "#64748b" }}>Hours</label>
                <input value={boostHours} onChange={e => setBoostHours(e.target.value)} type="number" min={1} max={168} className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 70 }} />
              </div>
              <button onClick={setXpBoost} disabled={settingBoost} className="font-mono text-xs px-4 py-1.5 rounded font-bold" style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                {settingBoost ? "Setting..." : "Activate Boost"}
              </button>
            </div>
          </div>

          {/* Player Search */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#00d4ff", letterSpacing: "0.1em" }}>PLAYER GRANTS</div>
            <div className="flex gap-2 mb-3">
              <input value={grantSearch} onChange={e => setGrantSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchGrantUsers()}
                placeholder="Search username..." className="flex-1 font-mono text-xs px-3 py-1.5 rounded"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              <button onClick={searchGrantUsers} disabled={grantSearching} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>
                {grantSearching ? "..." : "Search"}
              </button>
            </div>

            {grantUsers.length > 0 && (
              <div className="space-y-1 mb-3">
                {grantUsers.map(u => (
                  <button
                    key={u._id}
                    onClick={() => { setGrantTargetId(u._id); setGrantTargetName(u.username); setGrantUsers([]); setGrantSearch(""); }}
                    className="w-full text-left font-mono text-xs px-3 py-2 rounded transition-all"
                    style={{
                      background: grantTargetId === u._id ? "#00d4ff18" : "#0a0a0f",
                      border: `1px solid ${grantTargetId === u._id ? "#00d4ff40" : "#1e1e2e"}`,
                      color: "#e2e8f0",
                    }}
                  >
                    {u.username} — Lv.{u.level}
                  </button>
                ))}
              </div>
            )}

            {grantTargetId && (
              <div className="font-mono text-xs mb-4 px-3 py-2 rounded" style={{ background: "#00d4ff10", border: "1px solid #00d4ff30", color: "#00d4ff" }}>
                Target: <span className="font-bold">{grantTargetName}</span>
                <button onClick={() => { setGrantTargetId(null); setGrantTargetName(""); }} className="ml-3 font-mono text-xs" style={{ color: "#475569" }}>× clear</button>
              </div>
            )}

            {/* Merit grant */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="font-mono text-xs" style={{ color: "#64748b", width: 60 }}>Merit</label>
              <input value={grantMeritAmt} onChange={e => setGrantMeritAmt(e.target.value)} type="number" placeholder="amount" className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 90 }} />
              <button onClick={grantMerit} disabled={grantingMerit || !grantTargetId || !grantMeritAmt} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}>
                {grantingMerit ? "..." : "Grant M"}
              </button>
            </div>

            {/* XP grant */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="font-mono text-xs" style={{ color: "#64748b", width: 60 }}>XP</label>
              <input value={grantXpAmt} onChange={e => setGrantXpAmt(e.target.value)} type="number" placeholder="amount" className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 90 }} />
              <button onClick={grantXp} disabled={grantingXp || !grantTargetId || !grantXpAmt} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}>
                {grantingXp ? "..." : "Grant XP"}
              </button>
            </div>

            {/* Frame grant */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="font-mono text-xs" style={{ color: "#64748b", width: 60 }}>Frame</label>
              <input value={grantFrameId} onChange={e => setGrantFrameId(e.target.value)} placeholder="frameId (e.g. ghost_wire)" className="font-mono text-xs px-2 py-1.5 rounded flex-1" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0" }} />
              <button onClick={grantFrame} disabled={grantingFrame || !grantTargetId || !grantFrameId} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                {grantingFrame ? "..." : "Grant Frame"}
              </button>
            </div>
          </div>
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
