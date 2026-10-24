## 2025-05-18 - Remove Hardcoded Key from Admin Setup
**Vulnerability:** A hardcoded secret string in `/api/auth/admin-setup` allowed owner access bootstrap without requiring environment configuration.
**Learning:** Hardcoded dev/setup fallback secrets in public route endpoints create backdoor access vectors if committed.
**Prevention:** Require explicit environment variables (`SETUP_KEY`) for sensitive administrative bootstrap endpoints, disable functionality when missing, and use `crypto.timingSafeEqual` with length checks for key verification.
