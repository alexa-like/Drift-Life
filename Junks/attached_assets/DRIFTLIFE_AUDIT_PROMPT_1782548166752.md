# DRIFTLIFE — AUDIT & COMPLETION PROMPT
### Give this to the agent AFTER the initial build

---

## YOUR JOB

You are continuing the build of DriftLife — a multiplayer browser-based RPG. The codebase already exists. Your job is to:

1. **Audit every system listed below** — check if it exists, if it works correctly, and if it is complete
2. **Fix or build anything that is missing, broken, incomplete, or stubbed**
3. **Do not ask questions** — use the spec below to make every decision yourself
4. **Do not skip anything** — go through every checklist item one by one

Work through this document top to bottom. Do not stop until every checkbox is resolved.

---

## HOW TO AUDIT

For each system:
- Check if the route/file/component EXISTS
- Check if it is WIRED UP correctly (imported, mounted, accessible)
- Check if the LOGIC matches the spec
- Check if the UI renders correctly
- Fix immediately if anything is wrong

---

## TECH STACK (Reference)

| Layer | Technology |
|---|---|
| Runtime | Node.js (latest LTS) |
| Backend | Express.js |
| Frontend | React (Vite) |
| Database | MongoDB via Mongoose |
| Auth | JWT (access: 15 min, refresh: 30 days) |
| Real-time | Socket.io |
| AI (NPCs) | Groq API — `llama-3.3-70b-versatile` |
| Avatar AI | Pollinations AI (no API key needed) |
| Emails | Nodemailer via Gmail SMTP |

---

## DEPLOYMENT CHECK

- [ ] `render.yaml` exists in project root
- [ ] `render.yaml` is type `web` (NOT static site)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Root `package.json` has `"build": "cd client && npm install && npm run build"`
- [ ] Root `package.json` has `"start": "node server/index.js"`
- [ ] Express serves `client/dist` as static files
- [ ] Express has catch-all `app.get('*')` that returns `index.html` for non-API routes
- [ ] Server binds to `process.env.PORT || 3000`
- [ ] All 9 env vars declared in `render.yaml` with `sync: false` for secrets

**If any of the above are wrong — fix them now.**

---

## DATABASE SEEDER CHECK

- [ ] `server/seed.js` file exists
- [ ] Seeder runs on server startup
- [ ] Seeder checks `Item.countDocuments() === 0` before seeding — never double-seeds
- [ ] Seeds: all items from catalog
- [ ] Seeds: all jobs
- [ ] Seeds: all crimes
- [ ] Seeds: all frames
- [ ] Seeds: all NPCs
- [ ] Seeds: all properties

**If seeder is missing or incomplete — build it now using the catalogs in the master prompt.**

---

## SECTION A — AUTHENTICATION

- [ ] `POST /api/auth/signup` — creates user, sends OTP email, returns success
- [ ] `POST /api/auth/verify` — verifies OTP, marks account as verified
- [ ] `POST /api/auth/login` — returns access token + refresh token + user object
- [ ] `POST /api/auth/refresh` — issues new token pair from valid refresh token
- [ ] `POST /api/auth/forgot-password` — sends reset email
- [ ] `POST /api/auth/reset-password` — updates password, invalidates tokens
- [ ] JWT middleware (`requireAuth`) on all protected routes
- [ ] `requireStaff` middleware for Owner Panel routes
- [ ] `requireOwner` middleware for owner-only actions
- [ ] Unique tag generated on signup (`Username#NNNN`)
- [ ] Unique referral code generated on signup
- [ ] Referrer gets 500 DC + 200 XP on successful referral
- [ ] New user gets 750 DC on signup via referral
- [ ] Unverified players blocked from game actions (not just browsing)
- [ ] `lastLoginAt` updated on every login

**Fix anything missing above.**

---

## SECTION B — PLAYER MODEL

Check the Mongoose Player model has ALL these fields:

