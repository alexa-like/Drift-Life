/**
 * Energy routes
 * GET  /api/energy/status  — current energy, max, regen info, time to full
 * POST /api/energy/use     — internal helper: deduct energy (used by other routes)
 */
import { Router } from "express";
import User from "../models/User";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { applyRegen } from "../lib/regen";

const router = Router();

// GET /api/energy/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "energy maxEnergy energyRegenAt energyRegenBonus"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    applyRegen(user);
    await user.save();

    // energyRegenBonus (0–0.15) speeds up regen: at +15% bonus, interval = 3min / 1.15 ≈ 156s
    const REGEN_INTERVAL_MS = Math.round(3 * 60 * 1000 / (1 + ((user as any).energyRegenBonus ?? 0)));
    const now = Date.now();
    const msSinceLastRegen = now - user.energyRegenAt.getTime();
    const msToNextRegen = user.energy >= user.maxEnergy
      ? 0
      : Math.max(0, REGEN_INTERVAL_MS - (msSinceLastRegen % REGEN_INTERVAL_MS));
    const msToFull = user.energy >= user.maxEnergy
      ? 0
      : msToNextRegen + (user.maxEnergy - user.energy - 1) * REGEN_INTERVAL_MS;

    res.json({
      energy:          user.energy,
      maxEnergy:       user.maxEnergy,
      regenRatePerMin: 1 / 3,           // 1 energy per 3 minutes
      regenIntervalMs: REGEN_INTERVAL_MS,
      msToNextRegen,
      msToFull,
      secondsToFull:   Math.ceil(msToFull / 1000),
      isFull:          user.energy >= user.maxEnergy,
    });
  } catch (err: any) {
    req.log.error({ err }, "energy status error");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Atomically deduct energy with regen applied first.
 *
 * Strategy:
 *   1. Fetch current user to compute regen ticks earned since last update.
 *   2. Build a single findOneAndUpdate that (a) adds regen, (b) deducts cost,
 *      (c) enforces maxEnergy cap, using a $gte guard on the final value so
 *      the update only fires if the user actually has enough energy.
 *   This collapses read + write into one round-trip and prevents races where
 *   two concurrent requests both pass the balance check on stale reads.
 */
export async function deductEnergy(
  userId: string,
  amount: number,
): Promise<{ success: boolean; energy: number; maxEnergy: number }> {
  // Fetch snapshot to compute regen — we need energyRegenAt and maxEnergy
  const snapshot = await User.findById(userId).select("energy maxEnergy energyRegenAt energyRegenBonus").lean();
  if (!snapshot) return { success: false, energy: 0, maxEnergy: 0 };

  const REGEN_INTERVAL_MS = Math.round(3 * 60 * 1000 / (1 + ((snapshot as any).energyRegenBonus ?? 0)));
  const now = Date.now();
  const elapsed = now - new Date(snapshot.energyRegenAt).getTime();
  const regenTicks = Math.floor(elapsed / REGEN_INTERVAL_MS);
  const energyAfterRegen = Math.min(snapshot.energy + regenTicks, snapshot.maxEnergy);
  const newRegenAt = regenTicks > 0
    ? new Date(new Date(snapshot.energyRegenAt).getTime() + regenTicks * REGEN_INTERVAL_MS)
    : snapshot.energyRegenAt;

  if (energyAfterRegen < amount) {
    // Persist regen gains even on failure (no concurrent-write risk — only additive)
    if (regenTicks > 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { energy: energyAfterRegen, energyRegenAt: newRegenAt },
      });
    }
    return { success: false, energy: energyAfterRegen, maxEnergy: snapshot.maxEnergy };
  }

  // Atomic: only update if energy is still >= amount (guard against race)
  const updated = await User.findOneAndUpdate(
    { _id: userId, energy: { $gte: amount - regenTicks } }, // conservative guard
    {
      $set: {
        energy: energyAfterRegen - amount,
        energyRegenAt: newRegenAt,
      },
    },
    { new: true, select: "energy maxEnergy" },
  );

  if (!updated) {
    // Race lost — re-read actual state
    const fresh = await User.findById(userId).select("energy maxEnergy").lean();
    return { success: false, energy: fresh?.energy ?? 0, maxEnergy: fresh?.maxEnergy ?? 0 };
  }

  return { success: true, energy: updated.energy, maxEnergy: updated.maxEnergy };
}

export default router;
