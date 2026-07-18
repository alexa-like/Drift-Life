import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { AnimatedCard } from "../components/AnimatedCard";
import { formatDC } from "../lib/format";
import { Shield } from "lucide-react";

// ── Faction definitions ────────────────────────────────────────────────────
const FACTION_DEFS: Record<string, {
  name: string; color: string; glowColor: string; emblem: string; tagline: string;
  perks: string[]; description: string;
}> = {
  suits: {
    name: "The Suits",
    color: "#f59e0b",
    glowColor: "#f59e0b40",
    emblem: "◆",
    tagline: "Money is power. Power is everything.",
    perks: [
      "+10% DC earned from all jobs",
      "+5% success on Scam & Corporate Espionage",
      "Market discount in Downtown Core",
      "Suits-only black market access",
    ],
    description:
      "Corporate players with fingers in every pie. They run Downtown Core from glass towers and wield lawyers like weapons.",
  },
  street: {
    name: "The Street",
    color: "#ff6b35",
    glowColor: "#ff6b3540",
    emblem: "◉",
    tagline: "Take what you need. Leave the rest bleeding.",
    perks: [
      "+10% DC from PvP wins",
      "+5% success on Break-In & Heist",
      "+10% XP from all combat",
      "Street-only combat gear access",
    ],
    description:
      "Born on the pavement, bred in the alley. The Street runs on reputation and violence.",
  },
  grid: {
    name: "The Grid",
    color: "#00d4ff",
    glowColor: "#00d4ff40",
    emblem: "◈",
    tagline: "All systems are vulnerable. Including you.",
    perks: [
      "-10% Energy cost on all jobs",
      "+5% success on Data Breach & Scam",
      "Access to Grid-only hacking jobs",
      "Tech Quarter market discount",
    ],
    description:
      "Ghosts in the machine. Grid operatives move through systems like water through cracks.",
  },
};

