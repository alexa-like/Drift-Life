import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PreferencesProvider, usePreferences } from "./context/PreferencesContext";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { useConnectivity } from "./hooks/useConnectivity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { NavBar } from "./components/NavBar";
import { BottomNav } from "./components/BottomNav";
import { CyberSkeleton } from "./components/CyberSkeleton";
import { PageTransition } from "./components/PageTransition";
import { ToastContainer } from "./components/ToastContainer";
import { DevToolbar } from "./components/DevToolbar";
import { PlayerInspectModal } from "./components/PlayerInspectModal";
import { OfflineOverlay } from "./components/OfflineOverlay";
import { PlayerVantaPanel } from "./components/PlayerVantaPanel";
import OnboardingModal from "./components/OnboardingModal";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { api } from "./lib/api";
import { Notification } from "./lib/types";
import {
  isPushSupported,
  getPushPermission,
  getSubscriptionStatus,
  subscribeToPush,
  isWebView,
} from "./lib/pushNotifications";

// ── 13.5 Performance: Lazy-load all page modules ─────────────────────────────
// Named exports need the .then(m => ({ default: m.X })) pattern
const AuthPage         = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));
const Dashboard        = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const CrimesPage       = lazy(() => import("./pages/CrimesPage").then(m => ({ default: m.CrimesPage })));
const JobsPage         = lazy(() => import("./pages/JobsPage").then(m => ({ default: m.JobsPage })));
const BankPage         = lazy(() => import("./pages/BankPage").then(m => ({ default: m.BankPage })));
const InventoryPage    = lazy(() => import("./pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const LeaderboardPage  = lazy(() => import("./pages/LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
const FeedPage         = lazy(() => import("./pages/FeedPage").then(m => ({ default: m.FeedPage })));
const NotificationsPage= lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const HospitalPage     = lazy(() => import("./pages/HospitalPage").then(m => ({ default: m.HospitalPage })));
const ProfilePage      = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const SettingsPage     = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const OwnerPage        = lazy(() => import("./pages/OwnerPage").then(m => ({ default: m.OwnerPage })));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
const ChatPage         = lazy(() => import("./pages/ChatPage").then(m => ({ default: m.ChatPage })));
const GuildsPage       = lazy(() => import("./pages/GuildsPage").then(m => ({ default: m.GuildsPage })));
const AuctionPage      = lazy(() => import("./pages/AuctionPage").then(m => ({ default: m.AuctionPage })));
const TradePage        = lazy(() => import("./pages/TradePage").then(m => ({ default: m.TradePage })));
const FriendsPage      = lazy(() => import("./pages/FriendsPage").then(m => ({ default: m.FriendsPage })));
const MissionsPage     = lazy(() => import("./pages/MissionsPage").then(m => ({ default: m.MissionsPage })));
const DistrictHubPage  = lazy(() => import("./pages/DistrictHubPage").then(m => ({ default: m.DistrictHubPage })));
const TravelPage       = lazy(() => import("./pages/TravelPage").then(m => ({ default: m.TravelPage })));
const DailyPage        = lazy(() => import("./pages/DailyPage").then(m => ({ default: m.DailyPage })));
const DistrictPage     = lazy(() => import("./pages/DistrictPage").then(m => ({ default: m.DistrictPage })));
const LegalPage        = lazy(() => import("./pages/LegalPage").then(m => ({ default: m.LegalPage })));
const SupportPage      = lazy(() => import("./pages/SupportPage").then(m => ({ default: m.SupportPage })));
const BusinessPage     = lazy(() => import("./pages/BusinessPage").then(m => ({ default: m.BusinessPage })));
const FactionPage      = lazy(() => import("./pages/FactionPage").then(m => ({ default: m.FactionPage })));
const StorePage        = lazy(() => import("./pages/StorePage").then(m => ({ default: m.StorePage })));
const StaffPortalPage  = lazy(() => import("./pages/StaffPortalPage").then(m => ({ default: m.StaffPortalPage })));
const HackPage         = lazy(() => import("./pages/HackPage"));
const MentorPage       = lazy(() => import("./pages/MentorPage"));

// Default exports use the simpler lazy(() => import(...)) pattern
const TrainingCenterPage = lazy(() => import("./pages/TrainingCenterPage"));
const MatchHistoryPage   = lazy(() => import("./pages/MatchHistoryPage"));
const GaragePage         = lazy(() => import("./pages/GaragePage"));
const ArenaHubPage       = lazy(() => import("./pages/ArenaHubPage"));
const ArenaCombatPage    = lazy(() => import("./pages/ArenaCombatPage"));
const LoadoutPage        = lazy(() => import("./pages/LoadoutPage"));
const ShopHubPage        = lazy(() => import("./pages/ShopHubPage"));
const NpcStorePage       = lazy(() => import("./pages/NpcStorePage"));
const RaceHubPage        = lazy(() => import("./pages/RaceHubPage"));
const RaceMatchPage      = lazy(() => import("./pages/RaceMatchPage"));
const CityPage           = lazy(() => import("./pages/CityPage"));
const NetPage            = lazy(() => import("./pages/NetPage"));
const CyberPage          = lazy(() => import("./pages/CyberPage"));
const EventPage          = lazy(() => import("./pages/EventPage"));
const UpcomingEventsPage = lazy(() => import("./pages/UpcomingEventsPage"));
const EventArchivePage   = lazy(() => import("./pages/EventArchivePage"));
const HallOfFamePage     = lazy(() => import("./pages/HallOfFamePage"));
const BattlePassPage     = lazy(() => import("./pages/BattlePassPage"));

const queryClient = new QueryClient();

/** Suspense fallback: full-width skeleton that matches the nav height offset */
function PageLoadFallback() {
  return (
    <div className="py-8 px-1">
      <CyberSkeleton type="list" count={8} />
    </div>
  );
}

function SocketEvents({ addToast, onUserUpdate }: { addToast: (message: string, type?: "success" | "error" | "info" | "warning") => void; onUserUpdate: () => void }) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onAttack = (data: { attackerUsername: string; won: boolean; dcLost: number; hospitalized: boolean }) => {
      if (data.won) {
        addToast(`You fought off an attack from ${data.attackerUsername}!`, "success");
      } else {
        addToast(`${data.attackerUsername} attacked and took ${data.dcLost.toLocaleString()} DC from you${data.hospitalized ? " — you were hospitalized" : ""}`, "error");
      }
      onUserUpdate();
    };
    const onTradeOffer = (data: { fromUsername: string }) => {
      addToast(`${data.fromUsername} sent you a trade offer`, "info");
    };
    const onTradeCompleted = (data: { withUsername: string }) => {
      addToast(`Trade with ${data.withUsername} completed`, "success");
      onUserUpdate();
    };
    const onTradeDeclined = () => {
      addToast("Your trade offer was declined", "warning");
    };
    const onAuctionOutbid = (data: { itemName: string; newBid: number }) => {
      addToast(`You were outbid on "${data.itemName}" — new bid ${data.newBid.toLocaleString()} DC`, "warning");
      onUserUpdate();
    };
    const onAuctionSold = (data: { itemName: string; amount: number }) => {
      addToast(`Your "${data.itemName}" sold for ${data.amount.toLocaleString()} DC`, "success");
      onUserUpdate();
    };

    const onBalanceUpdate = () => { onUserUpdate(); };
    const onUserDataUpdated = () => { onUserUpdate(); };

    socket.on("attack_notification", onAttack);
    socket.on("trade_offer", onTradeOffer);
    socket.on("trade_completed", onTradeCompleted);
    socket.on("trade_declined", onTradeDeclined);
    socket.on("auction_outbid", onAuctionOutbid);
    socket.on("auction_sold", onAuctionSold);
    socket.on("balance_update", onBalanceUpdate);
    socket.on("user_data_updated", onUserDataUpdated);

    return () => {
      socket.off("attack_notification", onAttack);
      socket.off("trade_offer", onTradeOffer);
      socket.off("trade_completed", onTradeCompleted);
      socket.off("trade_declined", onTradeDeclined);
      socket.off("auction_outbid", onAuctionOutbid);
      socket.off("auction_sold", onAuctionSold);
      socket.off("balance_update", onBalanceUpdate);
      socket.off("user_data_updated", onUserDataUpdated);
    };
  }, [socket, addToast, onUserUpdate]);

  return null;
}

