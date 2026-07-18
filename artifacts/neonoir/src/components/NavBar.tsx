import { useEffect, useRef, useState } from "react";
import {
  Home, Newspaper, MessageCircle, Package, Image as ImageIcon, CreditCard,
  BarChart2, Gavel, Building2, Dumbbell, Briefcase, Car, Globe, Cpu, Shield, Swords, Crosshair,
  Crown, ClipboardList, Skull, Plane, ShoppingCart, Building, Users, Landmark,
  Wrench, Trophy, Gift, PawPrint, Bell, Settings, Flag, type LucideIcon,
} from "lucide-react";
import { User } from "../lib/types";
import { WantedStars } from "./WantedStars";
import { formatDC } from "../lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { api } from "../lib/api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  return <span className="font-mono tabular-nums" style={{ color, fontSize: 12, fontWeight: "bold", textShadow: `0 0 8px ${color}60` }}>{formatDC(display)}</span>;
}

const FACTION_COLOR_DEFAULT = "#00d4ff";

const NAV: { id: string; label: string; icon: LucideIcon; notify?: boolean; minStage?: number; group?: string; statusFilter?: string; roles?: string[] }[] = [
  { id: "dashboard",    label: "Home",     icon: Home },
  { id: "feed",         label: "Feed",     icon: Newspaper },
  { id: "chat",         label: "Chat",     icon: MessageCircle },
  { id: "inventory",    label: "Bag",      icon: Package },
  { id: "store",        label: "Store",    icon: CreditCard },
  { id: "leaderboard",  label: "Board",    icon: BarChart2 },
  { id: "auction",      label: "Auction",  icon: Gavel },
  { id: "city",         label: "City",     icon: Building2,     group: "wc",  statusFilter: "normal" },
  { id: "training",     label: "Gym",      icon: Dumbbell,      group: "wc",  statusFilter: "normal" },
  { id: "jobs",         label: "Jobs",     icon: Briefcase,     group: "wc",  statusFilter: "normal" },
  { id: "garage",       label: "Garage",   icon: Car,           group: "wc",  minStage: 1, statusFilter: "normal" },
  { id: "net",          label: "Net",      icon: Globe,         group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "cyber",        label: "Cyber",    icon: Cpu,           group: "wc",  minStage: 3, statusFilter: "normal" },
  { id: "guilds",       label: "Crew",     icon: Shield,        group: "wc",  minStage: 2, statusFilter: "normal" },
  { id: "faction",      label: "Faction",  icon: Flag,                        statusFilter: "normal" },
  { id: "business",     label: "Biz",      icon: Building2,     group: "wc",  statusFilter: "normal" },
  { id: "arena",        label: "Arena",    icon: Swords,        statusFilter: "normal" },
  { id: "loadout",      label: "Loadout",  icon: Crosshair,     statusFilter: "normal" },
  // { id: "royale",    label: "Royale",   icon: Crown,         statusFilter: "normal" }, // frozen
  { id: "missions",     label: "Missions", icon: ClipboardList },
  { id: "crimes",       label: "Crimes",   icon: Skull,         statusFilter: "normal|abroad" },
  { id: "travel",       label: "Travel",   icon: Plane,         statusFilter: "normal|abroad" },
  { id: "market",       label: "Market",   icon: ShoppingCart,  statusFilter: "normal|abroad" },
  { id: "district-hub", label: "Hub",      icon: Building,      statusFilter: "abroad" },
  { id: "friends",      label: "Friends",  icon: Users,         statusFilter: "normal" },
  { id: "bank",         label: "Bank",     icon: Landmark,      statusFilter: "normal" },
  // { id: "crafting",  label: "Craft",    icon: Wrench,        statusFilter: "normal" }, // frozen
  { id: "achievements", label: "Achiev",   icon: Trophy },
  { id: "daily",        label: "Daily",    icon: Gift },
  // { id: "companions", label: "Allies",  icon: PawPrint,      statusFilter: "normal" }, // frozen
  { id: "staff-portal", label: "Staff",    icon: Shield,        roles: ["staff", "admin", "owner"] },
  { id: "owner",        label: "Owner",    icon: Settings,      roles: ["admin", "owner"] },
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
  const color = isFull ? "#39d353" : "#00d4ff";
  return (
    <span className="font-mono flex items-center gap-1" style={{ color, fontWeight: "bold", fontSize: 11, textShadow: `0 0 8px ${color}60` }}>
      ENG:{energy}/{maxEnergy}
      {!isFull && secsLeft !== null && secsLeft > 0 && (
        <span style={{ color: "#475569", fontWeight: "normal", fontSize: 10, textShadow: "none" }}>
          +{secsLeft}s
        </span>
      )}
    </span>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex-1 flex flex-col justify-center px-1" style={{ minWidth: 60 }}>
      <div className="flex justify-between items-baseline mb-0.5 font-mono text-[9px] uppercase font-bold" style={{ color }}>
        <span>{label}</span>
        <span style={{ color: "#e2e8f0" }}>{value}</span>
      </div>
      <div className="h-1 bg-[#1e1e2e] clip-bar w-full">
        <div 
          className="h-full clip-bar" 
          style={{ 
            width: `${pct}%`, 
            background: color,
            boxShadow: `0 0 6px ${color}`
          }} 
        />
      </div>
    </div>
  );
}

