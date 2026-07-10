---
name: DriftLife tier-audit corrections
description: Lessons from re-verifying DRIFTLIFE_TIER_AUDIT_REPORT.md against live code — most flagged "Partial/Not Done" items were already implemented.
---

The original 10-subagent tier audit (`DRIFTLIFE_TIER_AUDIT_REPORT.md`) contained many false positives — items marked Partial/Not Done that were actually fully implemented in the live codebase (e.g. danger rolls, hospital/jail auto-release, revive, bail-for-others, double_tap combat, prestige XP boost, weekly leaderboards, Service Token payment, mentor XP bonus).

**Why:** the audit subagents likely read against an earlier code snapshot; trusting the report's status without re-verification would have caused duplicate/wasted implementation work.

**How to apply:** before implementing any item from that report (or any stale audit-style document), grep/read the current live code path first. Only implement if the gap is confirmed live. See the report's "Correction pass notes" section for the full reconciled list of what's genuinely still open (chrome_garage car-parts store, faction territory control, city enhancement items) vs. fixed vs. already-working.

Real bug found this pass: two separate seed files (`lib/arenaItemSeed.ts` vs `seeds/miniGameItems.ts`) were both unawaited-racing to seed the same `MiniGameItem` catalog on boot, causing indeterminate item stats. Always check `db.ts`'s boot sequence for duplicate/unawaited seeders when item data looks wrong.
