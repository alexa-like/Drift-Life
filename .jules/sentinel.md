## 2025-05-20 - JWT Secret Environment Variable Fallback
**Vulnerability:** JWT tokens were signed and verified using static hardcoded keys, ignoring environment configuration and allowing potential token forgery in production.
**Learning:** Production applications using JWT authentication must validate that secret environment variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `JWT_SECRET`) are present in production (`NODE_ENV === "production"`) and fail closed (throw an error) if missing.
**Prevention:** Always read secrets dynamically via helper functions that enforce environment variable requirements in production mode.
