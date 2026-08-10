# AGENTS.md

## Project overview

BoyfriendPoints is a Venmo-style couples rewards app.

- Frontend: React 18 + Vite (`src/`). Screens in `src/screens/`. Device-auth
  context in `src/auth.tsx` (tap a persona — no email/password).
- Backend: Express (`server/app.ts`) with pure domain logic in `server/domain.ts`.
- Database: **Neon Postgres** via Drizzle (`server/db/schema.ts`, `server/store.ts`).
  Connection from `DATABASE_URL` in `.env` (gitignored).
- Auth is device-based: `GET /api/personas` + `POST /api/auth/device` with a `userId`.
  The client stores the returned token in `localStorage` (`bp_token`).
- Mock seed (`server/seed.ts`) creates Emma + Noah (primary household with pending
  requests, prizes, points) plus three community couples that fill the feed.
  `pnpm db:reset` wipes Neon and re-seeds.

## Commands

- `pnpm install` / `pnpm dev` / `pnpm test` / `pnpm lint` / `pnpm typecheck` / `pnpm build`
- `pnpm db:push` — push Drizzle schema to Neon (uses `DATABASE_URL_UNPOOLED` if set)
- `pnpm db:reset` — truncate + re-seed mock data
- `pnpm db:studio` — Drizzle Studio

## Cursor Cloud specific instructions

- Open the UI at http://localhost:5173 (not :3001). Vite proxies `/api` to Express.
- Requires `DATABASE_URL` in `.env`. This workspace was bootstrapped with a
  [claimable Neon DB](https://neon.new); claim URL is in `.env` as `NEON_CLAIM_URL`
  (72h unless claimed). Prefer a permanent Neon project + `NEON_API_KEY` / saved
  `DATABASE_URL` secret for durable Cloud Agent runs.
- `esbuild` postinstall is allowlisted via `pnpm.onlyBuiltDependencies` — do not run
  interactive `pnpm approve-builds`.
- Server code uses explicit `.ts` import extensions for `tsx`;
  `tsconfig.server.json` sets `allowImportingTsExtensions`.
- Persistence is wipe-and-rewrite of the full in-memory state to Neon on each
  mutation (demo scale). Writes are serialized in `server/index.ts` so overlapping
  saves don't race. Domain unit tests stay in-memory and do not need Neon.
- Tap the header avatar to switch personas (clears the device token and returns to
  the picker).
