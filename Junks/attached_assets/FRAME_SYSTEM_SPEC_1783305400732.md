# DRIFT — Chat Frame System Spec
> For the codebase agent. Read this entire file before touching anything frame-related.
> Last updated from owner's confirmed answers — includes profile redesign, frame locker, and store visibility rules.

---

## 0. First Task — Clean Slate

**Delete all existing frame data and the existing frame component(s).**  
The current frames (Neon Street, Red Heat, Grid Runner, Suits Gold, etc.) are being replaced entirely.  
Start from scratch with the new designs below. Do not keep any of the old gradient-based frames.

---

## 1. What Frames Are

A **chat frame** is a cosmetic item that changes how a player's username bar and message bubble look everywhere their messages appear. It is purely visual — no gameplay effect.

Frames appear in three places:
1. **Feed / Chat** — wraps every post/message the player sends
2. **Frame Store** — gallery where players browse and buy frames
3. **Profile** — when equipped, the frame themes the player's profile card

---

## 2. Currency & Purchase Rules

The game has three currencies:

| Currency | Symbol | Used for frames? |
|---|---|---|
| DC (DriftCoin) | DC | ❌ No — regular in-game currency |
| NC (NovaCoin) | NC | ✅ Yes — premium currency, only way to buy frames |
| M (Merit) | M | ❌ No — achievement points |

**All frames are purchased with NC only.**  
Future unlocks via Season Pass and Subscription are planned but NOT built yet — leave stubs/hooks but do not implement.

---

## 3. Rarity System

Only **two** rarity tiers exist:

| Rarity | Colour label | Description |
|---|---|---|
| **Elite** | Gold `#FFD700` | High quality. The standard premium frame. |
| **Legendary** | Magenta/Pink `#FF4FA3` | Rarest. Top-tier visuals, most animated. |

No Common, Rare, Standard, or any other tier. Just Elite and Legendary.

---

## 4. Frame Catalog — Original Designs

These are DRIFT's own original frames. **None should visually resemble the reference game's frames.**  
The animation *types* (sweep reveal, particle effects, glitch logo) are shared concepts — but every color, pattern, and illustrated element must be unique to DRIFT.

### ELITE FRAMES (purchased with NC)

---

#### 4.1 Neon Drift
- **Header**: Solid `#00E0FF` (electric cyan). Diagonal right cut.
- **Body border**: `#00E0FF`
- **Body art**: Animated speed-lines — thin white diagonal streaks sweep across the body from left to right, fading out, like a car passing at speed. ~3s loop.
- **Profile card theme**: Dark navy background. Cyan border on card. Speed-lines animate behind the fields. Logo: stylised `D` letterform (DRIFT monogram) with motion blur, glitches in cyan/white.
- **Accent color**: `#00E0FF`
- **Username text**: White

---

