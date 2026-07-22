# Battle Pass & Cosmetics System — Build Plan

---

## PERMANENT RULES — READ BEFORE EVERY SESSION

Read `NEONOIR_MASTER_PLAN.md` in full before touching any file. Every rule in that file applies here without exception.

---

## STATUS LEGEND
- `⏳ Not started`
- `🔧 In progress`
- `✅ Done` — built, verified, pushed to GitHub, no known bugs

---

## ⭐ TIER 1 — BATTLE PASS CREATION SYSTEM
**Status: ✅ Done**

Read `NEONOIR_MASTER_PLAN.md` in full before touching anything. Follow every permanent rule.

TASK: Add a Battle Pass management tab to the Owner Panel so the game owner can create, view, and activate/deactivate battle passes without touching code.

---

### CONTEXT
- BattlePass model: `artifacts/api-server/src/models/BattlePass.ts` — already exists (Tier 5)
- Owner battle pass routes already exist — find them with: `grep -r "battle" artifacts/api-server/src/routes/ --include="*.ts" -l`
- Frontend owner panel: `artifacts/neonoir/src/pages/OwnerPage.tsx`
- Reference structure: `artifacts/api-server/templates/battle-pass-template.json`
- Stack: React + Vite + TypeScript + Tailwind + Framer Motion (frontend), Express 5 + Mongoose + TypeScript (backend)
- API client on frontend: look for how other tabs call the API (find the `api` import/helper at the top of OwnerPage.tsx)

---

### STEP 1 — AUDIT EXISTING BACKEND ROUTES
Before writing anything, grep for existing battle pass owner routes:
```
grep -rn "battle" artifacts/api-server/src/routes/ --include="*.ts"
grep -rn "BattlePass\|battlePass\|battle-pass" artifacts/api-server/src/routes/ --include="*.ts"
```
Read every existing route file that appears. Do NOT recreate routes that already exist.

---

### STEP 2 — BACKEND (only add what's missing)
After auditing, add any missing owner routes.

File: `artifacts/api-server/src/routes/owner.ts` (or whichever file owns battle pass routes)

Routes needed (skip any that already exist):
```
GET   /api/owner/battle-pass               — list all battle passes (all statuses), sorted by createdAt desc
POST  /api/owner/battle-pass/create        — create a new battle pass
GET   /api/owner/battle-pass/:id           — get one pass with full levels array
PATCH /api/owner/battle-pass/:id           — update any field (name, premiumPrice, levels, etc.)
POST  /api/owner/battle-pass/:id/activate  — set status to "active", deactivate any other active pass
POST  /api/owner/battle-pass/:id/deactivate — set status to "inactive"
```

Create body for `POST /api/owner/battle-pass/create`:
```typescript
{
  seasonName: string,
  eventId?: string,
  premiumPrice: number,
  levels: {
    level: number,
    xpRequired: number,
    freeReward:    { dc: number, nc: number, cosmetics: string[], titles: string[] },
    premiumReward: { dc: number, nc: number, cosmetics: string[], titles: string[] }
  }[]
}
```

All routes: requireOwner middleware, log via logAdminAction.

---

### STEP 3 — FRONTEND TAB BUTTON
In `artifacts/neonoir/src/pages/OwnerPage.tsx`:

1. Add `"battle-pass"` to the Tab type union (line ~94):
   ```typescript
   type Tab = ... | "battle-pass" | ...
   ```

2. Add a nav button alongside the existing Events and Event Builder buttons (lines ~925–932):
   ```tsx
   <button onClick={() => setTab("battle-pass")} className="px-4 py-2 rounded font-mono text-xs transition-all"
     style={{ background: tab === "battle-pass" ? "#a855f718" : "#111118", color: tab === "battle-pass" ? "#a855f7" : "#475569", border: `1px solid ${tab === "battle-pass" ? "#a855f740" : "#1e1e2e"}` }}>
     🏆 Battle Pass
   </button>
   ```

