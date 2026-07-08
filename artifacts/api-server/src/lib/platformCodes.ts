/**
 * Shared in-memory store for platform verification & linking codes.
 * Used by both the /api/platform REST routes and the bot webhook handlers
 * (telegram.ts, discord.ts) so both sides share the same token/code state.
 *
 * Flow:
 *   1. Game calls /api/platform/verify-init or /api/platform/link-init
 *      → server creates a TOKEN embedded in the deep link / slash command args
 *   2. Player taps deep link or runs slash command in Discord
 *      → Bot receives the token, generates a short CODE, sends it to the player
 *   3. Player enters the code in the game UI
 *      → Game calls /api/platform/verify-submit or /api/platform/link-submit
 *      → Server validates and (for linking) stores the platform ID
 */

import crypto from "crypto";

export type Platform = "telegram" | "discord";
export type FlowType = "verify" | "link";

// ── Token (embedded in deep link URL or slash command arg) ────────────────────
export interface TokenEntry {
  userId: string;
  type: FlowType;
  platform: Platform;
  expiresAt: number;
}

// ── Code (short 6-char hex shown to the player by the bot) ───────────────────
export interface CodeEntry {
  userId: string;
  type: FlowType;
  platform: Platform;
  expiresAt: number;
  // Telegram-specific
  chatId?: string;
  // Discord-specific
  discordUserId?: string;
  discordUsername?: string;
  discordInteractionToken?: string; // valid 15 min, used for resend followup
  discordGuildId?: string;
  // Attempt counter (max 3 before email fallback prompt)
  attempts: number;
}

// Token TTL: 10 minutes for the player to tap the deep link / run the command
const TOKEN_TTL_MS = 10 * 60 * 1000;
// Code TTL: 30 seconds as per spec
const CODE_TTL_MS = 30 * 1_000;

// ── Stores ────────────────────────────────────────────────────────────────────
const _tokens = new Map<string, TokenEntry>();
const _codes  = new Map<string, CodeEntry>();
// Maps "userId:type:platform" → current active code (for resend lookup)
const _sessions = new Map<string, string>();
// Maps "userId:type:platform" → failed submission count (survives code rotation / expiry)
const _attempts = new Map<string, number>();

// ── Helpers ───────────────────────────────────────────────────────────────────

export function sessionKey(userId: string, type: FlowType, platform: Platform): string {
  return `${userId}:${type}:${platform}`;
}

/** Generate a 24-char hex token embedded in deep links / slash command args. */
export function generateToken(): string {
  return crypto.randomBytes(12).toString("hex");
}

/** Generate a 6-char uppercase hex code shown to the player. */
export function generateCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ── Token operations ──────────────────────────────────────────────────────────

/**
 * Create a new token for a platform session.
 * Any prior token for the same (userId, type, platform) triplet is invalidated.
 */
export function createToken(userId: string, type: FlowType, platform: Platform): string {
  // Invalidate any existing token for this session
  for (const [k, v] of _tokens) {
    if (v.userId === userId && v.type === type && v.platform === platform) {
      _tokens.delete(k);
    }
  }
  const token = generateToken();
  _tokens.set(token, { userId, type, platform, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

/**
 * Look up and consume a token (single-use).
 * Returns null if the token is missing or expired.
 */
export function consumeToken(token: string): TokenEntry | null {
  const entry = _tokens.get(token);
  _tokens.delete(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// ── Code operations ───────────────────────────────────────────────────────────

/**
 * Create a new 6-char code for an active session.
 * Automatically invalidates the previous code for the same session.
 */
export function createCode(entry: Omit<CodeEntry, "attempts" | "expiresAt">): string {
  const sKey = sessionKey(entry.userId, entry.type, entry.platform);

  // Invalidate previous code for this session
  const oldCode = _sessions.get(sKey);
  if (oldCode) _codes.delete(oldCode);

  const code = generateCode();
  _codes.set(code, { ...entry, attempts: 0, expiresAt: Date.now() + CODE_TTL_MS });
  _sessions.set(sKey, code);
  return code;
}

/**
 * Look up a code without consuming it (for attempt counting).
 * Returns null if missing or expired.
 */
export function lookupCode(raw: string): CodeEntry | null {
  const code = raw.toUpperCase();
  const entry = _codes.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _codes.delete(code);
    _sessions.delete(sessionKey(entry.userId, entry.type, entry.platform));
    return null;
  }
  return entry;
}

/**
 * Consume a code (remove it from the store).
 * Returns null if missing or expired.
 */
export function consumeCode(raw: string): CodeEntry | null {
  const code = raw.toUpperCase();
  const entry = _codes.get(code);
  if (!entry) return null;
  _codes.delete(code);
  _sessions.delete(sessionKey(entry.userId, entry.type, entry.platform));
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

/**
 * Get the currently active code entry for a session (without consuming).
 * Used to retrieve chatId/discordInteractionToken for resend.
 */
export function getActiveCodeEntry(
  userId: string,
  type: FlowType,
  platform: Platform,
): { code: string; entry: CodeEntry } | null {
  const sKey = sessionKey(userId, type, platform);
  const code = _sessions.get(sKey);
  if (!code) return null;
  const entry = _codes.get(code);
  if (!entry || Date.now() > entry.expiresAt) {
    _sessions.delete(sKey);
    if (code) _codes.delete(code);
    return null;
  }
  return { code, entry };
}

/** Invalidate any active code + session for a (userId, type, platform) triplet. */
export function invalidateSession(userId: string, type: FlowType, platform: Platform): void {
  const sKey = sessionKey(userId, type, platform);
  const code = _sessions.get(sKey);
  if (code) _codes.delete(code);
  _sessions.delete(sKey);
  _attempts.delete(sKey);
}

// ── Attempt limiting ──────────────────────────────────────────────────────────
// Attempts are tracked at the SESSION level (userId:type:platform), not at the
// code level. This means wrong-code guesses and expired codes both count toward
// the limit, preventing brute-force bypass via rapid re-submission.

const MAX_ATTEMPTS = 3;

/**
 * Increment the failed-attempt counter for a session.
 * Returns the new total. Does not consume the code.
 */
export function recordFailedAttempt(userId: string, type: FlowType, platform: Platform): number {
  const sKey = sessionKey(userId, type, platform);
  const prev = _attempts.get(sKey) ?? 0;
  const next = prev + 1;
  _attempts.set(sKey, next);
  return next;
}

/** Current attempt count for a session (0 if no failures yet). */
export function getAttemptCount(userId: string, type: FlowType, platform: Platform): number {
  return _attempts.get(sessionKey(userId, type, platform)) ?? 0;
}

/** Whether a session has exceeded MAX_ATTEMPTS. */
export function isSessionLocked(userId: string, type: FlowType, platform: Platform): boolean {
  return getAttemptCount(userId, type, platform) >= MAX_ATTEMPTS;
}

/** Reset attempt counter — called on successful submission or explicit retry-after-fallback. */
export function resetAttempts(userId: string, type: FlowType, platform: Platform): void {
  _attempts.delete(sessionKey(userId, type, platform));
}

export { MAX_ATTEMPTS };
