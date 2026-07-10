import { useEffect, useRef, useState } from "react";
import {
  Home, Newspaper, MessageCircle, Package, Image as ImageIcon, CreditCard, Link as LinkIcon,
  BarChart2, Gavel, Building2, Dumbbell, Briefcase, Car, Globe, Cpu, Shield, Swords, Crosshair,
  Crown, ClipboardList, Skull, Plane, ShoppingCart, Building, Users, Landmark, Warehouse,
  Wrench, Star, Trophy, Gift, PawPrint, type LucideIcon,
} from "lucide-react";
import { User } from "../lib/types";
import { WantedStars } from "./WantedStars";
import { formatDC } from "../lib/format";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { api } from "../lib/api";

function RollingNumber({ value, color }: { value: number; color: string }) {
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
  return <span className="font-mono tabular-nums" style={{ color, fontSize: 11, fontWeight: "bold" }}>{formatDC(display)}</span>;
}

const FACTION_EMOJI: Record<string, string> = { suits: "🏢", street: "🔥", grid: "💻" };
const FACTION_COLOR: Record<string, string> = { suits: "#f59e0b", street: "#ff6b35", grid: "#00d4ff" };

// Full canonical list of top-level game sections (icon nav row).
// minStage: minimum onboardingStage required to see this item
// statusFilter: which statuses can see this item ("all" | "normal" | "normal|abroad" | "abroad")
const NAV: { id: string; label: string; icon: LucideIcon; notify?: boolean; minStage?: number; group?: string; statusFilter?: string }[] = [
  { id: "dashboard",    label: "Home",     icon: Home },
  { id: "feed",         label: "Feed",     icon: Newspaper },
  { id: "chat",         label: "Chat",     icon: MessageCircle },
  { id: "inventory",    label: "Bag",      icon: Package },
  { id: "chatframes",   label: "Frames",   icon: ImageIcon },
  { id: "store",        label: "Store",    icon: CreditCard },
  { id: "connections",  label: "Connect",  icon: LinkIcon },
  { id: "leaderboard",  label: "Board",    icon: BarChart2 },
  { id: "auction",      label: "Auction",  icon: Gavel },
  // Wire Cartel core loop (onboarding gated, normal only)
  { id: "city",         label: "City",     icon: Building2,     group: "wc",  statusFilter: "normal" },
  { id: "training",     label: "Gym",      icon: Dumbbell,      group: "wc",  statusFilter: "normal" },
  { id: "jobs",         label: "Jobs",     icon: Briefcase,     group: "wc",  statusFilter: "normal" },
  { id: "garage",       label: "Garage",   icon: Car,           group: "wc",  minStage: 1, statusFilter: "normal" },
  { id: "net",          label: "Net",      icon: Globe,         group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "cyber",        label: "Cyber",    icon: Cpu,           group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "guilds",       label: "Crew",     icon: Shield,        group: "wc",  minStage: 2, statusFilter: "normal" },
  // Combat / racing (normal only)
  { id: "arena",        label: "Arena",    icon: Swords,        statusFilter: "normal" },
  { id: "loadout",      label: "Loadout",  icon: Crosshair,     statusFilter: "normal" },
  { id: "royale",       label: "Royale",   icon: Crown,         statusFilter: "normal" },
  { id: "missions",     label: "Missions", icon: ClipboardList },
  // Normal or abroad
  { id: "crimes",       label: "Crimes",   icon: Skull,         statusFilter: "normal|abroad" },
  { id: "travel",       label: "Travel",   icon: Plane,         statusFilter: "normal|abroad" },
  { id: "market",       label: "Market",   icon: ShoppingCart,  statusFilter: "normal|abroad" },
  { id: "district-hub", label: "Hub",      icon: Building,      statusFilter: "abroad" },
  // Economy & social (normal only)
  { id: "friends",      label: "Friends",  icon: Users,         statusFilter: "normal" },
  { id: "bank",         label: "Bank",     icon: Landmark,      statusFilter: "normal" },
  { id: "properties",   label: "Estate",   icon: Warehouse,     statusFilter: "normal" },
  { id: "crafting",     label: "Craft",    icon: Wrench,        statusFilter: "normal" },
  { id: "skills",       label: "Skills",   icon: Star,          statusFilter: "normal" },
  { id: "achievements", label: "Achiev",   icon: Trophy },
  { id: "daily",        label: "Daily",    icon: Gift },
  { id: "companions",   label: "Allies",   icon: PawPrint,      statusFilter: "normal" },
];

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

