# DRIFTLIFE — FRAME SYSTEM & MAJOR UPDATE MASTER BUILD PROMPT

## Project Context
DriftLife is a persistent multiplayer text-based browser RPG set in New Vanta, 2047 — cyberpunk dystopia.
Stack: pnpm workspaces, Node.js 24, TypeScript 5.9, React + Vite frontend (`artifacts/driftlife`), Express 5 + Socket.io backend (`artifacts/api-server`), MongoDB + Mongoose (NOT PostgreSQL).
See `replit.md` for full stack details and environment setup.

---

## CRITICAL RULES
- Never use `console.log` in server code — use `req.log` in routes, `logger` elsewhere
- `pnpm run typecheck` not `build` for verification
- MongoDB chosen over PostgreSQL — do not add Drizzle/Postgres
- bcryptjs (pure JS) not native bcrypt
- All frame changes persist to MongoDB — nothing in-memory
- All effects render BEHIND text (z-index: canvas behind content layer)
- IntersectionObserver pauses off-screen animated frames
- Global cap: max 20 simultaneously animated canvases on screen

---

## PHASE 1 — KNOWN ISSUES TO FIX FIRST

1. Add `ownedFrames: string[]` to `IUser` interface in `artifacts/api-server/src/models/User.ts` (currently cast via `(user as any)`)
2. Remove duplicate equip-frame route in `user.ts` — canonical route lives in `frames.ts`
3. Fix NC/UC inconsistency in `FramesStorePage.tsx` — always display "NC" not "UC"
4. Wire up `equippedFrameColor` properly — apply to chat cards, profile, feed, avatar everywhere
5. Align `earnedBy` field between frontend `FrameDef` and backend `Frame` type
6. `FRAME_PRICE_OVERRIDES` in-memory map — eliminate this, move to MongoDB

---

## PHASE 2 — CORE ARCHITECTURE CHANGE: FRAMES TO MONGODB

Move `FRAME_CATALOG` from hardcoded in-memory arrays to a MongoDB `frames` collection.

### Frame Mongoose Model Schema
```
frameId: string (unique)
displayName: string
rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"
glowColor: string (default color hex)
animationType: "static" | "shimmer" | "pulse" | "epic-particles" | "legendary-electric" | "mythic-cascade"
variantIndex: number (0-9, picks which unique design within animation type)
price: number
currency: "dc" | "merit" | "nc"
isFree: boolean
description: string
earnedBy: string | null (lock condition display text)
isCustom: boolean (owner-created vs built-in)
isVisible: boolean (store visibility toggle)
isFeatured: boolean (pinned to top of store)
salePrice: number | null
saleExpiry: Date | null
availableFrom: Date | null
availableUntil: Date | null
isWeeklyFree: boolean
createdAt: Date
updatedAt: Date
```

On server start: seed DB with all 55 built-in frames if `frameId` does not already exist. Never overwrite existing DB records on seed (preserve owner price changes).

---

## PHASE 3 — 55 FRAMES COMPLETE CATALOG

### THREE CURRENCY SYSTEM
- **DC** (DriftLife Coin) — Common frames: 500,000 to 2,000,000 DC
- **Merit (M)** — Uncommon + Rare frames: 500 M to 5,000 M
- **NC** (Nova Coin) — Epic + Legendary + Mythic frames: 50 NC to 5,000 NC

### COMMON (10) — Static header shapes, no body animation, DC currency
Each has a completely different border/header geometry. No animation on common frames at all.

| frameId | displayName | Header Design | Price DC |
|---|---|---|---|
| ghostFrame | Ghost | L-corner arms only, open corners, no full border | 0 (free) |
| basicWhite | Basic White | Full solid clean rectangle border | 500,000 |
| basicGray | Basic Gray | Chamfered octagon border, cut corners | 500,000 |
| neonBlue | Neon Blue | Double concentric border, outer + inner line | 1,000,000 |
| neonGreen | Neon Green | Dashed/dotted border all around | 1,000,000 |
| neonRed | Neon Red | Thick outer glow band + thin inner hairline | 1,000,000 |
| corpGray | Corp Gray | Top + bottom edge lines only, no side lines | 1,500,000 |
| streetOrange | Street Orange | Inner ring + small dots at corner positions | 1,500,000 |
| cyanPulse | Cyan Basic | Diagonal X marks at all four corners only | 2,000,000 |
| goldBasic | Gold Basic | Diamond/rhombus outline instead of rectangle | 2,000,000 |

