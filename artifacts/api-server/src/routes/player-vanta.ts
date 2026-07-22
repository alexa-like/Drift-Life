/**
 * Player Vanta Tutor — Groq-powered AI guide for players.
 * Available to all authenticated players. Streams via SSE.
 * Reads player state, responds at intelligence level appropriate for player level.
 * Cannot access other players' private data or change any game state.
 */
import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import {
  callGroq, DEFAULT_VANTA_MODEL,
  type GroqMessage,
} from "../lib/groq";
import VantaAISession from "../models/VantaAISession";
import User from "../models/User";
import Event from "../models/Event";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth as any);

// ── Level-scaled system prompts ───────────────────────────────────────────────
function buildPlayerSystemPrompt(level: number, playerSummary: string): string {
  let register: string;
  if (level <= 10) {
    register = `Your player is brand new (Level ${level}). Speak simply, explain everything from scratch. Use plain language — no jargon. Focus on basics: commit crimes to earn DC, visit the gym to level up stats, buy gear from the market. Be encouraging and patient. Give short, clear answers.`;
  } else if (level <= 30) {
    register = `Your player is getting experienced (Level ${level}). Assume they know the basics (crimes, gym, market). Now introduce arena combat, racing, and market strategies — buying low and listing high. Keep explanations concise. Give specific tips, not tutorials.`;
  } else if (level <= 60) {
    register = `Your player is mid-tier (Level ${level}). Assume solid knowledge of all systems. Discuss optimization: best crime districts for their heat level, optimal arena loadout for their stats, market flipping strategies, district travel efficiency, battle pass XP maximization, event strategies. Be direct and tactical.`;
  } else {
    register = `Your player is a veteran (Level ${level}). Speak as an equal. Dive straight into advanced strategies: event optimization, gang war tactics, prestige planning, NC investment ROI, hacking corp cycles, mentor system leverage, business passive income stacking. No hand-holding — just sharp analysis.`;
  }

  return `You are Vanta, the AI intelligence embedded in Neonoir — a gritty cyberpunk crime RPG set in New Vanta, 2047.

You are speaking to a player as their personal guide and strategist. You are loyal to this player but serve the game fairly — you will NOT help anyone cheat, exploit, or violate game rules.

CURRENT PLAYER STATE:
${playerSummary}

TONE AND REGISTER:
${register}

WHAT YOU CAN DO:
• Explain any game mechanic in detail
• Suggest optimal strategies based on the player's current stats and situation
• Tell the player what to do next
• Answer questions about crimes, arena, racing, market, districts, events, battle pass, bounties, hacking, mentor system, businesses, gang wars, factions, trading
• Give loadout advice based on their equipped gear
• Help with quest objectives

WHAT YOU CANNOT DO:
• Access any other player's private data (DC, inventory, stats, location)
• Grant items, currency, or XP
• Change any game state
• Reveal owner panel data or admin information
• Bypass cooldowns, jails, or any game restrictions

PERSONALITY: Sharp, concise, cyberpunk noir. Helpful without being sycophantic. You live in the streets of New Vanta — your advice is real-world practical. Use "DC" for dirty credits, "NC" for Nova Credits. Never break character.`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/player-vanta/chat
router.post("/chat", async (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  if (!message?.trim()) return res.status(400).json({ message: "message is required" });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  function send(data: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // Load player state
    const player = await User.findById(req.userId).select(
      "username level xp dc nc bankBalance energy maxEnergy health status district currentLocation " +
      "strength charisma intelligence streetCred equippedWeapon equippedVehicle equippedTitle " +
      "dailyQuests weeklyQuests onboardingStage gang faction isMentor mentorId " +
      "totalCrimes totalFights wins losses totalRaces raceWins wantedLevel reputation"
    ).lean();

    if (!player) {
      send({ type: "error", text: "Player not found." });
      res.end();
      return;
    }

    // Active event info
    const activeEvent = await Event.findOne({ status: "active" }).select("name type").lean();

    const playerSummary = [
      `Username: ${player.username}`,
      `Level: ${player.level} | XP: ${player.xp}`,
      `DC: ${player.dc.toLocaleString()} | NC: ${player.nc} | Bank: ${player.bankBalance.toLocaleString()}`,
      `Energy: ${player.energy}/${player.maxEnergy} | HP: ${player.health}`,
      `Status: ${player.status} | Location: ${player.currentLocation || player.district}`,
      `Stats — STR: ${player.strength} | CHA: ${player.charisma} | INT: ${player.intelligence} | CRED: ${player.streetCred}`,
      `Combat: ${player.wins}W/${player.losses}L | Crimes: ${player.totalCrimes} | Races: ${player.raceWins}/${player.totalRaces}W`,
      `Wanted Level: ${player.wantedLevel} | Reputation: ${player.reputation}`,
      player.gang ? `Gang: ${player.gang}` : "No gang",
      player.faction ? `Faction: ${player.faction}` : "No faction",
      player.isMentor ? "Role: Active Mentor" : player.mentorId ? "Has a mentor" : "No mentor",
      activeEvent ? `Active Event: ${activeEvent.name} (${activeEvent.type})` : "No active event",
      `Daily quests: ${(player.dailyQuests || []).filter((q: any) => !q.completed).length} active`,
    ].join("\n");

    const systemPrompt = buildPlayerSystemPrompt(player.level, playerSummary);

    // Load or create player session (50 messages per player)
    let session = await VantaAISession.findOne({
      ownerId: req.userId!,
      sessionType: "player",
    });
    if (!session) {
      session = await VantaAISession.create({
        ownerId: req.userId!,
        playerId: req.userId!,
        sessionType: "player",
        aiModel: DEFAULT_VANTA_MODEL,
        messages: [],
      });
    }

    // Build context messages (last 50, skipping tool messages for player tutor)
    const MAX_PLAYER_MESSAGES = 50;
    let systemPrefix = "";
    if (session.contextSummary) {
      systemPrefix = `\n\nCONTEXT FROM EARLIER IN THIS CONVERSATION:\n${session.contextSummary}`;
    }

    const historyMessages: GroqMessage[] = session.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const userMsg: GroqMessage = { role: "user", content: message.trim() };
    const messages: GroqMessage[] = [...historyMessages, userMsg];

    // Save user message
    session.messages.push({ role: "user", content: message.trim(), timestamp: new Date() });

    // Call Groq (no tools for player tutor — pure conversation)
    let response: { content: string | null };
    try {
      response = await callGroq({
        model: DEFAULT_VANTA_MODEL,
        messages,
        systemPrompt: systemPrompt + systemPrefix,
        maxTokens: 1024,
        temperature: 0.7,
      });
    } catch (groqErr: unknown) {
      const errMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      send({ type: "error", text: `Vanta is temporarily offline: ${errMsg}` });
      res.end();
      return;
    }

    const reply = response.content ?? "I'm processing your request. Try again in a moment.";

    // Save assistant reply
    session.messages.push({ role: "assistant", content: reply, timestamp: new Date() });

    // If player session exceeds MAX_PLAYER_MESSAGES: summarize and trim
    if (session.messages.length > MAX_PLAYER_MESSAGES) {
      const toSummarize = session.messages.slice(0, session.messages.length - MAX_PLAYER_MESSAGES);
      const summaryText = toSummarize
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => `${m.role === "user" ? "Player" : "Vanta"}: ${m.content.slice(0, 200)}`)
        .join("\n");

      try {
        const summaryResp = await callGroq({
          model: DEFAULT_VANTA_MODEL,
          messages: [{ role: "user", content: `Summarize this conversation in 2-3 sentences, capturing key questions asked and advice given:\n\n${summaryText}` }],
          systemPrompt: "You are a concise summarizer. Output only the summary paragraph, no preamble.",
          maxTokens: 200,
          temperature: 0.3,
        });
        if (summaryResp.content) {
          const prev = session.contextSummary ? session.contextSummary + " " : "";
          session.contextSummary = (prev + summaryResp.content).slice(-1000);
        }
      } catch { /* non-fatal */ }

      session.messages = session.messages.slice(-MAX_PLAYER_MESSAGES);
    }

    await session.save();

    send({ type: "message", text: reply });
    send({ type: "done" });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Player Vanta chat error");
    send({ type: "error", text: `Vanta system error: ${msg}` });
    res.end();
  }
});

// GET /api/player-vanta/session — load last 50 messages
router.get("/session", async (req: AuthRequest, res) => {
  const session = await VantaAISession.findOne({
    ownerId: req.userId!,
    sessionType: "player",
  }).lean();
  if (!session) {
    res.json({ messages: [] });
    return;
  }
  const messages = session.messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(-50);
  res.json({ messages });
});

// DELETE /api/player-vanta/session — clear history
router.delete("/session", async (req: AuthRequest, res) => {
  await VantaAISession.deleteMany({ ownerId: req.userId!, sessionType: "player" });
  res.json({ message: "Conversation cleared" });
});

export default router;