**Identity:** `email`, `username`, `tag`, `passwordHash`, `verified`, `verifyOtp`, `verifyOtpExpires`, `resetToken`, `resetTokenExpires`, `role`, `banned`, `bannedReason`, `mutedUntil`, `lastLoginAt`

**Progression:** `level`, `xp`, `xpToNext`, `prestige`, `skillPoints`, `unlockedSkills`, `skillTree`, `secondarySkill`, `seasonXp`, `craftingXp`

**Currencies:** `dc`, `nc`, `bankBalance`

**Stats:** `strength`, `charisma`, `intelligence`, `streetCred`, `nerve`, `energy`, `maxEnergy`, `maxNerve`, `health`, `maxHealth`, `energyRegenAt`, `nerveRegenAt`

**Combat:** `faction`, `wantedLevel`, `wantedDecayAt`, `hospitalized`, `hospitalReleaseAt`, `lastAttackAt`, `attacksToday`, `attackResetAt`, `attackCooldowns`

**Social:** `following`, `mutedUsers`, `blockedUsers`, `titles`, `equippedTitle`, `avatar`, `avatarUrl`, `bio`, `currentDistrict`, `frameIds`, `equippedFrame`, `equippedFrameRarity`

**Misc:** `referralCode`, `referredBy`, `referralCount`, `telegramId`, `telegramNotifications`, `devMode`, `battlePassPremium`

**If any field is missing — add it now.**

---

## SECTION C — RESOURCE REGEN SYSTEM

- [ ] Energy and Nerve regen is calculated ON DEMAND (not via polling/cron)
- [ ] Regen logic runs at the start of any API call that reads or deducts Energy or Nerve
- [ ] Formula: 1 Energy per 3 minutes, 1 Nerve per 5 minutes
- [ ] Values capped at `maxEnergy` / `maxNerve`
- [ ] `energyRegenAt` / `nerveRegenAt` timestamps updated after each calculation

**If regen is polling or missing — rewrite it as on-demand calculation now.**

---

## SECTION D — DAILY REWARDS

- [ ] `POST /api/daily/claim` route exists
- [ ] Checks `lastLoginAt` — one claim per calendar day only
- [ ] Tracks login streak (resets if 2+ consecutive days missed)
- [ ] Correct rewards per streak day:
  - Day 1: 100 DC
  - Day 2: 150 DC
  - Day 3: 200 DC
  - Day 4: 250 DC
  - Day 5: 300 DC
  - Day 6: 400 DC
  - Day 7: 500 DC + 1 Common Item
  - Day 14: 1,000 DC + 1 Uncommon Item
  - Day 21: 1,500 DC + 1 Rare Item
  - Day 30: 2,000 DC + 1 Epic Item
- [ ] Daily Reward page (`/daily`) renders 7-day calendar strip
- [ ] Past claims show green checkmarks
- [ ] Today shows glowing "Claim" button
- [ ] Future days are dimmed/locked
- [ ] Claim triggers animation + reward modal

**Fix anything missing.**

---

## SECTION E — JOBS SYSTEM

- [ ] `GET /api/jobs` — returns jobs available in player's current district, filtered by player level
- [ ] `POST /api/jobs/work/:jobId` — resolves job immediately (no wait timer)
- [ ] Deducts correct Energy amount
- [ ] Awards randomised DC within range
- [ ] Awards XP
- [ ] Enforces per-job cooldown (stored in player or job model)
- [ ] 30% chance to trigger a mini-game instead of instant resolve
- [ ] Auto-creates a social feed post on job completion
- [ ] All 18 jobs seeded with correct fields (district, minLevel, energyCost, dcRange, cooldown)

**Fix anything missing.**

---

## SECTION F — MINI-GAMES (All 4 required)

### Mini-Game 1: Typing Rush
- [ ] Random word appears on screen
- [ ] 25-second circular SVG countdown timer
- [ ] Player types word correctly
- [ ] Multiple rounds — more correct = higher multiplier
- [ ] Multiplier: 1 word = 1.1×, 3 words = 1.3×, 5+ words = 1.5×
- [ ] "Forfeit" button available

