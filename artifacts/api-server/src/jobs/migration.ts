/**
 * One-time migration jobs — run once on redeploy, then never again.
 *
 * Job 1: Merit → DC  (1 Merit = 10 DC)
 *   - Finds all users with merit > 0
 *   - Adds merit * 10 to their DC (atomic, capped at WALLET_CAP)
 *   - Zeroes out merit
 *   - Sends inbox notification
 *
 * Job 2: Legacy Item → DC refund
 *   - Finds all Item documents
 *   - Converts to DC by rarity: common=50, uncommon=150, rare=500, epic=1500, legendary=5000
 *   - Adds DC to owner (atomic)
 *   - Deletes the items
 *   - Sends grouped inbox notification per player
 *
 * Job 3: Clear legacy equipment slots
 *   - Clears equippedWeapon/Armor/Clothing/Vehicle from all users
 *
 * Each job is idempotent by design:
 *   - Merit job: merit=0 users are skipped automatically
 *   - Item job: items are deleted after processing; re-run finds nothing
 *   - Equipment clear: setting null is always safe
 *
 * Usage: POST /api/admin/migration/run  (requireOwner middleware)
 */

import User, { WALLET_CAP } from "../models/User";
import Item from "../models/Item";
import Notification from "../models/Notification";
import { logger } from "../lib/logger";
import mongoose from "mongoose";

const ITEM_RARITY_DC: Record<string, number> = {
  common:    50,
  uncommon:  150,
  rare:      500,
  epic:      1_500,
  legendary: 5_000,
  mythic:    10_000,
  event:     500,
};

export interface MigrationResult {
  meritMigration: {
    usersProcessed: number;
    totalDcGranted:  number;
  };
  itemRefund: {
    itemsRemoved:   number;
    usersRefunded:  number;
    totalDcGranted: number;
  };
  legacyCarRefund: {
    carsRemoved:    number;
    usersRefunded:  number;
    totalDcGranted: number;
  };
  equipmentCleared: {
    usersUpdated: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runMeritMigration(): Promise<{ usersProcessed: number; totalDcGranted: number }> {
  logger.info("Migration: starting merit → DC job");

  const users = await User.find({ merit: { $gt: 0 } }).select("_id username merit dc");
  let usersProcessed = 0;
  let totalDcGranted = 0;

  for (const user of users) {
    const merit = user.merit ?? 0;
    const dcGain = merit * 10;
    if (dcGain <= 0) continue;

    // Single atomic update: cap final dc at WALLET_CAP, zero out merit
    const currentDc = user.dc ?? 0;
    const toAdd = Math.min(dcGain, WALLET_CAP - currentDc);
    if (toAdd > 0) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { dc: toAdd },
        $set: { merit: 0 },
      });
    } else {
      await User.findByIdAndUpdate(user._id, { $set: { merit: 0 } });
    }

    // Notify player
    await Notification.create({
      userId: user._id,
      type:   "system",
      message: `⚙️ Merit has been retired. Your ${merit.toLocaleString()} Merit was converted to ${dcGain.toLocaleString()} DC and added to your wallet.`,
    }).catch(() => {});

