/**
 * Business passive-income background worker.
 *
 * Runs every 5 minutes. For every open business with at least one active
 * employee it computes the income earned since the last tick and atomically
 * adds it to `accumulatedIncome`, then resets `lastIncomeAt` to now.
 *
 * An optimistic-lock filter (`lastIncomeAt: <last known value>`) prevents
 * double-counting if two server instances somehow race.
 *
 * Handler "daily reports": if a business has an active handler and 24 hours
 * have passed since `lastDailyReportAt`, a notification is sent to the owner
 * with a performance summary.
 */

import Business, { BUSINESS_DEFS } from "../models/Business";
import Notification from "../models/Notification";
import { logger } from "./logger";

const MAX_HOURS = 168; // 7-day income cap

export async function tickBusinessIncome(): Promise<void> {
  try {
    const now = new Date();

    const businesses = await Business.find({
      isOpen: true,
      "employees.status": "active",
    })
      .select(
        "type employees accumulatedIncome lastIncomeAt lastDailyReportAt " +
        "createdAt maxEmployees ownerId effectiveness popularity environment " +
        "wagePerShift name starLevel"
      )
      .lean();

    if (businesses.length === 0) return;

    const incomeUpdates:  Promise<unknown>[] = [];
    const reportPromises: Promise<unknown>[] = [];

    for (const biz of businesses) {
      const def = BUSINESS_DEFS[biz.type as keyof typeof BUSINESS_DEFS];
      if (!def) continue;

      const activeEmps = (biz.employees as any[]).filter(
        (e) => e.status === "active"
      );
      const activeCount = activeEmps.length;
      if (activeCount === 0) continue;

      // ── Passive income ────────────────────────────────────────────────────
      const since       = biz.lastIncomeAt ?? biz.createdAt;
      const msElapsed   = now.getTime() - new Date(since).getTime();
      const hoursElapsed = Math.min(msElapsed / 3_600_000, MAX_HOURS);
      if (hoursElapsed < 1 / 60) continue; // less than 1 minute elapsed

      // Apply multipliers (same formula as calcPendingIncome in routes)
      const effMult = 0.5 + ((biz as any).effectiveness ?? 100) / 200;
      const popMult = 1.0 + Math.max(10, (biz as any).popularity ?? 50) / 200;
      const envMult = 0.67 + (((biz as any).environment ?? 100) / 100) * 0.33;

      const income = Math.floor(
        hoursElapsed * def.ownerBaseIncome * activeCount * effMult * popMult * envMult
      );
      if (income < 1) continue;

      const maxAccumulated = def.ownerBaseIncome * biz.maxEmployees * MAX_HOURS;

      incomeUpdates.push(
        Business.findOneAndUpdate(
          { _id: biz._id, lastIncomeAt: biz.lastIncomeAt ?? null },
          [
            {
              $set: {
                accumulatedIncome: {
                  $min: [maxAccumulated, { $add: ["$accumulatedIncome", income] }],
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

      // ── Handler daily intel report ─────────────────────────────────────────
      const hasHandler = activeEmps.some(
        (e) =>
          (e.jobPosition === "handler" || e.jobPosition === "secretary") &&
          e.lastShiftAt &&
          now.getTime() - new Date(e.lastShiftAt).getTime() < def.shiftCooldownMin * 60_000 * 6
      );

      if (hasHandler) {
        const lastReport   = biz.lastDailyReportAt ? new Date(biz.lastDailyReportAt) : null;
        const hoursSinceReport = lastReport
          ? (now.getTime() - lastReport.getTime()) / 3_600_000
          : Infinity;

        if (hoursSinceReport >= 24) {
          const effectiveness = (biz as any).effectiveness ?? 100;
          const environment   = (biz as any).environment   ?? 100;
          const popularity    = (biz as any).popularity    ?? 50;

          const effGrade = effectiveness >= 80 ? "🟢 Optimal" : effectiveness >= 50 ? "🟡 Moderate" : "🔴 Critical";
          const envGrade = environment   >= 80 ? "🟢 Clean"   : environment   >= 50 ? "🟡 Fair"     : "🔴 Hazardous";
          const popGrade = popularity    >= 70 ? "🟢 Hot"     : popularity    >= 40 ? "🟡 Steady"   : "🔴 Dying";

          const reportMsg =
            `📋 Handler Intel Report — ${biz.name}\n` +
            `Crew on deck: ${activeCount}/${biz.maxEmployees}\n` +
            `Efficiency  : ${effectiveness}% ${effGrade}\n` +
            `Environment : ${environment}% ${envGrade}\n` +
            `Reputation  : ${popularity}% ${popGrade}\n` +
            `Est. income : ${income.toLocaleString()} DC this tick\n` +
            `——\nKeep your crew active to maintain efficiency.`;

          reportPromises.push(
            Notification.create({
              userId:  biz.ownerId,
              type:    "system",
              message: reportMsg,
            })
              .then(() =>
                Business.updateOne(
                  { _id: biz._id },
                  { $set: { lastDailyReportAt: now } }
                )
              )
              .catch((err: unknown) =>
                logger.warn({ err, bizId: biz._id }, "handler report failed")
              )
          );
        }
      }
    }

    await Promise.all([...incomeUpdates, ...reportPromises]);

    const tickedCount = incomeUpdates.length;
    if (tickedCount > 0) {
      logger.info(
        { ticked: tickedCount, of: businesses.length },
        "Business income tick complete"
      );
    }
  } catch (err) {
    logger.error({ err }, "tickBusinessIncome error");
  }
}
