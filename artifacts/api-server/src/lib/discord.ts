/**
 * Discord API helpers.
 * Covers: Ed25519 interaction signature verification, slash command registration,
 * ephemeral followup messages, guild member management (nickname + roles).
 */

import crypto from "crypto";
import { logger } from "./logger";

// ── Ed25519 Signature Verification ────────────────────────────────────────────

// SPKI DER prefix for a raw 32-byte Ed25519 public key (RFC 8410)
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify a Discord interaction request signature (Ed25519).
 * Must be called with the raw request body string (before JSON.parse).
 * Returns false on any error — callers should respond 401 if this returns false.
 */
export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): boolean {
  try {
    const derKey    = Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey, "hex")]);
    const sigBytes  = Buffer.from(signature, "hex");
    const msgBytes  = Buffer.from(timestamp + rawBody, "utf8");
    return crypto.verify(null, msgBytes, { key: derKey, format: "der", type: "spki" }, sigBytes);
  } catch {
    return false;
  }
}

// ── REST helpers ──────────────────────────────────────────────────────────────

function getBotToken(): string | undefined {
  return process.env["DISCORD_BOT_TOKEN"];
}

function getAppId(): string | undefined {
  return process.env["DISCORD_APPLICATION_ID"];
}

async function discordRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const token = getBotToken();
  if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Slash command registration ────────────────────────────────────────────────

export interface SlashCommand {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number; // 3 = STRING
    required: boolean;
  }>;
}

/**
 * Register (or overwrite) slash commands for a specific guild.
 * Uses PUT which replaces the full command list atomically.
 */
export async function registerGuildCommands(
  guildId: string,
  commands: SlashCommand[],
): Promise<void> {
  const appId = getAppId();
  if (!appId) {
    logger.warn("DISCORD_APPLICATION_ID not set — Discord commands not registered");
    return;
  }
  try {
    await discordRequest("PUT", `/applications/${appId}/guilds/${guildId}/commands`, commands);
    logger.info({ guildId, count: commands.length }, "Discord guild commands registered");
  } catch (err) {
    logger.warn({ err }, "Discord registerGuildCommands failed");
  }
}

// ── Interaction followup ──────────────────────────────────────────────────────

/**
 * Send an ephemeral followup message using the interaction token.
 * Discord interaction tokens are valid for 15 minutes after the original interaction,
 * which covers multiple resend attempts within the session window.
 */
export async function sendInteractionFollowup(
  interactionToken: string,
  content: string,
): Promise<void> {
  const appId = getAppId();
  if (!appId) return;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, flags: 64 }), // 64 = EPHEMERAL
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Discord followup failed: ${res.status} ${body}`);
    }
  } catch (err) {
    logger.warn({ err }, "Discord sendInteractionFollowup failed");
    throw err; // Re-throw so callers can surface failure to the user
  }
}

// ── Guild member management ───────────────────────────────────────────────────

/**
 * Set a guild member's server nickname. Truncated to 32 chars (Discord limit).
 * Fails silently if the bot lacks MANAGE_NICKNAMES permission.
 */
export async function setMemberNickname(
  guildId: string,
  discordUserId: string,
  nickname: string,
): Promise<void> {
  try {
    await discordRequest(
      "PATCH",
      `/guilds/${guildId}/members/${discordUserId}`,
      { nick: nickname.slice(0, 32) },
    );
  } catch (err) {
    logger.warn({ err, guildId, discordUserId }, "Discord setMemberNickname failed");
  }
}

/**
 * Add a role to a guild member.
 * Fails silently if the bot lacks MANAGE_ROLES or the role is higher than the bot's.
 */
export async function addMemberRole(
  guildId: string,
  discordUserId: string,
  roleId: string,
): Promise<void> {
  try {
    await discordRequest(
      "PUT",
      `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    );
  } catch (err) {
    logger.warn({ err, guildId, discordUserId, roleId }, "Discord addMemberRole failed");
  }
}

/**
 * Remove a role from a guild member.
 * Fails silently on permission errors.
 */
export async function removeMemberRole(
  guildId: string,
  discordUserId: string,
  roleId: string,
): Promise<void> {
  try {
    await discordRequest(
      "DELETE",
      `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    );
  } catch (err) {
    logger.warn({ err, guildId, discordUserId, roleId }, "Discord removeMemberRole failed");
  }
}
