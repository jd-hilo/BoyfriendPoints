import express, { type Express } from 'express';
import {
  addBoyfriend,
  awardPoints,
  historyFor,
  leaderboard,
  removeBoyfriend,
  type AppState,
} from './points.ts';

export interface CreateAppOptions {
  state: AppState;
  onChange?: (state: AppState) => void;
}

export function createApp({ state, onChange }: CreateAppOptions): Express {
  const app = express();
  app.use(express.json());

  const persist = () => onChange?.(state);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', boyfriends: state.boyfriends.length });
  });

  app.get('/api/boyfriends', (_req, res) => {
    res.json(leaderboard(state));
  });

  app.post('/api/boyfriends', (req, res) => {
    try {
      const boyfriend = addBoyfriend(state, String(req.body?.name ?? ''));
      persist();
      res.status(201).json(boyfriend);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/boyfriends/:id/history', (req, res) => {
    const found = state.boyfriends.some((b) => b.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Boyfriend not found' });
      return;
    }
    res.json(historyFor(state, req.params.id));
  });

  app.post('/api/boyfriends/:id/points', (req, res) => {
    try {
      const delta = Number(req.body?.delta);
      const reason = String(req.body?.reason ?? '');
      const result = awardPoints(state, req.params.id, delta, reason);
      persist();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/boyfriends/:id', (req, res) => {
    const removed = removeBoyfriend(state, req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Boyfriend not found' });
      return;
    }
    persist();
    res.status(204).end();
  });

  return app;
}
