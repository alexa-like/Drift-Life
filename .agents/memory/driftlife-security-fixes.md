---
name: DriftLife Security Fixes
description: Records the security/stability audit fixes applied, patterns used, and known remaining gaps
---

## What was fixed

**A-1 Atomic locks (race condition prevention):**
- `jobs.ts`: `User.findOneAndUpdate` with `energy: { $gte: energyCost }` + jobCooldown condition as the gate. Regen is saved first via `User.updateOne`, then atomic update deducts energy + sets cooldown atomically.
- `crimes.ts`: Same pattern — `nerve: { $gte: nerveCost }` condition, `$inc: { nerve: -cost }` atomically.
- `combat.ts` NPC: `lastNpcCombatAt` field gated atomically; predicate includes `{ $or: [{ lastNpcCombatAt: null }, { lastNpcCombatAt: { $exists: false } }, { lastNpcCombatAt: { $lte: cooldownThreshold } }] }` — the `null` arm is critical to avoid locking out first fight.

**A-2/A-3 Rate limiting + Helmet:**
- `app.ts` has `app.set("trust proxy", 1)` BEFORE rate limiters (critical for proxied infra like Render/Replit).
- Global: 300 req/min. Auth: 20 req/15min. Game actions (/jobs, /crimes, /combat): 60 req/min.
- Helmet applied with custom CSP (contentSecurityPolicy false would break things).

**A-4 Chat XSS:**
- `sanitize-html` with `{ allowedTags: [], allowedAttributes: {} }` strips all HTML. Applied to global, district, faction, and DM create paths.

**A-5 NoSQL injection:**
- `auth.ts` login + register: `typeof email !== "string"` guards before any DB query.

**A-6 NPC drop deduplication:**
- `grantNpcDrop` now uses `Item.findOneAndUpdate({ owner, name, type, rarity }, { $inc: {quantity:1}, $setOnInsert: {...} }, { upsert: true })`.
- Compound index added to `Item` model on `(owner, name, type, rarity)` for deduplication.

**C-2 Friends system:**
- `FriendRequest` model in `models/FriendRequest.ts`. Unique partial index on `{from,to,status:pending}`.
- `routes/friends.ts`: GET /, GET /requests, POST /request, POST /accept, DELETE /request/:id, DELETE /:friendId.
- All ID inputs validated with `mongoose.isValidObjectId()`.
- `User` model: `friends: [ObjectId]` + `lastNpcCombatAt: Date | null` fields added to both interface and schema.

**C-5 Faction chat:**
- `chat.ts`: GET/POST `/api/chat/faction`. Channel stored as `` `faction:${user.faction}` ``.
- `ChatMessage` model: channel type widened from `"global"|"district"|"dm"` to include `` `faction:${string}` ``; schema enum removed (validated in routes instead).

## Remaining known gaps (from code review)
- Other auth handlers (`resend-otp`, `forgot-password`, `reset-password`) still accept untyped body values — low priority since they use email lookups not `$where`/operator injection.
- Preliminary checks in jobs/crimes (hospital, jail, level) are still outside the atomic predicate — acceptable gameplay trade-off.

**Why:** Pattern for atomic resource deduction: save regen first, then `findOneAndUpdate` with the resource condition as the predicate. Never use `user.save()` for the resource field itself.
