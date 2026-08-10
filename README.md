# BoyfriendPoints

Track and manage boyfriend points — a playful, Venmo-style rewards app for couples.

A wife or girlfriend creates **prizes**, invites her **boyfriend**, and follows her
**friends**. Boyfriends submit the things they do for points; she approves or revises.
Points are redeemed for prizes, and every earn/redeem shows up in a shared, Venmo-like
social feed.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, mobile phone-framed UI (`src/`).
- **Backend:** Express + TypeScript REST API with **device-based auth** (`server/`).
- **Database:** [Neon](https://neon.tech) Postgres via Drizzle ORM (`server/db/`).
- **Shared types:** `shared/types.ts`.

## Getting started

1. Copy a Neon connection string into `.env`:

   ```bash
   DATABASE_URL=postgresql://...
   DATABASE_URL_UNPOOLED=postgresql://...   # optional; used by drizzle-kit push
   ```

   Or claim the temporary DB provisioned for this workspace:
   see `NEON_CLAIM_URL` in `.env` (expires in 72h unless claimed).

2. Install, push schema, seed mock data, run:

   ```bash
   pnpm install
   pnpm db:push
   pnpm db:reset
   pnpm dev
   ```

3. Open http://localhost:5173 and **tap a persona** (Emma or Noah) — no password.

### Mock personas

| Persona | Role | Notes |
| --- | --- | --- |
| **Emma** | Wife | Pending point requests + a redemption alert |
| **Noah** | Boyfriend | 240 pts, prizes ready to redeem |
| Priya / Dev, Mia / Jake, Sofia / Leo | Community | Fill the Venmo-style feed |

Tap the avatar in the header to switch personas.

## Hosting (Cloudflare)

Production is a **Cloudflare Worker** that serves the Vite SPA (assets) and the
`/api/*` Hono backend against Neon.

```bash
# one-time: put your Neon URL into the Worker secret
pnpm cf:secret          # prompts for DATABASE_URL

# build + deploy to workers.dev / your route
pnpm deploy
```

Requires `CLOUDFLARE_API_TOKEN` (Account → Workers Scripts:Edit, Account:Read).
Optional: `CLOUDFLARE_ACCOUNT_ID`.

Local Worker preview: copy `.dev.vars.example` → `.dev.vars`, then `pnpm cf:dev`.

## Scripts

- `pnpm dev` — Express API (:3001) + Vite (:5173) for local development
- `pnpm deploy` — build SPA + deploy Worker to Cloudflare
- `pnpm cf:dev` / `pnpm cf:secret`
- `pnpm test` / `pnpm lint` / `pnpm typecheck` / `pnpm build`
- `pnpm db:push` — apply Drizzle schema to Neon
- `pnpm db:reset` — wipe + re-seed mock data
- `pnpm db:studio` — Drizzle Studio

## Project structure

```
server/
  domain.ts       pure business logic
  app.ts          Express routes + device auth
  seed.ts         mock household + community
  store.ts        Neon load/save via Drizzle
  db/schema.ts    Drizzle tables
  db/client.ts    Neon HTTP driver
src/
  screens/        AuthScreen (persona picker), Feed, Submit, Redeem, …
  auth.tsx        device-auth context
shared/types.ts
```
