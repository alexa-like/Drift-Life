---
name: DriftLife stack
description: Key architecture decisions and environment setup for the DriftLife cyberpunk RPG project.
---

# DriftLife Stack

**Why:** Record decisions so future sessions don't re-investigate.

## Structure
- pnpm monorepo at workspace root
- `artifacts/api-server` — Express 5 backend, port 8080
- `artifacts/driftlife` — React + Vite frontend, port 24576
- Workflows: "API Server" (port 8080) and "Start application" (port 24576)
- Duplicate artifact-specific workflows exist but should remain FAILED (ports conflict intentionally)

## Database
- MongoDB (user-provided MONGODB_URI secret, NOT the built-in Replit PostgreSQL)
- All game data (jobs, crimes, NPCs, frames) is hardcoded statically in route files — no DB seeding needed

## Auth
- Custom JWT auth (not Replit Auth) — `requireAuth`, `requireOwner`, `requireStaff`, `requireDev` in `artifacts/api-server/src/middlewares/auth.ts`
- JWT_SECRET and JWT_REFRESH_SECRET have dev fallbacks; only MONGODB_URI is required

## Email
- nodemailer via Gmail (GMAIL_USER + GMAIL_PASS secrets) — optional for dev

## Phase 2 stubs
- All in `artifacts/api-server/src/routes/phase2.ts` — return `{ message: "coming soon" }`

**How to apply:** When adding new routes, check phase2.ts for stubs first before creating new route files.