### Mini-Game 2: Pattern Match
- [ ] 3×3 grid of squares
- [ ] 4–8 squares light up in sequence
- [ ] Player must click in correct order from memory
- [ ] Multiplier: 4 correct = 1.2×, 6 = 1.4×, 8 = 1.6×
- [ ] "Forfeit" button available

### Mini-Game 3: Timing Clicker
- [ ] Bar slides horizontally
- [ ] Green sweet zone in center, red/yellow zones on sides
- [ ] Player clicks when bar is in green zone
- [ ] Multiple rounds
- [ ] Multiplier: 1 hit = 1.1×, 3 hits = 1.3×, 5 hits = 1.5×
- [ ] "Forfeit" button available

### Mini-Game 4: Rhythm Tap
- [ ] Notes fall down a vertical lane
- [ ] Target zone at bottom
- [ ] Player taps when note hits zone
- [ ] Hit/miss visual feedback
- [ ] Multiplier based on accuracy: 50% = 1.1×, 80% = 1.3×, 100% = 1.5×
- [ ] "Forfeit" button available

### Shared Mini-Game Requirements
- [ ] All mini-games show: circular SVG countdown, live score counter, Forfeit button
- [ ] Final overlay shows: `"Base: X DC + Bonus: Y DC = Z DC"`
- [ ] Bonus DC applied to job reward after mini-game completes
- [ ] Mini-games triggered at 30% chance during job work

**Build any mini-game that is missing or broken.**

---

## SECTION G — CRIME SYSTEM

- [ ] `GET /api/crimes` — returns crimes available, filtered by player level
- [ ] `POST /api/crimes/commit/:crimeId` — resolves crime with success/fail logic
- [ ] Success formula uses: `baseSuccess + (intelligence - 5) * 0.01 + factionBonus`
- [ ] Deducts correct Nerve amount
- [ ] On success: awards DC in range, increments `wantedLevel` by correct amount, awards XP
- [ ] On failure: may trigger hospitalization based on crime's hospital risk %
- [ ] Hospitalization sets `hospitalized: true` and `hospitalReleaseAt` to correct timestamp
- [ ] Hospitalized players blocked from: crimes, jobs, combat, travel
- [ ] Hospitalized players CAN: chat, market, inventory, bank
- [ ] Wanted Level decays 1 star per 30 minutes via `wantedDecayAt` (on-demand calculation)
- [ ] Bribe Ralston route: `POST /api/crimes/bribe` — costs `wantedLevel² × 1,000 DC`, clears wanted
- [ ] All 10 crimes seeded with correct fields

**Fix anything missing.**

---

## SECTION H — HOSPITAL SYSTEM

- [ ] `GET /api/hospital/status` — returns hospitalization status and release time
- [ ] `POST /api/hospital/use-item` — uses a hospital item from inventory
- [ ] Item effects:
  - Bandage: -10 minutes flat
  - First Aid Kit: -20 minutes flat
  - Medical Kit: -50 minutes flat
  - Nano Repair: -60% of remaining time
  - Phoenix Down: clears hospitalization entirely
- [ ] `POST /api/hospital/discharge` — early paid discharge at 50 DC per remaining minute
- [ ] On discharge (any method): `hospitalized: false`, health restored to `maxHealth`

**Fix anything missing.**

---

## SECTION I — COMBAT SYSTEM

### PvE (NPC Combat)
- [ ] `POST /api/combat/npc/:npcId` — resolves NPC fight
- [ ] Formula: `playerAttack = (strength * 1.5) + random(0,30) + weaponBonus`
- [ ] Formula: `npcDefense = npcStrength + random(0,20)`
- [ ] Win: awards DC in range, XP, possible item drop based on rarity table
- [ ] Loss: player takes HP damage; if health hits 0 → hospitalized
- [ ] NPCs filtered by current district
- [ ] All 9 NPCs seeded with correct stats

