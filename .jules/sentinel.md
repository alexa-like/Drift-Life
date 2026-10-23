## 2025-05-18 - Hardcoded Admin Setup Key Fallback
**Vulnerability:** The `/admin-setup` endpoint contained a hardcoded fallback string for `validKey` when setting up owner access.
**Learning:** Hardcoded default credentials or static secret fallbacks in administrative setup endpoints can allow unauthorized privilege escalation if exposed or committed.
**Prevention:** Always require environment variables (e.g. `SETUP_KEY`) for admin bootstrapping and fail closed when the environment variable is unset.
