/**
 * CompanionsPage — Hire and manage city companions.
 * GET /world/companions/catalog  → array of blueprints
 * GET /world/companions/mine     → owned companions
 * POST /world/companions/hire    → { type }
 * POST /world/companions/:id/upkeep → pay daily upkeep
 */

import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";
import { formatDC } from "../lib/format";
import { AnimatedCard } from "../components/AnimatedCard";
import { CyberSectionHeader } from "../components/CyberSectionHeader";
import { CyberButton } from "../components/CyberButton";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

interface Blueprint {
  type: string;
  name: string;
  baseCost: number;
  upkeepPerDay: number;
  description: string;
  effect: string;
}

interface OwnedCompanion {
  id: string;
  type: string;
  name: string;
  upkeepPerDay: number;
  lastUpkeepAt?: string;
}

const EFFECT_LABELS: Record<string, string> = {
  race_timing_bonus:  "⚡ Race timing forgiveness",
  hack_auto:          "💻 Auto-complete low-tier Net puzzles",
  raid_reduction:     "🛡 Reduces offline raid chance",
  sentence_reduction: "⚖ Reduces jail time by 20%",
  intel:              "🕵 Tips on rival crew movements",
};

const TYPE_COLORS: Record<string, string> = {
  driver:      "#00d4ff",
  hacking_bot: "#a855f7",
  guard_dog:   "#ff6b35",
  lawyer:      "#f59e0b",
  informant:   "#39d353",
};

export function CompanionsPage({ user, refreshUser, addToast }: Props) {
  const [catalog,    setCatalog]    = useState<Blueprint[]>([]);
  const [owned,      setOwned]      = useState<OwnedCompanion[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hiring,     setHiring]     = useState<string | null>(null);
  const [payingUpkeep, setPayingUpkeep] = useState<string | null>(null);

  async function load() {
    try {
      const [cat, mine] = await Promise.all([
        api.get<Blueprint[]>("/world/companions/catalog"),
        api.get<OwnedCompanion[]>("/world/companions/mine"),
      ]);
      setCatalog(cat);
      setOwned(mine);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function hire(type: string) {
    setHiring(type);
    try {
      const r = await api.post<{ message: string }>("/world/companions/hire", { type });
      addToast(r.message, "success");
      await refreshUser();
      await load();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally { setHiring(null); }
  }

  async function payUpkeep(compId: string) {
    setPayingUpkeep(compId);
    try {
      const r = await api.post<{ message: string }>(`/world/companions/${compId}/upkeep`);
      addToast(r.message, "success");
      await refreshUser();
      await load();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally { setPayingUpkeep(null); }
  }

  if (loading) {
    return (
      <div className="font-mono text-xs text-center py-16" style={{ color: "#334155" }}>
        Loading companions…
      </div>
    );
  }

  const ownedTypes = new Set(owned.map(o => o.type));
  const maxReached = owned.length >= 3;

  return (
    <div className="space-y-4 max-w-2xl mx-auto relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      <AnimatedCard accent="#f59e0b">
        <CyberSectionHeader title="COMPANIONS" accent="#f59e0b" cursor />
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Hire city contacts to boost your operations. Max 3 companions. Pay daily upkeep to keep them active.
        </p>
        <div className="flex gap-4 mt-2">
          <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>
            Hired: <span style={{ color: "#f59e0b" }}>{owned.length} / 3</span>
          </span>
          <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>
            Your DC: <span style={{ color: "#f59e0b" }}>{formatDC(user.dc)}</span>
          </span>
        </div>
      </AnimatedCard>

      {/* Active companions */}
      {owned.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-xs font-bold px-1" style={{ color: "#64748b", letterSpacing: "0.1em" }}>
            YOUR COMPANIONS
          </div>
          {owned.map(comp => {
            const color = TYPE_COLORS[comp.type] ?? "#94a3b8";
            const lastPaid = comp.lastUpkeepAt ? new Date(comp.lastUpkeepAt) : null;
            const hoursAgo = lastPaid ? Math.floor((Date.now() - lastPaid.getTime()) / 3_600_000) : null;
            const overdue = hoursAgo !== null && hoursAgo >= 24;
            return (
              <AnimatedCard key={comp.id} accent={color}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-mono font-bold text-sm" style={{ color }}>
                      {comp.name}
                    </div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
                      {formatDC(comp.upkeepPerDay)} DC/day upkeep
                      {hoursAgo !== null && (
                        <span style={{ color: overdue ? "#ff2d55" : "#64748b", marginLeft: 8 }}>
                          {overdue ? `⚠ ${hoursAgo}h since last payment` : `✓ paid ${hoursAgo}h ago`}
                        </span>
                      )}
                    </div>
                  </div>
                  <CyberButton
                    variant={overdue ? "danger" : "ghost"}
                    size="sm"
                    loading={payingUpkeep === comp.id}
                    onClick={() => payUpkeep(comp.id)}
                  >
                    Pay Upkeep
                  </CyberButton>
                </div>
              </AnimatedCard>
            );
          })}
        </div>
      )}

      {/* Catalog */}
      <div className="space-y-2">
        <div className="font-mono text-xs font-bold px-1" style={{ color: "#64748b", letterSpacing: "0.1em" }}>
          AVAILABLE FOR HIRE
        </div>
        {catalog.map(bp => {
          const color = TYPE_COLORS[bp.type] ?? "#94a3b8";
          const alreadyOwned = ownedTypes.has(bp.type);
          const canAfford = user.dc >= bp.baseCost;
          const effectLabel = EFFECT_LABELS[bp.effect] ?? bp.effect;
          return (
            <AnimatedCard key={bp.type} accent={color}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-sm" style={{ color }}>
                    {bp.name}
                  </div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                    {bp.description}
                  </div>
                  <div className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
                    {effectLabel}
                  </div>
                  <div className="flex gap-4 mt-1.5 font-mono text-xs flex-wrap">
                    <span style={{ color: "#f59e0b" }}>Hire: {formatDC(bp.baseCost)} DC</span>
                    <span style={{ color: "#64748b" }}>Upkeep: {formatDC(bp.upkeepPerDay)} DC/day</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {alreadyOwned ? (
                    <span className="font-mono text-xs px-2 py-1 rounded" style={{ background: "#39d35320", color: "#39d353", border: "1px solid #39d35330" }}>
                      Hired
                    </span>
                  ) : (
                    <CyberButton
                      variant="warning"
                      size="sm"
                      loading={hiring === bp.type}
                      disabled={maxReached || !canAfford || hiring === bp.type}
                      onClick={() => hire(bp.type)}
                    >
                      {maxReached ? "Slots Full" : !canAfford ? "No funds" : "Hire"}
                    </CyberButton>
                  )}
                </div>
              </div>
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}
