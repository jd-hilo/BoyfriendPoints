import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyState, type State } from './domain.ts';
import { seedDemo } from './seed.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function normalize(parsed: Partial<State>): State {
  const base = createEmptyState();
  return {
    users: parsed.users ?? base.users,
    prizes: parsed.prizes ?? base.prizes,
    tasks: parsed.tasks ?? base.tasks,
    submissions: parsed.submissions ?? base.submissions,
    redemptions: parsed.redemptions ?? base.redemptions,
    feed: parsed.feed ?? base.feed,
  };
}

export async function loadState(): Promise<State> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return normalize(JSON.parse(raw) as Partial<State>);
  } catch {
    const state = createEmptyState();
    seedDemo(state);
    await saveState(state);
    return state;
  }
}

export async function saveState(state: State): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}
