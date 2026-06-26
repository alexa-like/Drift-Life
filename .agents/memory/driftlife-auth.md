---
name: DriftLife Auth Flow
description: Auth implementation details for DriftLife RPG
---

Custom JWT + bcryptjs + email OTP (Gmail SMTP via nodemailer).

Flow:
1. Register → creates user + sends 6-digit OTP to email (10min expiry)
2. Verify-email → OTP match → returns accessToken + refreshToken
3. Login → checks isEmailVerified, banned, password → returns tokens
4. Refresh → POST /api/auth/refresh with refreshToken → new accessToken

Token lifetimes: access=15min, refresh=30d.

Env vars: JWT_SECRET, JWT_REFRESH_SECRET, GMAIL_USER, GMAIL_PASS, MONGODB_URI, ENCRYPTION_KEY, GROQ_API_KEY, TELEGRAM_BOT_TOKEN.

**Why:** User wanted custom auth with email OTP, not third-party auth providers.

**How to apply:** All protected routes use `requireAuth` middleware from `src/middlewares/auth.ts`. Owner/admin routes use `requireOwner`.