function StatBar({ label, value, max }: { label: string; value: number; max: number; color?: string }) {
  return (
    <span
      className="font-mono flex items-center justify-center flex-1"
      style={{ minWidth: 70, fontSize: 11, fontWeight: "bold", color: "#e2e8f0" }}
    >
      {label} {value}/{max}
    </span>
  );
}

interface SearchResult {
  players: { id: string; username: string; tag: string; avatar: string; faction: string | null; level: number }[];
  items: { id: string; name: string; type: string; rarity: string }[];
  districts: { id: string; name: string; dangerLevel: number; minLevel: number }[];
}

function SearchBar({ onInspectPlayer, onNav }: { onInspectPlayer?: (id: string) => void; onNav: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const iv = setTimeout(async () => {
      try {
        const r = await api.get<SearchResult>(`/search?q=${encodeURIComponent(q.trim())}`);
        setResults(r);
      } catch {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(iv);
  }, [q]);

  const hasResults = results && (results.players.length || results.items.length || results.districts.length);

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xs mx-2" style={{ minWidth: 0 }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search players, items, districts…"
        className="w-full font-mono px-2 py-1 rounded"
        style={{ fontSize: 11, background: "#0d0d15", border: "1px solid #1e1e2e", color: "#e2e8f0", outline: "none" }}
      />
      {open && q.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded overflow-hidden"
          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", boxShadow: "0 8px 24px #000a", zIndex: 60, maxHeight: 320, overflowY: "auto" }}
        >
          {!hasResults && (
            <div className="font-mono px-2 py-2" style={{ fontSize: 11, color: "#475569" }}>No matches</div>
          )}
          {results?.players.map(p => (
            <button
              key={p.id}
              onClick={() => { onInspectPlayer?.(p.id); setOpen(false); setQ(""); }}
              className="w-full text-left font-mono px-2 py-1.5 flex items-center gap-2"
              style={{ fontSize: 11, color: "#e2e8f0" }}
            >
              <span>🧑</span> {p.username} <span style={{ color: "#475569" }}>Lv.{p.level}</span>
            </button>
          ))}
          {results?.items.map(i => (
            <button
              key={i.id}
              onClick={() => { onNav("market"); setOpen(false); setQ(""); }}
              className="w-full text-left font-mono px-2 py-1.5 flex items-center gap-2"
              style={{ fontSize: 11, color: "#e2e8f0" }}
            >
              <span>🎒</span> {i.name} <span style={{ color: "#475569" }}>{i.rarity}</span>
            </button>
          ))}
          {results?.districts.map(d => (
            <button
              key={d.id}
              onClick={() => { onNav("travel"); setOpen(false); setQ(""); }}
              className="w-full text-left font-mono px-2 py-1.5 flex items-center gap-2"
              style={{ fontSize: 11, color: "#e2e8f0" }}
            >
              <span>🏙️</span> {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarMenu({ user, onNav, onLogout }: { user: User; onNav: (id: string) => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 font-mono px-1.5 py-0.5 rounded"
        style={{ fontSize: 11, color: "#e2e8f0", border: "1px solid #1e1e2e" }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <span>🧑</span>
        )}
        <span className="hidden sm:inline">{user.username}</span>
        <span style={{ color: "#475569" }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 rounded overflow-hidden"
          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", boxShadow: "0 8px 24px #000a", zIndex: 60, minWidth: 140 }}
        >
          {[
            { id: "profile", label: "👤 Profile" },
            { id: "settings", label: "⚙ Settings" },
            { id: "support", label: "🆘 Support / Report" },
            { id: "legal", label: "📜 Legal" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); setOpen(false); }}
              className="w-full text-left font-mono px-3 py-2"
              style={{ fontSize: 11, color: "#e2e8f0" }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full text-left font-mono px-3 py-2"
            style={{ fontSize: 11, color: "#ff2d55", borderTop: "1px solid #1e1e2e" }}
          >
            ⏻ Logout
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  user: User;
  active: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  unreadNotifs: number;
  onInspectPlayer?: (id: string) => void;
}

export function NavBar({ user, active, onNav, onLogout, unreadNotifs, onInspectPlayer }: Props) {
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

      {/* Top bar: logo | search | notifications/history | avatar menu */}
      <div className="flex items-center gap-2 px-2 py-1.5" style={{ borderBottom: "1px solid #0d0d15" }}>
        <button
          className="font-mono font-bold text-sm flex-shrink-0 tracking-widest"
          style={{ color: "#00d4ff", textShadow: "0 0 12px #00d4ff80" }}
          onClick={() => onNav("dashboard")}
        >
          DRIFT
        </button>

        <SearchBar onInspectPlayer={onInspectPlayer} onNav={onNav} />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onNav("notifications")}
            className="relative font-mono px-1.5 py-0.5 rounded"
            style={{
              fontSize: 11,
              color: unreadNotifs > 0 ? "#ff2d55" : "#475569",
              border: `1px solid ${unreadNotifs > 0 ? "#ff2d5540" : "#1e1e2e"}`,
              boxShadow: unreadNotifs > 0 ? "0 0 8px #ff2d5540" : "none",
            }}
            title="Notifications"
          >
            🔔{unreadNotifs > 0 ? ` ${unreadNotifs}` : ""}
          </button>
          <button
            onClick={() => onNav("match-history")}
            className="font-mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 11, color: "#475569", border: "1px solid #1e1e2e" }}
            title="Activity History"
          >
            🕓
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
          <AvatarMenu user={user} onNav={onNav} onLogout={onLogout} />
        </div>
      </div>

      <AnnouncementBanner />

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
        <WantedStars level={user.wantedLevel} />
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          Lv.<span style={{ color: "#e2e8f0", fontWeight: "bold" }}>{user.level}</span>
          {user.prestige > 0 && <span style={{ color: "#f59e0b" }}> ✦{user.prestige}</span>}
        </span>
        <span className="font-mono flex-shrink-0" style={{ color: "#475569" }}>
          <EnergyDisplay energy={user.energy} maxEnergy={user.maxEnergy} energyRegenAt={(user as any).energyRegenAt} />
        </span>
      </div>

      {/* Icon nav row — every game section, icon + label, horizontal scroll */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto" style={{ scrollbarWidth: "none", borderBottom: "1px solid #0d0d15" }}>
        {NAV.filter(item => {
          const minStage = item.minStage ?? 0;
          const stage = user.onboardingStage ?? 0;
          if (stage < minStage) return false;
          const status = (user as any).status as string | undefined;
          const isNormal = !status || status === "normal";
          const isAbroad = status === "abroad";
          const sf = item.statusFilter;
          if (!sf) return true;
          if (sf === "normal") return isNormal;
          if (sf === "normal|abroad") return isNormal || isAbroad;
          if (sf === "abroad") return isAbroad;
          return true;
        }).map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          const iconColor = isActive ? fc : item.group === "wc" ? "#64748b" : "#475569";
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className="flex flex-col items-center flex-shrink-0 rounded transition-all"
              style={{
                minWidth: 46,
                padding: "4px 4px 3px",
                background: isActive ? `${fc}18` : "transparent",
                border: isActive ? `1px solid ${fc}60` : "1px solid transparent",
                boxShadow: isActive ? `0 0 8px ${fc}30` : "none",
                position: "relative",
              }}
            >
              {item.notify && (
                <span
                  style={{
                    position: "absolute", top: 2, right: 6,
                    width: 6, height: 6, borderRadius: "50%",
                    background: fc, boxShadow: `0 0 4px ${fc}`,
                  }}
                />
              )}
              <Icon size={16} strokeWidth={1.5} color={iconColor} style={{ display: "block" }} />
              <span
                className="font-mono"
                style={{
                  fontSize: 8.5,
                  marginTop: 2,
                  color: iconColor,
                  fontWeight: isActive ? "bold" : "normal",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stat bars row — all vitals except energy */}
      <div className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: "1px solid #0d0d15" }}>
        <StatBar label="❤" value={user.health} max={user.maxHealth} color="#ff2d55" />
        <StatBar label="🧠" value={user.nerve} max={user.maxNerve} color="#39d353" />
        <StatBar label="🥊" value={user.adrenaline} max={user.maxAdrenaline} color="#f59e0b" />
        <StatBar label="🏁" value={user.nitro} max={user.maxNitro} color="#00d4ff" />
      </div>

      {/* Currency row — icon-only, no labels */}
      <div className="flex items-center gap-3 px-3 py-1">
        <span className="font-mono flex items-center gap-1" style={{ color: "#475569" }}>
          💰 <RollingNumber value={user.dc} color="#f59e0b" />
        </span>
        <span className="font-mono flex items-center gap-1" style={{ color: "#475569" }}>
          💎 <RollingNumber value={user.nc} color="#a855f7" />
        </span>
        {(user.keys ?? 0) > 0 && (
          <span className="font-mono flex items-center gap-1" style={{ color: "#475569" }}>
            🗝️ <span style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 11 }}>{user.keys}</span>
          </span>
        )}
        {(user.keyShards ?? 0) > 0 && (
          <span className="font-mono flex items-center gap-1" style={{ color: "#475569" }}>
            🔮 <span style={{ color: "#a855f7", fontWeight: "bold", fontSize: 11 }}>{user.keyShards}</span>
          </span>
        )}
      </div>
    </nav>
  );
}
