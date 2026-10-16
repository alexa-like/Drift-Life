## 2025-05-18 - Dynamic JWT Secret Resolution & Production Fail-Closed Safeguard
**Vulnerability:** Static hardcoded JWT secrets in `artifacts/api-server/src/lib/jwt.ts` ignored environment variables and allowed potential token forgery across environments.
**Learning:** Hardcoded JWT secret fallbacks MUST NOT be active in production mode (`NODE_ENV === "production"`), or deployed instances will remain vulnerable even if admins specify environment variables elsewhere.
**Prevention:** Always read secrets dynamically via accessor functions and throw a fatal error when running in production without required secret environment variables.
