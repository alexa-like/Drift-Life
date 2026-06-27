---
name: DriftLife TypeScript Config
description: Express route handlers need noImplicitReturns disabled in api-server tsconfig
---

Express 5 async route handlers trigger TS7030 ("Not all code paths return a value") because TypeScript cannot prove that res.json() terminates the function. 

**Fix:** `artifacts/api-server/tsconfig.json` has `"noImplicitReturns": false`.

**Why:** bcryptjs + Express 5 + strict TS together cause widespread TS7030. The tradeoff is accepted — the code is correct, TypeScript just can't prove it.

**How to apply:** Do not re-enable noImplicitReturns in the api-server tsconfig. It will break ~50+ route handlers.