3. Render the tab panel:
   ```tsx
   {tab === "battle-pass" && <BattlePassTab addToast={addToast} />}
   ```

---

### STEP 4 — FRONTEND TAB COMPONENT
Create `artifacts/neonoir/src/components/BattlePassTab.tsx`

Design: match the dark cyberpunk aesthetic of the rest of the owner panel (dark backgrounds `#070710`/`#0d0d1a`, cyan/purple accents, `font-mono` text, same card/table styling). Read `artifacts/neonoir/src/components/EventGameModesTab.tsx` for reference patterns before writing anything.

**SECTION A — "Create New Battle Pass"**

Form fields:
- Season Name (text input, required)
- Linked Event (optional — dropdown populated from `GET /api/events?status=active,scheduled` — shows event name, selects event `_id`)
- Premium Price in NC (number input, default 999)
- Number of levels (number input 1–50, default 10)
- **Auto-generate levels button**: clicking it creates evenly-spaced XP thresholds and default reward values for each level:
  - Level N XP threshold: `N * 1600`
  - Free reward: `DC = N * 500`, `NC = 0`
  - Premium reward: `DC = N * 2000`, `NC = N`
  - Owner can then edit individual levels inline after auto-generation
- **Level editor**: scrollable table where each row shows:
  `Level # | XP Required | Free DC | Free NC | Free Titles | Premium DC | Premium NC | Premium Titles`
  Each cell is an inline editable input.
- Submit button → `POST /api/owner/battle-pass/create`. Show success toast with the new pass ID.

**SECTION B — "Existing Battle Passes"**

- Fetch `GET /api/owner/battle-pass` on load and after every create/activate action
- Table columns: Season Name | Status | Levels | Premium Price | Linked Event | Created | Actions
- Status badge: `active` = green, `inactive` = gray, `archived` = orange
- Actions column:
  - "Activate" button (hidden when already active) → `POST /api/owner/battle-pass/:id/activate`
  - "Deactivate" button (hidden when inactive) → `POST /api/owner/battle-pass/:id/deactivate`
  - "View / Edit" button → expands an inline panel showing full level list and an editable form (`PATCH /api/owner/battle-pass/:id` on save)

---

### STEP 5 — VERIFY
1. `pnpm --filter @workspace/api-server run build` — zero errors
2. `pnpm --filter @workspace/neonoir run build` — zero errors
3. Restart both workflows and read logs — confirm server starts cleanly
4. Do not hand back control with errors in the build log

---

## TIER 2 — COSMETICS MANAGEMENT SYSTEM
**Status: ✅ Done**

Read `NEONOIR_MASTER_PLAN.md` in full before touching anything. Follow every permanent rule.

TASK: Add a basic Cosmetics management tab to the Owner Panel. The UI should cover creating cosmetic items and granting them to players. Keep it simple — the cosmetics system will be expanded in a future session. Do not over-build.

---

### CONTEXT
- CosmeticItem model: `artifacts/api-server/src/models/CosmeticItem.ts` — already exists (Tier 1)
- Existing cosmetics owner routes — find with: `grep -rn "cosmetic\|Cosmetic" artifacts/api-server/src/routes/ --include="*.ts"`
- Frontend owner panel: `artifacts/neonoir/src/pages/OwnerPage.tsx`
- Reference structure: `artifacts/api-server/templates/cosmetic-frame-template.json`
- Stack: React + Vite + TypeScript + Tailwind (frontend), Express 5 + Mongoose + TypeScript (backend)

---

### STEP 1 — AUDIT EXISTING BACKEND ROUTES
Before writing anything:
```
grep -rn "cosmetic" artifacts/api-server/src/routes/ --include="*.ts"
```
Read every file that appears. Do NOT recreate routes that already exist.

---

### STEP 2 — BACKEND (only add what's missing)
Add any routes that don't already exist:

