# DriftLife — Account Verification & Linking System
**Agent Build Prompt**

## Overview

DriftLife needs two DISTINCT systems, each available on both Discord and Telegram:

1. **Verification** — a one-time identity check. No permanent connection is stored. Used purely to confirm the player owns the account they claim to.
2. **Linking** — a persistent connection between the platform account and the game account, used for ongoing features (see platform-specific purposes below).

These are separate flows with separate links. Do not merge their logic.

---

## 1. Verification Flow (Discord OR Telegram, player's choice)

- Player initiates verification from the game's signup/account page.
- Player picks **Discord** or **Telegram** as their verification method (default options — no Gmail shown yet).
- **No manual username entry required on either platform.** The player never types their Discord or Telegram username into the game. Identity is carried automatically via the mechanisms below.
- Code expires in **30 seconds**. After expiry, the code is invalidated and deleted/cleared from the system.
- Player enters the code back on the game's verification page to complete the one-time check.
- **Nothing is stored** after this completes — no persistent Discord/Telegram ↔ game account link is created from this flow alone. It's purely a proof-of-ownership step.

### Telegram delivery mechanism — deep link (avoids "bot can't message user first" restriction)
Telegram bots cannot message a user who hasn't started a conversation with them. Do NOT attempt to send unsolicited messages — instead:
- Game generates a unique link in the format: `t.me/YourBotUsername?start=<token>`
- Player taps the link on the game's verification page → Telegram opens → this automatically sends `/start <token>` to the bot on the player's behalf.
- That `/start <token>` message is the player initiating the chat, so the bot is now permitted to reply directly in that chat.
- The `<token>` embedded in the link already identifies which game account this verification request belongs to — no username input needed anywhere.
- Bot replies in that same direct chat with the verification code (see message format below).

### Discord delivery mechanism — ephemeral reply (avoids DM privacy/opt-out restrictions)
Many Discord users have "Allow direct messages from server members" disabled, which blocks bot DMs unreliably. Do NOT rely on DMs — instead:
- Player joins the server → goes to `#verify-account` channel → runs a slash command (e.g. `/verify`) or taps a button.
- Bot responds with an **ephemeral message** — a reply visible only to the player who triggered it, posted directly in the channel (not a DM, not visible to any other member).
- This satisfies the "only the requesting player can see their code" requirement without depending on DM settings or shared-server DM permissions.
- The player's Discord user ID (from the interaction) is what ties the code request to their session — no manual username entry needed.

### Message format (Discord DM / Telegram bot chat)
```
Hey {PlayerName},
Here's your DriftLife verification code:

{CODE}  ← tap/tap-hold to copy

Expires in 30 seconds.
```
- Code must be easily copiable (tap-to-copy or long-press-to-copy depending on platform capability).
- **Resend option**: if the code expires or player needs a new one, they can request a resend — this invalidates the old code immediately and generates a new one with a fresh 30-second timer. Available on both Discord and Telegram.

### Failure handling — 3-attempt fallback
- If the player fails to enter a valid code correctly within **3 attempts**, show an inline prompt:
  > "Having trouble verifying? [Yes, try email instead] [No, try again]"
- If they choose email: switch to the **existing Gmail code verification flow** — do not touch or modify that system's own code expiry or logic, it stays exactly as it currently works. Just route the player there as a fallback option, not a default.
- If they choose to keep trying: reset attempt count and let them continue with Discord/Telegram.

---

## 2. Linking Flow (persistent, separate link from verification)

This is a second, separate link/button — distinct from the verification link above. This one **does** store a permanent connection between the platform account and the game account.

### Telegram Linking
- **Purpose**: enables in-game premium currency purchases through the Telegram bot.
- On completion, store a persistent mapping: Telegram user ID ↔ game account ID.
- Once linked, the player can use Telegram bot commands to purchase premium currency, which reflects in their game account.

### Discord Linking
- **Purpose**: enables chat access, bug reports, suggestions, and other community features on the Discord server.
- On completion:
  - Store a persistent mapping: Discord user ID ↔ game account ID.
  - Auto-sync the player's in-game username as their Discord server nickname.
  - Remove the "Unverified" role and assign the "Verified" role (unlocks gated channels per existing server permission setup).

### Linking delivery mechanism
Use the exact same delivery methods as the verification flow above:
- **Telegram**: deep link (`t.me/YourBotUsername?start=<token>`) — tapping it auto-starts the chat and carries the token, no username entry.
- **Discord**: ephemeral reply to a slash command/button in `#link-account` (or reuse `#verify-account` with a separate button) — visible only to the requesting player, no DM dependency.

Same private, copiable, 30-second-expiry code format as verification (see above). Resend option available here too, same behavior (invalidate old code, issue new one, reset timer).

---

## Summary of the 4 total flows

| Platform | Link Type | Purpose | Stores connection? |
|---|---|---|---|
| Telegram | Verification | One-time identity proof | No |
| Telegram | Linking | Enable premium currency purchases | Yes |
| Discord | Verification | One-time identity proof | No |
| Discord | Linking | Enable chat/reports/community access, nickname sync, role assignment | Yes |

Gmail verification remains the existing, untouched fallback system — only used after 3 failed attempts on Discord/Telegram verification, and only for the verification flow (not linking).

---

## Security notes
- Telegram codes are delivered via the bot's direct chat with the player (opened by the deep link tap) — never in a group chat.
- Discord codes are delivered via ephemeral interaction replies — never as a DM (unreliable due to privacy settings) and never posted where other members can see it.
- Codes are single-use and expire after 30 seconds regardless of platform.
- Resend must invalidate the previous code immediately to prevent stale/duplicate codes being valid simultaneously.
- Tokens embedded in deep links and interaction sessions should be single-use and tied to the specific verification/linking request — do not reuse tokens across requests.
