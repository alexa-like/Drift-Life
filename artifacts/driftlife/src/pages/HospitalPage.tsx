import { useState, useEffect } from "react";
import { User } from "../lib/types";
import { api } from "../lib/api";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function HospitalPage({ user, refreshUser, addToast }: Props) {
  const [status, setStatus] = useState<any>(null);
  const [healing, setHealing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    api.get<any>("/hospital/status").then(s => {
      setStatus(s);
      setTimeLeft(s.timeRemaining ?? 0);
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
      setStatus({ ...status, hospitalized: false, health: data.health });
      await refreshUser();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setHealing(false);
    }
  }

  const missingHp = (status?.maxHealth ?? user.maxHealth) - (status?.health ?? user.health);
  const healCost = missingHp * 5 + (status?.hospitalized ? 200 : 0);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
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
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span style={{ color: "#94a3b8" }}>HP</span>
              <span style={{ color: "#ff2d55" }}>{status.health}/{status.maxHealth}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(status.health / status.maxHealth) * 100}%`,
                  background: "#ff2d55",
                }}
              />
            </div>
            <p className="text-xs font-mono text-center" style={{ color: "#475569" }}>
              Pay <span style={{ color: "#f59e0b" }}>{healCost} DC</span> to leave now.
            </p>
            <button
              onClick={heal}
              disabled={healing || user.dc < healCost}
              className="w-full py-2.5 rounded font-mono text-sm font-bold uppercase"
              style={{
                background: user.dc >= healCost ? "#ff2d5518" : "#1e1e2e",
                color: user.dc >= healCost ? "#ff2d55" : "#475569",
                border: `1px solid ${user.dc >= healCost ? "#ff2d5540" : "#1e1e2e"}`,
              }}
            >
              {healing ? "..." : user.dc >= healCost ? `Pay ${healCost} DC & Leave` : "Not enough DC"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-mono text-center" style={{ color: "#39d353" }}>
              You are not hospitalized.
            </p>
            {missingHp > 0 && (
              <>
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: "#94a3b8" }}>HP</span>
                  <span style={{ color: "#39d353" }}>{user.health}/{user.maxHealth}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(user.health / user.maxHealth) * 100}%`, background: "#39d353" }}
                  />
                </div>
                <p className="text-xs font-mono text-center" style={{ color: "#475569" }}>
                  Restore {missingHp} HP for{" "}
                  <span style={{ color: "#f59e0b" }}>{missingHp * 5} DC</span>
                </p>
                <button
                  onClick={heal}
                  disabled={healing || user.dc < missingHp * 5}
                  className="w-full py-2 rounded font-mono text-sm font-bold"
                  style={{
                    background: "#39d35318",
                    color: "#39d353",
                    border: "1px solid #39d35340",
                  }}
                >
                  {healing ? "..." : `Heal for ${missingHp * 5} DC`}
                </button>
              </>
            )}
            {missingHp <= 0 && (
              <p className="text-xs font-mono text-center" style={{ color: "#475569" }}>
                You are at full health.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
