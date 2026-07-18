import { useState, useEffect, useCallback } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { ConfirmDialog } from "../components/ConfirmDialog";

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

interface AuditLogRow {
  _id: string;
  actorUsername: string;
  action: string;
  targetUsername?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

const ROLE_COLOR: Record<string, string> = {
  owner: "#f59e0b",
  admin: "#a855f7",
  staff: "#00d4ff",
  player: "#64748b",
};

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };

interface DbCollectionStat {
  name: string; docs: number; dataBytes: number; storageBytes: number; indexBytes: number; protected: boolean;
}
interface DbStats {
  dataBytes: number; indexBytes: number; storageBytes: number; totalBytes: number;
  objects: number; collections: DbCollectionStat[];
}
interface RunCatalogEntry { id: string; name: string; tier: number; energyCost: number; dcMin: number; dcMax: number; xp: number; baseSuccess: number; minLevel: number; riskLevel: string; }
interface JobCatalogEntry { id: string; name: string; district: string; minLevel: number; energyCost: number; dcMin: number; dcMax: number; xpPerJob: number; cooldownMin: number; }
interface StaffTierEntry { name: string; color: string; dailyDc: number; }
interface EconomyGameConfig {
  globalMultipliers: { dcRewardMult: number; xpRewardMult: number };
  resourceCaps: { walletCap: number; bankCap: number };
  crimeConfig: { runsPerHourCap: number; runOverrides: Record<string, { dcMin?: number; dcMax?: number; xp?: number; energyCost?: number; baseSuccess?: number }> };
  jobConfig: { minigameTriggerChance: number; jobOverrides: Record<string, { dcMin?: number; dcMax?: number; xpPerJob?: number; energyCost?: number; cooldownMin?: number }> };
  staffConfig: { tierDailyDc: Record<string, number> };
}
interface GameCatalog { runs: RunCatalogEntry[]; jobs: JobCatalogEntry[]; staffTiers: Record<string, StaffTierEntry>; }

