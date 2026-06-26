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
import { InventoryPage } from "./pages/InventoryPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FeedPage } from "./pages/FeedPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { HospitalPage } from "./pages/HospitalPage";
import { NavBar } from "./components/NavBar";
import { ToastContainer } from "./components/ToastContainer";
import { api } from "./lib/api";
import { Notification } from "./lib/types";

const queryClient = new QueryClient();

function GameApp() {
  const { user, loading, login, logout, refreshUser } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const [page, setPage] = useState("dashboard");
  const [unreadNotifs, setUnreadNotifs] = useState(0);

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
    setPage("dashboard");
  }, [logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0f" }}>
        <div className="font-mono text-xs" style={{ color: "#1e1e2e" }}>
          Connecting to New Vanta...
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

  const pageProps = { user, refreshUser, addToast };

  function renderPage() {
    switch (page) {
      case "dashboard": return <Dashboard {...pageProps} onNav={setPage} />;
      case "crimes": return <CrimesPage {...pageProps} />;
      case "jobs": return <JobsPage {...pageProps} />;
      case "combat": return <CombatPage {...pageProps} />;
      case "bank": return <BankPage {...pageProps} />;
      case "market": return <MarketPage {...pageProps} />;
      case "district": return <DistrictPage {...pageProps} />;
      case "inventory": return <InventoryPage {...pageProps} />;
      case "leaderboard": return <LeaderboardPage />;
      case "feed": return <FeedPage />;
      case "hospital": return <HospitalPage {...pageProps} />;
      case "notifications":
        return (
          <NotificationsPage
            onUnreadChange={setUnreadNotifs}
          />
        );
      default: return <Dashboard {...pageProps} onNav={setPage} />;
    }
  }

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e2e8f0" }}>
      <NavBar
        user={user}
        active={page}
        onNav={setPage}
        onLogout={handleLogout}
        unreadNotifs={unreadNotifs}
      />
      <main className="pt-16 pb-8 px-4 max-w-5xl mx-auto">
        {renderPage()}
      </main>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
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
