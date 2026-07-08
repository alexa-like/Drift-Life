/**
 * Admin-only migration endpoint.
 * POST /api/admin/migration/run          — run all three migration jobs
 * POST /api/admin/migration/merit        — merit → DC only
 * POST /api/admin/migration/items        — item refund only
 * POST /api/admin/migration/equipment    — clear equipment slots only
 *
 * Protected by requireOwner (role === "owner").
 */
import { Router } from "express";
import { requireAuth, requireOwner, AuthRequest } from "../middlewares/auth";
import {
  runAllMigrations,
  runMeritMigration,
  runItemRefundMigration,
  runLegacyCarRefundMigration,
  runEquipmentClearMigration,
} from "../jobs/migration";

const router = Router();

// Run all migrations at once
router.post("/run", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  try {
    const result = await runAllMigrations();
    res.json({ message: "All migrations complete", result });
  } catch (err: any) {
    req.log.error({ err }, "migration/run error");
    res.status(500).json({ message: "Migration failed", error: err.message });
  }
});

// Run merit migration only
router.post("/merit", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  try {
    const result = await runMeritMigration();
    res.json({ message: "Merit migration complete", result });
  } catch (err: any) {
    req.log.error({ err }, "migration/merit error");
    res.status(500).json({ message: "Merit migration failed", error: err.message });
  }
});

// Run item refund only
router.post("/items", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  try {
    const result = await runItemRefundMigration();
    res.json({ message: "Item refund complete", result });
  } catch (err: any) {
    req.log.error({ err }, "migration/items error");
    res.status(500).json({ message: "Item refund failed", error: err.message });
  }
});

// Run legacy car refund only
router.post("/cars", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  try {
    const result = await runLegacyCarRefundMigration();
    res.json({ message: "Legacy car refund complete", result });
  } catch (err: any) {
    req.log.error({ err }, "migration/cars error");
    res.status(500).json({ message: "Legacy car refund failed", error: err.message });
  }
});

// Clear equipment slots only
router.post("/equipment", requireAuth, requireOwner, async (req: AuthRequest, res) => {
  try {
    const result = await runEquipmentClearMigration();
    res.json({ message: "Equipment clear complete", result });
  } catch (err: any) {
    req.log.error({ err }, "migration/equipment error");
    res.status(500).json({ message: "Equipment clear failed", error: err.message });
  }
});

export default router;
