---
name: Express 5 Wildcard Routes
description: Express 5 rejects bare `*` wildcard route patterns at startup; use named wildcard syntax instead.
---

## Rule
Never use `app.get("*", ...)` in Express 5. It throws a `PathError: Missing parameter name` at server startup before any requests are served.

## Correct syntax
```typescript
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientBuild, "index.html"));
});
```

**Why:** Express 5 upgraded to `path-to-regexp` v8 which requires all wildcards to be named parameters. The old Express 4 `*` syntax is no longer valid.

**How to apply:** Any time a catch-all SPA fallback route is added to an Express 5 app, use `/{*splat}` (or `/{*path}`, any name works). This applies to `app.ts` in the api-server artifact.
