import { useState } from "react";
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

export function GuildsPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [tab,              setTab]              = useState<"mine" | "browse" | "create" | "turf" | "bank">("mine");
  const [createForm,       setCreateForm]       = useState({ name: "", tag: "", description: "" });
  const [donateAmount,     setDonateAmount]     = useState("");
  const [turfRacing,       setTurfRacing]       = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [bankDeposit,      setBankDeposit]      = useState("");
  const [bankWithdraw,     setBankWithdraw]     = useState("");

  const { data: myGuild, isLoading: myGuildLoading } = useQuery<MyGuild | null>({
    queryKey: ["guild-mine"],
    queryFn:  () => api.get("/guilds/mine"),
  });

  const { data: allGuilds = [], isLoading: guildsLoading } = useQuery<GuildSummary[]>({
    queryKey: ["guilds"],
    queryFn:  () => api.get("/guilds"),
    enabled:  tab === "browse",
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

  const TABS = myGuild
    ? (["mine", "browse", "turf", "bank"] as const)
    : (["mine", "browse", "create", "turf"] as const);

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
        {TABS.map(t => (
          <CyberButton
            key={t}
            size="sm"
            variant={tab === t ? "purple" : "ghost"}
            glow={tab === t}
            onClick={() => setTab(t)}
          >
            {t === "mine" ? "My Guild" : t.charAt(0).toUpperCase() + t.slice(1)}
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
              Browse existing guilds or create your own (Level 15 + 10,000 DC).
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
    </div>
  );
}
