---
name: DriftLife Telegram & Payment Fixes
description: Root causes and fixes for the Telegram bot not responding and subscription grant failures
---

# DriftLife Telegram & Payment Fixes

## Root causes fixed

### 1. Webhook never registered (bot completely silent)
`registerWebhook()` existed but was never called. Added call to `index.ts` startup,
gated on both `TELEGRAM_WEBHOOK_URL` AND `TELEGRAM_WEBHOOK_SECRET` being set.

### 2. Invalid `allowed_updates` type
`"successful_payment"` is NOT a valid Telegram update type — it arrives as a
sub-field of a `message` update. Including it in `allowed_updates` caused
webhook registration to fail silently.
**Fix:** `allowed_updates: ["message", "pre_checkout_query"]` only.

### 3. MongoDB subscription update bug (neon_syndicate / apex_sovereign broken)
`$addToSet` and `$inc` were accidentally nested inside `$set` when granting
subscriptions with frames or NC. MongoDB rejected/ignored these.
**Fix:** Build a single `updateOp` object with `$set`, `$addToSet`, `$inc` as
top-level keys.

### 4. Webhook secret mandatory
Webhook endpoint was optional on secret — anyone could POST forged
`successful_payment` events. Now returns 503 if secret not configured,
and startup skips registration if secret is missing (with a warning).

## Inline keyboard menus (current state)
All bot commands now serve inline keyboard menus. Helpers:
`showMainMenu`, `showStatus`, `showPacksList`, `showTiersList`, `sendPackInvoice`, `sendTierInvoice`.
Callback data format: `menu`, `status`, `packs`, `tiers`, `buy:<packId>`, `sub:<tierId>`.
`callback_query` is in `allowed_updates`. `answerCallbackQuery` called immediately on every button tap.

## NC subscription purchase (in-game)
`POST /api/store/buy-subscription-nc { tierId }` — buys a 30-day subscription with NC.
Pricing: 6 NC/Star (1500/3000/6000 for street_runner/neon_syndicate/apex_sovereign).
Uses Mongoose session+transaction so NC deduction, grant, and NcPurchaseLog all commit atomically.
`NcPurchaseLog` model in `models/NcPurchaseLog.ts` for audit trail.

## StorePage dual payment
Each subscription tier card shows two buttons:
- `⭐ X Stars via Telegram` — existing Stars flow (opens invoice link)
- `💰 X,XXX NC (in-game)` — confirm→API call flow; disabled/greyed if insufficient NC

## New bot commands
`/status`, `/buy [pack_id]`, `/subscribe [tier_id]` — look up user by `telegramId`,
then call `sendInvoice()` (new helper, direct bot→chat invoice) rather than
`createInvoiceLink()` (which requires the web app to open the link).

## Rate limiting
`checkInvoiceRate(chatId)` — 5 invoices/minute per chatId — prevents
unbounded `_pending` map growth from bot command spam.

## Required env vars on Render
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME` (falls back to `DriftLifeBot` if unset)
- `TELEGRAM_WEBHOOK_URL` — full URL: `https://your-render-domain/api/telegram/webhook`
- `TELEGRAM_WEBHOOK_SECRET` — shared secret between Render and Telegram

**Why:** Without all four, the bot will not respond (webhook not registered)
or payment grants will be insecure (no secret = anyone can forge payments).
