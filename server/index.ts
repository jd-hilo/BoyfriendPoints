import { createApp } from './app.ts';
import { loadState, saveState } from './store.ts';

const PORT = Number(process.env.PORT ?? 3001);

const state = await loadState();

const app = createApp({
  state,
  onChange: (next) => {
    void saveState(next);
  },
});

app.listen(PORT, () => {
  console.log(`BoyfriendPoints API listening on http://localhost:${PORT}`);
});
