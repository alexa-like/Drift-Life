---
name: DriftLife Item Model
description: Item bonus field naming — prevents stale field names causing TS errors in frontend and backend
---

Items use the NEW stat bonus fields introduced during the Phase 1 rebuild. Using the old `damage`/`defense` fields causes TS2339 errors everywhere.

**Correct fields:**
- `strengthBonus` — replaces old `damage`
- `defenseBonus` — replaces old `defense`
- `charismaBonus`
- `intelligenceBonus`
- `streetCredBonus`
- `travelEnergyReduction`

**Why:** Schema was redesigned to align with the new User stat model (strength, charisma, intelligence, streetCred) instead of the simpler damage/defense model.

**How to apply:** Any frontend or backend code referencing `item.damage` or `item.defense` must be changed to `item.strengthBonus` and `item.defenseBonus`.
