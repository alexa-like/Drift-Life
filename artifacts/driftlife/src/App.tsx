import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { CrimesPage } from "./pages/CrimesPage";
import { JobsPage } from "./pages/JobsPage";

import { BankPage } from "./pages/BankPage";
import { MarketPage } from "./pages/MarketPage";
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
import RoyalePage from "./pages/RoyalePage";
import GaragePage from "./pages/GaragePage";
import ArenaHubPage from "./pages/ArenaHubPage";
import ArenaCombatPage from "./pages/ArenaCombatPage";
import { MissionsPage } from "./pages/MissionsPage";
import LoadoutPage from "./pages/LoadoutPage";
import ShopHubPage from "./pages/ShopHubPage";
import NpcStorePage from "./pages/NpcStorePage";
import RaceHubPage from "./pages/RaceHubPage";
import RaceMatchPage from "./pages/RaceMatchPage";
import CityPage from "./pages/CityPage";
import NetPage from "./pages/NetPage";
import CyberPage from "./pages/CyberPage";
import { FrameStore } from "./pages/FrameStore";
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

    socket.on("attack_notification", onAttack);
    socket.on("trade_offer", onTradeOffer);
    socket.on("trade_completed", onTradeCompleted);
    socket.on("trade_declined", onTradeDeclined);
    socket.on("auction_outbid", onAuctionOutbid);
    socket.on("auction_sold", onAuctionSold);

    return () => {
      socket.off("attack_notification", onAttack);
      socket.off("trade_offer", onTradeOffer);
      socket.off("trade_completed", onTradeCompleted);
      socket.off("trade_declined", onTradeDeclined);
      socket.off("auction_outbid", onAuctionOutbid);
      socket.off("auction_sold", onAuctionSold);
    };
  }, [socket, addToast, onUserUpdate]);

  return null;
}

function GameApp() {
  const { user, loading, login, logout, refreshUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const [page, setPage] = useState("feed");
  useEffect(() => { (window as any).__setPage = setPage; }, [setPage]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showFactionSelect, setShowFactionSelect] = useState(false);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [shopStoreId, setShopStoreId] = useState<string | null>(null);

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

      case "bank":         return <BankPage {...pageProps} />;
      case "market":       return <MarketPage {...pageProps} />;
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
      case "auction":       return <AuctionPage user={user!} addToast={addToast} />;
      case "loadout":       return <LoadoutPage user={user!} addToast={addToast} />;
      case "shop":          return shopStoreId
                              ? <NpcStorePage key={shopStoreId} storeId={shopStoreId} onBack={() => { setShopStoreId(null); }} />
                              : <ShopHubPage onSelectStore={(id) => setShopStoreId(id)} />;
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
      case "chatframes":    return <FrameStore {...pageProps} />;
      case "store":         return <StorePage user={user!} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "connections":  return <ConnectionsPage user={user!} />;
      case "royale":        return <RoyalePage user={user!} addToast={addToast} onUserUpdate={refreshUser} />;
      case "arena":         return <ArenaHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "arena-combat":  return <ArenaCombatPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "race-hub":      return <RaceHubPage user={user!} addToast={addToast} onNavigate={setPage} />;
      case "race-match":    return <RaceMatchPage user={user!} addToast={addToast} onUserUpdate={refreshUser} onNavigate={setPage} />;
      case "match-history": return <MatchHistoryPage />;
      case "owner":
        return (user!.role === "owner" || user!.role === "admin")
          ? <OwnerPage {...pageProps} onNav={setPage} />
          : <Dashboard {...pageProps} onNav={setPage} />;
      default:             return <Dashboard {...pageProps} onNav={setPage} />;
    }
  }

  return (
    <SocketProvider userId={user!.id}>
      <SocketEvents addToast={addToast} onUserUpdate={refreshUser} />
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
      <GameApp />
    </QueryClientProvider>
  );
}

export default App;
