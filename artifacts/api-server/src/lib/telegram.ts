import { logger } from "./logger";

let warnedMissingToken = false;

function getToken(): string | undefined {
  return process.env["TELEGRAM_BOT_TOKEN"];
}

// ── Low-level types ───────────────────────────────────────────────────────────

type InlineKeyboard = Array<Array<{ text: string; callback_data: string }>>;

// ── Basic messaging ───────────────────────────────────────────────────────────

/**
 * Sends a Telegram DM to a user via the bot API. No-ops gracefully when
 * TELEGRAM_BOT_TOKEN is not configured. Never throws.
 * Returns the sent message_id (for later editing) or null on failure.
 */
export async function sendTelegramMessage(
  chatId: string | null | undefined,
  text: string,
): Promise<number | null> {
  const token = getToken();
  if (!token) {
    if (!warnedMissingToken) {
      logger.info("TELEGRAM_BOT_TOKEN not set — Telegram disabled");
      warnedMissingToken = true;
    }
    return null;
  }
  if (!chatId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "Telegram sendMessage failed");
      return null;
    }
    const data = await res.json() as { ok: boolean; result?: { message_id: number } };
    return data.result?.message_id ?? null;
  } catch (err) {
    logger.warn({ err }, "Telegram sendMessage error");
    return null;
  }
}

/**
 * Send a message with an inline keyboard (button menu).
 * Returns the sent message_id or null on failure.
 */
export async function sendMessageWithKeyboard(opts: {
  chatId: string;
  text: string;
  inlineKeyboard: InlineKeyboard;
}): Promise<number | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: opts.inlineKeyboard },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body }, "Telegram sendMessageWithKeyboard failed");
      return null;
    }
    const data = await res.json() as { ok: boolean; result?: { message_id: number } };
    return data.result?.message_id ?? null;
  } catch (err) {
    logger.warn({ err }, "Telegram sendMessageWithKeyboard error");
    return null;
  }
}

/**
 * Edit an existing message's text and keyboard in-place.
 * Used to update the "screen" when a user taps an inline button.
 */
export async function editMessageText(opts: {
  chatId: string;
  messageId: number;
  text: string;
  inlineKeyboard?: InlineKeyboard;
}): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        message_id: opts.messageId,
        text: opts.text,
        parse_mode: "HTML",
        reply_markup: opts.inlineKeyboard
          ? { inline_keyboard: opts.inlineKeyboard }
          : undefined,
      }),
    });
  } catch (err) {
    logger.warn({ err }, "Telegram editMessageText error");
  }
}

/**
 * Acknowledge a callback_query — must be called within 60s.
 * Optionally show a brief toast notification to the user.
 */
export async function answerCallbackQuery(queryId: string, text?: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: queryId,
      ...(text ? { text, show_alert: false } : {}),
    }),
  }).catch(() => {});
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

// ── Payments ──────────────────────────────────────────────────────────────────

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
 * Send a Telegram Stars invoice directly to a chat (for bot-initiated purchases).
 * Use this when the bot itself wants to trigger payment — e.g. from a /buy command.
 */
export async function sendInvoice(opts: {
  chatId: string;
  title: string;
  description: string;
  payload: string;
  currency: "XTR";
  amount: number;
}): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const body = {
    chat_id: opts.chatId,
    title: opts.title,
    description: opts.description,
    payload: opts.payload,
    currency: opts.currency,
    prices: [{ label: opts.title, amount: opts.amount }],
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendInvoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram sendInvoice failed: ${data.description}`);
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

// ── Bot configuration ─────────────────────────────────────────────────────────

/**
 * Register the bot's command list shown in the Telegram command picker (/ menu).
 */
export async function setMyCommands(
  commands: Array<{ command: string; description: string }>,
): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info("Telegram bot commands registered");
    } else {
      logger.warn({ data }, "Telegram setMyCommands failed");
    }
  } catch (err) {
    logger.warn({ err }, "Telegram setMyCommands error");
  }
}

/**
 * Register the webhook URL with Telegram.
 * Call once on server startup when TELEGRAM_WEBHOOK_URL is set.
 *
 * NOTE: "successful_payment" is NOT a valid allowed_updates type — it is a
 * sub-field delivered inside a regular "message" update. Including it causes
 * Telegram to reject or ignore the registration silently.
 */
/**
 * Broadcast a Telegram message to every player who has linked their account
 * and has Telegram notifications enabled. Fire-and-forget safe.
 */
export async function broadcastTelegramToLinkedUsers(text: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    // Dynamic import to avoid circular deps (models → lib/telegram is fine,
    // but we keep this lazy to be safe)
    const { default: User } = await import("../models/User");
    const users = await User.find({
      telegramId: { $ne: null },
      telegramNotifications: true,
    }).select("telegramId").lean();

    await Promise.allSettled(
      users.map((u) => sendTelegramMessage((u as any).telegramId as string, text).catch(() => {}))
    );
  } catch (err) {
    logger.warn({ err }, "broadcastTelegramToLinkedUsers failed");
  }
}

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
        // "successful_payment" is NOT a valid top-level update type — it
        // arrives as part of a "message" update. Only list real update types.
        allowed_updates: ["message", "pre_checkout_query", "callback_query"],
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
