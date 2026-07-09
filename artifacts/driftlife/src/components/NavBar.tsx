import { useEffect, useRef, useState } from "react";
import { User } from "../lib/types";
import { WantedStars } from "./WantedStars";
import { formatDC } from "../lib/format";

function RollingNC({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const animRef = useRef<number | null>(null);
  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current, end = value, dur = 600, t0 = performance.now();
    function step(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(start + (end - start) * e));
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else prevRef.current = end;
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);
  return <span className="font-mono tabular-nums" style={{ color: "#a855f7", fontSize: 11, fontWeight: "bold" }}>{formatDC(display)}</span>;
}

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

// Wire Cartel onboarding-gated nav items
// minStage: minimum onboardingStage required to see this item
// statusFilter: which statuses can see this item ("all" | "normal" | "normal|abroad" | etc.)
const NAV: { id: string; label: string; minStage?: number; group?: string; statusFilter?: string }[] = [
  // Always visible (all statuses)
  { id: "feed",         label: "Feed" },
  { id: "chat",         label: "Chat" },
  { id: "profile",      label: "Profile" },
  { id: "chatframes",   label: "Frames" },
  { id: "store",        label: "Store" },
  { id: "connections",  label: "Connect" },
  { id: "leaderboard",  label: "Board" },
  { id: "auction",      label: "Auction" },
  // Wire Cartel — core loop (onboarding gated, normal only)
  { id: "city",         label: "City",     group: "wc",  statusFilter: "normal" },
  { id: "training",     label: "Training", group: "wc",  statusFilter: "normal" },
  { id: "jobs",         label: "Jobs",     group: "wc",  statusFilter: "normal" },
  { id: "garage",       label: "Garage",   group: "wc",  minStage: 1, statusFilter: "normal" },
  { id: "net",          label: "Net",      group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "cyber",        label: "Cyber",    group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "guilds",       label: "Crew",     group: "wc",  minStage: 2, statusFilter: "normal" },
  // Normal-only arena / combat
  { id: "arena",        label: "Arena",    statusFilter: "normal" },
  { id: "loadout",      label: "Loadout",  statusFilter: "normal" },
  { id: "race-hub",     label: "Race",     statusFilter: "normal" },
  { id: "royale",       label: "Royale",   statusFilter: "normal" },
  { id: "missions",     label: "Missions", statusFilter: "normal" },
  // Normal or abroad
  { id: "crimes",       label: "Crimes",   statusFilter: "normal|abroad" },
  { id: "travel",       label: "Travel",   statusFilter: "normal|abroad" },
  { id: "market",       label: "Market",   statusFilter: "normal|abroad" },
  { id: "district-hub", label: "Hub",    statusFilter: "abroad" },
  // Economy & social (normal only)
  { id: "shop",         label: "Shop",     statusFilter: "normal" },
  { id: "friends",      label: "Friends",  statusFilter: "normal" },
  { id: "bank",         label: "Bank",     statusFilter: "normal" },
  { id: "properties",   label: "Estate",   statusFilter: "normal" },
  { id: "crafting",     label: "Craft",    statusFilter: "normal" },
  { id: "skills",       label: "Skills",   statusFilter: "normal" },
  { id: "achievements", label: "Achiev" },
  { id: "daily",        label: "Daily" },
];

function RollingNumber({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return (
    <span className="font-mono tabular-nums" style={{ color, fontSize: 11, fontWeight: "bold" }}>
      {formatDC(display)}
    </span>
  );
}

function EnergyDisplay({ energy, maxEnergy, energyRegenAt }: { energy: number; maxEnergy: number; energyRegenAt?: string | null }) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!energyRegenAt || energy >= maxEnergy) { setSecsLeft(null); return; }
    function calc() {
      const ms = new Date(energyRegenAt!).getTime() + 180_000 - Date.now();
      setSecsLeft(ms > 0 ? Math.ceil(ms / 1000) : 0);
    }
    calc();
    const iv = setInterval(calc, 1_000);
    return () => clearInterval(iv);
  }, [energyRegenAt, energy, maxEnergy]);

  const isFull = energy >= maxEnergy;
  const color = isFull ? "#39d353" : "#f59e0b";
  return (
    <span className="font-mono" style={{ color, fontWeight: "bold", fontSize: 11 }}>
      ⚡{energy}/{maxEnergy}
      {!isFull && secsLeft !== null && secsLeft > 0 && (
        <span style={{ color: "#475569", fontWeight: "normal", fontSize: 10, marginLeft: 3 }}>
          +1 in {secsLeft}s
        </span>
      )}
    </span>
  );
}

interface Props {
  user: User;
  active: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  unreadNotifs: number;
}

