import { useState } from "react";
import { api } from "../lib/api";

// ── Event type templates ───────────────────────────────────────────────────────

const TEMPLATES: Record<string, object> = {
  boss_raid: {
    name: "City Boss Raid",
    slug: "city-boss-raid",
    type: "boss_raid",
    description: "Coordinate to defeat the city boss before time runs out.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "BOSS RAID",
      primaryColor: "#ff2d55",
      accentColor: "#f59e0b",
      backgroundColor: "#0d0008",
      bannerImageUrl: "",
      chatBadgeText: "RAID",
      chatBadgeColor: "#ff2d55",
    },
    boss: {
      name: "Iron Syndicate",
      imageUrl: "",
      totalHp: 10000000,
      currentHp: 10000000,
      strikeEnergyCost: 10,
      strikeCooldownSeconds: 3600,
      phases: [
        { name: "Enraged", triggerAtHpPercent: 50, description: "Boss attacks harder", abilityEffect: "double_retaliation" },
        { name: "Last Stand", triggerAtHpPercent: 20, description: "Desperate defense", abilityEffect: "triple_retaliation" },
      ],
    },
    pointSources: [{ action: "boss_strike", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, reward: { dc: 500000, nc: 100, titles: ["Bossbreaker"] } },
      { rankFrom: 2, rankTo: 5, reward: { dc: 200000, nc: 50, titles: [] } },
      { rankFrom: 6, rankTo: 25, reward: { dc: 50000, nc: 10, titles: [] } },
    ],
  },
  leaderboard_grind: {
    name: "Crime Kingpin Cup",
    slug: "crime-kingpin-cup",
    type: "leaderboard_grind",
    description: "Earn the most points through criminal activities to top the board.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "KINGPIN CUP",
      primaryColor: "#a855f7",
      accentColor: "#00d4ff",
      backgroundColor: "#08000d",
      bannerImageUrl: "",
      chatBadgeText: "CUP",
      chatBadgeColor: "#a855f7",
    },
    pointSources: [
      { action: "heist", points: 5 },
      { action: "mugging", points: 2 },
      { action: "drug_deal", points: 3 },
      { action: "arena_win", points: 10 },
    ],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, reward: { dc: 400000, nc: 75, titles: ["Kingpin"] } },
      { rankFrom: 2, rankTo: 10, reward: { dc: 100000, nc: 20, titles: [] } },
    ],
  },
  collection_hunt: {
    name: "Contraband Hunt",
    slug: "contraband-hunt",
    type: "collection_hunt",
    description: "Collect all contraband items scattered across the city.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "CONTRABAND HUNT",
      primaryColor: "#39d353",
      accentColor: "#f59e0b",
      backgroundColor: "#00080a",
      bannerImageUrl: "",
      chatBadgeText: "HUNT",
      chatBadgeColor: "#39d353",
    },
    collectible: {
      name: "Contraband Cache",
      dropSources: ["heist", "mugging", "drug_deal"],
      dropChance: 0.05,
      setSize: 10,
    },
    pointSources: [{ action: "collectible_found", points: 100 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, reward: { dc: 300000, nc: 50, titles: ["Cache King"] } },
      { rankFrom: 2, rankTo: 10, reward: { dc: 75000, nc: 10, titles: [] } },
    ],
  },
  milestone: {
    name: "City Milestone Push",
    slug: "city-milestone-push",
    type: "milestone",
    description: "The entire city works together to hit collective targets.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "CITY PUSH",
      primaryColor: "#00d4ff",
      accentColor: "#39d353",
      backgroundColor: "#00070d",
      bannerImageUrl: "",
      chatBadgeText: "PUSH",
      chatBadgeColor: "#00d4ff",
    },
    milestones: [
      { label: "Phase 1 — First Wave", target: 1000, action: "heist" },
      { label: "Phase 2 — Surge", target: 5000, action: "heist" },
      { label: "Phase 3 — Conquest", target: 20000, action: "heist" },
    ],
    pointSources: [{ action: "heist", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 100, reward: { dc: 25000, nc: 5, titles: [] } },
    ],
  },
  sports: {
    name: "District Wars",
    slug: "district-wars",
    type: "sports",
    description: "Represent your district and fight for supremacy.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "DISTRICT WARS",
      primaryColor: "#f59e0b",
      accentColor: "#ff2d55",
      backgroundColor: "#0a0700",
      bannerImageUrl: "",
      chatBadgeText: "WAR",
      chatBadgeColor: "#f59e0b",
    },
    teams: [
      { id: "northside", name: "Northside Syndicate", color: "#00d4ff" },
      { id: "southside", name: "Southside Crew", color: "#ff2d55" },
      { id: "eastend",   name: "East End Mob",       color: "#39d353" },
      { id: "westgate",  name: "Westgate Outfit",    color: "#a855f7" },
    ],
    pointSources: [{ action: "arena_win", points: 5 }, { action: "heist", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 1, reward: { dc: 350000, nc: 60, titles: ["District Champion"] } },
      { rankFrom: 2, rankTo: 10, reward: { dc: 80000, nc: 15, titles: [] } },
    ],
  },
  lottery: {
    name: "Crime Lottery",
    slug: "crime-lottery",
    type: "lottery",
    description: "Earn tickets through actions and win the grand prize draw.",
    startsAt: "",
    endsAt: "",
    theme: {
      gameDisplayName: "CRIME LOTTERY",
      primaryColor: "#f59e0b",
      accentColor: "#a855f7",
      backgroundColor: "#090500",
      bannerImageUrl: "",
      chatBadgeText: "LOTTERY",
      chatBadgeColor: "#f59e0b",
    },
    lottery: {
      ticketSource: "heist,mugging",
      ticketsPerAction: 1,
      winnersCount: 5,
    },
    pointSources: [{ action: "heist", points: 1 }],
    leaderboardRewards: [
      { rankFrom: 1, rankTo: 5, reward: { dc: 1000000, nc: 200, titles: ["Jackpot"] } },
    ],
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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const s: React.CSSProperties = {
  background: "#111118",
  border: "1px solid #1e1e2e",
  borderRadius: 4,
  padding: "16px 18px",
};

export default function EventGameModesTab({ addToast }: Props) {
  const [selectedType, setSelectedType] = useState<string>("boss_raid");
  const [json, setJson] = useState(() => JSON.stringify(TEMPLATES.boss_raid, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadTemplate(type: string) {
    setSelectedType(type);
    setJson(JSON.stringify(TEMPLATES[type] ?? {}, null, 2));
    setJsonError(null);
  }

  function handleJsonChange(v: string) {
    setJson(v);
    try {
      JSON.parse(v);
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError((e as Error).message);
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const body = JSON.parse(json);
      await api.post<unknown>("/owner/events", body);
      addToast("Event created (status: draft)", "success");
    } catch (e: unknown) {
      addToast((e as { message?: string })?.message ?? "Failed to create event", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div style={s}>
        <div className="font-mono text-xs font-bold mb-1" style={{ color: "#f59e0b", letterSpacing: "0.1em" }}>
          CUSTOM EVENT GAME MODE BUILDER
        </div>
        <div className="font-mono text-xs" style={{ color: "#475569" }}>
          Choose a template, customize the JSON config, then create the event as a draft. Events start with status <code style={{ color: "#a855f7" }}>draft</code> — activate them via the Events tab or by editing the document.
        </div>
      </div>

      {/* Template selector */}
      <div style={s}>
        <div className="font-mono text-xs font-bold mb-3" style={{ color: "#64748b", letterSpacing: "0.1em" }}>
          SELECT TEMPLATE
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.keys(TEMPLATES).map(type => (
            <button
              key={type}
              onClick={() => loadTemplate(type)}
              className="px-3 py-2 rounded text-left font-mono text-xs transition-all"
              style={{
                background: selectedType === type ? "#f59e0b18" : "#08080c",
                color: selectedType === type ? "#f59e0b" : "#475569",
                border: `1px solid ${selectedType === type ? "#f59e0b40" : "#1e1e2e"}`,
              }}
            >
              {TEMPLATE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* JSON editor */}
      <div style={s}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-xs font-bold" style={{ color: "#64748b", letterSpacing: "0.1em" }}>
            EVENT CONFIG — JSON
          </div>
          {jsonError && (
            <div className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ color: "#ef4444", background: "#ef444415", border: "1px solid #ef444430" }}>
              ✗ {jsonError}
            </div>
          )}
          {!jsonError && (
            <div className="font-mono text-[10px]" style={{ color: "#39d353" }}>✓ Valid JSON</div>
          )}
        </div>
        <textarea
          value={json}
          onChange={e => handleJsonChange(e.target.value)}
          spellCheck={false}
          className="w-full font-mono text-xs p-3 rounded-sm resize-y"
          style={{
            background: "#0a0a0f",
            border: `1px solid ${jsonError ? "#ef444440" : "#1e1e2e"}`,
            color: "#e2e8f0",
            outline: "none",
            minHeight: 360,
            maxHeight: 640,
            lineHeight: 1.6,
          }}
        />
        <div className="mt-2 font-mono text-[10px]" style={{ color: "#334155" }}>
          Set <code>startsAt</code> and <code>endsAt</code> as ISO 8601 strings. Event is created with status <code>draft</code>.
        </div>
      </div>

      {/* Create button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={saving || !!jsonError}
          className="font-mono text-xs px-6 py-2.5 rounded font-bold uppercase tracking-widest transition-all"
          style={{
            background: saving || jsonError ? "#111118" : "#f59e0b18",
            color: saving || jsonError ? "#475569" : "#f59e0b",
            border: `1px solid ${saving || jsonError ? "#1e1e2e" : "#f59e0b40"}`,
            cursor: saving || jsonError ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Creating…" : "Create Event (Draft)"}
        </button>
        <div className="font-mono text-[10px]" style={{ color: "#334155" }}>
          POST /api/owner/events
        </div>
      </div>
    </div>
  );
}