### UNCOMMON (10) — Animated header, faint static body texture, Merit currency
Each has a mechanically different animation on the header. Body has barely-visible static texture pattern (no animation in body, zero lag).

| frameId | displayName | Header Animation Mechanic | Body Texture | Price M |
|---|---|---|---|---|
| shimmerCyan | Shimmer Cyan | Single orb sweeping around header perimeter | Faint dot-grid | 500 |
| shimmerPurple | Shimmer Purple | Two opposing orbs sweeping toward each other | Faint hex outline pattern | 600 |
| shimmerGold | Shimmer Gold | Rotating dashed border, dash offset scrolls | Faint diagonal lines | 700 |
| shimmerRed | Shimmer Red | Three equally-spaced orbs sweeping together | Faint noise/scatter dots | 700 |
| shimmerGreen | Shimmer Green | Single orb with very long comet tail | Faint crosshatch grid | 800 |
| shimmerOrange | Shimmer Orange | Corner flash sequence, corners light up one by one | Faint dashed horizontal lines | 800 |
| techShimmer | Tech Shimmer | Evenly-spaced digital dots marching along border | Faint static circuit line segments | 900 |
| suitShimmer | Suit Shimmer | Ultra-slow barely-visible single orb crawl | Faint diagonal pinstripes | 1,000 |
| crimsonShimmer | Crimson Shimmer | Inner ring + outer ring sweeping opposite directions | Faint vertical dash lines | 1,200 |
| iceShimmer | Ice Shimmer | Two orbs moving but freezing/stuttering mid-path | Faint scattered snowflake dots | 1,500 |

### RARE (10) — Unique pulse/breathing mechanics, Merit currency
Each has a mechanically unique pulse style. Body has a corresponding breathing glow effect.

| frameId | displayName | Pulse Mechanic | Price M |
|---|---|---|---|
| pulseCyan | Pulse Cyan | Whole border opacity breathes in/out | 2,000 |
| pulsePurple | Pulse Purple | Two borders breathing anti-phase, one in while other out | 2,500 |
| pulseGold | Pulse Gold | Single spotlight orb traveling perimeter slowly | 2,500 |
| pulseRed | Pulse Red | Fast erratic flicker, random intensity | 3,000 |
| pulseGreen | Pulse Green | Vertical scan line sweeping downward across body | 3,000 |
| hackerPulse | Hacker Pulse | Four corner blooms glowing and fading independently | 3,500 |
| corePulse | Core Pulse | Border changes thickness, expands then contracts | 3,500 |
| vaultPulse | Vault Pulse | Two heavy concentric rings pulsing outward slowly | 4,000 |
| streetPulse | Street Pulse | Full header strobe blink, on/off rapidly | 4,000 |
| spectralPulse | Spectral Pulse | Entire card ghost-fades in and out slowly | 5,000 |

### EPIC (10) — Named themes, unique particle system behaviors, NC currency
Textured header + 6-8 slowly drifting particles behind body text. Each has different particle movement behavior.

| frameId | displayName | Theme Name | Header Texture | Particle Behavior | Price NC |
|---|---|---|---|---|---|
| epicCyan | Epic Cyan | Data Stream | Horizontal scan-line texture | Particles stream left→right in lanes | 50 |
| epicPurple | Epic Purple | Neural | Hexagon grid pattern | Nodes connected by thin lines, connections pulse | 60 |
| epicGold | Epic Gold | Vault | Horizontal bar/stripe texture | Particles spiral inward toward center | 70 |
| syndicate | Syndicate | Syndicate | Diagonal slash marks pattern | Particles march in diagonal formation | 75 |
| epicRed | Epic Red | Danger Zone | Vertical static interference lines | Particles vibrate/jitter in place, static noise | 80 |
| gridCore | Grid Core | Grid Core | Clean square grid pattern | Particles snap to grid positions and swap | 80 |
| suitsFrame | The Suits | The Suits | Pinstripe diagonal lines | Slow rainfall, particles drift straight down | 90 |
| epicVoid | Epic Void | Void | Faint swirl texture | Particles slowly shrink and vanish, absorbed | 100 |
| epicInferno | Epic Inferno | Inferno | Fire gradient left dark right ember | Ember particles rise upward | 100 |
| epicNova | Epic Nova | Nova | Radial burst from top-right corner | Radial burst outward from center, resets, loops | 120 |