export function NavBar({ user, active, onNav, onLogout, unreadNotifs }: Props) {
  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const fc = user.faction ? FACTION_COLOR[user.faction] : "#64748b";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40"
      style={{ background: "#0a0a0ff0", borderBottom: "1px solid #1e1e2e", backdropFilter: "blur(12px)" }}
    >
      {/* XP bar — animated glow */}
      <div style={{ height: 2, background: "#1e1e2e", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            height: 2,
            width: `${xpPct}%`,
            background: `linear-gradient(90deg, ${fc}80, ${fc})`,
            boxShadow: `0 0 8px ${fc}`,
            transition: "width 0.8s ease",
          }}
        />
      </div>

      {/* Status strip */}
      <div
        className="flex items-center gap-2 px-3 py-1 overflow-x-auto"
        style={{ borderBottom: "1px solid #0d0d15", fontSize: 10, scrollbarWidth: "none" }}
      >
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          {user.tag}
        </span>
        {user.faction && (
          <span className="font-mono flex-shrink-0" style={{ color: fc }}>
            {FACTION_EMOJI[user.faction]} {user.faction.toUpperCase()}
          </span>
        )}
        {user.equippedTitle && (
          <span className="font-mono flex-shrink-0" style={{ color: "#a855f7" }}>
            [{user.equippedTitle}]
          </span>
        )}
        {isHosp && (
          <span className="font-mono flex-shrink-0 px-1.5 rounded" style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}>
            🏥 HOSPITALIZED
          </span>
        )}
        {isJailed && (
          <span className="font-mono flex-shrink-0 px-1.5 rounded" style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
            🔒 JAILED
          </span>
        )}
        {/* Wire Cartel heat indicator */}
        {(user.heat ?? 0) > 0 && (
          <span className="font-mono flex-shrink-0 px-1.5 rounded" style={{
            background: (user.heat ?? 0) >= 80 ? "#ef444420" : "#f9731620",
            color: (user.heat ?? 0) >= 80 ? "#ef4444" : "#f97316",
            border: `1px solid ${(user.heat ?? 0) >= 80 ? "#ef444440" : "#f9731640"}`,
          }}>
            {(user.heat ?? 0) >= 80 ? "[!]" : ""} {user.heat}% HEAT
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          Lv.<span style={{ color: "#e2e8f0", fontWeight: "bold" }}>{user.level}</span>
          {user.prestige > 0 && <span style={{ color: "#f59e0b" }}> ✦{user.prestige}</span>}
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          <RollingNumber value={user.dc} color="#f59e0b" /> DC
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          <RollingNC value={user.nc} /> NC
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          <EnergyDisplay energy={user.energy} maxEnergy={user.maxEnergy} energyRegenAt={(user as any).energyRegenAt} />
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#ff2d55", fontWeight: "bold", fontSize: 11 }}>
          🥊{user.adrenaline}/{user.maxAdrenaline}
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#00d4ff", fontWeight: "bold", fontSize: 11 }}>
          🏁{user.nitro}/{user.maxNitro}
        </span>
        {(user.keys ?? 0) > 0 && (
          <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
            🗝️ <span style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 11 }}>{user.keys}</span>
          </span>
        )}
        {(user.keyShards ?? 0) > 0 && (
          <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
            🔮 <span style={{ color: "#a855f7", fontWeight: "bold", fontSize: 11 }}>{user.keyShards}</span>
          </span>
        )}
      </div>

      {/* Nav row */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {/* Brand */}
        <button
          className="font-mono font-bold text-sm mr-2 flex-shrink-0 tracking-widest"
          style={{ color: "#00d4ff", textShadow: "0 0 12px #00d4ff80" }}
          onClick={() => onNav("dashboard")}
        >
          DRIFT
        </button>

        {/* Nav links — filtered by onboardingStage + user status */}
        {NAV.filter(item => {
          const minStage = item.minStage ?? 0;
          const stage = user.onboardingStage ?? 0;
          if (minStage === 99) return false;
          if (stage < minStage) return false;

          // Status-based visibility
          const status = (user as any).status as string | undefined;
          const isNormal    = !status || status === "normal";
          const isAbroad    = status === "abroad";
          const sf = item.statusFilter;
          if (!sf) return true; // no filter = always visible
          if (sf === "normal")         return isNormal;
          if (sf === "normal|abroad")  return isNormal || isAbroad;
          if (sf === "abroad")         return isAbroad;
          return true;
        }).map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className="px-2 py-1 rounded font-mono flex-shrink-0 transition-all relative"
            style={{
              fontSize: 11,
              background: active === item.id ? `${fc}18` : "transparent",
              color: active === item.id ? fc : item.group === "wc" ? "#64748b" : "#475569",
              border: active === item.id ? `1px solid ${fc}40` : item.group === "wc" && active !== item.id ? "1px solid #1e293b" : "1px solid transparent",
              boxShadow: active === item.id ? `0 0 8px ${fc}20` : "none",
            }}
          >
            {item.label}
            {item.id === "notifications" && unreadNotifs > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "#ff2d55",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 14,
                  height: 14,
                  fontSize: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                }}
              >
                {unreadNotifs}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <WantedStars level={user.wantedLevel} />
          <button
            onClick={() => onNav("notifications")}
            className="relative font-mono px-1.5 py-0.5 rounded"
            style={{
              fontSize: 11,
              color: unreadNotifs > 0 ? "#ff2d55" : "#475569",
              border: `1px solid ${unreadNotifs > 0 ? "#ff2d5540" : "#1e1e2e"}`,
              boxShadow: unreadNotifs > 0 ? "0 0 8px #ff2d5540" : "none",
            }}
          >
            🔔{unreadNotifs > 0 ? ` ${unreadNotifs}` : ""}
          </button>
          <button
            onClick={() => onNav("settings")}
            className="font-mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 11, color: "#475569", border: "1px solid #1e1e2e" }}
            title="Settings"
          >
            ⚙
          </button>
          {(user.role === "owner" || user.role === "admin") && (
            <button
              onClick={() => onNav("owner")}
              className="font-mono px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, color: "#a855f7", border: "1px solid #a855f730" }}
              title="Owner Panel"
            >
              ★
            </button>
          )}
          <button
            onClick={onLogout}
            className="font-mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 11, color: "#475569", border: "1px solid #1e1e2e" }}
          >
            exit
          </button>
        </div>
      </div>
    </nav>
  );
}
