import { Router } from "express";
import mongoose, { Schema } from "mongoose";
import Business, {
  BUSINESS_DEFS,
  BUSINESS_CREATE_COST,
  BUSINESS_CREATE_LEVEL,
} from "../models/Business";
import User from "../models/User";
import Notification from "../models/Notification";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

// Add business fields to User schema dynamically
User.schema.add({
  businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null },
  businessShiftCooldowns: { type: Map, of: Date, default: {} },
});

const router = Router();

// ─── GET /api/businesses/catalog — business type definitions ─────────────────
router.get("/catalog", requireAuth, (_req, res) => {
  const catalog = Object.entries(BUSINESS_DEFS).map(([type, def]) => ({
    type,
    label: def.label,
    icon: def.icon,
    description: def.description,
    employeeBonus: def.employeeBonus,
    ownerBaseIncome: def.ownerBaseIncome,
    shiftEnergyCost: def.shiftEnergyCost,
    shiftCooldownMin: def.shiftCooldownMin,
    perk3star: def.perk3star,
    perk10star: def.perk10star,
    createCost: BUSINESS_CREATE_COST,
    createLevel: BUSINESS_CREATE_LEVEL,
    upgradeCost: def.upgradeCost(1),
  }));
  res.json(catalog);
});

// ─── Helper: calculate pending income ────────────────────────────────────────
function calcPendingIncome(
  business: any,
  activeEmployeeCount: number
): number {
  const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
  const since = business.lastIncomeAt ?? business.createdAt;
  const msElapsed = Date.now() - new Date(since).getTime();
  const hoursElapsed = Math.min(msElapsed / 3_600_000, 168); // cap 7 days
  return Math.floor(hoursElapsed * def.ownerBaseIncome * activeEmployeeCount);
}

