import 'dotenv/config';
import { createDbFromEnv } from './client.ts';
import { loadState, resetDatabase } from './store.ts';

const db = createDbFromEnv();
await resetDatabase(db);
const state = await loadState(db);
console.log(
  `Reset complete. Seeded ${state.users.length} users and ${state.feed.length} feed events.`,
);
process.exit(0);
