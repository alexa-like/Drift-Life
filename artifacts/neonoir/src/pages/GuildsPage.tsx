import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CyberButton } from "../components/CyberButton";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";
import { formatDC } from "../lib/format";

interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  description: string;
  faction: string | null;
  level: number;
  treasury: number;
  memberCount: number;
  maxMembers: number;
}

interface MyGuild {
  id: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  xp: number;
  treasury: number;
  maxMembers: number;
  myRole: string;
  members: Array<{ id: string; username: string; level: number; avatar: string; role: string }>;
}

interface GangCrime {
  id: string;
  crimeType: string;
  status: "gathering" | "in_progress" | "completed" | "failed";
  participants: number;
  maxParticipants: number;
  minParticipants: number;
  isParticipant: boolean;
  completedAt: string | null;
  payout: number | null;
  createdAt: string;
}

interface IGangUpgradeDef {
  id: string;
  name: string;
  category: string;
  tier: number;
  description: string;
  effect: string;
  requiredLevel: number;
  cost: number;
}

interface GangUpgradesData {
  catalog: IGangUpgradeDef[];
  purchased: string[];
  treasury: number;
}

interface WarContribution {
  userId: string;
  username: string;
  guildId: string;
  points: number;
}

interface GangWar {
  id: string;
  attackerGuildId: string;
  defenderGuildId: string;
  attackerGuildName: string;
  defenderGuildName: string;
  attackerPoints: number;
  defenderPoints: number;
  status: "pending" | "active" | "completed";
  endsAt: string | null;
  winnerId: string | null;
  isAttacker: boolean;
  contributions?: WarContribution[];
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const ROLE_COLORS: Record<string, string> = {
  leader:  "#f59e0b",
  officer: "#00d4ff",
  member:  "#94a3b8",
  recruit: "#64748b",
};

const INPUT = {
  background: "#0a0a0f", color: "#e2e8f0", border: "1px solid #1e1e2e",
  outline: "none", borderRadius: 6, padding: "8px 12px",
  width: "100%", boxSizing: "border-box" as const, fontFamily: "monospace", fontSize: 13,
};

const STATUS_COLORS: Record<string, string> = {
  gathering:   "#f59e0b",
  in_progress: "#00d4ff",
  completed:   "#39d353",
  failed:      "#ff2d55",
};

const TIER_COLORS: Record<number, string> = {
  1: "#39d353",
  2: "#00d4ff",
  3: "#a855f7",
};

const CRIME_TYPES = [
  { type: "armored_car_heist",      label: "Armored Car Heist",     members: "2–3", duration: "30min", payout: "15k–40k DC" },
  { type: "corporate_data_breach",  label: "Corporate Data Breach", members: "2–4", duration: "45min", payout: "20k–60k DC" },
  { type: "district_shakedown",     label: "District Shakedown",    members: "3–5", duration: "60min", payout: "30k–80k DC" },
  { type: "black_site_raid",        label: "Black Site Raid",       members: "4–5", duration: "90min", payout: "50k–150k DC" },
];

const UPGRADE_CATEGORIES = ["crime", "combat", "economy", "capacity", "social"];

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!targetIso) return;
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