    usersProcessed++;
    totalDcGranted += dcGain;
  }

  logger.info({ usersProcessed, totalDcGranted }, "Migration: merit → DC complete");
  return { usersProcessed, totalDcGranted };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runItemRefundMigration(): Promise<{
  itemsRemoved: number;
  usersRefunded: number;
  totalDcGranted: number;
}> {
  logger.info("Migration: starting legacy item → DC refund job");

  // Group items by owner
  const items = await Item.find({}).select("owner name rarity quantity basePrice");
  const byOwner: Record<string, { userId: any; lines: string[]; totalDc: number }> = {};

  for (const item of items) {
    const ownerId = String(item.owner);
    if (!byOwner[ownerId]) {
      byOwner[ownerId] = { userId: item.owner, lines: [], totalDc: 0 };
    }
    const perUnit = ITEM_RARITY_DC[item.rarity] ?? 50;
    const qty     = Math.max(1, item.quantity ?? 1);
    const dc      = perUnit * qty;
    byOwner[ownerId].lines.push(`• ${item.name} ×${qty} → ${dc.toLocaleString()} DC`);
    byOwner[ownerId].totalDc += dc;
  }

  let itemsRemoved   = items.length;
  let usersRefunded  = 0;
  let totalDcGranted = 0;

  for (const entry of Object.values(byOwner)) {
    const owner = await User.findById(entry.userId).select("dc");
    if (!owner) continue;

    const toAdd = Math.min(entry.totalDc, WALLET_CAP - (owner.dc ?? 0));
    if (toAdd > 0) {
      await User.findByIdAndUpdate(entry.userId, { $inc: { dc: toAdd } });
    }

    const summary = entry.lines.join("\n");
    await Notification.create({
      userId: entry.userId,
      type:   "system",
      message: `⚙️ Your old items have been converted to DC as part of a game update:\n\n${summary}\n\nTotal received: ${entry.totalDc.toLocaleString()} DC`,
    }).catch(() => {});

    usersRefunded++;
    totalDcGranted += entry.totalDc;
  }

  // Delete all legacy items after processing
  await Item.deleteMany({});

  logger.info({ itemsRemoved, usersRefunded, totalDcGranted }, "Migration: item refund complete");
  return { itemsRemoved, usersRefunded, totalDcGranted };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runEquipmentClearMigration(): Promise<{ usersUpdated: number }> {
  logger.info("Migration: clearing legacy equipment slots");

  const result = await User.updateMany(
    {
      $or: [
        { equippedWeapon:   { $ne: null } },
        { equippedArmor:    { $ne: null } },
        { equippedClothing: { $ne: null } },
        { equippedVehicle:  { $ne: null } },
      ],
    },
    {
      $set: {
        equippedWeapon:   null,
        equippedArmor:    null,
        equippedClothing: null,
        equippedVehicle:  null,
      },
    },
  );

  const usersUpdated = result.modifiedCount;
  logger.info({ usersUpdated }, "Migration: equipment clear complete");
  return { usersUpdated };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Job 4: Legacy Car → DC refund (retiring the old open-world street-racing
 * Car model in favor of the new RaceCar/PlayerGarage mini-game system).
 *   - Finds all legacy Car documents
 *   - Converts each to DC based on its tuned stats: (power+handling+grip+nitro) * 50
 *   - Adds DC to owner (atomic, capped at WALLET_CAP)
 *   - Deletes the cars, clears User.cars/activeCar
 *   - Sends grouped inbox notification per player
 * Idempotent: cars are deleted after processing; re-run finds nothing.
 */
export async function runLegacyCarRefundMigration(): Promise<{
  carsRemoved: number;
  usersRefunded: number;
  totalDcGranted: number;
}> {
  logger.info("Migration: starting legacy car → DC refund job");

  // Lazy import — the Car model is being retired; keep the dependency
  // isolated to this migration so the rest of the codebase never imports it.
  let Car: mongoose.Model<any>;
  try {
    Car = (await import("../models/Car")).default;
  } catch {
    logger.info("Migration: legacy Car model not present, skipping");
    return { carsRemoved: 0, usersRefunded: 0, totalDcGranted: 0 };
  }

  const cars = await Car.find({}).select("ownerId make carModel power handling grip nitro");
  const byOwner: Record<string, { userId: any; lines: string[]; totalDc: number }> = {};

  for (const car of cars) {
    const ownerId = String(car.ownerId);
    if (!byOwner[ownerId]) byOwner[ownerId] = { userId: car.ownerId, lines: [], totalDc: 0 };
    const dc = Math.round(((car.power ?? 0) + (car.handling ?? 0) + (car.grip ?? 0) + (car.nitro ?? 0)) * 50);
    byOwner[ownerId].lines.push(`• ${car.make} ${car.carModel} → ${dc.toLocaleString()} DC`);
    byOwner[ownerId].totalDc += dc;
  }

  let usersRefunded  = 0;
  let totalDcGranted = 0;
  const carsRemoved  = cars.length;

  for (const entry of Object.values(byOwner)) {
    const owner = await User.findById(entry.userId).select("dc");
    if (!owner) continue;

    const toAdd = Math.min(entry.totalDc, WALLET_CAP - (owner.dc ?? 0));
    if (toAdd > 0) {
      await User.findByIdAndUpdate(entry.userId, { $inc: { dc: toAdd } });
    }

    const summary = entry.lines.join("\n");
    await Notification.create({
      userId: entry.userId,
      type:   "system",
      message: `🚗 The old garage system has been retired. Your cars were converted to DC:\n\n${summary}\n\nTotal received: ${entry.totalDc.toLocaleString()} DC\n\nVisit the new Garage to claim cars from the Royale wheel!`,
    }).catch(() => {});

    usersRefunded++;
    totalDcGranted += entry.totalDc;
  }

  await Car.deleteMany({});
  await User.updateMany({}, { $set: { cars: [], activeCar: null } });

  logger.info({ carsRemoved, usersRefunded, totalDcGranted }, "Migration: legacy car refund complete");
  return { carsRemoved, usersRefunded, totalDcGranted };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runAllMigrations(): Promise<MigrationResult> {
  // Run wallet-affecting jobs sequentially to prevent concurrent DC mutations
  // on the same users from racing past the wallet cap.
  const meritMigration    = await runMeritMigration();
  const itemRefund        = await runItemRefundMigration();
  const legacyCarRefund   = await runLegacyCarRefundMigration();
  // Equipment clear has no wallet side-effects — safe to run anytime
  const equipmentCleared  = await runEquipmentClearMigration();
  return { meritMigration, itemRefund, legacyCarRefund, equipmentCleared };
}
