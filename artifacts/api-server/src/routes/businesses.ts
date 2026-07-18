/**
 * Business Routes — Neonoir Underground Economy
 *
 * Owner routes:
 *   GET    /api/businesses/mine              — owner: view my business
 *   POST   /api/businesses                   — create a business
 *   POST   /api/businesses/collect           — collect accumulated passive income
 *   PATCH  /api/businesses/settings          — update wage / description / isOpen
 *   POST   /api/businesses/upgrade           — star upgrade
 *   POST   /api/businesses/advertise         — run ad campaign
 *   POST   /api/businesses/transfer          — transfer ownership to an active employee
 *   POST   /api/businesses/request-delete    — submit deletion request (support ticket)
 *   GET    /api/businesses/:id/employees     — employee roster (owner/staff only)
 *   POST   /api/businesses/:id/fire/:userId  — fire an employee
 *   POST   /api/businesses/approve/:userId   — approve a pending applicant
 *   POST   /api/businesses/employees/:userId/position — assign job position
 *
 * Employee routes:
 *   GET    /api/businesses/board             — open job board
 *   POST   /api/businesses/apply/:businessId — apply to a business
 *   GET    /api/businesses/my-job            — view my employment
 *   POST   /api/businesses/:businessId/shift — work a shift
 *   POST   /api/businesses/resign            — resign from current employer
 */

import { Router } from "express";
import mongoose, { Schema } from "mongoose";
import Business, {
  BUSINESS_DEFS,
  BUSINESS_CREATE_COST,
  BUSINESS_CREATE_LEVEL,
  JOB_POSITION_LIMITS,
  type JobPosition,
} from "../models/Business";
import User from "../models/User";
import Notification from "../models/Notification";
import SupportTicket from "../models/SupportTicket";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

// ── Inject business fields onto User schema (if not already present) ──────────
if (!(User.schema as any).paths["businessId"]) {
  User.schema.add({
    businessId:              { type: Schema.Types.ObjectId, ref: "Business", default: null },
    employerBusinessId:      { type: Schema.Types.ObjectId, ref: "Business", default: null },
    businessShiftCooldowns:  { type: Map, of: Date, default: {} },
  });
}

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Popularity decays 3 points/hr from lastAdvertAt, floor 10. */
function calcCurrentPopularity(business: any): number {
  const base = (business.popularity ?? 50) as number;
  if (!business.lastAdvertAt) return Math.max(10, base);
  const hoursSince =
    (Date.now() - new Date(business.lastAdvertAt).getTime()) / 3_600_000;
  return Math.max(10, Math.min(100, Math.round(base - hoursSince * 3)));
}

/**
 * Effectiveness (0–100):
 *   % of active non-ghost employees who worked within 3× cooldown window.
 *   Lieutenant bonus: +5% per active lieutenant (max 2).
 *   Marketer bonus:   +3% per active marketer (max 2) — they keep word-of-mouth up.
 */
function recalcEffectiveness(business: any): number {
  const active = (business.employees as any[]).filter(
    (e: any) => e.status === "active" && e.jobPosition !== "ghost" && e.jobPosition !== "cleaner"
  );
  if (active.length === 0) return 0;

  const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
  if (!def) return 100;
  const windowMs = def.shiftCooldownMin * 60_000 * 3;
  const now = Date.now();

  const recent = active.filter(
    (e: any) => e.lastShiftAt && now - new Date(e.lastShiftAt).getTime() < windowMs
  ).length;

  const lieutenants = active.filter(
    (e: any) =>
      (e.jobPosition === "lieutenant" || e.jobPosition === "manager") &&
      e.lastShiftAt &&
      now - new Date(e.lastShiftAt).getTime() < windowMs
  ).length;

  const marketers = (business.employees as any[]).filter(
    (e: any) =>
      e.status === "active" &&
      e.jobPosition === "marketer" &&
      e.lastShiftAt &&
      now - new Date(e.lastShiftAt).getTime() < windowMs * 2
  ).length;

  const lieutBoost  = Math.min(lieutenants, 2) * 5;
  const marketBoost = Math.min(marketers, 2) * 3;

  return Math.min(
    100,
    Math.round((recent / active.length) * 100) + lieutBoost + marketBoost
  );
}

/**
 * Environment (0–100):
 *   Base 70, +10 per active lieutenant (max 2), +8 per active ghost (max 2),
 *   −5 for every employee over 60% capacity.
 */
