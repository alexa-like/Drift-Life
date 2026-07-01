/**
 * atomicRegen — helpers for truly-atomic regen+deduction in MongoDB.
 *
 * Instead of computing regen in application code (which creates a concurrent-
 * mint window when multiple requests read the same stale doc), these helpers
 * embed the regen formula directly into a findOneAndUpdate aggregation pipeline
 * so the computation and the write are a single atomic DB operation.
 *
 * Regen rates (mirrors applyRegen in models/User.ts):
 *   Energy: 1 unit per 3 min  → 180 000 ms per tick
 *   Nerve:  1 unit per 5 min  → 300 000 ms per tick
 */

// ── Regen rate constants (ms) ─────────────────────────────────────────────────
const ENERGY_TICK_MS = 180_000; // 3 min
const NERVE_TICK_MS  = 300_000; // 5 min

// ── $expr filter helpers ──────────────────────────────────────────────────────

/**
 * Returns a MongoDB $expr condition that evaluates to true when
 * (currentEnergy + regenSinceLastTick) >= energyCost.
 * Safe to use with $$NOW inside findOneAndUpdate.
 */
export function energySufficientExpr(energyCost: number): Record<string, unknown> {
  return {
    $expr: {
      $gte: [
        // effective energy after regen, capped at maxEnergy
        {
          $min: [
            "$maxEnergy",
            {
              $add: [
                "$energy",
                {
                  $max: [
                    0,
                    { $floor: { $divide: [{ $subtract: ["$$NOW", "$energyRegenAt"] }, ENERGY_TICK_MS] } },
                  ],
                },
              ],
            },
          ],
        },
        energyCost,
      ],
    },
  };
}

/**
 * Returns a MongoDB $expr condition that evaluates to true when
 * (currentNerve + regenSinceLastTick) >= nerveCost.
 */
export function nerveSufficientExpr(nerveCost: number): Record<string, unknown> {
  return {
    $expr: {
      $gte: [
        {
          $min: [
            "$maxNerve",
            {
              $add: [
                "$nerve",
                {
                  $max: [
                    0,
                    { $floor: { $divide: [{ $subtract: ["$$NOW", "$nerveRegenAt"] }, NERVE_TICK_MS] } },
                  ],
                },
              ],
            },
          ],
        },
        nerveCost,
      ],
    },
  };
}

// ── Pipeline stage builders ───────────────────────────────────────────────────

/** Builds the two-stage aggregation pipeline used inside findOneAndUpdate.
 *
 * Stage 1 — compute regen gains into temp fields _erg / _nrg.
 * Stage 2 — apply gains, deduct costs, enforce caps, set timer fields and
 *            any caller-supplied extra $set fields.
 * Stage 3 — remove temp fields.
 *
 * @param opts.energyCost  Energy to deduct (after regen). 0 = no change.
 * @param opts.energyBonus Extra energy to add (e.g. faction refund). 0 = none.
 * @param opts.nerveCost   Nerve to deduct (after regen). 0 = no change.
 * @param opts.extraSet    Additional $set fields applied in stage 2.
 */
export function buildRegenPipeline(opts: {
  energyCost?:  number;
  energyBonus?: number;
  nerveCost?:   number;
  extraSet?:    Record<string, unknown>;
}): Record<string, unknown>[] {
  const { energyCost = 0, energyBonus = 0, nerveCost = 0, extraSet = {} } = opts;
  const netEnergyDeduct = energyCost - energyBonus; // positive = costs energy

  return [
    // ── Stage 1: Compute regen deltas into temp fields ────────────────────
    {
      $set: {
        _erg: {
          $cond: [
            { $lt: ["$energy", "$maxEnergy"] },
            {
              $min: [
                { $subtract: ["$maxEnergy", "$energy"] },
                { $max: [0, { $floor: { $divide: [{ $subtract: ["$$NOW", "$energyRegenAt"] }, ENERGY_TICK_MS] } }] },
              ],
            },
            0,
          ],
        },
        _nrg: {
          $cond: [
            { $lt: ["$nerve", "$maxNerve"] },
            {
              $min: [
                { $subtract: ["$maxNerve", "$nerve"] },
                { $max: [0, { $floor: { $divide: [{ $subtract: ["$$NOW", "$nerveRegenAt"] }, NERVE_TICK_MS] } }] },
              ],
            },
            0,
          ],
        },
      },
    },
    // ── Stage 2: Apply + deduct + update timers ───────────────────────────
    {
      $set: {
        // energy: clamp to [0, maxEnergy] after regen + deduction
        energy: {
          $max: [
            0,
            {
              $min: [
                "$maxEnergy",
                { $subtract: [{ $add: ["$energy", "$_erg"] }, netEnergyDeduct] },
              ],
            },
          ],
        },
        // nerve: clamp to [0, maxNerve] after regen + deduction
        nerve: {
          $max: [
            0,
            {
              $min: [
                "$maxNerve",
                { $subtract: [{ $add: ["$nerve", "$_nrg"] }, nerveCost] },
              ],
            },
          ],
        },
        // Update regen timers only when a gain actually occurred
        energyRegenAt: { $cond: [{ $gt: ["$_erg", 0] }, "$$NOW", "$energyRegenAt"] },
        nerveRegenAt:  { $cond: [{ $gt: ["$_nrg", 0] }, "$$NOW", "$nerveRegenAt"] },
        // Caller-supplied extras (cooldowns, district, etc.)
        ...extraSet,
      },
    },
    // ── Stage 3: Remove temp fields ───────────────────────────────────────
    { $unset: ["_erg", "_nrg"] },
  ];
}
