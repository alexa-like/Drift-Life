import { User } from "../lib/types";
import { WantedStars } from "./WantedStars";

const FACTION_EMOJI: Record<string, string> = { suits: "[S]", street: "[ST]", grid: "[G]" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

const NAV = [
  { id: "feed", label: "Feed" },
  { id: "map", label: "Map" },
  { id: "crimes", label: "Crime" },
  { id: "jobs", label: "Jobs" },
  { id: "combat", label: "Combat" },
  { id: "inventory", label: "Gear" },
  { id: "market", label: "Market" },
  { id: "bank", label: "Bank" },
  { id: "daily", label: "Daily" },
  { id: "leaderboard", label: "Board" },
  { id: "profile", label: "Profile" },
];

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

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40"
      style={{ background: "#0a0a0fef", borderBottom: "1px solid #1e1e2e", backdropFilter: "blur(8px)" }}
    >
      {/* XP bar */}
      <div style={{ height: 2, background: "#1e1e2e" }}>
        <div style={{ height: 2, width: `${xpPct}%`, background: "#00d4ff", transition: "width 0.5s" }} />
      </div>

      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto">
        {/* Brand */}
        <button
          className="font-mono font-bold text-sm mr-2 flex-shrink-0"
          style={{ color: "#00d4ff", textShadow: "0 0 8px #00d4ff60" }}
          onClick={() => onNav("dashboard")}
        >
          DRIFT
        </button>

        {/* Status pills */}
        {isHosp && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540", fontSize: 10 }}>
            HOSP
          </span>
        )}
        {isJailed && (
          <span className="text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40", fontSize: 10 }}>
            JAIL
          </span>
        )}

        {/* Nav links */}
        <div className="flex gap-0.5 flex-1 overflow-x-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className="px-2 py-1 rounded font-mono flex-shrink-0 transition-all"
              style={{
                fontSize: 11,
                background: active === item.id ? "#00d4ff18" : "transparent",
                color: active === item.id ? "#00d4ff" : "#64748b",
                border: active === item.id ? "1px solid #00d4ff30" : "1px solid transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
          {user.faction && (
            <span className="font-mono" style={{ fontSize: 11, color: FACTION_COLOR[user.faction] }}>
              {FACTION_EMOJI[user.faction]}
            </span>
          )}
          <WantedStars level={user.wantedLevel} />
          <span className="font-mono" style={{ fontSize: 11, color: "#f59e0b" }}>
            {user.dc.toLocaleString()} DC
          </span>
          {user.nc > 0 && (
            <span className="font-mono" style={{ fontSize: 11, color: "#a855f7" }}>{user.nc} NC</span>
          )}
          <span className="font-mono" style={{ fontSize: 11, color: "#94a3b8" }}>Lv.{user.level}</span>
          <button
            onClick={() => onNav("notifications")}
            className="relative font-mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 11, color: unreadNotifs > 0 ? "#ff2d55" : "#64748b", border: "1px solid #1e1e2e" }}
          >
            [{unreadNotifs || 0}]
          </button>
          {(user.role === "owner" || user.role === "admin") && (
            <button
              onClick={() => onNav("owner")}
              className="font-mono px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, color: "#a855f7", border: "1px solid #a855f730" }}
            >
              [O]
            </button>
          )}
          <button
            onClick={onLogout}
            className="font-mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 11, color: "#64748b", border: "1px solid #1e1e2e" }}
          >
            exit
          </button>
        </div>
      </div>
    </nav>
  );
}
