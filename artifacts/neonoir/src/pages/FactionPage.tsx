import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";
import { formatDC } from "../lib/format";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FactionMember {
  id:       string;
  username: string;
  level:    number;
  role:     "leader" | "co-leader" | "officer" | "member" | "recruit";
}

interface IFactionData {
  id:                 string;
  name:               string;
  tag:                string;
  description:        string;
  color:              string;
  emblem:             string;
  level:              number;
  xp:                 number;
  treasury:           number;
  respect:            number;
  isRecruiting:       boolean;
  maxMembers:         number;
  myRole:             "leader" | "co-leader" | "officer" | "member" | "recruit";
  memberCount:        number;
  pendingInviteCount: number;
  members:            FactionMember[];
}

interface IBoardFaction {
  id:           string;
  name:         string;
  tag:          string;
  color:        string;
  emblem:       string;
  level:        number;
  respect:      number;
  isRecruiting: boolean;
  memberCount:  number;
  maxMembers:   number;
  description:  string;
}

interface IStanding {
  rank:        number;
  id:          string;
  name:        string;
  tag:         string;
  color:       string;
  emblem:      string;
  level:       number;
  respect:     number;
  players:     number;
  totalWins:   number;
  totalCrimes: number;
  totalWealth: number;
  influence:   number;
}

interface IInvite {
  factionId:      string;
  factionName:    string;
  factionTag:     string;
  factionColor:   string;
  factionEmblem:  string;
  factionLevel:   number;
  factionRespect: number;
  invitedBy:      string;
  invitedAt:      string;
  note:           string;
}

interface INewsEntry {
  type:      string;
  message:   string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FACTION_CREATE_COST  = 10_000_000;
const FACTION_CREATE_LEVEL = 20;

const ALLOWED_COLORS = [
  "#00d4ff","#ff2d55","#f59e0b","#a855f7",
  "#39d353","#ff6b35","#e879f9","#22d3ee",
  "#64748b","#0ea5e9",
];

const ALLOWED_EMBLEMS = [
  "◆","◉","◈","⬡","▲","★","♦","✦",
  "◎","⬢","✺","⊕","⚔","🔥","⚡","💀",
  "🐍","🦅","🐉","🕷",
];

const NEWS_ICON: Record<string, string> = {
  join:                 "📥",
  leave:                "📤",
  kick:                 "🦵",
  promote:              "⬆️",
  demote:               "⬇️",
  donate:               "💰",
  withdraw:             "🏦",
  invite_accepted:      "📬",
  leadership_transfer:  "👑",
  founded:              "🔱",
  war:                  "⚔️",
  crime_success:        "✅",
  crime_failed:         "❌",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, accent = "#00d4ff", children,
}: { active: boolean; onClick: () => void; accent?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded font-mono text-xs font-bold transition-all"
      style={{
        background: active ? `${accent}20` : "#111118",
        color:      active ? accent : "#64748b",
        border:     `1px solid ${active ? `${accent}60` : "#1e1e2e"}`,
      }}
    >
      {children}
    </button>
  );
}

function RoleBadge({ role, color = "#00d4ff" }: { role: string; color?: string }) {
  const labels: Record<string, string> = {
    leader:      "👑 Leader",
    "co-leader": "⭐ Co-Leader",
    officer:     "🔰 Officer",
    member:      "⚡ Member",
    recruit:     "🔹 Recruit",
  };
  return (
    <span
      className="font-mono text-xs px-2 py-0.5 rounded"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {labels[role] ?? role}
    </span>
  );
}

