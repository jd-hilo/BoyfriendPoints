# BoyfriendPoints

Track and manage boyfriend points — a playful, Venmo-style rewards app for couples.

A wife or girlfriend signs up, creates **prizes** her boyfriend can redeem, invites her
**boyfriend**, and follows her **friends**. Boyfriends submit the things they do (mowed
the lawn, cooked dinner) for points; the wife approves or revises the request. Points can
then be redeemed for prizes, and every earn/redeem shows up in a shared, Venmo-like
social feed across the friend network.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, mobile phone-framed UI (`src/`).
- **Backend:** Express + TypeScript REST API with token auth (`server/`).
- **Shared types:** `shared/types.ts`.
- **Storage:** a JSON file at `data/store.json` (gitignored), auto-seeded with a demo
  community so the feed is populated on first run.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the Express API
on port 3001.

### Try it

1. **Sign up** as a wife/girlfriend.
2. **Onboarding:** pick a few prizes, invite your boyfriend (note the login shown), and
   add a friend.
3. Open a second browser/incognito window and **sign in as the boyfriend** with the
   invite credentials.
4. Boyfriend: **Submit** a chore for points; Wife: **approve** it under Requests;
   Boyfriend: **Redeem** a prize; Wife: sees the **redemption alert**.

Seeded demo accounts (password `points`) are available too, e.g. `priya@demo.boyfriendpoints.app`.

## Scripts

- `pnpm dev` — run backend + frontend together.
- `pnpm test` — Vitest (server domain + API + a React test).
- `pnpm lint` — ESLint.
- `pnpm typecheck` — `tsc -b`.
- `pnpm build` — type-check and build the frontend.

## Project structure

```
server/
  domain.ts     pure business logic (users, prizes, tasks, submissions, redemptions, feed)
  app.ts        Express routes + auth middleware
  seed.ts       demo community used on first run
  store.ts      JSON persistence
  index.ts      bootstrap
src/
  screens/      AuthScreen, Onboarding, Feed, Submit, Redeem, WifeRequests, WifeManage, MainApp
  auth.tsx      auth context
  api.ts        typed API client
  ui.tsx        PhoneFrame, Avatar, Button, PointsPill
shared/types.ts shared domain types
```
