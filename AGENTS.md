# AGENTS.md

## Project overview

BoyfriendPoints is a full-stack TypeScript web app for tracking and managing "boyfriend points".

- Frontend: React 18 + Vite (`src/`, entry `src/main.tsx`, UI in `src/App.tsx`).
- Backend: Express API (`server/`, entry `server/index.ts`, routes in `server/app.ts`, pure logic in `server/points.ts`).
- Shared types: `shared/types.ts`.
- Storage: a JSON file at `data/store.json` (created on first write, gitignored). No database.

## Commands

All commands run from the repo root with `pnpm` (see `package.json` scripts):

- `pnpm dev` — runs backend (`tsx watch`, port 3001) and frontend (Vite, port 5173) together via `concurrently`. Open the app at http://localhost:5173.
- `pnpm test` — Vitest (server unit + supertest API tests + a jsdom React test).
- `pnpm lint` — ESLint (flat config in `eslint.config.js`).
- `pnpm typecheck` — `tsc -b` across the app/server/node project references.
- `pnpm build` — type-checks then builds the frontend to `dist/`.

## Cursor Cloud specific instructions

- Dependencies are managed by `pnpm`; the startup update script runs `pnpm install`.
- `esbuild` (a Vite dependency) needs its postinstall build script, which pnpm blocks by default. This is handled non-interactively via `pnpm.onlyBuiltDependencies` in `package.json` — do NOT run the interactive `pnpm approve-builds`.
- The app is two dev processes. The frontend must be reached at http://localhost:5173 (NOT 3001); Vite proxies `/api/*` to the Express server on port 3001 (see `server.proxy` in `vite.config.ts`). Hitting 3001 directly only serves the JSON API, not the UI.
- Server code uses explicit `.ts` import extensions because it runs under `tsx`. `tsconfig.server.json` sets `allowImportingTsExtensions` so `pnpm typecheck` passes; keep it when adding server files.
- Data persists to `data/store.json`. To reset app state, delete boyfriends via the UI/API (the server holds state in memory), or stop the dev server and remove `data/store.json` before restarting.
