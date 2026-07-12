import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import profileRouter from "./profile";
import crimesRouter from "./crimes";
import jobsRouter from "./jobs";

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
import reportsRouter from "./reports";
import banAppealRouter from "./ban-appeal";
import supportRouter from "./support";
import searchRouter from "./search";
import craftingRouter from "./crafting";
import tradeRouter from "./trade";
// ── Wire Cartel additions ────────────────────────────────────────────────────
import gymRouter from "./gym";
import garageRouter from "./minigame-garage";
import loadoutRouter from "./loadout";
import cityRouter from "./city";
import netRouter from "./net";
import worldRouter from "./world";
import cyberRouter from "./cyber";
import storeRouter from "./store";
import telegramRouter from "./telegram";
// ── Mini-game foundation ─────────────────────────────────────────────────────
import energyRouter from "./energy";
import migrationAdminRouter from "./migration-admin";
// ── Royale (Tier 2) ───────────────────────────────────────────────────────────
import royaleRouter from "./royale";
// ── Arena / Combat System (Tier 4) ───────────────────────────────────────────
import arenaRouter from "./arena";
// ── Racing System (Tier 5) ────────────────────────────────────────────────────
import raceRouter from "./race";
// ── Missions & Leaderboards (Tier 6) ──────────────────────────────────────────
import missionsRouter from "./missions";
import miniLeaderboardRouter from "./mini-leaderboard";

// ── Training Center (Tier 7) ───────────────────────────────────────────────────
import trainingRouter from "./training";
// ── Match History (Tier 8) ────────────────────────────────────────────────────
import matchHistoryRouter from "./match-history";
// ── Platform Verification & Linking ───────────────────────────────────────────
import platformRouter from "./platform";
import discordRouter from "./discord";
// ── Game Emojis (Tier 10.1a) ──────────────────────────────────────────────────
import emojisRouter from "./emojis";
// ── Mentor System (Tier 10.14) ─────────────────────────────────────────────────
import mentorRouter from "./mentor";
// ── Previously unregistered routes ────────────────────────────────────────────
import npcStoresRouter from "./npcStores";
import blackMarketRouter from "./blackMarket";
import factionBankRouter from "./factionBank";
// ── Giveaway System (Tier 3+) ──────────────────────────────────────────────────
// Models are imported for side-effect registration; router added below.
import "../models/Giveaway";
import "../models/GiveawayEntry";
import giveawaysRouter from "./giveaways";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/profile", profileRouter);
router.use("/crimes", crimesRouter);
router.use("/jobs", jobsRouter);

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
router.use("/loadout", loadoutRouter);
router.use("/city", cityRouter);
router.use("/net", netRouter);
router.use("/world", worldRouter);
router.use("/cyber", cyberRouter);
router.use("/store", storeRouter);
router.use("/telegram", telegramRouter);
// ── Mini-game foundation ─────────────────────────────────────────────────────
router.use("/energy", energyRouter);
// ── Royale (Tier 2) ───────────────────────────────────────────────────────────
router.use("/royale", royaleRouter);
// ── Arena / Combat System (Tier 4) ───────────────────────────────────────────
router.use("/arena", arenaRouter);
// ── Racing System (Tier 5) ────────────────────────────────────────────────────
router.use("/race", raceRouter);
// ── Missions & Leaderboards (Tier 6) ──────────────────────────────────────────
router.use("/missions", missionsRouter);
router.use("/mini-leaderboard", miniLeaderboardRouter);

// ── Training Center (Tier 7) ───────────────────────────────────────────────────
router.use("/training", trainingRouter);
// ── Match History (Tier 8) ────────────────────────────────────────────────────
router.use("/match-history", matchHistoryRouter);
// ── Platform Verification & Linking ───────────────────────────────────────────
router.use("/platform", platformRouter);
router.use("/discord", discordRouter);
// ── Game Emojis (Tier 10.1a) ──────────────────────────────────────────────────
router.use("/emojis", emojisRouter);
// ── Mentor System (Tier 10.14) ─────────────────────────────────────────────────
router.use("/mentor", mentorRouter);
// ── Previously unregistered routes ────────────────────────────────────────────
router.use("/npc-stores", npcStoresRouter);
router.use("/black-market", blackMarketRouter);
router.use("/faction", factionBankRouter);
// ── Community / Safety ─────────────────────────────────────────────────────
router.use("/reports", reportsRouter);
router.use("/ban-appeal", banAppealRouter);
router.use("/support", supportRouter);
router.use("/search", searchRouter);
// ── Admin ─────────────────────────────────────────────────────────────────────
router.use("/dev", devRouter);
router.use("/owner", ownerRouter);
router.use("/admin/migration", migrationAdminRouter);
// ── Giveaway System (Tier 3+) ──────────────────────────────────────────────────
router.use("/giveaways", giveawaysRouter);

export default router;
