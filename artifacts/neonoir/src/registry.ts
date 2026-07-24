/**
 * Route Registry — single source of truth for every page in the game.
 * App.tsx reads this to render pages.
 * NavBar.tsx reads this to build the navigation icon row + mobile drawer.
 * BottomNav.tsx reads this for the 5-item mobile pinned bar.
 *
 * Adding a new page = add ONE entry here.
 */

import { lazy } from "react";
import {
  Home, Newspaper, MessageCircle, Package, CreditCard,
  BarChart2, Gavel, Building2, Dumbbell, Briefcase, Car, Globe, Cpu, Terminal,
  Shield, Swords, Crosshair, ClipboardList, Skull, Plane, ShoppingCart,
  Building, Users, Landmark, CalendarDays, Star, Trophy, Gift,
  Settings, Flag, GraduationCap, User, Bell,
  type LucideIcon,
} from "lucide-react";

export interface RouteEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Lazy-loaded page component */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Show in desktop NavBar icon row */
  nav: boolean;
  /** Show in mobile BottomNav */
  bottomNav: boolean;
  roles?: string[];
  minStage?: number;
  statusFilter?: "normal" | "normal|abroad" | "abroad";
  group?: string;
}

// ── Page components (lazy-loaded) ─────────────────────────────────────────────
// Named exports — App.tsx imports these directly.

