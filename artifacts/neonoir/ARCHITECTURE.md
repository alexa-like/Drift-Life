# NeoNoir Frontend Architecture

This document is the authoritative guide for the NeoNoir React/Vite frontend (`artifacts/neonoir`).
It reflects the state after **Tier 0** of the feature-first migration.

---

## Directory Structure

```
artifacts/neonoir/src/
├── shared/                  ← Tier 0: all reusable, framework-agnostic code
│   ├── api.ts               ← Typed fetch wrapper (apiFetch, api.get/post/patch/delete)
│   ├── animTicker.ts        ← Animation ticker utility
│   ├── avatar.ts            ← Avatar URL helpers
│   ├── currency.ts          ← formatDC, formatNC, CURRENCY_LABELS, CURRENCY_COLORS
│   ├── format.ts            ← formatDC, formatNC, formatTime, etc.
│   ├── pushNotifications.ts ← Push/ServiceWorker helpers
│   ├── theme.ts             ← DL color tokens, GLOWS, Z_INDEX
│   ├── types.ts             ← All shared TypeScript interfaces (User, Item, etc.)
│   ├── utils.ts             ← cn() and other generic utils
│   ├── hooks/               ← All shared React hooks
│   │   ├── use-mobile.ts
│   │   ├── use-toast.ts
│   │   ├── useAuth.ts
│   │   ├── useConnectivity.ts
│   │   ├── useSwipe.ts
│   │   ├── useToast.ts
│   │   └── useUpdateCheck.ts
│   ├── context/             ← Global React contexts
│   │   ├── PreferencesContext.tsx
│   │   └── SocketContext.tsx
│   └── components/          ← Generic UI components used across many features
│       ├── ActionResult.tsx
│       ├── AnimatedCard.tsx
│       ├── AnnouncementBanner.tsx
│       ├── CardArt.tsx
│       ├── ConfirmDialog.tsx
│       ├── CyberButton.tsx
│       ├── CyberSectionHeader.tsx
│       ├── CyberSkeleton.tsx
│       ├── EmblemBadge.tsx
│       ├── ItemImage.tsx
│       ├── NeonProgressBar.tsx
│       ├── OfflineOverlay.tsx
│       ├── PageTransition.tsx
│       ├── PlayerInspectModal.tsx
│       ├── PlayerNameBadge.tsx
│       ├── PrestigeBadge.tsx
│       ├── StatBar.tsx
│       ├── StatCounter.tsx
│       ├── StatusBanner.tsx
│       ├── SubscriberNameBadge.tsx
│       ├── ToastContainer.tsx
│       ├── WantedStars.tsx
│       └── not-found.tsx
│
├── registry.ts              ← Single source of truth for ALL routes/pages
│
├── features/                ← Tier 1+: one subdirectory per game domain
│   └── hospital/
│       └── pages/
│           └── HospitalPage.tsx
│
├── pages/                   ← Existing pages (will migrate to features/ in Tier 1+)
├── components/              ← App-shell components (NavBar, BottomNav, DevToolbar…)
│   ├── ui/                  ← shadcn/ui components (DO NOT MOVE — 55 files)
│   ├── NavBar.tsx           ← DO NOT MOVE
│   └── BottomNav.tsx        ← DO NOT MOVE
├── App.tsx                  ← DO NOT MOVE
├── main.tsx                 ← DO NOT MOVE
└── index.css                ← DO NOT MOVE
```

---

## Core Principles

### 1 — Central Registry (`src/registry.ts`)
Every page in the game is declared exactly once in `src/registry.ts`:

```ts
export const ROUTES: RouteEntry[] = [
  { id: "dashboard", label: "Home", icon: Home, component: DashboardLazy, nav: true, bottomNav: true },
  ...
];
```

- `nav: true` → icon appears in the desktop NavBar scrollable row
- `bottomNav: true` → icon appears in the mobile BottomNav bar (keep ≤ 5)
- `component` → a `React.lazy()` reference for code-splitting

**Adding a new page = add ONE entry to ROUTES. Do not touch NavBar or BottomNav.**

### 2 — `src/shared/` is the shared library
All code consumed by more than one feature lives in `src/shared/`.
Import paths use the `@/shared/` alias:

