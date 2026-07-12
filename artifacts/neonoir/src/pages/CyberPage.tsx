/**
 * CyberPage — Wire Cartel Section 8 (cybernetic implants)
 * Install/remove implants. Humanity Loss counter with threshold effects.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

interface Props {
  user: User;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface ImplantEntry {
  id: string;
  name: string;
  slot: string;
  cost: number;
  humanityCost: number;
  minLevel: number;
  stats: Record<string, number>;
  description: string;
  installed: boolean;
  slotTaken: boolean;
  available: boolean;
  canAfford: boolean;
}

interface Threshold { at: number; label: string; effect: string }

interface CatalogData {
  catalog: ImplantEntry[];
  installed: Array<{ id: string; name: string; slot: string; installedAt: string }>;
  humanityLoss: number;
  activeThreshold: Threshold | null;
  thresholds: Threshold[];
}

const SLOT_COLORS: Record<string, string> = {
  neural: "#00d4ff",
  optical: "#a855f7",
  skeletal: "#ff6b35",
  dermal: "#39d353",
  cardiac: "#ff2d55",
};

const SLOT_ICONS: Record<string, string> = {
  neural: "🧠",
  optical: "👁️",
  skeletal: "🦴",
  dermal: "🛡️",
  cardiac: "❤️",
};

const STAT_LABELS: Record<string, string> = {
  strength: "STR",
  charisma: "CHA",
  intelligence: "INT",
  streetCred: "SC",
};

export default function CyberPage({ user, addToast }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CatalogData>({
    queryKey: ["cyber-catalog"],
    queryFn: () => api.get("/cyber/catalog"),
  });

  const install = useMutation({
    mutationFn: (id: string) => api.post(`/cyber/install/${id}`, {}),
    onSuccess: (r: any) => {
      addToast(r.message, "success");
      if (r.newThreshold) addToast(`THRESHOLD REACHED: ${r.newThreshold.label} — ${r.newThreshold.effect}`, "warning");
      qc.invalidateQueries({ queryKey: ["cyber-catalog"] });
      setConfirmId(null);
    },
    onError: (e: Error) => { addToast(e.message, "error"); setConfirmId(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.post(`/cyber/remove/${id}`, {}),
    onSuccess: (r: any) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["cyber-catalog"] });
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const SLOTS = ["all", "neural", "optical", "skeletal", "dermal", "cardiac"];
  const humanityLoss = data?.humanityLoss ?? 0;
  const maxHumanity = 9;
  const humanityPct = Math.min(100, (humanityLoss / maxHumanity) * 100);
  const humanityColor = humanityLoss >= 9 ? "#ff2d55" : humanityLoss >= 6 ? "#ff6b35" : humanityLoss >= 3 ? "#f59e0b" : "#39d353";

  const filteredCatalog = (data?.catalog ?? []).filter(
    imp => filter === "all" || imp.slot === filter
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      <div className="dl-page-bg bg-hospital" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-mono font-bold text-lg" style={{ color: "#00d4ff" }}>CYBER-DOC</h2>
          <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>
            Augmentation suite — {data?.installed.length ?? 0} implants installed
          </p>
        </div>
        <div className="font-mono text-xs text-right">
          <div style={{ color: "#64748b" }}>Level {user.level}</div>
          <div style={{ color: "#f59e0b" }}>{user.dc.toLocaleString()} DC</div>
        </div>
      </div>

      {/* Humanity Loss meter */}
      <div className="rounded-lg p-4 space-y-2" style={{ background: "#111118", border: `1px solid ${humanityColor}40` }}>
        <div className="flex justify-between items-center">
          <span className="font-mono text-xs font-bold" style={{ color: humanityColor }}>
            HUMANITY LOSS — {humanityLoss}/{maxHumanity}
            {data?.activeThreshold ? ` [${data.activeThreshold.label.toUpperCase()}]` : " [Clean]"}
          </span>
          <span className="font-mono text-xs" style={{ color: "#475569" }}>implants: {data?.installed.length ?? 0}</span>
        </div>
        <div className="h-3 rounded-full" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: `${humanityPct}%`, background: humanityColor, boxShadow: `0 0 8px ${humanityColor}60` }}
          />
        </div>
        {/* Threshold markers */}
        <div className="flex justify-between relative">
          {(data?.thresholds ?? []).map(t => (
            <div key={t.at} className="text-center" style={{ position: "absolute", left: `${(t.at / maxHumanity) * 100}%`, transform: "translateX(-50%)" }}>
              <div className="font-mono text-xs" style={{ color: humanityLoss >= t.at ? humanityColor : "#334155" }}>
                ▲{t.at}
              </div>
            </div>
          ))}
        </div>
        {data?.activeThreshold && (
          <div className="font-mono text-xs p-2 rounded mt-2" style={{ background: `${humanityColor}12`, color: humanityColor }}>
            ⚠ {data.activeThreshold.effect}
          </div>
        )}
        {!data?.activeThreshold && (
          <div className="font-mono text-xs" style={{ color: "#334155" }}>No active threshold effects. Next: {3 - humanityLoss > 0 ? `${3 - humanityLoss} more to Augmented` : "already triggered"}</div>
        )}
      </div>

      {/* Installed implants */}
      {(data?.installed.length ?? 0) > 0 && (
        <div className="rounded-lg p-4 space-y-2" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="font-mono text-xs font-bold mb-3" style={{ color: "#94a3b8" }}>INSTALLED IMPLANTS</div>
          {data!.installed.map(imp => {
            const cat = data?.catalog.find(c => c.id === imp.id);
            const sc = SLOT_COLORS[imp.slot] ?? "#64748b";
            const removalCost = cat ? Math.floor(cat.cost * 0.3) : 0;
            return (
              <div key={imp.id} className="flex items-center justify-between rounded p-3" style={{ background: "#0a0a0f", border: `1px solid ${sc}30` }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: sc }}>{SLOT_ICONS[imp.slot] ?? "🔩"}</span>
                  <div>
                    <div className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>{imp.name}</div>
                    <div className="font-mono text-xs" style={{ color: "#64748b" }}>
                      {imp.slot} · {cat ? Object.entries(cat.stats).map(([k, v]) => `+${v} ${STAT_LABELS[k] ?? k}`).join(", ") : ""}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => remove.mutate(imp.id)}
                  disabled={remove.isPending}
                  className="font-mono text-xs px-3 py-1 rounded"
                  style={{ background: "#ff2d5512", color: "#ff2d55", border: "1px solid #ff2d5530", cursor: "pointer" }}
                  title={`Remove: costs ${removalCost.toLocaleString()} DC, recovers ${Math.ceil((cat?.humanityCost ?? 1) / 2)} humanity`}
                >
                  Remove ({removalCost.toLocaleString()} DC)
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Slot filter */}
      <div className="flex gap-2 flex-wrap">
        {SLOTS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="font-mono text-xs px-3 py-1 rounded capitalize transition-all"
            style={{
              background: filter === s ? (SLOT_COLORS[s] ?? "#00d4ff") + "22" : "#111118",
              color: filter === s ? (SLOT_COLORS[s] ?? "#00d4ff") : "#64748b",
              border: `1px solid ${filter === s ? (SLOT_COLORS[s] ?? "#00d4ff") + "60" : "#1e1e2e"}`,
            }}
          >
            {s === "all" ? "All Slots" : `${SLOT_ICONS[s] ?? ""} ${s}`}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {isLoading && (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading augmentation catalog...</div>
      )}
      <div className="space-y-3">
        {filteredCatalog.map(imp => {
          const sc = SLOT_COLORS[imp.slot] ?? "#64748b";
          const isInstalling = install.isPending && confirmId === imp.id;
          const isConfirming = confirmId === imp.id;
          const blocked = !imp.available || imp.slotTaken;

          return (
            <div
              key={imp.id}
              className="rounded-lg p-4"
              style={{
                background: "#111118",
                border: `1px solid ${imp.installed ? sc + "60" : blocked ? "#1e1e2e" : "#1e1e2e"}`,
                opacity: blocked && !imp.installed ? 0.6 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xl" style={{ color: imp.installed ? sc : "#475569" }}>
                    {SLOT_ICONS[imp.slot] ?? "🔩"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm" style={{ color: imp.installed ? sc : "#e2e8f0" }}>
                        {imp.name}
                      </span>
                      {imp.installed && (
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: sc + "22", color: sc }}>INSTALLED</span>
                      )}
                      {imp.slotTaken && !imp.installed && (
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#ff6b3522", color: "#ff6b35" }}>SLOT TAKEN</span>
                      )}
                      {!imp.available && (
                        <span className="font-mono text-xs" style={{ color: "#ff2d55" }}>Lv.{imp.minLevel}</span>
                      )}
                    </div>
                    <p className="font-mono text-xs mt-0.5" style={{ color: "#64748b" }}>{imp.description}</p>
                    <div className="flex gap-3 mt-1 font-mono text-xs flex-wrap">
                      <span style={{ color: "#f59e0b" }}>{imp.cost.toLocaleString()} DC</span>
                      <span style={{ color: "#ff2d55" }}>-{imp.humanityCost} humanity</span>
                      {Object.entries(imp.stats).map(([k, v]) => (
                        <span key={k} style={{ color: "#39d353" }}>+{v} {STAT_LABELS[k] ?? k}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {!imp.installed && (
                  <div className="flex-shrink-0">
                    {isConfirming ? (
                      <div className="flex gap-2 items-center">
                        <span className="font-mono text-xs" style={{ color: "#ff6b35" }}>Confirm?</span>
                        <button
                          onClick={() => install.mutate(imp.id)}
                          disabled={isInstalling}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: "#39d35322", color: "#39d353", border: "1px solid #39d35340", cursor: "pointer" }}
                        >
                          {isInstalling ? "..." : "Yes"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: "#ff2d5522", color: "#ff2d55", border: "1px solid #ff2d5540", cursor: "pointer" }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(imp.id)}
                        disabled={!imp.available || imp.slotTaken || !imp.canAfford}
                        className="font-mono text-xs px-3 py-1 rounded"
                        style={{
                          background: (!imp.available || imp.slotTaken || !imp.canAfford) ? "#1e1e2e" : sc + "22",
                          color: (!imp.available || imp.slotTaken || !imp.canAfford) ? "#475569" : sc,
                          border: `1px solid ${(!imp.available || imp.slotTaken || !imp.canAfford) ? "#1e1e2e" : sc + "40"}`,
                          cursor: (!imp.available || imp.slotTaken || !imp.canAfford) ? "not-allowed" : "pointer",
                        }}
                      >
                        {!imp.canAfford ? "No DC" : "Install"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
