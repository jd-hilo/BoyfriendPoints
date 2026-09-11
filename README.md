# Love Receipts

Venmo-style rewards for couples. One partner sets tasks and prizes; the other
earns points and redeems them. Shared wins show up as receipts in a social feed.

**Product name:** Love Receipts / LoveReceipts  
**Internal / code name:** BoyfriendPoints (`boyfriendpoints` in package and Worker
names). Domain types still use `wife` / `boyfriend` roles; product UI prefers
partner language.

## Features

- **Household** — create a couple (username + invite code) or join with a partner’s code
- **Tasks & points** — catalog of earn tasks; submit with notes/photos; approve, deny, or revise; optional unprompted grants
- **Prizes** — define rewards and redeem points; fulfill redemptions
- **Receipt feed** — Venmo-like social feed of earns/redeems with reactions and comments
- **Friends** — connect households via couple code / username search and friend requests
- **Auth** — Neon Auth (email/password), optional Apple Sign In, plus seeded demo personas for local/dev

## Repo layout

```
src/          React 18 + Vite web app (phone-framed UI)
mobile/       Expo (React Native) iOS app — bundle app.lovereceipts.mobile
server/       Shared domain + API
  domain.ts   Pure business logic
  app.ts      Express routes (local + Railway)
  hono.ts     Hono routes (Cloudflare Worker)
  db/         Neon Postgres via Drizzle
  seed.ts     Mock households + community feed
worker/       Cloudflare Worker entry (`worker/index.ts` → Hono)
shared/       Shared TypeScript types (`shared/types.ts`)
```

Local Express and the Worker share `server/domain.ts` and `server/db/*`. The
Worker loads/saves Neon state per request (stateless isolates). Express keeps
state in memory and serializes writes to Neon on each mutation (demo scale).

## Stack

| Layer | Tech |
| --- | --- |
| Web | React 18, Vite, TypeScript |
| Mobile | Expo ~57, React Native, EAS (TestFlight) |
| API (local / iOS) | Express on Node (`server/app.ts`); production iOS API on Railway |
| API (web prod) | Cloudflare Worker + Hono (`server/hono.ts`) + Vite static assets |
| DB | Neon Postgres + Drizzle |
| Auth | Neon Managed Auth + optional Apple; app issues `bp_token` sessions |
| Analytics | PostHog (optional via env) |

## Prerequisites

- Node.js + [pnpm](https://pnpm.io) 10 (`packageManager` is pinned in `package.json`)
- A Neon Postgres database (`DATABASE_URL`)
- Neon Auth URL for email/password (`VITE_NEON_AUTH_URL` / `NEON_AUTH_URL`)

## Local development (web + API)

1. Create `.env` in the repo root (gitignored):

   ```bash
   DATABASE_URL=postgresql://...
   DATABASE_URL_UNPOOLED=postgresql://...   # optional; drizzle-kit push prefers this
   VITE_NEON_AUTH_URL=https://…/neondb/auth
   NEON_AUTH_URL=https://…/neondb/auth      # server-side; can match VITE_
   NEON_JWKS_URL=https://…/neondb/auth/.well-known/jwks.json   # optional override
   # Optional Apple (web):
   VITE_APPLE_CLIENT_ID=…          # Services ID
   VITE_APPLE_REDIRECT_URI=…       # defaults to window.location.origin
   APPLE_CLIENT_ID=…               # server verification
   # Optional analytics:
   VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=…
   VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

2. Install, push schema, seed, run:

   ```bash
   pnpm install
   pnpm db:push
   pnpm db:reset
   pnpm dev
   ```

3. Open **http://localhost:5173** (Vite). The API listens on **:3001**; Vite
   proxies `/api` → Express. Do not use :3001 for the UI.

### Demo personas

After `pnpm db:reset`, the auth screen can open a demo persona picker (Emma /
Noah plus community couples that fill the feed). Tap the header avatar to clear
the device session and return to the picker.

`pnpm db:reset` truncates Neon and re-seeds. Domain unit tests run in-memory and
do not need a database.

## Mobile (Expo)

```bash
pnpm mobile          # Expo Go (LAN)
pnpm mobile:ios      # iOS Simulator / Expo Go
```

The app lives in `mobile/` (separate `package.json`). Production builds target
iOS bundle id `app.lovereceipts.mobile` and talk to the Railway API
(`EXPO_PUBLIC_API_URL` / `extra.apiUrl` in `mobile/app.json` and `mobile/eas.json`).

To point a local Expo client at your machine’s API:

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3001/api pnpm mobile
```

Ship iOS via EAS:

```bash
pnpm mobile:eas:ios   # eas build --platform ios --profile production --auto-submit
```

## Cloudflare Worker (web production)

Production web is a Worker that serves the Vite SPA (`dist/`) and handles
`/api/*` first (`wrangler.toml` → `run_worker_first`).

```bash
# one-time: Worker secret
pnpm cf:secret          # wrangler secret put DATABASE_URL
# optional: wrangler secret put APPLE_CLIENT_ID

# build SPA + deploy
pnpm deploy
```

Needs `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, Account:Read). Optional:
`CLOUDFLARE_ACCOUNT_ID`. Non-secret Worker vars (`NEON_AUTH_URL`, `NEON_JWKS_URL`,
PostHog) live in `wrangler.toml`.

Local Worker preview: copy `.dev.vars.example` → `.dev.vars`, then `pnpm cf:dev`.

`.dev.vars.example`:

```
DATABASE_URL=
NEON_AUTH_URL=
NEON_JWKS_URL=
APPLE_CLIENT_ID=
```

## Railway (iOS API)

`railway.toml` runs the Express API only (`pnpm start:api`), health check
`/api/health`. The Railway deploy ignores the web client and Worker
(`.railwayignore`). Configure `DATABASE_URL`, Neon Auth, and Apple env vars in
the Railway service — same server env names as local Express.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Express (:3001) + Vite (:5173) |
| `pnpm build` / `pnpm preview` | Production SPA build / preview |
| `pnpm start` / `pnpm start:api` | Production Express (Railway uses `start:api`) |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | Vitest, ESLint, `tsc` |
| `pnpm db:push` | Apply Drizzle schema to Neon |
| `pnpm db:reset` | Wipe + re-seed mock data |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm deploy` | `pnpm build` + `wrangler deploy` |
| `pnpm cf:dev` / `pnpm cf:secret` | Worker preview / set `DATABASE_URL` secret |
| `pnpm mobile` / `pnpm mobile:ios` / `pnpm mobile:eas:ios` | Expo / EAS |

## Auth notes

After Neon or Apple identity verification, the API issues an app session token
via `POST /api/auth/neon` or `POST /api/auth/apple`. Demo personas use
`POST /api/auth/device`. Sessions are per-device rows in Neon (`server/db/sessions.ts`),
not part of the wipe-and-rewrite state snapshot. A legacy shared `users.token`
is still accepted for older clients; without a DB (unit tests) the API falls
back to that legacy token.

## Agent / contributor notes

Cursor agent guidance lives in [`AGENTS.md`](./AGENTS.md) (commands, Cloud setup,
persistence quirks). Prefer that file for agent workflows; this README is the
human-facing product and setup overview.