### PvP (Player vs Player — unlocks at Level 10)
- [ ] `POST /api/combat/pvp/:targetId` — resolves PvP fight
- [ ] Blocked if: player level < 10, target not in same district, target within 25 levels enforced, per-target 60-min cooldown active, daily 15 attack cap reached
- [ ] Formula: `attackerRoll = (strength + random(0,10)) + weaponBonus` — higher roll wins
- [ ] Attacker wins: steals 10% of target wallet DC (cap 500,000 DC), earns XP
- [ ] Attacker loses: loses 15% HP, possible hospitalization if health hits 0
- [ ] Both players receive socket notification with narrative combat log
- [ ] 3+ attacks on same player in 24h auto-flags in VantaLog

**Fix anything missing.**

---

## SECTION J — INVENTORY SYSTEM

- [ ] `GET /api/inventory` — returns player's full inventory grouped by category
- [ ] `POST /api/inventory/use/:itemId` — uses consumable, applies effect, decrements quantity
- [ ] `POST /api/inventory/equip/:itemId` — equips weapon/clothing/vehicle, unequips previous
- [ ] `POST /api/inventory/salvage/:itemId` — destroys item, awards 15% base price DC, requires confirmation flag in body
- [ ] `POST /api/inventory/salvage-all-commons` — salvages all Common rarity items at once
- [ ] `POST /api/inventory/list/:itemId` — lists item on market at player-chosen price
- [ ] `POST /api/inventory/trade` — sends item directly to another player by tag
- [ ] Equipped items show stat bonuses applied to player stats in real time
- [ ] Inventory UI has tabs: All, Consumables, Weapons, Clothing, Vehicles, Materials, Badges, Cards
- [ ] Each item shows rarity colour, name, quantity, equipped badge
- [ ] Item detail sheet opens on click with all action buttons

**Fix anything missing.**

---

## SECTION K — MARKET SYSTEM

- [ ] `GET /api/market/listings` — returns all active listings with filters (category, rarity, price range, sort)
- [ ] `POST /api/market/buy/:listingId` — buys listing, transfers item, deducts DC, applies 5% fee (seller gets 95%)
- [ ] `POST /api/market/cancel/:listingId` — cancels listing, returns item to seller inventory
- [ ] Listings expire after 48 hours automatically
- [ ] Market UI shows filter/sort bar + listings grid
- [ ] Each listing shows: seller avatar+frame, item name, rarity, quantity, price, Buy button
- [ ] "My Listings" tab shows player's own active listings with Cancel option
- [ ] Auction tab visible but disabled (Phase 2)

**Fix anything missing.**

---

## SECTION L — BANK SYSTEM

- [ ] `POST /api/bank/deposit` — moves DC from `dc` to `bankBalance`, no fee
- [ ] `POST /api/bank/withdraw` — moves DC from `bankBalance` to `dc`, no fee
- [ ] PvP theft confirmed to only take from `dc`, never `bankBalance`
- [ ] Bank UI shows both balances side by side with deposit/withdraw fields

**Fix anything missing.**

---

## SECTION M — SOCIAL FEED

- [ ] `GET /api/feed` — returns paginated feed posts (newest first, infinite scroll)
- [ ] `POST /api/feed/post` — creates manual post (max 280 chars)
- [ ] `POST /api/feed/react/:postId` — adds/removes reaction (👍😂😱🫡)
- [ ] `POST /api/feed/comment/:postId` — adds comment
- [ ] Auto-posts generated server-side for: job completion, crime success, PvP win, level up
- [ ] Auto-post narrative uses gritty cyberpunk voice (not "Congratulations!")
- [ ] Real-time: new posts appear without page reload via socket
- [ ] Feed filters: All Activity, Faction Only, Guild Only, Following Only
- [ ] @Mentions in posts notify tagged players

**Fix anything missing.**

---

## SECTION N — DISTRICT / MAP SYSTEM

