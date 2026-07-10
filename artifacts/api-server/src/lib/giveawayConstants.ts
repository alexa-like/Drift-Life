/**
 * giveawayConstants.ts — §2.3 Anti-abuse limits
 *
 * Validation constants for the giveaway creation route (Tier 3).
 * All limits are enforced server-side; the API rejects any request that violates them.
 *
 * These values are conservative defaults chosen to prevent spam and economy exploits
 * while still allowing meaningful giveaway activity. They are NOT owner-configurable
 * (only giveawayDraftLifetimeMs is tunable via the Owner panel — §1.4).
 */

/**
 * Minimum total DC-equivalent pledge value required to create a giveaway.
 *
 * Set to 1,000 DC — roughly the cost of a common NPC-shop item. This prevents
 * trivial or empty-value giveaways that would clutter the Feed without providing
 * real value to participants.
 */
export const MIN_PLEDGE_VALUE_DC = 1_000;

/**
 * Maximum number of concurrent open (draft or live) giveaways per host.
 *
 * Set to 2. Allows a host to have one live giveaway and one in draft simultaneously,
 * but prevents flooding the Feed or locking up large amounts of escrow.
 * Query uses the { host: 1, status: 1 } index from Tier 1.
 */
export const MAX_CONCURRENT_OPEN_GIVEAWAYS_PER_HOST = 2;

/**
 * Maximum number of entrants a host may set as the cap for a giveaway.
 *
 * Set to 500. High enough for large community events; low enough that the
 * resolution worker (Tier 5) can distribute rewards without memory pressure.
 * The host MUST choose a cap — "unlimited" is not a valid option anywhere in
 * the API surface.
 */
export const MAX_ENTRANT_CAP = 500;

/**
 * Maximum live duration for any giveaway, in milliseconds.
 *
 * 3 days — hardcoded per spec (Appendix A). NOT owner-configurable.
 * The owner-configurable setting (§1.4) covers draft lifetime only.
 */
export const MAX_LIVE_DURATION_MS = 3 * 24 * 60 * 60 * 1_000; // 259_200_000 ms
