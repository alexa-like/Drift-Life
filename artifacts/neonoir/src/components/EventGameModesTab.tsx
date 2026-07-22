import { useState } from "react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeState {
  gameDisplayName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  bannerImageUrl: string;
  chatBadgeText: string;
  chatBadgeColor: string;
}

interface PointSource {
  action: string;
  points: number;
}

interface RewardTier {
  rankFrom: number;
  rankTo: number;
  dc: number;
  nc: number;
  title: string;
}

interface BossPhase {
  name: string;
  triggerAtHpPercent: number;
  description: string;
  abilityEffect: string;
}

interface TeamEntry {
  id: string;
  name: string;
  color: string;
}

interface MilestoneEntry {
  label: string;
  target: number;
  action: string;
}

interface FormState {
  // common
  name: string;
  slug: string;
  description: string;
  startsAt: string;
  endsAt: string;
  theme: ThemeState;
  pointSources: PointSource[];
  leaderboardRewards: RewardTier[];
  // boss_raid
  bossName: string;
  bossImageUrl: string;
  bossTotalHp: number;
  bossStrikeEnergyCost: number;
  bossStrikeCooldownSeconds: number;
  bossPhases: BossPhase[];
  // collection_hunt
  collectibleName: string;
  collectibleDropSources: string;
  collectibleDropChance: number;
  collectibleSetSize: number;
  // milestone
  milestones: MilestoneEntry[];
  // sports
  teams: TeamEntry[];
  // lottery
  lotteryTicketSource: string;
  lotteryTicketsPerAction: number;
  lotteryWinnersCount: number;
}

// ── Defaults per template ─────────────────────────────────────────────────────

