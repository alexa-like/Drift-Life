# DriftLife

## Overview
DriftLife is a browser-based cyberpunk crime RPG. Monorepo (pnpm workspace) with:
- `artifacts/api-server` — Express + MongoDB (Mongoose) backend, port 8080 internally
- `artifacts/driftlife` — React + Vite frontend
- `artifacts/mockup-sandbox` — component preview sandbox for design work

Production is deployed separately on Render (see `render.yaml`) — this Replit is a dev/testing copy. Changes here need to be pushed and deployed to Render to go live.

## Running
Three workflows: `API Server`, `web` (frontend), and `Component Preview Server` (canvas sandbox, start on demand). Requires secrets: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (all configured). The frontend dev server proxies `/api` to the API server on port 8080 (`vite.config.ts` `server.proxy`) so the two workflows can talk to each other locally.

## User preferences
None recorded yet.
