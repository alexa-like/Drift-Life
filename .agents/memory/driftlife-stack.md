---
name: DriftLife Stack
description: Key tech choices and gotchas for the DriftLife RPG project
---

MongoDB + Mongoose (NOT Drizzle/PostgreSQL). The workspace template includes drizzle deps — ignore them for this project, they are not used.

bcryptjs (pure JS) is used instead of native `bcrypt`. The build.mjs already externalizes `nodemailer` and native `bcrypt` — bcryptjs bundles fine.

Socket.io path is `/api/socket.io` to go through the shared proxy.

**Why:** User confirmed MongoDB, no Postgres. bcryptjs avoids native module build issues on Replit.

**How to apply:** Never import from `@workspace/db`. Always use `artifacts/api-server/src/lib/db.ts` (Mongoose). Install new deps with `pnpm --filter @workspace/api-server add <pkg>`.
