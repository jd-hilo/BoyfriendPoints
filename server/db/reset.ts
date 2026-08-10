import 'dotenv/config';
import { resetDatabase, loadState } from '../store.ts';

await resetDatabase();
const state = await loadState(); // re-seeds mock data when empty
console.log(
  `Reset complete. Seeded ${state.users.length} users and ${state.feed.length} feed events.`,
);
process.exit(0);
