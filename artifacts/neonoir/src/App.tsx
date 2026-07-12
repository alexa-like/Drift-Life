import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PreferencesProvider, usePreferences } from "./context/PreferencesContext";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { CrimesPage } from "./pages/CrimesPage";
import { JobsPage } from "./pages/JobsPage";

import { BankPage } from "./pages/BankPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeedPage } from "./pages/FeedPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { HospitalPage } from "./pages/HospitalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { FactionSelectPage } from "./pages/FactionSelectPage";
import { OwnerPage } from "./pages/OwnerPage";
import { AchievementsPage } from "./pages/AchievementsPage";
import { ChatPage } from "./pages/ChatPage";
import { SkillsPage } from "./pages/SkillsPage";
import { GuildsPage } from "./pages/GuildsPage";
import { AuctionPage } from "./pages/AuctionPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { CraftingPage } from "./pages/CraftingPage";
import { TradePage } from "./pages/TradePage";
import { FriendsPage } from "./pages/FriendsPage";
import TrainingCenterPage from "./pages/TrainingCenterPage";
import MatchHistoryPage from "./pages/MatchHistoryPage";
import RoyaleHubPage from "./pages/RoyaleHubPage";
import RoyaleCategoryPage from "./pages/RoyaleCategoryPage";
import GaragePage from "./pages/GaragePage";
import ArenaHubPage from "./pages/ArenaHubPage";
import ArenaCombatPage from "./pages/ArenaCombatPage";
import { MissionsPage } from "./pages/MissionsPage";
import LoadoutPage from "./pages/LoadoutPage";
import ShopHubPage from "./pages/ShopHubPage";
import { DistrictHubPage } from "./pages/DistrictHubPage";
import { TravelPage } from "./pages/TravelPage";
import { DailyPage } from "./pages/DailyPage";
import { DistrictPage } from "./pages/DistrictPage";
import { CompanionsPage } from "./pages/CompanionsPage";
import { LegalPage } from "./pages/LegalPage";
import { SupportPage } from "./pages/SupportPage";
import NpcStorePage from "./pages/NpcStorePage";
import RaceHubPage from "./pages/RaceHubPage";
import RaceMatchPage from "./pages/RaceMatchPage";
import { StaffPortalPage } from "./pages/StaffPortalPage";
import CityPage from "./pages/CityPage";
import NetPage from "./pages/NetPage";
import CyberPage from "./pages/CyberPage";
import { StorePage } from "./pages/StorePage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { NavBar } from "./components/NavBar";
import { PageTransition } from "./components/PageTransition";
import { ToastContainer } from "./components/ToastContainer";
import { DevToolbar } from "./components/DevToolbar";
import { PlayerInspectModal } from "./components/PlayerInspectModal";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { api } from "./lib/api";
import { Notification } from "./lib/types";

const queryClient = new QueryClient();

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

    const onBalanceUpdate = () => {
      onUserUpdate();
    };

    socket.on("attack_notification", onAttack);
    socket.on("trade_offer", onTradeOffer);
    socket.on("trade_completed", onTradeCompleted);
    socket.on("trade_declined", onTradeDeclined);
    socket.on("auction_outbid", onAuctionOutbid);
    socket.on("auction_sold", onAuctionSold);
    socket.on("balance_update", onBalanceUpdate);

    return () => {
      socket.off("attack_notification", onAttack);
      socket.off("trade_offer", onTradeOffer);
      socket.off("trade_completed", onTradeCompleted);
      socket.off("trade_declined", onTradeDeclined);
      socket.off("auction_outbid", onAuctionOutbid);
      socket.off("auction_sold", onAuctionSold);
      socket.off("balance_update", onBalanceUpdate);
    };
  }, [socket, addToast, onUserUpdate]);

  return null;
}

