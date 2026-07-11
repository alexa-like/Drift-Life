---
name: DriftLife Giveaway Tier 6 — Vanta Anti-Abuse Enforcement
description: How giveaway alt-farming detection was wired to reuse the existing IP-overlap signal and enforce underReview immediately.
---

## Reused the existing alt-account signal, not a new one
`giveaway_alt_farming` detection reuses the exact same signal as auth.ts's login-time `alt_account` check: `User.lastLoginIp` + `User.loginIpHistory` overlap between two accounts. No new tracking field was added — `lib/giveawayAltFarming.ts` just compares IP sets between the entering user and every other entrant already on the same giveaway.

## Enforcement is immediate, not log-only
On any IP overlap between two entrants of the same giveaway, BOTH accounts get `underReview: true` + a specific `underReviewReason` set synchronously (before the Vanta log write), not gated behind staff review. This closes the loop with Tier 4's entry route, which already rejects any `underReview` account.

## No "claim winnings" step exists to gate
This giveaway system auto-distributes winnings at resolution (no separate claim action) — so the only voluntary user action to gate is entry itself. A user validly entered before being flagged still receives their share if the giveaway later resolves; `underReview` only blocks *future* entries. Documented in `resolveGiveaway.ts`'s docblock so this isn't mistaken for a gap later.

## No staff dashboard changes needed
`routes/vanta.ts` and the owner-panel Vanta UI render `trigger` as a raw string with no hardcoded label map — adding `"giveaway_alt_farming"` to the `VantaTrigger` enum was sufficient for it to show up correctly, no UI changes required.