function recalcEnvironment(business: any): number {
  const allActive = (business.employees as any[]).filter(
    (e: any) => e.status === "active"
  );
  const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
  if (!def) return 100;

  const windowMs = def.shiftCooldownMin * 60_000 * 4;
  const now = Date.now();

  const activeLieutenants = allActive.filter(
    (e: any) =>
      (e.jobPosition === "lieutenant" || e.jobPosition === "manager") &&
      e.lastShiftAt &&
      now - new Date(e.lastShiftAt).getTime() < windowMs
  ).length;

  const activeGhosts = allActive.filter(
    (e: any) =>
      (e.jobPosition === "ghost" || e.jobPosition === "cleaner") &&
      e.lastShiftAt &&
      now - new Date(e.lastShiftAt).getTime() < windowMs
  ).length;

  const capacityRatio = allActive.length / Math.max(1, business.maxEmployees ?? 5);
  const overcrowdPenalty =
    capacityRatio > 0.6
      ? Math.round(((capacityRatio - 0.6) / 0.4) * 20)
      : 0;

  const score =
    70 +
    Math.min(activeLieutenants, 2) * 10 +
    Math.min(activeGhosts, 2) * 8 -
    overcrowdPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Pending income formula:
 *   base_rate × producers × effectivenessMult × popularityMult × environmentMult
 *
 * effectivenessMult (0–100) → 0.5–1.0
 * popularityMult    (0–100) → 1.0–1.5
 * environmentMult   (0–100) → 0.67–1.0
 */
function calcPendingIncome(business: any, activeEmployeeCount: number): number {
  const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
  if (!def || activeEmployeeCount === 0) return 0;

  const since = business.lastIncomeAt ?? business.createdAt;
  const msElapsed = Date.now() - new Date(since).getTime();
  const hoursElapsed = Math.min(msElapsed / 3_600_000, 168); // cap 7 days

  const effMult = 0.5 + (business.effectiveness ?? 100) / 200;
  const popMult = 1 + calcCurrentPopularity(business) / 200;
  const envMult = 0.67 + ((business.environment ?? 100) / 100) * 0.33;

  return Math.floor(
    hoursElapsed * def.ownerBaseIncome * activeEmployeeCount * effMult * popMult * envMult
  );
}

/** Normalise legacy position names to new names */
function normalisePosition(pos: string): JobPosition {
  const map: Record<string, JobPosition> = {
    production: "runner",
    manager:    "lieutenant",
    cleaner:    "ghost",
    secretary:  "handler",
    marketer:   "marketer",
    runner:     "runner",
    lieutenant: "lieutenant",
    ghost:      "ghost",
    handler:    "handler",
  };
  return map[pos] ?? "runner";
}

// ─── GET /api/businesses/catalog ─────────────────────────────────────────────
router.get("/catalog", requireAuth, (_req, res) => {
  const catalog = Object.entries(BUSINESS_DEFS).map(([type, def]) => ({
    type,
    label:            def.label,
    icon:             def.icon,
    description:      def.description,
    employeeBonus:    def.employeeBonus,
    ownerBaseIncome:  def.ownerBaseIncome,
    shiftEnergyCost:  def.shiftEnergyCost,
    shiftCooldownMin: def.shiftCooldownMin,
    primaryStat:      def.primaryStat,
    perk3star:        def.perk3star,
    perk5star:        def.perk5star,
    perk7star:        def.perk7star,
    perk10star:       def.perk10star,
    createCost:       BUSINESS_CREATE_COST,
    createLevel:      BUSINESS_CREATE_LEVEL,
    upgradeCost:      def.upgradeCost(1),
  }));
  res.json(catalog);
});

// ─── GET /api/businesses/mine ─────────────────────────────────────────────────
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId) return res.json(null);

    const business = await Business.findById(businessId).lean();
    if (!business) {
      // orphaned businessId — clear it silently
      await User.updateOne({ _id: req.userId }, { $set: { businessId: null } });
      return res.json(null);
    }

    const activeEmployees = business.employees.filter((e) => e.status === "active");
    const userIds = activeEmployees.map((e) => e.userId);
    const employeeUsers = await User.find({ _id: { $in: userIds } })
      .select("username level")
      .lean();
    const userMap = Object.fromEntries(
      employeeUsers.map((u) => [u._id.toString(), u])
    );

    const enrichedEmployees = activeEmployees.map((e) => {
      const u = userMap[e.userId.toString()];
      return {
        ...e,
        userId:      e.userId.toString(),
        jobPosition: normalisePosition((e as any).jobPosition ?? "runner"),
        username:    u?.username ?? "Unknown",
        level:       u?.level ?? 1,
      };
    });

    // Correct accumulated income = DB-stored (previous ticks) + since last tick
    const dbAccumulated   = business.accumulatedIncome ?? 0;
    const pendingIncome   = calcPendingIncome(business, activeEmployees.length);
    const totalAvailable  = dbAccumulated + pendingIncome;

    const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
    const incomePerHour   = def ? def.ownerBaseIncome * activeEmployees.length : 0;

    res.json({
      ...business,
      id:                   business._id.toString(),
      activeEmployees:      enrichedEmployees,
      activeEmployeeCount:  activeEmployees.length,
      pendingIncome,
      accumulatedIncome:    totalAvailable,      // ← FIXED: was pendingIncome only
      incomePerHour,
      effectiveness:        recalcEffectiveness(business),
      popularity:           calcCurrentPopularity(business),
      environment:          recalcEnvironment(business),
    });
  } catch (err) {
    logger.error({ err }, "GET /businesses/mine error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses — create ───────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < BUSINESS_CREATE_LEVEL)
      return res
        .status(400)
        .json({ message: `Requires Level ${BUSINESS_CREATE_LEVEL} to open a business` });

    if (user.dc < BUSINESS_CREATE_COST)
      return res
        .status(400)
        .json({ message: `Requires ${BUSINESS_CREATE_COST.toLocaleString()} DC` });

    if ((user as any).businessId)
      return res.status(400).json({ message: "You already own a business" });

    const { name, type, description, wagePerShift } = req.body as {
      name: string;
      type: string;
      description?: string;
      wagePerShift?: number;
    };

    if (!name || !type)
      return res.status(400).json({ message: "name and type are required" });
    if (!BUSINESS_DEFS[type as keyof typeof BUSINESS_DEFS])
      return res.status(400).json({ message: "Invalid business type" });

    const wage = Math.min(50_000, Math.max(100, Number(wagePerShift ?? 500)));

    const business = await Business.create({
      ownerId:      user._id,
      name:         name.trim().slice(0, 40),
      type:         type as import("../models/Business").BusinessType,
      description:  description?.trim().slice(0, 200) ?? "",
      wagePerShift: wage,
    });

    await User.updateOne(
      { _id: req.userId },
      { $inc: { dc: -BUSINESS_CREATE_COST }, $set: { businessId: business._id } }
    );

    // Return the full business object so the frontend can populate immediately
    const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
    res.status(201).json({
      ...business.toObject(),
      id:                  business._id.toString(),
      activeEmployees:     [],
      activeEmployeeCount: 0,
      pendingIncome:       0,
      accumulatedIncome:   0,
      incomePerHour:       def.ownerBaseIncome,
      effectiveness:       100,
      popularity:          50,
      environment:         100,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/collect ────────────────────────────────────────────
router.post("/collect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const activeCount      = business.employees.filter((e) => e.status === "active").length;
    const dbAccumulated    = business.accumulatedIncome ?? 0;
    const pendingIncome    = calcPendingIncome(business, activeCount);
    const income           = dbAccumulated + pendingIncome;

    if (income <= 0)
      return res.status(400).json({ message: "No income to collect yet" });

    // Atomic update to avoid race conditions
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.userId },
      { $inc: { dc: income } },
      { returnDocument: "after" }
    );

    await Business.updateOne(
      { _id: businessId },
      {
        $set:  { accumulatedIncome: 0, lastIncomeAt: new Date() },
        $inc:  { totalEverEarned: income },
      }
    );

    res.json({ collected: income, newDc: updatedUser?.dc ?? 0 });
  } catch (err) {
    logger.error({ err }, "POST /businesses/collect error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PATCH /api/businesses/settings ──────────────────────────────────────────
router.patch("/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const { wagePerShift, description, isOpen } = req.body as {
      wagePerShift?: number;
      description?: string;
      isOpen?: boolean;
    };

    if (wagePerShift !== undefined) {
      if (wagePerShift < 100 || wagePerShift > 50_000)
        return res
          .status(400)
          .json({ message: "Wage must be between 100 and 50,000 DC" });
      business.wagePerShift = wagePerShift;
    }
    if (description !== undefined)
      business.description = description.trim().slice(0, 200);
    if (isOpen !== undefined) business.isOpen = isOpen;

    await business.save();
    res.json({ message: "Settings saved" });
  } catch (err) {
    logger.error({ err }, "PATCH /businesses/settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/upgrade ────────────────────────────────────────────
router.post("/upgrade", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (business.starLevel >= 10)
      return res.status(400).json({ message: "Already at maximum star level" });

    const def  = BUSINESS_DEFS[business.type];
    const cost = def.upgradeCost(business.starLevel);

    if (user.dc < cost)
      return res
        .status(400)
        .json({ message: `Requires ${cost.toLocaleString()} DC to upgrade` });

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: cost } },
      { $inc: { dc: -cost } },
      { returnDocument: "after" }
    );
    if (!updated)
      return res.status(400).json({ message: "Insufficient DC" });

    business.starLevel   += 1;
    business.maxEmployees = 5 + (business.starLevel - 1) * 2;
    await business.save();

    res.json({
      starLevel:    business.starLevel,
      maxEmployees: business.maxEmployees,
      newDc:        updated.dc,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/upgrade error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/advertise ──────────────────────────────────────────
const AD_COST  = 25_000;
const AD_BOOST = 30;

router.post("/advertise", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const updated = await User.findOneAndUpdate(
      { _id: req.userId, dc: { $gte: AD_COST } },
      { $inc: { dc: -AD_COST } },
      { returnDocument: "after" }
    );
    if (!updated)
      return res
        .status(400)
        .json({ message: `Advertising costs ${AD_COST.toLocaleString()} DC` });

    // Marketers amplify the boost
    const activeMarketers = business.employees.filter(
      (e) => e.status === "active" && (e.jobPosition === "marketer" || (e as any).jobPosition === "marketer")
    ).length;
    const boost    = AD_BOOST + Math.min(activeMarketers, 2) * 10; // +10 per marketer
    const newPop   = Math.min(100, calcCurrentPopularity(business) + boost);

    business.popularity   = newPop;
    business.lastAdvertAt = new Date();
    await business.save();

    res.json({
      message:    `Campaign broadcast! Reputation spiked to ${newPop}%`,
      popularity: newPop,
      cost:       AD_COST,
      newDc:      updated.dc,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/advertise error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/transfer — transfer ownership ──────────────────────
router.post("/transfer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetUserId } = req.body as { targetUserId: string };
    if (!targetUserId)
      return res.status(400).json({ message: "targetUserId is required" });

    const owner = await User.findById(req.userId);
    if (!owner) return res.status(404).json({ message: "User not found" });

    const businessId = (owner as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.ownerId.equals(req.userId as any))
      return res.status(403).json({ message: "You are not the owner" });

    if (String(targetUserId) === String(req.userId))
      return res.status(400).json({ message: "Cannot transfer to yourself" });

    // Target must be an active employee
    const emp = business.employees.find(
      (e) => e.userId.toString() === targetUserId && e.status === "active"
    );
    if (!emp)
      return res
        .status(400)
        .json({ message: "Target must be an active crew member of this business" });

    const newOwner = await User.findById(targetUserId);
    if (!newOwner) return res.status(404).json({ message: "Target user not found" });

    if ((newOwner as any).businessId)
      return res
        .status(400)
        .json({ message: "That player already owns a business" });

    // Transfer: clear old owner's businessId, set new owner's businessId,
    // remove target from employee list, set new ownerId on business
    await Promise.all([
      User.updateOne({ _id: req.userId }, { $set: { businessId: null } }),
      User.updateOne(
        { _id: targetUserId },
        { $set: { businessId: business._id, employerBusinessId: null } }
      ),
    ]);

    business.ownerId = new mongoose.Types.ObjectId(targetUserId);
    business.employees = business.employees.filter(
      (e) => e.userId.toString() !== targetUserId
    );
    await business.save();

    await Notification.create({
      userId:  targetUserId,
      type:    "system",
      message: `You are now the Director of ${business.name}. The operation is yours.`,
    }).catch(() => {});

    await Notification.create({
      userId:  req.userId,
      type:    "system",
      message: `You have signed over ${business.name} to ${(newOwner as any).username}.`,
    }).catch(() => {});

    res.json({ message: `${business.name} transferred to ${(newOwner as any).username}` });
  } catch (err) {
    logger.error({ err }, "POST /businesses/transfer error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/request-delete — submit deletion request ────────────
router.post("/request-delete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId).lean();
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.ownerId.equals(req.userId as any))
      return res.status(403).json({ message: "You are not the owner" });

    const { reason } = req.body as { reason?: string };
    if (!reason || reason.trim().length < 20)
      return res
        .status(400)
        .json({ message: "Please provide a reason (min 20 characters)" });

    const activeEmpCount = business.employees.filter((e) => e.status === "active").length;

    const subject = `Business Deletion Request — ${business.name}`;
    const body =
      `Business Name: ${business.name}\n` +
      `Business Type: ${business.type}\n` +
      `Business ID:   ${business._id}\n` +
      `Star Level:    ${business.starLevel}\n` +
      `Active Crew:   ${activeEmpCount}\n` +
      `Total Earned:  ${business.totalEverEarned} DC\n` +
      `\nReason provided by owner:\n${reason.trim()}`;

    await SupportTicket.create({
      playerId:     req.userId,
      playerName:   (user as any).username,
      category:     "other",
      subject,
      body,
      status:       "open",
    });

    res.json({
      message:
        "Deletion request submitted. A staff member will review it and contact you. " +
        "Your business remains active until the request is processed.",
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/request-delete error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── GET /api/businesses/:id/employees ───────────────────────────────────────
router.get("/:id/employees", requireAuth, async (req: AuthRequest, res) => {
  try {
    const business = await Business.findById(req.params.id).lean();
    if (!business) return res.status(404).json({ message: "Business not found" });

    const requestingUser = await User.findById(req.userId).select("role").lean();
    const isOwner  = business.ownerId.toString() === req.userId;
    const isStaff  = ["staff", "admin", "owner"].includes((requestingUser as any)?.role ?? "");
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Not authorised to view this roster" });

    const allEmployees = business.employees.filter(
      (e) => e.status === "active" || e.status === "pending"
    );

    const userIds = allEmployees.map((e) => e.userId);
    const employeeUsers = await User.find({ _id: { $in: userIds } })
      .select("username level")
      .lean();
    const userMap = Object.fromEntries(
      employeeUsers.map((u) => [u._id.toString(), u])
    );

    const enriched = allEmployees.map((e) => {
      const u = userMap[e.userId.toString()];
      return {
        userId:      e.userId.toString(),
        username:    u?.username ?? "Unknown",
        level:       u?.level ?? 1,
        hiredAt:     e.hiredAt,
        lastShiftAt: e.lastShiftAt,
        totalShifts: e.totalShifts,
        totalEarned: e.totalEarned,
        jobPoints:   (e as any).jobPoints ?? 0,
        status:      e.status,
        jobPosition: normalisePosition((e as any).jobPosition ?? "runner"),  // ← FIXED: was missing
      };
    });

    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /businesses/:id/employees error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/:id/fire/:userId ────────────────────────────────────
router.post("/:id/fire/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.ownerId.equals(req.userId as any))
      return res.status(403).json({ message: "Only the Director can fire crew" });

    const empIndex = business.employees.findIndex(
      (e) => e.userId.toString() === req.params.userId && e.status === "active"
    );
    if (empIndex === -1)
      return res.status(404).json({ message: "Active crew member not found" });

    business.employees[empIndex].status = "fired" as any;

    // Recalculate metrics after roster change
    (business as any).effectiveness = recalcEffectiveness(business);
    (business as any).environment   = recalcEnvironment(business);
    await business.save();

    // Clear employee's employer tracking
    await User.updateOne(
      { _id: business.employees[empIndex].userId },
      { $set: { employerBusinessId: null } }
    );

    await Notification.create({
      userId:  business.employees[empIndex].userId,
      type:    "system",
      message: `You've been cut from ${business.name}. Time to find new work.`,
    }).catch(() => {});

    res.json({ message: "Crew member removed" });
  } catch (err) {
    logger.error({ err }, "POST /businesses/:id/fire/:userId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/approve/:userId ────────────────────────────────────
router.post("/approve/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const owner = await User.findById(req.userId).lean();
    if (!owner) return res.status(404).json({ message: "User not found" });

    const businessId = (owner as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const empIndex = business.employees.findIndex(
      (e) =>
        e.userId.toString() === req.params.userId &&
        (e.status as string) === "pending"
    );
    if (empIndex === -1)
      return res.status(404).json({ message: "Pending applicant not found" });

    const activeCount = business.employees.filter((e) => e.status === "active").length;
    if (activeCount >= business.maxEmployees)
      return res.status(400).json({ message: "Crew is at capacity" });

    // Enforce one-employer rule: check the applicant is not already employed
    const applicantId = business.employees[empIndex].userId;
    const alreadyEmployed = await Business.exists({
      _id:               { $ne: business._id },
      "employees.userId":    applicantId,
      "employees.status":    "active",
    });
    if (alreadyEmployed)
      return res
        .status(400)
        .json({ message: "That runner is already employed elsewhere" });

    (business.employees[empIndex] as any).status  = "active";
    business.employees[empIndex].hiredAt          = new Date();
    (business.employees[empIndex] as any).jobPosition = "runner";
    await business.save();

    // Set employer tracker on user
    await User.updateOne(
      { _id: applicantId },
      { $set: { employerBusinessId: business._id } }
    );

    await Notification.create({
      userId:  applicantId,
      type:    "system",
      message: `Your application to ${business.name} has been approved. Report for duty.`,
    }).catch(() => {});

    res.json({ message: "Crew member activated" });
  } catch (err) {
    logger.error({ err }, "POST /businesses/approve/:userId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── GET /api/businesses/board ────────────────────────────────────────────────
router.get("/board", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // If already employed, return their job + empty board
    const employerBizId = (user as any).employerBusinessId;

    const businesses = await Business.find({ isOpen: true }).lean();

    const ownerIds  = businesses.map((b) => b.ownerId);
    const ownerDocs = await User.find({ _id: { $in: ownerIds } })
      .select("username")
      .lean();
    const ownerMap  = Object.fromEntries(
      ownerDocs.map((u) => [u._id.toString(), (u as any).username])
    );

    const result = [];
    for (const b of businesses) {
      const activeEmployees = b.employees.filter((e) => e.status === "active");
      if (activeEmployees.length >= b.maxEmployees) continue;

      // Exclude the user's own business
      if (b.ownerId.toString() === String(req.userId)) continue;

      const def = BUSINESS_DEFS[b.type];
      const myEntry = b.employees.find(
        (e) => e.userId.toString() === String(req.userId)
      );

      result.push({
        id:                  b._id.toString(),
        ownerId:             b.ownerId.toString(),          // ← FIXED: was missing
        ownerUsername:       ownerMap[b.ownerId.toString()] ?? "Unknown",
        name:                b.name,
        type:                b.type,
        label:               def?.label ?? b.type,
        icon:                def?.icon ?? "🏢",
        starLevel:           b.starLevel,
        isOpen:              b.isOpen,                      // ← FIXED: was missing
        wagePerShift:        b.wagePerShift,
        activeEmployeeCount: activeEmployees.length,
        maxEmployees:        b.maxEmployees,
        description:         b.description,
        employeeBonus:       def?.employeeBonus ?? "",
        shiftCooldownMin:    def?.shiftCooldownMin ?? 30,
        shiftEnergyCost:     def?.shiftEnergyCost ?? 3,
        myStatus: myEntry
          ? (myEntry.status as string)
          : null,
      });
    }

    result.sort((a, b) => b.starLevel - a.starLevel);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /businesses/board error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/apply/:businessId ───────────────────────────────────
router.post("/apply/:businessId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Enforce one-employer rule
    const alreadyActive = await Business.exists({
      "employees.userId":  new mongoose.Types.ObjectId(String(req.userId)),
      "employees.status":  "active",
    });
    if (alreadyActive)
      return res
        .status(400)
        .json({ message: "You are already employed. Resign first before applying elsewhere." });

    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.isOpen)
      return res.status(400).json({ message: "This business is not accepting applications" });

    if (business.ownerId.equals(req.userId as any))
      return res.status(400).json({ message: "You cannot apply to your own business" });

    const existing = business.employees.find(
      (e) => e.userId.toString() === String(req.userId)
    );
    if (existing) {
      if (existing.status === "active")
        return res.status(400).json({ message: "You are already an active crew member" });
      if ((existing.status as string) === "pending")
        return res.status(400).json({ message: "Your application is already pending" });
      // Previously fired/resigned — re-apply by pushing new entry
    }

    const activeCount = business.employees.filter((e) => e.status === "active").length;
    if (activeCount >= business.maxEmployees)
      return res.status(400).json({ message: "This crew is at capacity" });

    business.employees.push({
      userId:      new mongoose.Types.ObjectId(String(req.userId)),
      hiredAt:     new Date(),
      lastShiftAt: null,
      totalShifts: 0,
      totalEarned: 0,
      jobPoints:   0,
      status:      "pending" as any,
      jobPosition: "runner" as any,
    });
    await business.save();

    await Notification.create({
      userId:  business.ownerId,
      type:    "system",
      message: `${(user as any).username} wants to join ${business.name}. Check your crew roster.`,
    }).catch(() => {});

    res.json({ message: "Application submitted. Awaiting Director approval." });
  } catch (err) {
    logger.error({ err }, "POST /businesses/apply/:businessId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── GET /api/businesses/my-job ──────────────────────────────────────────────
router.get("/my-job", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find the single business where this user is active (one-employer rule)
    const business = await Business.findOne({
      "employees.userId":  new mongoose.Types.ObjectId(String(req.userId)),
      "employees.status":  "active",
    }).lean();

    if (!business) return res.json(null);

    const cooldowns: Record<string, Date> =
      (user as any).businessShiftCooldowns instanceof Map
        ? Object.fromEntries((user as any).businessShiftCooldowns)
        : (user as any).businessShiftCooldowns ?? {};
    const now = Date.now();

    const myEmp = business.employees.find(
      (e) =>
        e.userId.toString() === String(req.userId) && e.status === "active"
    )!;
    const def = BUSINESS_DEFS[business.type];

    const cooldownUntil: Date | null = cooldowns[business._id.toString()] ?? null;
    const onCooldown = !!(cooldownUntil && new Date(cooldownUntil).getTime() > now);

    // Owner info
    const ownerDoc = await User.findById(business.ownerId).select("username").lean();

    res.json({
      id:               business._id.toString(),
      name:             business.name,
      type:             business.type,
      label:            def?.label ?? business.type,
      icon:             def?.icon ?? "🏢",
      starLevel:        business.starLevel,
      wagePerShift:     business.wagePerShift,
      description:      business.description,
      isOpen:           business.isOpen,
      ownerUsername:    (ownerDoc as any)?.username ?? "Unknown",
      myEmployee: {
        ...myEmp,
        userId:      myEmp.userId.toString(),
        jobPosition: normalisePosition((myEmp as any).jobPosition ?? "runner"),
        jobPoints:   (myEmp as any).jobPoints ?? 0,
      },
      shiftEnergyCost:  def?.shiftEnergyCost ?? 3,
      shiftCooldownMin: def?.shiftCooldownMin ?? 30,
      employeeBonus:    def?.employeeBonus ?? "",
      onCooldown,
      cooldownUntil:    onCooldown ? cooldownUntil : null,
    });
  } catch (err) {
    logger.error({ err }, "GET /businesses/my-job error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/resign ─────────────────────────────────────────────
router.post("/resign", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Owners cannot resign — they must transfer or request deletion
    if ((user as any).businessId)
      return res
        .status(400)
        .json({
          message:
            "As Director you cannot resign. Transfer ownership to a crew member " +
            "or submit a deletion request.",
        });

    const business = await Business.findOne({
      "employees.userId":  new mongoose.Types.ObjectId(String(req.userId)),
      "employees.status":  "active",
    });
    if (!business)
      return res.status(400).json({ message: "You are not currently employed" });

    const empIndex = business.employees.findIndex(
      (e) => e.userId.toString() === String(req.userId) && e.status === "active"
    );
    if (empIndex !== -1) {
      business.employees[empIndex].status = "resigned" as any;
      (business as any).effectiveness = recalcEffectiveness(business);
      (business as any).environment   = recalcEnvironment(business);
      await business.save();
    }

    await User.updateOne(
      { _id: req.userId },
      { $set: { employerBusinessId: null } }
    );

    await Notification.create({
      userId:  business.ownerId,
      type:    "system",
      message: `${(user as any).username} has left ${business.name}.`,
    }).catch(() => {});

    res.json({ message: `You've left ${business.name}. You're on your own.` });
  } catch (err) {
    logger.error({ err }, "POST /businesses/resign error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/:businessId/shift ───────────────────────────────────
router.post("/:businessId/shift", requireAuth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.params.businessId;

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    // ← FIXED: shifts can't run at closed businesses
    if (!business.isOpen)
      return res.status(400).json({ message: "This operation is shut down — no shifts available" });

    const empIndex = business.employees.findIndex(
      (e) => e.userId.toString() === String(req.userId) && e.status === "active"
    );
    if (empIndex === -1)
      return res.status(403).json({ message: "You are not an active crew member here" });

    const def = BUSINESS_DEFS[business.type];

    // Check cooldown from user record
    const userCheck = await User.findById(req.userId).lean();
    if (!userCheck) return res.status(404).json({ message: "User not found" });

    const cooldowns: Record<string, Date> =
      (userCheck as any).businessShiftCooldowns instanceof Map
        ? Object.fromEntries((userCheck as any).businessShiftCooldowns)
        : (userCheck as any).businessShiftCooldowns ?? {};

    const cooldownUntil: Date | null = cooldowns[String(businessId)] ?? null;
    if (cooldownUntil && new Date(cooldownUntil).getTime() > Date.now())
      return res.status(400).json({ message: "Shift cooldown active", cooldownUntil });

    const nextCooldown = new Date(Date.now() + def.shiftCooldownMin * 60 * 1000);

    // Atomic energy deduction + wage pay + cooldown set
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.userId, energy: { $gte: def.shiftEnergyCost } },
      {
        $inc: { energy: -def.shiftEnergyCost, dc: business.wagePerShift },
        $set: { [`businessShiftCooldowns.${businessId}`]: nextCooldown },
      },
      { returnDocument: "after" }
    );
    if (!updatedUser)
      return res
        .status(400)
        .json({ message: `Not enough energy — this shift costs ${def.shiftEnergyCost}` });

    // Update employee record
    const emp = business.employees[empIndex];
    emp.totalShifts     += 1;
    emp.lastShiftAt      = new Date();
    emp.totalEarned     += business.wagePerShift;
    (emp as any).jobPoints = ((emp as any).jobPoints ?? 0) + 1;

    // Passive income accumulation for owner (prorated by shift hours)
    const shiftHours         = def.shiftCooldownMin / 60;
    const activeCount        = business.employees.filter((e) => e.status === "active").length;
    const ownerIncomeFraction = shiftHours * def.ownerBaseIncome * activeCount;
    business.accumulatedIncome += Math.floor(ownerIncomeFraction);

    (business as any).effectiveness = recalcEffectiveness(business);
    (business as any).environment   = recalcEnvironment(business);
    await business.save();

    res.json({
      message:       "Shift complete. Stay low.",
      dcEarned:      business.wagePerShift,   // ← FIXED field name (was causing wrong toast)
      energyCost:    def.shiftEnergyCost,
      cooldownUntil: nextCooldown,
      newDc:         updatedUser.dc,
      newEnergy:     updatedUser.energy,
      totalShifts:   emp.totalShifts,
      totalEarned:   emp.totalEarned,
      jobPoints:     (emp as any).jobPoints,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/:businessId/shift error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/businesses/employees/:userId/position ─────────────────────────
router.post("/employees/:userId/position", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { position } = req.body as { position: string };
    const normalised = normalisePosition(position);
    const validPositions: JobPosition[] = ["runner", "lieutenant", "ghost", "handler", "marketer"];
    if (!validPositions.includes(normalised))
      return res.status(400).json({ message: "Invalid position" });

    const owner = await User.findById(req.userId).lean();
    if (!owner) return res.status(404).json({ message: "User not found" });

    const bizId = (owner as any).businessId;
    if (!bizId) return res.status(400).json({ message: "You don't own a business" });

    const business = await Business.findById(bizId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.ownerId.equals(req.userId as any))
      return res.status(403).json({ message: "Only the Director can assign roles" });

    const emp = business.employees.find(
      (e) => e.userId.toString() === req.params.userId && e.status === "active"
    );
    if (!emp) return res.status(404).json({ message: "Active crew member not found" });

    if (normalised !== "runner") {
      const limit = JOB_POSITION_LIMITS[normalised];
      const currentCount = business.employees.filter(
        (e) =>
          e.status === "active" &&
          normalisePosition((e as any).jobPosition ?? "runner") === normalised &&
          e.userId.toString() !== req.params.userId
      ).length;
      if (currentCount >= limit)
        return res
          .status(400)
          .json({ message: `Maximum ${limit} ${normalised}(s) allowed per operation` });
    }

    (emp as any).jobPosition = normalised;
    (business as any).effectiveness = recalcEffectiveness(business);
    (business as any).environment   = recalcEnvironment(business);
    await business.save();

    res.json({
      message:     `Role updated to ${normalised}`,
      environment: (business as any).environment,
      effectiveness: (business as any).effectiveness,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/employees/:userId/position error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
