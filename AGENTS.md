# AGENTS.md

## Project overview

BoyfriendPoints is a Venmo-style couples rewards app.

- Frontend: React 18 + Vite (`src/`). Screens in `src/screens/`. Auth context in
  `src/auth.tsx` (Neon email/password, Apple, and demo personas).
- Backend: Express (`server/app.ts`) with pure domain logic in `server/domain.ts`.
- Database: **Neon Postgres** via Drizzle (`server/db/schema.ts`, `server/store.ts`).
  Connection from `DATABASE_URL` in `.env` (gitignored).
- Auth: Neon Managed Better Auth for email/password (`VITE_NEON_AUTH_URL`), optional
  Apple Sign In (`VITE_APPLE_CLIENT_ID` / `APPLE_CLIENT_ID`), plus demo persona picker.
  After Neon/Apple identity verification the API issues an app token (`bp_token`) via
  `POST /api/auth/neon` or `POST /api/auth/apple`. Demo still uses `POST /api/auth/device`.
- Mock seed (`server/seed.ts`) creates Emma + Noah (primary household with pending
  requests, prizes, points) plus three community couples that fill the feed.
  `pnpm db:reset` wipes Neon and re-seeds.

## Commands

- `pnpm install` / `pnpm dev` / `pnpm test` / `pnpm lint` / `pnpm typecheck` / `pnpm build`
- `pnpm mobile` / `pnpm mobile:ios` — Expo app in `mobile/` (Expo Go; API at `localhost:3001`)
- `pnpm db:push` — push Drizzle schema to Neon (uses `DATABASE_URL_UNPOOLED` if set)
- `pnpm db:reset` — truncate + re-seed mock data
- `pnpm db:studio` — Drizzle Studio

## Cursor Cloud specific instructions

- Open the UI at http://localhost:5173 (not :3001). Vite proxies `/api` to Express.
- Requires `DATABASE_URL` and `VITE_NEON_AUTH_URL` / `NEON_AUTH_URL` in `.env`
  (permanent Neon project **LoveReceipts**). Optional Apple: `VITE_APPLE_CLIENT_ID`,
  `VITE_APPLE_REDIRECT_URI`, `APPLE_CLIENT_ID`.
- **Cloudflare hosting:** `pnpm deploy` builds the SPA and deploys
  `worker/index.ts` (Hono API + static assets) via Wrangler. Needs
  `CLOUDFLARE_API_TOKEN` in the environment. Set the Worker secret with
  `pnpm cf:secret` (`DATABASE_URL`). Config lives in `wrangler.toml`
  (`assets` → `./dist`, `run_worker_first` for `/api/*`).
- Local Express (`pnpm dev`) and the Cloudflare Worker share `server/domain.ts`
  and `server/db/*`. The Worker path uses `server/hono.ts` and loads/saves Neon
  state per request (stateless isolates).
- `esbuild` postinstall is allowlisted via `pnpm.onlyBuiltDependencies` — do not run
  interactive `pnpm approve-builds`.
- Server code uses explicit `.ts` import extensions for `tsx`;
  `tsconfig.server.json` sets `allowImportingTsExtensions`.
- Persistence is wipe-and-rewrite of the full in-memory state to Neon on each
  mutation (demo scale). Writes are serialized in `server/index.ts` so overlapping
  saves don't race. Domain unit tests stay in-memory and do not need Neon.
- Tap the header avatar to switch personas (clears the device token and returns to
  the picker).
