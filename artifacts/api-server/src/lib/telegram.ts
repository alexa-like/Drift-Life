import { logger } from "./logger";

let warnedMissingToken = false;

function getToken(): string | undefined {
  return process.env["TELEGRAM_BOT_TOKEN"];
}

/**
 * Sends a Telegram DM to a user via the bot API. No-ops gracefully when
 * TELEGRAM_BOT_TOKEN is not configured. Never throws.
 */
export async function sendTelegramMessage(chatId: string | null | undefined, text: string): Promise<void> {
  const token = getToken();
  if (!token) {
    if (!warnedMissingToken) {
      logger.info("TELEGRAM_BOT_TOKEN not set — Telegram disabled");
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
 */
export async function notifyTelegram(
  user: { telegramId?: string | null; telegramNotifications?: boolean } | null | undefined,
  text: string,
): Promise<void> {
  if (!user || !user.telegramNotifications || !user.telegramId) return;
  await sendTelegramMessage(user.telegramId, text);
}

/**
 * Create a Telegram Stars invoice link via the Bot API.
 * Returns the invoice URL string or throws on failure.
 */
export async function createInvoiceLink(opts: {
  title: string;
  description: string;
  payload: string;    // userId:productId:nonce — verified on successful_payment
  currency: "XTR";   // always XTR for Telegram Stars
  amount: number;    // in Stars (1 Star = 1 unit for XTR)
}): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const body = {
    title: opts.title,
    description: opts.description,
    payload: opts.payload,
    currency: opts.currency,
    prices: [{ label: opts.title, amount: opts.amount }],
    // No provider_token for Stars (digital goods, Stars only)
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok: boolean; result?: string; description?: string };
  if (!data.ok) throw new Error(`Telegram createInvoiceLink failed: ${data.description}`);
  return data.result!;
}

/**
 * Answer a pre_checkout_query — must be called within 10 seconds.
 */
export async function answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pre_checkout_query_id: queryId, ok, error_message: errorMessage }),
  }).catch(() => {});
}

/**
 * Register the webhook URL with Telegram.
 * Call once on server startup when TELEGRAM_WEBHOOK_URL is set.
 */
export async function registerWebhook(webhookUrl: string, secretToken: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "pre_checkout_query", "successful_payment"],
      }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else {
      logger.warn({ data }, "Telegram webhook registration failed");
    }
  } catch (err) {
    logger.warn({ err }, "Telegram webhook registration error");
  }
}