```
GET    /api/owner/cosmetics          — list all cosmetics (name, category, variant, rarity, ncPrice, seasonExclusive, grantable), sorted by category then name
POST   /api/owner/cosmetics/create   — create a new cosmetic item
PATCH  /api/owner/cosmetics/:id      — update any field
DELETE /api/owner/cosmetics/:id      — hard delete
POST   /api/owner/cosmetics/grant    — grant a cosmetic to a specific player by username
                                       body: { cosmeticId: string, username: string }
                                       → push cosmeticId to user.ownedCosmetics ($addToSet, atomic)
                                       → logAdminAction
```

Create body for `POST /api/owner/cosmetics/create`:
```typescript
{
  name: string,
  description: string,
  category: "message_card" | "name_flair" | "profile_frame" | "avatar_border" | "chat_badge" | "title",
  variant: string,
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "seasonal",
  seasonExclusive: boolean,
  eventId?: string,
  ncPrice: number,
  grantable: boolean,
  imageUrl?: string
}
```

All routes: requireOwner middleware, logAdminAction.

---

### STEP 3 — FRONTEND TAB BUTTON
In `artifacts/neonoir/src/pages/OwnerPage.tsx`:

1. Add `"cosmetics"` to the Tab type union (line ~94)

2. Add nav button near the existing items/grants buttons:
   ```tsx
   <button onClick={() => setTab("cosmetics")} className="px-4 py-2 rounded font-mono text-xs transition-all"
     style={{ background: tab === "cosmetics" ? "#06b6d418" : "#111118", color: tab === "cosmetics" ? "#06b6d4" : "#475569", border: `1px solid ${tab === "cosmetics" ? "#06b6d440" : "#1e1e2e"}` }}>
     ✨ Cosmetics
   </button>
   ```

3. Render the tab panel:
   ```tsx
   {tab === "cosmetics" && <CosmeticsTab addToast={addToast} />}
   ```

---

### STEP 4 — FRONTEND TAB COMPONENT
Create `artifacts/neonoir/src/components/CosmeticsTab.tsx`

Design: same dark cyberpunk aesthetic as the rest of the owner panel. Read `artifacts/neonoir/src/components/EventGameModesTab.tsx` to match card and table patterns before writing anything.

**SECTION A — "Create Cosmetic Item"** (card with form)

Fields:
- Name (text, required)
- Description (text)
- Category (dropdown: `message_card`, `name_flair`, `profile_frame`, `avatar_border`, `chat_badge`, `title`)
- Variant (text — maps to CSS class/animation name, e.g. `"gold-crown"`, `"crimson-grid"`)
- Rarity (dropdown: `common`, `uncommon`, `rare`, `epic`, `legendary`, `seasonal`)
- NC Price (number, 0 = grant-only)
- Season Exclusive (checkbox)
- Grantable (checkbox, default true)
- Image URL (optional text)
- Create button → `POST /api/owner/cosmetics/create`, success toast, refresh catalog

**SECTION B — "Grant to Player"** (inline form, always visible)

- Cosmetic (searchable dropdown from catalog — shows name + category + rarity badge)
- Player Username (text input)
- Grant button → `POST /api/owner/cosmetics/grant`, success/error toast

**SECTION C — "Cosmetic Catalog"**

- Fetch `GET /api/owner/cosmetics` on load and after creates
- Group by category (one collapsible section per category)
- Each row: Name | Variant | Rarity | NC Price | Season Exclusive | Grantable | Actions
- Rarity badge colors: `common`=gray, `uncommon`=green, `rare`=blue, `epic`=purple, `legendary`=orange, `seasonal`=cyan
- Actions: "Edit" (inline edit row, PATCH on save) | "Delete" (confirm dialog, then DELETE)

---

### STEP 5 — VERIFY
1. `pnpm --filter @workspace/api-server run build` — zero errors
2. `pnpm --filter @workspace/neonoir run build` — zero errors
3. Restart both workflows, read logs, confirm clean startup
4. Do not hand back control with errors in the build log
