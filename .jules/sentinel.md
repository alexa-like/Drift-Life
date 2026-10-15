## 2025-05-18 - Authorization guard consistency in sub-routers
**Vulnerability:** `ownerBattlePassRouter` relied on `req.user?.role` checks inline rather than using `requireOwner` middleware. Because `requireAuth` populates `req.role` (and `req.userId`) instead of `req.user`, `req.user` was always undefined, causing internal checks to evaluate to `false` or bypass properly structured middleware checks.
**Learning:** In express apps with custom middleware, ensure sub-routers use shared auth middleware guards (e.g. `router.use(requireOwner)`) rather than assuming property names on `req`.
**Prevention:** Apply authorization middleware at the router level (`router.use(requireOwner)`) for all admin/owner sub-routers.