- [ ] `GET /api/districts` — returns all 7 districts with live player count, controlling faction, danger level, jobs available count
- [ ] `POST /api/districts/travel/:districtId` — moves player to district, deducts Energy
- [ ] Travel energy costs: Residential North 3, Tech Quarter 5, Boulevard 8, Industrial East 8, Port District 8, Downtown Core 12, Outskirts 12
- [ ] Blocked if player is hospitalized
- [ ] On travel: player joins new district socket room, leaves old one
- [ ] Map UI shows all 7 district panels
- [ ] Clicking a district expands it: Zone Chat, available jobs count, available crimes, Travel button with energy cost
- [ ] "You are here" shown for current district (no travel button)
- [ ] Zone Chat is real-time, only visible to players in that district

**Fix anything missing.**

---

## SECTION O — REAL-TIME / SOCKET.IO

- [ ] Socket.io mounted on same Express server
- [ ] Client connects on login, disconnects on logout
- [ ] `auth` event authenticates socket and joins `user:{userId}` private room
- [ ] `join_district` / `leave_district` events for zone chat rooms
- [ ] `join_global` event for global chat
- [ ] `chat_message` event relays district chat
- [ ] `global_message` event relays global chat with frame data
- [ ] `notify_attack` event notifies both players on PvP
- [ ] `new_dm` event notifies DM recipient (Phase 2 feature but socket event should exist)
- [ ] Rate limiting: max 10 messages per 60 seconds per player
- [ ] Same message 3× in a row → temporary mute
- [ ] Violations return `chat_error` event to sender
- [ ] Global chat messages include `equippedFrame` and `equippedFrameRarity`

**Fix anything missing.**

---

## SECTION P — NOTIFICATIONS

- [ ] Notification model exists with: `userId`, `type`, `message`, `read`, `createdAt`, `link`
- [ ] `GET /api/notifications` — returns unread notifications
- [ ] `POST /api/notifications/read/:id` — marks as read
- [ ] `POST /api/notifications/read-all` — marks all as read
- [ ] Notifications created for: PvP received, auction outbid, auction won, property vault full, hospital release, guild invite, level up
- [ ] Bell icon in header shows unread count badge
- [ ] Clicking bell opens notification dropdown
- [ ] Clicking notification navigates to relevant page

**Fix anything missing.**

---

## SECTION Q — PROFILE SYSTEM

- [ ] `GET /api/profile/me` — returns full own profile
- [ ] `GET /api/profile/:tag` — returns other player profile (public fields only)
- [ ] `PATCH /api/profile/bio` — updates bio (max 300 chars)
- [ ] `PATCH /api/profile/avatar` — updates avatar seed or avatarUrl
- [ ] `PATCH /api/profile/title` — sets equippedTitle from owned titles
- [ ] `PATCH /api/profile/frame` — sets equippedFrame from owned frames
- [ ] `POST /api/profile/follow/:userId` — follows/unfollows player
- [ ] Own profile shows: avatar+frame, username, tag, title, faction badge, prestige badge, bio editor, stat bars, resource bars with regen timers, DC/NC, equipped items, owned frames strip, badges, recent activity
- [ ] Other player profile shows same but read-only + Attack/Message/Trade/Follow buttons
- [ ] Player Inspect Modal triggered by clicking any avatar or username anywhere in the app
- [ ] Inspect Modal shows: large avatar+frame, username, tag, faction badge, prestige, title, level, XP bar, stats, bio, badges, action buttons

**Fix anything missing.**

---

## SECTION R — FRAMES SYSTEM

- [ ] Frame model exists with: `frameId`, `displayName`, `rarity`, `glowColor`, `animationType`, `price`, `currency` (dc/nc), `isFree`
- [ ] All frames seeded (100+ frames across all rarities)
- [ ] `PlayerFrame` component renders frame border with correct animation per rarity:
  - Common: static solid border
  - Uncommon: slow shimmer sweep
  - Rare: gentle pulse glow
  - Epic: rotating gradient sweep
  - Legendary: electric flicker spark
  - Mythic: matrix ripple / falling code
