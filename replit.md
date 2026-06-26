# DriftLife

A persistent multiplayer text-based browser RPG set in New Vanta, 2047 — a cyberpunk dystopia. Players commit crimes, work jobs, fight other players, trade gear on the black market, and build their criminal empire.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served via proxy at /api)
- `pnpm --filter @workspace/driftlife run dev` — run the frontend (port 24576, served at /)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GMAIL_USER`, `GMAIL_PASS`, `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ENCRYPTION_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/driftlife)
- Backend: Express 5 + Socket.io (artifacts/api-server)
- DB: MongoDB + Mongoose (NOT PostgreSQL/Drizzle)
- Auth: Custom JWT (bcryptjs) + Email OTP via Gmail SMTP
- AI: Groq API (for NPC dialogue — Phase 2)
- Notifications: Telegram Bot (Phase 2)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/models/` — Mongoose models (User, Item, FeedEvent, Notification)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, user, crimes, jobs, combat, bank, hospital, daily, feed, leaderboard, notifications, districts, inventory, market, dev, owner)
- `artifacts/api-server/src/lib/` — db.ts (MongoDB connect), jwt.ts, mailer.ts (OTP email), regen.ts (energy/nerve regen + level-up)
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireOwner middleware
- `artifacts/driftlife/src/pages/` — all game screens
- `artifacts/driftlife/src/components/` — NavBar, StatBar, WantedStars, ToastContainer
- `artifacts/driftlife/src/lib/api.ts` — fetch wrapper with auto-refresh
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)

## Architecture decisions

- MongoDB chosen over PostgreSQL — schema flexibility for RPG items/events, no migration overhead
- bcryptjs (pure JS) not native bcrypt — avoids native module issues on Replit; esbuild bundles it fine
- nodemailer externalized in build.mjs — cannot be bundled, loaded at runtime
- Socket.io path `/api/socket.io` — goes through the shared reverse proxy correctly
- Energy/nerve regen is calculated on-demand (not via cron) — applied when player makes any request

## Product

- Auth: register + email OTP verification, login, JWT refresh
- Dashboard: player stats, XP bar, finances, combat record, city feed preview, daily reward
- Crimes: 6 crimes with nerve cost, success rates, jail risk, wanted level
- Jobs: 5 jobs with energy cost, DC/XP rewards
- Combat: PvP with loot transfer, hospitalization
- Bank: deposit, withdraw, transfer between players
- Hospital: pay to leave early, heal HP
- Market: corp shop (buy gear), player P2P listings
- Inventory: equip/unequip weapons and armor
- Districts: 5 zones with travel (level-gated)
- Leaderboard: sortable by level, DC, wins, crimes
- Feed: live city event log
- Notifications: combat alerts, system messages
- Dev toolbar: add DC, set level, fill resources, heal, clear wanted (dev-only)
- Owner panel: list users, ban/unban, set roles, server stats

## User preferences

- Dark-only UI, monospace fonts for stats, no emojis in game UI
- Mobile-first responsive layout
- Color palette: bg #0a0a0f, surface #111118, border #1e1e2e, cyan #00d4ff, orange #ff6b35, red #ff2d55, green #39d353, purple #a855f7, gold #f59e0b

## Gotchas

- Never use `console.log` in server code — use `req.log` in routes, `logger` elsewhere
- `pnpm run typecheck` not `build` for verification (build needs PORT env)
- The workspace has drizzle/postgres deps in the template — ignore them, they are not used
- Energy regen: 5/min, nerve regen: 3/min — applied lazily on each request via `applyRegen()`
- OTP emails expire in 10 minutes; resend endpoint available at POST /api/auth/resend-otp

## Pointers

- See `attached_assets/DRIFTLIFE_REBUILT_MASTER_PROMPT_1782510190447.md` for full game spec
- Phase 2 systems: Groq AI NPCs, Telegram bot, gangs, missions, seasonal events