// ── Hash routing helpers ──────────────────────────────────────────────────────
// URL format: example.com/#/settings  (no server config needed; survives refresh)
const HASH_BLOCKLIST = new Set(["arena-combat", "race-match"]); // sub-pages — don't put in URL

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

  // Pull UI scale / theme saved on the account once per login — lets a
  // player's zoom + day/night choice follow them to a new device.
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

  // Sync URL → state on browser back/forward
  useEffect(() => {
    const handler = () => setPageState(getPageFromHash());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Keep hash in sync whenever page state changes
  useEffect(() => { setHash(page); }, [page]);

  // ── Deployment update detection ──────────────────────────────────────────────
  const updateAvailable = useUpdateCheck(5 * 60 * 1000);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showFactionSelect, setShowFactionSelect] = useState(false);
  const [navHeight, setNavHeight] = useState(210);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [shopStoreId, setShopStoreId] = useState<string | null>(null);
  const [royaleCategory, setRoyaleCategory] = useState<string | null>(null);
  const navTo = useCallback((p: string) => {
    setRoyaleCategory(null);
    setPage(p);
  }, [setPage]);

  // Show faction selection for users without a faction
  useEffect(() => {
    if (user && !user.faction) {
      setShowFactionSelect(true);
    } else {
      setShowFactionSelect(false);
    }
  }, [user]);

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
      <>
        <AuthPage onLogin={login} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  // Faction onboarding gate
  if (showFactionSelect) {
    return (
      <>
        <FactionSelectPage
          onComplete={() => { refreshUser(); setShowFactionSelect(false); }}
          addToast={addToast}
        />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
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
      case "leaderboard":  return <LeaderboardPage />;
      case "hospital":     return <HospitalPage {...pageProps} />;
      case "profile":      return <ProfilePage {...pageProps} />;
      case "settings":     return <SettingsPage {...pageProps} onLogout={handleLogout} />;
      case "notifications":return <NotificationsPage onUnreadChange={setUnreadNotifs} onInspectPlayer={setInspectUserId} />;
      case "achievements":  return <AchievementsPage {...pageProps} />;
      case "missions":      return <MissionsPage {...pageProps} />;
      case "chat":          return <ChatPage user={user!} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      case "skills":        return <SkillsPage user={user!} addToast={addToast} />;
      case "guilds":        return <GuildsPage user={user!} addToast={addToast} />;
      case "auction":       return <AuctionPage {...pageProps} />;
      case "loadout":       return <LoadoutPage user={user!} addToast={addToast} />;
      case "properties":    return <PropertiesPage {...pageProps} />;
      case "crafting":      return <CraftingPage {...pageProps} />;
      case "trade":         return <TradePage user={user!} addToast={addToast} />;
      case "friends":       return <FriendsPage user={user!} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      // Wire Cartel pages
      case "training":
      case "gym":           return <TrainingCenterPage user={user!} refreshUser={refreshUser} addToast={addToast} />;
      case "garage":        return <GaragePage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "city":          return <CityPage user={user!} onUserUpdate={() => { refreshUser(); }} refreshUser={refreshUser} addToast={addToast} />;
      case "net":           return <NetPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "cyber":         return <CyberPage user={user!} addToast={addToast} />;
      case "store":         return <StorePage user={user!} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "connections":  return <ConnectionsPage user={user!} />;
      case "royale":        return royaleCategory
                              ? <RoyaleCategoryPage category={royaleCategory} onBack={() => setRoyaleCategory(null)} onUserUpdate={refreshUser} />
                              : <RoyaleHubPage onSelectCategory={(id) => setRoyaleCategory(id)} />;
      case "arena":         return <ArenaHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "arena-combat":  return <ArenaCombatPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "race-hub":      return <RaceHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "race-match":    return <RaceMatchPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "daily":         return <DailyPage {...pageProps} onNav={setPage} />;
      case "district":      return <DistrictPage {...pageProps} />;
      case "companions":    return <CompanionsPage {...pageProps} />;
      case "legal":         return <LegalPage onNav={setPage} />;
      case "support":       return <SupportPage user={user!} addToast={addToast} />;
      case "travel":        return <TravelPage user={user!} refreshUser={refreshUser} addToast={addToast} onNavigate={setPage} />;
      case "district-hub":  return <DistrictHubPage {...pageProps} />;
      case "match-history": return <MatchHistoryPage />;
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
      {/* Update banner — shown when a new deployment is detected */}
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
          user={user!}
          active={page}
          onNav={navTo}
          onLogout={handleLogout}
          unreadNotifs={unreadNotifs}
          onInspectPlayer={setInspectUserId}
          onHeightChange={setNavHeight}
        />
        <main
          style={{ paddingTop: navHeight, paddingBottom: 32 }}
          className="px-3 sm:px-4 max-w-5xl mx-auto w-full"
        >
          <PageTransition pageKey={page}>
            {renderPage()}
          </PageTransition>
        </main>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {user!.devMode && (
          <DevToolbar user={user!} onRefresh={refreshUser} addToast={addToast} />
        )}
        {inspectUserId && (
          <PlayerInspectModal
            targetId={inspectUserId}
            currentUser={user!}
            onClose={() => setInspectUserId(null)}
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
