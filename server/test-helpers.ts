import { createEmptyState, type State } from './domain.ts';
import { seedDemo } from './seed.ts';

export { createEmptyState };

/** Seed the in-memory state the same way Neon does on an empty database. */
export function seedDemoCompat(state: State): void {
  seedDemo(state);
}