- [ ] `AvatarWithFrame` component combines avatar + frame
- [ ] `FrameRectBubble` component wraps chat messages with frame as border
- [ ] `LbFrameRow` component renders leaderboard rows with frame styling
- [ ] Frame sizes: xs, sm, md, lg, xl all work
- [ ] Equipped frame displays in: chat bubbles, profile, leaderboard, inspect modal
- [ ] `GET /api/frames` — returns all frames + which ones player owns
- [ ] `POST /api/frames/purchase/:frameId` — purchases frame with DC or NC, adds to `frameIds`
- [ ] `POST /api/frames/equip/:frameId` — sets `equippedFrame` and `equippedFrameRarity`

**Fix anything missing.**

---

## SECTION S — AVATAR SYSTEM

- [ ] `generateAvatarSVG(username)` function exists — deterministic SVG from username hash
- [ ] Avatar components: background shape, background colour, eye style, mouth style, hair style, accessories, skin tone
- [ ] Same username always produces same avatar
- [ ] NPC avatars use `generateNPCAvatarSVG()` with robotic/cybernetic appearance
- [ ] Each NPC has faction-coded colours (Webb: blue/grey, Nova: orange/red, Ghost: green, Marco: dark grey, Cleo: gold/pink, Ralston: navy/black)
- [ ] Settings page has "Generate Avatar" button
- [ ] AI avatar flow: player enters description → game builds Pollinations prompt → fetches `https://image.pollinations.ai/prompt/[encoded]?width=256&height=256&nologo=true` → saves URL to `avatarUrl`
- [ ] Server validates avatarUrl only accepts `https://image.pollinations.ai/*` domain

**Fix anything missing.**

---

## SECTION T — LEVELING & XP SYSTEM

- [ ] `awardXP(userId, amount)` helper function exists and runs on every XP source
- [ ] On XP award: checks if `xp >= xpToNext`, if yes: levels up, resets xp, recalculates xpToNext
- [ ] Every 5 levels from level 10: awards +1 `skillPoints`
- [ ] Level milestones enforced:
  - Level 5: can join Guild
  - Level 8: Break-In crime unlocked
  - Level 10: PvP unlocked, Skill Tree selection
  - Level 15: can create Guild, Vehicle Theft unlocked
  - Level 20: Smuggling Run unlocked
  - Level 25: Heist Solo unlocked
- [ ] Level-up triggers auto social feed post
- [ ] XP progress bar always visible in sticky header
- [ ] Prestige system scaffolded at Level 100 (even if Phase 2 content)

**Fix anything missing.**

---

## SECTION U — LEADERBOARDS

- [ ] `GET /api/leaderboard/wealth` — top 100 by total DC (wallet + bank)
- [ ] `GET /api/leaderboard/level` — top 100 by level then XP tiebreak
- [ ] `GET /api/leaderboard/pvp` — top 100 PvP wins (weekly reset)
- [ ] `GET /api/leaderboard/crime` — top 100 total crimes (monthly reset)
- [ ] `GET /api/leaderboard/faction` — faction influence by district control
- [ ] Leaderboard UI has tab switcher for all boards
- [ ] Top 3 rows styled: Gold, Silver, Bronze
- [ ] Each row shows: rank, avatar+frame, username, faction badge, equipped title, ranked metric
- [ ] Clicking any row opens Player Inspect Modal

**Fix anything missing.**

---

## SECTION V — OWNER PANEL

- [ ] Route `/owner` protected by `requireStaff` middleware
- [ ] **Dashboard tab:**
  - Live player count
  - Total DC in economy (sum of all dc + bankBalance)
  - Recent crimes list
  - Recent fights list
- [ ] **Players tab:**
  - Search by username or tag
  - View full player data
  - Adjust DC (add/subtract)
  - Adjust NC (add/subtract)
  - Set Level
  - Ban with reason
  - Unban
  - Mute with duration input
- [ ] **Patch Notes tab:**
  - Rich text editor
  - Publish immediately button
  - Schedule for later option