#### 4.2 Grid Static
- **Header**: Solid `#00FF9F` (grid green). Diagonal right cut.
- **Body border**: `#00FF9F`
- **Body art**: Faint data-grid pattern (thin horizontal + vertical lines, like a terminal screen grid). Grid scrolls slowly upward, continuous.
- **Profile card theme**: Dark green tint background. Grid border pulses (opacity flicker). Logo: circuit-node cluster (no resemblance to the reference game's circuit traces — these are NODE circles connected by short lines, more graph than PCB). Glitches in green/white.
- **Accent color**: `#00FF9F`
- **Username text**: Black (contrast on bright green)

---

#### 4.3 Street Phantom
- **Header**: Solid `#6A0DAD` (deep violet). Diagonal right cut.
- **Body border**: `#9B30FF`
- **Body art**: Smoke particle effect — soft purple/grey smoke wisps drift upward from the bottom of the body, slow and atmospheric.
- **Profile card theme**: Near-black background with very subtle purple vignette at edges. Card border deep violet. Logo: ghost/phantom silhouette outline, minimalist. Glitches in violet/white.
- **Accent color**: `#9B30FF`
- **Username text**: White

---

#### 4.4 Urban Heat
- **Header**: Solid `#FF4500` (ember orange). Diagonal right cut.
- **Body border**: `#FF6020`
- **Body art**: Thermal camera effect — the body background shows a slow-shifting heat-map gradient (dark blue → orange → yellow hot spots) that pulses gently. Not literal artwork, just abstract color fields.
- **Profile card theme**: Dark card. Ember orange card border. Thermal color wash as background animation (same heat-map effect, slow pulse). Logo: skyline silhouette of city buildings as a flat icon, animated with an orange glow pulse. Glitches in orange/red.
- **Accent color**: `#FF4500`
- **Username text**: White

---

#### 4.5 Signal Breach
- **Header**: Solid `#FF0040` (alert red). Diagonal right cut. Header has thin horizontal glitch scan lines overlaid (like a corrupted display — static, not animated in the header, just visual texture).
- **Body border**: `#FF0040`
- **Body art**: Scan line overlay + occasional horizontal tear (the body content "glitches" — a 1-3px horizontal band shifts right by 6px and snaps back, fires every 3–5s randomly, lasts 0.2s). Background stays dark.
- **Profile card theme**: Black card. Red border. Scan line overlay across entire card (static, semi-transparent). A red "SYSTEM BREACH" warning text watermark at 5% opacity diagonally across card. Logo: broken lock icon (padlock with crack through it), glitches in red/white.
- **Accent color**: `#FF0040`
- **Username text**: White

---

#### 4.6 Night Market
- **Header**: Solid `#FF007F` (hot pink/neon). Diagonal right cut.
- **Body border**: `#FF007F`
- **Body art**: Small illustrated market stall lanterns / hanging neon signs float across the body from right to left, very slow drift (parallax effect — 2 layers at different speeds). Drawn in a minimal line-art style.
- **Profile card theme**: Dark warm background (`#0D0008`). Hot pink border. Lantern art drifts slowly in background. Logo: stylised lantern icon (round lantern with vertical line). Glitches in pink/white.
- **Accent color**: `#FF007F`
- **Username text**: White

---

#### 4.7 Chrome Edge
- **Header**: Solid `#C0C0C0` (silver). Diagonal right cut. A thin 1px `#FFFFFF` highlight line runs along the top edge of the header to simulate a metallic sheen.
- **Body border**: `#888888`
- **Body art**: Reflective surface ripple — very subtle animated shimmer (a slow white highlight band sweeps across the body at a steep angle, ~8s interval, very low opacity ~0.15). Like light moving across chrome.
- **Profile card theme**: Dark card with cool grey tint. Silver border. Shimmer sweep as background. Logo: hexagonal shield/badge shape, silver. Glitches in silver/white.
- **Accent color**: `#C0C0C0`
- **Username text**: `#111111` (dark, for contrast on silver)

---

#### 4.8 Void Signal
- **Header**: Solid `#0A0A1A` (near-black with deep navy tint). Diagonal right cut. A glowing `#4040FF` outline border on the header (1px inner glow).
- **Body border**: `#3030CC` with a soft `box-shadow: 0 0 8px #3030CC66` glow
- **Body art**: Star/void particle field — tiny white dots drift slowly in the body, simulating deep space. 20–30 dots at any time, random speeds and sizes.
- **Profile card theme**: Darkest possible card (`#050510`). Blue-glow border. Void particle field as background. Logo: abstract waveform / signal pulse icon, animated (the wave oscillates). Glitches in blue/white.
- **Accent color**: `#4040FF`
- **Username text**: White

---

### LEGENDARY FRAMES (higher NC cost)

---

#### 4.9 APEX
- **Header**: Special — not solid. Animated horizontal shimmer bar: base `#FFD700` gold with a white highlight band that sweeps left-to-right continuously (~2s loop). This is the one frame where the header itself is animated.
- **Body border**: `#FFD700` with outer glow `box-shadow: 0 0 12px #FFD70088`
- **Body art**: Gold particle burst — small gold sparkles float upward, like embers from fire. ~10–15 particles active at any time.
- **Profile card theme**: Dark card with gold-tinted background (`#0D0B00`). Gold border with full perimeter glow. Gold sparkle particles animate behind all fields. Logo: crown icon — stylised 3-point crown in gold, animated (subtle float up-down, 2px, 3s). Glitches in gold/white with extra intensity (5+ flashes vs Elite's 3).
- **Accent color**: `#FFD700`
- **Username text**: `#0D0B00` (dark for contrast)
- **Rarity**: LEGENDARY

---

#### 4.10 Blackout Protocol
- **Header**: Solid `#000000` true black. White username text. A single thin `#FFFFFF` bottom border on the header (2px). A tiny blinking `█` cursor renders at end of the username text (blinks every 0.8s) — making the player feel like a live terminal command.
- **Body border**: `#FFFFFF` (1px white)
- **Body art**: Cascading code rain — thin vertical streams of characters (random alphanumeric, monospace) fall from top of body, dark green `#003300` on black. Classic matrix aesthetic BUT using `#003300` on black only (no other colour). Characters randomly flicker brighter white momentarily.
- **Profile card theme**: Pure black card. White perimeter border (clean, no glow). Code rain in background (same as body art). Logo: `[ CLASSIFIED ]` text in monospace, white on black, blinking underscore. No icon — just the text block. Glitches: scan-line style (full-width horizontal band flickers across the card every few seconds).
- **Accent color**: `#FFFFFF`
- **Username text**: White
- **Rarity**: LEGENDARY

---

#### 4.11 Nova Circuit
- **Header**: Solid `#FF2D6B` (vivid magenta-red). Diagonal right cut.
- **Body border**: `#FF2D6B` with glow `box-shadow: 0 0 10px #FF2D6B66`
- **Body art**: Explosive particle burst — bright particles (magenta + white) radiate outward from a central point in the body and fade out. The burst fires every 4s, takes 0.8s to expand and fade. Between bursts: the body shows faint afterglow rings (concentric circles at low opacity).
- **Profile card theme**: Dark card. Magenta-red border + glow. Burst animation plays every 4s (same timing). Afterglow rings visible between bursts. Logo: stylised explosion/nova starburst icon, animated (spins slowly, 1 rotation per 6s). Glitches in magenta/white, fires ON the burst moment (synchronized).
- **Accent color**: `#FF2D6B`
- **Username text**: White
- **Rarity**: LEGENDARY

---

#### 4.12 Sovereign
- **Header**: Rich deep purple `#4B0082` with a diagonal stripe texture (NOT diagonal candy stripes — this is a subtle herringbone weave pattern at very low opacity, like fabric/velvet texture). Diagonal right cut on outer shape.
- **Body border**: `#9040FF` with soft glow
- **Body art**: Slow aurora sweep — wide bands of color (deep purple, violet, blue) drift horizontally across the body in a slow wave. Different from any reference game aurora — this is lower saturation, more "regal velvet" than "natural aurora". Bands drift right, 8s to cross full width.
- **Profile card theme**: Dark card with faint purple vignette. Card border glows purple. Aurora bands drift as background. Logo: ornate crown (more detailed than APEX's crown — 5-point, with gem details). Crown slowly pulses its glow. Glitches in purple/gold.
- **Accent color**: `#9040FF`
- **Username text**: White
- **Rarity**: LEGENDARY

---

## 5. Chat Frame — Component Anatomy

```
[USERNAME BAR — tier color, diagonal right cut, ~33px tall]   ← header
┌────────────────────────────────────────────────────────┐
│                                                        │
│  message text here                      [body art]     │
│                                                        │
└────────────────────────────────────────────────────────┘
← body: dark bg #0A0008, colored border, optional art layer

LEVEL {n}                                {timestamp}
```

### Username bar shape
Apply to the header element:
```css
clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%);
```
The right end tapers to a point at mid-height (ribbon/chevron shape).

### Header types
- **Standard solid** (most frames): `background: frame.headerColor`
- **Animated** (APEX only): animated shimmer using `@keyframes` gradient shift
- **Textured** (Sovereign only): solid color + subtle SVG/CSS pattern overlay at low opacity

### Body
- Background always: `#0A0008`
- Border: `1px solid frame.accentColor`
- Optional glow on Legendary: `box-shadow: 0 0 10px {accentColor}66` (inset or outer)
- Body art: absolute positioned layer, `z-index: 0`, message text `z-index: 1`

### Below the body (NOT inside it)
```
<div class="frame-footer">
  <span class="frame-level">LEVEL {level}</span>
  <span class="frame-timestamp">{timestamp}</span>
</div>
```
Both in dim grey (`#555`), small font (~10px), monospace.

### Null frame (no frame equipped)
- Header: `#1A1A24` rectangle (no clip-path)
- Body: `#0A0008` with `1px solid #2A2A3A`

---

## 6. Frame Store (Gallery Page)

### Page layout
```
< Back                    [NC balance shown here]

Frame Store
{count} frames  |  ELITE  LEGENDARY         ← filter tabs

☐ Preview as others see you                  ← toggle

[LIST OF FRAME CARDS — scrollable]
```

### Per-frame card in the list
```
[USERNAME BAR — frame header]       ← frame label (ELITE / LEGENDARY) top-right
┌──────────────────────────────────────────────────┐
│  Example message in this frame         [body art]│
└──────────────────────────────────────────────────┘
LEVEL {player level}                     {current time}

Preview on Profile        {price} NC  [Buy] / [Equipped] / [Season] / [Subscription]
```

Button states (owned frames are never rendered in the store — see "Hiding purchased frames" below):
- **[Buy]** — player has enough NC, frame not owned → teal/cyan button
- **[Buy]** greyed out — player lacks NC → disabled, show "Not enough NC"
- **[Coming Soon]** — season/subscription frames not yet available → grey, no action

Equipping/unequipping owned frames happens exclusively in the **Frame Locker** (Section 10), not here.

### "Preview as others see you" toggle
When OFF (default): preview shows your own username, level, example text  
When ON: preview shows as if another player is reading your message (same visual, different label context)

### Hiding purchased frames from the store

**A frame the player already owns must NOT appear in the Frame Store listing.**  
Once purchased, it moves entirely to the player's **Frame Locker** on their profile page (see Section 10).  
The store count badge (e.g. "12 frames") must update to reflect only frames the player has not yet bought.  

Logic: when rendering store cards, filter out any frame where `frame.owned === true`.  
Do not show an "Owned" badge and keep the card — remove it from the list entirely.

**Empty store state:** If the player owns all available frames, the store list is empty. Render a full-width message:  
> "You own every frame in the store. Check back when new frames drop."  
Filter tabs still appear but show (0) counts. The NC balance and "Preview as others see you" toggle are hidden when the list is empty.

### "Preview on Profile" link
Tapping this link opens the **Profile Preview Screen** (full screen).  
This is only available in the Frame Store — it is NOT a persistent feature on the main profile page.

---

## 7. Profile Preview Screen (Store Only)

Triggered from "Preview on Profile" link in the frame card.

### Screen layout
```
< Back                    [NC balance]

┌──────────────────────────────────────────────┐
│     PREVIEWING: [FRAME NAME] — [RARITY]      │
│  ← gold bar for Legendary, grey for Elite     │
└──────────────────────────────────────────────┘

[PROFILE CARD — frame-specific design]

[Buy Frame — {price} NC]   ← sticky footer button
```

### Profile card design — rules

The profile card is a **styled identity card** unique to each frame. It is NOT the player's actual profile page — it is a cosmetic showcase card that shows how the frame themes an identity presentation.

**Consistent fields across ALL frames:**
- Player alias / username
- Title (frame name, in accent color)
- NC balance
- Level
- Location
- Status
- A short redacted bio field
- A rendered barcode (decorative)
- An abstract rank/skill visualization (radar chart or equivalent)
- A frame logo/icon with glitch animation

**What changes per frame:**
- Card outer border color = frame accent
- Card background animation = frame's body art (adapted to fill the card)
- Title field text color = frame accent
- Rank visualization fill color = frame accent
- Frame logo icon = unique per frame (see Section 4 for each logo description)
- Any thematic extras (see below)

**Thematic extras per frame:**
- **Signal Breach**: "SYSTEM BREACH" watermark diagonally across card
- **Blackout Protocol**: `[ CLASSIFIED ]` block replaces the logo; scan-line overlay across whole card
- **APEX**: gold sparkle particles animate in background; crown logo floats
- **Nova Circuit**: burst animation fires every 4s synchronized with glitch
- **Sovereign**: aurora band drift in background
- (All others): use their body art adapted as the card background)

### Glitch animation (logo/icon, all frames)
- 3 stacked SVG layers: main (accent color) + ghost-left (white, -4px X) + ghost-right (accent at 40%, +4px X)
- Fires during the darkest point of the background animation cycle
- Duration: 0.3s, 3 rapid opacity flickers
- Legendary frames get 5 flickers + a brief desaturation flash on the main logo

---

## 8. Where Frames Appear — Summary

| Surface | Frame shows? | How |
|---|---|---|
| Feed posts | ✅ | Full `ChatFrame` component wraps each post |
| Chat messages | ✅ | Same `ChatFrame` component |
| Frame Store gallery | ✅ | Compact `ChatFrame` in each card |
| Profile Preview (store) | ✅ | Full profile card with frame theme |
| Player profile page | ✅ | Frame accent themes the header zone (border, avatar ring, XP bar, active tab) |
| Other player's name in action sheet | ✅ | Mini identity badge using their frame's accent color + border |

---

## 9. Profile Page — Full Redesign

The profile page must be **redesigned from scratch** so frames look genuinely good on it, not just tinted on top of a generic layout. The current profile page (if one exists) should be replaced by the new design described below. Build this as if frames are a first-class feature of the identity system, not an afterthought.

### 9A. Layout structure

```
┌──────────────────────────────────────────────────────────────┐
│  BANNER ZONE (~120px tall, full-bleed)                       │
│  ← frame header color fills this. Body art animation plays  │
│    at 20% opacity behind the banner as ambient texture.      │
│  ┌──────────────────────────────────────────────────┐        │
│  │ [AVATAR — 72px, frame accent ring + glow]        │        │
│  │ USERNAME                 ELITE / LEGENDARY badge  │        │
│  │ @handle                  [frame name pill]        │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘

[LEVEL / XP BAR — accent color fill, full width]
  LEVEL 42  ████████████░░░░  1,240 / 2,000 XP

[STAT STRIP — inline row of key values]
  DC ●  NC ●  M ●  (wallets, no accent override — own colors)
  Wins | Losses | Crimes | Rep  (in accent color labels)

[ TABS: OVERVIEW  |  STATS  |  FRAMES  |  HISTORY ]
           ↑ active tab underline = accent color

[TAB CONTENT — scrollable]
```

### 9B. Banner zone rules

- **Background fill**: Apply the full `frame.headerVariant` — not just the solid color:
  - `solid` → `background: frame.headerColor` (most frames)
  - `animated-shimmer` (APEX only) → reproduce the animated gold shimmer in the banner zone at full intensity
  - `textured-weave` (Sovereign only) → reproduce the herringbone overlay on `#4B0082` in the banner zone
  If no frame equipped: `#1A1A24` flat.
- **Body art ambient layer**: the equipped frame's body art animation renders here at **20% opacity**, acting as atmospheric texture behind the username block. Clip it to the banner zone — it must not bleed below.
- **Avatar ring**: `border: 3px solid frame.accentColor` + `box-shadow: 0 0 10px {accentColor}55`
- **Rarity badge**: small pill tag next to the username. "ELITE" in `#FFD700` or "LEGENDARY" in `#FF4FA3`. No frame = no badge.
- **Frame name pill**: small rounded label showing the equipped frame's name, in `frame.accentColor` text on a dark tinted background. Tapping it jumps to the Frames tab.

### 9C. XP bar

```css
.xp-bar-fill { background: frame.accentColor; }
.xp-bar-track { background: #1A1A24; }
```

No frame equipped → fill stays default accent (`#3A3A5C`).

### 9D. Stat strip & section cards

- Wallet rows (DC, NC, M): keep their own currency colors. **Never** override these with frame accent.
- Stat label text (Wins, Losses, Rep, etc.): use `frame.accentColor` for the label, white for the value.
- Section card left-border bars: `border-left: 3px solid frame.accentColor`.
- All other data colors (health bars, energy, nerve, combat numbers): keep their own colors unchanged.

### 9E. No-frame fallback

When a player has no frame equipped, the profile must still look complete and intentional:
- Banner: `#1A1A24` flat dark
- Avatar ring: `#2A2A3A` thin border
- No rarity badge, no frame name pill
- XP bar: default dim accent `#3A3A5C`
- All section borders: `#2A2A3A`

---

## 10. Frame Locker (Frames Tab on Profile)

The profile has a **Frames** tab. This is where all frames the player owns live, and where they equip or unequip them.

### Tab layout

```
[ TABS: OVERVIEW  |  STATS  |  FRAMES  |  HISTORY ]
                              ↑ this tab

EQUIPPED                              [Go to Frame Store →]
┌──────────────────────────────────────────────────┐
│  [Full ChatFrame preview — username + example    │
│   message — with full body art animation]        │
│  APEX                           LEGENDARY        │
│                         [Unequip]                │
└──────────────────────────────────────────────────┘

MY COLLECTION  ({n} frames)
┌───────────┐ ┌───────────┐ ┌───────────┐
│ [frame    │ │ [frame    │ │ [frame    │
│  preview  │ │  preview  │ │  preview  │
│  card]    │ │  card]    │ │  card]    │
│ Neon Drift│ │Grid Static│ │ Sovereign │
│  ELITE    │ │  ELITE    │ │LEGENDARY  │
│ [Equip]   │ │ [Equip]   │ │ [Equip]  │
└───────────┘ └───────────┘ └───────────┘

(scrollable grid — 2 columns on mobile, 3 on wider screens)
```

### Equipped block (top of Frames tab)

- Shows a **full-size** `ChatFrame` preview of the currently equipped frame — full animation playing, the player's own username and level rendered inside it.
- Below the preview: frame name + rarity label.
- **[Unequip]** button: secondary/ghost style. Pressing it removes the frame — player reverts to the null frame. No confirmation dialog needed.
- If no frame is currently equipped: show a placeholder card ("No frame equipped — browse the store") with a link to the Frame Store.

### Collection grid (below equipped block)

- Shows **every frame the player owns**, excluding the currently equipped one (it's already shown above).
- Each collection card is a **compact `ChatFrame` preview** (`size="preview"`) showing the frame's header and body with body art animating.
- Below each card: frame name, rarity badge, and **[Equip]** button.
- **[Equip]** button: accent-color style. Pressing it immediately equips that frame — the Equipped block at the top updates instantly (no page reload). The previously equipped frame drops back into the collection grid.
- Collection is sorted: Legendary frames first, then Elite, then alphabetically within each tier.

### [Go to Frame Store →] link

Top-right of the Frames tab. Links to the Frame Store. Always visible even if the player owns all frames.

---

## 10. Frame Data Shape

```ts
type Rarity = 'elite' | 'legendary'

type BodyArt =
  | 'none'
  | 'speed-lines'
  | 'data-grid'
  | 'smoke-particles'
  | 'thermal-heat'
  | 'glitch-tears'
  | 'lantern-drift'
  | 'chrome-shimmer'
  | 'void-stars'
  | 'gold-sparkles'
  | 'code-rain'
  | 'nova-burst'
  | 'aurora-sovereign'

type HeaderVariant = 'solid' | 'animated-shimmer' | 'textured-weave'

interface Frame {
  id: string
  name: string                    // e.g. "Neon Drift", "APEX"
  rarity: Rarity
  description: string             // 1-line flavour text shown in the store

  // Visual
  headerVariant: HeaderVariant
  headerColor: string             // hex
  accentColor: string             // hex — border, profile accents
  textOnHeader: 'white' | 'dark'
  bodyArt: BodyArt

  // Profile card
  logoComponent: string           // name of the SVG logo component
  profileBgAnimation: BodyArt    // usually same as bodyArt

  // Commerce
  priceNC: number                 // cost in NC
  owned: boolean
  equipped: boolean
  availableVia: ('nc-purchase' | 'season-pass' | 'subscription')[]
}
```

---

## 11. Frame Component API

```tsx
// One shared component — used everywhere
interface ChatFrameProps {
  frame: Frame | null
  username: string
  level: number
  timestamp?: string
  size?: 'full' | 'preview'    // preview = gallery card compact size
  children: React.ReactNode
}
```

Build one component file. Import the body art sub-components from a `/frame-art/` directory. Do not inline all the animation logic into the main component.

---

## 12. Copyright & Originality Rules

- Frame **names** are original to DRIFT — none match the reference game
- Frame **visual designs** must not resemble the reference game's frames
- The **profile card layout** (fields, barcode, radar) is a common cyberpunk dossier trope — acceptable. The specific logo designs and backgrounds must be original.
- The **animation types** (sweep reveals, particles, glitch) are common UI patterns — acceptable. The specific colors and artwork are original to DRIFT.
- Do not use: circuit board PCB traces, bunny/kitty character art, diagonal candy-cane stripes, or any other directly lifted element from the reference game.

---

## 13. Build Order

1. Delete existing frames (data + components)
2. Build the `ChatFrame` component shell (header + body + footer)
3. Build body art sub-components one at a time (start with `speed-lines` and `data-grid` — simplest)
4. Seed the 12 frames above with their data
5. Wire `ChatFrame` into Feed/Chat (replace current hardcoded gradients)
6. Build the Frame Store page (gallery cards + filter tabs + NC balance display)
   - **Filter out owned frames** from the listing (`frame.owned === true` → not rendered)
   - Update the frame count badge to reflect unowned frames only
7. Add "Preview on Profile" → Profile Preview Screen (store-only)
8. **Redesign the Profile page** (Section 9):
   a. Build the banner zone with frame header color + ambient body art layer
   b. Apply avatar ring, rarity badge, frame name pill
   c. Build the XP bar with accent color fill
   d. Apply section card left-border accents
   e. Build the no-frame fallback state
9. **Build the Frames tab** on the Profile page (Section 10):
   a. Equipped block — full ChatFrame preview + [Unequip] button
   b. Collection grid — compact ChatFrame cards + [Equip] buttons
   c. Wire equip/unequip actions so the banner zone updates instantly (no reload)
   d. [Go to Frame Store →] link
10. Add the context action sheet identity badge (uses frame accent)
