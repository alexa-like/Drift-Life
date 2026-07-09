---
name: DriftLife Tier 10 Social Systems
description: Implementation details for game emojis (10.1a), mentor system (10.14), and pinned achievement badges (10.15)
---

# DriftLife Tier 10 Social Systems

## 10.1a — Custom Game Emojis

**Backend:**
- `models/GameEmoji.ts` — IGameEmoji model + EMOJI_CATALOG (16 slugs, static export used as seed fallback)
- `routes/emojis.ts` — GET /emojis (requireAuth), returns DB or static fallback
- `lib/seed.ts` — seeds emojis via upsert on slug at startup

**Frontend:**
- `components/MentionText.tsx` — GAME_EMOJIS exported catalog, tokenizer regex updated to `/(@[\w]+|\/[\w]+|:([\w]+):)/g`, "emoji" token type renders native emoji char in a styled span
- `pages/ChatPage.tsx` — MessageInput has emoji picker button (popover, 4-col grid, inserts `:slug:` at cursor end), MessageBubble shows pinnedBadges as 🏅 icons after username

## 10.14 — Mentor System

**Backend:**
- User model: `isMentor: Boolean`, `mentorId: ObjectId ref User`, `menteeIds: [ObjectId]`
- `routes/mentor.ts` — GET /status, POST /register, /unregister, /request, /end/:targetUserId
- **Atomic mentor slot claim**: `findOneAndUpdate` with `$push: { menteeIds }` and `$expr $lt size < MAX_MENTEES` — prevents race overfill
- `lib/mentorBonus.ts` — `applyXpWithMentorBonus(user, baseXp)`: adds `user.xp += xp`, calls `levelUp(user)` (no-arg), then fire-and-forget mentor +5% bonus
- **CRITICAL**: `levelUp(user: IUser)` takes NO second argument — must set `user.xp += amount` before calling it

**Frontend:**
- `lib/types.ts` — User gains `isMentor?`, `mentorId?`, `menteeCount?`

## 10.15 — Achievement Badges as Cosmetics

**Backend:**
- User model: `pinnedBadges: [String]` (max 3 enforced in route logic)
- `routes/user.ts` — POST /user/badges/pin (verifies achievement completed, enforces 3 max), POST /user/badges/unpin
- `models/ChatMessage.ts` — `senderPinnedBadges: [String]` field
- `routes/chat.ts` — all three POST handlers (global/district/faction) select `pinnedBadges`, embed as `senderPinnedBadges`, include in socket emit; all three GET handlers map `senderPinnedBadges` → `pinnedBadges` in response
- `routes/auth.ts` safeUser — includes `pinnedBadges`, `isMentor`, `mentorId`, `menteeCount`

**Frontend:**
- `pages/AchievementsPage.tsx` — pin/unpin toggle button on each completed achievement card (📌 Pin / 📌 Pinned), calls /user/badges/pin|unpin
- `pages/ProfilePage.tsx` — already had badge header display and togglePin wired to /user/badges/*; it was waiting for backend
- `lib/types.ts` — User gains `pinnedBadges?`, ChatMessage gains `pinnedBadges?`

## Why: notes
- safeUser must be updated whenever User schema gains fields that the frontend needs on login/refresh
- Emoji catalog is intentionally duplicated (backend model + frontend constant) for instant rendering without API calls
