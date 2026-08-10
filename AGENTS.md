# AGENTS.md

## Project overview

BoyfriendPoints is a full-stack TypeScript web app: a Venmo-style couples rewards app.
A wife/girlfriend signs up, creates prizes, invites her boyfriend and friends; boyfriends
submit deeds for points (wife approves/revises), then redeem points for prizes. Earn/redeem
events show up in a shared social feed across the friend network.

- Frontend: React 18 + Vite (`src/`, entry `src/main.tsx`). Top-level routing in `src/App.tsx`;
  screens in `src/screens/`; auth context in `src/auth.tsx`; typed API client in `src/api.ts`.
- Backend: Express API (`server/`, entry `server/index.ts`). Routes + token auth in `server/app.ts`;
  pure domain logic (fully unit-tested) in `server/domain.ts`; demo seed in `server/seed.ts`.
- Shared types: `shared/types.ts`.
- Storage: a JSON file at `data/store.json` (created on first write, gitignored). No database.
  On first load with no data file, the store auto-seeds a demo community so the feed is populated.
- Roles: `wife` (signs up, owns prizes/tasks, approves) and `boyfriend` (invited, earns/redeems).
  A boyfriend's economy is owned by his partner wife (`ownerWifeId`).

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
- Data persists to `data/store.json`. To reset app state, stop the dev server and remove `data/store.json`; on next start the store re-seeds the demo community (3 couples + a populated feed). Note the running server holds state in memory, so deleting the file without restarting has no effect.
- Auth is token-based: signup/login returns a token the client stores in `localStorage` (`bp_token`) and sends as `Authorization: Bearer <token>`. Passwords are stored in plaintext in the JSON store — this is a demo convenience, not production-ready.
- The UI is an original implementation styled after Venmo's general look (brand blue `#008CFF`, white transaction-feed rows); it does not use any Venmo logo or proprietary assets.
