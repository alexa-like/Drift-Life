## 2025-03-08 - Hardcoded Admin Setup Secret
**Vulnerability:** The `/admin-setup` route in `artifacts/api-server/src/routes/auth.ts` contained a hardcoded fallback secret key (`7dd93ffa96da6d072092adb907ae97d48a3b948d6c5954af0e9cf3199aa7ef68`) allowing arbitrary owner account creation/privilege escalation if `SETUP_KEY` environment variable was not set.
**Learning:** Fallback secret values in administrative bootstrapping routes bypass missing environment variable safeguards and introduce severe privilege escalation vulnerabilities.
**Prevention:** Always require administrative setup/bootstrap endpoints to fail closed with 403 Forbidden when required environment variables (such as `SETUP_KEY`) are unconfigured.