function formatMs(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function CrimeCard({
  crime,
  onJoin,
  onCommit,
  onResolve,
  isLeaderOrOfficer,
}: {
  crime: GangCrime;
  onJoin: (id: string) => void;
  onCommit: (id: string) => void;
  onResolve: (id: string) => void;
  isLeaderOrOfficer: boolean;
}) {
  const remaining = useCountdown(crime.status === "in_progress" ? crime.completedAt : null);
  const statusColor = STATUS_COLORS[crime.status] ?? "#94a3b8";

  return (
    <AnimatedCard accent={statusColor}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>
              {crime.crimeType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span
              className="font-mono text-xs px-1.5 py-0.5 rounded"
              style={{ background: `${statusColor}22`, color: statusColor }}
            >
              {crime.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
            {crime.participants}/{crime.maxParticipants} operators
          </div>
          {crime.status === "in_progress" && crime.completedAt && (
            <div className="font-mono text-xs mt-1" style={{ color: "#00d4ff" }}>
              {remaining > 0 ? `Time remaining: ${formatMs(remaining)}` : "Ready to resolve"}
            </div>
          )}
          {crime.status === "completed" && crime.payout != null && (
            <div className="font-mono text-xs mt-1" style={{ color: "#39d353" }}>
              Payout: {formatDC(crime.payout)} DC
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {crime.status === "gathering" && !crime.isParticipant && (
            <CyberButton size="sm" variant="primary" onClick={() => onJoin(crime.id)}>
              Join
            </CyberButton>
          )}
          {crime.status === "gathering" && crime.isParticipant && (isLeaderOrOfficer) && (
            <CyberButton size="sm" variant="purple" onClick={() => onCommit(crime.id)}>
              Commit
            </CyberButton>
          )}
          {crime.status === "in_progress" && remaining === 0 && isLeaderOrOfficer && (
            <CyberButton size="sm" variant="warning" onClick={() => onResolve(crime.id)}>
              Resolve
            </CyberButton>
          )}
        </div>
      </div>
    </AnimatedCard>
  );
}

function WarCountdown({ endsAt }: { endsAt: string | null }) {
  const remaining = useCountdown(endsAt);
  if (!endsAt) return null;
  return (
    <span className="font-mono text-xs" style={{ color: "#00d4ff" }}>
      {remaining > 0 ? formatMs(remaining) : "Ended"}
    </span>
  );
}

export function GuildsPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"mine" | "browse" | "create" | "turf" | "bank" | "crimes" | "upgrades" | "wars">("mine");
  const [createForm,       setCreateForm]       = useState({ name: "", tag: "", description: "" });
  const [donateAmount,     setDonateAmount]     = useState("");
  const [turfRacing,       setTurfRacing]       = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [bankDeposit,      setBankDeposit]      = useState("");
  const [bankWithdraw,     setBankWithdraw]     = useState("");
  const [warSearch,        setWarSearch]        = useState("");
  const [selectedWarTarget, setSelectedWarTarget] = useState<GuildSummary | null>(null);

  const { data: myGuild, isLoading: myGuildLoading } = useQuery<MyGuild | null>({
    queryKey: ["guild-mine"],
    queryFn:  () => api.get("/guilds/mine"),
  });

  const { data: allGuilds = [], isLoading: guildsLoading } = useQuery<GuildSummary[]>({
    queryKey: ["guilds"],
    queryFn:  () => api.get("/guilds"),
    enabled:  tab === "browse" || tab === "wars",
  });

  const createGuild = useMutation({
    mutationFn: (body: typeof createForm) => api.post("/guilds", body),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
      setTab("mine");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const joinGuild = useMutation({
    mutationFn: (id: string) => api.post(`/guilds/${id}/join`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine", "guilds"] });
      setTab("mine");
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const leaveGuild = useMutation({
    mutationFn: () => api.post("/guilds/leave", {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const donate = useMutation({
    mutationFn: (amount: number) => api.post("/guilds/treasury/donate", { amount }),
    onSuccess: (r: { message: string; treasury: number; guildLevel: number; leveledUp: boolean }) => {
      addToast(r.message + (r.leveledUp ? " Guild leveled up!" : ""), "success");
      setDonateAmount("");
      qc.invalidateQueries({ queryKey: ["guild-mine"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  interface BankData {
    bankBalance: number;
    activePerks: Array<{ perkId: string; expiresAt: string }>;
    availablePerks: Array<{ id: string; name: string; cost: number; description: string }>;
    logs: Array<{ id: string; username: string; amount: number; type: string; createdAt: string }>;
  }

  const { data: bankData, refetch: refetchBank } = useQuery<BankData | null>({
    queryKey: ["guild-bank"],
    queryFn: () => api.get("/faction/bank"),
    enabled: tab === "bank" && !!myGuild,
  });

  const depositMut = useMutation({
    mutationFn: (amount: number) => api.post("/faction/bank/deposit", { amount }),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); setBankDeposit(""); refetchBank(); qc.invalidateQueries({ queryKey: ["guild-mine"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const withdrawMut = useMutation({
    mutationFn: (amount: number) => api.post("/faction/bank/withdraw", { amount }),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); setBankWithdraw(""); refetchBank(); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const perkMut = useMutation({
    mutationFn: (perkId: string) => api.post("/faction/perks/buy", { perkId }),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); refetchBank(); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const { data: turfData } = useQuery<{
    districts: Array<{ id: string; name: string; tier: number; raceCost: number; income: number; controlling: { guildName: string; guildTag: string } | null }>;
    leaderboard: Array<{ name: string; tag: string; points: number; districts: string[] }>;
  }>({
    queryKey: ["guilds-turf"],
    queryFn:  () => api.get("/guilds/turf"),
    enabled:  tab === "turf",
  });

  const turfRace = useMutation({
    mutationFn: (districtId: string) => api.post(`/guilds/turf/race/${districtId}`, {}),
    onSuccess: (r: any) => {
      addToast(r.message, r.won ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["guilds-turf", "guild-mine"] });
      setTurfRacing(null);
    },
    onError: (e: Error) => { addToast(e.message, "error"); setTurfRacing(null); },
  });

  // ── CRIMES ──────────────────────────────────────────────────────────────────
  const { data: crimesData = [], isLoading: crimesLoading } = useQuery<GangCrime[]>({
    queryKey: ["gang-crimes"],
    queryFn:  () => api.get("/gang-crimes"),
    enabled:  tab === "crimes" && !!myGuild,
    refetchInterval: 5000,
  });

  const joinCrime = useMutation({
    mutationFn: (id: string) => api.post(`/gang-crimes/${id}/join`, {}),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-crimes"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const commitCrime = useMutation({
    mutationFn: (id: string) => api.post(`/gang-crimes/${id}/commit`, {}),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-crimes"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const resolveCrime = useMutation({
    mutationFn: (id: string) => api.post(`/gang-crimes/${id}/resolve`, {}),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-crimes", "guild-mine"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const startCrime = useMutation({
    mutationFn: (crimeType: string) => api.post("/gang-crimes/start", { crimeType }),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-crimes"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── UPGRADES ─────────────────────────────────────────────────────────────────
  const { data: upgradesData, isLoading: upgradesLoading } = useQuery<GangUpgradesData>({
    queryKey: ["gang-upgrades"],
    queryFn:  () => api.get("/gang-upgrades"),
    enabled:  tab === "upgrades" && !!myGuild,
  });

  const buyUpgrade = useMutation({
    mutationFn: (upgradeId: string) => api.post("/gang-upgrades/buy", { upgradeId }),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-upgrades", "guild-mine"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  // ── WARS ──────────────────────────────────────────────────────────────────────
  const { data: warsData = [], isLoading: warsLoading } = useQuery<GangWar[]>({
    queryKey: ["gang-wars"],
    queryFn:  () => api.get("/gang-wars"),
    enabled:  tab === "wars" && !!myGuild,
    refetchInterval: 10000,
  });

  const acceptWar = useMutation({
    mutationFn: (id: string) => api.post(`/gang-wars/${id}/accept`, {}),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-wars"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const declineWar = useMutation({
    mutationFn: (id: string) => api.post(`/gang-wars/${id}/decline`, {}),
    onSuccess: (r: { message: string }) => { addToast(r.message, "success"); qc.invalidateQueries({ queryKey: ["gang-wars"] }); },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const declareWar = useMutation({
    mutationFn: (targetGuildId: string) => api.post("/gang-wars/declare", { targetGuildId }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["gang-wars"] });
      setWarSearch("");
      setSelectedWarTarget(null);
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const isLeaderOrOfficer = myGuild?.myRole === "leader" || myGuild?.myRole === "officer";

  // filtered guilds for war declare
  const warSearchResults = warSearch.trim().length >= 2
    ? allGuilds.filter(g =>
        g.id !== user.guildId &&
        (g.name.toLowerCase().includes(warSearch.toLowerCase()) ||
         g.tag.toLowerCase().includes(warSearch.toLowerCase()))
      ).slice(0, 5)
    : [];

  const activeWar = warsData.find(w => w.status === "active");
  const pendingInvites = warsData.filter(w => w.status === "pending" && !w.isAttacker);
  const completedWars = warsData.filter(w => w.status === "completed").slice(0, 5);

  // Build tab list
  const baseTabs: Array<"mine" | "browse" | "create" | "turf" | "bank"> = myGuild
    ? ["mine", "browse", "turf", "bank"]
    : ["mine", "browse", "create", "turf"];

  const extraTabs: Array<"crimes" | "upgrades" | "wars"> = myGuild
    ? ["crimes", "upgrades", "wars"]
    : [];

  const allTabs = [...baseTabs, ...extraTabs];

  const TAB_LABELS: Record<string, string> = {
    mine:     "My Guild",
    browse:   "Browse",
    create:   "Create",
    turf:     "Turf",
    bank:     "Bank",
    crimes:   "Crimes",
    upgrades: "Upgrades",
    wars:     "Wars",
  };

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <AnimatedCard accent="#a855f7">
        <CyberSectionHeader title="GUILDS" accent="#a855f7" cursor />
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Form crews, build a treasury, and claim territory across New Vanta. Level 15 required to create.
        </p>
      </AnimatedCard>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {allTabs.map(t => (
          <CyberButton
            key={t}
            size="sm"
            variant={tab === t ? "purple" : "ghost"}
            glow={tab === t}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </CyberButton>
        ))}
      </div>

      {/* MY GUILD */}
      {tab === "mine" && (
        myGuildLoading ? (
          <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading...</div>
        ) : myGuild ? (
          <div className="space-y-4">
            <AnimatedCard accent="#a855f7">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-mono font-bold text-xl" style={{ color: "#a855f7" }}>
                    [{myGuild.tag}] {myGuild.name}
                  </div>
                  <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                    {myGuild.description || "No description."}
                  </div>
                  <div className="flex gap-4 mt-2 flex-wrap">
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>Level {myGuild.level}</span>
                    <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{myGuild.members.length}/{myGuild.maxMembers} members</span>
                    <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>{myGuild.treasury.toLocaleString()} DC treasury</span>
                    <span className="font-mono text-xs" style={{ color: ROLE_COLORS[myGuild.myRole] }}>Role: {myGuild.myRole}</span>
                  </div>
                </div>
                {!showLeaveConfirm ? (
                  <CyberButton variant="danger" size="sm" onClick={() => setShowLeaveConfirm(true)}>
                    Leave
                  </CyberButton>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-xs" style={{ color: "#ff6b35" }}>Leave guild?</span>
                    <CyberButton variant="danger" size="sm" loading={leaveGuild.isPending}
                      onClick={() => { leaveGuild.mutate(); setShowLeaveConfirm(false); }}>Yes</CyberButton>
                    <CyberButton variant="ghost" size="sm" onClick={() => setShowLeaveConfirm(false)}>No</CyberButton>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>Donate to treasury</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={donateAmount}
                    onChange={e => setDonateAmount(e.target.value)}
                    placeholder="Amount DC"
                    className="font-mono text-xs flex-1"
                    style={INPUT}
                  />
                  <CyberButton
                    variant="purple"
                    size="sm"
                    loading={donate.isPending}
                    disabled={!donateAmount}
                    onClick={() => donate.mutate(parseInt(donateAmount))}
                  >
                    Donate
                  </CyberButton>
                </div>
              </div>
            </AnimatedCard>

            {/* ⚔️ Active War Banner */}
            {activeWar && (
              <AnimatedCard accent="#ff2d55">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff2d5533", color: "#ff2d55" }}>⚔ AT WAR</span>
                  <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                    vs {activeWar.isAttacker ? activeWar.defenderGuildName : activeWar.attackerGuildName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold" style={{ color: "#00d4ff" }}>
                      {activeWar.isAttacker ? activeWar.attackerPoints : activeWar.defenderPoints}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>Your side</div>
                  </div>
                  <div>
                    {(() => {
                      const myPts = activeWar.isAttacker ? activeWar.attackerPoints : activeWar.defenderPoints;
                      const theirPts = activeWar.isAttacker ? activeWar.defenderPoints : activeWar.attackerPoints;
                      const total = myPts + theirPts || 1;
                      const myPct = Math.round((myPts / total) * 100);
                      return (
                        <div style={{ width: 120, height: 6, background: "#ff2d5533", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${myPct}%`, height: "100%", background: "#00d4ff", borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-2xl font-bold" style={{ color: "#ff2d55" }}>
                      {activeWar.isAttacker ? activeWar.defenderPoints : activeWar.attackerPoints}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>Enemy</div>
                  </div>
                </div>
                {activeWar.endsAt && (
                  <div className="font-mono text-xs text-center" style={{ color: "#64748b" }}>
                    <WarCountdown endsAt={activeWar.endsAt} />
                  </div>
                )}
                <div className="font-mono text-xs mt-2" style={{ color: "#475569" }}>
                  Earn points: Arena wins vs enemy (200 pts) · Crimes in their turf (50 pts) · Any crime (20 pts)
                </div>
              </AnimatedCard>
            )}

            <AnimatedCard>
              <CyberSectionHeader title="MEMBERS" accent="#64748b" size="sm" />
              <div className="space-y-2">
                {myGuild.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1.5" style={{ borderTop: "1px solid #1e1e2e08" }}>
                    <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>{m.username}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{m.level}</span>
                      <span className="font-mono text-xs" style={{ color: ROLE_COLORS[m.role] }}>{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>
        ) : (
          <AnimatedCard className="text-center py-8">
            <div className="font-mono text-sm mb-2" style={{ color: "#64748b" }}>You are not in a guild.</div>
            <div className="font-mono text-xs mb-4" style={{ color: "#334155" }}>
              Browse existing guilds or create your own (Level 15 + 15,000,000 DC).
            </div>
            <div className="flex justify-center gap-2">
              <CyberButton variant="purple" size="sm" onClick={() => setTab("browse")}>Browse Guilds</CyberButton>
              {user.level >= 15 && (
                <CyberButton variant="primary" size="sm" onClick={() => setTab("create")}>Create Guild</CyberButton>
              )}
            </div>
          </AnimatedCard>
        )
      )}

      {/* BROWSE */}
      {tab === "browse" && (
        <div className="space-y-2">
          {guildsLoading ? (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading guilds...</div>
          ) : allGuilds.length === 0 ? (
            <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>No guilds found. Be the first to create one.</div>
          ) : allGuilds.map(g => (
            <AnimatedCard key={g.id} accent="#a855f7" className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-mono font-bold" style={{ color: "#a855f7" }}>[{g.tag}] {g.name}</span>
                <span className="font-mono text-xs ml-2" style={{ color: "#64748b" }}>Lv.{g.level}</span>
                <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{g.description || "No description."}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{g.memberCount}/{g.maxMembers}</span>
                {!myGuild && (
                  <CyberButton
                    size="sm"
                    variant="purple"
                    loading={joinGuild.isPending}
                    onClick={() => joinGuild.mutate(g.id)}
                  >
                    Join
                  </CyberButton>
                )}
              </div>
            </AnimatedCard>
          ))}
        </div>
      )}

      {/* TURF */}
      {tab === "turf" && (
        <div className="space-y-4">
          <CyberSectionHeader title="DISTRICT CONTROL MAP" accent="#ff6b35" />

          {!turfData && (
            <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>Loading...</div>
          )}

          {turfData?.districts.map(d => {
            const tierColor = d.tier >= 4 ? "#ff2d55" : d.tier >= 3 ? "#f59e0b" : d.tier >= 2 ? "#ff6b35" : "#39d353";
            const canRace   = myGuild && (user.guildRole === "leader" || user.guildRole === "officer");
            const isRacing  = turfRacing === d.id;
            return (
              <AnimatedCard key={d.id} accent={tierColor} className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{d.name}</span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: `${tierColor}22`, color: tierColor }}
                    >
                      T{d.tier}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 font-mono text-xs flex-wrap">
                    <span style={{ color: "#f59e0b" }}>+{d.income.toLocaleString()} DC/week</span>
                    <span style={{ color: "#64748b" }}>Race cost: {d.raceCost.toLocaleString()} DC</span>
                  </div>
                  {d.controlling ? (
                    <div className="font-mono text-xs mt-1" style={{ color: "#a855f7" }}>
                      Controlled by [{d.controlling.guildTag}] {d.controlling.guildName}
                    </div>
                  ) : (
                    <div className="font-mono text-xs mt-1" style={{ color: "#334155" }}>Unclaimed</div>
                  )}
                </div>
                {canRace && (
                  <CyberButton
                    variant="warning"
                    size="sm"
                    loading={turfRace.isPending && isRacing}
                    disabled={turfRace.isPending}
                    onClick={() => { setTurfRacing(d.id); turfRace.mutate(d.id); }}
                  >
                    Race for Turf
                  </CyberButton>
                )}
              </AnimatedCard>
            );
          })}

          {!myGuild && (
            <div className="font-mono text-xs text-center py-4" style={{ color: "#64748b" }}>
              Join or create a guild to race for turf control.
            </div>
          )}

          {(turfData?.leaderboard.length ?? 0) > 0 && (
            <AnimatedCard>
              <CyberSectionHeader title="WEEKLY POINTS LEADERBOARD" accent="#f59e0b" size="sm" />
              {turfData!.leaderboard.map((g, i) => (
                <div
                  key={g.tag}
                  className="flex items-center justify-between py-1.5"
                  style={{ borderTop: i > 0 ? "1px solid #1e1e2e" : undefined }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: "#334155" }}>#{i + 1}</span>
                    <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>[{g.tag}] {g.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span style={{ color: "#64748b" }}>{g.districts.length} districts</span>
                    <span style={{ color: "#f59e0b" }}>{g.points} pts</span>
                  </div>
                </div>
              ))}
            </AnimatedCard>
          )}
        </div>
      )}

      {/* BANK */}
      {tab === "bank" && myGuild && (
        <div className="space-y-4">
          {!bankData ? (
            <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>Loading bank…</div>
          ) : (
            <>
              {/* Balance */}
              <AnimatedCard accent="#f59e0b">
                <CyberSectionHeader title="GUILD BANK" accent="#f59e0b" size="sm" />
                <div className="font-mono text-2xl font-bold mt-2" style={{ color: "#f59e0b" }}>
                  {formatDC(bankData.bankBalance)} DC
                </div>
                <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>Shared guild treasury</div>

                {/* Deposit */}
                <div className="mt-4 space-y-2">
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>Deposit DC (anyone can deposit)</div>
                  <div className="flex gap-2">
                    <input type="number" value={bankDeposit} onChange={e => setBankDeposit(e.target.value)}
                      placeholder="Amount" className="font-mono text-xs flex-1" style={INPUT} />
                    <CyberButton variant="warning" size="sm" loading={depositMut.isPending}
                      disabled={!bankDeposit || Number(bankDeposit) < 1}
                      onClick={() => depositMut.mutate(parseInt(bankDeposit))}>
                      Deposit
                    </CyberButton>
                  </div>
                </div>

                {/* Withdraw — officer+ only */}
                {(myGuild.myRole === "leader" || myGuild.myRole === "officer") && (
                  <div className="mt-3 space-y-2">
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>Withdraw DC (officer+)</div>
                    <div className="flex gap-2">
                      <input type="number" value={bankWithdraw} onChange={e => setBankWithdraw(e.target.value)}
                        placeholder="Amount" className="font-mono text-xs flex-1" style={INPUT} />
                      <CyberButton variant="danger" size="sm" loading={withdrawMut.isPending}
                        disabled={!bankWithdraw || Number(bankWithdraw) < 1}
                        onClick={() => withdrawMut.mutate(parseInt(bankWithdraw))}>
                        Withdraw
                      </CyberButton>
                    </div>
                  </div>
                )}
              </AnimatedCard>

              {/* Perks */}
              <AnimatedCard accent="#a855f7">
                <CyberSectionHeader title="GUILD PERKS" accent="#a855f7" size="sm" />
                <div className="space-y-3 mt-2">
                  {bankData.availablePerks.map(perk => {
                    const isActive = bankData.activePerks.some(ap => ap.perkId === perk.id);
                    const canAfford = bankData.bankBalance >= perk.cost;
                    const canBuy = (myGuild.myRole === "leader" || myGuild.myRole === "officer");
                    const activeEntry = bankData.activePerks.find(ap => ap.perkId === perk.id);
                    return (
                      <div key={perk.id} className="flex items-start justify-between gap-3 py-2"
                        style={{ borderTop: "1px solid #1e1e2e" }}>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm font-bold" style={{ color: isActive ? "#a855f7" : "#e2e8f0" }}>
                            {perk.name} {isActive && "✓"}
                          </div>
                          <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{perk.description}</div>
                          {isActive && activeEntry && (
                            <div className="font-mono text-xs mt-0.5" style={{ color: "#a855f7" }}>
                              Expires {new Date(activeEntry.expiresAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="font-mono text-xs" style={{ color: "#f59e0b" }}>{formatDC(perk.cost)} DC</span>
                          {canBuy && (
                            <CyberButton variant="purple" size="sm" loading={perkMut.isPending}
                              disabled={!canAfford || perkMut.isPending}
                              onClick={() => perkMut.mutate(perk.id)}>
                              {isActive ? "Extend" : "Activate"}
                            </CyberButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AnimatedCard>

              {/* Transaction Log */}
              {bankData.logs.length > 0 && (
                <AnimatedCard>
                  <CyberSectionHeader title="RECENT TRANSACTIONS" accent="#64748b" size="sm" />
                  <div className="space-y-1 mt-2">
                    {bankData.logs.map(log => (
                      <div key={String(log.id)} className="flex items-center justify-between py-1.5"
                        style={{ borderTop: "1px solid #1e1e2e08" }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: log.type === "deposit" ? "#39d353" : "#ff6b35", fontSize: 12 }}>
                            {log.type === "deposit" ? "↑" : "↓"}
                          </span>
                          <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{log.username}</span>
                        </div>
                        <span className="font-mono text-xs font-bold"
                          style={{ color: log.type === "deposit" ? "#39d353" : "#ff6b35" }}>
                          {log.type === "deposit" ? "+" : "-"}{formatDC(log.amount)} DC
                        </span>
                      </div>
                    ))}
                  </div>
                </AnimatedCard>
              )}
            </>
          )}
        </div>
      )}

      {/* CREATE */}
      {tab === "create" && !myGuild && (
        <AnimatedCard accent="#a855f7" className="space-y-3">
          <CyberSectionHeader title="CREATE A GUILD" accent="#a855f7" />
          <div className="font-mono text-xs" style={{ color: "#64748b" }}>Cost: 10,000 DC · Requires Level 15</div>
          {[
            { key: "name",        label: "Guild Name",       placeholder: "Crimson Circuit, etc.",    max: 30  },
            { key: "tag",         label: "Tag (2-5 chars)",  placeholder: "CC",                       max: 5   },
            { key: "description", label: "Description",      placeholder: "What your crew is about...", max: 300 },
          ].map(({ key, label, placeholder, max }) => (
            <div key={key}>
              <label className="font-mono text-xs block mb-1" style={{ color: "#64748b" }}>{label}</label>
              <input
                value={createForm[key as keyof typeof createForm]}
                onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                maxLength={max}
                style={INPUT}
              />
            </div>
          ))}
          <CyberButton
            variant="purple"
            loading={createGuild.isPending}
            disabled={!createForm.name || !createForm.tag}
            className="w-full"
            onClick={() => createGuild.mutate(createForm)}
          >
            Create Guild — 10,000 DC
          </CyberButton>
        </AnimatedCard>
      )}

      {/* CRIMES */}
      {tab === "crimes" && (
        !myGuild ? (
          <AnimatedCard className="text-center py-8">
            <div className="font-mono text-sm" style={{ color: "#64748b" }}>Join a gang first.</div>
          </AnimatedCard>
        ) : (
          <div className="space-y-4">
            <CyberSectionHeader title="GANG CRIMES" accent="#ff6b35" />
            {crimesLoading ? (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>Loading...</div>
            ) : crimesData.length === 0 ? (
              <AnimatedCard>
                <div className="font-mono text-xs text-center py-4" style={{ color: "#334155" }}>No active crimes. Start one below.</div>
              </AnimatedCard>
            ) : (
              <div className="space-y-3">
                {crimesData.map(crime => (
                  <CrimeCard
                    key={crime.id}
                    crime={crime}
                    onJoin={id => joinCrime.mutate(id)}
                    onCommit={id => commitCrime.mutate(id)}
                    onResolve={id => resolveCrime.mutate(id)}
                    isLeaderOrOfficer={!!isLeaderOrOfficer}
                  />
                ))}
              </div>
            )}

            {isLeaderOrOfficer && (
              <AnimatedCard accent="#ff6b35">
                <CyberSectionHeader title="START CRIME" accent="#ff6b35" size="sm" />
                <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                  {CRIME_TYPES.map(ct => (
                    <div
                      key={ct.type}
                      className="rounded p-3 space-y-1"
                      style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}
                    >
                      <div className="font-mono font-bold text-sm" style={{ color: "#e2e8f0" }}>{ct.label}</div>
                      <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                        {ct.members} members · {ct.duration} · {ct.payout}
                      </div>
                      <CyberButton
                        variant="warning"
                        size="sm"
                        loading={startCrime.isPending}
                        onClick={() => startCrime.mutate(ct.type)}
                        className="w-full mt-1"
                      >
                        Start
                      </CyberButton>
                    </div>
                  ))}
                </div>
              </AnimatedCard>
            )}
          </div>
        )
      )}

      {/* UPGRADES */}
      {tab === "upgrades" && (
        !myGuild ? (
          <AnimatedCard className="text-center py-8">
            <div className="font-mono text-sm" style={{ color: "#64748b" }}>Join a gang first.</div>
          </AnimatedCard>
        ) : (
          <div className="space-y-4">
            <CyberSectionHeader title="GANG UPGRADES" accent="#a855f7" />
            {upgradesLoading || !upgradesData ? (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>Loading...</div>
            ) : (
              <>
                <AnimatedCard accent="#f59e0b">
                  <div className="font-mono text-xs" style={{ color: "#64748b" }}>Guild Treasury</div>
                  <div className="font-mono text-2xl font-bold mt-1" style={{ color: "#f59e0b" }}>
                    {formatDC(upgradesData.treasury)} DC
                  </div>
                </AnimatedCard>

                {UPGRADE_CATEGORIES.map(cat => {
                  const catUpgrades = upgradesData.catalog.filter(u => u.category === cat);
                  if (catUpgrades.length === 0) return null;
                  return (
                    <AnimatedCard key={cat} accent="#a855f7">
                      <CyberSectionHeader
                        title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                        accent="#a855f7"
                        size="sm"
                      />
                      <div className="space-y-3 mt-2">
                        {catUpgrades.map(upg => {
                          const isPurchased = upgradesData.purchased.includes(upg.id);
                          const canAfford = upgradesData.treasury >= upg.cost;
                          const meetsLevel = myGuild.level >= upg.requiredLevel;
                          const tierColor = TIER_COLORS[upg.tier] ?? "#94a3b8";
                          return (
                            <div
                              key={upg.id}
                              className="flex items-start justify-between gap-3 py-2"
                              style={{ borderTop: "1px solid #1e1e2e" }}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-sm" style={{ color: isPurchased ? "#39d353" : "#e2e8f0" }}>
                                    {upg.name}
                                  </span>
                                  <span
                                    className="font-mono text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: `${tierColor}22`, color: tierColor }}
                                  >
                                    T{upg.tier}
                                  </span>
                                  {isPurchased && (
                                    <span className="font-mono text-xs" style={{ color: "#39d353" }}>✓</span>
                                  )}
                                </div>
                                <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{upg.description}</div>
                                <div className="font-mono text-xs mt-0.5" style={{ color: "#94a3b8" }}>{upg.effect}</div>
                                <div className="font-mono text-xs mt-0.5" style={{ color: "#334155" }}>
                                  Requires Guild Lv.{upg.requiredLevel}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="font-mono text-xs font-bold" style={{ color: "#f59e0b" }}>
                                  {formatDC(upg.cost)} DC
                                </span>
                                {!isPurchased && isLeaderOrOfficer && (
                                  <CyberButton
                                    variant="purple"
                                    size="sm"
                                    loading={buyUpgrade.isPending}
                                    disabled={!canAfford || !meetsLevel || buyUpgrade.isPending}
                                    onClick={() => buyUpgrade.mutate(upg.id)}
                                  >
                                    {!meetsLevel ? "Locked" : !canAfford ? "Can't Afford" : "Buy"}
                                  </CyberButton>
                                )}
                                {!isPurchased && !isLeaderOrOfficer && (!canAfford || !meetsLevel) && (
                                  <span className="font-mono text-xs" style={{ color: "#334155" }}>
                                    {!meetsLevel ? "Locked" : "Insufficient funds"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AnimatedCard>
                  );
                })}
              </>
            )}
          </div>
        )
      )}

      {/* WARS */}
      {tab === "wars" && (
        !myGuild ? (
          <AnimatedCard className="text-center py-8">
            <div className="font-mono text-sm" style={{ color: "#64748b" }}>Join a gang first.</div>
          </AnimatedCard>
        ) : (
          <div className="space-y-4">
            <CyberSectionHeader title="GANG WARS" accent="#ff2d55" />

            {warsLoading ? (
              <div className="font-mono text-xs text-center py-8" style={{ color: "#334155" }}>Loading...</div>
            ) : (
              <>
                {/* Active War */}
                {activeWar && (
                  <AnimatedCard accent="#ff2d55">
                    <div className="font-mono text-xs px-1.5 py-0.5 rounded inline-block mb-3"
                      style={{ background: "#ff2d5533", color: "#ff2d55" }}>
                      ⚔ ACTIVE WAR
                    </div>
                    {/* Score */}
                    <div className="flex items-center justify-between gap-3 flex-wrap text-center">
                      <div className="flex-1 text-center">
                        <div className="font-mono font-bold text-sm truncate" style={{ color: "#e2e8f0" }}>
                          {activeWar.isAttacker ? myGuild.name : activeWar.attackerGuildName}
                        </div>
                        <div className="font-mono text-3xl font-bold mt-1" style={{ color: "#00d4ff" }}>
                          {activeWar.isAttacker ? activeWar.attackerPoints : activeWar.defenderPoints}
                        </div>
                      </div>
                      <div className="font-mono text-lg font-bold flex-shrink-0" style={{ color: "#334155" }}>VS</div>
                      <div className="flex-1 text-center">
                        <div className="font-mono font-bold text-sm truncate" style={{ color: "#e2e8f0" }}>
                          {activeWar.isAttacker ? activeWar.defenderGuildName : myGuild.name}
                        </div>
                        <div className="font-mono text-3xl font-bold mt-1" style={{ color: "#ff2d55" }}>
                          {activeWar.isAttacker ? activeWar.defenderPoints : activeWar.attackerPoints}
                        </div>
                      </div>
                    </div>
                    {/* Live score bar */}
                    {(() => {
                      const myPts = activeWar.isAttacker ? activeWar.attackerPoints : activeWar.defenderPoints;
                      const theirPts = activeWar.isAttacker ? activeWar.defenderPoints : activeWar.attackerPoints;
                      const total = myPts + theirPts;
                      const myPct = total > 0 ? Math.round((myPts / total) * 100) : 50;
                      return (
                        <div className="mt-3 mb-1">
                          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#1e1e2e" }}>
                            <div style={{ width: `${myPct}%`, background: "#00d4ff", transition: "width 0.5s ease" }} />
                            <div style={{ width: `${100 - myPct}%`, background: "#ff2d55", transition: "width 0.5s ease" }} />
                          </div>
                          <div className="flex justify-between font-mono text-xs mt-1" style={{ color: "#475569" }}>
                            <span>{myPct}%</span>
                            <span>{100 - myPct}%</span>
                          </div>
                        </div>
                      );
                    })()}
                    {activeWar.endsAt && (
                      <div className="text-center mt-2 font-mono text-xs" style={{ color: "#64748b" }}>
                        Time remaining: <WarCountdown endsAt={activeWar.endsAt} />
                      </div>
                    )}
                    {/* Member contributions */}
                    {activeWar.contributions && activeWar.contributions.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                        <div className="font-mono text-xs mb-2 font-bold" style={{ color: "#64748b" }}>MEMBER CONTRIBUTIONS</div>
                        <div className="space-y-1">
                          {[...activeWar.contributions]
                            .filter(c => c.guildId === (activeWar.isAttacker ? activeWar.attackerGuildId : activeWar.defenderGuildId))
                            .sort((a, b) => b.points - a.points)
                            .slice(0, 8)
                            .map((c, i) => (
                              <div key={c.userId} className="flex items-center justify-between font-mono text-xs py-0.5">
                                <div className="flex items-center gap-2">
                                  <span style={{ color: i === 0 ? "#f59e0b" : "#475569", minWidth: 16 }}>
                                    {i === 0 ? "⭐" : `#${i + 1}`}
                                  </span>
                                  <span style={{ color: "#e2e8f0" }}>{c.username}</span>
                                </div>
                                <span style={{ color: "#00d4ff" }}>{c.points.toLocaleString()} pts</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="font-mono text-xs mt-3" style={{ color: "#334155" }}>
                      Arena win vs enemy: 200 pts · Crime in enemy turf: 50 pts · Any crime: 20 pts
                    </div>
                  </AnimatedCard>
                )}

                {/* Pending invites */}
                {pendingInvites.length > 0 && (
                  <AnimatedCard accent="#f59e0b">
                    <CyberSectionHeader title="WAR DECLARATIONS" accent="#f59e0b" size="sm" />
                    <div className="space-y-3 mt-2">
                      {pendingInvites.map(w => (
                        <div key={w.id} className="flex items-center justify-between gap-3 flex-wrap py-2"
                          style={{ borderTop: "1px solid #1e1e2e" }}>
                          <div>
                            <div className="font-mono text-sm" style={{ color: "#e2e8f0" }}>
                              {w.attackerGuildName} declared war on you
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <CyberButton size="sm" variant="danger"
                              loading={acceptWar.isPending}
                              onClick={() => acceptWar.mutate(w.id)}>
                              Accept
                            </CyberButton>
                            <CyberButton size="sm" variant="ghost"
                              loading={declineWar.isPending}
                              onClick={() => declineWar.mutate(w.id)}>
                              Decline
                            </CyberButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AnimatedCard>
                )}

                {/* Recent completed wars */}
                {completedWars.length > 0 && (
                  <AnimatedCard>
                    <CyberSectionHeader title="RECENT WARS" accent="#64748b" size="sm" />
                    <div className="space-y-2 mt-2">
                      {completedWars.map(w => {
                        const weWon = w.winnerId === user.guildId;
                        return (
                          <div key={w.id} className="flex items-center justify-between py-1.5 flex-wrap gap-2"
                            style={{ borderTop: "1px solid #1e1e2e" }}>
                            <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                              {w.attackerGuildName} vs {w.defenderGuildName}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs" style={{ color: "#64748b" }}>
                                {w.attackerPoints} — {w.defenderPoints}
                              </span>
                              <span
                                className="font-mono text-xs px-1.5 py-0.5 rounded"
                                style={{ background: weWon ? "#39d35322" : "#ff2d5522", color: weWon ? "#39d353" : "#ff2d55" }}
                              >
                                {weWon ? "Victory" : "Defeat"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AnimatedCard>
                )}

                {/* No wars at all */}
                {!activeWar && pendingInvites.length === 0 && completedWars.length === 0 && (
                  <AnimatedCard>
                    <div className="font-mono text-xs text-center py-4" style={{ color: "#334155" }}>
                      No wars yet. Declare one below.
                    </div>
                  </AnimatedCard>
                )}

                {/* Declare War (leader only) */}
                {myGuild.myRole === "leader" && (
                  <AnimatedCard accent="#ff2d55">
                    <CyberSectionHeader title="DECLARE WAR" accent="#ff2d55" size="sm" />
                    <div className="font-mono text-xs mt-1 mb-3 px-2 py-2 rounded"
                      style={{ background: "#ff2d5511", color: "#ff6b35", border: "1px solid #ff2d5533" }}>
                      ⚠ 20% of their treasury transferred to winner (max 500,000 DC)
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={warSearch}
                        onChange={e => { setWarSearch(e.target.value); setSelectedWarTarget(null); }}
                        placeholder="Search guild by name or tag..."
                        style={INPUT}
                      />
                      {warSearchResults.length > 0 && !selectedWarTarget && (
                        <div className="space-y-1 mt-1">
                          {warSearchResults.map(g => (
                            <div
                              key={g.id}
                              className="flex items-center justify-between px-3 py-2 rounded cursor-pointer"
                              style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}
                              onClick={() => { setSelectedWarTarget(g); setWarSearch(`[${g.tag}] ${g.name}`); }}
                            >
                              <span className="font-mono text-sm" style={{ color: "#e2e8f0" }}>
                                [{g.tag}] {g.name}
                              </span>
                              <span className="font-mono text-xs" style={{ color: "#64748b" }}>Lv.{g.level}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedWarTarget && (
                        <div className="mt-2">
                          <div className="font-mono text-xs mb-2" style={{ color: "#64748b" }}>
                            Target: <span style={{ color: "#ff2d55" }}>[{selectedWarTarget.tag}] {selectedWarTarget.name}</span>
                          </div>
                          <CyberButton
                            variant="danger"
                            loading={declareWar.isPending}
                            onClick={() => declareWar.mutate(selectedWarTarget.id)}
                            className="w-full"
                          >
                            Declare War
                          </CyberButton>
                        </div>
                      )}
                    </div>
                  </AnimatedCard>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