- [ ] Phase 2 tabs (Items, Economy, Events, Secrets, VantaLog) show "Coming Soon" placeholder

**Fix anything missing.**

---

## SECTION W — DEV TOOLBAR

- [ ] Floating panel fixed bottom-right, visible only when `player.devMode === true`
- [ ] Toggle open/close button
- [ ] **+DC button:** input field, adds DC directly to wallet
- [ ] **Lvl Up button:** input field for target level, sets level, recalculates XP and skill points
- [ ] **⚡ Fill button:** sets Energy and Nerve to max instantly
- [ ] **🏥 Heal button:** clears hospitalization, restores full health
- [ ] **🚨 Clear button:** sets wantedLevel to 0

All actions call authenticated API routes — not direct DB manipulation from client.

**Fix anything missing.**

---

## SECTION X — UI & DESIGN AUDIT

### Colour Palette — verify these exact values are used throughout
```
Background:     #0a0a0f
Surface:        #111118
Border:         #1e1e2e
Text Primary:   #e2e8f0
Text Secondary: #64748b
Accent Cyan:    #00d4ff
Warning Orange: #ff6b35
Danger Red:     #ff2d55
Success Green:  #39d353
NC Purple:      #a855f7
DC Gold:        #f59e0b
```

### Global Layout
- [ ] Sticky header present on all pages
- [ ] Header has: DriftLife logo (links home), animated XP bar, DC balance (rolling number animation), NC balance, notification bell with badge count, Owner icon (staff only)
- [ ] Player status strip shows: tag, faction emoji, prestige badge, hospitalized indicator (red), equipped title
- [ ] Top nav is horizontally scrollable carousel
- [ ] Phase 1 nav links: Feed, Map, Combat, Crime, Jobs, Inventory, Market, Profile, Bank, Daily Reward, Leaderboard
- [ ] Phase 2 nav links visible but disabled with "Coming Soon" tooltip
- [ ] Mobile: bottom nav bar, touch-friendly tap targets
- [ ] All numbers/DC values/stats use monospace font
- [ ] No light mode anywhere
- [ ] DC/NC balances animate with rolling digit counter on change
- [ ] No unnecessary particle effects or heavy animations (frames only)

### Writing Style — verify all auto-generated strings
- [ ] Gritty, cinematic, not celebratory
- [ ] Player competence assumed — failures blame the world not the player
- [ ] District names and faction names used in narrative text
- [ ] Dark humour present in crime results and feed posts

**Fix any UI/design violations.**

---

## FINAL CHECK — RUN THROUGH THIS BEFORE FINISHING

- [ ] App starts without errors (`npm start`)
- [ ] React build succeeds (`npm run build`)
- [ ] All API routes return correct status codes (200/201/400/401/403/404/500)
- [ ] All protected routes return 401 without valid token
- [ ] Socket.io connects and events fire correctly
- [ ] MongoDB connection stable (no dropped connections)
- [ ] Seeder runs on first boot and does not re-seed on subsequent boots
- [ ] All Phase 2 routes return `{ message: "coming soon" }` — not 404
- [ ] No console errors in browser
- [ ] Mobile layout works on small screen (375px width minimum)
- [ ] render.yaml is valid and will deploy correctly as a single web service

---

## PHASE 2 STUBS TO CONFIRM EXIST

These should NOT be built yet but must have placeholder routes returning `{ message: "coming soon" }`:

- [ ] `GET /api/crafting`
- [ ] `GET /api/skills`
- [ ] `GET /api/guild`
- [ ] `GET /api/properties`
- [ ] `GET /api/npc`
- [ ] `GET /api/messages`
- [ ] `GET /api/frames/store`
- [ ] `GET /api/auction`
- [ ] `GET /api/market/black`
- [ ] `GET /api/battlepass`
- [ ] `GET /api/events`
- [ ] `GET /api/seasons`
- [ ] `POST /api/telegram/link`

---

*Do not stop working until every checkbox above is resolved. Build what is missing. Fix what is broken. Ship a complete Phase 1.*
