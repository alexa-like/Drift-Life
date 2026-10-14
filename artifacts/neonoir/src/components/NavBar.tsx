import { useEffect, useRef, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { User } from "../shared/types";
import { WantedStars } from "../shared/components/WantedStars";
import { formatDC } from "../shared/format";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { AnnouncementBanner } from "../shared/components/AnnouncementBanner";
import { api } from "../shared/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/utils";
import { NAV_ROUTES, type RouteEntry } from "../registry";

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

function useEnergyCountdown(energyRegenAt: string | null | undefined, energy: number, maxEnergy: number): number | null {
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
  return secsLeft;
}

function CurrencyBadge({ label, value, color, integer }: { label: string; value: number; color: string; integer?: boolean }) {
  return (
    <span className="font-mono flex items-center gap-1 flex-shrink-0">
      <span style={{ color: "#475569", fontSize: 9, textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.05em" }}>{label}</span>
      {integer
        ? <span style={{ color, fontWeight: "bold", fontSize: 11, textShadow: `0 0 8px ${color}60` }}>{value.toLocaleString()}</span>
        : <RollingNumber value={value} color={color} />
      }
    </span>
  );
}

function StatBar({ label, value, max, color, sublabel }: { label: string; value: number; max: number; color: string; sublabel?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 flex flex-col justify-center" style={{ minWidth: 0 }}>
      <div className="flex justify-between items-baseline mb-0.5 font-mono text-[9px] uppercase font-bold">
        <span style={{ color }}>
          {label}
          {sublabel && <span style={{ color: "#475569", fontWeight: "normal", marginLeft: 3 }}>{sublabel}</span>}
        </span>
        <span style={{ color: "#e2e8f0" }}>{value}</span>
      </div>
      <div className="h-1 bg-[#1e1e2e] clip-bar w-full">
        <div className="h-full clip-bar" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
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
          aria-label="Search network"
          className="w-full font-mono px-6 py-1.5 clip-bar text-xs uppercase"
          style={{ background: "#08080c", border: "1px solid #1e1e2e", color: "#00d4ff", outline: "none" }}
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1 clip-card"
          style={{ background: "#0a0a0f", border: "1px solid #00d4ff40", boxShadow: "0 8px 32px #00d4ff20", zIndex: 60, maxHeight: 320, overflowY: "auto" }}
        >
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
        aria-label="User account menu"
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 font-mono px-2 py-1 clip-btn transition-colors hover:bg-slate-800"
        style={{ fontSize: 11, color: "#e2e8f0", background: "#111118", border: "1px solid #1e1e2e" }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            loading="lazy"
            style={{ width: 20, height: 20, clipPath: "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)", objectFit: "cover" }}
          />
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
  const energyColor = user.energy >= user.maxEnergy ? "#39d353" : "#00d4ff";
  const energySecsLeft = useEnergyCountdown((user as any).energyRegenAt, user.energy, user.maxEnergy);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Filter nav items from registry — same logic as before
  const filteredNav = (user.navOrder && (user.navOrder as string[]).length > 0
    ? [...NAV_ROUTES].sort((a, b) => {
        const order = user.navOrder as string[];
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
    : NAV_ROUTES
  ).filter((item: RouteEntry) => {
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
  });

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-40"
        style={{ background: "#0a0a0f", borderBottom: "1px solid #1e1e2e" }}
      >
        {/* HUD Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0V0zm10 10h10v10H10V10zM0 10h10v10H0V10zM10 0h10v10H10V0z\' fill=\'%2300d4ff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' }} />

        {/* Top XP Bar */}
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
            style={{ color: user.activeEvent?.primaryColor || "#00d4ff", textShadow: `0 0 15px ${user.activeEvent?.primaryColor || "#00d4ff"}` }}
            onClick={() => onNav("dashboard")}
          >
            {user.activeEvent?.gameDisplayName ?? "NEONOIR"}
          </button>

          <div className="hidden sm:block flex-1 max-w-xs mx-2">
            <SearchBar onInspectPlayer={onInspectPlayer} onNav={onNav} />
          </div>
          <div className="flex-1 sm:hidden" />

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onNav("notifications")}
              aria-label={unreadNotifs > 0 ? `Notifications (${unreadNotifs} unread)` : "Notifications"}
              className="relative font-mono px-2 py-1 clip-btn transition-colors hover:bg-slate-800 flex items-center justify-center"
              style={{
                fontSize: 12,
                color: unreadNotifs > 0 ? "#ff2d55" : "#475569",
                background: unreadNotifs > 0 ? "#ff2d5515" : "#111118",
                border: `1px solid ${unreadNotifs > 0 ? "#ff2d55" : "#1e1e2e"}`,
                boxShadow: unreadNotifs > 0 ? "0 0 12px #ff2d5540" : "none",
              }}
            >
              <Bell size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <AvatarMenu user={user} onNav={onNav} onLogout={onLogout} />
            <button
              className="md:hidden flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                background: mobileMenuOpen ? "#00d4ff20" : "#111118",
                border: `1px solid ${mobileMenuOpen ? "#00d4ff" : "#1e1e2e"}`,
                borderRadius: 2,
              }}
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileMenuOpen ? (
                  <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={18} color="#00d4ff" />
                  </motion.span>
                ) : (
                  <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={18} color="#64748b" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <AnnouncementBanner />

        {/* Row A: Vitals */}
        <div className="flex items-center gap-2 px-4 py-1.5" style={{ background: "rgba(13,13,20,0.85)", backdropFilter: "blur(4px)", borderBottom: "1px solid #111118" }}>
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                HOSP
              </span>
            )}
            {isJailed && (
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 clip-btn font-bold bg-amber-900/30 text-amber-500 border border-amber-500/50">
                JAIL
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <StatBar label="HP"  value={user.health} max={user.maxHealth} color="#ff2d55" />
            <StatBar label="NRV" value={user.nerve}  max={user.maxNerve}  color="#ff6b35" />
            <StatBar
              label="ENG"
              value={user.energy}
              max={user.maxEnergy}
              color={energyColor}
              sublabel={energySecsLeft !== null && user.energy < user.maxEnergy ? `+${energySecsLeft}s` : undefined}
            />
          </div>
        </div>

        {/* Row B: Currencies */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5" style={{ background: "rgba(8,8,12,0.9)", backdropFilter: "blur(4px)", borderBottom: "1px solid #1e1e2e" }}>
          <CurrencyBadge label="DC"     value={user.dc}                    color="#f59e0b" />
          <CurrencyBadge label="NC"     value={user.nc}                    color="#a855f7" />
          <CurrencyBadge label="BANK"   value={user.bankBalance}           color="#10b981" />
          <CurrencyBadge label="KEYS"   value={user.keys ?? 0}             color="#00d4ff" integer />
          <CurrencyBadge label="SHARDS" value={user.keyShards ?? 0}        color="#64748b" integer />
          <CurrencyBadge label="MERIT"  value={(user as any).merit ?? 0}   color="#f43f5e" integer />
          <CurrencyBadge label="SPINS"  value={(user as any).spinTokens ?? 0} color="#8b5cf6" integer />
        </div>

        {/* Nav Icons — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {filteredNav.map(item => {
            const isActive = active === item.id;
            const Icon = item.icon;
            const isEventItem = item.id === "events";
            const hasActiveEvent = isEventItem && !!user.activeEvent;
            const eventColor = user.activeEvent?.primaryColor || "#ff2d55";
            const iconColor = isActive ? "#00d4ff" : hasActiveEvent ? eventColor : "#475569";
            return (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className="relative flex flex-col items-center flex-shrink-0 group transition-all clip-nav-item"
                style={{
                  minWidth: 54,
                  padding: "8px 4px 6px",
                  background: isActive ? "#00d4ff20" : hasActiveEvent ? `${eventColor}15` : "#111118",
                  border: isActive ? "1px solid #00d4ff" : hasActiveEvent ? `1px solid ${eventColor}50` : "1px solid #1e1e2e",
                  boxShadow: isActive ? "0 0 20px #00d4ff40" : hasActiveEvent ? `0 0 12px ${eventColor}30` : "none",
                }}
              >
                {hasActiveEvent && !isActive && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-ping"
                    style={{ background: eventColor, boxShadow: `0 0 6px ${eventColor}` }}
                  />
                )}
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
                    color: isActive ? "#fff" : hasActiveEvent ? eventColor : "#64748b",
                    fontWeight: isActive || hasActiveEvent ? "bold" : "normal",
                    textShadow: isActive ? "0 0 5px #00d4ff" : hasActiveEvent ? `0 0 5px ${eventColor}` : "none",
                  }}
                >
                  {hasActiveEvent ? (user.activeEvent!.chatBadgeText?.split(" ")[0] || "Event") : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile slide-in drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[50] md:hidden"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="absolute top-0 right-0 bottom-0 overflow-y-auto"
              style={{
                width: "min(320px, 85vw)",
                background: "#0a0a0f",
                borderLeft: "1px solid #00d4ff40",
                boxShadow: "-10px 0 40px #00d4ff10",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid #1e1e2e", background: "#111118" }}
              >
                <span className="font-display font-black text-sm tracking-widest uppercase" style={{ color: "#00d4ff" }}>
                  NAVIGATION
                </span>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu">
                  <X size={18} color="#475569" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3">
                {filteredNav.map(item => {
                  const isActive = active === item.id;
                  const Icon = item.icon;
                  const isEventItem = item.id === "events";
                  const hasActiveEvent = isEventItem && !!user.activeEvent;
                  const eventColor = user.activeEvent?.primaryColor || "#ff2d55";
                  const iconColor = isActive ? "#00d4ff" : hasActiveEvent ? eventColor : "#475569";
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNav(item.id); setMobileMenuOpen(false); }}
                      style={{
                        padding: "12px 6px",
                        background: isActive ? "#00d4ff20" : "#111118",
                        border: `1px solid ${isActive ? "#00d4ff" : "#1e1e2e"}`,
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        minHeight: 64,
                      }}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2 : 1.5} color={iconColor} />
                      <span
                        className="font-mono uppercase"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.06em",
                          color: isActive ? "#00d4ff" : "#64748b",
                          fontWeight: isActive ? "bold" : "normal",
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
