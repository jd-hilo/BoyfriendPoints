import 'dotenv/config';
import { createApp } from './app.ts';
import { createDbFromEnv } from './db/client.ts';
import { loadState, saveState } from './db/store.ts';

const PORT = Number(process.env.PORT ?? 3001);
const db = createDbFromEnv();

console.log('Connecting to Neon…');
const state = await loadState(db);
console.log(
  `Loaded ${state.users.length} users, ${state.feed.length} feed events from Neon`,
);

let pending: Promise<void> = Promise.resolve();
const persist = (next: typeof state) => {
  pending = pending
    .then(() => saveState(db, next))
    .catch((err) => {
      console.error('Failed to persist state to Neon:', err);
    });
};

const app = createApp({
  state,
  onChange: persist,
  db,
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LoveReceipts API listening on :${PORT}`);
});
