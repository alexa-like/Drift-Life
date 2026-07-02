import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { CrimesPage } from "./pages/CrimesPage";
import { JobsPage } from "./pages/JobsPage";
import { CombatPage } from "./pages/CombatPage";
import { BankPage } from "./pages/BankPage";
import { MarketPage } from "./pages/MarketPage";
import { DistrictPage } from "./pages/DistrictPage";
import { MapPage } from "./pages/MapPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeedPage } from "./pages/FeedPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { HospitalPage } from "./pages/HospitalPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { DailyPage } from "./pages/DailyPage";
import { FactionSelectPage } from "./pages/FactionSelectPage";
import { OwnerPage } from "./pages/OwnerPage";
import { FramesStorePage } from "./pages/FramesStorePage";
import { FrameGalleryPage } from "./pages/FrameGalleryPage";
import { AchievementsPage } from "./pages/AchievementsPage";
import { ChatPage } from "./pages/ChatPage";
import { SkillsPage } from "./pages/SkillsPage";
import { GuildsPage } from "./pages/GuildsPage";
import { AuctionPage } from "./pages/AuctionPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { HeraldPage } from "./pages/HeraldPage";
import { CraftingPage } from "./pages/CraftingPage";
import { CardsPage } from "./pages/CardsPage";
import { TradePage } from "./pages/TradePage";
import StreetPage from "./pages/StreetPage";
import GymPage from "./pages/GymPage";
import GaragePage from "./pages/GaragePage";
import CityPage from "./pages/CityPage";
import NetPage from "./pages/NetPage";
import WorldPage from "./pages/WorldPage";
import CyberPage from "./pages/CyberPage";
import { NavBar } from "./components/NavBar";
import { ToastContainer } from "./components/ToastContainer";
import { DevToolbar } from "./components/DevToolbar";
import { PlayerInspectModal } from "./components/PlayerInspectModal";
import { SocketProvider } from "./context/SocketContext";
import { api } from "./lib/api";
import { Notification } from "./lib/types";

const queryClient = new QueryClient();

function GameApp() {
  const { user, loading, login, logout, refreshUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const [page, setPage] = useState("feed");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showFactionSelect, setShowFactionSelect] = useState(false);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <div style={{ textAlign: "center" }}>
          <div
            className="font-mono font-bold text-2xl tracking-widest mb-4"
            style={{ color: "#00d4ff", textShadow: "0 0 20px #00d4ff" }}
          >
            DRIFTLIFE
          </div>
          <div className="font-mono text-xs" style={{ color: "#334155" }}>
            Connecting to New Vanta...
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
      case "feed":         return <FeedPage user={user!} onInspectPlayer={setInspectUserId} />;
      case "crimes":       return <CrimesPage {...pageProps} />;
      case "jobs":         return <JobsPage {...pageProps} />;
      case "combat":       return <CombatPage {...pageProps} />;
      case "bank":         return <BankPage {...pageProps} />;
      case "market":       return <MarketPage {...pageProps} />;
      case "district":     return <DistrictPage {...pageProps} />;
      case "map":          return <MapPage {...pageProps} onInspectPlayer={setInspectUserId} />;
      case "inventory":    return <InventoryPage {...pageProps} />;
      case "leaderboard":  return <LeaderboardPage />;
      case "hospital":     return <HospitalPage {...pageProps} />;
      case "profile":      return <ProfilePage {...pageProps} />;
      case "settings":     return <SettingsPage {...pageProps} onLogout={handleLogout} />;
      case "daily":        return <DailyPage {...pageProps} onNav={setPage} />;
      case "notifications":return <NotificationsPage onUnreadChange={setUnreadNotifs} />;
      case "frames":        return <FramesStorePage {...pageProps} />;
      case "gallery":       return <FrameGalleryPage {...pageProps} />;
      case "achievements":  return <AchievementsPage {...pageProps} />;
      case "chat":          return <ChatPage user={user!} addToast={addToast} onInspectPlayer={setInspectUserId} />;
      case "skills":        return <SkillsPage user={user!} addToast={addToast} />;
      case "guilds":        return <GuildsPage user={user!} addToast={addToast} />;
      case "auction":       return <AuctionPage user={user!} addToast={addToast} />;
      case "properties":    return <PropertiesPage {...pageProps} />;
      case "herald":        return <HeraldPage user={user!} addToast={addToast} />;
      case "crafting":      return <CraftingPage {...pageProps} />;
      case "cards":         return <CardsPage {...pageProps} />;
      case "trade":         return <TradePage user={user!} addToast={addToast} />;
      // Wire Cartel pages
      case "street":        return <StreetPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "gym":           return <GymPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "garage":        return <GaragePage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "city":          return <CityPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "net":           return <NetPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "world":         return <WorldPage user={user!} onUserUpdate={(u) => { refreshUser(); }} />;
      case "cyber":         return <CyberPage user={user!} addToast={addToast} />;
      case "owner":
        return (user!.role === "owner" || user!.role === "admin")
          ? <OwnerPage {...pageProps} onNav={setPage} />
          : <Dashboard {...pageProps} onNav={setPage} />;
      default:             return <Dashboard {...pageProps} onNav={setPage} />;
    }
  }

  return (
    <SocketProvider userId={user!.id}>
      <div className="scanlines" style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e2e8f0" }}>
        <NavBar
          user={user!}
          active={page}
          onNav={setPage}
          onLogout={handleLogout}
          unreadNotifs={unreadNotifs}
        />
        {/* Account for taller nav (2 rows now) */}
        <main className="pt-[76px] pb-8 px-3 sm:px-4 max-w-5xl mx-auto w-full">
          {renderPage()}
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
      <GameApp />
    </QueryClientProvider>
  );
}

export default App;