function SearchBar({ onInspectPlayer, onNav }: { onInspectPlayer?: (id: string) => void; onNav: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
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
        const r = await api.get<any>(`/search?q=${encodeURIComponent(q.trim())}`);
        setResults(r);
      } catch {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(iv);
  }, [q]);

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xs mx-2">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-cyan-500 font-mono animate-pulse">{">"}</span>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="SEARCH DATA..."
          className="w-full font-mono px-6 py-1.5 clip-bar text-xs uppercase"
          style={{ background: "#08080c", border: "1px solid #1e1e2e", color: "#00d4ff", outline: "none" }}
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1 clip-card"
          style={{ background: "#0a0a0f", border: "1px solid #00d4ff40", boxShadow: "0 8px 32px #00d4ff20", zIndex: 60, maxHeight: 320, overflowY: "auto" }}
        >
          {/* Results render here... */}
          <div className="p-2 font-mono text-xs text-slate-400">SEARCHING NETWORK...</div>
        </div>
      )}
    </div>
  );
}

function AvatarMenu({ user, onNav, onLogout }: { user: User; onNav: (id: string) => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
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
        className="flex items-center gap-2 font-mono px-2 py-1 clip-btn transition-colors hover:bg-slate-800"
        style={{ fontSize: 11, color: "#e2e8f0", background: "#111118", border: "1px solid #1e1e2e" }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" style={{ width: 20, height: 20, clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)", objectFit: "cover" }} />
        ) : (
          <span className="text-cyan-500">USER</span>
        )}
        <span className="hidden sm:inline font-bold text-cyan-400">{user.username}</span>
        <span style={{ color: "#475569" }}>▼</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 clip-card"
          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", boxShadow: "0 8px 24px #000a", zIndex: 60, minWidth: 160 }}
        >
          {[
            { id: "profile", label: "Profile" },
            { id: "settings", label: "Settings" },
            { id: "support", label: "Support" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); setOpen(false); }}
              className="w-full text-left font-mono px-4 py-2.5 hover:bg-slate-800 transition-colors uppercase text-xs tracking-widest"
              style={{ color: "#e2e8f0" }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => { setLogoutConfirm(true); setOpen(false); }}
            className="w-full text-left font-mono px-4 py-2.5 hover:bg-red-900/20 transition-colors uppercase text-xs tracking-widest"
            style={{ color: "#ff2d55", borderTop: "1px solid #1e1e2e" }}
          >
            DISCONNECT
          </button>
        </div>
      )}
      {logoutConfirm && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to keep playing."
          confirmLabel="Log Out"
          danger
          onConfirm={() => { setLogoutConfirm(false); onLogout(); }}
          onCancel={() => setLogoutConfirm(false)}
        />
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
  onHeightChange?: (h: number) => void;
}