// ── Hash routing helpers ──────────────────────────────────────────────────────
const HASH_BLOCKLIST = new Set(["arena-combat", "race-match"]);

function getPageFromHash(): string {
  const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return raw || "feed";
}

function setHash(page: string) {
  if (HASH_BLOCKLIST.has(page)) return;
  const newHash = `#/${page}`;
  if (window.location.hash !== newHash) {
    window.history.pushState(null, "", newHash);
  }
}

function GameApp() {
  const { theme, hydrateFromAccount } = usePreferences();
  const { user, loading, login, logout, refreshUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    if (user) hydrateFromAccount(String(user.id), user.uiScale, user.uiTheme);
  }, [user?.id, hydrateFromAccount]);

  // ── Hash-based routing ──────────────────────────────────────────────────────
  const [page, setPageState] = useState(() => getPageFromHash());
  const setPage = useCallback((p: string) => {
    setPageState(p);
    setHash(p);
  }, []);
  useEffect(() => { (window as any).__setPage = setPage; }, [setPage]);

  useEffect(() => {
    const handler = () => setPageState(getPageFromHash());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => { setHash(page); }, [page]);

  // ── Deployment update detection ──────────────────────────────────────────────
  const updateAvailable = useUpdateCheck(5 * 60 * 1000);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // ── Event theme ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ev = user?.activeEvent;
    const root = document.documentElement;
    if (ev) {
      root.style.setProperty("--event-primary", ev.primaryColor || "#00d4ff");
      root.style.setProperty("--event-accent",  ev.accentColor  || "#ff2d55");
      root.style.setProperty("--event-bg",      ev.backgroundColor || "transparent");
      document.title = ev.gameDisplayName || "Neonoir";
    } else {
      root.style.removeProperty("--event-primary");
      root.style.removeProperty("--event-accent");
      root.style.removeProperty("--event-bg");
      document.title = "Neonoir";
    }
  }, [user?.activeEvent?.eventId]);

  // ── Connectivity ─────────────────────────────────────────────────────────────
  const { isOnline, checkNow } = useConnectivity();

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [navHeight, setNavHeight] = useState(210);

  // Publish nav height as a CSS variable so pages like ChatPage can size themselves correctly
  // without hardcoding a pixel offset that breaks under zoom or scaling.
  useEffect(() => {
    document.documentElement.style.setProperty("--nav-h", `${navHeight}px`);
  }, [navHeight]);

  // Auto-prompt for push notifications on first login.
  // Only fires once per session when the user object first appears.
  // Skips silently if: WebView wrapper, push unsupported, permission already decided, or already subscribed.
  const pushAttempted = useRef(false);
  useEffect(() => {
    if (!user || pushAttempted.current) return;
    if (isWebView()) return;          // WebViews don't support PushManager — never prompt
    if (!isPushSupported()) return;
    if (getPushPermission() !== "default") return; // already granted or denied — don't re-prompt
    pushAttempted.current = true;
    // Short delay so the page finishes rendering before the browser dialog appears.
    const t = setTimeout(async () => {
      const alreadySubscribed = await getSubscriptionStatus();
      if (!alreadySubscribed) {
        await subscribeToPush();
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [user]);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [shopStoreId, setShopStoreId] = useState<string | null>(null);
  const [tradeWithPlayer, setTradeWithPlayer] = useState<{ id: string; username: string } | null>(null);
  const [arenaHp, setArenaHp] = useState<{ current: number; max: number } | null>(null);
  const handleArenaHpChange = useCallback((current: number, max: number) => {
    setArenaHp({ current, max });
  }, []);

  const navTo = useCallback((p: string) => {
    setPage(p);
    if (p !== "arena-combat") setArenaHp(null);
  }, [setPage]);

  // Poll notifications count
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      const notifs = await api.get<Notification[]>("/notifications").catch(() => [] as Notification[]);
      setUnreadNotifs(notifs.filter(n => !n.read).length);
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = useCallback(async () => {
    await logout();
    setPage("feed");
  }, [logout]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-terminal relative overflow-hidden" style={{ background: "#05050a" }}>
        <div className="scanlines absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-20 data-stream" />
        
        <div className="relative z-10 flex flex-col items-start w-full max-w-lg p-8">
          <div
            className="font-display font-black text-4xl tracking-widest mb-8 uppercase glitch-text"
            style={{ color: "#00d4ff", textShadow: "0 0 20px #00d4ff" }}
          >
            NEONOIR_OS
          </div>
          
          <div className="font-mono text-sm text-[#39d353] flex flex-col gap-2 w-full">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>{">"} INITIALIZING CORE...</motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{">"} LOADING DISTRICT DATA...</motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>{">"} ESTABLISHING SECURE CHANNEL...</motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>{">"} SYNCING OPERATIVE PROFILE...</motion.div>
            
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: "100%" }} 
              transition={{ delay: 1.5, duration: 1 }}
              className="h-2 bg-[#00d4ff] mt-4 clip-bar"
              style={{ boxShadow: "0 0 15px #00d4ff" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
        <AuthPage onLogin={login} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </Suspense>
    );
  }

  const pageProps = { user: user!, refreshUser, addToast };

  function renderPage() {
    switch (page) {
      case "dashboard":    return <Dashboard {...pageProps} onNav={setPage} />;
      case "feed":         return <FeedPage user={user!} refreshUser={refreshUser} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      case "crimes":       return <CrimesPage {...pageProps} />;
      case "jobs":         return <JobsPage {...pageProps} />;

      case "bank":         return <BankPage {...pageProps} />;
      case "market":
      case "shop":         return shopStoreId
                              ? <NpcStorePage key={shopStoreId} storeId={shopStoreId} onBack={() => { setShopStoreId(null); }} />
                              : <ShopHubPage onSelectStore={(id) => setShopStoreId(id)} />;
      case "inventory":    return <InventoryPage {...pageProps} />;
      case "leaderboard":  return <LeaderboardPage onNavigate={setPage} />;
      case "hospital":     return <HospitalPage {...pageProps} />;
      case "profile":      return <ProfilePage {...pageProps} />;
      case "settings":     return <SettingsPage {...pageProps} onLogout={handleLogout} />;
      case "notifications":return <NotificationsPage onUnreadChange={setUnreadNotifs} onInspectPlayer={setInspectUserId} />;
      case "achievements":  return <AchievementsPage {...pageProps} />;
      case "missions":      return <MissionsPage {...pageProps} />;
      case "chat":          return <ChatPage user={user!} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      case "guilds":        return <GuildsPage user={user!} addToast={addToast} />;
      case "faction":       return <FactionPage user={user!} addToast={addToast} />;
      case "business":      return <BusinessPage user={user!} refreshUser={refreshUser} addToast={addToast} />;
      case "auction":       return <AuctionPage {...pageProps} />;
      case "loadout":       return <LoadoutPage user={user!} addToast={addToast} />;
      case "trade":         return <TradePage user={user!} addToast={addToast} prefilledPlayer={tradeWithPlayer} onTradeOpened={() => setTradeWithPlayer(null)} />;
      case "friends":       return <FriendsPage user={user!} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      case "training":
      case "gym":           return <TrainingCenterPage user={user!} refreshUser={refreshUser} addToast={addToast} />;
      case "garage":        return <GaragePage user={user!} onUserUpdate={(_u: any) => { refreshUser(); }} />;
      case "city":          return <CityPage user={user!} onUserUpdate={() => { refreshUser(); }} refreshUser={refreshUser} addToast={addToast} />;
      case "net":           return <NetPage user={user!} onUserUpdate={(_u: any) => { refreshUser(); }} />;
      case "cyber":         return <CyberPage user={user!} addToast={addToast} />;
      case "store":         return <StorePage user={user!} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "events":        return <EventPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "events-upcoming": return <UpcomingEventsPage onNavigate={setPage} />;
      case "events-archive":  return <EventArchivePage onNavigate={setPage} />;
      case "hall-of-fame":    return <HallOfFamePage />;
      case "battle-pass":     return <BattlePassPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "arena":         return <ArenaHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "arena-combat":  return <ArenaCombatPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} onHpChange={handleArenaHpChange} />;
      case "race-hub":      return <RaceHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "race-match":    return <RaceMatchPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "daily":         return <DailyPage {...pageProps} onNav={setPage} />;
      case "district":      return <DistrictPage {...pageProps} />;
      case "legal":         return <LegalPage onNav={setPage} />;
      case "support":       return <SupportPage user={user!} addToast={addToast} />;
      case "travel":        return <TravelPage user={user!} refreshUser={refreshUser} addToast={addToast} onNavigate={setPage} />;
      case "district-hub":  return <DistrictHubPage {...pageProps} />;
      case "match-history": return <MatchHistoryPage />;
      case "hack":          return <HackPage {...pageProps} />;
      case "mentor":        return <MentorPage {...pageProps} />;
      case "owner":
        return (user!.role === "owner" || user!.role === "admin")
          ? <OwnerPage {...pageProps} onNav={setPage} />
          : <Dashboard {...pageProps} onNav={setPage} />;
      case "staff-portal":
        return (user!.role === "staff" || user!.role === "admin" || user!.role === "owner")
          ? <StaffPortalPage user={user!} addToast={addToast} />
          : <Dashboard {...pageProps} onNav={setPage} />;
      default:             return <Dashboard {...pageProps} onNav={setPage} />;
    }
  }

  return (
    <SocketProvider userId={user!.id}>
      <SocketEvents addToast={addToast} onUserUpdate={refreshUser} />
      <OfflineOverlay isOffline={!isOnline} onRetry={checkNow} />
      {updateAvailable && !updateDismissed && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-4 py-2 bg-[#0d0d14] border-b border-[#00d4ff] shadow-[0_0_20px_rgba(0,212,255,0.3)]"
        >
          <span className="font-mono text-sm font-bold text-[#00d4ff] tracking-widest animate-pulse">
            ⚡ NEW UPDATE AVAILABLE
          </span>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-1 text-xs font-mono font-bold text-[#0d0d14] bg-[#00d4ff] clip-btn hover:bg-white transition-colors"
          >
            REBOOT SYSTEM
          </button>
          <button
            onClick={() => setUpdateDismissed(true)}
            className="text-[#64748b] hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
      <div
        className={`scanlines dl-root${theme === "light" ? " dl-light" : ""}`}
        style={{ minHeight: "calc(100dvh / var(--dl-scale, 1))", color: "#e2e8f0" }}
      >
        <NavBar
          user={arenaHp ? { ...user!, health: arenaHp.current, maxHealth: arenaHp.max } : user!}
          active={page}
          onNav={navTo}
          onLogout={handleLogout}
          unreadNotifs={unreadNotifs}
          onInspectPlayer={setInspectUserId}
          onHeightChange={setNavHeight}
        />
        {/* 13.4 — BottomNav pinned for mobile; desktop gets 32px padding, mobile gets 80px for bottom bar */}
        <main
          style={{ paddingTop: navHeight }}
          className="px-3 sm:px-4 max-w-5xl mx-auto w-full pb-20 md:pb-8"
        >
          <Suspense fallback={<PageLoadFallback />}>
            <PageTransition pageKey={page}>
              {renderPage()}
            </PageTransition>
          </Suspense>
        </main>

        {/* 13.4 — Mobile bottom nav bar */}
        <BottomNav active={page} onNav={navTo} />

        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {(user!.onboardingStage ?? 0) < 4 && (
          <OnboardingModal
            user={user!}
            onNav={navTo}
            refreshUser={refreshUser}
            addToast={addToast}
          />
        )}
        <PlayerVantaPanel user={user!} addToast={addToast} />
        {user!.devMode && (
          <DevToolbar user={user!} onRefresh={refreshUser} addToast={addToast} />
        )}
        {inspectUserId && (
          <PlayerInspectModal
            targetId={inspectUserId}
            currentUser={user!}
            onClose={() => setInspectUserId(null)}
            onNav={navTo}
            onTradeWith={(player) => {
              setTradeWithPlayer(player);
              setInspectUserId(null);
              navTo("trade");
            }}
            addToast={addToast}
          />
        )}
      </div>
    </SocketProvider>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <GameApp />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

export default App;
