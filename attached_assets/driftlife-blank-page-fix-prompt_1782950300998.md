# DriftLife — Blank Page Diagnosis & Fix Prompt

## Context for the agent

The live deployment at **https://driftlife-wrsh.onrender.com/** is showing a **blank page** with no visible UI — confirmed both via automated fetch and manual browser check on mobile. The page returns basic HTML (title "DriftLife") but no rendered application content is appearing.

This is a single Render.com web service serving a React/Vite frontend build through an Express backend. Your job is to find the root cause and fix it — **do not guess or apply a random fix without confirming the actual cause first.**

---

## Step 1: Reproduce and gather evidence

1. Open https://driftlife-wrsh.onrender.com/ and check the **browser console** for JavaScript errors (404s on JS/CSS bundles, uncaught exceptions, CORS errors, etc.)
2. Check the **Network tab** — confirm whether the JS/CSS bundle files are actually being requested and returned with status 200, or if they're 404ing / returning HTML instead of JS (a common sign of incorrect static file routing).
3. View page source (not devtools — actual "view source") to see what HTML is actually being served, and whether the root `<div id="root">` (or equivalent) is present.
4. Pull the **Render deployment logs** for the most recent deploy — check for build failures, warnings, or errors during `npm run build` / `vite build`, and confirm the start command is running correctly.

## Step 2: Check the most common causes of this exact symptom

Go through each of these systematically and report what you find, even if it turns out not to be the cause:

- **Build output path mismatch**: Confirm the Vite build output directory (usually `dist/`) matches exactly what the Express server is configured to serve as static files. A mismatched path is the single most common cause of this exact symptom (page loads, no JS/CSS applied).
- **Express static file serving order**: Confirm `express.static()` is correctly pointed at the build folder, and that this middleware is registered **before** any catch-all/wildcard route, and that the wildcard route (`app.get('*', ...)`) correctly serves `index.html` for client-side routing without breaking asset requests.
- **Vite `base` config**: Check `vite.config.js`/`vite.config.ts` for a `base` path setting that doesn't match how the app is being served — this can cause all asset URLs to resolve incorrectly in production even though the dev server works fine.
- **Build not actually running / stale build**: Confirm the Render build command is actually building the frontend (e.g. `npm install && npm run build`) and not just starting the server against a missing or outdated `dist/` folder.
- **Environment variables missing at build time**: If the frontend reads any `VITE_*` env vars at build time (e.g. API URL), confirm they're set in Render's environment — missing ones can cause the app to fail silently on mount.
- **JS runtime error on mount**: If the bundle loads fine (200 status) but the page is still blank, check for a JavaScript error thrown during React app initialization (e.g. a bad import, missing provider, crashed root component) that would prevent anything from rendering.
- **render.yaml misconfiguration**: If a `render.yaml` is present, confirm the `buildCommand` and `startCommand` match the actual project structure and haven't drifted from what the codebase now expects.

## Step 3: Fix and verify

1. Identify the actual root cause from the above (not multiple guesses — pin it down).
2. Apply the minimal fix needed.
3. Redeploy.
4. **Verify the fix by actually loading https://driftlife-wrsh.onrender.com/ and confirming visible UI renders**, not just that the build succeeded — a successful build/deploy is not the same as confirming the fix worked.
5. Report back: what the root cause was, what was changed, and confirmation that the live URL now renders the app correctly.

## Rules

- Do not mark this complete until you have visually confirmed the app renders on the live URL, not just that the deploy succeeded.
- Do not apply unrelated changes, refactors, or "improvements" while investigating — stick to the diagnosis and the minimal fix.
- Do not claim the issue is fixed without providing the specific evidence (log line, config diff, console error resolved, etc.) tying the fix to the cause.
