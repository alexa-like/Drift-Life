import { logger } from "./logger";

let warnedMissingToken = false;

/**
 * Sends a Telegram DM to a user via the bot API. No-ops gracefully when
 * TELEGRAM_BOT_TOKEN is not configured (Phase 2 feature — game must run
 * without it per project requirements). Never throws — a failed/absent
 * Telegram send should never block or fail the calling game action.
 */
export async function sendTelegramMessage(chatId: string | null | undefined, text: string): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];

  if (!token) {
    if (!warnedMissingToken) {
      logger.info("TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled (Phase 2 feature)");
      warnedMissingToken = true;
    }
    return;
  }

  if (!chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "Telegram sendMessage failed");
    }
  } catch (err) {
    logger.warn({ err }, "Telegram sendMessage error");
  }
}

/**
 * Notify a user's linked Telegram account if they have notifications enabled.
 * Safe to call unconditionally — checks user preference and missing config internally.
 */
export async function notifyTelegram(
  user: { telegramId?: string | null; telegramNotifications?: boolean } | null | undefined,
  text: string,
): Promise<void> {
  if (!user || !user.telegramNotifications || !user.telegramId) return;
  await sendTelegramMessage(user.telegramId, text);
}
