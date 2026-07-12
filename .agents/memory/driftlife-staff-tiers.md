---
name: DriftLife Staff Tier System
description: 5-tier staff management system; fields on User model; lib constants; routes; frontend pages
---

## User model fields added
- `staffTier`: 1|2|3|4|5|null
- `staffTierAssignedAt`, `staffEarningsLastClaimedAt`, `staffEarningsTotalDc`, `staffTaskProgress` (Mixed), `staffTaskResetAt`

## Tier definitions (`artifacts/api-server/src/lib/staffTiers.ts`)
| Tier | Name | Sub | Daily DC |
|------|------|-----|----------|
| 1 | Watcher | street_runner | 500 |
| 2 | Moderator | street_runner | 1,000 |
| 3 | Enforcer | neon_syndicate | 2,500 |
| 4 | Commander | neon_syndicate | 5,000 |
| 5 | Director | apex_sovereign | 10,000 |

## Backend routes (all under /api/owner/)
- `GET /staff` — list all staff (requireOwner)
- `POST /staff/set-tier` — set tier, auto-assigns subscription, promotes role to staff if player (requireOwner)
- `GET /staff/logs` — enriched audit logs with actorTier (requireOwner)
- `GET /staff/me` — self-service tier info (any staff)
- `POST /staff/earnings/claim` — 24h cooldown DC claim (any staff)
- `POST /staff/tasks/complete` — increment task progress (any staff)
- `POST /mass-grant` — broadcast DC/NC/keys to all non-banned players (requireOwner)

## Frontend
- `StaffPortalPage.tsx` — staff self-service: tier badge, daily claim, task progress bars, permissions
- `OwnerPage.tsx` — added "👥 Staff" tab (list, tier assignment, task view, log viewer) and "📢 Mass Actions" tab
- `NavBar.tsx` — "staff-portal" nav item with `roles: ["staff","admin","owner"]` filter
- `App.tsx` — `case "staff-portal"` route, accessible to staff|admin|owner

**Why:** NavBar role filtering via `roles?: string[]` on NAV items; filter checks `item.roles && !item.roles.includes(user.role)`