interface FactionStat {
  rank: number;
  faction: string;
  players: number;
  avgLevel: number;
  totalDc: number;
}

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function FactionPage({ user, addToast }: Props) {
  const myFaction = user.faction ?? null;
  const def = myFaction ? FACTION_DEFS[myFaction] : null;

  const { data: standings, isLoading: loadingStandings } = useQuery<FactionStat[]>({
    queryKey: ["leaderboard", "faction"],
    queryFn: () => api.get("/leaderboard/faction").then(r => r.data),
    staleTime: 60_000,
  });

  // Top members in user's own faction
  const { data: topMembers, isLoading: loadingMembers } = useQuery<any[]>({
    queryKey: ["leaderboard", "wealth"],
    queryFn: () =>
      api.get("/leaderboard?category=wealth&limit=50").then(r =>
        (r.data as any[]).filter((p: any) => p.faction === myFaction).slice(0, 8)
      ),
    enabled: !!myFaction,
    staleTime: 60_000,
  });

  // ── No faction ─────────────────────────────────────────────────────────────
  if (!myFaction || !def) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6" style={{ background: "#050505" }}>
        <div className="scanlines absolute inset-0 pointer-events-none" />
        <Shield size={48} color="#334155" />
        <p className="font-mono text-sm text-center" style={{ color: "#64748b" }}>
          You haven't chosen a faction yet.<br />Complete the onboarding to align yourself.
        </p>
      </div>
    );
  }

  const rankBadge = (r: number) =>
    r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`;

  return (
    <div className="min-h-screen pb-28 px-3 pt-4 space-y-4" style={{ background: "#050505" }}>
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      {/* ── Faction banner ── */}
      <div
        className="relative rounded-lg overflow-hidden p-5 flex flex-col gap-3"
        style={{
          background: `linear-gradient(135deg, #0a0a12 60%, ${def.glowColor})`,
          border: `1px solid ${def.color}40`,
          boxShadow: `0 0 32px ${def.glowColor}`,
        }}
      >
        {/* Decorative corner glow */}
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-bl-full"
          style={{ background: `radial-gradient(circle, ${def.glowColor} 0%, transparent 70%)` }}
        />

        <div className="flex items-center gap-4">
          <span
            className="text-4xl font-mono font-bold select-none"
            style={{ color: def.color, textShadow: `0 0 20px ${def.color}` }}
          >
            {def.emblem}
          </span>
          <div>
            <h1 className="font-mono font-bold text-xl tracking-widest uppercase" style={{ color: def.color }}>
              {def.name}
            </h1>
            <p className="font-mono text-xs italic" style={{ color: `${def.color}99` }}>
              {def.tagline}
            </p>
          </div>
        </div>

        <p className="font-mono text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
          {def.description}
        </p>
      </div>

      {/* ── Active perks ── */}
      <AnimatedCard>
        <CyberSectionHeader icon={Star} label="Faction Perks" color={def.color} />
        <div className="mt-3 space-y-2">
          {def.perks.map((perk, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded px-3 py-2"
              style={{ background: "#0d0d1a", border: `1px solid ${def.color}20` }}
            >
              <span className="text-xs" style={{ color: def.color }}>▸</span>
              <span className="font-mono text-xs" style={{ color: "#cbd5e1" }}>{perk}</span>
            </div>
          ))}
        </div>
      </AnimatedCard>

      {/* ── Faction standings ── */}
      <AnimatedCard>
        <CyberSectionHeader icon={TrendingUp} label="Faction War — Standings" color="#00d4ff" />
        {loadingStandings ? (
          <p className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>Loading…</p>
        ) : (
          <div className="mt-3 space-y-2">
            {(standings ?? []).map(s => {
              const sd = FACTION_DEFS[s.faction];
              const isMe = s.faction === myFaction;
              return (
                <div
                  key={s.faction}
                  className="flex items-center gap-3 rounded px-3 py-3"
                  style={{
                    background: isMe ? `${sd?.color ?? "#334155"}15` : "#0d0d1a",
                    border: isMe
                      ? `1px solid ${sd?.color ?? "#334155"}60`
                      : "1px solid #1e1e2e",
                    boxShadow: isMe ? `0 0 12px ${sd?.color ?? "#334155"}20` : "none",
                  }}
                >
                  <span className="font-mono text-base w-6 text-center">{rankBadge(s.rank)}</span>
                  <span
                    className="text-lg select-none"
                    style={{ color: sd?.color ?? "#64748b", textShadow: `0 0 10px ${sd?.color}` }}
                  >
                    {sd?.emblem ?? "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-mono text-xs font-bold uppercase tracking-wider"
                      style={{ color: sd?.color ?? "#94a3b8" }}
                    >
                      {sd?.name ?? s.faction}
                      {isMe && (
                        <span
                          className="ml-2 text-[9px] rounded px-1 py-0.5"
                          style={{ background: `${sd?.color}20`, color: sd?.color, border: `1px solid ${sd?.color}40` }}
                        >
                          YOU
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px]" style={{ color: "#64748b" }}>
                      {s.players} members · avg lv {Math.round(s.avgLevel ?? 0)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs font-bold" style={{ color: "#00d4ff" }}>
                      {formatDC(s.totalDc ?? 0)}
                    </p>
                    <p className="font-mono text-[9px]" style={{ color: "#475569" }}>total DC</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AnimatedCard>

      {/* ── Top members in my faction ── */}
      {myFaction && (
        <AnimatedCard>
          <CyberSectionHeader icon={Users} label={`${def.name} — Top Members`} color={def.color} />
          {loadingMembers ? (
            <p className="font-mono text-xs text-center py-6" style={{ color: "#475569" }}>Loading…</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {(topMembers ?? []).length === 0 ? (
                <p className="font-mono text-xs text-center py-4" style={{ color: "#475569" }}>No members found</p>
              ) : (
                (topMembers ?? []).map((m: any, i: number) => (
                  <div
                    key={m.id ?? i}
                    className="flex items-center gap-3 rounded px-3 py-2"
                    style={{
                      background: m.username === user.username ? `${def.color}10` : "#0d0d1a",
                      border: m.username === user.username
                        ? `1px solid ${def.color}40`
                        : "1px solid #1e1e2e",
                    }}
                  >
                    <span className="font-mono text-xs w-5 text-center" style={{ color: "#475569" }}>
                      {rankBadge(i + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold truncate" style={{ color: m.username === user.username ? def.color : "#cbd5e1" }}>
                        {m.username}
                        {m.username === user.username && (
                          <span className="ml-1 text-[9px]" style={{ color: def.color }}>← you</span>
                        )}
                      </p>
                      <p className="font-mono text-[10px]" style={{ color: "#475569" }}>
                        Lv {m.level} · {m.rank ?? "Civilian"}
                      </p>
                    </div>
                    <span className="font-mono text-xs shrink-0" style={{ color: "#00d4ff" }}>
                      {formatDC(m.dc ?? 0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </AnimatedCard>
      )}

      {/* ── Faction bank note ── */}
      <AnimatedCard>
        <CyberSectionHeader icon={Landmark} label="Faction Bank" color="#64748b" />
        <p className="font-mono text-xs mt-3 leading-relaxed" style={{ color: "#64748b" }}>
          Your faction's finances are managed through your crew (guild). Join or create a crew to access the faction bank, buy faction perks, and fund faction operations.
        </p>
        <div
          className="mt-3 rounded px-3 py-2 flex items-center gap-2"
          style={{ background: "#0d0d1a", border: "1px solid #1e1e2e" }}
        >
          <Shield size={14} color="#475569" />
          <span className="font-mono text-xs" style={{ color: "#475569" }}>
            Navigate to <span style={{ color: "#94a3b8" }}>Crew</span> to manage guild bank & perks
          </span>
        </div>
      </AnimatedCard>
    </div>
  );
}
