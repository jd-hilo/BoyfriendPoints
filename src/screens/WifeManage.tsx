import { useCallback, useEffect, useState } from 'react';
import type { EarnTask, Prize } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Button } from '../ui.tsx';

export default function WifeManage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasks, setTasks] = useState<EarnTask[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([api.prizes(), api.tasks()]);
    setPrizes(p);
    setTasks(t);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPrize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addPrize(prizeForm.title, Number(prizeForm.cost), prizeForm.emoji);
      setPrizeForm({ emoji: '🎁', title: '', cost: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addTask(taskForm.title, Number(taskForm.points), taskForm.emoji);
      setTaskForm({ emoji: '⭐', title: '', points: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="screen">
      <h2 className="screen-title flush">Manage</h2>
      {error && <p className="error">{error}</p>}

      <p className="section-label">Prizes he can redeem</p>
      <div className="list">
        {prizes.map((p) => (
          <div key={p.id} className="mini-row">
            <span>
              {p.emoji} {p.title}
            </span>
            <span className="row gap center-y">
              <span className="cost-tag">{p.cost} pts</span>
              <button
                className="x"
                onClick={() => api.removePrize(p.id).then(load)}
                aria-label={`Remove ${p.title}`}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      <form className="card form" onSubmit={addPrize}>
        <div className="row gap">
          <input
            className="emoji-input"
            value={prizeForm.emoji}
            onChange={(e) => setPrizeForm({ ...prizeForm, emoji: e.target.value })}
            aria-label="Prize emoji"
            maxLength={2}
          />
          <input
            className="grow"
            value={prizeForm.title}
            onChange={(e) => setPrizeForm({ ...prizeForm, title: e.target.value })}
            placeholder="New prize"
            aria-label="Prize title"
          />
        </div>
        <div className="row gap">
          <input
            type="number"
            className="grow"
            value={prizeForm.cost}
            onChange={(e) => setPrizeForm({ ...prizeForm, cost: e.target.value })}
            placeholder="Cost in points"
            aria-label="Prize cost"
          />
          <Button type="submit" disabled={!prizeForm.title || !prizeForm.cost}>
            Add
          </Button>
        </div>
      </form>

      <p className="section-label">Ways he can earn</p>
      <div className="list">
        {tasks.map((t) => (
          <div key={t.id} className="mini-row">
            <span>
              {t.emoji} {t.title}
            </span>
            <span className="row gap center-y">
              <span className="cost-tag earn">+{t.points}</span>
              <button
                className="x"
                onClick={() => api.removeTask(t.id).then(load)}
                aria-label={`Remove ${t.title}`}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      <form className="card form" onSubmit={addTask}>
        <div className="row gap">
          <input
            className="emoji-input"
            value={taskForm.emoji}
            onChange={(e) => setTaskForm({ ...taskForm, emoji: e.target.value })}
            aria-label="Task emoji"
            maxLength={2}
          />
          <input
            className="grow"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            placeholder="New task"
            aria-label="Task title"
          />
        </div>
        <div className="row gap">
          <input
            type="number"
            className="grow"
            value={taskForm.points}
            onChange={(e) => setTaskForm({ ...taskForm, points: e.target.value })}
            placeholder="Points"
            aria-label="Task points"
          />
          <Button type="submit" disabled={!taskForm.title || !taskForm.points}>
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
