---
name: DriftLife Frontend Audit Completions
description: Which audit categories were fixed and key patterns used — avoids re-auditing already-closed gaps.
---

## Category 3 — Router wiring (all wired)
- `DailyPage` — case "daily" + import added to App.tsx; NavBar entry already existed
- `DistrictPage` — case "district" + import added to App.tsx; no NavBar entry needed (navigated to programmatically)
- `CompanionsPage` — new page created; case "companions"; NavBar entry "Allies" added
- `GymPage.tsx` — deleted (dead code; "gym" case already pointed to TrainingCenterPage)
- Black Market — tab added inside MarketPage ("☠ Dark"); uses `/black-market/listings` + `/black-market/listings/:id/buy`
- Guild Bank — tab added inside GuildsPage ("Bank"); uses `/faction/bank` routes (deposit/withdraw/perks/buy); officer+ gated for withdraw and perks

## Category 4 — Bug fixes (all fixed)
- DistrictPage line 42: `user.district.replace(...)` → `(user.district ?? "").replace(...) || "Unknown"` (null guard)
- NpcStorePage: all 3 raw `fetch()` calls replaced with `api` wrapper
- RoyaleCategoryPage: both raw `fetch()` calls replaced with `api` wrapper; `import { api }` added
- ConnectionsPage: `confirm()` → `confirmUnlink`/`doUnlink` state flow; `alert()` → `fallbackMsg` inline state
- StorePage: `window.open()` → try-open with `invoiceFallbackUrl` fallback link; `alert()` → `linkInitError`/`buyError` inline state; `confirm()` → `telegramUnlinkConfirm` inline state
- GuildsPage: `confirm("Leave this guild?")` → `showLeaveConfirm` state with inline Yes/No buttons

## Category 5 — Backend with no frontend (all covered)
- Vanta — already implemented in OwnerPage (Tab type included "vanta" at line 73)
- Mini-leaderboard — already implemented in LeaderboardPage (MiniLeaderboard component with "minigame" tab)
- Discord — already covered by ConnectionsPage
- Companions — new CompanionsPage with hire/upkeep flow; catalog + mine + hire + upkeep endpoints
- migration-admin — intentionally no frontend

## Key patterns used
- All inline confirm replacements follow: state boolean/platform → show inline Yes/No buttons → call API on Yes
- `api` wrapper (lib/api.ts) always used; never raw `fetch`; throws on non-2xx (no manual `!res.ok` checks needed)
- `useQuery` with `enabled: tab === "..."` pattern for tab-lazy data fetching (bank tab, BM tab)
