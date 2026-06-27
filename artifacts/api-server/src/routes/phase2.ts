import { Router } from "express";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const cs = { message: "coming soon" };

router.get("/crafting",              requireAuth, (_r, res) => res.json(cs));
router.get("/crafting/{*splat}",     requireAuth, (_r, res) => res.json(cs));
router.get("/skills",                requireAuth, (_r, res) => res.json(cs));
router.get("/skills/{*splat}",       requireAuth, (_r, res) => res.json(cs));
router.get("/guild",                 requireAuth, (_r, res) => res.json(cs));
router.get("/guild/{*splat}",        requireAuth, (_r, res) => res.json(cs));
router.get("/properties",            requireAuth, (_r, res) => res.json(cs));
router.get("/properties/{*splat}",   requireAuth, (_r, res) => res.json(cs));
router.get("/npc",                   requireAuth, (_r, res) => res.json(cs));
router.get("/npc/{*splat}",          requireAuth, (_r, res) => res.json(cs));
router.get("/messages",              requireAuth, (_r, res) => res.json(cs));
router.get("/messages/{*splat}",     requireAuth, (_r, res) => res.json(cs));
router.get("/auction",               requireAuth, (_r, res) => res.json(cs));
router.get("/auction/{*splat}",      requireAuth, (_r, res) => res.json(cs));
router.get("/battlepass",            requireAuth, (_r, res) => res.json(cs));
router.get("/battlepass/{*splat}",   requireAuth, (_r, res) => res.json(cs));
router.get("/events",                requireAuth, (_r, res) => res.json(cs));
router.get("/events/{*splat}",       requireAuth, (_r, res) => res.json(cs));
router.get("/seasons",               requireAuth, (_r, res) => res.json(cs));
router.get("/seasons/{*splat}",      requireAuth, (_r, res) => res.json(cs));
router.post("/telegram/link",        requireAuth, (_r, res) => res.json(cs));
router.get("/market/black",          requireAuth, (_r, res) => res.json(cs));
router.get("/market/black/{*splat}", requireAuth, (_r, res) => res.json(cs));

export default router;
