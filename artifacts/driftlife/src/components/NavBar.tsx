import { User } from "../lib/types";
import { WantedStars } from "./WantedStars";

interface NavItem {
  id: string;
  label: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "HUD" },
  { id: "crimes", label: "Crimes" },
  { id: "jobs", label: "Jobs" },
  { id: "combat", label: "Combat" },
  { id: "market", label: "Market" },
  { id: "bank", label: "Bank" },
  { id: "district", label: "District" },
  { id: "inventory", label: "Gear" },
  { id: "leaderboard", label: "Board" },
  { id: "feed", label: "Feed" },
];

interface Props {
  user: User;
  active: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  unreadNotifs: number;
}

export function NavBar({ user, active, onNav, onLogout, unreadNotifs }: Props) {
  const isHospitalized = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 flex items-center gap-1 px-4 py-2 overflow-x-auto"
      style={{
        background: "#0a0a0fee",
        borderBottom: "1px solid #1e1e2e",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Brand */}
      <button
        className="font-mono font-bold text-sm mr-3 flex-shrink-0"
        style={{ color: "#00d4ff", textShadow: "0 0 8px #00d4ff80" }}
        onClick={() => onNav("dashboard")}
      >
        DRIFTLIFE
      </button>

      {/* Status pills */}
      {isHospitalized && (
        <span className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "#ff2d5520", color: "#ff2d55", border: "1px solid #ff2d5540" }}>
          HOSP
        </span>
      )}
      {isJailed && (
        <span className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
          JAIL
        </span>
      )}

      {/* Nav links */}
      <div className="flex gap-1 flex-1 overflow-x-auto">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className="px-3 py-1 rounded text-xs font-mono flex-shrink-0 transition-all"
            style={{
              background: active === item.id ? "#00d4ff18" : "transparent",
              color: active === item.id ? "#00d4ff" : "#94a3b8",
              border: active === item.id ? "1px solid #00d4ff30" : "1px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        <WantedStars level={user.wantedLevel} />
        <span className="text-xs font-mono" style={{ color: "#f59e0b" }}>
          {user.dc.toLocaleString()} DC
        </span>
        <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
          Lv.{user.level}
        </span>
        <button
          onClick={() => onNav("notifications")}
          className="relative text-xs font-mono px-2 py-1 rounded"
          style={{ color: "#94a3b8", border: "1px solid #1e1e2e" }}
        >
          [{unreadNotifs > 0 ? <span style={{ color: "#ff2d55" }}>{unreadNotifs}</span> : "0"}]
        </button>
        <span className="text-xs font-mono" style={{ color: "#00d4ff" }}>{user.username}</span>
        <button
          onClick={onLogout}
          className="text-xs font-mono px-2 py-1 rounded transition-colors"
          style={{ color: "#64748b", border: "1px solid #1e1e2e" }}
        >
          exit
        </button>
      </div>
    </nav>
  );
}
