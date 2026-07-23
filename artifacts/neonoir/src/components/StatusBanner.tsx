import { useState, useEffect, useCallback } from "react";
import { User } from "../shared/types";
import { api } from "../shared/api";
import { formatDC } from "../shared/format";

interface Props {
  user: User;
  refreshUser: () => Promise<User | null>;
  addToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onNav?: (page: string) => void;
}

function useCountdown(targetDate: string | null | undefined): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!targetDate) { setLabel(""); return; }
    function calc() {
      const ms = new Date(targetDate!).getTime() - Date.now();
      if (ms <= 0) { setLabel("0m 0s"); return; }
      const totalSecs = Math.ceil(ms / 1000);
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      setLabel(`${m}m ${s}s`);
    }
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [targetDate]);
  return label;
}

const DISTRICT_NAMES: Record<string, string> = {
  downtown: "Downtown", neon_strip: "Neon Strip", docks: "The Docks",
  slums: "The Slums", corp_zone: "Corp Zone", industrial: "Industrial", outskirts: "The Outskirts",
};

function districtName(slug: string | null | undefined): string {
  if (!slug) return "Unknown";
  return DISTRICT_NAMES[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function StatusBanner({ user, refreshUser, addToast, onNav }: Props) {
  const [busy, setBusy] = useState(false);
  const travelArrival = useCountdown(user.travelArrivesAt);
  const hospitalRelease = useCountdown((user as any).hospitalizedUntil);
  const jailRelease = useCountdown((user as any).jailedUntil ?? user.jailUntil);

  // Re-fetch /me every 30s to get fresh status
  useEffect(() => {
    if (!user || (user as any).status === 'normal') return;
    const iv = setInterval(() => { refreshUser().catch(() => {}); }, 30_000);
    return () => clearInterval(iv);
  }, [(user as any).status, refreshUser]);

  const status: string = (user as any).status ?? 'normal';
  if (status === 'normal') return null;

  async function cancelTravel() {
    setBusy(true);
    try {
      await api.post("/user/travel/cancel");
      await refreshUser();
      addToast("Travel cancelled", "info");
    } catch (err: any) {
      addToast(err.message ?? "Failed", "error");
    } finally { setBusy(false); }
  }

  async function returnHome() {
    setBusy(true);
    try {
      await api.post("/user/travel", { destination: "downtown" });
      await refreshUser();
      addToast("Returning to Downtown...", "info");
    } catch (err: any) {
      addToast(err.message ?? "Failed", "error");
    } finally { setBusy(false); }
  }

  async function payHospital() {
    setBusy(true);
    try {
      const data = await api.post<any>("/hospital/release-early");
      await refreshUser();
      addToast(`Released! Cost: ${formatDC(data.cost)} DC`, "success");
    } catch (err: any) {
      addToast(err.message ?? "Failed", "error");
    } finally { setBusy(false); }
  }

  async function payBail() {
    setBusy(true);
    try {
      const data = await api.post<any>("/hospital/pay-bail");
      await refreshUser();
      addToast(`Bail posted! Cost: ${formatDC(data.cost)} DC`, "success");
    } catch (err: any) {
      addToast(err.message ?? "Failed", "error");
    } finally { setBusy(false); }
  }

  // Compute pay costs for display
  const hospitalUntil = (user as any).hospitalizedUntil ? new Date((user as any).hospitalizedUntil) : null;
  const jailUntilDate = (user as any).jailedUntil
    ? new Date((user as any).jailedUntil)
    : user.jailUntil ? new Date(user.jailUntil) : null;

  const hospitalCost = hospitalUntil
    ? Math.floor(Math.ceil((hospitalUntil.getTime() - Date.now()) / 60000) * 50)
    : 0;
  const bailCost = jailUntilDate
    ? Math.floor(Math.ceil((jailUntilDate.getTime() - Date.now()) / 60000) * 80)
    : 0;

  const travelDest = user.travelingTo ?? "";
  const currentLoc = (user as any).currentLocation ?? "downtown";

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    top: 76,
    left: 0,
    right: 0,
    zIndex: 39,
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontFamily: "monospace",
    fontSize: 12,
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid",
  };

  const btnStyle: React.CSSProperties = {
    padding: "3px 10px",
    borderRadius: 4,
    cursor: busy ? "not-allowed" : "pointer",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "bold",
    opacity: busy ? 0.6 : 1,
  };

  if (status === "traveling") {
    return (
      <div style={{ ...baseStyle, background: "#0a1628e0", borderColor: "#00d4ff40", color: "#00d4ff" }}>
        <span>🚗 Traveling to <strong>{districtName(travelDest)}</strong></span>
        <span style={{ color: "#94a3b8" }}>Arrives in {travelArrival}</span>
        <div style={{ flex: 1 }} />
        <button
          disabled={busy}
          onClick={cancelTravel}
          style={{ ...btnStyle, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (status === "abroad") {
    return (
      <div style={{ ...baseStyle, background: "#0f1a0ae0", borderColor: "#39d35340", color: "#39d353" }}>
        <span>📍 You are in <strong>{districtName(currentLoc)}</strong></span>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>District crimes available</span>
        <div style={{ flex: 1 }} />
        {onNav && (
          <button
            disabled={busy}
            onClick={() => onNav("crimes")}
            style={{ ...btnStyle, background: "#1a3a1a", color: "#39d353", border: "1px solid #39d35340" }}
          >
            District Crimes
          </button>
        )}
        <button
          disabled={busy}
          onClick={returnHome}
          style={{ ...btnStyle, background: "#1e293b", color: "#00d4ff", border: "1px solid #00d4ff40" }}
        >
          Return to Downtown
        </button>
      </div>
    );
  }

  if (status === "hospitalized") {
    return (
      <div style={{ ...baseStyle, background: "#1a0a0ae0", borderColor: "#ff2d5540", color: "#ff2d55" }}>
        <span>🏥 Hospitalized in <strong>{districtName(currentLoc)}</strong></span>
        <span style={{ color: "#94a3b8" }}>Released in {hospitalRelease}</span>
        <div style={{ flex: 1 }} />
        {hospitalCost > 0 && (
          <button
            disabled={busy}
            onClick={payHospital}
            style={{ ...btnStyle, background: "#2a0a0a", color: "#ff2d55", border: "1px solid #ff2d5540" }}
          >
            Pay {formatDC(hospitalCost)} DC to Leave
          </button>
        )}
      </div>
    );
  }

  if (status === "jailed") {
    return (
      <div style={{ ...baseStyle, background: "#1a150ae0", borderColor: "#f59e0b40", color: "#f59e0b" }}>
        <span>🔒 Jailed in <strong>{districtName(currentLoc)}</strong></span>
        <span style={{ color: "#94a3b8" }}>Released in {jailRelease}</span>
        <div style={{ flex: 1 }} />
        {bailCost > 0 && (
          <button
            disabled={busy}
            onClick={payBail}
            style={{ ...btnStyle, background: "#2a1f0a", color: "#f59e0b", border: "1px solid #f59e0b40" }}
          >
            Pay Bail {formatDC(bailCost)} DC
          </button>
        )}
      </div>
    );
  }

  return null;
}