function StatBox({ label, value, color = "#00d4ff" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded p-3 text-center" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
      <div className="font-mono font-bold text-lg" style={{ color }}>{value}</div>
      <div className="font-mono text-xs" style={{ color: "#64748b" }}>{label}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function FactionPage({
  user,
  addToast,
}: {
  user: User;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const qc = useQueryClient();

  // Tab state
  const [noFactionTab, setNoFactionTab] = useState<"browse" | "create" | "invites">("browse");
  const [factionTab,   setFactionTab]   = useState<"overview" | "members" | "news" | "standings">("overview");

  // Create form
  const [createName,   setCreateName]   = useState("");
  const [createTag,    setCreateTag]    = useState("");
  const [createDesc,   setCreateDesc]   = useState("");
  const [createColor,  setCreateColor]  = useState(ALLOWED_COLORS[0]);
  const [createEmblem, setCreateEmblem] = useState(ALLOWED_EMBLEMS[0]);

  // Donate / Withdraw
  const [donateAmount,   setDonateAmount]   = useState(100_000);
  const [withdrawAmount, setWithdrawAmount] = useState(100_000);
  const [showWithdraw,   setShowWithdraw]   = useState(false);

  // Settings
  const [settingsDesc,       setSettingsDesc]       = useState("");
  const [settingsRecruiting, setSettingsRecruiting] = useState(true);
  const [settingsReady,      setSettingsReady]      = useState(false);

  // Invite player (in members tab)
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteNote,     setInviteNote]     = useState("");

  // Leadership transfer
  const [showTransfer,     setShowTransfer]     = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: myFaction, isLoading: factionLoading } = useQuery<IFactionData | null>({
    queryKey: ["factions", "mine"],
    queryFn:  () => api.get<IFactionData>("/factions/mine").catch(() => null),
    staleTime: 10_000,
  });

  const { data: board = [], isLoading: boardLoading } = useQuery<IBoardFaction[]>({
    queryKey: ["factions", "list"],
    queryFn:  () => api.get<IBoardFaction[]>("/factions"),
    enabled:  !myFaction && noFactionTab === "browse",
    staleTime: 20_000,
  });

  const { data: invites = [], isLoading: invitesLoading } = useQuery<IInvite[]>({
    queryKey: ["factions", "invites"],
    queryFn:  () => api.get<IInvite[]>("/factions/invites"),
    enabled:  !myFaction,
    staleTime: 15_000,
  });

  const { data: news = [], isLoading: newsLoading } = useQuery<INewsEntry[]>({
    queryKey: ["factions", "news"],
    queryFn:  () => api.get<INewsEntry[]>("/factions/news"),
    enabled:  !!myFaction && factionTab === "news",
    staleTime: 10_000,
  });

  const { data: standings = [], isLoading: standingsLoading } = useQuery<IStanding[]>({
    queryKey: ["factions", "standings"],
    queryFn:  () => api.get<IStanding[]>("/factions/standings"),
    enabled:  !!myFaction && factionTab === "standings",
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createFaction = useMutation({
    mutationFn: () => api.post("/factions", {
      name: createName.trim(), tag: createTag.trim(),
      description: createDesc.trim(), color: createColor, emblem: createEmblem,
    }),
    onSuccess: () => { addToast("Faction founded!", "success"); qc.invalidateQueries({ queryKey: ["factions"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const joinFaction = useMutation({
    mutationFn: (id: string) => api.post(`/factions/${id}/join`, {}),
    onSuccess: () => { addToast("Joined faction as recruit!", "success"); qc.invalidateQueries({ queryKey: ["factions"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const leaveFaction = useMutation({
    mutationFn: () => api.post("/factions/leave", {}),
    onSuccess: () => { addToast("You left the faction", "info"); qc.invalidateQueries({ queryKey: ["factions"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const kickMember = useMutation({
    mutationFn: (targetId: string) => api.post("/factions/kick", { targetId }),
    onSuccess: () => { addToast("Member removed", "success"); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const promoteMember = useMutation({
    mutationFn: (targetId: string) => api.post("/factions/promote", { targetId }),
    onSuccess: () => { addToast("Member promoted", "success"); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const demoteMember = useMutation({
    mutationFn: (targetId: string) => api.post("/factions/demote", { targetId }),
    onSuccess: () => { addToast("Member demoted", "success"); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const donate = useMutation({
    mutationFn: () => api.post("/factions/treasury/donate", { amount: donateAmount }),
    onSuccess: () => { addToast(`Donated ${donateAmount.toLocaleString()} DC!`, "success"); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const withdraw = useMutation({
    mutationFn: () => api.post("/factions/treasury/withdraw", { amount: withdrawAmount }),
    onSuccess: (r: any) => {
      addToast(r.message ?? `Withdrew ${withdrawAmount.toLocaleString()} DC`, "success");
      setShowWithdraw(false);
      qc.invalidateQueries({ queryKey: ["factions", "mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const saveSettings = useMutation({
    mutationFn: () => api.patch("/factions/settings", { description: settingsDesc, isRecruiting: settingsRecruiting }),
    onSuccess: () => { addToast("Settings saved", "success"); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); setSettingsReady(false); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const sendInvite = useMutation({
    mutationFn: () => api.post("/factions/invite", { username: inviteUsername.trim(), note: inviteNote.trim() }),
    onSuccess: (r: any) => { addToast(r.message ?? "Invite sent!", "success"); setInviteUsername(""); setInviteNote(""); qc.invalidateQueries({ queryKey: ["factions", "mine"] }); },
    onError:   (e: Error) => addToast(e.message, "error"),
  });

  const respondInvite = useMutation({
    mutationFn: ({ factionId, accept }: { factionId: string; accept: boolean }) =>
      api.post("/factions/invite/respond", { factionId, accept }),
    onSuccess: (r: any, vars) => {
      addToast(r.message ?? (vars.accept ? "Joined faction!" : "Invite declined"), vars.accept ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["factions"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const transferLeadership = useMutation({
    mutationFn: () => api.post("/factions/transfer-leadership", { targetId: transferTargetId }),
    onSuccess: (r: any) => {
      addToast(r.message ?? "Leadership transferred", "success");
      setShowTransfer(false);
      qc.invalidateQueries({ queryKey: ["factions", "mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── No-faction views ──────────────────────────────────────────────────────────

  function renderBrowse() {
    if (boardLoading) return <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>Scanning faction networks...</div>;
    if (board.length === 0) return (
      <div className="rounded p-8 text-center font-mono text-sm" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}>
        No factions exist yet. Be the first to create one.
      </div>
    );
    return (
      <div className="space-y-3">
        {board.map(f => (
          <AnimatedCard key={f.id} accent={f.color} noPad>
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${f.color}18`, border: `1px solid ${f.color}40` }}>
                {f.emblem}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{f.name}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}40` }}>[{f.tag}]</span>
                  <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{f.level}</span>
                </div>
                <div className="flex gap-3 font-mono text-xs flex-wrap" style={{ color: "#64748b" }}>
                  <span>{f.memberCount}/{f.maxMembers} members</span>
                  <span style={{ color: "#a855f7" }}>{f.respect.toLocaleString()} respect</span>
                  {!f.isRecruiting && <span style={{ color: "#ff2d55" }}>Not recruiting</span>}
                </div>
                {f.description && <div className="font-mono text-xs mt-1 truncate" style={{ color: "#94a3b8" }}>{f.description}</div>}
              </div>
              <CyberButton
                variant="primary" size="sm"
                disabled={!f.isRecruiting || f.memberCount >= f.maxMembers || joinFaction.isPending}
                loading={joinFaction.isPending}
                onClick={() => joinFaction.mutate(f.id)}
              >
                Join
              </CyberButton>
            </div>
          </AnimatedCard>
        ))}
      </div>
    );
  }

  function renderCreate() {
    const canAfford  = user.dc >= FACTION_CREATE_COST;
    const meetsLevel = user.level >= FACTION_CREATE_LEVEL;
    const tagClean   = createTag.toUpperCase().slice(0, 5);
    return (
      <AnimatedCard accent="#a855f7">
        <CyberSectionHeader title="Found a Faction" accent="#a855f7" />
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded p-3 text-center" style={{ background: `${meetsLevel ? "#39d353" : "#ff2d55"}10`, border: `1px solid ${meetsLevel ? "#39d353" : "#ff2d55"}30` }}>
            <div className="font-mono text-sm font-bold" style={{ color: meetsLevel ? "#39d353" : "#ff2d55" }}>Lv.{user.level}/{FACTION_CREATE_LEVEL}</div>
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Level Required</div>
          </div>
          <div className="flex-1 rounded p-3 text-center" style={{ background: `${canAfford ? "#39d353" : "#ff2d55"}10`, border: `1px solid ${canAfford ? "#39d353" : "#ff2d55"}30` }}>
            <div className="font-mono text-sm font-bold" style={{ color: canAfford ? "#39d353" : "#ff2d55" }}>{formatDC(user.dc)} DC</div>
            <div className="font-mono text-xs" style={{ color: "#64748b" }}>Need 10M DC</div>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>Faction Name (3–30 chars)</label>
            <input type="text" maxLength={30} value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Iron Syndicate"
              className="w-full px-3 py-2 rounded font-mono text-sm" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
          </div>
          <div>
            <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>Tag (2–5 chars, shown in chat)</label>
            <input type="text" maxLength={5} value={createTag} onChange={e => setCreateTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="e.g. IRON"
              className="w-full px-3 py-2 rounded font-mono text-sm tracking-widest" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#a855f7", outline: "none" }} />
            <div className="font-mono text-xs mt-1" style={{ color: "#334155" }}>Preview: [{tagClean || "TAG"}]</div>
          </div>
          <div>
            <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>Description (optional, max 300)</label>
            <textarea maxLength={300} rows={2} value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What is your faction about?"
              className="w-full px-3 py-2 rounded font-mono text-xs resize-none" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
          </div>
          <div>
            <label className="font-mono text-xs mb-2 block" style={{ color: "#94a3b8" }}>Faction Color</label>
            <div className="flex gap-2 flex-wrap">
              {ALLOWED_COLORS.map(c => (
                <button key={c} onClick={() => setCreateColor(c)} className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, outline: createColor === c ? "3px solid #fff" : "none", outlineOffset: "2px", opacity: createColor === c ? 1 : 0.5 }} />
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-xs mb-2 block" style={{ color: "#94a3b8" }}>Faction Emblem</label>
            <div className="flex gap-2 flex-wrap">
              {ALLOWED_EMBLEMS.map(e => (
                <button key={e} onClick={() => setCreateEmblem(e)} className="w-9 h-9 rounded text-lg transition-all"
                  style={{ background: createEmblem === e ? `${createColor}30` : "#0a0a0f", border: `1px solid ${createEmblem === e ? createColor : "#1e1e2e"}` }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded p-3 flex items-center gap-3" style={{ background: `${createColor}10`, border: `1px solid ${createColor}30` }}>
            <span className="text-2xl">{createEmblem}</span>
            <div>
              <div className="font-mono font-bold text-sm" style={{ color: createColor }}>
                {createName.trim() || "Faction Name"}{" "}
                <span style={{ color: "#94a3b8" }}>[{tagClean || "TAG"}]</span>
              </div>
              <div className="font-mono text-xs" style={{ color: "#64748b" }}>Level 1 · 0 Respect · 1/50 Members</div>
            </div>
          </div>
          <CyberButton variant="primary" size="md" loading={createFaction.isPending}
            disabled={!canAfford || !meetsLevel || createName.trim().length < 3 || tagClean.length < 2}
            onClick={() => createFaction.mutate()}>
            Found Faction — {formatDC(FACTION_CREATE_COST)} DC
          </CyberButton>
          {!canAfford && <p className="font-mono text-xs" style={{ color: "#ff2d55" }}>Insufficient DC. You need {formatDC(FACTION_CREATE_COST - user.dc)} more.</p>}
        </div>
      </AnimatedCard>
    );
  }

  function renderInvites() {
    if (invitesLoading) return <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>Loading invites...</div>;
    if (invites.length === 0) return (
      <div className="rounded p-8 text-center font-mono text-sm" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}>
        No pending faction invites. Officers from open factions can invite you by username.
      </div>
    );
    return (
      <div className="space-y-3">
        <p className="font-mono text-xs" style={{ color: "#64748b" }}>
          Factions that have sent you an invite. Accepting will join you as a recruit.
        </p>
        {invites.map(inv => (
          <AnimatedCard key={inv.factionId} accent={inv.factionColor} noPad>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `${inv.factionColor}18`, border: `1px solid ${inv.factionColor}40` }}>
                  {inv.factionEmblem}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{inv.factionName}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: `${inv.factionColor}18`, color: inv.factionColor, border: `1px solid ${inv.factionColor}40` }}>[{inv.factionTag}]</span>
                  </div>
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Lv.{inv.factionLevel} · {inv.factionRespect.toLocaleString()} respect
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                    Invited by <span style={{ color: inv.factionColor }}>{inv.invitedBy}</span> · {timeAgo(inv.invitedAt)}
                  </div>
                  {inv.note && <div className="font-mono text-xs mt-1 italic" style={{ color: "#94a3b8" }}>"{inv.note}"</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <CyberButton variant="success" size="sm"
                  loading={respondInvite.isPending}
                  onClick={() => respondInvite.mutate({ factionId: inv.factionId, accept: true })}>
                  ✓ Accept
                </CyberButton>
                <CyberButton variant="danger" size="sm"
                  loading={respondInvite.isPending}
                  onClick={() => respondInvite.mutate({ factionId: inv.factionId, accept: false })}>
                  ✕ Decline
                </CyberButton>
              </div>
            </div>
          </AnimatedCard>
        ))}
      </div>
    );
  }

  // ── In-faction views ──────────────────────────────────────────────────────────

  function renderOverview(f: IFactionData) {
    const canWithdraw = ["leader","co-leader"].includes(f.myRole);
    return (
      <div className="space-y-4">
        {/* Faction header */}
        <div className="rounded-lg p-4" style={{ background: `${f.color}10`, border: `2px solid ${f.color}40` }}>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `${f.color}18`, border: `1px solid ${f.color}50` }}>
              {f.emblem}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-black text-xl" style={{ color: f.color }}>{f.name}</h2>
                <span className="font-mono text-sm px-2 py-0.5 rounded" style={{ background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}40` }}>
                  [{f.tag}]
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <RoleBadge role={f.myRole} color={f.color} />
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{f.level} Faction</span>
                {!f.isRecruiting && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "#ff2d5510", color: "#ff2d55", border: "1px solid #ff2d5530" }}>
                    Closed
                  </span>
                )}
              </div>
            </div>
          </div>
          {f.description && <p className="font-mono text-xs" style={{ color: "#94a3b8" }}>{f.description}</p>}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Members"  value={`${f.memberCount}/${f.maxMembers}`} color={f.color} />
          <StatBox label="Respect"  value={f.respect.toLocaleString()}          color="#a855f7" />
          <StatBox label="Treasury" value={`${formatDC(f.treasury)} DC`}        color="#f59e0b" />
          <StatBox label="Level"    value={f.level}                              color="#39d353" />
        </div>

        {/* XP bar */}
        {f.level < 100 && (
          <div>
            <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#64748b" }}>
              <span>Faction XP</span>
              <span>{f.xp} / {f.level * 1_000}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (f.xp / (f.level * 1_000)) * 100)}%`, background: f.color }} />
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
              Donate DC to earn faction XP and level up (unlocks more member slots)
            </div>
          </div>
        )}

        {/* Treasury — donate */}
        <AnimatedCard accent="#f59e0b">
          <CyberSectionHeader title="Treasury" accent="#f59e0b" />
          <div className="space-y-3">
            {/* Donate */}
            <div>
              <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>Donate DC</label>
              <div className="flex gap-2">
                <input type="number" min={1000} step={1000} value={donateAmount}
                  onChange={e => setDonateAmount(Math.max(1_000, Number(e.target.value)))}
                  className="flex-1 px-3 py-2 rounded font-mono text-sm"
                  style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#f59e0b", outline: "none" }} />
                <CyberButton variant="warning" size="sm" loading={donate.isPending}
                  disabled={user.dc < donateAmount || donateAmount < 1_000}
                  onClick={() => donate.mutate()}>
                  Donate
                </CyberButton>
              </div>
              <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                Your balance: {formatDC(user.dc)} DC · Each 10,000 DC = 1 faction XP
              </p>
            </div>

            {/* Withdraw — leaders/co-leaders only */}
            {canWithdraw && (
              <div className="border-t pt-3" style={{ borderColor: "#1e1e2e" }}>
                {!showWithdraw ? (
                  <CyberButton variant="warning" size="sm" onClick={() => setShowWithdraw(true)}>
                    🏦 Withdraw from Treasury
                  </CyberButton>
                ) : (
                  <div className="space-y-2">
                    <label className="font-mono text-xs block" style={{ color: "#94a3b8" }}>Withdraw DC (min 1,000)</label>
                    <div className="flex gap-2">
                      <input type="number" min={1000} step={1000} value={withdrawAmount}
                        onChange={e => setWithdrawAmount(Math.max(1_000, Number(e.target.value)))}
                        className="flex-1 px-3 py-2 rounded font-mono text-sm"
                        style={{ background: "#0a0a0f", border: "1px solid #ff2d5550", color: "#ff2d55", outline: "none" }} />
                      <CyberButton variant="danger" size="sm" loading={withdraw.isPending}
                        disabled={f.treasury < withdrawAmount || withdrawAmount < 1_000}
                        onClick={() => withdraw.mutate()}>
                        Withdraw
                      </CyberButton>
                      <CyberButton variant="ghost" size="sm" onClick={() => setShowWithdraw(false)}>Cancel</CyberButton>
                    </div>
                    <p className="font-mono text-xs" style={{ color: "#64748b" }}>Treasury: {formatDC(f.treasury)} DC available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </AnimatedCard>

        {/* Leader settings */}
        {f.myRole === "leader" && (
          <AnimatedCard accent="#ff6b35">
            <CyberSectionHeader title="Faction Settings" accent="#ff6b35" />
            {!settingsReady && (
              <CyberButton variant="warning" size="sm" onClick={() => {
                setSettingsDesc(f.description);
                setSettingsRecruiting(f.isRecruiting);
                setSettingsReady(true);
              }}>
                Edit Settings
              </CyberButton>
            )}
            {settingsReady && (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-xs mb-1 block" style={{ color: "#94a3b8" }}>Description</label>
                  <textarea maxLength={300} rows={2} value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded font-mono text-xs resize-none"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>Open for Recruits</span>
                  <button onClick={() => setSettingsRecruiting(v => !v)} className="w-12 h-6 rounded-full relative"
                    style={{ background: settingsRecruiting ? "#39d353" : "#1e1e2e", border: `1px solid ${settingsRecruiting ? "#39d353" : "#334155"}` }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                      style={{ background: "#e2e8f0", left: settingsRecruiting ? "calc(100% - 22px)" : "2px" }} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <CyberButton variant="warning" size="sm" loading={saveSettings.isPending} onClick={() => saveSettings.mutate()}>Save</CyberButton>
                  <CyberButton variant="ghost" size="sm" onClick={() => setSettingsReady(false)}>Cancel</CyberButton>
                </div>
              </div>
            )}

            {/* Leadership transfer */}
            <div className="border-t mt-4 pt-4" style={{ borderColor: "#1e1e2e" }}>
              <div className="font-mono text-xs font-bold mb-2" style={{ color: "#ff6b35" }}>Transfer Leadership</div>
              {!showTransfer ? (
                <CyberButton variant="danger" size="sm" onClick={() => setShowTransfer(true)}>
                  👑 Transfer Leadership
                </CyberButton>
              ) : (
                <div className="space-y-2">
                  <p className="font-mono text-xs" style={{ color: "#64748b" }}>
                    Select a faction member to transfer leadership to. You will become co-leader.
                  </p>
                  <select value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded font-mono text-sm"
                    style={{ background: "#0a0a0f", border: "1px solid #ff2d5550", color: "#e2e8f0", outline: "none" }}>
                    <option value="">— Select member —</option>
                    {f.members.filter(m => m.id !== user.id).map(m => (
                      <option key={m.id} value={m.id}>{m.username} ({m.role})</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <CyberButton variant="danger" size="sm" loading={transferLeadership.isPending}
                      disabled={!transferTargetId}
                      onClick={() => {
                        if (window.confirm("Transfer leadership? This cannot be undone without the new leader's cooperation.")) {
                          transferLeadership.mutate();
                        }
                      }}>
                      Confirm Transfer
                    </CyberButton>
                    <CyberButton variant="ghost" size="sm" onClick={() => { setShowTransfer(false); setTransferTargetId(""); }}>Cancel</CyberButton>
                  </div>
                </div>
              )}
            </div>
          </AnimatedCard>
        )}

        {/* Leave */}
        <div className="pt-2">
          <CyberButton variant="danger" size="sm" loading={leaveFaction.isPending}
            onClick={() => {
              if (window.confirm(f.myRole === "leader"
                ? "As leader, the faction will be DISSOLVED if you leave and no other members exist. Continue?"
                : "Are you sure you want to leave this faction?")) {
                leaveFaction.mutate();
              }
            }}>
            Leave Faction
          </CyberButton>
        </div>
      </div>
    );
  }

  function renderMembers(f: IFactionData) {
    const myRole   = f.myRole;
    const canManage = ["leader","co-leader","officer"].includes(myRole);
    const canInvite = canManage;

    const grouped: Record<string, FactionMember[]> = {
      leader:      f.members.filter(m => m.role === "leader"),
      "co-leader": f.members.filter(m => m.role === "co-leader"),
      officer:     f.members.filter(m => m.role === "officer"),
      member:      f.members.filter(m => m.role === "member"),
      recruit:     f.members.filter(m => m.role === "recruit"),
    };
    const roleOrder: Array<"leader"|"co-leader"|"officer"|"member"|"recruit"> =
      ["leader","co-leader","officer","member","recruit"];

    return (
      <div className="space-y-4">
        <div className="font-mono text-xs" style={{ color: "#64748b" }}>
          {f.memberCount}/{f.maxMembers} members · Donate DC to unlock more slots
          {f.pendingInviteCount > 0 && <span style={{ color: "#f59e0b" }}> · {f.pendingInviteCount} pending invite(s) sent</span>}
        </div>

        {roleOrder.map(role => {
          const group = grouped[role];
          if (!group?.length) return null;
          return (
            <div key={role}>
              <div className="font-mono text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: "#334155" }}>
                {role.replace("-", " ")}s ({group.length})
              </div>
              <div className="space-y-2">
                {group.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded"
                    style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>{m.username}</span>
                        <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{m.level}</span>
                        <RoleBadge role={m.role} color={f.color} />
                      </div>
                    </div>
                    {canManage && m.id !== user.id && m.role !== "leader" && (
                      <div className="flex gap-1">
                        {(myRole === "leader" || (myRole === "co-leader" && m.role !== "co-leader")) && (
                          <button className="font-mono text-xs px-2 py-1 rounded transition-all"
                            style={{ background: "#39d35318", color: "#39d353", border: "1px solid #39d35340" }}
                            onClick={() => promoteMember.mutate(m.id)} disabled={promoteMember.isPending} title="Promote">▲</button>
                        )}
                        {myRole === "leader" && (
                          <button className="font-mono text-xs px-2 py-1 rounded transition-all"
                            style={{ background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b40" }}
                            onClick={() => demoteMember.mutate(m.id)} disabled={demoteMember.isPending} title="Demote">▼</button>
                        )}
                        <button className="font-mono text-xs px-2 py-1 rounded transition-all"
                          style={{ background: "#ff2d5518", color: "#ff2d55", border: "1px solid #ff2d5540" }}
                          onClick={() => { if (window.confirm(`Remove ${m.username}?`)) kickMember.mutate(m.id); }}
                          disabled={kickMember.isPending} title="Remove">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Invite player (officers+) */}
        {canInvite && (
          <AnimatedCard accent="#00d4ff">
            <CyberSectionHeader title="Invite Player" accent="#00d4ff" />
            <p className="font-mono text-xs mb-3" style={{ color: "#64748b" }}>
              Send a direct faction invite to any player not currently in a faction.
            </p>
            <div className="space-y-2">
              <input type="text" value={inviteUsername} onChange={e => setInviteUsername(e.target.value)}
                placeholder="Player username (exact)"
                className="w-full px-3 py-2 rounded font-mono text-sm"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }} />
              <input type="text" value={inviteNote} onChange={e => setInviteNote(e.target.value.slice(0, 200))}
                placeholder="Optional message (max 200 chars)"
                className="w-full px-3 py-2 rounded font-mono text-xs"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#94a3b8", outline: "none" }} />
              <CyberButton variant="primary" size="sm" loading={sendInvite.isPending}
                disabled={!inviteUsername.trim()}
                onClick={() => sendInvite.mutate()}>
                📬 Send Invite
              </CyberButton>
            </div>
          </AnimatedCard>
        )}
      </div>
    );
  }

  function renderNews() {
    if (newsLoading) return <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>Loading activity log...</div>;
    if (news.length === 0) return (
      <div className="rounded p-6 text-center font-mono text-sm" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}>
        No faction activity yet. Events like joins, promotions, and donations appear here.
      </div>
    );
    return (
      <div className="space-y-2">
        {news.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2 rounded"
            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
            <span className="text-base flex-shrink-0 mt-0.5">{NEWS_ICON[entry.type] ?? "📋"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>{entry.message}</div>
              <div className="font-mono text-xs mt-0.5" style={{ color: "#334155" }}>{timeAgo(entry.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderStandings() {
    if (standingsLoading) return <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>Calculating faction power...</div>;
    if (standings.length === 0) return (
      <div className="rounded p-6 text-center font-mono text-sm" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#334155" }}>
        No faction standings yet.
      </div>
    );
    return (
      <div className="space-y-2">
        {standings.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-3 py-3 rounded"
            style={{
              background: myFaction?.id === s.id ? `${s.color}10` : "#0a0a0f",
              border:     `1px solid ${myFaction?.id === s.id ? s.color + "50" : "#1e1e2e"}`,
            }}>
            <div className="font-mono font-black text-lg w-8 text-center"
              style={{ color: s.rank <= 3 ? ["#f59e0b","#94a3b8","#c87941"][s.rank - 1] : "#334155" }}>
              #{s.rank}
            </div>
            <div className="w-8 h-8 rounded flex items-center justify-center text-base flex-shrink-0" style={{ background: `${s.color}18` }}>
              {s.emblem}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{s.name}</span>
                <span className="font-mono text-xs" style={{ color: s.color }}>[{s.tag}]</span>
                <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{s.level}</span>
              </div>
              <div className="flex gap-3 font-mono text-xs flex-wrap" style={{ color: "#64748b" }}>
                <span>{s.players} members</span>
                <span style={{ color: "#a855f7" }}>{s.influence.toLocaleString()} influence</span>
                <span>{s.totalWins.toLocaleString()} wins</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Root render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      {/* Page header */}
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <CyberSectionHeader
          title="Factions"
          accent="#a855f7"
          size="lg"
          right={
            myFaction ? (
              <span className="font-mono text-xs px-2 py-1 rounded"
                style={{ background: `${myFaction.color}18`, color: myFaction.color, border: `1px solid ${myFaction.color}40` }}>
                {myFaction.emblem} [{myFaction.tag}]
              </span>
            ) : undefined
          }
        />
        <p className="font-mono text-xs" style={{ color: "#64748b" }}>
          {myFaction
            ? "Manage your faction, invite players, and compete for dominance."
            : "Player-created factions competing for power across New Vanta. Found one for 10M DC."}
        </p>
      </div>

      {factionLoading ? (
        <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>Accessing faction networks...</div>
      ) : !myFaction ? (
        <>
          <div className="flex gap-2 flex-wrap">
            <TabBtn active={noFactionTab === "browse"}  onClick={() => setNoFactionTab("browse")}  accent="#00d4ff">🌐 Browse</TabBtn>
            <TabBtn active={noFactionTab === "create"}  onClick={() => setNoFactionTab("create")}  accent="#a855f7">⚡ Found</TabBtn>
            <TabBtn active={noFactionTab === "invites"} onClick={() => setNoFactionTab("invites")} accent="#f59e0b">
              📬 Invites {invites.length > 0 ? `(${invites.length})` : ""}
            </TabBtn>
          </div>
          {noFactionTab === "browse"  && renderBrowse()}
          {noFactionTab === "create"  && renderCreate()}
          {noFactionTab === "invites" && renderInvites()}
        </>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <TabBtn active={factionTab === "overview"}  onClick={() => setFactionTab("overview")}  accent={myFaction.color}>📊 Overview</TabBtn>
            <TabBtn active={factionTab === "members"}   onClick={() => setFactionTab("members")}   accent={myFaction.color}>👥 Members ({myFaction.memberCount})</TabBtn>
            <TabBtn active={factionTab === "news"}      onClick={() => setFactionTab("news")}      accent="#00d4ff">📰 News</TabBtn>
            <TabBtn active={factionTab === "standings"} onClick={() => setFactionTab("standings")} accent="#a855f7">🏆 Standings</TabBtn>
          </div>
          {factionTab === "overview"  && renderOverview(myFaction)}
          {factionTab === "members"   && renderMembers(myFaction)}
          {factionTab === "news"      && renderNews()}
          {factionTab === "standings" && renderStandings()}
        </>
      )}
    </div>
  );
}
