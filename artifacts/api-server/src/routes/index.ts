import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import profileRouter from "./profile";
import crimesRouter from "./crimes";
import jobsRouter from "./jobs";
import combatRouter from "./combat";
import bankRouter from "./bank";
import hospitalRouter from "./hospital";
import dailyRouter from "./daily";
import feedRouter from "./feed";
import leaderboardRouter from "./leaderboard";
import notificationsRouter from "./notifications";
import districtsRouter from "./districts";
import inventoryRouter from "./inventory";
import marketRouter from "./market";
import devRouter from "./dev";
import ownerRouter from "./owner";
import settingsRouter from "./settings";
import achievementsRouter from "./achievements";
import chatRouter from "./chat";
import friendsRouter from "./friends";
import skillsRouter from "./skills";
import guildsRouter from "./guilds";
import auctionRouter from "./auction";
import propertiesRouter from "./properties";
import vantaRouter from "./vanta";
import craftingRouter from "./crafting";
import tradeRouter from "./trade";
// ── Wire Cartel additions ────────────────────────────────────────────────────
import gymRouter from "./gym";
import garageRouter from "./garage";
import racesRouter from "./races";
import cityRouter from "./city";
import netRouter from "./net";
import worldRouter from "./world";
import cyberRouter from "./cyber";
import chatframesRouter from "./chatframes";
import storeRouter from "./store";
import telegramRouter from "./telegram";
// ── Mini-game foundation ─────────────────────────────────────────────────────
import energyRouter from "./energy";
import migrationAdminRouter from "./migration-admin";
// ── Royale (Tier 2) ───────────────────────────────────────────────────────────
import royaleRouter from "./royale";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/profile", profileRouter);
router.use("/crimes", crimesRouter);
router.use("/jobs", jobsRouter);
router.use("/combat", combatRouter);
router.use("/bank", bankRouter);
router.use("/hospital", hospitalRouter);
router.use("/daily", dailyRouter);
router.use("/feed", feedRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/notifications", notificationsRouter);
router.use("/districts", districtsRouter);
router.use("/inventory", inventoryRouter);
router.use("/market", marketRouter);
router.use("/settings", settingsRouter);
router.use("/achievements", achievementsRouter);
router.use("/chat", chatRouter);
router.use("/friends", friendsRouter);
router.use("/skills", skillsRouter);
router.use("/guilds", guildsRouter);
router.use("/auction", auctionRouter);
router.use("/properties", propertiesRouter);
router.use("/vanta", vantaRouter);
router.use("/crafting", craftingRouter);
router.use("/trade", tradeRouter);
// ── Wire Cartel ──────────────────────────────────────────────────────────────
router.use("/gym", gymRouter);
router.use("/garage", garageRouter);
router.use("/races", racesRouter);
router.use("/city", cityRouter);
router.use("/net", netRouter);
router.use("/world", worldRouter);
router.use("/cyber", cyberRouter);
router.use("/chatframes", chatframesRouter);
router.use("/store", storeRouter);
router.use("/telegram", telegramRouter);
// ── Mini-game foundation ─────────────────────────────────────────────────────
router.use("/energy", energyRouter);
// ── Royale (Tier 2) ───────────────────────────────────────────────────────────
router.use("/royale", royaleRouter);
// ── Admin ─────────────────────────────────────────────────────────────────────
router.use("/dev", devRouter);
router.use("/owner", ownerRouter);
router.use("/admin/migration", migrationAdminRouter);

export default router;
