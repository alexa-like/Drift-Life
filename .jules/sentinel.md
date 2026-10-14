## 2025-05-18 - Auth Middleware req.role vs req.user Inconsistency
**Vulnerability:** Inconsistent route authorization checks across modules where some routes checked `req.user?.role` instead of `req.role` populated by `requireAuth` / `AuthRequest`.
**Learning:** `AuthRequest` in `artifacts/api-server/src/middlewares/auth.ts` attaches `userId`, `username`, and `role` directly on `req` (`req.role`), not under `req.user`. Relying on inline `req.user?.role` checks can lead to unhandled authorization bypasses or unauthenticated access if middleware expectations mismatch.
**Prevention:** Always use the centralized authorization middlewares (`requireOwner`, `requireStaff`, `requireAuth`) at the router or endpoint level instead of hand-rolled inline role checks.