const DEFAULTS: Record<string, FormState> = {
  boss_raid: {
    name: "City Boss Raid", slug: "city-boss-raid", description: "Coordinate to defeat the city boss before time runs out.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "BOSS RAID", primaryColor: "#ff2d55", accentColor: "#f59e0b", backgroundColor: "#0d0008", bannerImageUrl: "", chatBadgeText: "RAID", chatBadgeColor: "#ff2d55" },
    pointSources: [{ action: "boss_strike", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, dc: 500000, nc: 100, title: "Bossbreaker" },
      { rankFrom: 2, rankTo: 5, dc: 200000, nc: 50, title: "" },
      { rankFrom: 6, rankTo: 25, dc: 50000, nc: 10, title: "" },
    ],
    bossName: "Iron Syndicate", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600,
    bossPhases: [
      { name: "Enraged", triggerAtHpPercent: 50, description: "Boss attacks harder", abilityEffect: "double_retaliation" },
      { name: "Last Stand", triggerAtHpPercent: 20, description: "Desperate defense", abilityEffect: "triple_retaliation" },
    ],
    collectibleName: "", collectibleDropSources: "", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [], teams: [], lotteryTicketSource: "", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
  leaderboard_grind: {
    name: "Crime Kingpin Cup", slug: "crime-kingpin-cup", description: "Earn the most points through criminal activities to top the board.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "KINGPIN CUP", primaryColor: "#a855f7", accentColor: "#00d4ff", backgroundColor: "#08000d", bannerImageUrl: "", chatBadgeText: "CUP", chatBadgeColor: "#a855f7" },
    pointSources: [{ action: "heist", points: 5 }, { action: "mugging", points: 2 }, { action: "drug_deal", points: 3 }, { action: "arena_win", points: 10 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, dc: 400000, nc: 75, title: "Kingpin" },
      { rankFrom: 2, rankTo: 10, dc: 100000, nc: 20, title: "" },
    ],
    bossName: "", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600, bossPhases: [],
    collectibleName: "", collectibleDropSources: "", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [], teams: [], lotteryTicketSource: "", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
  collection_hunt: {
    name: "Contraband Hunt", slug: "contraband-hunt", description: "Collect all contraband items scattered across the city.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "CONTRABAND HUNT", primaryColor: "#39d353", accentColor: "#f59e0b", backgroundColor: "#00080a", bannerImageUrl: "", chatBadgeText: "HUNT", chatBadgeColor: "#39d353" },
    pointSources: [{ action: "collectible_found", points: 100 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, dc: 300000, nc: 50, title: "Cache King" },
      { rankFrom: 2, rankTo: 10, dc: 75000, nc: 10, title: "" },
    ],
    bossName: "", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600, bossPhases: [],
    collectibleName: "Contraband Cache", collectibleDropSources: "heist,mugging,drug_deal", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [], teams: [], lotteryTicketSource: "", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
  milestone: {
    name: "City Milestone Push", slug: "city-milestone-push", description: "The entire city works together to hit collective targets.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "CITY PUSH", primaryColor: "#00d4ff", accentColor: "#39d353", backgroundColor: "#00070d", bannerImageUrl: "", chatBadgeText: "PUSH", chatBadgeColor: "#00d4ff" },
    pointSources: [{ action: "heist", points: 1 }],
    leaderboardRewards: [{ rankFrom: 1, rankTo: 100, dc: 25000, nc: 5, title: "" }],
    bossName: "", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600, bossPhases: [],
    collectibleName: "", collectibleDropSources: "", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [
      { label: "Phase 1 — First Wave", target: 1000, action: "heist" },
      { label: "Phase 2 — Surge", target: 5000, action: "heist" },
      { label: "Phase 3 — Conquest", target: 20000, action: "heist" },
    ],
    teams: [], lotteryTicketSource: "", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
  sports: {
    name: "District Wars", slug: "district-wars", description: "Represent your district and fight for supremacy.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "DISTRICT WARS", primaryColor: "#f59e0b", accentColor: "#ff2d55", backgroundColor: "#0a0700", bannerImageUrl: "", chatBadgeText: "WAR", chatBadgeColor: "#f59e0b" },
    pointSources: [{ action: "arena_win", points: 5 }, { action: "heist", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, dc: 350000, nc: 60, title: "District Champion" },
      { rankFrom: 2, rankTo: 10, dc: 80000, nc: 15, title: "" },
    ],
    bossName: "", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600, bossPhases: [],
    collectibleName: "", collectibleDropSources: "", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [],
    teams: [
      { id: "northside", name: "Northside Syndicate", color: "#00d4ff" },
      { id: "southside", name: "Southside Crew", color: "#ff2d55" },
      { id: "eastend", name: "East End Mob", color: "#39d353" },
      { id: "westgate", name: "Westgate Outfit", color: "#a855f7" },
    ],
    lotteryTicketSource: "", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
  lottery: {
    name: "Crime Lottery", slug: "crime-lottery", description: "Earn tickets through actions and win the grand prize draw.",
    startsAt: "", endsAt: "",
    theme: { gameDisplayName: "CRIME LOTTERY", primaryColor: "#f59e0b", accentColor: "#a855f7", backgroundColor: "#090500", bannerImageUrl: "", chatBadgeText: "LOTTERY", chatBadgeColor: "#f59e0b" },
    pointSources: [{ action: "heist", points: 1 }],
    leaderboardRewards: [{ rankFrom: 1, rankTo: 5, dc: 1000000, nc: 200, title: "Jackpot" }],
    bossName: "", bossImageUrl: "", bossTotalHp: 10000000, bossStrikeEnergyCost: 10, bossStrikeCooldownSeconds: 3600, bossPhases: [],
    collectibleName: "", collectibleDropSources: "", collectibleDropChance: 0.05, collectibleSetSize: 10,
    milestones: [], teams: [], lotteryTicketSource: "heist,mugging", lotteryTicketsPerAction: 1, lotteryWinnersCount: 5,
  },
};

const TEMPLATE_LABELS: Record<string, string> = {
  boss_raid:         "💀 Boss Raid",
  leaderboard_grind: "🏆 Leaderboard Grind",
  collection_hunt:   "🎁 Collection Hunt",
  milestone:         "🏙️ City Milestone",
  sports:            "⚽ Sports / Teams",
  lottery:           "🎰 Lottery",
};

const ACTION_OPTIONS = [
  "heist", "mugging", "drug_deal", "theft",
  "arena_win", "arena_loss", "arena_draw",
  "boss_strike", "race_1st", "race_finish",
  "collectible_found", "event_collect",
  "daily_quest", "weekly_quest", "job_shift", "gym_train",
];

const ABILITY_EFFECTS = ["double_retaliation", "triple_retaliation", "shield", "double_damage", "slow_cooldown"];

// ── Shared style helpers ──────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#0d0d1a",
  border: "1px solid #1e1e2e",
  borderRadius: 6,
  padding: "18px 20px",
  marginBottom: 14,
};

const inp: React.CSSProperties = {
  background: "#070710",
  border: "1px solid #1e1e2e",
  borderRadius: 4,
  color: "#e2e8f0",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "7px 10px",
  width: "100%",
  boxSizing: "border-box",
};

const lbl = (hint?: string): React.CSSProperties => ({
  color: "#475569",
  fontFamily: "monospace",
  fontSize: 10,
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
});

const sectionHead = (color: string): React.CSSProperties => ({
  color,
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: "bold",
  letterSpacing: "0.12em",
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: `1px solid ${color}20`,
});

function addBtn(onClick: () => void, label: string) {
  return (
    <button onClick={onClick} style={{ background: "#1e1e2e", border: "1px solid #2e2e3e", color: "#64748b", fontFamily: "monospace", fontSize: 10, padding: "4px 10px", borderRadius: 3, cursor: "pointer" }}>
      + {label}
    </button>
  );
}

function removeBtn(onClick: () => void) {
  return (
    <button onClick={onClick} style={{ background: "transparent", border: "none", color: "#475569", fontFamily: "monospace", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: "0 4px" }} title="Remove">
      ✕
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span style={lbl()}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 32, border: "1px solid #1e1e2e", borderRadius: 4, background: "#070710", cursor: "pointer", padding: 2 }} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="#000000"
          style={{ ...inp, width: "auto", flex: 1, fontFamily: "monospace" }} />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={lbl()}>{label}{hint && <span style={{ color: "#334155", marginLeft: 6 }}>{hint}</span>}</span>
      {children}
    </div>
  );
}

// ── Serialize form → API body ─────────────────────────────────────────────────

function buildBody(type: string, f: FormState): object {
  const base: Record<string, unknown> = {
    name: f.name,
    slug: f.slug,
    type,
    description: f.description,
    startsAt: f.startsAt || undefined,
    endsAt: f.endsAt || undefined,
    theme: {
      gameDisplayName: f.theme.gameDisplayName,
      primaryColor: f.theme.primaryColor,
      accentColor: f.theme.accentColor,
      backgroundColor: f.theme.backgroundColor,
      bannerImageUrl: f.theme.bannerImageUrl || undefined,
      chatBadgeText: f.theme.chatBadgeText,
      chatBadgeColor: f.theme.chatBadgeColor,
    },
    pointSources: f.pointSources,
    leaderboardRewards: f.leaderboardRewards.map(r => ({
      rankFrom: r.rankFrom,
      rankTo: r.rankTo,
      reward: { dc: r.dc, nc: r.nc, titles: r.title ? [r.title] : [] },
    })),
  };

  if (type === "boss_raid") {
    base.boss = {
      name: f.bossName,
      imageUrl: f.bossImageUrl || undefined,
      totalHp: f.bossTotalHp,
      currentHp: f.bossTotalHp,
      strikeEnergyCost: f.bossStrikeEnergyCost,
      strikeCooldownSeconds: f.bossStrikeCooldownSeconds,
      phases: f.bossPhases,
    };
  }
  if (type === "collection_hunt") {
    base.collectible = {
      name: f.collectibleName,
      dropSources: f.collectibleDropSources.split(",").map(s => s.trim()).filter(Boolean),
      dropChance: f.collectibleDropChance,
      setSize: f.collectibleSetSize,
    };
  }
  if (type === "milestone") {
    base.milestones = f.milestones;
  }
  if (type === "sports") {
    base.teams = f.teams;
  }
  if (type === "lottery") {
    base.lottery = {
      ticketSource: f.lotteryTicketSource,
      ticketsPerAction: f.lotteryTicketsPerAction,
      winnersCount: f.lotteryWinnersCount,
    };
  }
  return base;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function EventGameModesTab({ addToast }: Props) {
  const [selectedType, setSelectedType] = useState("boss_raid");
  const [form, setForm] = useState<FormState>({ ...DEFAULTS.boss_raid });
  const [saving, setSaving] = useState(false);

  function loadTemplate(type: string) {
    setSelectedType(type);
    setForm({ ...DEFAULTS[type] });
  }

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function setTheme(key: keyof ThemeState, val: string) {
    setForm(f => ({ ...f, theme: { ...f.theme, [key]: val } }));
  }

  // Auto-slug from name
  function handleNameChange(v: string) {
    set("name", v);
    set("slug", v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }

  async function handleCreate() {
    if (!form.name.trim()) { addToast("Event name is required", "error"); return; }
    setSaving(true);
    try {
      await api.post<unknown>("/owner/events", buildBody(selectedType, form));
      addToast(`✅ "${form.name}" created as draft`, "success");
    } catch (e: any) {
      addToast(e.message ?? "Failed to create event", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Point sources helpers
  function updatePointSource(i: number, key: keyof PointSource, val: string | number) {
    const next = form.pointSources.map((p, idx) => idx === i ? { ...p, [key]: key === "points" ? Number(val) : val } : p);
    set("pointSources", next);
  }
  function addPointSource() { set("pointSources", [...form.pointSources, { action: "heist", points: 1 }]); }
  function removePointSource(i: number) { set("pointSources", form.pointSources.filter((_, idx) => idx !== i)); }

  // ── Reward tiers helpers
  function updateReward(i: number, key: keyof RewardTier, val: string | number) {
    const next = form.leaderboardRewards.map((r, idx) => idx === i ? { ...r, [key]: ["dc","nc","rankFrom","rankTo"].includes(key) ? Number(val) : val } : r);
    set("leaderboardRewards", next);
  }
  function addReward() { set("leaderboardRewards", [...form.leaderboardRewards, { rankFrom: 1, rankTo: 1, dc: 0, nc: 0, title: "" }]); }
  function removeReward(i: number) { set("leaderboardRewards", form.leaderboardRewards.filter((_, idx) => idx !== i)); }

  // ── Boss phases helpers
  function updatePhase(i: number, key: keyof BossPhase, val: string | number) {
    const next = form.bossPhases.map((p, idx) => idx === i ? { ...p, [key]: key === "triggerAtHpPercent" ? Number(val) : val } : p);
    set("bossPhases", next);
  }
  function addPhase() { set("bossPhases", [...form.bossPhases, { name: "", triggerAtHpPercent: 50, description: "", abilityEffect: "double_retaliation" }]); }
  function removePhase(i: number) { set("bossPhases", form.bossPhases.filter((_, idx) => idx !== i)); }

  // ── Milestones helpers
  function updateMilestone(i: number, key: keyof MilestoneEntry, val: string | number) {
    const next = form.milestones.map((m, idx) => idx === i ? { ...m, [key]: key === "target" ? Number(val) : val } : m);
    set("milestones", next);
  }
  function addMilestone() { set("milestones", [...form.milestones, { label: "", target: 1000, action: "heist" }]); }
  function removeMilestone(i: number) { set("milestones", form.milestones.filter((_, idx) => idx !== i)); }

  // ── Teams helpers
  function updateTeam(i: number, key: keyof TeamEntry, val: string) {
    const next = form.teams.map((t, idx) => idx === i ? { ...t, [key]: val } : t);
    set("teams", next);
  }
  function addTeam() { set("teams", [...form.teams, { id: "", name: "", color: "#ffffff" }]); }
  function removeTeam(i: number) { set("teams", form.teams.filter((_, idx) => idx !== i)); }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Template picker */}
      <div style={card}>
        <div style={sectionHead("#f59e0b")}>SELECT EVENT TYPE</div>
        <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {Object.keys(DEFAULTS).map(type => (
            <button key={type} onClick={() => loadTemplate(type)}
              className="px-3 py-2 rounded text-left font-mono text-xs transition-all"
              style={{
                background: selectedType === type ? "#f59e0b18" : "#08080c",
                color: selectedType === type ? "#f59e0b" : "#475569",
                border: `1px solid ${selectedType === type ? "#f59e0b40" : "#1e1e2e"}`,
              }}>
              {TEMPLATE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* ── BASICS ── */}
      <div style={card}>
        <div style={sectionHead("#00d4ff")}>BASIC DETAILS</div>
        <div className="space-y-3">
          <Field label="Event Name" hint="shown to players">
            <input value={form.name} onChange={e => handleNameChange(e.target.value)} style={inp} placeholder="e.g. City Boss Raid" />
          </Field>
          <Field label="URL Slug" hint="auto-generated, must be unique">
            <input value={form.slug} onChange={e => set("slug", e.target.value)} style={inp} placeholder="e.g. city-boss-raid" />
          </Field>
          <Field label="Description" hint="shown to players on the event page">
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
              style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} placeholder="What players need to do…" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Start Date & Time">
              <input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)} style={inp} />
            </Field>
            <Field label="End Date & Time">
              <input type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)} style={inp} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── THEME ── */}
      <div style={card}>
        <div style={sectionHead("#a855f7")}>THEME & VISUALS</div>
        <div className="space-y-3">
          <Field label="In-Game Display Name" hint="shown in big text on the event screen">
            <input value={form.theme.gameDisplayName} onChange={e => setTheme("gameDisplayName", e.target.value)} style={inp} placeholder="e.g. BOSS RAID" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ColorField label="Primary Color" value={form.theme.primaryColor} onChange={v => setTheme("primaryColor", v)} />
            <ColorField label="Accent Color" value={form.theme.accentColor} onChange={v => setTheme("accentColor", v)} />
            <ColorField label="Background Color" value={form.theme.backgroundColor} onChange={v => setTheme("backgroundColor", v)} />
          </div>
          <Field label="Banner Image URL" hint="optional, leave blank to skip">
            <input value={form.theme.bannerImageUrl} onChange={e => setTheme("bannerImageUrl", e.target.value)} style={inp} placeholder="https://…" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Chat Badge Text" hint="short label in chat, e.g. RAID">
              <input value={form.theme.chatBadgeText} onChange={e => setTheme("chatBadgeText", e.target.value)} style={inp} placeholder="RAID" />
            </Field>
            <ColorField label="Chat Badge Color" value={form.theme.chatBadgeColor} onChange={v => setTheme("chatBadgeColor", v)} />
          </div>

          {/* Live preview swatch */}
          <div style={{ marginTop: 8 }}>
            <span style={lbl()}>PREVIEW</span>
            <div style={{ background: form.theme.backgroundColor, border: `1px solid ${form.theme.primaryColor}40`, borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: form.theme.primaryColor, letterSpacing: "0.1em" }}>
                {form.theme.gameDisplayName || "DISPLAY NAME"}
              </div>
              <div style={{ background: form.theme.chatBadgeColor + "30", border: `1px solid ${form.theme.chatBadgeColor}60`, color: form.theme.chatBadgeColor, fontFamily: "monospace", fontSize: 9, padding: "2px 6px", borderRadius: 3 }}>
                {form.theme.chatBadgeText || "BADGE"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOSS RAID specific ── */}
      {selectedType === "boss_raid" && (
        <div style={card}>
          <div style={sectionHead("#ff2d55")}>BOSS SETTINGS</div>
          <div className="space-y-3">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Boss Name">
                <input value={form.bossName} onChange={e => set("bossName", e.target.value)} style={inp} placeholder="Iron Syndicate" />
              </Field>
              <Field label="Boss Image URL" hint="optional">
                <input value={form.bossImageUrl} onChange={e => set("bossImageUrl", e.target.value)} style={inp} placeholder="https://…" />
              </Field>
              <Field label="Total HP" hint="how much health the boss has">
                <input type="number" value={form.bossTotalHp} onChange={e => set("bossTotalHp", Number(e.target.value))} style={inp} min={1} />
              </Field>
              <Field label="Strike Energy Cost" hint="energy each player uses per strike">
                <input type="number" value={form.bossStrikeEnergyCost} onChange={e => set("bossStrikeEnergyCost", Number(e.target.value))} style={inp} min={1} />
              </Field>
              <Field label="Strike Cooldown" hint="seconds between strikes per player">
                <input type="number" value={form.bossStrikeCooldownSeconds} onChange={e => set("bossStrikeCooldownSeconds", Number(e.target.value))} style={inp} min={0} />
              </Field>
            </div>

            {/* Boss Phases */}
            <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={lbl()}>BOSS PHASES <span style={{ color: "#334155" }}>(triggered at certain HP thresholds)</span></span>
                {addBtn(addPhase, "Add Phase")}
              </div>
              {form.bossPhases.map((ph, i) => (
                <div key={i} style={{ background: "#070710", border: "1px solid #1e1e2e", borderRadius: 4, padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#ff2d55", fontFamily: "monospace", fontSize: 10 }}>Phase {i + 1}</span>
                    {removeBtn(() => removePhase(i))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="Phase Name">
                      <input value={ph.name} onChange={e => updatePhase(i, "name", e.target.value)} style={inp} placeholder="Enraged" />
                    </Field>
                    <Field label="Triggers at HP %" hint="e.g. 50 = when boss drops to 50% HP">
                      <input type="number" value={ph.triggerAtHpPercent} onChange={e => updatePhase(i, "triggerAtHpPercent", e.target.value)} style={inp} min={1} max={99} />
                    </Field>
                    <Field label="Description">
                      <input value={ph.description} onChange={e => updatePhase(i, "description", e.target.value)} style={inp} placeholder="What changes…" />
                    </Field>
                    <Field label="Ability Effect">
                      <select value={ph.abilityEffect} onChange={e => updatePhase(i, "abilityEffect", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        {ABILITY_EFFECTS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECTION HUNT specific ── */}
      {selectedType === "collection_hunt" && (
        <div style={card}>
          <div style={sectionHead("#39d353")}>COLLECTIBLE SETTINGS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Collectible Item Name">
              <input value={form.collectibleName} onChange={e => set("collectibleName", e.target.value)} style={inp} placeholder="Contraband Cache" />
            </Field>
            <Field label="Set Size" hint="how many unique items exist">
              <input type="number" value={form.collectibleSetSize} onChange={e => set("collectibleSetSize", Number(e.target.value))} style={inp} min={1} />
            </Field>
            <Field label="Drop Chance" hint="e.g. 0.05 = 5% per action">
              <input type="number" value={form.collectibleDropChance} onChange={e => set("collectibleDropChance", Number(e.target.value))} style={inp} min={0} max={1} step={0.01} />
            </Field>
            <Field label="Drop Sources" hint="comma-separated action names">
              <input value={form.collectibleDropSources} onChange={e => set("collectibleDropSources", e.target.value)} style={inp} placeholder="heist,mugging,drug_deal" />
            </Field>
          </div>
        </div>
      )}

      {/* ── CITY MILESTONE specific ── */}
      {selectedType === "milestone" && (
        <div style={card}>
          <div style={sectionHead("#00d4ff")}>MILESTONE PHASES</div>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
            {addBtn(addMilestone, "Add Milestone")}
          </div>
          {form.milestones.map((m, i) => (
            <div key={i} style={{ background: "#070710", border: "1px solid #1e1e2e", borderRadius: 4, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#00d4ff", fontFamily: "monospace", fontSize: 10 }}>Milestone {i + 1}</span>
                {removeBtn(() => removeMilestone(i))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Field label="Label">
                  <input value={m.label} onChange={e => updateMilestone(i, "label", e.target.value)} style={inp} placeholder="Phase 1 — First Wave" />
                </Field>
                <Field label="Target Count" hint="how many actions needed city-wide">
                  <input type="number" value={m.target} onChange={e => updateMilestone(i, "target", e.target.value)} style={inp} min={1} />
                </Field>
                <Field label="Tracked Action">
                  <select value={m.action} onChange={e => updateMilestone(i, "action", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SPORTS / TEAMS specific ── */}
      {selectedType === "sports" && (
        <div style={card}>
          <div style={sectionHead("#f59e0b")}>TEAMS</div>
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
            {addBtn(addTeam, "Add Team")}
          </div>
          {form.teams.map((t, i) => (
            <div key={i} style={{ background: "#070710", border: "1px solid #1e1e2e", borderRadius: 4, padding: "10px 12px", marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
              <Field label="Team ID" hint="no spaces, e.g. northside">
                <input value={t.id} onChange={e => updateTeam(i, "id", e.target.value)} style={inp} placeholder="northside" />
              </Field>
              <Field label="Team Name">
                <input value={t.name} onChange={e => updateTeam(i, "name", e.target.value)} style={inp} placeholder="Northside Syndicate" />
              </Field>
              <ColorField label="Color" value={t.color} onChange={v => updateTeam(i, "color", v)} />
              <div style={{ paddingTop: 16 }}>{removeBtn(() => removeTeam(i))}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── LOTTERY specific ── */}
      {selectedType === "lottery" && (
        <div style={card}>
          <div style={sectionHead("#f59e0b")}>LOTTERY SETTINGS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Ticket Sources" hint="comma-separated actions that give tickets">
              <input value={form.lotteryTicketSource} onChange={e => set("lotteryTicketSource", e.target.value)} style={inp} placeholder="heist,mugging" />
            </Field>
            <Field label="Tickets Per Action" hint="how many tickets each action gives">
              <input type="number" value={form.lotteryTicketsPerAction} onChange={e => set("lotteryTicketsPerAction", Number(e.target.value))} style={inp} min={1} />
            </Field>
            <Field label="Number of Winners">
              <input type="number" value={form.lotteryWinnersCount} onChange={e => set("lotteryWinnersCount", Number(e.target.value))} style={inp} min={1} />
            </Field>
          </div>
        </div>
      )}

      {/* ── POINT SOURCES ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={sectionHead("#39d353")}>HOW PLAYERS EARN POINTS</div>
          {addBtn(addPointSource, "Add Action")}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                <th style={{ padding: "4px 8px", color: "#475569", textAlign: "left" }}>Player Action</th>
                <th style={{ padding: "4px 8px", color: "#475569", textAlign: "left" }}>Points Earned</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {form.pointSources.map((ps, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e1e2e18" }}>
                  <td style={{ padding: "4px 8px" }}>
                    <select value={ps.action} onChange={e => updatePointSource(i, "action", e.target.value)} style={{ ...inp, width: "auto", cursor: "pointer" }}>
                      {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <input type="number" value={ps.points} onChange={e => updatePointSource(i, "points", e.target.value)} style={{ ...inp, width: 80 }} min={0} />
                  </td>
                  <td style={{ padding: "4px 8px" }}>{removeBtn(() => removePointSource(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form.pointSources.length === 0 && (
          <div style={{ color: "#334155", fontFamily: "monospace", fontSize: 10, textAlign: "center", padding: "12px 0" }}>No point sources — add at least one action</div>
        )}
      </div>

      {/* ── LEADERBOARD REWARDS ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={sectionHead("#a855f7")}>LEADERBOARD REWARDS</div>
          {addBtn(addReward, "Add Tier")}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                {["Rank From", "Rank To", "DC Reward", "NC Reward", "Title (optional)"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "#475569", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {form.leaderboardRewards.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e1e2e18" }}>
                  <td style={{ padding: "4px 8px" }}><input type="number" value={r.rankFrom} onChange={e => updateReward(i, "rankFrom", e.target.value)} style={{ ...inp, width: 64 }} min={1} /></td>
                  <td style={{ padding: "4px 8px" }}><input type="number" value={r.rankTo} onChange={e => updateReward(i, "rankTo", e.target.value)} style={{ ...inp, width: 64 }} min={1} /></td>
                  <td style={{ padding: "4px 8px" }}><input type="number" value={r.dc} onChange={e => updateReward(i, "dc", e.target.value)} style={{ ...inp, width: 90 }} min={0} /></td>
                  <td style={{ padding: "4px 8px" }}><input type="number" value={r.nc} onChange={e => updateReward(i, "nc", e.target.value)} style={{ ...inp, width: 70 }} min={0} /></td>
                  <td style={{ padding: "4px 8px" }}><input value={r.title} onChange={e => updateReward(i, "title", e.target.value)} style={{ ...inp, width: 130 }} placeholder="e.g. Kingpin" /></td>
                  <td style={{ padding: "4px 8px" }}>{removeBtn(() => removeReward(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {form.leaderboardRewards.length === 0 && (
          <div style={{ color: "#334155", fontFamily: "monospace", fontSize: 10, textAlign: "center", padding: "12px 0" }}>No reward tiers yet</div>
        )}
      </div>

      {/* ── CREATE BUTTON ── */}
      <div style={{ paddingBottom: 24 }}>
        <button onClick={handleCreate} disabled={saving}
          className="font-mono text-xs px-6 py-3 rounded font-bold uppercase tracking-widest transition-all"
          style={{
            background: saving ? "#111118" : "#f59e0b18",
            color: saving ? "#475569" : "#f59e0b",
            border: `1px solid ${saving ? "#1e1e2e" : "#f59e0b40"}`,
            cursor: saving ? "not-allowed" : "pointer",
          }}>
          {saving ? "Creating…" : "Create Event (Draft)"}
        </button>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#334155", marginLeft: 12 }}>
          Saved as draft — activate it from the Events tab
        </span>
      </div>
    </div>
  );
}