type Tab = "stats" | "users" | "patch-notes" | "activity" | "items" | "grants" | "vanta" | "royale-logs" | "combat-hist" | "race-hist" | "drop-rates" | "special-events" | "announcements" | "giveaways" | "staff" | "mass-actions" | "economy" | "database";

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
  const [auditLog, setAuditLog] = useState<AuditLogRow[]>([]);
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
  // Vanta tab
  const [vantaLogs, setVantaLogs] = useState<{
    id: string; player: { id: string; name: string }; trigger: string;
    severity: string; details: string; dismissed: boolean; dismissedBy?: string; createdAt: string;
  }[]>([]);
  const [vantaSummary, setVantaSummary] = useState<Record<string, number>>({ low: 0, medium: 0, high: 0, critical: 0 });
  const [vantaFilter, setVantaFilter] = useState<"active" | "dismissed">("active");
  const [vantaLoading, setVantaLoading] = useState(false);
  const [flagPlayerId, setFlagPlayerId] = useState("");
  const [flagPlayerName, setFlagPlayerName] = useState("");
  const [flagSeverity, setFlagSeverity] = useState("medium");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagging, setFlagging] = useState(false);
  // Royale Logs tab
  const [royaleLogs, setRoyaleLogs] = useState<any[]>([]);
  const [royaleLogsPage, setRoyaleLogsPage] = useState(1);
  const [royaleLogsTotal, setRoyaleLogsTotal] = useState(0);
  const [royaleLogsLoading, setRoyaleLogsLoading] = useState(false);
  const [royaleLogUserFilter, setRoyaleLogUserFilter] = useState("");
  // Match History (admin) tab
  const [adminMatchTab, setAdminMatchTab] = useState<"combat" | "race">("combat");
  const [adminCombatMatches, setAdminCombatMatches] = useState<any[]>([]);
  const [adminRaceMatches, setAdminRaceMatches] = useState<any[]>([]);
  const [adminMatchLoading, setAdminMatchLoading] = useState(false);
  const [adminMatchUserFilter, setAdminMatchUserFilter] = useState("");
  // Drop Rates tab
  const [royaleItems, setRoyaleItems] = useState<any[]>([]);
  const [royaleItemsLoading, setRoyaleItemsLoading] = useState(false);
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [editingDropVal, setEditingDropVal] = useState("");
  const [savingDrop, setSavingDrop] = useState(false);
  // Keys Grant
  const [grantKeysAmt, setGrantKeysAmt] = useState("");
  const [grantShardsAmt, setGrantShardsAmt] = useState("");
  const [grantingKeys, setGrantingKeys] = useState(false);
  // Special Events & Tier Weights tab
  const [specialEvent, setSpecialEvent] = useState<{ active: boolean; type: string | null; expiresAt: string | null } | null>(null);
  const [specialEventLoading, setSpecialEventLoading] = useState(false);
  const [eventType] = useState("nc_royale_drop");
  const [eventHours, setEventHours] = useState("4");
  const [settingEvent, setSettingEvent] = useState(false);
  const [tierWeights, setTierWeights] = useState({ common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 });
  const [savingTierWeights, setSavingTierWeights] = useState(false);
  // Announcement banner
  const [announcement, setAnnouncement] = useState<{ active: boolean; message: string; expiresAt: string | null } | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementHours, setAnnouncementHours] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  // Staff management tab
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffLogs, setStaffLogs] = useState<any[]>([]);
  const [staffLogsLoading, setStaffLogsLoading] = useState(false);
  const [staffLogFilter, setStaffLogFilter] = useState("");
  const [staffTierTarget, setStaffTierTarget] = useState<string | null>(null);
  const [staffTierValue, setStaffTierValue] = useState("1");
  const [settingStaffTier, setSettingStaffTier] = useState(false);
  // Mass actions tab
  const [massDc, setMassDc] = useState("0");
  const [massNc, setMassNc] = useState("0");
  const [massKeys, setMassKeys] = useState("0");
  const [massReason, setMassReason] = useState("");
  const [massGranting, setMassGranting] = useState(false);
  const [massGrantConfirm, setMassGrantConfirm] = useState(false);
  // Giveaways tab
  const [ownerGiveDc, setOwnerGiveDc] = useState("0");
  const [ownerGiveUc, setOwnerGiveUc] = useState("0");
  const [ownerGiveKeys, setOwnerGiveKeys] = useState("0");
  const [ownerGiveItems, setOwnerGiveItems] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const [ownerGiveNewItemId, setOwnerGiveNewItemId] = useState("");
  const [ownerGiveNewItemQty, setOwnerGiveNewItemQty] = useState("1");
  const [ownerGiveDuration, setOwnerGiveDuration] = useState(24 * 60 * 60 * 1000);
  const [ownerGiveMax, setOwnerGiveMax] = useState("100");
  const [ownerGiveCreating, setOwnerGiveCreating] = useState(false);
  const [liveOwnerGiveaways, setLiveOwnerGiveaways] = useState<any[]>([]);
  const [ownerGiveawaysLoading, setOwnerGiveawaysLoading] = useState(false);
  // Economy tab
  const [gameConfig, setGameConfig] = useState<EconomyGameConfig | null>(null);
  const [gameCatalog, setGameCatalog] = useState<GameCatalog | null>(null);
  const [gameConfigLoading, setGameConfigLoading] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [editDcMult, setEditDcMult] = useState("1");
  const [editXpMult, setEditXpMult] = useState("1");
  const [editWalletCap, setEditWalletCap] = useState("100000000");
  const [editBankCap, setEditBankCap] = useState("1000000000");
  const [editRunsPerHour, setEditRunsPerHour] = useState("30");
  const [editMinigameChance, setEditMinigameChance] = useState("0.30");
  const [editRunOverrides, setEditRunOverrides] = useState<Record<string, Record<string, string>>>({});
  const [editJobOverrides, setEditJobOverrides] = useState<Record<string, Record<string, string>>>({});
  const [editStaffDailyDc, setEditStaffDailyDc] = useState<Record<string, string>>({});
  // Database tab
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbLimitMB, setDbLimitMB] = useState(512);
  const [dbClearTarget, setDbClearTarget] = useState<string | null>(null);
  const [dbDropTarget, setDbDropTarget] = useState<string | null>(null);
  const [dbDropCode, setDbDropCode] = useState("");
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [smartCleanupLoading, setSmartCleanupLoading] = useState(false);
  const [smartCleanupResult, setSmartCleanupResult] = useState<{ totalDeleted: number; breakdown: Record<string, number> } | null>(null);

  const GIVE_DURATIONS = [
    { label: "1 hour",   ms: 60 * 60 * 1000 },
    { label: "6 hours",  ms: 6 * 60 * 60 * 1000 },
    { label: "12 hours", ms: 12 * 60 * 60 * 1000 },
    { label: "1 day",    ms: 24 * 60 * 60 * 1000 },
    { label: "2 days",   ms: 2 * 24 * 60 * 60 * 1000 },
    { label: "3 days",   ms: 3 * 24 * 60 * 60 * 1000 },
  ];

  const loadOwnerGiveaways = useCallback(async () => {
    setOwnerGiveawaysLoading(true);
    try {
      const rows = await api.get<any[]>("/giveaways/live");
      setLiveOwnerGiveaways(rows);
    } catch { /* silent */ }
    finally { setOwnerGiveawaysLoading(false); }
  }, []);

  const loadGameConfig = useCallback(async () => {
    setGameConfigLoading(true);
    try {
      const res = await api.get<{ config: EconomyGameConfig; catalog: GameCatalog }>("/owner/game-config");
      setGameConfig(res.config);
      setGameCatalog(res.catalog);
      setEditDcMult(String(res.config.globalMultipliers.dcRewardMult));
      setEditXpMult(String(res.config.globalMultipliers.xpRewardMult));
      setEditWalletCap(String(res.config.resourceCaps.walletCap));
      setEditBankCap(String(res.config.resourceCaps.bankCap));
      setEditRunsPerHour(String(res.config.crimeConfig.runsPerHourCap));
      setEditMinigameChance(String(res.config.jobConfig.minigameTriggerChance));
      const runOvr: Record<string, Record<string, string>> = {};
      for (const [runId, ov] of Object.entries(res.config.crimeConfig.runOverrides)) {
        runOvr[runId] = {};
        if (ov.dcMin    !== undefined) runOvr[runId].dcMin        = String(ov.dcMin);
        if (ov.dcMax    !== undefined) runOvr[runId].dcMax        = String(ov.dcMax);
        if (ov.xp       !== undefined) runOvr[runId].xp           = String(ov.xp);
        if (ov.energyCost !== undefined) runOvr[runId].energyCost = String(ov.energyCost);
        if (ov.baseSuccess !== undefined) runOvr[runId].baseSuccess = String(ov.baseSuccess);
      }
      setEditRunOverrides(runOvr);
      const jobOvr: Record<string, Record<string, string>> = {};
      for (const [jobId, ov] of Object.entries(res.config.jobConfig.jobOverrides)) {
        jobOvr[jobId] = {};
        if (ov.dcMin      !== undefined) jobOvr[jobId].dcMin      = String(ov.dcMin);
        if (ov.dcMax      !== undefined) jobOvr[jobId].dcMax      = String(ov.dcMax);
        if (ov.xpPerJob   !== undefined) jobOvr[jobId].xpPerJob   = String(ov.xpPerJob);
        if (ov.energyCost !== undefined) jobOvr[jobId].energyCost = String(ov.energyCost);
        if (ov.cooldownMin !== undefined) jobOvr[jobId].cooldownMin = String(ov.cooldownMin);
      }
      setEditJobOverrides(jobOvr);
      const staffDc: Record<string, string> = {};
      for (const [tier, dc] of Object.entries(res.config.staffConfig.tierDailyDc)) {
        staffDc[tier] = String(dc);
      }
      setEditStaffDailyDc(staffDc);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setGameConfigLoading(false); }
  }, [addToast]);

  async function saveGameSection(sectionKey: string, patch: Partial<EconomyGameConfig>) {
    setSavingSection(sectionKey);
    try {
      const res = await api.patch<{ message: string; config: EconomyGameConfig }>("/owner/game-config", patch);
      setGameConfig(res.config);
      addToast(res.message, "success");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSavingSection(null); }
  }

  const loadDbStats = useCallback(async () => {
    setDbStatsLoading(true);
    try {
      const res = await api.get<DbStats>("/owner/db-stats");
      setDbStats(res);
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setDbStatsLoading(false); }
  }, [addToast]);

  const runSmartCleanup = useCallback(async () => {
    setSmartCleanupLoading(true);
    setSmartCleanupResult(null);
    try {
      const res = await api.post<{ message: string; totalDeleted: number; breakdown: Record<string, number> }>("/owner/db-smart-cleanup");
      setSmartCleanupResult({ totalDeleted: res.totalDeleted, breakdown: res.breakdown });
      addToast(`${res.message} — ${res.totalDeleted} removed`, "success");
      loadDbStats();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSmartCleanupLoading(false); }
  }, [addToast, loadDbStats]);

  const clearCollection = useCallback(async (name: string) => {
    setDbActionLoading(true);
    try {
      const res = await api.delete<{ message: string; deleted: number }>(`/owner/db-clear/${name}`);
      addToast(res.message, "success");
      setDbClearTarget(null);
      loadDbStats();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setDbActionLoading(false); }
  }, [addToast, loadDbStats]);

  const dropCollection = useCallback(async (name: string, code: string) => {
    setDbActionLoading(true);
    try {
      const res = await api.post<{ message: string }>(`/owner/db-drop/${name}`, { confirmCode: code });
      addToast(res.message, "success");
      setDbDropTarget(null);
      setDbDropCode("");
      loadDbStats();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setDbActionLoading(false); }
  }, [addToast, loadDbStats]);

  async function createOwnerGiveaway() {
    const dc   = Math.max(0, Math.floor(Number(ownerGiveDc)   || 0));
    const uc   = Math.max(0, Math.floor(Number(ownerGiveUc)   || 0));
    const keys = Math.max(0, Math.floor(Number(ownerGiveKeys) || 0));
    const maxEntrants = Math.max(1, Math.floor(Number(ownerGiveMax) || 1));
    if (dc === 0 && uc === 0 && keys === 0 && ownerGiveItems.length === 0) {
      addToast("Pledge cannot be empty", "error"); return;
    }
    setOwnerGiveCreating(true);
    try {
      await api.post<any>("/owner/giveaways", {
        pledge: { dc, uc, keys, items: ownerGiveItems, frames: [] },
        durationMs: ownerGiveDuration,
        maxEntrants,
      });
      addToast("System giveaway is now live!", "success");
      // Reset form
      setOwnerGiveDc("0"); setOwnerGiveUc("0"); setOwnerGiveKeys("0");
      setOwnerGiveItems([]);
      setOwnerGiveMax("100"); setOwnerGiveDuration(24 * 60 * 60 * 1000);
      loadOwnerGiveaways();
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setOwnerGiveCreating(false); }
  }

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

  const loadAuditLog = useCallback(async () => {
    try {
      const res = await api.get<{ logs: AuditLogRow[] }>("/owner/audit-log?limit=50");
      setAuditLog(res.logs);
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

  const loadVanta = useCallback(async (dismissed = false) => {
    setVantaLoading(true);
    try {
      const [logs, summary] = await Promise.all([
        api.get<any[]>(`/vanta?dismissed=${dismissed}`),
        api.get<Record<string, number>>("/vanta/summary"),
      ]);
      setVantaLogs(logs);
      setVantaSummary(summary);
    } catch { /* silent */ }
    finally { setVantaLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "users") loadUsers(1); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "activity") { loadRecentFeed(); loadAuditLog(); } }, [tab, loadRecentFeed, loadAuditLog]);
  useEffect(() => { if (tab === "patch-notes") loadPatchNotes(); }, [tab, loadPatchNotes]);
  useEffect(() => { if (tab === "items") loadShopItems(); }, [tab, loadShopItems]);
  useEffect(() => {
    if (tab === "grants") {
      api.get<{ active: boolean; multiplier: number; expiresAt?: string }>("/owner/xp-boost")
        .then(setXpBoostInfo).catch(() => {});
    }
  }, [tab]);
  useEffect(() => {
    if (tab === "vanta") loadVanta(vantaFilter === "dismissed");
  }, [tab, vantaFilter, loadVanta]);
  useEffect(() => {
    if (tab === "royale-logs") {
      setRoyaleLogsLoading(true);
      api.get<any>(`/owner/royale-logs?page=${royaleLogsPage}&limit=20${royaleLogUserFilter ? `&userId=${royaleLogUserFilter}` : ""}`)
        .then(r => { setRoyaleLogs(r.logs); setRoyaleLogsTotal(r.total); })
        .catch(() => {})
        .finally(() => setRoyaleLogsLoading(false));
    }
  }, [tab, royaleLogsPage, royaleLogUserFilter]);
  useEffect(() => {
    if (tab === "combat-hist" || tab === "race-hist") {
      setAdminMatchLoading(true);
      const type = tab === "combat-hist" ? "combat-history" : "race-history";
      api.get<any>(`/owner/${type}?page=1&limit=20${adminMatchUserFilter ? `&userId=${adminMatchUserFilter}` : ""}`)
        .then(r => {
          if (tab === "combat-hist") setAdminCombatMatches(r.matches);
          else setAdminRaceMatches(r.matches);
        })
        .catch(() => {})
        .finally(() => setAdminMatchLoading(false));
    }
  }, [tab, adminMatchUserFilter]);
  useEffect(() => {
    if (tab === "drop-rates") {
      setRoyaleItemsLoading(true);
      api.get<any[]>("/owner/royale-items")
        .then(setRoyaleItems)
        .catch(() => {})
        .finally(() => setRoyaleItemsLoading(false));
    }
    if (tab === "special-events") {
      setSpecialEventLoading(true);
      Promise.all([
        api.get<{ active: boolean; type: string | null; expiresAt: string | null }>("/owner/special-event"),
        api.get<{ weights: Record<string, number> }>("/owner/royale-tier-weights"),
      ]).then(([ev, tw]) => {
        setSpecialEvent(ev);
        setTierWeights({ common: tw.weights.common ?? 60, uncommon: tw.weights.uncommon ?? 25, rare: tw.weights.rare ?? 10, epic: tw.weights.epic ?? 4, legendary: tw.weights.legendary ?? 1 });
      }).catch(() => {}).finally(() => setSpecialEventLoading(false));
    }
    if (tab === "announcements") {
      setAnnouncementLoading(true);
      api.get<{ active: boolean; message: string; expiresAt: string | null }>("/owner/announcement")
        .then(a => { setAnnouncement(a); setAnnouncementText(a.message ?? ""); })
        .catch(() => {})
        .finally(() => setAnnouncementLoading(false));
    }
    if (tab === "staff") {
      setStaffLoading(true);
      api.get<{ staff: any[] }>("/owner/staff")
        .then(r => setStaffList(r.staff))
        .catch(() => {})
        .finally(() => setStaffLoading(false));
      setStaffLogsLoading(true);
      api.get<{ logs: any[] }>("/owner/staff/logs?limit=30")
        .then(r => setStaffLogs(r.logs))
        .catch(() => {})
        .finally(() => setStaffLogsLoading(false));
    }
  }, [tab]);

  async function setStaffTier(userId: string) {
    setSettingStaffTier(true);
    try {
      const t = staffTierValue === "0" ? 0 : Number(staffTierValue);
      const res = await api.post<{ message: string }>("/owner/staff/set-tier", { userId, tier: t });
      addToast(res.message, "success");
      setStaffTierTarget(null);
      setStaffLoading(true);
      api.get<{ staff: any[] }>("/owner/staff")
        .then(r => setStaffList(r.staff))
        .catch(() => {})
        .finally(() => setStaffLoading(false));
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setSettingStaffTier(false); }
  }

  async function massGrant() {
    const dc   = Number(massDc)   || 0;
    const nc   = Number(massNc)   || 0;
    const keys = Number(massKeys) || 0;
    if (dc === 0 && nc === 0 && keys === 0) { addToast("Enter at least one amount", "error"); return; }
    setMassGranting(true);
    try {
      const res = await api.post<{ message: string; affected: number }>("/owner/mass-grant", { dc, nc, keys, reason: massReason });
      addToast(res.message, "success");
      setMassDc("0"); setMassNc("0"); setMassKeys("0"); setMassReason("");
    } catch (e: any) { addToast(e.message, "error"); }
    finally { setMassGranting(false); }
  }

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
    { id: "stats",        label: "Dashboard" },
    { id: "users",        label: `Players (${total || "?"})` },
    { id: "activity",     label: "Activity" },
    { id: "patch-notes",  label: "Patch Notes" },
    { id: "items",        label: "Items" },
    { id: "grants",       label: "Grants" },
    { id: "royale-logs",  label: "Royale Logs" },
    { id: "combat-hist",  label: "Combat" },
    { id: "race-hist",    label: "Races" },
    { id: "drop-rates",   label: "Drop Rates" },
  ];

  const s = { background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 };

  return (
    <div className="space-y-5 max-w-5xl mx-auto relative z-10">
      <div className="dl-page-bg bg-terminal" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
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
        <button onClick={() => setTab("vanta")} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "vanta" ? "#ff2d5518" : "#111118", color: tab === "vanta" ? "#ff2d55" : "#475569", border: `1px solid ${tab === "vanta" ? "#ff2d5540" : "#1e1e2e"}` }}>
          VantaLog
        </button>
        <button onClick={() => setTab("special-events")} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "special-events" ? "#f59e0b18" : "#111118", color: tab === "special-events" ? "#f59e0b" : "#475569", border: `1px solid ${tab === "special-events" ? "#f59e0b40" : "#1e1e2e"}` }}>
          Events
        </button>
        <button onClick={() => setTab("announcements")} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "announcements" ? "#00d4ff18" : "#111118", color: tab === "announcements" ? "#00d4ff" : "#475569", border: `1px solid ${tab === "announcements" ? "#00d4ff40" : "#1e1e2e"}` }}>
          Announcements
        </button>
        <button
          onClick={() => { setTab("giveaways"); loadOwnerGiveaways(); }}
          className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "giveaways" ? "#a855f718" : "#111118", color: tab === "giveaways" ? "#a855f7" : "#475569", border: `1px solid ${tab === "giveaways" ? "#a855f740" : "#1e1e2e"}` }}>
          🎁 Giveaways
        </button>
        <button onClick={() => { setTab("economy"); if (!gameConfig) loadGameConfig(); }} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "economy" ? "#39d35318" : "#111118", color: tab === "economy" ? "#39d353" : "#475569", border: `1px solid ${tab === "economy" ? "#39d35340" : "#1e1e2e"}` }}>
          ⚙️ Economy
        </button>
        <button onClick={() => { setTab("database"); if (!dbStats) loadDbStats(); }} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "database" ? "#ff2d5518" : "#111118", color: tab === "database" ? "#ff2d55" : "#475569", border: `1px solid ${tab === "database" ? "#ff2d5540" : "#1e1e2e"}` }}>
          🗄 Database
        </button>
        <button onClick={() => setTab("staff")} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "staff" ? "#00d4ff18" : "#111118", color: tab === "staff" ? "#00d4ff" : "#475569", border: `1px solid ${tab === "staff" ? "#00d4ff40" : "#1e1e2e"}` }}>
          👥 Staff
        </button>
        <button onClick={() => setTab("mass-actions")} className="px-4 py-2 rounded font-mono text-xs transition-all"
          style={{ background: tab === "mass-actions" ? "#ff6b3518" : "#111118", color: tab === "mass-actions" ? "#ff6b35" : "#475569", border: `1px solid ${tab === "mass-actions" ? "#ff6b3540" : "#1e1e2e"}` }}>
          📢 Mass Actions
        </button>
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

          <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Admin audit log</div>
            <button onClick={loadAuditLog} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}>Refresh</button>
          </div>
          {auditLog.length === 0 ? (
            <div style={{ ...s, textAlign: "center" }} className="font-mono text-xs">
              <span style={{ color: "#475569" }}>No admin actions recorded</span>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.map(a => (
                <div key={a._id} style={{ background: "#111118", border: "1px solid #a855f730", borderRadius: 8, padding: 12 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: 10, color: "#a855f7", background: "#a855f718", border: "1px solid #a855f740" }}>
                      {a.action.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{a.actorUsername}</span>
                    {a.targetUsername && <><span style={{ color: "#475569" }}>→</span><span className="font-mono text-xs" style={{ color: "#e2e8f0" }}>{a.targetUsername}</span></>}
                    <span className="font-mono text-xs ml-auto" style={{ color: "#334155" }}>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.details && (
                    <div className="font-mono mt-1" style={{ fontSize: 11, color: "#64748b" }}>
                      {JSON.stringify(a.details)}
                    </div>
                  )}
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

            {/* Keys grant */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="font-mono text-xs" style={{ color: "#64748b", width: 60 }}>Keys</label>
              <input value={grantKeysAmt} onChange={e => setGrantKeysAmt(e.target.value)} type="number" placeholder="keys" className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 70 }} />
              <input value={grantShardsAmt} onChange={e => setGrantShardsAmt(e.target.value)} type="number" placeholder="shards" className="font-mono text-xs px-2 py-1.5 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 70 }} />
              <button
                onClick={async () => {
                  if (!grantTargetId || (!grantKeysAmt && !grantShardsAmt)) return;
                  setGrantingKeys(true);
                  try {
                    const r = await api.post<{ message: string }>("/owner/grant/keys", { userId: grantTargetId, keys: Number(grantKeysAmt) || 0, keyShards: Number(grantShardsAmt) || 0 });
                    addToast(r.message, "success");
                    setGrantKeysAmt(""); setGrantShardsAmt("");
                  } catch (e: any) { addToast(e.message, "error"); }
                  finally { setGrantingKeys(false); }
                }}
                disabled={grantingKeys || !grantTargetId || (!grantKeysAmt && !grantShardsAmt)}
                className="font-mono text-xs px-3 py-1.5 rounded"
                style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}
              >
                {grantingKeys ? "..." : "Grant Keys"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VANTA TAB */}
      {tab === "vanta" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {(["critical","high","medium","low"] as const).map(sev => {
              const colors: Record<string, string> = { critical: "#ff2d55", high: "#f59e0b", medium: "#a855f7", low: "#39d353" };
              const c = colors[sev];
              return (
                <div key={sev} style={{ ...s, textAlign: "center", borderColor: c + "30" }}>
                  <div className="font-mono font-bold text-xl" style={{ color: c }}>{vantaSummary[sev] ?? 0}</div>
                  <div className="font-mono mt-1" style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.05em" }}>{sev.toUpperCase()}</div>
                </div>
              );
            })}
          </div>

          {/* Filter + refresh */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(["active","dismissed"] as const).map(f => (
              <button key={f} onClick={() => setVantaFilter(f)} className="font-mono text-xs px-3 py-1.5 rounded"
                style={{ background: vantaFilter === f ? "#ff2d5518" : "#111118", color: vantaFilter === f ? "#ff2d55" : "#475569", border: `1px solid ${vantaFilter === f ? "#ff2d5540" : "#1e1e2e"}` }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button onClick={() => loadVanta(vantaFilter === "dismissed")} className="font-mono text-xs px-3 py-1.5 rounded ml-auto"
              style={{ background: "#111118", color: "#475569", border: "1px solid #1e1e2e" }}>
              ↻ Refresh
            </button>
          </div>

          {/* Log list */}
          {vantaLoading ? (
            <div style={{ ...s, textAlign: "center" }}><span className="font-mono text-xs" style={{ color: "#475569" }}>Loading…</span></div>
          ) : vantaLogs.length === 0 ? (
            <div style={{ ...s, textAlign: "center" }}><span className="font-mono text-xs" style={{ color: "#475569" }}>No {vantaFilter} logs.</span></div>
          ) : (
            <div className="space-y-2">
              {vantaLogs.map(log => {
                const colors: Record<string, string> = { critical: "#ff2d55", high: "#f59e0b", medium: "#a855f7", low: "#39d353" };
                const c = colors[log.severity] ?? "#64748b";
                return (
                  <div key={log.id} style={{ ...s, borderColor: c + "30" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: c + "20", color: c, border: `1px solid ${c}40` }}>
                            {log.severity.toUpperCase()}
                          </span>
                          <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{log.trigger}</span>
                          <span className="font-mono" style={{ color: "#334155", fontSize: 10, marginLeft: "auto" }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>
                          {log.player.name}
                          <span className="font-normal ml-2" style={{ color: "#475569" }}>{log.player.id}</span>
                        </div>
                        <div className="font-mono text-xs mt-1" style={{ color: "#94a3b8", lineHeight: 1.5 }}>{log.details}</div>
                        {log.dismissed && log.dismissedBy && (
                          <div className="font-mono" style={{ color: "#334155", fontSize: 10, marginTop: 4 }}>Dismissed by {log.dismissedBy}</div>
                        )}
                      </div>
                      {!log.dismissed && (
                        <button
                          onClick={async () => {
                            try {
                              await api.post<any>(`/vanta/${log.id}/dismiss`, {});
                              loadVanta(false);
                            } catch (e: any) { addToast(e.message ?? "Error", "error"); }
                          }}
                          className="font-mono text-xs px-3 py-1 rounded flex-shrink-0"
                          style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual flag form */}
          <div style={{ ...s, borderColor: "#ff2d5520" }}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#ff2d55", letterSpacing: "0.08em" }}>FLAG A PLAYER MANUALLY</div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={flagPlayerId} onChange={e => setFlagPlayerId(e.target.value)} placeholder="Player ID"
                  className="px-3 py-2 rounded font-mono text-xs" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
                <input value={flagPlayerName} onChange={e => setFlagPlayerName(e.target.value)} placeholder="Player name"
                  className="px-3 py-2 rounded font-mono text-xs" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              </div>
              <select value={flagSeverity} onChange={e => setFlagSeverity(e.target.value)}
                className="w-full px-3 py-2 rounded font-mono text-xs" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <textarea value={flagDetails} onChange={e => setFlagDetails(e.target.value)} placeholder="Details / reason…"
                rows={3} className="w-full px-3 py-2 rounded font-mono text-xs resize-none"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              <button
                disabled={flagging || !flagPlayerId.trim() || !flagDetails.trim()}
                onClick={async () => {
                  setFlagging(true);
                  try {
                    const r = await api.post<{ message: string }>("/vanta/flag", {
                      playerId: flagPlayerId.trim(), playerName: flagPlayerName.trim() || "Unknown",
                      trigger: "manual_flag", severity: flagSeverity, details: flagDetails.trim(),
                    });
                    addToast(r.message, "success");
                    setFlagPlayerId(""); setFlagPlayerName(""); setFlagDetails("");
                    loadVanta(false);
                  } catch (e: any) { addToast(e.message ?? "Error", "error"); }
                  finally { setFlagging(false); }
                }}
                className="font-mono text-xs px-4 py-2 rounded"
                style={{ background: flagging ? "#111118" : "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5530" }}
              >
                {flagging ? "Flagging…" : "Flag Player"}
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
      {/* ROYALE LOGS TAB */}
      {tab === "royale-logs" && (
        <div className="space-y-3">
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#f59e0b", letterSpacing: "0.1em" }}>ROYALE SPIN LOGS</div>
            <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>Total: {royaleLogsTotal.toLocaleString()} spins</div>
            {royaleLogsLoading ? (
              <div className="font-mono text-xs text-center py-8 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
            ) : (
              <div className="space-y-2">
                {royaleLogs.map((log: any, i: number) => (
                  <div key={log._id ?? i} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px" }}>
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{log.username ?? log.userId}</span>
                        <span className="font-mono text-xs ml-3" style={{ color: "#475569" }}>→ {log.itemName ?? log.royaleType ?? "?"}</span>
                        {log.tier && <span className="font-mono text-xs ml-2" style={{ color: { legendary: "#f59e0b", epic: "#a855f7", rare: "#3b82f6", uncommon: "#22c55e", common: "#6b7280" }[log.tier as string] ?? "#6b7280" }}>[{log.tier}]</span>}
                      </div>
                      <span className="font-mono text-xs" style={{ color: "#334155" }}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                    </div>
                  </div>
                ))}
                {royaleLogs.length === 0 && <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>No spin logs found</div>}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRoyaleLogsPage(p => Math.max(1, p - 1))} disabled={royaleLogsPage <= 1} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#1e1e2e", color: "#64748b", border: "1px solid #1e1e2e" }}>← Prev</button>
              <span className="font-mono text-xs px-3 py-1.5" style={{ color: "#475569" }}>Page {royaleLogsPage}</span>
              <button onClick={() => setRoyaleLogsPage(p => p + 1)} disabled={royaleLogs.length < 20} className="font-mono text-xs px-3 py-1.5 rounded" style={{ background: "#1e1e2e", color: "#64748b", border: "1px solid #1e1e2e" }}>Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* COMBAT HISTORY TAB */}
      {tab === "combat-hist" && (
        <div style={s}>
          <div className="font-mono text-xs font-bold mb-3" style={{ color: "#ff2d55", letterSpacing: "0.1em" }}>COMBAT MATCH HISTORY</div>
          {adminMatchLoading ? (
            <div className="font-mono text-xs text-center py-8 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
          ) : (
            <div className="space-y-2">
              {adminCombatMatches.map((m: any, i: number) => {
                const result = !m.winnerId ? "DRAW" : m.winnerId?.toString() === m.player1Id?.toString() ? `${m.player1Name} wins` : `${m.player2Name} wins`;
                return (
                  <div key={m.matchId ?? i} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px" }}>
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                      <div>
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{m.player1Name ?? "?"}</span>
                        <span className="font-mono text-xs mx-2" style={{ color: "#334155" }}>vs</span>
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{m.player2Name ?? (m.isPlayer2AI ? "AI" : "?")}</span>
                        <span className="font-mono text-xs ml-3" style={{ color: "#64748b" }}>{result}</span>
                      </div>
                      <div className="font-mono text-xs" style={{ color: "#334155" }}>
                        {m.currentTurn} turns · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {adminCombatMatches.length === 0 && <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>No combat matches found</div>}
            </div>
          )}
        </div>
      )}

      {/* RACE HISTORY TAB */}
      {tab === "race-hist" && (
        <div style={s}>
          <div className="font-mono text-xs font-bold mb-3" style={{ color: "#00d4ff", letterSpacing: "0.1em" }}>RACE MATCH HISTORY</div>
          {adminMatchLoading ? (
            <div className="font-mono text-xs text-center py-8 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
          ) : (
            <div className="space-y-2">
              {adminRaceMatches.map((m: any, i: number) => (
                <div key={m.matchId ?? i} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px" }}>
                  <div className="flex justify-between items-center gap-4 flex-wrap">
                    <div>
                      <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{m.mode === "2player" ? "2P" : "4P"} Race</span>
                      <span className="font-mono text-xs ml-3" style={{ color: "#64748b" }}>
                        {m.players?.length ?? 0} racers
                        {m.players?.some((p: any) => p.isAI) ? " (AI)" : ""}
                      </span>
                    </div>
                    <span className="font-mono text-xs" style={{ color: "#334155" }}>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
                  </div>
                </div>
              ))}
              {adminRaceMatches.length === 0 && <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>No race matches found</div>}
            </div>
          )}
        </div>
      )}

      {/* DROP RATES TAB */}
      {tab === "drop-rates" && (
        <div style={s}>
          <div className="font-mono text-xs font-bold mb-3" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>ROYALE DROP WEIGHTS</div>
          <div className="font-mono text-xs mb-3" style={{ color: "#475569" }}>Higher weight = more likely to drop. Changes take effect immediately.</div>
          {royaleItemsLoading ? (
            <div className="font-mono text-xs text-center py-8 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
          ) : (
            <div className="space-y-2">
              {royaleItems.map((item: any) => (
                <div key={item._id} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "8px 12px" }}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{item.name}</span>
                      <span className="font-mono text-xs ml-2" style={{ color: { legendary: "#f59e0b", epic: "#a855f7", rare: "#3b82f6", uncommon: "#22c55e", common: "#6b7280" }[item.tier as string] ?? "#6b7280" }}>[{item.tier}]</span>
                      <span className="font-mono text-xs ml-2" style={{ color: "#475569" }}>{item.royaleType ?? item.itemType}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {editingDropId === item._id ? (
                        <>
                          <input
                            value={editingDropVal}
                            onChange={e => setEditingDropVal(e.target.value)}
                            type="number" min={0} step={0.1}
                            className="font-mono text-xs px-2 py-1 rounded"
                            style={{ background: "#111118", border: "1px solid #a855f740", color: "#e2e8f0", width: 70, outline: "none" }}
                          />
                          <button
                            onClick={async () => {
                              setSavingDrop(true);
                              try {
                                await api.patch(`/owner/royale-items/${item._id}/dropweight`, { dropWeight: Number(editingDropVal) });
                                setRoyaleItems(prev => prev.map(it => it._id === item._id ? { ...it, dropWeight: Number(editingDropVal) } : it));
                                setEditingDropId(null);
                                addToast(`Drop weight updated to ${editingDropVal}`, "success");
                              } catch (e: any) { addToast(e.message, "error"); }
                              finally { setSavingDrop(false); }
                            }}
                            disabled={savingDrop}
                            className="font-mono text-xs px-2 py-1 rounded"
                            style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}
                          >
                            {savingDrop ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingDropId(null)} className="font-mono text-xs px-2 py-1 rounded" style={{ color: "#475569", background: "none", border: "none" }}>✕</button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-xs" style={{ color: "#64748b" }}>w: <span style={{ color: "#e2e8f0" }}>{item.dropWeight ?? "?"}</span></span>
                          <button onClick={() => { setEditingDropId(item._id); setEditingDropVal(String(item.dropWeight ?? 1)); }} className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#1e1e2e", color: "#64748b", border: "1px solid #1e1e2e" }}>Edit</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {royaleItems.length === 0 && <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>No royale items found</div>}
            </div>
          )}
        </div>
      )}

      {/* ANNOUNCEMENTS TAB */}
      {tab === "announcements" && (
        <div className="space-y-5">
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#00d4ff", letterSpacing: "0.1em" }}>GLOBAL ANNOUNCEMENT BANNER</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>
              Shows as a dismissible strip below the top nav for every player. Optionally attach a countdown.
            </div>
            {announcementLoading ? (
              <div className="font-mono text-xs text-center py-6 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-mono text-xs" style={{ color: "#e2e8f0" }}>
                    Status: <span style={{ color: announcement?.active ? "#22c55e" : "#ef4444" }}>
                      {announcement?.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  {announcement?.active && announcement.expiresAt && (
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                      Expires: {new Date(announcement.expiresAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <textarea
                  value={announcementText}
                  onChange={e => setAnnouncementText(e.target.value)}
                  maxLength={240}
                  placeholder="e.g. Double DC weekend is live! Ends in..."
                  rows={2}
                  className="w-full font-mono text-xs px-3 py-2 rounded"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", resize: "vertical" }}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: "#64748b" }}>Countdown (hours, optional):</span>
                    <input
                      value={announcementHours}
                      onChange={e => setAnnouncementHours(e.target.value)}
                      type="number" min={0.25} max={168} step={0.25}
                      placeholder="none"
                      className="font-mono text-xs px-2 py-1 rounded"
                      style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 80, outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!announcementText.trim()) { addToast("Enter a message first", "error"); return; }
                      setSavingAnnouncement(true);
                      try {
                        const body: any = { message: announcementText.trim() };
                        if (announcementHours.trim()) body.durationHours = Number(announcementHours);
                        await api.post<any>("/owner/announcement", body);
                        setAnnouncement({ active: true, message: announcementText.trim(), expiresAt: announcementHours.trim() ? new Date(Date.now() + Number(announcementHours) * 3_600_000).toISOString() : null });
                        addToast("Announcement published", "success");
                      } catch (e: any) { addToast(e.message, "error"); }
                      finally { setSavingAnnouncement(false); }
                    }}
                    disabled={savingAnnouncement}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}
                  >
                    {savingAnnouncement ? "…" : "Publish"}
                  </button>
                  {announcement?.active && (
                    <button
                      onClick={async () => {
                        setSavingAnnouncement(true);
                        try {
                          await api.post<any>("/owner/announcement", { active: false });
                          setAnnouncement({ active: false, message: "", expiresAt: null });
                          setAnnouncementText("");
                          addToast("Announcement cleared", "success");
                        } catch (e: any) { addToast(e.message, "error"); }
                        finally { setSavingAnnouncement(false); }
                      }}
                      disabled={savingAnnouncement}
                      className="font-mono text-xs px-4 py-2 rounded"
                      style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444440" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPECIAL EVENTS TAB */}
      {tab === "special-events" && (
        <div className="space-y-5">
          {/* NC Royale Drop Event */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-3" style={{ color: "#f59e0b", letterSpacing: "0.1em" }}>SPECIAL EVENT — NC ROYALE DROP</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>
              When active, each royale spin has a 5% chance to award an additional 10 NC bonus. NC is otherwise never a royale drop.
            </div>
            {specialEventLoading ? (
              <div className="font-mono text-xs text-center py-6 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-mono text-xs" style={{ color: "#e2e8f0" }}>
                    Status: <span style={{ color: specialEvent?.active ? "#22c55e" : "#ef4444" }}>
                      {specialEvent?.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  {specialEvent?.active && specialEvent.expiresAt && (
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                      Expires: {new Date(specialEvent.expiresAt).toLocaleString()}
                    </div>
                  )}
                </div>
                {specialEvent?.active ? (
                  <button
                    onClick={async () => {
                      setSettingEvent(true);
                      try {
                        await api.post<any>("/owner/special-event", { active: false });
                        setSpecialEvent({ active: false, type: null, expiresAt: null });
                        addToast("Special event deactivated", "success");
                      } catch (e: any) { addToast(e.message, "error"); }
                      finally { setSettingEvent(false); }
                    }}
                    disabled={settingEvent}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444440" }}
                  >
                    {settingEvent ? "…" : "Deactivate Event"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs" style={{ color: "#64748b" }}>Duration (hours):</span>
                      <input
                        value={eventHours}
                        onChange={e => setEventHours(e.target.value)}
                        type="number" min={0.5} max={168} step={0.5}
                        className="font-mono text-xs px-2 py-1 rounded"
                        style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 70, outline: "none" }}
                      />
                    </div>
                    <button
                      onClick={async () => {
                        setSettingEvent(true);
                        try {
                          const r = await api.post<{ active: boolean; type: string; expiresAt: string }>("/owner/special-event", { type: eventType, durationHours: Number(eventHours) });
                          setSpecialEvent(r);
                          addToast(`Event activated for ${eventHours}h`, "success");
                        } catch (e: any) { addToast(e.message, "error"); }
                        finally { setSettingEvent(false); }
                      }}
                      disabled={settingEvent}
                      className="font-mono text-xs px-4 py-2 rounded"
                      style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}
                    >
                      {settingEvent ? "…" : "Activate NC Royale Drop"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tier Weights */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>ROYALE TIER WEIGHTS</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>
              Adjust the probability of each tier being rolled. Changes take effect within 30 seconds. Values do not need to sum to 100 — relative weights are used.
            </div>
            {(["common", "uncommon", "rare", "epic", "legendary"] as const).map(tier => {
              const TIER_COLORS: Record<string, string> = { legendary: "#f59e0b", epic: "#a855f7", rare: "#3b82f6", uncommon: "#22c55e", common: "#6b7280" };
              const total = Object.values(tierWeights).reduce((a, b) => a + b, 0);
              return (
                <div key={tier} className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs w-24" style={{ color: TIER_COLORS[tier] }}>{tier.toUpperCase()}</span>
                  <input
                    value={tierWeights[tier]}
                    onChange={e => setTierWeights(prev => ({ ...prev, [tier]: Number(e.target.value) }))}
                    type="number" min={0} step={1}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", width: 70, outline: "none" }}
                  />
                  <span className="font-mono text-xs" style={{ color: "#334155" }}>
                    ({total > 0 ? (tierWeights[tier] / total * 100).toFixed(1) : "0.0"}%)
                  </span>
                </div>
              );
            })}
            <button
              onClick={async () => {
                setSavingTierWeights(true);
                try {
                  await api.patch<any>("/owner/royale-tier-weights", tierWeights);
                  addToast("Tier weights updated — live in ~30s", "success");
                } catch (e: any) { addToast(e.message, "error"); }
                finally { setSavingTierWeights(false); }
              }}
              disabled={savingTierWeights}
              className="font-mono text-xs px-4 py-2 rounded mt-2"
              style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}
            >
              {savingTierWeights ? "Saving…" : "Save Tier Weights"}
            </button>
          </div>
        </div>
      )}

      {/* GIVEAWAYS TAB */}
      {tab === "giveaways" && (
        <div className="space-y-4">
          {/* Create system giveaway */}
          <div style={s}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>CREATE SYSTEM GIVEAWAY</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#475569" }}>
              Owner-hosted giveaways are conjured — no escrow, no eligibility checks, shown as "System" host.
            </div>

            {/* Currency */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "DC", val: ownerGiveDc, set: setOwnerGiveDc },
                { label: "UC (NC)", val: ownerGiveUc, set: setOwnerGiveUc },
                { label: "Keys", val: ownerGiveKeys, set: setOwnerGiveKeys },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>{label}</div>
                  <input
                    type="number" min="0" value={val}
                    onChange={e => set(e.target.value)}
                    className="font-mono text-xs px-2 py-1.5 rounded w-full"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                  />
                </div>
              ))}
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="font-mono text-xs font-bold mb-2" style={{ color: "#64748b", letterSpacing: "0.05em" }}>ITEMS</div>
              {ownerGiveItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <input
                    value={it.itemId} readOnly
                    className="font-mono text-xs px-2 py-1 rounded flex-1"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#94a3b8", outline: "none" }}
                  />
                  <span className="font-mono text-xs" style={{ color: "#475569" }}>×{it.quantity}</span>
                  <button
                    onClick={() => setOwnerGiveItems(prev => prev.filter((_, j) => j !== i))}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ color: "#ff2d55", border: "1px solid #ff2d5530" }}
                  >✕</button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  placeholder="Item ObjectId…"
                  value={ownerGiveNewItemId} onChange={e => setOwnerGiveNewItemId(e.target.value)}
                  className="font-mono text-xs px-2 py-1.5 rounded flex-1"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
                <input
                  type="number" min="1" value={ownerGiveNewItemQty}
                  onChange={e => setOwnerGiveNewItemQty(e.target.value)}
                  placeholder="qty"
                  className="font-mono text-xs px-2 py-1.5 rounded"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none", width: 64 }}
                />
                <button
                  onClick={() => {
                    const id = ownerGiveNewItemId.trim();
                    const qty = Math.max(1, Math.floor(Number(ownerGiveNewItemQty) || 1));
                    if (!id) return;
                    setOwnerGiveItems(prev => [...prev, { itemId: id, quantity: qty }]);
                    setOwnerGiveNewItemId(""); setOwnerGiveNewItemQty("1");
                  }}
                  className="font-mono text-xs px-3 py-1.5 rounded"
                  style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740" }}
                >+ Add</button>
              </div>
            </div>

            {/* Duration & max entrants */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Duration</div>
                <select
                  value={ownerGiveDuration} onChange={e => setOwnerGiveDuration(Number(e.target.value))}
                  className="font-mono text-xs px-2 py-1.5 rounded w-full"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                >
                  {GIVE_DURATIONS.map(d => <option key={d.ms} value={d.ms}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <div className="font-mono text-xs mb-1" style={{ color: "#64748b" }}>Max Entrants (1–500)</div>
                <input
                  type="number" min="1" max="500" value={ownerGiveMax}
                  onChange={e => setOwnerGiveMax(e.target.value)}
                  className="font-mono text-xs px-2 py-1.5 rounded w-full"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
                />
              </div>
            </div>

            {isOwner && (
              <button
                onClick={createOwnerGiveaway}
                disabled={ownerGiveCreating}
                className="font-mono text-xs px-6 py-2 rounded font-bold"
                style={{ background: ownerGiveCreating ? "#a855f720" : "#a855f730", color: "#a855f7", border: "1px solid #a855f750" }}
              >
                {ownerGiveCreating ? "Creating…" : "🎁 Launch System Giveaway"}
              </button>
            )}
          </div>

          {/* Live giveaways list */}
          <div style={s}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-xs font-bold" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>LIVE GIVEAWAYS</div>
              <button onClick={loadOwnerGiveaways} disabled={ownerGiveawaysLoading} className="font-mono text-xs px-3 py-1 rounded" style={{ background: "#1e1e2e", color: "#64748b", border: "1px solid #1e1e2e" }}>
                {ownerGiveawaysLoading ? "…" : "Refresh"}
              </button>
            </div>
            {ownerGiveawaysLoading ? (
              <div className="font-mono text-xs text-center py-6 animate-pulse" style={{ color: "#334155" }}>Loading…</div>
            ) : liveOwnerGiveaways.length === 0 ? (
              <div className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>No live giveaways</div>
            ) : (
              <div className="space-y-2">
                {liveOwnerGiveaways.map((g: any) => {
                  const expiry = g.liveExpiresAt ? new Date(g.liveExpiresAt) : null;
                  const msLeft = expiry ? expiry.getTime() - Date.now() : 0;
                  const hLeft  = Math.floor(msLeft / 3600000);
                  const mLeft  = Math.floor((msLeft % 3600000) / 60000);
                  const timeLabel = msLeft <= 0 ? "ending…" : hLeft > 0 ? `${hLeft}h ${mLeft}m left` : `${mLeft}m left`;
                  return (
                    <div key={g.id} style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 6, padding: "10px 14px" }}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: g.isOwnerHosted ? "#00d4ff" : "#a855f7" }}
                          >
                            {g.isOwnerHosted ? "🖥 System" : g.host?.name ?? "???"}
                          </span>
                          <span className="font-mono text-xs ml-3" style={{ color: "#64748b" }}>
                            {g.entrantCount ?? 0}/{g.maxEntrants} entered · {timeLabel}
                          </span>
                        </div>
                        <div className="flex gap-3 font-mono text-xs" style={{ color: "#475569" }}>
                          {g.pledge?.dc > 0 && <span>💵 {g.pledge.dc.toLocaleString()} DC</span>}
                          {g.pledge?.uc > 0 && <span>💎 {g.pledge.uc.toLocaleString()} UC</span>}
                          {g.pledge?.keys > 0 && <span>🔑 {g.pledge.keys}</span>}
                          {g.pledge?.items?.length > 0 && <span>📦 {g.pledge.items.length} item(s)</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAFF MANAGEMENT TAB */}
      {tab === "staff" && (
        <div className="space-y-4">
          {/* Staff list */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
            <div className="font-mono font-bold text-sm mb-3" style={{ color: "#00d4ff" }}>STAFF MEMBERS</div>
            {staffLoading ? (
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>Loading…</div>
            ) : staffList.length === 0 ? (
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>No staff members assigned yet.</div>
            ) : (
              <div className="space-y-2">
                {staffList.map(s => {
                  const tierColors: Record<number, string> = { 1: "#64748b", 2: "#39d353", 3: "#00d4ff", 4: "#a855f7", 5: "#ff6b35" };
                  const tierNames: Record<number, string> = { 1: "Watcher", 2: "Moderator", 3: "Enforcer", 4: "Commander", 5: "Director" };
                  const tc = tierColors[s.staffTier] ?? "#64748b";
                  return (
                    <div key={s._id} className="flex items-center justify-between rounded p-3" style={{ background: "#0a0a0f", border: "1px solid #1e293b" }}>
                      <div>
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{s.username}</span>
                        <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: `${tc}18`, color: tc, border: `1px solid ${tc}30` }}>
                          {s.staffTier ? `T${s.staffTier}: ${tierNames[s.staffTier]}` : "No Tier"}
                        </span>
                        <span className="ml-2 font-mono text-xs" style={{ color: "#475569" }}>{s.role}</span>
                        <div className="font-mono text-xs mt-0.5" style={{ color: "#475569" }}>
                          Sub: {s.subscriptionTier?.replace(/_/g, " ") ?? "none"} · Earned: {(s.staffEarningsTotalDc ?? 0).toLocaleString()} DC
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {staffTierTarget === s._id ? (
                          <div className="flex gap-2 items-center">
                            <select
                              value={staffTierValue}
                              onChange={e => setStaffTierValue(e.target.value)}
                              className="font-mono text-xs rounded px-2 py-1"
                              style={{ background: "#111118", color: "#e2e8f0", border: "1px solid #1e293b" }}
                            >
                              <option value="0">Remove Tier</option>
                              <option value="1">T1: Watcher</option>
                              <option value="2">T2: Moderator</option>
                              <option value="3">T3: Enforcer</option>
                              <option value="4">T4: Commander</option>
                              <option value="5">T5: Director</option>
                            </select>
                            <button
                              onClick={() => setStaffTier(s._id)}
                              disabled={settingStaffTier}
                              className="font-mono text-xs px-3 py-1 rounded"
                              style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                            >
                              {settingStaffTier ? "…" : "Save"}
                            </button>
                            <button
                              onClick={() => setStaffTierTarget(null)}
                              className="font-mono text-xs px-3 py-1 rounded"
                              style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setStaffTierTarget(s._id); setStaffTierValue(String(s.staffTier ?? 1)); }}
                            className="font-mono text-xs px-3 py-1.5 rounded"
                            style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
                          >
                            Set Tier
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task progress per staff */}
          {staffList.filter(s => s.staffTier).length > 0 && (
            <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
              <div className="font-mono font-bold text-sm mb-3" style={{ color: "#f59e0b" }}>TASK PROGRESS</div>
              <div className="space-y-3">
                {staffList.filter(s => s.staffTier).map(s => {
                  const taskDefs: Record<number, { id: string; label: string; target: number }[]> = {
                    1: [{ id: "reports_viewed", label: "Review reports", target: 10 }, { id: "chat_warnings", label: "Issue warnings", target: 5 }],
                    2: [{ id: "bans_processed", label: "Process bans", target: 5 }, { id: "chat_resolved", label: "Resolve chat", target: 10 }],
                    3: [{ id: "tickets_closed", label: "Close tickets", target: 10 }, { id: "appeals_handled", label: "Handle appeals", target: 5 }],
                    4: [{ id: "resources_granted", label: "Grant resources", target: 10 }, { id: "accounts_managed", label: "Manage accounts", target: 5 }],
                    5: [{ id: "incidents_reviewed", label: "Review incidents", target: 5 }, { id: "maintenance_complete", label: "Maintenance tasks", target: 3 }],
                  };
                  const tasks = taskDefs[s.staffTier] ?? [];
                  const progress = s.staffTaskProgress ?? {};
                  return (
                    <div key={s._id} className="rounded p-3" style={{ background: "#0a0a0f", border: "1px solid #1e293b" }}>
                      <div className="font-mono text-xs font-bold mb-2" style={{ color: "#e2e8f0" }}>{s.username}</div>
                      {tasks.map(t => {
                        const prog = progress[t.id] ?? 0;
                        const pct = Math.min(100, Math.round((prog / t.target) * 100));
                        return (
                          <div key={t.id} className="mb-1.5">
                            <div className="flex justify-between font-mono text-xs mb-0.5" style={{ color: "#64748b" }}>
                              <span>{t.label}</span>
                              <span>{prog}/{t.target}</span>
                            </div>
                            <div className="rounded-full overflow-hidden" style={{ background: "#1e293b", height: 3 }}>
                              <div style={{ width: `${pct}%`, background: prog >= t.target ? "#39d353" : "#00d4ff", height: "100%" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Staff activity log */}
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono font-bold text-sm" style={{ color: "#a855f7" }}>STAFF ACTIVITY LOG</div>
              <div className="flex gap-2">
                <input
                  placeholder="Filter by staff ID…"
                  value={staffLogFilter}
                  onChange={e => setStaffLogFilter(e.target.value)}
                  className="font-mono text-xs px-2 py-1 rounded"
                  style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b", width: 180 }}
                />
                <button
                  onClick={() => {
                    setStaffLogsLoading(true);
                    const qs = staffLogFilter ? `?actorId=${staffLogFilter}&limit=30` : "?limit=30";
                    api.get<{ logs: any[] }>(`/owner/staff/logs${qs}`)
                      .then(r => setStaffLogs(r.logs))
                      .catch(() => {})
                      .finally(() => setStaffLogsLoading(false));
                  }}
                  className="font-mono text-xs px-3 py-1 rounded"
                  style={{ background: "#a855f718", color: "#a855f7", border: "1px solid #a855f740", cursor: "pointer" }}
                >
                  Filter
                </button>
              </div>
            </div>
            {staffLogsLoading ? (
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>Loading logs…</div>
            ) : staffLogs.length === 0 ? (
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>No activity yet.</div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {staffLogs.map((log: any) => {
                  const tierColors: Record<number, string> = { 1: "#64748b", 2: "#39d353", 3: "#00d4ff", 4: "#a855f7", 5: "#ff6b35" };
                  const tc = log.actorTier ? tierColors[log.actorTier] : "#64748b";
                  return (
                    <div key={log._id} className="flex items-start gap-2 py-1.5 border-b" style={{ borderColor: "#1e293b" }}>
                      <div style={{ flex: "0 0 auto" }}>
                        {log.actorTier && (
                          <span className="font-mono text-xs px-1 rounded" style={{ background: `${tc}18`, color: tc, border: `1px solid ${tc}30` }}>
                            T{log.actorTier}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{log.actorUsername}</span>
                        <span className="font-mono text-xs ml-2" style={{ color: "#a855f7" }}>{log.action}</span>
                        {log.targetUsername && (
                          <span className="font-mono text-xs ml-2" style={{ color: "#64748b" }}>→ {log.targetUsername}</span>
                        )}
                        <span className="font-mono text-xs ml-2" style={{ color: "#334155" }}>
                          {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MASS ACTIONS TAB */}
      {tab === "mass-actions" && (
        <div className="space-y-4 max-w-lg">
          <div style={{ background: "#ff6b3512", border: "1px solid #ff6b3530", borderRadius: 8, padding: 12 }} className="font-mono text-xs">
            <span style={{ color: "#ff6b35", fontWeight: "bold" }}>⚠ WARNING:</span>
            <span style={{ color: "#94a3b8" }}> Mass grants are applied to ALL non-banned player accounts instantly and cannot be undone.</span>
          </div>
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, padding: 20 }}>
            <div className="font-mono font-bold text-sm mb-4" style={{ color: "#ff6b35" }}>BROADCAST TO ALL PLAYERS</div>
            <div className="space-y-3">
              {[
                { label: "DataCredits (DC)", key: "dc", val: massDc, set: setMassDc, color: "#39d353" },
                { label: "Nova Credits (NC)", key: "nc", val: massNc, set: setMassNc, color: "#a855f7" },
                { label: "Keys", key: "keys", val: massKeys, set: setMassKeys, color: "#f59e0b" },
              ].map(row => (
                <div key={row.key} className="flex items-center gap-3">
                  <label className="font-mono text-xs w-40" style={{ color: row.color }}>{row.label}</label>
                  <input
                    type="number"
                    value={row.val}
                    onChange={e => row.set(e.target.value)}
                    className="font-mono text-xs rounded px-3 py-2 flex-1"
                    style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }}
                    min="0"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="font-mono text-xs w-40" style={{ color: "#64748b" }}>Reason / Note</label>
                <input
                  value={massReason}
                  onChange={e => setMassReason(e.target.value)}
                  placeholder="e.g. Weekend event bonus"
                  className="font-mono text-xs rounded px-3 py-2 flex-1"
                  style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }}
                />
              </div>
            </div>
            <button
              onClick={() => setMassGrantConfirm(true)}
              disabled={massGranting}
              className="font-mono text-xs px-6 py-2.5 rounded mt-4 w-full"
              style={{ background: massGranting ? "#1e293b" : "#ff6b3518", color: massGranting ? "#475569" : "#ff6b35", border: "1px solid #ff6b3540", cursor: massGranting ? "not-allowed" : "pointer", fontWeight: "bold" }}
            >
              {massGranting ? "Sending…" : "📢 BROADCAST TO ALL PLAYERS"}
            </button>
          </div>
        </div>
      )}

      {/* ── ECONOMY TAB ─────────────────────────────────────────── */}
      {tab === "economy" && (
        <div className="space-y-4">
          {/* Header */}
          <div style={s}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono font-bold text-sm" style={{ color: "#39d353" }}>ECONOMY CONTROL CENTER</div>
                <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Live-tune all game economy parameters. Changes apply within 60 seconds — no server restart required.</div>
              </div>
              <button onClick={loadGameConfig} disabled={gameConfigLoading}
                className="font-mono text-xs px-4 py-2 rounded"
                style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>
                {gameConfigLoading ? "Loading…" : "↺ Refresh"}
              </button>
            </div>
          </div>

          {!gameConfig && !gameConfigLoading && (
            <div style={s} className="text-center py-4">
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>Click Refresh to load economy settings.</div>
            </div>
          )}

          {gameConfig && (
            <>
              {/* Global Multipliers */}
              <div style={s}>
                <div className="font-mono font-bold text-xs mb-1" style={{ color: "#39d353", letterSpacing: "0.1em" }}>GLOBAL MULTIPLIERS</div>
                <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>Applied on top of all individual payout calculations. 1.0 = default. 2.0 = double payouts. Stacks with event XP boosts.</div>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {([
                    { label: "DC Reward Multiplier", val: editDcMult, set: setEditDcMult, help: "Applies to all crime & job DC payouts" },
                    { label: "XP Reward Multiplier", val: editXpMult, set: setEditXpMult, help: "Applies to all crime & job XP payouts" },
                  ] as const).map(f => (
                    <div key={f.label}>
                      <label className="font-mono text-xs" style={{ color: "#39d353" }}>{f.label}</label>
                      <div className="font-mono mt-0.5 mb-1" style={{ color: "#475569", fontSize: 10 }}>{f.help}</div>
                      <input type="number" step="0.1" min="0.1" max="100" value={f.val} onChange={e => f.set(e.target.value)}
                        className="w-full font-mono text-xs px-3 py-2 rounded"
                        style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => saveGameSection("globalMultipliers", {
                    globalMultipliers: { dcRewardMult: Math.max(0.1, parseFloat(editDcMult) || 1), xpRewardMult: Math.max(0.1, parseFloat(editXpMult) || 1) }
                  })}
                  disabled={savingSection === "globalMultipliers"}
                  className="mt-4 font-mono text-xs px-4 py-2 rounded"
                  style={{ background: savingSection === "globalMultipliers" ? "#1e293b" : "#39d35318", color: savingSection === "globalMultipliers" ? "#475569" : "#39d353", border: "1px solid #39d35340" }}>
                  {savingSection === "globalMultipliers" ? "Saving…" : "✓ Apply Multipliers"}
                </button>
              </div>

              {/* Resource Caps */}
              <div style={s}>
                <div className="font-mono font-bold text-xs mb-1" style={{ color: "#f59e0b", letterSpacing: "0.1em" }}>RESOURCE CAPS</div>
                <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>Maximum DC a player can hold. Defaults: Wallet 100M · Bank 1B.</div>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {([
                    { label: "Wallet Cap (DC)", val: editWalletCap, set: setEditWalletCap, help: "Max DC held in wallet" },
                    { label: "Bank Cap (DC)",   val: editBankCap,   set: setEditBankCap,   help: "Max DC held in bank" },
                  ] as const).map(f => (
                    <div key={f.label}>
                      <label className="font-mono text-xs" style={{ color: "#f59e0b" }}>{f.label}</label>
                      <div className="font-mono mt-0.5 mb-1" style={{ color: "#475569", fontSize: 10 }}>{f.help}</div>
                      <input type="number" step="1000000" min="1000" value={f.val} onChange={e => f.set(e.target.value)}
                        className="w-full font-mono text-xs px-3 py-2 rounded"
                        style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => saveGameSection("resourceCaps", {
                    resourceCaps: { walletCap: Math.max(1000, parseInt(editWalletCap) || 100_000_000), bankCap: Math.max(1000, parseInt(editBankCap) || 1_000_000_000) }
                  })}
                  disabled={savingSection === "resourceCaps"}
                  className="mt-4 font-mono text-xs px-4 py-2 rounded"
                  style={{ background: savingSection === "resourceCaps" ? "#1e293b" : "#f59e0b18", color: savingSection === "resourceCaps" ? "#475569" : "#f59e0b", border: "1px solid #f59e0b40" }}>
                  {savingSection === "resourceCaps" ? "Saving…" : "✓ Apply Caps"}
                </button>
              </div>

              {/* Crime System */}
              <div style={s}>
                <div className="font-mono font-bold text-xs mb-1" style={{ color: "#ff2d55", letterSpacing: "0.1em" }}>CRIME SYSTEM</div>
                <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>Per-hour run limit and per-run reward overrides. Leave override fields blank to use hardcoded defaults.</div>
                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <label className="font-mono text-xs" style={{ color: "#ff2d55" }}>Runs Per Hour Cap</label>
                    <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>Default: 30</div>
                    <input type="number" min="1" max="1000" value={editRunsPerHour} onChange={e => setEditRunsPerHour(e.target.value)}
                      className="font-mono text-xs px-3 py-2 rounded mt-1 w-28"
                      style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }} />
                  </div>
                </div>
                {gameCatalog && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          {["Name", "T", "Default DC", "Override Min", "Override Max", "Override XP", "Energy", "Success", ""].map(h => (
                            <th key={h} className="font-mono text-left px-2 py-1" style={{ color: "#475569", fontWeight: "normal", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gameCatalog.runs.map(r => {
                          const ov = editRunOverrides[r.id] ?? {};
                          const hasOv = Object.values(ov).some(v => v !== "");
                          return (
                            <tr key={r.id} style={{ borderBottom: "1px solid #0f172a", background: hasOv ? "#0d1a0d" : "transparent" }}>
                              <td className="px-2 py-1.5 font-mono" style={{ color: "#e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>{r.name}</td>
                              <td className="px-2 py-1.5 font-mono text-center" style={{ color: "#64748b", fontSize: 10 }}>T{r.tier}</td>
                              <td className="px-2 py-1.5 font-mono" style={{ color: "#475569", fontSize: 10, whiteSpace: "nowrap" }}>{r.dcMin.toLocaleString()}–{r.dcMax.toLocaleString()}</td>
                              {(["dcMin", "dcMax", "xp", "energyCost"] as const).map(field => (
                                <td key={field} className="px-1 py-1">
                                  <input type="number" min="0" placeholder="default"
                                    value={ov[field] ?? ""}
                                    onChange={e => setEditRunOverrides(prev => ({ ...prev, [r.id]: { ...(prev[r.id] ?? {}), [field]: e.target.value } }))}
                                    className="font-mono px-2 py-1 rounded w-20"
                                    style={{ background: (ov[field] ?? "") !== "" ? "#0d1a0d" : "#0a0a0f", color: (ov[field] ?? "") !== "" ? "#39d353" : "#64748b", border: `1px solid ${(ov[field] ?? "") !== "" ? "#39d35330" : "#1e293b"}`, fontSize: 10 }} />
                                </td>
                              ))}
                              <td className="px-1 py-1">
                                <input type="number" min="0" max="1" step="0.01" placeholder={r.baseSuccess.toFixed(2)}
                                  value={ov.baseSuccess ?? ""}
                                  onChange={e => setEditRunOverrides(prev => ({ ...prev, [r.id]: { ...(prev[r.id] ?? {}), baseSuccess: e.target.value } }))}
                                  className="font-mono px-2 py-1 rounded w-16"
                                  style={{ background: (ov.baseSuccess ?? "") !== "" ? "#0d1a0d" : "#0a0a0f", color: (ov.baseSuccess ?? "") !== "" ? "#39d353" : "#64748b", border: `1px solid ${(ov.baseSuccess ?? "") !== "" ? "#39d35330" : "#1e293b"}`, fontSize: 10 }} />
                              </td>
                              <td className="px-1 py-1">
                                <button onClick={() => setEditRunOverrides(prev => { const n = { ...prev }; delete n[r.id]; return n; })}
                                  className="font-mono px-2 py-1 rounded"
                                  style={{ color: "#475569", border: "1px solid #1e293b", fontSize: 10 }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={() => {
                    const runOverrides: Record<string, Record<string, number>> = {};
                    for (const [runId, vals] of Object.entries(editRunOverrides)) {
                      const entry: Record<string, number> = {};
                      if ((vals.dcMin ?? "") !== "")       entry.dcMin       = parseFloat(vals.dcMin!);
                      if ((vals.dcMax ?? "") !== "")       entry.dcMax       = parseFloat(vals.dcMax!);
                      if ((vals.xp ?? "") !== "")          entry.xp          = parseFloat(vals.xp!);
                      if ((vals.energyCost ?? "") !== "")  entry.energyCost  = parseFloat(vals.energyCost!);
                      if ((vals.baseSuccess ?? "") !== "") entry.baseSuccess = parseFloat(vals.baseSuccess!);
                      if (Object.keys(entry).length > 0)  runOverrides[runId] = entry;
                    }
                    saveGameSection("crimeConfig", { crimeConfig: { runsPerHourCap: Math.max(1, parseInt(editRunsPerHour) || 30), runOverrides } });
                  }}
                  disabled={savingSection === "crimeConfig"}
                  className="mt-4 font-mono text-xs px-4 py-2 rounded"
                  style={{ background: savingSection === "crimeConfig" ? "#1e293b" : "#ff2d5518", color: savingSection === "crimeConfig" ? "#475569" : "#ff2d55", border: "1px solid #ff2d5540" }}>
                  {savingSection === "crimeConfig" ? "Saving…" : "✓ Apply Crime Config"}
                </button>
              </div>

              {/* Job System */}
              <div style={s}>
                <div className="font-mono font-bold text-xs mb-1" style={{ color: "#a855f7", letterSpacing: "0.1em" }}>JOB SYSTEM</div>
                <div className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>Minigame trigger probability and per-job reward overrides. Leave blank = use hardcoded defaults.</div>
                <div className="flex items-center gap-6 mb-4">
                  <div>
                    <label className="font-mono text-xs" style={{ color: "#a855f7" }}>Minigame Trigger Chance</label>
                    <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>Default: 0.30 (30%). Range: 0–1.</div>
                    <input type="number" min="0" max="1" step="0.01" value={editMinigameChance} onChange={e => setEditMinigameChance(e.target.value)}
                      className="font-mono text-xs px-3 py-2 rounded mt-1 w-28"
                      style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }} />
                  </div>
                </div>
                {gameCatalog && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e293b" }}>
                          {["Name", "District", "Default DC", "Override Min", "Override Max", "Override XP", "Energy", "Cooldown(m)", ""].map(h => (
                            <th key={h} className="font-mono text-left px-2 py-1" style={{ color: "#475569", fontWeight: "normal", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gameCatalog.jobs.map(j => {
                          const ov = editJobOverrides[j.id] ?? {};
                          const hasOv = Object.values(ov).some(v => v !== "");
                          return (
                            <tr key={j.id} style={{ borderBottom: "1px solid #0f172a", background: hasOv ? "#130d1f" : "transparent" }}>
                              <td className="px-2 py-1.5 font-mono" style={{ color: "#e2e8f0", whiteSpace: "nowrap", fontSize: 11 }}>{j.name}</td>
                              <td className="px-2 py-1.5 font-mono" style={{ color: "#64748b", fontSize: 10 }}>{j.district}</td>
                              <td className="px-2 py-1.5 font-mono" style={{ color: "#475569", fontSize: 10, whiteSpace: "nowrap" }}>{j.dcMin.toLocaleString()}–{j.dcMax.toLocaleString()}</td>
                              {(["dcMin", "dcMax", "xpPerJob", "energyCost", "cooldownMin"] as const).map(field => (
                                <td key={field} className="px-1 py-1">
                                  <input type="number" min="0" placeholder="def"
                                    value={ov[field] ?? ""}
                                    onChange={e => setEditJobOverrides(prev => ({ ...prev, [j.id]: { ...(prev[j.id] ?? {}), [field]: e.target.value } }))}
                                    className="font-mono px-2 py-1 rounded w-16"
                                    style={{ background: (ov[field] ?? "") !== "" ? "#130d1f" : "#0a0a0f", color: (ov[field] ?? "") !== "" ? "#a855f7" : "#64748b", border: `1px solid ${(ov[field] ?? "") !== "" ? "#a855f730" : "#1e293b"}`, fontSize: 10 }} />
                                </td>
                              ))}
                              <td className="px-1 py-1">
                                <button onClick={() => setEditJobOverrides(prev => { const n = { ...prev }; delete n[j.id]; return n; })}
                                  className="font-mono px-2 py-1 rounded"
                                  style={{ color: "#475569", border: "1px solid #1e293b", fontSize: 10 }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={() => {
                    const jobOverrides: Record<string, Record<string, number>> = {};
                    for (const [jobId, vals] of Object.entries(editJobOverrides)) {
                      const entry: Record<string, number> = {};
                      if ((vals.dcMin ?? "") !== "")       entry.dcMin       = parseFloat(vals.dcMin!);
                      if ((vals.dcMax ?? "") !== "")       entry.dcMax       = parseFloat(vals.dcMax!);
                      if ((vals.xpPerJob ?? "") !== "")    entry.xpPerJob    = parseFloat(vals.xpPerJob!);
                      if ((vals.energyCost ?? "") !== "")  entry.energyCost  = parseFloat(vals.energyCost!);
                      if ((vals.cooldownMin ?? "") !== "") entry.cooldownMin = parseFloat(vals.cooldownMin!);
                      if (Object.keys(entry).length > 0)  jobOverrides[jobId] = entry;
                    }
                    saveGameSection("jobConfig", { jobConfig: { minigameTriggerChance: Math.max(0, Math.min(1, parseFloat(editMinigameChance) || 0.30)), jobOverrides } });
                  }}
                  disabled={savingSection === "jobConfig"}
                  className="mt-4 font-mono text-xs px-4 py-2 rounded"
                  style={{ background: savingSection === "jobConfig" ? "#1e293b" : "#a855f718", color: savingSection === "jobConfig" ? "#475569" : "#a855f7", border: "1px solid #a855f740" }}>
                  {savingSection === "jobConfig" ? "Saving…" : "✓ Apply Job Config"}
                </button>
              </div>

              {/* Staff Pay */}
              <div style={s}>
                <div className="font-mono font-bold text-xs mb-1" style={{ color: "#00d4ff", letterSpacing: "0.1em" }}>STAFF PAY</div>
                <div className="font-mono text-xs mb-4" style={{ color: "#64748b" }}>Daily DC earnings per staff tier (claimed once every 24h). Leave blank = use hardcoded default.</div>
                <div className="space-y-2">
                  {gameCatalog && Object.entries(gameCatalog.staffTiers).sort(([a], [b]) => Number(a) - Number(b)).map(([tier, def]) => (
                    <div key={tier} className="flex items-center gap-4">
                      <div className="font-mono text-xs w-36" style={{ color: def.color }}>Tier {tier} — {def.name}</div>
                      <div className="font-mono w-28" style={{ color: "#475569", fontSize: 10 }}>Default: {def.dailyDc.toLocaleString()} DC</div>
                      <input type="number" min="0" max="1000000"
                        value={editStaffDailyDc[tier] ?? ""}
                        onChange={e => setEditStaffDailyDc(prev => ({ ...prev, [tier]: e.target.value }))}
                        placeholder={String(def.dailyDc)}
                        className="font-mono text-xs px-3 py-1.5 rounded w-32"
                        style={{ background: (editStaffDailyDc[tier] ?? "") !== "" ? "#0d1a1f" : "#0a0a0f", color: (editStaffDailyDc[tier] ?? "") !== "" ? "#00d4ff" : "#64748b", border: `1px solid ${(editStaffDailyDc[tier] ?? "") !== "" ? "#00d4ff30" : "#1e293b"}` }} />
                      <span className="font-mono text-xs" style={{ color: "#475569" }}>DC / day</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const tierDailyDc: Record<string, number> = {};
                    for (const [tier, val] of Object.entries(editStaffDailyDc)) {
                      if ((val ?? "") !== "") tierDailyDc[tier] = Math.max(0, parseInt(val) || 0);
                    }
                    saveGameSection("staffConfig", { staffConfig: { tierDailyDc } });
                  }}
                  disabled={savingSection === "staffConfig"}
                  className="mt-4 font-mono text-xs px-4 py-2 rounded"
                  style={{ background: savingSection === "staffConfig" ? "#1e293b" : "#00d4ff18", color: savingSection === "staffConfig" ? "#475569" : "#00d4ff", border: "1px solid #00d4ff40" }}>
                  {savingSection === "staffConfig" ? "Saving…" : "✓ Apply Staff Pay"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DATABASE TAB ─────────────────────────────────────────── */}
      {tab === "database" && (
        <div className="space-y-4">
          {/* Header */}
          <div style={s}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono font-bold text-sm" style={{ color: "#ff2d55" }}>DATABASE MANAGEMENT</div>
                <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Live MongoDB storage. Protected collections (🔒) cannot be cleared or dropped. TTL indexes auto-purge logs &amp; history.</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={loadDbStats} disabled={dbStatsLoading}
                  className="font-mono text-xs px-4 py-2 rounded"
                  style={{ background: "#00d4ff18", color: "#00d4ff", border: "1px solid #00d4ff40" }}>
                  {dbStatsLoading ? "Loading…" : "↺ Refresh"}
                </button>
                <button onClick={runSmartCleanup} disabled={smartCleanupLoading || dbStatsLoading}
                  className="font-mono text-xs px-4 py-2 rounded"
                  style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                  {smartCleanupLoading ? "Cleaning…" : "🧹 Smart Cleanup"}
                </button>
              </div>
            </div>
          </div>

          {!dbStats && !dbStatsLoading && (
            <div style={s} className="text-center py-4">
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>Click Refresh to load database stats.</div>
            </div>
          )}

          {/* Storage gauge */}
          {dbStats && (() => {
            const usedMB = dbStats.totalBytes / 1_048_576;
            const pct = Math.min(100, (usedMB / dbLimitMB) * 100);
            const gaugeColor = pct < 60 ? "#39d353" : pct < 85 ? "#f59e0b" : "#ff2d55";
            return (
              <div style={s}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono font-bold text-xs" style={{ color: gaugeColor, letterSpacing: "0.1em" }}>
                    STORAGE — {pct.toFixed(1)}% USED
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: "#64748b" }}>Atlas limit (MB):</span>
                    <input type="number" min="1" value={dbLimitMB}
                      onChange={e => setDbLimitMB(Math.max(1, parseInt(e.target.value) || 512))}
                      className="font-mono text-xs px-2 py-1 rounded w-20 text-right"
                      style={{ background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e293b" }} />
                  </div>
                </div>
                {/* Bar */}
                <div className="rounded-full overflow-hidden" style={{ height: 14, background: "#0f172a", border: "1px solid #1e293b" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gaugeColor}88, ${gaugeColor})`, boxShadow: `0 0 10px ${gaugeColor}55` }} />
                </div>
                <div className="flex justify-between mt-1.5 font-mono text-xs">
                  <span style={{ color: gaugeColor }}>{usedMB.toFixed(3)} MB used</span>
                  <span style={{ color: "#475569" }}>{(dbLimitMB - usedMB).toFixed(1)} MB free / {dbLimitMB} MB limit</span>
                </div>
                {/* Sub-stats */}
                <div className="flex flex-wrap gap-6 mt-4 pt-3" style={{ borderTop: "1px solid #1e293b" }}>
                  {[
                    { label: "Data", val: (dbStats.dataBytes/1_048_576).toFixed(3) + " MB", color: "#39d353" },
                    { label: "Indexes", val: (dbStats.indexBytes/1_048_576).toFixed(3) + " MB", color: "#00d4ff" },
                    { label: "Storage (disk)", val: (dbStats.storageBytes/1_048_576).toFixed(3) + " MB", color: "#a855f7" },
                    { label: "Documents", val: dbStats.objects.toLocaleString(), color: "#f59e0b" },
                    { label: "Collections", val: String(dbStats.collections.length), color: "#64748b" },
                  ].map(f => (
                    <div key={f.label}>
                      <div className="font-mono" style={{ color: "#475569", fontSize: 10 }}>{f.label}</div>
                      <div className="font-mono text-xs font-bold mt-0.5" style={{ color: f.color }}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Smart cleanup result */}
          {smartCleanupResult && (
            <div style={{ ...s, borderColor: "#39d35340", background: "#0a150a" }}>
              <div className="font-mono font-bold text-xs mb-2" style={{ color: "#39d353" }}>
                ✓ CLEANUP — {smartCleanupResult.totalDeleted} documents removed
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(smartCleanupResult.breakdown).filter(([,v]) => v > 0).map(([k, v]) => (
                  <span key={k} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "#0d2010", color: "#39d353", border: "1px solid #39d35330" }}>
                    {k}: {v}
                  </span>
                ))}
                {Object.values(smartCleanupResult.breakdown).every(v => v === 0) && (
                  <span className="font-mono text-xs" style={{ color: "#64748b" }}>Nothing to clean — database is already lean.</span>
                )}
              </div>
            </div>
          )}

          {/* Collections table */}
          {dbStats && (
            <div style={s}>
              <div className="font-mono font-bold text-xs mb-3" style={{ color: "#e2e8f0", letterSpacing: "0.1em" }}>
                COLLECTIONS ({dbStats.collections.length}) — sorted by size
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e293b" }}>
                      {["Collection", "Docs", "Data", "Disk", "Indexes", ""].map(h => (
                        <th key={h} className="font-mono text-left px-2 py-2"
                          style={{ color: "#475569", fontWeight: "normal", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbStats.collections.map(c => {
                      const dataMB = c.dataBytes / 1_048_576;
                      const isLarge = dataMB > 5;
                      const dataLabel = dataMB >= 0.1
                        ? dataMB.toFixed(2) + " MB"
                        : (c.dataBytes / 1024).toFixed(1) + " KB";
                      return (
                        <tr key={c.name} style={{ borderBottom: "1px solid #0f172a" }}>
                          <td className="px-2 py-2 font-mono" style={{ color: c.protected ? "#475569" : "#e2e8f0", whiteSpace: "nowrap" }}>
                            {c.protected && <span className="mr-1" style={{ fontSize: 10 }}>🔒</span>}
                            {c.name}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ color: "#64748b" }}>
                            {c.docs.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ color: isLarge ? "#f59e0b" : "#64748b", whiteSpace: "nowrap" }}>
                            {dataLabel}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ color: "#334155", whiteSpace: "nowrap" }}>
                            {(c.storageBytes / 1024).toFixed(0)} KB
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ color: "#334155", whiteSpace: "nowrap" }}>
                            {(c.indexBytes / 1024).toFixed(0)} KB
                          </td>
                          <td className="px-2 py-2">
                            {!c.protected && (
                              <div className="flex gap-1">
                                <button onClick={() => setDbClearTarget(c.name)}
                                  className="font-mono px-2 py-1 rounded"
                                  style={{ color: "#f59e0b", border: "1px solid #f59e0b40", background: "#f59e0b08", fontSize: 10, whiteSpace: "nowrap" }}>
                                  Clear
                                </button>
                                <button onClick={() => { setDbDropTarget(c.name); setDbDropCode(""); }}
                                  className="font-mono px-2 py-1 rounded"
                                  style={{ color: "#ff2d55", border: "1px solid #ff2d5540", background: "#ff2d5508", fontSize: 10, whiteSpace: "nowrap" }}>
                                  ⚠ Drop
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Clear confirmation modal ── */}
          {dbClearTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.82)" }}
              onClick={e => { if (e.target === e.currentTarget) setDbClearTarget(null); }}>
              <div className="p-6 rounded-lg space-y-4" style={{ background: "#0d1117", border: "1px solid #f59e0b40", minWidth: 360, maxWidth: 480 }}>
                <div className="font-mono font-bold text-sm" style={{ color: "#f59e0b" }}>⚠ Clear Collection</div>
                <div className="font-mono text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                  All <strong style={{ color: "#e2e8f0" }}>{dbStats?.collections.find(c => c.name === dbClearTarget)?.docs.toLocaleString()}</strong> documents in{" "}
                  <strong style={{ color: "#e2e8f0" }}>{dbClearTarget}</strong> will be permanently deleted.
                  The collection structure and indexes are preserved.
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setDbClearTarget(null)}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{ color: "#64748b", border: "1px solid #1e293b" }}>Cancel</button>
                  <button onClick={() => clearCollection(dbClearTarget!)} disabled={dbActionLoading}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b60" }}>
                    {dbActionLoading ? "Clearing…" : "Confirm Clear"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Drop confirmation modal ── */}
          {dbDropTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.88)" }}
              onClick={e => { if (e.target === e.currentTarget) { setDbDropTarget(null); setDbDropCode(""); } }}>
              <div className="p-6 rounded-lg space-y-4" style={{ background: "#0d1117", border: "1px solid #ff2d5560", minWidth: 400, maxWidth: 500 }}>
                <div className="font-mono font-bold" style={{ color: "#ff2d55" }}>⚠ PERMANENT DROP</div>
                <div className="font-mono text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
                  Collection <strong style={{ color: "#ff2d55" }}>{dbDropTarget}</strong> and all{" "}
                  <strong style={{ color: "#ff2d55" }}>{dbStats?.collections.find(c => c.name === dbDropTarget)?.docs.toLocaleString()}</strong> documents will be
                  <strong style={{ color: "#ff2d55" }}> permanently destroyed</strong>. This cannot be undone.
                </div>
                <div>
                  <label className="font-mono text-xs" style={{ color: "#64748b" }}>Enter owner confirmation code:</label>
                  <input type="text" value={dbDropCode} onChange={e => setDbDropCode(e.target.value)}
                    placeholder="Enter code…" autoFocus
                    className="w-full font-mono text-xs px-3 py-2 rounded mt-1.5"
                    style={{ background: "#0a0a0f", color: "#e2e8f0", border: `1px solid ${dbDropCode === "Hayatulahi3222" ? "#39d35360" : "#ff2d5530"}`, outline: "none" }} />
                  {dbDropCode.length > 0 && dbDropCode !== "Hayatulahi3222" && (
                    <div className="font-mono mt-1" style={{ color: "#ff2d55", fontSize: 10 }}>Incorrect code</div>
                  )}
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => { setDbDropTarget(null); setDbDropCode(""); }}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{ color: "#64748b", border: "1px solid #1e293b" }}>Cancel</button>
                  <button
                    onClick={() => dropCollection(dbDropTarget!, dbDropCode)}
                    disabled={dbActionLoading || dbDropCode !== "Hayatulahi3222"}
                    className="font-mono text-xs px-4 py-2 rounded"
                    style={{
                      background: dbDropCode === "Hayatulahi3222" ? "#ff2d5518" : "#111",
                      color: dbDropCode === "Hayatulahi3222" ? "#ff2d55" : "#334155",
                      border: "1px solid #ff2d5540",
                      cursor: dbDropCode === "Hayatulahi3222" && !dbActionLoading ? "pointer" : "not-allowed",
                    }}>
                    {dbActionLoading ? "Dropping…" : "⚠ Drop Forever"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {massGrantConfirm && (
        <ConfirmDialog
          title="Broadcast to all players?"
          message={`Send DC:${Number(massDc) || 0} NC:${Number(massNc) || 0} Keys:${Number(massKeys) || 0} to ALL players? This cannot be undone.`}
          confirmLabel="Send to All"
          danger
          busy={massGranting}
          onConfirm={() => { setMassGrantConfirm(false); massGrant(); }}
          onCancel={() => setMassGrantConfirm(false)}
        />
      )}
    </div>
  );
}
