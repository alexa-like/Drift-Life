/**
 * Business passive-income background worker.
 *
 * Runs every 5 minutes. For every open business with at least one active
 * employee, it computes the income earned since the last tick and atomically
 * adds it to `accumulatedIncome`, then resets `lastIncomeAt` to now.
 *
 * An optimistic-lock filter (`lastIncomeAt: <last known value>`) prevents
 * double-counting if two server instances somehow race.
 *
 * The POST /businesses/collect endpoint must collect
 *   business.accumulatedIncome  (prior ticks)
 *   + calcPendingIncome(business, activeCount)  (since last tick)
 * to capture any income that arrived between ticks.
 */

import Business, { BUSINESS_DEFS } from "../models/Business";
import { logger } from "./logger";

const MAX_HOURS = 168; // 7-day income cap

export async function tickBusinessIncome(): Promise<void> {
  try {
    const now = new Date();

    const businesses = await Business.find({
      isOpen: true,
      "employees.status": "active",
    })
      .select("type employees accumulatedIncome lastIncomeAt createdAt maxEmployees")
      .lean();

    if (businesses.length === 0) return;

    const updates: Promise<unknown>[] = [];

    for (const biz of businesses) {
      const def = BUSINESS_DEFS[biz.type as keyof typeof BUSINESS_DEFS];
      if (!def) continue;

      const activeCount = (biz.employees as any[]).filter(
        (e) => e.status === "active"
      ).length;
      if (activeCount === 0) continue;

      const since = biz.lastIncomeAt ?? biz.createdAt;
      const msElapsed = now.getTime() - new Date(since).getTime();
      const hoursElapsed = Math.min(msElapsed / 3_600_000, MAX_HOURS);
      // Skip if less than 1 minute has elapsed (avoids rounding to 0 DC)
      if (hoursElapsed < 1 / 60) continue;

      const income = Math.floor(hoursElapsed * def.ownerBaseIncome * activeCount);
      if (income < 1) continue;

      // Cap: 7 days of income at max employees
      const maxAccumulated = def.ownerBaseIncome * biz.maxEmployees * MAX_HOURS;

      updates.push(
        Business.findOneAndUpdate(
          {
            _id: biz._id,
            // Optimistic lock: only update if nobody else already ticked this biz
            lastIncomeAt: biz.lastIncomeAt ?? null,
          },
          [
            {
              $set: {
                accumulatedIncome: {
                  $min: [
                    maxAccumulated,
                    { $add: ["$accumulatedIncome", income] },
                  ],
                },
                lastIncomeAt: now,
              },
            },
          ],
          { returnDocument: "after" }
        ).catch((err: unknown) =>
          logger.debug({ err, bizId: biz._id }, "income tick skipped (race/stale)")
        )
      );
    }

    await Promise.all(updates);

    if (updates.length > 0) {
      logger.info(
        { ticked: updates.length, of: businesses.length },
        "Business income tick complete"
      );
    }
  } catch (err) {
    logger.error({ err }, "tickBusinessIncome error");
  }
}