### LEGENDARY (10) — Unique electric effects, NC currency
Strong solid header with corner bracket accents. Each has a mechanically different electric behavior. No repeated lightning bolt icons.

| frameId | displayName | Name | Electric Mechanic | Price NC |
|---|---|---|---|---|
| legendCyan | Lightning Cyan | Lightning Cyan | Sparks shoot outward from corners | 200 |
| legendPurple | Lightning Purple | Lightning Purple | Chain arc draws corner-to-corner diagonally | 250 |
| legendGold | Lightning Gold | Lightning Gold | Sparks crawl slowly along border edges | 300 |
| legendRed | Lightning Red | Lightning Red | Full header glitch-shifts position briefly | 300 |
| crimsonLord | Crimson Lord | Crimson Lord | Drip effect from bottom of header strip | 350 |
| arcLight | Arc Light | Arc Light | Sustained glowing arc between two fixed points on header | 350 |
| plasmaBolt | Plasma Bolt | Plasma Bolt | Expanding ring discharge pulsing from corners | 400 |
| thunderClap | Thunderclap | Thunderclap | Entire header white-flash strobe burst | 400 |
| vantaLegend | Vanta Legend | Vanta Legend | Many small simultaneous mini-sparks scattered across header | 450 |
| executioner | Executioner | Executioner | Scan line + header offset glitch combo simultaneously | 500 |

### MYTHIC (5) — Full card takeover effects, NC currency
Full card effects. Hue shifts. Matrix cascades. These are the rarest frames.

| frameId | displayName | Name | Full Card Effect | Price NC |
|---|---|---|---|---|
| matrixGreen | Matrix | Matrix | Falling code chars on left + right edge strips only (not behind text center) | 1,000 |
| voidWalker | Void Walker | Void Walker | Orbiting orbs phasing in and out around card edges | 1,500 |
| nova2047 | Nova 2047 | Nova 2047 | Pink nebula glow + slow orbital particles along card border | 2,000 |
| godMode | God Mode | God Mode | All mythic effects running simultaneously — maximum chaos | 3,000 |
| theOne | The One | The One | Matrix cascade + orbiting orbs + corner glow + full card hue shift — rarest | 5,000 |

### MYTHIC REMAP (5 removed IDs — visual aliases, keep in DB)
These IDs remain in the database so players who own them lose nothing. They visually render as their alias:
- `matrixBlue` → renders as `matrixGreen`
- `matrixGold` → renders as `matrixGreen`
- `matrixRed` → renders as `matrixGreen`
- `omega` → renders as `godMode`
- `architect` → renders as `theOne`

---

## PHASE 4 — FRAME RENDERING SYSTEM

### Where Frames Appear — 4 Locations

#### 1. Chat Messages — Full Card Skin
Replace current `FrameRectBubble.tsx` border approach entirely. New structure:
```
┌─────────────────────────────────────────┐  ← HEADER STRIP (frame background + design)
│  [avatar+border]  USERNAME  [tag]  NAME  │  ← frame name shown top-right
└─────────────────────────────────────────┘
│  message text here (frame bg behind)    │  ← BODY (themed effect behind text)
└──────────────────────────────────────────┘
```
- Header strip: themed background with the frame's header design/animation
- Body: frame background effect (particles, glow, etc.) behind text at low opacity
- All Canvas effects use `position: absolute, inset: 0, z-index: 1, pointer-events: none`
- Text content at `z-index: 2` always on top
- Applies in: Global chat, District chat, DMs

#### 2. Player Profile — Full Card Skin (larger version)
Profile card header becomes the frame card skin. Body of profile card (stats, bio) gets the frame body background effect.
Profile page split into 4 tabs: Overview / Achievements / Frames / Combat Log

#### 3. Feed Entries — Lightweight
- No frame: plain entry
- Common: thin colored left border line
- Uncommon/Rare: colored left border + faint background tint
- Legendary: left border that pulses occasionally
- Mythic: left border with slow hue shift + faint body glow
- Combat feed entries show attacker's frame treatment

