import { useEffect, useState } from "react";
import { api } from "../api";

interface AnnouncementData {
  active: boolean;
  message: string;
  expiresAt: string | null;
}

function useCountdown(expiresAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!expiresAt) { setLabel(null); return; }
    function tick() {
      const ms = new Date(expiresAt!).getTime() - Date.now();
      if (ms <= 0) { setLabel("00:00:00"); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLabel(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  return label;
}

export function AnnouncementBanner() {
  const [data, setData] = useState<AnnouncementData | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(
    () => localStorage.getItem("announcement:dismissed")
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<AnnouncementData>("/world/announcement");
        if (!cancelled) setData(res);
      } catch {
        // silent — banner is non-critical
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const countdown = useCountdown(data?.expiresAt ?? null);

  if (!data?.active || !data.message) return null;
  if (dismissedFor === data.message) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto"
      style={{
        background: "linear-gradient(90deg, #a855f722, #00d4ff11)",
        borderBottom: "1px solid #a855f740",
        fontSize: 11,
      }}
    >
      <span style={{ color: "#a855f7", flexShrink: 0 }}>📡</span>
      <span className="font-mono flex-1 truncate" style={{ color: "#e2e8f0" }}>
        {data.message}
      </span>
      {countdown && (
        <span className="font-mono flex-shrink-0" style={{ color: "#00d4ff", fontWeight: "bold" }}>
          ⏱ {countdown}
        </span>
      )}
      <button
        onClick={() => {
          localStorage.setItem("announcement:dismissed", data.message);
          setDismissedFor(data.message);
        }}
        className="font-mono flex-shrink-0 px-1.5"
        style={{ color: "#475569" }}
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}
