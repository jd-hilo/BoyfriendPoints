import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Boyfriend, PointEvent } from '../shared/types.ts';
import {
  awardPoints,
  createBoyfriend,
  deleteBoyfriend,
  getHistory,
  listBoyfriends,
} from './api.ts';

const QUICK_AWARDS = [
  { label: 'Brought flowers', delta: 10 },
  { label: 'Did the dishes', delta: 5 },
  { label: 'Was late', delta: -5 },
  { label: 'Forgot anniversary', delta: -20 },
];

export default function App() {
  const [boyfriends, setBoyfriends] = useState<Boyfriend[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<PointEvent[]>([]);

  const refresh = useCallback(async () => {
    try {
      setBoyfriends(await listBoyfriends());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPoints = useMemo(
    () => boyfriends.reduce((sum, b) => sum + b.points, 0),
    [boyfriends],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createBoyfriend(name);
      setName('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAward(id: string, delta: number, reason: string) {
    try {
      await awardPoints(id, delta, reason);
      await refresh();
      if (openId === id) {
        setHistory(await getHistory(id));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleHistory(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setHistory(await getHistory(id));
  }

  async function handleDelete(id: string) {
    await deleteBoyfriend(id);
    if (openId === id) setOpenId(null);
    await refresh();
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>
          <span role="img" aria-label="sparkling heart">
            💖
          </span>{' '}
          BoyfriendPoints
        </h1>
        <p>Track and manage boyfriend points.</p>
        <div className="stats">
          <span>{boyfriends.length} tracked</span>
          <span>{totalPoints} points awarded</span>
        </div>
      </header>

      <form className="add-form" onSubmit={handleAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a boyfriend by name…"
          aria-label="Boyfriend name"
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : boyfriends.length === 0 ? (
        <p className="empty">No boyfriends yet. Add one above to start scoring!</p>
      ) : (
        <ul className="list">
          {boyfriends.map((b, index) => (
            <li key={b.id} className="card">
              <div className="card-main">
                <div className="rank">#{index + 1}</div>
                <div className="who">
                  <h2>{b.name}</h2>
                  <span
                    className={b.points >= 0 ? 'score positive' : 'score negative'}
                  >
                    {b.points} pts
                  </span>
                </div>
                <button
                  className="ghost"
                  onClick={() => handleDelete(b.id)}
                  aria-label={`Remove ${b.name}`}
                >
                  ✕
                </button>
              </div>

              <div className="awards">
                {QUICK_AWARDS.map((q) => (
                  <button
                    key={q.label}
                    className={q.delta > 0 ? 'award plus' : 'award minus'}
                    onClick={() => handleAward(b.id, q.delta, q.label)}
                  >
                    {q.label} ({q.delta > 0 ? '+' : ''}
                    {q.delta})
                  </button>
                ))}
              </div>

              <button className="link" onClick={() => toggleHistory(b.id)}>
                {openId === b.id ? 'Hide history' : 'Show history'}
              </button>

              {openId === b.id && (
                <ul className="history">
                  {history.length === 0 ? (
                    <li className="muted">No events yet.</li>
                  ) : (
                    history.map((ev) => (
                      <li key={ev.id}>
                        <span className={ev.delta > 0 ? 'positive' : 'negative'}>
                          {ev.delta > 0 ? '+' : ''}
                          {ev.delta}
                        </span>{' '}
                        {ev.reason}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
