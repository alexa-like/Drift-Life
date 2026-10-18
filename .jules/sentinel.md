## 2025-05-18 - Hardcoded Webhook Secret Token Risks
**Vulnerability:** A hardcoded webhook secret token was present in `routes/telegram.ts` and `index.ts`, allowing static secret verification.
**Learning:** Hardcoding static fallback secrets in code exposes secret tokens in repository sources. If exposed or committed, attackers can forge webhook events (such as payment receipts) to manipulate state or grant unauthorized in-game items/currency.
**Prevention:** Strictly enforce that webhook secret validation depends on environment variables (`process.env["TELEGRAM_WEBHOOK_SECRET"]`). If the environment variable is not configured, reject incoming webhook requests with 401 Unauthorized (fail-secure pattern) and prevent webhook registration on startup.