export const AuthPageLazy       = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));
export const DashboardLazy      = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
export const CrimesPageLazy     = lazy(() => import("./features/crimes/pages/CrimesPage").then(m => ({ default: m.CrimesPage })));
export const JobsPageLazy       = lazy(() => import("./features/jobs/pages/JobsPage").then(m => ({ default: m.JobsPage })));
export const BankPageLazy       = lazy(() => import("./features/bank/pages/BankPage").then(m => ({ default: m.BankPage })));
export const InventoryPageLazy  = lazy(() => import("./features/inventory/pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
export const LeaderboardPageLazy= lazy(() => import("./pages/LeaderboardPage").then(m => ({ default: m.LeaderboardPage })));
export const FeedPageLazy       = lazy(() => import("./pages/FeedPage").then(m => ({ default: m.FeedPage })));
export const NotificationsPageLazy = lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
export const HospitalPageLazy   = lazy(() => import("./features/hospital/pages/HospitalPage").then(m => ({ default: m.HospitalPage })));
export const ProfilePageLazy    = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
export const SettingsPageLazy   = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
export const OwnerPageLazy      = lazy(() => import("./pages/OwnerPage").then(m => ({ default: m.OwnerPage })));
export const AchievementsPageLazy = lazy(() => import("./pages/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
export const ChatPageLazy       = lazy(() => import("./pages/ChatPage").then(m => ({ default: m.ChatPage })));
export const GuildsPageLazy     = lazy(() => import("./pages/GuildsPage").then(m => ({ default: m.GuildsPage })));
export const AuctionPageLazy    = lazy(() => import("./features/auction/pages/AuctionPage").then(m => ({ default: m.AuctionPage })));
export const TradePageLazy      = lazy(() => import("./features/trade/pages/TradePage").then(m => ({ default: m.TradePage })));
export const FriendsPageLazy    = lazy(() => import("./pages/FriendsPage").then(m => ({ default: m.FriendsPage })));
export const MissionsPageLazy   = lazy(() => import("./pages/MissionsPage").then(m => ({ default: m.MissionsPage })));
export const DistrictHubPageLazy= lazy(() => import("./pages/DistrictHubPage").then(m => ({ default: m.DistrictHubPage })));
export const TravelPageLazy     = lazy(() => import("./pages/TravelPage").then(m => ({ default: m.TravelPage })));
export const DailyPageLazy      = lazy(() => import("./features/daily/pages/DailyPage").then(m => ({ default: m.DailyPage })));
export const DistrictPageLazy   = lazy(() => import("./pages/DistrictPage").then(m => ({ default: m.DistrictPage })));
export const LegalPageLazy      = lazy(() => import("./pages/LegalPage").then(m => ({ default: m.LegalPage })));
export const SupportPageLazy    = lazy(() => import("./pages/SupportPage").then(m => ({ default: m.SupportPage })));
export const BusinessPageLazy   = lazy(() => import("./pages/BusinessPage").then(m => ({ default: m.BusinessPage })));
export const FactionPageLazy    = lazy(() => import("./pages/FactionPage").then(m => ({ default: m.FactionPage })));
export const StorePageLazy      = lazy(() => import("./pages/StorePage").then(m => ({ default: m.StorePage })));
export const StaffPortalPageLazy= lazy(() => import("./pages/StaffPortalPage").then(m => ({ default: m.StaffPortalPage })));
export const HackPageLazy       = lazy(() => import("./features/hack/pages/HackPage"));
export const MentorPageLazy     = lazy(() => import("./pages/MentorPage"));
export const TrainingCenterPageLazy = lazy(() => import("./features/training/pages/TrainingCenterPage"));
export const MatchHistoryPageLazy   = lazy(() => import("./pages/MatchHistoryPage"));
export const GaragePageLazy     = lazy(() => import("./features/garage/pages/GaragePage"));
export const ArenaHubPageLazy   = lazy(() => import("./features/arena/hub/pages/ArenaHubPage"));
export const ArenaCombatPageLazy= lazy(() => import("./features/arena/combat/pages/ArenaCombatPage"));
export const LoadoutPageLazy    = lazy(() => import("./features/loadout/pages/LoadoutPage"));
export const ShopHubPageLazy    = lazy(() => import("./features/shop/hub/pages/ShopHubPage"));
export const NpcStorePageLazy   = lazy(() => import("./features/shop/npc/pages/NpcStorePage"));
export const RaceHubPageLazy    = lazy(() => import("./features/race/hub/pages/RaceHubPage"));
export const RaceMatchPageLazy  = lazy(() => import("./features/race/match/pages/RaceMatchPage"));
export const CityPageLazy       = lazy(() => import("./pages/CityPage"));
export const NetPageLazy        = lazy(() => import("./features/net/pages/NetPage"));
export const CyberPageLazy      = lazy(() => import("./features/cyber/pages/CyberPage"));
export const EventPageLazy      = lazy(() => import("./pages/EventPage"));
export const UpcomingEventsPageLazy = lazy(() => import("./pages/UpcomingEventsPage"));
export const EventArchivePageLazy   = lazy(() => import("./pages/EventArchivePage"));
export const HallOfFamePageLazy = lazy(() => import("./pages/HallOfFamePage"));
export const BattlePassPageLazy = lazy(() => import("./pages/BattlePassPage"));

// ── Registry ─────────────────────────────────────────────────────────────────
// nav:true  → icon appears in desktop NavBar
// bottomNav:true → icon appears in mobile BottomNav (pick 5 max)
export const ROUTES: RouteEntry[] = [
  { id: "dashboard",      label: "Home",     icon: Home,          component: DashboardLazy,          nav: true,  bottomNav: true  },
  { id: "feed",           label: "Feed",     icon: Newspaper,     component: FeedPageLazy,           nav: true,  bottomNav: false },
  { id: "chat",           label: "Chat",     icon: MessageCircle, component: ChatPageLazy,           nav: true,  bottomNav: true  },
  { id: "inventory",      label: "Bag",      icon: Package,       component: InventoryPageLazy,      nav: true,  bottomNav: false },
  { id: "store",          label: "Store",    icon: CreditCard,    component: StorePageLazy,          nav: true,  bottomNav: false },
  { id: "leaderboard",    label: "Board",    icon: BarChart2,     component: LeaderboardPageLazy,    nav: true,  bottomNav: false },
  { id: "auction",        label: "Auction",  icon: Gavel,         component: AuctionPageLazy,        nav: true,  bottomNav: false },
  { id: "city",           label: "City",     icon: Building2,     component: CityPageLazy,           nav: true,  bottomNav: false, group: "wc", statusFilter: "normal" },
  { id: "training",       label: "Gym",      icon: Dumbbell,      component: TrainingCenterPageLazy, nav: true,  bottomNav: false, group: "wc", statusFilter: "normal" },
  { id: "jobs",           label: "Jobs",     icon: Briefcase,     component: JobsPageLazy,           nav: true,  bottomNav: false, group: "wc", statusFilter: "normal" },
  { id: "garage",         label: "Garage",   icon: Car,           component: GaragePageLazy,         nav: true,  bottomNav: false, group: "wc", minStage: 1, statusFilter: "normal" },
  { id: "net",            label: "Net",      icon: Globe,         component: NetPageLazy,            nav: true,  bottomNav: false, group: "wc", minStage: 3, statusFilter: "normal" },
  { id: "cyber",          label: "Cyber",    icon: Cpu,           component: CyberPageLazy,          nav: true,  bottomNav: false, group: "wc", minStage: 3, statusFilter: "normal" },
  { id: "hack",           label: "Hack",     icon: Terminal,      component: HackPageLazy,           nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "guilds",         label: "Crew",     icon: Shield,        component: GuildsPageLazy,         nav: true,  bottomNav: false, group: "wc", minStage: 2, statusFilter: "normal" },
  { id: "mentor",         label: "Mentor",   icon: GraduationCap, component: MentorPageLazy,         nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "faction",        label: "Faction",  icon: Flag,          component: FactionPageLazy,        nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "business",       label: "Biz",      icon: Building2,     component: BusinessPageLazy,       nav: true,  bottomNav: false, group: "wc", statusFilter: "normal" },
  { id: "arena",          label: "Arena",    icon: Swords,        component: ArenaHubPageLazy,       nav: true,  bottomNav: true,  statusFilter: "normal" },
  { id: "loadout",        label: "Loadout",  icon: Crosshair,     component: LoadoutPageLazy,        nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "missions",       label: "Missions", icon: ClipboardList, component: MissionsPageLazy,       nav: true,  bottomNav: false },
  { id: "crimes",         label: "Crimes",   icon: Skull,         component: CrimesPageLazy,         nav: true,  bottomNav: true,  statusFilter: "normal|abroad" },
  { id: "travel",         label: "Travel",   icon: Plane,         component: TravelPageLazy,         nav: true,  bottomNav: false, statusFilter: "normal|abroad" },
  { id: "market",         label: "Market",   icon: ShoppingCart,  component: ShopHubPageLazy,        nav: true,  bottomNav: false, statusFilter: "normal|abroad" },
  { id: "district-hub",   label: "Hub",      icon: Building,      component: DistrictHubPageLazy,    nav: true,  bottomNav: false, statusFilter: "abroad" },
  { id: "friends",        label: "Friends",  icon: Users,         component: FriendsPageLazy,        nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "bank",           label: "Bank",     icon: Landmark,      component: BankPageLazy,           nav: true,  bottomNav: false, statusFilter: "normal" },
  { id: "events",         label: "Event",    icon: CalendarDays,  component: EventPageLazy,          nav: true,  bottomNav: false },
  { id: "battle-pass",    label: "Pass",     icon: Star,          component: BattlePassPageLazy,     nav: true,  bottomNav: false },
  { id: "achievements",   label: "Achiev",   icon: Trophy,        component: AchievementsPageLazy,   nav: true,  bottomNav: false },
  { id: "daily",          label: "Daily",    icon: Gift,          component: DailyPageLazy,          nav: true,  bottomNav: false },
  { id: "staff-portal",   label: "Staff",    icon: Shield,        component: StaffPortalPageLazy,    nav: true,  bottomNav: false, roles: ["staff", "admin", "owner"] },
  { id: "owner",          label: "Owner",    icon: Settings,      component: OwnerPageLazy,          nav: true,  bottomNav: false, roles: ["admin", "owner"] },
  // Non-nav pages (reachable but no icon in nav bar)
  { id: "hospital",       label: "Hospital", icon: Home,          component: HospitalPageLazy,       nav: false, bottomNav: false },
  { id: "profile",        label: "Profile",  icon: User,          component: ProfilePageLazy,        nav: false, bottomNav: true  },
  { id: "settings",       label: "Settings", icon: Settings,      component: SettingsPageLazy,       nav: false, bottomNav: false },
  { id: "notifications",  label: "Notifs",   icon: Bell,          component: NotificationsPageLazy,  nav: false, bottomNav: false },
  { id: "district",       label: "District", icon: Building,      component: DistrictPageLazy,       nav: false, bottomNav: false },
  { id: "legal",          label: "Legal",    icon: Home,          component: LegalPageLazy,          nav: false, bottomNav: false },
  { id: "support",        label: "Support",  icon: Home,          component: SupportPageLazy,        nav: false, bottomNav: false },
  { id: "match-history",  label: "History",  icon: BarChart2,     component: MatchHistoryPageLazy,   nav: false, bottomNav: false },
  { id: "hall-of-fame",   label: "HoF",      icon: Trophy,        component: HallOfFamePageLazy,     nav: false, bottomNav: false },
  { id: "arena-combat",   label: "Combat",   icon: Swords,        component: ArenaCombatPageLazy,    nav: false, bottomNav: false },
  { id: "race-hub",       label: "Race",     icon: Car,           component: RaceHubPageLazy,        nav: false, bottomNav: false },
  { id: "race-match",     label: "RaceMatch",icon: Car,           component: RaceMatchPageLazy,      nav: false, bottomNav: false },
  { id: "events-upcoming",label: "Events",   icon: CalendarDays,  component: UpcomingEventsPageLazy, nav: false, bottomNav: false },
  { id: "events-archive", label: "Archive",  icon: CalendarDays,  component: EventArchivePageLazy,   nav: false, bottomNav: false },
  { id: "shop",           label: "Shop",     icon: ShoppingCart,  component: ShopHubPageLazy,        nav: false, bottomNav: false },
  { id: "gym",            label: "Gym",      icon: Dumbbell,      component: TrainingCenterPageLazy, nav: false, bottomNav: false },
];

/** All nav-visible entries (for desktop NavBar icon row) */
export const NAV_ROUTES = ROUTES.filter(r => r.nav);
/** Mobile bottom nav entries */
export const BOTTOM_NAV_ROUTES = ROUTES.filter(r => r.bottomNav);
/** Map from id → route, for fast lookup */
export const ROUTE_MAP = new Map(ROUTES.map(r => [r.id, r]));
