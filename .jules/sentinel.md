## 2025-05-18 - AuthRequest Property Mismatch in Express Routers
**Vulnerability:** `ownerBattlePassRouter` attempted to check `req.user?.role` inline for authorization, but the JWT auth middleware populates `req.role` on Express `AuthRequest` (leaving `req.user` undefined). This resulted in `undefined?.role` evaluation blocking authorized users and creating fragile route-level authorization logic.
**Learning:** `AuthRequest` in this codebase decorates `req.userId`, `req.username`, and `req.role` directly on `req` instead of nesting them inside `req.user`.
**Prevention:** Always mount standard auth middleware functions like `requireOwner` at the router level (`router.use(requireOwner as any)`) rather than writing manual inline role checks on `req`.
