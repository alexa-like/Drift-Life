import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User } from "../lib/types";

function timeSinceCollect(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ago`;
  if (h > 0)   return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

interface OwnedProp {
  id: string;
  upgradeLevel: number;
  pendingIncome: number;
  lastCollectedAt: string;
  maxUpgrades: number;
}

interface PropEntry {
  type: string;
  name: string;
  cost: number;
  baseIncome: number;
  description: string;
  minLevel: number;
  storageSlots: number;
  locked: boolean;
  owned: OwnedProp[];
}

interface Props {
  user: User;
  refreshUser: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function PropertiesPage({ user, refreshUser, addToast }: Props) {
  const qc = useQueryClient();

  const { data: catalog = [], isLoading } = useQuery<PropEntry[]>({
    queryKey: ["properties"],
    queryFn: () => api.get("/properties"),
  });

  const buy = useMutation({
    mutationFn: (type: string) => api.post("/properties/buy", { type }),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["properties"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const upgrade = useMutation({
    mutationFn: (id: string) => api.post(`/properties/${id}/upgrade`, {}),
    onSuccess: (r: { message: string }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["properties"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const collect = useMutation({
    mutationFn: (id: string) => api.post(`/properties/${id}/collect`, {}),
    onSuccess: (r: { message: string; income: number }) => {
      addToast(r.message, "success");
      qc.invalidateQueries({ queryKey: ["properties"] });
      refreshUser();
    },
    onError: (e: Error) => addToast(e.message, "error"),
  });

  const totalPending = catalog.flatMap((e) => e.owned).reduce((s, p) => s + p.pendingIncome, 0);

  return (
    <div className="space-y-4 relative z-10">
      <div className="dl-page-bg bg-city" />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />
      <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        <h2 className="font-mono font-bold text-lg" style={{ color: "#39d353" }}>PROPERTIES</h2>
        <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>
          Invest in real estate. Properties generate passive DC income up to 7 days.
        </p>
        {totalPending > 0 && (
          <div className="mt-2 font-mono text-sm" style={{ color: "#f59e0b" }}>
            {totalPending.toLocaleString()} DC pending across all properties
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="font-mono text-xs text-center py-10" style={{ color: "#334155" }}>Loading properties...</div>
      ) : (
        <div className="space-y-4">
          {catalog.map((entry) => (
            <div key={entry.type} className="rounded-lg p-4" style={{ background: "#111118", border: `1px solid ${entry.locked ? "#1e1e2e" : "#39d35330"}` }}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold" style={{ color: entry.locked ? "#334155" : "#39d353" }}>{entry.name}</span>
                    {entry.locked && <span className="font-mono text-xs" style={{ color: "#334155" }}>Lv.{entry.minLevel} required</span>}
                  </div>
                  <p className="font-mono text-xs mt-1" style={{ color: "#64748b" }}>{entry.description}</p>
                  <div className="flex gap-4 mt-1 font-mono text-xs" style={{ color: "#94a3b8" }}>
                    <span>{entry.baseIncome.toLocaleString()} DC/hr base</span>
                    <span>{entry.storageSlots} storage slots</span>
                    <span>{entry.cost.toLocaleString()} DC</span>
                  </div>
                </div>
                {!entry.locked && (
                  <button
                    onClick={() => buy.mutate(entry.type)}
                    disabled={buy.isPending || user.dc < entry.cost}
                    className="font-mono text-xs px-4 py-1 rounded"
                    style={{
                      background: user.dc >= entry.cost ? "#39d35322" : "#1e1e2e",
                      color: user.dc >= entry.cost ? "#39d353" : "#334155",
                      border: `1px solid ${user.dc >= entry.cost ? "#39d35340" : "#1e1e2e"}`,
                      cursor: user.dc >= entry.cost ? "pointer" : "not-allowed",
                    }}
                  >
                    Buy
                  </button>
                )}
              </div>

              {entry.owned.length > 0 && (
                <div className="mt-3 space-y-2 pt-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                  {entry.owned.map((prop) => {
                    const upgradeCost = Math.floor(entry.cost * 0.3 * (prop.upgradeLevel + 1));
                    const income = Math.floor(entry.baseIncome * (1 + prop.upgradeLevel * 0.2));
                    return (
                      <div key={prop.id} className="rounded p-3 space-y-2" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                        {/* Income buffer progress bar */}
                        {(() => {
                          const maxStorage = income * 24 * 7; // 7-day cap
                          const fillPct    = Math.min(100, (prop.pendingIncome / maxStorage) * 100);
                          const fillColor  = fillPct >= 90 ? "#ff2d55" : fillPct >= 60 ? "#f59e0b" : "#39d353";
                          return (
                            <div>
                              <div className="flex justify-between font-mono text-xs mb-1" style={{ color: "#64748b" }}>
                                <span>Buffer: {prop.pendingIncome.toLocaleString()} / {maxStorage.toLocaleString()} DC</span>
                                <span>{fillPct.toFixed(0)}% full · collected {timeSinceCollect(prop.lastCollectedAt)}</span>
                              </div>
                              <div style={{ height: 4, background: "#1e1e2e", borderRadius: 2 }}>
                                <div style={{ height: 4, width: `${fillPct}%`, background: fillColor, borderRadius: 2, transition: "width 0.4s" }} />
                              </div>
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-mono text-xs" style={{ color: "#94a3b8" }}>
                            Level {prop.upgradeLevel}/5 · {income.toLocaleString()} DC/hr
                          </div>
                          <div className="flex gap-2">
                            {prop.pendingIncome >= 1 && (
                              <button
                                onClick={() => collect.mutate(prop.id)}
                                disabled={collect.isPending}
                                className="font-mono text-xs px-3 py-0.5 rounded"
                                style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b40", cursor: "pointer" }}
                              >
                                Collect {prop.pendingIncome.toLocaleString()} DC
                              </button>
                            )}
                            {prop.upgradeLevel < 5 && (
                              <button
                                onClick={() => upgrade.mutate(prop.id)}
                                disabled={upgrade.isPending || user.dc < upgradeCost}
                                className="font-mono text-xs px-3 py-0.5 rounded"
                                style={{
                                  background: user.dc >= upgradeCost ? "#00d4ff22" : "#1e1e2e",
                                  color: user.dc >= upgradeCost ? "#00d4ff" : "#334155",
                                  border: `1px solid ${user.dc >= upgradeCost ? "#00d4ff40" : "#1e1e2e"}`,
                                  cursor: user.dc >= upgradeCost ? "pointer" : "not-allowed",
                                }}
                              >
                                Upgrade ({upgradeCost.toLocaleString()} DC)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
