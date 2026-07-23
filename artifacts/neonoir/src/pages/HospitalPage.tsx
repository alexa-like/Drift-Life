import { useState, useEffect, useCallback } from "react";
import { User, Item } from "../shared/types";
import { api } from "../shared/api";
import { formatDC } from "../shared/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function HospitalPage({ user, refreshUser, addToast }: Props) {
  const [status, setStatus] = useState<any>(null);
  const [healing, setHealing] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [consumables, setConsumables] = useState<Item[]>([]);
  const [usingItem, setUsingItem] = useState<string | null>(null);

  const loadStatus = useCallback(() =>
    api.get<any>("/hospital/status").then(s => {
      setStatus(s);
      setTimeLeft(s.timeRemaining ?? 0);
    }).catch(() => {}), []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    api.get<Item[]>("/inventory").then(items => {
      setConsumables(items.filter(i => i.type === "consumable"));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  async function heal() {
    setHealing(true);
    try {
      const data = await api.post<any>("/hospital/heal");
      addToast(data.message, "success");
      await loadStatus();
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setHealing(false);
    }
  }

  async function dischargeEarly() {
    setDischarging(true);
    try {
      const data = await api.post<any>("/hospital/discharge");
      addToast(data.message, "success");
      await loadStatus();
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setDischarging(false);
    }
  }

  async function useItem(itemId: string) {
    setUsingItem(itemId);
    try {
      const data = await api.post<any>("/hospital/use-item", { itemId });
      addToast(data.message, "success");
      await loadStatus();
      await refreshUser();
      const items = await api.get<Item[]>("/inventory");
      setConsumables(items.filter(i => i.type === "consumable"));
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setUsingItem(null);
    }
  }

  const missingHp = (status?.maxHealth ?? user.maxHealth) - (status?.health ?? user.health);
  const hpHealCost = missingHp * 5;
  const dischargeCost = status?.dischargeCost ?? 0;
  const totalHealCost = hpHealCost + (status?.hospitalized ? dischargeCost : 0);
  const hospitalItems = consumables.filter(i =>
    i.effect?.includes("hospital") || i.effect?.includes("health") || i.effect?.includes("clear_hospital")
  );

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 relative z-10">
      <div className="dl-page-bg bg-combat" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] fixed" style={{
        backgroundImage: "linear-gradient(rgba(255, 45, 85, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 45, 85, 0.5) 1px, transparent 1px)",
        backgroundSize: "20px 20px"
      }} />
      <div className="scanlines absolute inset-0 pointer-events-none opacity-20 fixed" />

      <h2 className="text-lg font-mono font-bold" style={{ color: "#ff2d55" }}>New Vanta Hospital</h2>

      <div className="rounded-lg p-6" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
        {status?.hospitalized ? (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="text-4xl font-mono font-bold" style={{ color: "#ff2d55" }}>
                {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
                {String(timeLeft % 60).padStart(2, "0")}
              </div>
              <p className="text-xs font-mono mt-2" style={{ color: "#475569" }}>
                Time remaining in hospital
              </p>
              {status?.tier && (
                <div className="mt-2 px-3 py-1 rounded font-mono text-xs font-bold inline-block" style={{
                  background: status.tier === "light" ? "#39d35318" : status.tier === "serious" ? "#f59e0b18" : "#ff2d5518",
                  color: status.tier === "light" ? "#39d353" : status.tier === "serious" ? "#f59e0b" : "#ff2d55",
                  border: `1px solid ${status.tier === "light" ? "#39d35340" : status.tier === "serious" ? "#f59e0b40" : "#ff2d5540"}`,
                }}>
                  TRIAGE: {status.tier.toUpperCase()}
                  {status.tier === "light" ? " — 25 DC/min" : status.tier === "serious" ? " — 50 DC/min" : " — 75 DC/min"}
                </div>
              )}
            </div>

            <div className="flex justify-between text-xs font-mono">
              <span style={{ color: "#94a3b8" }}>HP</span>
              <span style={{ color: "#ff2d55" }}>{status.health}/{status.maxHealth}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
              <div className="h-full rounded-full" style={{
                width: `${(status.health / status.maxHealth) * 100}%`,
                background: "#ff2d55",
              }} />
            </div>

            <div className="space-y-2">
              <button
                onClick={dischargeEarly}
                disabled={discharging || user.dc < dischargeCost}
                className="w-full py-2.5 rounded font-mono text-sm font-bold uppercase"
                style={{
                  background: user.dc >= dischargeCost ? "#ff2d5518" : "#1e1e2e",
                  color: user.dc >= dischargeCost ? "#ff2d55" : "#475569",
                  border: `1px solid ${user.dc >= dischargeCost ? "#ff2d5540" : "#1e1e2e"}`,
                }}
              >
                {discharging ? "..." : `Early Discharge — ${formatDC(dischargeCost)} DC`}
              </button>
              {missingHp > 0 && (
                <button
                  onClick={heal}
                  disabled={healing || user.dc < totalHealCost}
                  className="w-full py-2 rounded font-mono text-xs font-bold"
                  style={{
                    background: user.dc >= totalHealCost ? "#39d35318" : "#1e1e2e",
                    color: user.dc >= totalHealCost ? "#39d353" : "#475569",
                    border: `1px solid ${user.dc >= totalHealCost ? "#39d35340" : "#1e1e2e"}`,
                  }}
                >
                  {healing ? "..." : `Heal + Discharge — ${formatDC(totalHealCost)} DC`}
                </button>
              )}
            </div>

            {hospitalItems.length > 0 && (
              <div>
                <div className="text-xs font-mono mb-2" style={{ color: "#64748b" }}>MEDICAL ITEMS</div>
                <div className="space-y-1">
                  {hospitalItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                      <div>
                        <span className="font-mono text-xs font-bold" style={{ color: "#e2e8f0" }}>{item.name}</span>
                        {item.quantity > 1 && <span className="font-mono text-xs ml-1" style={{ color: "#64748b" }}>×{item.quantity}</span>}
                        {item.effect && <div className="font-mono text-xs" style={{ color: "#a855f7" }}>{item.effect}</div>}
                      </div>
                      <button
                        onClick={() => useItem(item.id)}
                        disabled={usingItem === item.id}
                        className="px-2 py-1 rounded font-mono text-xs"
                        style={{ background: "#a855f720", color: "#a855f7", border: "1px solid #a855f740" }}
                      >
                        {usingItem === item.id ? "..." : "Use"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-mono text-center" style={{ color: "#39d353" }}>
              You are not hospitalized.
            </p>
            {missingHp > 0 ? (
              <>
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: "#94a3b8" }}>HP</span>
                  <span style={{ color: "#39d353" }}>{user.health}/{user.maxHealth}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
                  <div className="h-full rounded-full" style={{ width: `${(user.health / user.maxHealth) * 100}%`, background: "#39d353" }} />
                </div>
                <p className="text-xs font-mono text-center" style={{ color: "#475569" }}>
                  Restore {missingHp} HP for <span style={{ color: "#f59e0b" }}>{hpHealCost} DC</span>
                </p>
                <button
                  onClick={heal}
                  disabled={healing || user.dc < hpHealCost}
                  className="w-full py-2 rounded font-mono text-sm font-bold"
                  style={{
                    background: user.dc >= hpHealCost ? "#39d35318" : "#1e1e2e",
                    color: user.dc >= hpHealCost ? "#39d353" : "#475569",
                    border: `1px solid ${user.dc >= hpHealCost ? "#39d35340" : "#1e1e2e"}`,
                  }}
                >
                  {healing ? "..." : `Heal for ${hpHealCost} DC`}
                </button>
              </>
            ) : (
              <p className="text-xs font-mono text-center" style={{ color: "#475569" }}>You are at full health.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
