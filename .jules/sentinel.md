## 2025-05-20 - Hardcoded Setup Secret and Role Privilege Escalation

**Vulnerability:**
The `/api/auth/admin-setup` endpoint contained a hardcoded secret setup key string in the codebase instead of requiring an environment variable. Additionally, `POST /api/owner/set-role` lacked owner-level authorization checks, allowing staff role accounts to escalate privileges to admin or owner.

**Learning:**
Fallback defaults for initial setup/admin bootstrap routes can accidentally expose hardcoded credentials if environment variables are not strictly required. Furthermore, relying on top-level router middleware without route-specific role checks can leave sensitive privilege management routes exposed to lower-level administrative roles.

**Prevention:**
Always require explicit environment variables (`process.env["SETUP_KEY"]`) without fallback secrets for administrative bootstrapping, and strictly enforce `requireOwner` guards on all role-management endpoints.
