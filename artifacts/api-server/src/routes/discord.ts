/**
 * Discord interactions webhook.
 *
 * POST /api/discord/interactions
 *
 * Handles:
 *   /verify <token> — respond with ephemeral verification code (no link stored)
 *   /link   <token> — respond with ephemeral linking code (stores Discord ID on submit)
 *
 * Security: Ed25519 signature verification using DISCORD_PUBLIC_KEY.
 * Requests without a valid signature are rejected with 401.
 *
 * Note: express.json() is configured with a rawBody capture in app.ts so
 * that we have the raw request body string needed for signature verification.
 */

import { Router, type Request, type Response } from "express";
import { verifyDiscordSignature } from "../lib/discord";
import { consumeToken, createCode } from "../lib/platformCodes";
import User from "../models/User";

const router = Router();

// Discord interaction types
const PING                        = 1;
const APPLICATION_COMMAND         = 2;
// Discord interaction response types
const PONG                        = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
// Discord message flags
const EPHEMERAL                   = 64;

// String option type in Discord slash commands
const OPTION_TYPE_STRING = 3;

// ── POST /api/discord/interactions ───────────────────────────────────────────

router.post("/interactions", async (req: Request & { rawBody?: string }, res: Response) => {
  const publicKey = process.env["DISCORD_PUBLIC_KEY"];
  if (!publicKey) {
    // Discord not configured — refuse to accept interactions
    return res.status(503).json({ message: "Discord integration not configured" });
  }

  // Verify Ed25519 signature — required by Discord spec
  const signature = req.headers["x-signature-ed25519"] as string;
  const timestamp = req.headers["x-signature-timestamp"] as string;
  const rawBody   = req.rawBody ?? JSON.stringify(req.body);

  if (!signature || !timestamp) {
    return res.status(401).json({ message: "Missing signature headers" });
  }

  // Reject stale timestamps — prevents replay attacks (Discord recommends 5 min window)
  const tsSeconds = parseInt(timestamp, 10);
  if (isNaN(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 300) {
    return res.status(401).json({ message: "Request timestamp is too old or invalid" });
  }

  const valid = verifyDiscordSignature(publicKey, signature, timestamp, rawBody);
  if (!valid) {
    return res.status(401).json({ message: "Invalid request signature" });
  }

  const interaction = req.body as DiscordInteraction;

  // ── PING — Discord liveness check ──────────────────────────────────────────
  if (interaction.type === PING) {
    return res.json({ type: PONG });
  }

  // ── Slash commands ──────────────────────────────────────────────────────────
  if (interaction.type === APPLICATION_COMMAND) {
    const commandName   = interaction.data?.name;
    const options       = interaction.data?.options ?? [];
    const tokenOpt      = options.find(o => o.name === "token");
    const token         = typeof tokenOpt?.value === "string" ? tokenOpt.value.trim() : "";
    const discordUserId = String(interaction.member?.user?.id ?? interaction.user?.id ?? "");
    const discordUser   = interaction.member?.user?.username
                       ?? interaction.user?.username
                       ?? null;
    const interactionToken = interaction.token;

    // Helper for ephemeral error replies
    const ephemeralError = (content: string) =>
      res.json({
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content, flags: EPHEMERAL },
      });

    if (commandName !== "verify" && commandName !== "link") {
      return ephemeralError("Unknown command.");
    }

    if (!token) {
      return ephemeralError(
        `Please provide your session token: \`/${commandName} <your-token>\`\n` +
        `Get a token from the DriftLife game under Profile → Connections.`,
      );
    }

    // Consume the token (single-use, 10-min TTL)
    const flowType = commandName === "verify" ? "verify" : "link";
    const tokenEntry = consumeToken(token);

    if (!tokenEntry) {
      return ephemeralError(
        `❌ Token not found or expired. Please go back to DriftLife and start a new session.`,
      );
    }

    if (tokenEntry.platform !== "discord") {
      return ephemeralError(
        `❌ This token is for Telegram, not Discord. Use the correct verification method in DriftLife.`,
      );
    }

    if (tokenEntry.type !== flowType) {
      return ephemeralError(
        `❌ Wrong token type. For ${flowType === "verify" ? "verification" : "linking"} ` +
        `use the ${flowType === "verify" ? "/verify" : "/link"} command.`,
      );
    }

    // Fetch the player's username for the code message
    const dbUser = await User.findById(tokenEntry.userId).select("username").lean().catch(() => null);
    const playerName = (dbUser as any)?.username ?? "Player";

    // Generate the 6-char code and store it (30s TTL)
    const code = createCode({
      userId:                  tokenEntry.userId,
      type:                    flowType,
      platform:                "discord",
      discordUserId,
      discordUsername:         discordUser ?? undefined,
      discordInteractionToken: interactionToken,
      discordGuildId:          interaction.guild_id ?? undefined,
    });

    const responseText =
      `Hey ${playerName},\n` +
      `Here's your DriftLife ${flowType === "verify" ? "verification" : "linking"} code:\n\n` +
      `\`\`\`\n${code}\n\`\`\`\n\n` +
      `Enter this in the DriftLife game within **30 seconds**.\n` +
      `_Only you can see this message._`;

    return res.json({
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: responseText, flags: EPHEMERAL },
    });
  }

  // Unknown interaction type
  return res.status(400).json({ message: "Unknown interaction type" });
});

export default router;

// ── Discord interaction types ─────────────────────────────────────────────────

interface DiscordInteraction {
  id: string;
  type: number;
  token: string;
  guild_id?: string;
  member?: {
    user?: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
  data?: {
    name: string;
    options?: Array<{
      name: string;
      value: string | number | boolean;
    }>;
  };
}
