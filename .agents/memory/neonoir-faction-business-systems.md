---
name: Neonoir Faction & Business Systems (Torn-style)
description: Full feature map of implemented faction upgrades/OC and business environment/job-positions systems
---

# Faction System (Torn.com-style)

## Models
- `Faction.ts` — has `upgrades: string[]` field for purchased upgrade IDs
- `FactionCrime.ts` — new model for faction organized crimes (separate from `GangCrime` which is for Guilds)

## Routes (all under /api/factions/)
- `GET /upgrades` — catalog + purchased upgrades + treasury
- `POST /upgrades/buy` — atomically deduct treasury, add upgrade, apply capacity side effects
- `GET /crimes` — active + recent crimes with enriched participant usernames
- `POST /crimes/start` — start OC (leaders/officers only, checks faction level)
- `POST /crimes/:id/join` — join gathering crime
- `POST /crimes/:id/commit` — commit energy (triggers in_progress when all committed + enough members)
- `POST /crimes/:id/resolve` — collect results (payout + respect to faction)
- `DELETE /crimes/:id/cancel` — cancel gathering crime

## Upgrade Catalog (11 upgrades, 4 categories)
- **Capacity**: capacity_1 (+10 members, 500k), capacity_2 (+15, 2M), capacity_3 (+20, 5M)
- **Crime**: crime_payout_1 (+15% OC payout), crime_payout_2 (+30%), crime_success_1 (-10% fail rate), crime_cooldown_1 (-20% cooldown)
- **Training**: training_1 (+5% gym gains), training_2 (+10% gym gains)
- **Intel**: intel_1 (+5% crime success), intel_2 (-10% hacking cooldown)
- Upgrade effects applied at resolve time (payout mults, fail rate reduction)

## OC Crime Types (5 tiers)
1. midnight_carjacking: 2-3 members, 20min, 10k-30k DC, +50 respect (level 1)
2. data_center_breach: 2-4 members, 45min, 25k-70k DC, +100 respect (level 2)
3. protection_racket: 3-5 members, 60min, 40k-100k DC, +175 respect (level 3)
4. syndicate_heist: 4-6 members, 90min, 80k-200k DC, +300 respect (level 5)
5. corporate_blackmail: 5-6 members, 120min, 150k-400k DC, +600 respect (level 8)

## Frontend (FactionPage.tsx)
- Added "Crimes" tab and "Upgrades" tab alongside existing tabs
- Crimes tab: active operation card (join/commit/resolve/cancel actions), crime catalog to start, recent history
- Upgrades tab: catalog grouped by category, locked/owned states, treasury cost shown

# Business System (Torn-style)

## New Fields
- `Business.environment: number` (0-100) — workplace quality, affects income ×0.67–1.0
- `IBusinessEmployee.jobPosition: "production" | "manager" | "cleaner" | "secretary"` (default "production")

## Job Position Rules
- **Manager**: boosts effectiveness by 5% per active manager (max 2)
- **Cleaner**: boosts environment by 8% per active cleaner (max 2)
- **Secretary**: UI role only (max 1), no current gameplay effect beyond display
- **Production**: default; generates shift income

## Environment Calculation
- Base 70 + (active managers ×10, cap 2) + (active cleaners ×8, cap 2) − overcrowding penalty
- Overcrowding: if >60% capacity filled, penalizes up to 20 points
- Income formula: `base × employees × effMult × popMult × envMult` where envMult = 0.67 + (env/100 × 0.33)

## New Route
- `POST /businesses/employees/:userId/position` — owner assigns job position, recalculates environment

## Frontend (BusinessPage.tsx)
- 3-metric row: Efficiency / Popularity / Environment (was 2-metric)
- Environment card shows mult effect and tooltip about managers/cleaners
- Each active employee card now shows role badge + role selector buttons
- Legend below employee list explains each role's effect and limits

# Important Architecture Note
- **Gang system** (GangCrime, GangWar, GangUpgrade) is connected to `Guild` model (legacy)
- **Faction system** (FactionCrime, factions.ts upgrades) is connected to `Faction` model (current)
- These are two separate parallel systems — don't confuse them