#### 4. Avatars — Circular Border Per Frame
- Each frame's border design is adapted to circular form matching its header pattern
- **xs (28px) + sm (36px):** simplified glow border only, no particles or chars
- **md (48px) + lg (64px) + xl (96px):** full frame effect with particles and animations
- 4px rarity dot rendered below avatar at xs/sm sizes (color = rarity tier color)
- Color always follows `equippedFrameColor` (player's custom color setting)

### Color System
When player sets a custom frame color:
- Header strip accent color updates
- Body particle/glow color updates
- Avatar border color updates
- Feed entry border color updates
- Design/animation mechanic stays the same — only color changes

### Performance Rules
- IntersectionObserver on every animated canvas — pause when off-screen
- Global animated canvas cap: 20 simultaneously — if exceeded, excess downgrade to static glow
- Mobile lite mode: auto-detect `navigator.hardwareConcurrency <= 4` OR manual toggle in settings → all frames render as static common-style border only

---

## PHASE 5 — FRAME STORE UI REDESIGN

### Store Preview
Replace current 88×60px FrameCardWrapper rectangle with a full-width mini chat card mock (~280px wide):
- Shows "USERNAME · FRAMENAME" in the header strip with real frame effect running
- Shows dummy message body below with real body effect running live
- Players see exactly what they're buying

### Store Features
- Filter tabs: All / Common / Uncommon / Rare / Epic / Legendary / Mythic / Limited
- Additional filters: DC / Merit / NC currency filter, Owned / Not owned filter
- Sort: price low→high, high→low
- Search by name
- "NEW" badge for 7 days on newly added frames
- "FREE THIS WEEK" banner on weekly free frame at top of store
- "SALE" badge showing original + sale price on discounted frames
- Countdown timer on limited-time frames
- Frame bundle packs shown as special cards above individual frames

### Color Picker (in store)
Below the Equip button once a frame is owned:
- 12 preset color swatches
- Custom hex input field
- Save hits `POST /api/frames/color` → saves `equippedFrameColor` on User
- Updates everywhere in real-time

### Equip Animation
0.3s fade-in transition when equipping a frame. No snap.

### Profile Frame Section
- Frame showcase: all owned frames as tiny thumbnails
- Frame stats: total owned out of 55, rarest frame owned, collection % bar

---

## PHASE 6 — OWNER FRAME MANAGER PANEL

Full dedicated section in owner panel: "Frame Manager"

### Owner Actions
- View all frames: table with frameId, name, rarity, price, currency, owned-by count, visibility status
- Toggle store visibility (hidden frames still equippable by owners)
- Pin up to 3 featured frames to top of store
- Set sale price + optional expiry date
- Set limited-time availability (start + end date)
- Bulk actions: select multiple → hide all / set sale / grant to all
- Grant any frame to any player (search by username)
- Revoke any frame from any player
- Pick weekly free frame (one common/uncommon per week)
- Create frame bundle packs (name, list of frameIds, combined price, optional time window)

### Create New Frame (Owner Form)
Fields: frameId (auto from name, editable), displayName, rarity, animationType, variantIndex (0-9), defaultGlowColor, price, currency, description, earnedBy (optional lock text)
New frame appears in store immediately. Stored in MongoDB.

### Edit/Delete Frames
- Can edit: displayName, description, price, currency, earnedBy, visibility on ALL frames
- Can delete: only `isCustom: true` frames (owner-created). Built-in frames protected.

### Owner Grants
Owner can grant to any player or themselves:
- DC amount
- NC amount  
- Merit (M) amount
- XP amount
- Specific frame
All grants logged to MongoDB with timestamp + amount + granted-by.

### XP Boost Control
- Set server-wide XP multiplier (1.5x, 2x, 3x)
- Set duration (1h, 6h, 24h, weekend)
- Active boost shows banner in game
- Persists to MongoDB — survives redeploy

---

## PHASE 7 — LEADERBOARD REDESIGN

Top 3 get special treatment:
- **#1 Gold Champion:** rotating gold conic border on entire row, gold crown above avatar, animated gold particle trail
- **#2 Silver:** silver pulse border on row, silver shimmer
- **#3 Bronze:** bronze/copper breathing glow border on row
- **#4 and below:** equipped frame's lightweight left-border tint
Full leaderboard layout redesign: bigger rank numbers, podium feel for top 3, cleaner rows for rest.

---

## PHASE 8 — THREE CURRENCY SYSTEM

### DC — DriftLife Coin (existing)
No changes to earning. Used for common frames at high amounts.

### NC — Nova Coin (existing field, new shop)
Used for Epic/Legendary/Mythic frames.

NC Shop via Telegram Stars:
- "Buy NC" button in game → redirect to Telegram bot link
- Bot detects linked `telegramId` on User
- If no Telegram linked: show "Link your Telegram first" prompt
- Bot sends NC package menu
- Payment via Telegram Stars ⭐
- On payment success: bot calls `POST /api/nc/grant` (secured with bot secret header)
- NC credited to player account
- Transaction logged in MongoDB

NC Packages:
| Stars | NC | Bonus |
|---|---|---|
| 50 ⭐ | 50 NC | — |
| 150 ⭐ | 175 NC | +25 |
| 300 ⭐ | 375 NC | +75 |
| 500 ⭐ | 650 NC | +150 |
| 1000 ⭐ | 1,400 NC | +400 |
| 2500 ⭐ | 3,750 NC | +1,250 |

### Merit (M) — New Achievement Currency
New field on User model: `merit: number` (default 0)
Earned by completing permanent achievements. Spent on uncommon/rare frames.
Displayed as "1,200 M" in UI.
Owner can grant Merit directly to any player or themselves.
Player can view Merit transaction history (earned from + spent on log).

---

## PHASE 9 — ACHIEVEMENTS SYSTEM

### Achievements Page
New page in the game accessible from nav.
- Permanent achievements ONLY — completed once, never resets, no daily/weekly/monthly/yearly
- No prerequisite chains — all achievements visible and accessible from day one
- 80+ achievements across 6 categories

### Page Structure
```
ACHIEVEMENTS
Total Merit Earned: 4,500 M
Completed: 23/80 | Progress bar
[Filter: All | Combat | Crime | Wealth | Social | Exploration | Collection]

Each card:
- Achievement name + icon
- Description
- Merit reward (+200 M)
- Progress bar if incomplete (47/100 fights)
- CLAIMED green stamp if done
```

### Achievement Categories & Examples
**Combat:** First blood, Win 10/50/100/500 fights, Never hospitalized, KO streak
**Crime:** First crime, 100/500/1000 crimes, Every crime type done, Never jailed
**Wealth:** First million DC, 10M DC banked, 100 NC earned, First frame purchased
**Social:** Send 100 messages, Gift a frame, First DM sent, Follow 10 players
**Exploration:** Visit all 5 districts, Reach level 10/25/50/100, First prestige
**Collection:** Own 5/10/25/55 frames, Own one of each rarity, Equip a mythic frame

### Merit Rewards by Achievement Size
- Minor: 10 M
- Small: 50 M
- Medium: 150 M
- Large: 500 M
- Epic: 2,000 M
- Legendary: 10,000 M

On completion: popup notification shows → Merit granted instantly → CLAIMED stamp appears.
Achievement auto-checks run on relevant game events (fight won, crime committed, etc.)

---

## PHASE 10 — XP & LEVELING FIXES

### Flattened XP Curve
- Levels 1–10: 500 to 2,000 XP per level
- Levels 11–30: 3,000 to 8,000 XP per level
- Levels 31–60: 10,000 to 25,000 XP per level
- Levels 61–100: 30,000 to 100,000 XP per level
- Level 100+: prestige territory, intentionally very hard

### Additional XP Sources
- Daily login streak bonus: +50 to +500 XP scaling with streak length
- Winning combat: increase from current amount
- Completing an achievement: XP based on achievement size
- Sending messages in district/global chat: +2 XP per message, capped 20/day (anti-spam)
- Daily reward claim: +25 XP base
- First crime of the day: double XP bonus

---

## PHASE 11 — CHAT SYSTEM FULL REDESIGN

### Chat Page — 3 Tabs
```
┌──────────────────────────────────────────┐
│  GLOBAL     DISTRICT        MESSAGES     │
│  (all)   (current area)   (3 unread)    │
└──────────────────────────────────────────┘
```

### Global Chat
- All players see and post here
- Frame card skins apply fully
- Last 50 messages stored in MongoDB
- Rate limit: 1 message per 3 seconds, 256 char max
- +2 XP per message, capped 20/day

### District Chat
- Only players in the same district
- Auto-switches channel when player travels to new district
- Last 50 messages stored per district
- Frame card skins apply fully
- Same rate limit

### Messages (DMs — Player to Player)
- Open to anyone by default
- Player can set to "nobody" in settings
- Last 50 messages per conversation stored in MongoDB
- Conversation list (left panel desktop, full-screen list on mobile)
- Player search to start new conversation
- Frame card skins apply to DM messages
- Unread count badge on Messages tab
- Block/mute per conversation
- New DM triggers notification

### Shared Chat Features (All Channels)
- Frame card skins on all messages (header + body)
- Avatar with frame circular border next to each message
- Tap/click username → opens inspect modal
- Online status dot on avatar (green=online, yellow=away 5min, gray=offline)
- Muted players' messages hidden
- Blocked players' messages invisible
- Timestamps on all messages
- Socket.io powers real-time across all three channels (path: `/api/socket.io`)

### Chat Moderation (Owner/Staff Panel)
- Delete any message in any channel
- Mute player from chat for X hours/days
- Word filter: owner sets blocked words list, auto-deletes messages containing them
- View message history per player

---

## PHASE 12 — FRAME GIFTING

- From inspect modal or leaderboard: "Gift Frame" button
- Player picks a frame they own from dropdown
- Pays gifting fee: 10% of frame's original price in same currency
- Recipient gets notification: "USERNAME gifted you [Frame Name]"
- Frame added to recipient's `ownedFrames` immediately
- City feed event: "USERNAME gifted [Frame Name] to USERNAME"
- Cannot gift: currently equipped frame, ghostFrame (free), frames received as gifts (no re-gifting)

---

## PHASE 13 — NOTIFICATIONS SYSTEM UPDATE

Add notification types:
- Achievement completed: "You completed [Name] — +200 M earned"
- Frame gifted received: "USERNAME gifted you [Frame Name]"
- New DM: "USERNAME sent you a message"
- Frame purchased confirmation
- XP boost active: "2x XP boost is now active — 4 hours remaining"
- Weekly free frame: "This week's free frame: [Name] — claim it now"
- Keep existing: combat alerts, system messages

Notifications panel stays clean — NO frame card skin effects in notifications.

---

## PHASE 14 — ONLINE STATUS

- New field on User model: `lastActiveAt: Date`
- Updated on every authenticated request
- Green dot = active in last 2 minutes
- Yellow dot = active in last 10 minutes
- Gray dot = offline (10+ minutes)
- Player can set "appear offline" in settings (`appearOffline: boolean` on User)
- Status shown: DM conversation list, inspect modal, player search results

---

## PHASE 15 — SETTINGS PAGE UPDATE

New settings options:
- **Lite Mode** toggle (forces all frames to static border — for performance)
- **Appear offline** toggle
- **DM privacy** (anyone / nobody)
- **Notification preferences** per type (achievement, DM, frame gift, XP boost, weekly frame)
- **Chat text size** (small / medium / large)

---

## PHASE 16 — PROFILE PAGE TABS

Split profile into 4 tabs:
1. **Overview** — stats, bio, equipped gear, equipped frame display
2. **Achievements** — their completed achievements and progress
3. **Frames** — owned frame showcase (thumbnail grid) + collection stats (total owned / rarest / %)
4. **Combat Log** — recent fight history

---

## PHASE 17 — INSPECT MODAL UPDATE

When inspecting another player:
- Modal header becomes their full frame card skin (same as profile treatment)
- Shows: avatar with frame border, username, level, faction, frame name
- "Gift Frame" button at bottom
- Frame card skin runs live animated in the modal

---

## USER MODEL ADDITIONS NEEDED

Add these fields to `IUser` interface and Mongoose schema:
```typescript
ownedFrames: string[]           // fix existing (was any cast)
equippedFrameColor: string | null  // fix existing (was unused)
merit: number                   // new — Achievement Points
appearOffline: boolean          // new — online status setting
lastActiveAt: Date              // new — online status tracking
dmPrivacy: "anyone" | "nobody"  // new — DM privacy setting
liteModeEnabled: boolean        // new — performance setting
notificationPrefs: {            // new — notification toggles
  achievements: boolean
  dms: boolean
  frameGifts: boolean
  xpBoost: boolean
  weeklyFrame: boolean
}
```

---

## API ROUTES TO ADD/MODIFY

### New Routes
- `POST /api/frames/color` — save custom frame color
- `POST /api/frames/gift` — gift a frame to another player
- `GET /api/achievements` — all achievements + player progress
- `POST /api/achievements/check` — internal: check and grant achievements
- `GET /api/merit/history` — player's merit transaction log
- `GET /api/nc/history` — player's NC transaction log
- `POST /api/nc/grant` — bot webhook: grant NC after Telegram Stars payment (secured)
- `GET /api/chat/global` — last 50 global messages
- `GET /api/chat/district/:districtId` — last 50 district messages
- `POST /api/chat/global` — send global message
- `POST /api/chat/district/:districtId` — send district message
- `GET /api/dm/conversations` — player's DM conversation list
- `GET /api/dm/:userId` — last 50 messages with a specific player
- `POST /api/dm/:userId` — send DM to player
- `GET /api/players/search?q=` — search players by username
- `GET /api/settings` — get player settings
- `PATCH /api/settings` — update player settings
- `POST /api/owner/frames/bundle` — create frame bundle
- `POST /api/owner/xp-boost` — activate server-wide XP boost
- `POST /api/owner/grant/merit` — grant Merit to player
- `POST /api/owner/grant/xp` — grant XP to player

### Modified Routes
- All frame routes now read from MongoDB instead of in-memory FRAME_CATALOG
- Owner frame routes persist changes to MongoDB

---

## FRONTEND PAGES TO ADD/MODIFY

### New Pages
- `AchievementsPage.tsx` — achievements browser with progress
- `ChatPage.tsx` — replaces/upgrades existing district chat with 3-tab system
- `SettingsPage.tsx` — new settings page

### Modified Pages
- `FramesStorePage.tsx` — mini chat card preview, sort/filter, color picker, bundle packs
- `ProfilePage.tsx` — 4 tabs, frame showcase, frame stats
- `LeaderboardPage.tsx` — full redesign with top 3 special treatment
- `OwnerPage.tsx` — Frame Manager section added

### Modified Components
- `FrameRectBubble.tsx` — complete rebuild as card skin system
- `FrameCardWrapper.tsx` — rebuild to show mini card skin preview
- `PlayerFrame.tsx` — simplify, size-aware, performance improvements
- `AvatarWithFrame.tsx` — add rarity dot for small sizes
- `NavBar.tsx` — add Achievements and Chat page links
- `PlayerInspectModal.tsx` — full card skin header

---

## BUILD ORDER (Recommended)

1. Fix all known issues first
2. Frame MongoDB migration + seed
3. Update User model with new fields
4. Rebuild frame rendering components (PlayerFrame, FrameRectBubble, FrameCardWrapper)
5. Frame store UI redesign
6. Color picker + frame gifting
7. Owner Frame Manager panel
8. Merit currency + User model fields
9. Achievements system (page + backend checking)
10. XP curve fixes + new XP sources
11. Chat system redesign (Global + District + DMs)
12. NC shop Telegram integration
13. Leaderboard redesign
14. Profile page tabs
15. Settings page
16. Inspect modal update
17. Notifications update
18. Online status system
19. Performance optimization pass (IntersectionObserver, 20-frame cap, lite mode)
20. Full typecheck pass — `pnpm run typecheck`

---

## NOTES FOR NEXT AGENT
- This plan was fully designed and approved by the project owner before building started
- Do not change frame IDs — players have existing ownership tied to these IDs
- The 5 removed mythic IDs (matrixBlue, matrixGold, matrixRed, omega, architect) must remain in DB as visual aliases
- ghostFrame is the only free frame (isFree: true, price: 0)
- Merit currency abbreviation is "M" — displayed as "1,200 M" in UI
- NC is "NC" everywhere — never "UC"
- All effects must render BEHIND text (z-index layering: canvas z-1, content z-2)
- Socket.io path is `/api/socket.io` — do not change
- Never use console.log in server — use req.log or logger
- Run `pnpm run typecheck` not build for verification
