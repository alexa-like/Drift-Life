---
name: DriftLife NavBar & local dev quirks
description: Nav bar fixed/relative CSS conflict causing a content gap, and the missing vite dev proxy that breaks local login.
---

## Nav bar gap bug
The `<nav>` root element had both `fixed` and `relative` Tailwind classes together. `<main>` reserves space for the nav via an inline `paddingTop: navHeight` (measured via ResizeObserver), so if `relative` wins in the compiled stylesheet the nav drops into normal document flow and the padding creates a duplicate empty gap below it. Keep the nav's root className to `fixed` only — a `fixed` element already establishes a positioning context for its `absolute` children, so `relative` is not needed there.

## Local dev needs a vite proxy for /api
`artifacts/driftlife` (vite) has no `server.proxy` for `/api` by default, so requests to the relative `/api/*` paths 404 against the vite dev server itself on Replit (this only works in production because Render serves frontend build + API from the same Express origin). Local dev needs `server.proxy["/api"] = { target: "http://localhost:8080", changeOrigin: true, ws: true }` in `vite.config.ts`, matching the API Server workflow's port 8080.

**Why:** without it, login/register and everything else behind `/api` silently 404 in the Replit preview even though the API server is healthy — easy to misdiagnose as an auth bug.

## Admin/Owner nav access
There was no nav entry for the `owner`/`admin`-only `OwnerPage` (route id `"owner"`) — only URL hash `#/owner` worked. Added a NAV entry gated `roles: ["admin", "owner"]` in `NavBar.tsx`, same pattern as the existing `staff-portal` entry gated to `["staff","admin","owner"]`.