export function NavBar({ user, active, onNav, onLogout, unreadNotifs, onInspectPlayer, onHeightChange }: Props) {
  const isHosp = user.hospitalizedUntil && new Date(user.hospitalizedUntil) > new Date();
  const isJailed = user.jailUntil && new Date(user.jailUntil) > new Date();
  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const fc = user.faction ? FACTION_COLOR_DEFAULT : "#64748b";

  const navRef = useRef<HTMLElement>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  useEffect(() => { onHeightChangeRef.current = onHeightChange; }, [onHeightChange]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect.height ?? el.offsetHeight;
      onHeightChangeRef.current?.(Math.ceil(h));
    });
    ro.observe(el);
    const raf = requestAnimationFrame(() => {
      onHeightChangeRef.current?.(Math.ceil(el.offsetHeight));
    });
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-40"
      style={{ background: "#0a0a0f", borderBottom: "1px solid #1e1e2e" }}
    >
      {/* HUD Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0V0zm10 10h10v10H10V10zM0 10h10v10H0V10zM10 0h10v10H10V0z\' fill=\'%2300d4ff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }} />

      {/* Top XP Bar - Full width */}
      <div className="h-1 w-full bg-[#111118] relative overflow-hidden">
        <motion.div
          className="h-full absolute top-0 left-0"
          initial={{ width: 0 }}
          animate={{ width: `${xpPct}%` }}
          style={{
            background: `linear-gradient(90deg, ${fc}40, ${fc})`,
            boxShadow: `0 0 10px ${fc}`,
          }}
        >
          {/* Sweeping highlight on XP bar */}
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute top-0 bottom-0 w-20"
            style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`, transform: "skewX(-20deg)" }}
          />
        </motion.div>
        {xpPct >= 95 && (
          <div className="absolute top-0 bottom-0 left-0 right-0 animate-pulse bg-white/20" />
        )}
      </div>

      {/* Main Bar */}
      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid #111118" }}>
        <button
          className="font-display font-black text-xl flex-shrink-0 tracking-widest uppercase glitch-text"
          style={{ color: "#00d4ff", textShadow: "0 0 15px #00d4ff" }}
          onClick={() => onNav("dashboard")}
        >
          DRIFT
        </button>

        <SearchBar onInspectPlayer={onInspectPlayer} onNav={onNav} />

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onNav("notifications")}
            className="relative font-mono px-2 py-1 clip-btn transition-colors hover:bg-slate-800 flex items-center justify-center"
            style={{
              fontSize: 12,
              color: unreadNotifs > 0 ? "#ff2d55" : "#475569",
              background: unreadNotifs > 0 ? "#ff2d5515" : "#111118",
              border: `1px solid ${unreadNotifs > 0 ? "#ff2d55" : "#1e1e2e"}`,
              boxShadow: unreadNotifs > 0 ? "0 0 12px #ff2d5540" : "none",
            }}
          >
            <Bell size={16} strokeWidth={2} />
          </button>
          <AvatarMenu user={user} onNav={onNav} onLogout={onLogout} />
        </div>
      </div>

      <AnnouncementBanner />

      {/* Vitals & Status Strip - HUD overlay feel */}
      <div className="flex items-center px-4 py-1.5 overflow-x-auto gap-4" style={{ background: "rgba(13, 13, 20, 0.8)", backdropFilter: "blur(4px)", borderBottom: "1px solid #1e1e2e", scrollbarWidth: "none", boxShadow: "inset 0 -10px 20px rgba(0,0,0,0.5)" }}>
        {/* Status tags */}
        <div className="flex gap-2 flex-shrink-0">
          <span className="font-mono text-[10px] uppercase bg-slate-800 px-2 py-0.5 clip-btn text-slate-300">
            Lv.<span className="text-white font-bold">{user.level}</span>
          </span>
          {user.faction && (
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 clip-btn font-bold" style={{ background: `${fc}20`, color: fc, border: `1px solid ${fc}40` }}>
              {user.faction}
            </span>
          )}
          {isHosp && (
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 clip-btn animate-pulse font-bold bg-red-900/30 text-red-500 border border-red-500/50">
              HOSPITAL
            </span>
          )}
          {isJailed && (
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 clip-btn font-bold bg-amber-900/30 text-amber-500 border border-amber-500/50">
              JAILED
            </span>
          )}
        </div>

        {/* HUD Bars */}
        <div className="flex-1 flex items-center gap-3 min-w-[300px]">
          <StatBar label="HP" value={user.health} max={user.maxHealth} color="#ff2d55" />
          <StatBar label="NRV" value={user.nerve} max={user.maxNerve} color="#ff6b35" />
          <StatBar label="ADR" value={user.adrenaline} max={user.maxAdrenaline} color="#f59e0b" />
          <div className="flex-1 flex justify-end">
            <EnergyDisplay energy={user.energy} maxEnergy={user.maxEnergy} energyRegenAt={(user as any).energyRegenAt} />
          </div>
        </div>

        {/* Currencies */}
        <div className="flex gap-4 flex-shrink-0 bg-[#08080c] px-3 py-1 clip-bar border border-[#1e1e2e]">
          <span className="font-mono text-xs flex items-center gap-1" style={{ color: "#f59e0b" }}>
            <span className="text-[#64748b]">DC</span>
            <RollingNumber value={user.dc} color="#f59e0b" />
          </span>
          <span className="font-mono text-xs flex items-center gap-1" style={{ color: "#a855f7" }}>
            <span className="text-[#64748b]">NC</span>
            <RollingNumber value={user.nc} color="#a855f7" />
          </span>
        </div>
      </div>

      {/* Nav Icons */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {NAV.filter(item => {
          const minStage = item.minStage ?? 0;
          if ((user.onboardingStage ?? 0) < minStage) return false;
          if (item.roles && !item.roles.includes(user.role)) return false;
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
          const iconColor = isActive ? "#00d4ff" : "#475569";
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className="flex flex-col items-center flex-shrink-0 group transition-all clip-nav-item"
              style={{
                minWidth: 54,
                padding: "8px 4px 6px",
                background: isActive ? "#00d4ff20" : "#111118",
                border: isActive ? "1px solid #00d4ff" : "1px solid #1e1e2e",
                boxShadow: isActive ? "0 0 20px #00d4ff40" : "none",
              }}
            >
              <Icon 
                size={18} 
                strokeWidth={isActive ? 2 : 1.5} 
                color={iconColor} 
                className={cn(isActive && "drop-shadow-[0_0_12px_#00d4ff]")}
              />
              <span
                className={cn("font-mono uppercase tracking-wider mt-1.5", isActive && "glitch-text")}
                style={{
                  fontSize: 8,
                  color: isActive ? "#fff" : "#64748b",
                  fontWeight: isActive ? "bold" : "normal",
                  textShadow: isActive ? "0 0 5px #00d4ff" : "none",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