// ─── Owner: GET /api/businesses/mine ─────────────────────────────────────────
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId) return res.json(null);

    const business = await Business.findById(businessId).lean();
    if (!business) return res.json(null);

    const activeEmployees = business.employees.filter(
      (e) => e.status === "active"
    );

    // Enrich with username/level
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
        username: u?.username ?? "Unknown",
        level: u?.level ?? 1,
      };
    });

    const pendingIncome = calcPendingIncome(business, activeEmployees.length);
    const def = BUSINESS_DEFS[business.type as keyof typeof BUSINESS_DEFS];
    const incomePerHour = def ? def.ownerBaseIncome * activeEmployees.length : 0;

    res.json({
      ...business,
      id: business._id.toString(),
      activeEmployees: enrichedEmployees,
      activeEmployeeCount: activeEmployees.length,
      pendingIncome,
      accumulatedIncome: pendingIncome,
      incomePerHour,
    });
  } catch (err) {
    logger.error({ err }, "GET /businesses/mine error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: POST /api/businesses — create ────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.level < BUSINESS_CREATE_LEVEL)
      return res
        .status(400)
        .json({ message: `Requires level ${BUSINESS_CREATE_LEVEL}` });
    if (user.dc < BUSINESS_CREATE_COST)
      return res
        .status(400)
        .json({ message: `Requires ${BUSINESS_CREATE_COST.toLocaleString()} DC` });
    if ((user as any).businessId)
      return res
        .status(400)
        .json({ message: "You already own a business" });

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

    const business = await Business.create({
      ownerId: user._id,
      name: name.trim(),
      type: type as import("../models/Business").BusinessType,
      description: description?.trim() ?? "",
      wagePerShift: wagePerShift ?? 500,
    });

    user.dc -= BUSINESS_CREATE_COST;
    (user as any).businessId = business._id;
    await user.save();

    res.status(201).json(business);
  } catch (err) {
    logger.error({ err }, "POST /businesses error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: POST /api/businesses/collect — collect passive income ─────────────
router.post("/collect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const businessId = (user as any).businessId;
    if (!businessId)
      return res.status(400).json({ message: "You do not own a business" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const activeCount = business.employees.filter(
      (e) => e.status === "active"
    ).length;

    const income = calcPendingIncome(business, activeCount);

    if (income <= 0)
      return res.status(400).json({ message: "No income to collect" });

    user.dc += income;
    business.accumulatedIncome = 0;
    business.lastIncomeAt = new Date();
    business.totalEverEarned += income;

    await Promise.all([user.save(), business.save()]);

    res.json({ collected: income, newDc: user.dc });
  } catch (err) {
    logger.error({ err }, "POST /businesses/collect error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: PATCH /api/businesses/settings ───────────────────────────────────
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
    res.json(business);
  } catch (err) {
    logger.error({ err }, "PATCH /businesses/settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: POST /api/businesses/upgrade ─────────────────────────────────────
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
      return res.status(400).json({ message: "Already at max star level" });

    const def = BUSINESS_DEFS[business.type];
    const cost = def.upgradeCost(business.starLevel);

    if (user.dc < cost)
      return res
        .status(400)
        .json({ message: `Requires ${cost.toLocaleString()} DC to upgrade` });

    user.dc -= cost;
    business.starLevel += 1;
    // +2 max employees per star above 1
    business.maxEmployees = 5 + (business.starLevel - 1) * 2;

    await Promise.all([user.save(), business.save()]);

    res.json({
      starLevel: business.starLevel,
      maxEmployees: business.maxEmployees,
      newDc: user.dc,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/upgrade error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: GET /api/businesses/:id/employees ────────────────────────────────
router.get("/:id/employees", requireAuth, async (req: AuthRequest, res) => {
  try {
    const business = await Business.findById(req.params.id).lean();
    if (!business) return res.status(404).json({ message: "Business not found" });

    // Only the owner (or staff/admin) may view the employee roster
    const requestingUser = await User.findById(req.userId).select("role").lean();
    const isOwner = business.ownerId.toString() === req.userId;
    const isStaff = ["staff", "admin", "owner"].includes((requestingUser as any)?.role ?? "");
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Not authorized to view this business roster" });

    const allEmployees = business.employees.filter(
      (e) => e.status === "active" || e.status === ("pending" as any)
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
        userId: e.userId.toString(),
        username: u?.username ?? "Unknown",
        level: u?.level ?? 1,
        hiredAt: e.hiredAt,
        lastShiftAt: e.lastShiftAt,
        totalShifts: e.totalShifts,
        totalEarned: e.totalEarned,
        status: e.status,
      };
    });

    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /businesses/:id/employees error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: POST /api/businesses/:id/fire/:userId ────────────────────────────
router.post("/:id/fire/:userId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: "Business not found" });

    if (!business.ownerId.equals(req.userId as any))
      return res.status(403).json({ message: "Not the owner" });

    const empIndex = business.employees.findIndex(
      (e) =>
        e.userId.toString() === req.params.userId && e.status === "active"
    );
    if (empIndex === -1)
      return res.status(404).json({ message: "Active employee not found" });

    business.employees[empIndex].status = "fired";
    await business.save();

    await Notification.create({
      userId: business.employees[empIndex].userId,
      type: "system",
      message: `You have been fired from ${business.name}`,
    }).catch(() => {});

    res.json({ message: "Employee fired" });
  } catch (err) {
    logger.error({ err }, "POST /businesses/:id/fire/:userId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Owner: POST /api/businesses/approve/:userId — approve pending applicant ─
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

    const activeCount = business.employees.filter(
      (e) => e.status === "active"
    ).length;
    if (activeCount >= business.maxEmployees)
      return res
        .status(400)
        .json({ message: "Business is at max employee capacity" });

    (business.employees[empIndex] as any).status = "active";
    business.employees[empIndex].hiredAt = new Date();
    await business.save();

    await Notification.create({
      userId: business.employees[empIndex].userId,
      type: "system",
      message: `Your application to ${business.name} has been approved!`,
    }).catch(() => {});

    res.json({ message: "Applicant approved" });
  } catch (err) {
    logger.error({ err }, "POST /businesses/approve/:userId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Job Board: GET /api/businesses/board ────────────────────────────────────
router.get("/board", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const businesses = await Business.find({ isOpen: true }).lean();

    // Filter: must have open slots, exclude ones user already works at
    const result = [];
    const ownerIds = businesses.map((b) => b.ownerId);
    const ownerDocs = await User.find({ _id: { $in: ownerIds } })
      .select("username")
      .lean();
    const ownerMap = Object.fromEntries(
      ownerDocs.map((u) => [u._id.toString(), u.username])
    );

    for (const b of businesses) {
      const activeEmployees = b.employees.filter((e) => e.status === "active");
      if (activeEmployees.length >= b.maxEmployees) continue;

      // Exclude if user is active employee
      const isEmployee = b.employees.some(
        (e) =>
          e.userId.toString() === String(req.userId) &&
          e.status === "active"
      );
      if (isEmployee) continue;

      const def = BUSINESS_DEFS[b.type];
      result.push({
        id: b._id,
        name: b.name,
        type: b.type,
        starLevel: b.starLevel,
        wagePerShift: b.wagePerShift,
        ownerUsername: ownerMap[b.ownerId.toString()] ?? "Unknown",
        activeEmployeeCount: activeEmployees.length,
        maxEmployees: b.maxEmployees,
        description: b.description,
        employeeBonus: def.employeeBonus,
        shiftCooldownMin: def.shiftCooldownMin,
        shiftEnergyCost: def.shiftEnergyCost,
      });
    }

    result.sort((a, b) => b.starLevel - a.starLevel);

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /businesses/board error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Employee: POST /api/businesses/apply/:businessId ────────────────────────
router.post("/apply/:businessId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const business = await Business.findById(req.params.businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    // Can't apply to own business
    if (business.ownerId.equals(req.userId as any))
      return res.status(400).json({ message: "You cannot apply to your own business" });

    // Check existing
    const existing = business.employees.find(
      (e) => e.userId.toString() === String(req.userId)
    );
    if (existing) {
      if (existing.status === "active")
        return res.status(400).json({ message: "You are already an active employee" });
      if ((existing.status as string) === "pending")
        return res.status(400).json({ message: "You already have a pending application" });
    }

    business.employees.push({
      userId: new mongoose.Types.ObjectId(String(req.userId)),
      hiredAt: new Date(),
      lastShiftAt: null,
      totalShifts: 0,
      totalEarned: 0,
      status: "pending" as any,
    });
    await business.save();

    await Notification.create({
      userId: business.ownerId,
      type: "system",
      message: `${(user as any).username} applied to work at ${business.name}`,
    }).catch(() => {});

    res.json({ message: "Application submitted" });
  } catch (err) {
    logger.error({ err }, "POST /businesses/apply/:businessId error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Employee: GET /api/businesses/my-job ────────────────────────────────────
router.get("/my-job", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const businesses = await Business.find({
      "employees.userId": new mongoose.Types.ObjectId(String(req.userId)),
      "employees.status": "active",
    }).lean();

    const cooldowns = (user as any).businessShiftCooldowns ?? {};
    const now = Date.now();

    const result = businesses
      .filter((b) =>
        b.employees.some(
          (e) =>
            e.userId.toString() === String(req.userId) &&
            e.status === "active"
        )
      )
      .map((b) => {
        const myEmp = b.employees.find(
          (e) =>
            e.userId.toString() === String(req.userId) &&
            e.status === "active"
        )!;
        const def = BUSINESS_DEFS[b.type];

        let cooldownUntil: Date | null = null;
        // cooldowns may be a Map or plain object depending on lean() output
        if (cooldowns instanceof Map) {
          cooldownUntil = cooldowns.get(b._id.toString()) ?? null;
        } else {
          cooldownUntil = cooldowns[b._id.toString()] ?? null;
        }

        const onCooldown = !!(
          cooldownUntil && new Date(cooldownUntil).getTime() > now
        );

        return {
          id: b._id,
          name: b.name,
          type: b.type,
          starLevel: b.starLevel,
          wagePerShift: b.wagePerShift,
          description: b.description,
          myEmployee: myEmp,
          shiftEnergyCost: def.shiftEnergyCost,
          shiftCooldownMin: def.shiftCooldownMin,
          employeeBonus: def.employeeBonus,
          onCooldown,
          cooldownUntil: onCooldown ? cooldownUntil : null,
        };
      });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /businesses/my-job error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Employee: POST /api/businesses/:businessId/shift ────────────────────────
router.post("/:businessId/shift", requireAuth, async (req: AuthRequest, res) => {
  try {
    const businessId = req.params.businessId;

    // Load business
    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    // Verify user is active employee
    const empIndex = business.employees.findIndex(
      (e) =>
        e.userId.toString() === String(req.userId) &&
        e.status === "active"
    );
    if (empIndex === -1)
      return res.status(403).json({ message: "You are not an active employee of this business" });

    const def = BUSINESS_DEFS[business.type];

    // Check shift cooldown atomically via user update
    // First read user to check cooldown, then do atomic energy deduction
    const userCheck = await User.findById(req.userId).lean();
    if (!userCheck) return res.status(404).json({ message: "User not found" });

    const cooldowns: Record<string, Date> = (userCheck as any).businessShiftCooldowns ?? {};
    const cooldownUntil: Date | null = cooldowns[String(businessId)] ?? null;

    if (cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()) {
      return res.status(400).json({
        message: "Shift is on cooldown",
        cooldownUntil,
      });
    }

    // Atomic energy deduction
    const nextCooldown = new Date(
      Date.now() + def.shiftCooldownMin * 60 * 1000
    );
    const updated = await User.findOneAndUpdate(
      {
        _id: req.userId,
        energy: { $gte: def.shiftEnergyCost },
      },
      {
        $inc: {
          energy: -def.shiftEnergyCost,
          dc: business.wagePerShift,
        },
        $set: {
          [`businessShiftCooldowns.${businessId}`]: nextCooldown,
        },
      },
      { new: true }
    );

    if (!updated)
      return res
        .status(400)
        .json({ message: `Not enough energy. Requires ${def.shiftEnergyCost} energy.` });

    // Update employee record
    const emp = business.employees[empIndex];
    emp.totalShifts += 1;
    emp.lastShiftAt = new Date();
    emp.totalEarned += business.wagePerShift;

    // Accumulate passive income for owner (ownerBaseIncome per shift per active employee fraction)
    // Add a share of hourly income for the duration of one shift
    const shiftHours = def.shiftCooldownMin / 60;
    const activeCount = business.employees.filter((e) => e.status === "active").length;
    const ownerIncomeFraction = shiftHours * def.ownerBaseIncome * activeCount;
    business.accumulatedIncome += Math.floor(ownerIncomeFraction);

    await business.save();

    res.json({
      message: "Shift complete!",
      dcEarned: business.wagePerShift,
      energyCost: def.shiftEnergyCost,
      cooldownUntil: nextCooldown,
      newDc: updated.dc,
      newEnergy: updated.energy,
      totalShifts: emp.totalShifts,
      totalEarned: emp.totalEarned,
    });
  } catch (err) {
    logger.error({ err }, "POST /businesses/:businessId/shift error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