```ts
import { api }      from "@/shared/api";
import { User }     from "@/shared/types";
import { cn }       from "@/shared/utils";
import { formatDC } from "@/shared/format";
import { DL }       from "@/shared/theme";
import { CURRENCY_COLORS } from "@/shared/currency";
```

### 3 — Feature modules (`src/features/<domain>/`)
Each game domain gets its own subdirectory:

```
src/features/hospital/
├── pages/
│   └── HospitalPage.tsx
└── (future: components/, hooks/, api.ts)
```

Feature code imports from shared with relative paths (`../../../shared/`).

### 4 — NEVER MOVE list
These files are architecturally pinned and must never be relocated:

| File/Dir | Why |
|---|---|
| `src/App.tsx` | Entry point; Vite config references it |
| `src/main.tsx` | Vite entry |
| `src/index.css` | Global styles |
| `src/components/NavBar.tsx` | App-shell; too many downstream refs |
| `src/components/BottomNav.tsx` | App-shell |
| `src/components/ui/` (55 files) | shadcn — generated, not hand-edited |
| Backend `lib/` shared services | JWT, notifyUser, systemFeed, etc. |
| `models/User.ts`, `models/Item.ts`, `models/PlayerLoadout.ts` | Mongoose models |
| `middlewares/` | Express middleware |

### 5 — Import alias
`@` maps to `src/`. Always use the alias for absolute imports:

```ts
import { cn } from "@/shared/utils";   // ✓
import { cn } from "../../shared/utils"; // ✗ avoid deep relative paths
```

Exception: feature-internal files may use relative paths within their own subtree.

---

## Tier Roadmap

| Tier | Name | Status |
|---|---|---|
| **0** | Foundation — shared/, registry, Hospital example | ✅ Done |
| 1 | Combat zone — Arena, Combat, Loadout, TrainingCenter | 🔜 |
| 2 | Economy — Bank, Auction, Trade, Market, NpcStore | 🔜 |
| 3 | Social — Chat, Friends, Feed, Notifications, Guild, Faction | 🔜 |
| 4 | Progression — Crimes, Jobs, Missions, Daily, Hack, Mentor | 🔜 |
| 5 | World — City, Travel, DistrictHub, District, Garage, Net, Cyber | 🔜 |
| 6 | Live Ops — Events, BattlePass, Achievements | 🔜 |
| 7 | Monetisation — Store, StorePage, Inventory | 🔜 |
| 8 | Staff tools — StaffPortal, OwnerPage | 🔜 |
| 9 | Profile & Settings — Profile, Settings, Leaderboard | 🔜 |
| 10 | Race — RaceHub, RaceMatch | 🔜 |
| 11 | Legal & Static — Legal, Support, HallOfFame | 🔜 |
| 12 | Dashboard | 🔜 |
| 13 | Cleanup — remove orphaned files, final audit | 🔜 |

---

## Backend Feature Structure (`artifacts/api-server/src/`)

```
src/
├── features/
│   └── hospital/
│       └── routes.ts    ← Tier 0 example
├── routes/
│   └── index.ts         ← Mounts all feature routers
├── models/              ← DO NOT MOVE
├── middlewares/          ← DO NOT MOVE
└── lib/                 ← DO NOT MOVE (jwt, notifyUser, systemFeed…)
```

---

## Key Design Tokens

Defined in `src/shared/theme.ts`:

| Token | Value | Use |
|---|---|---|
| `DL.bg` | `#0a0a0f` | Page background |
| `DL.surface` | `#111118` | Card background |
| `DL.cyan` | `#00d4ff` | Primary accent |
| `DL.red` | `#ff2d55` | Danger / HP |
| `DL.orange` | `#ff6b35` | Nerve / warm accent |
| `DL.green` | `#39d353` | Success / Energy |
| `DL.gold` | `#f59e0b` | DC currency |
| `DL.purple` | `#a855f7` | NC currency |
| `Z_INDEX.nav` | `40` | Fixed nav bar |
| `Z_INDEX.modal` | `50` | Modals / drawers |
| `Z_INDEX.toast` | `9999` | Toast notifications |
| `Z_INDEX.offline` | `10000` | Offline overlay |
