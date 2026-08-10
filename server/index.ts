import 'dotenv/config';
import { createApp } from './app.ts';
import { loadState, saveState } from './store.ts';

const PORT = Number(process.env.PORT ?? 3001);

console.log('Connecting to Neon…');
const state = await loadState();
console.log(
  `Loaded ${state.users.length} users, ${state.feed.length} feed events from Neon`,
);

let pending: Promise<void> = Promise.resolve();
const persist = (next: typeof state) => {
  // Serialize writes so overlapping saves don't race on the wipe-and-rewrite store.
  pending = pending
    .then(() => saveState(next))
    .catch((err) => {
      console.error('Failed to persist state to Neon:', err);
    });
};

const app = createApp({
  state,
  onChange: persist,
});

app.listen(PORT, () => {
  console.log(`BoyfriendPoints API listening on http://localhost:${PORT}`);
});
