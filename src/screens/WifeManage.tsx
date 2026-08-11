import { useCallback, useEffect, useState } from 'react';
import type { EarnTask, Prize, PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar, Button, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';

export default function WifeManage() {
  const { user, refresh } = useAuth();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasks, setTasks] = useState<EarnTask[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [friendForm, setFriendForm] = useState({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    password: 'points',
  });
  const [inviteHint, setInviteHint] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const hasPartner = Boolean(user?.partnerId && user.partnerName);

  const load = useCallback(async () => {
    const [p, t, f] = await Promise.all([
      api.prizes(),
      api.tasks(),
      api.friends(),
    ]);
    setPrizes(p);
    setTasks(t);
    setFriends(f);
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

  async function removePartner() {
    if (!user?.partnerName) return;
    const ok = window.confirm(
      `Remove ${user.partnerName} as your partner? They’ll lose access to this household.`,
    );
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      await api.removePartner();
      haptic(12);
      setInviteHint(null);
      setInviting(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invitePartner(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.inviteBoyfriend(
        inviteForm.name,
        inviteForm.email,
        inviteForm.password,
      );
      haptic([10, 30, 10]);
      setInviteHint(res.loginHint);
      setInviteForm({ name: '', email: '', password: 'points' });
      setInviting(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h2 className="screen-title flush">Manage</h2>
      {error && <p className="error">{error}</p>}

      <p className="section-label">Partner</p>
      {hasPartner ? (
        <div className="partner-card">
          <Avatar
            name={user!.partnerName!}
            color={user!.partnerColor ?? '#008CFF'}
            src={user!.partnerAvatar}
            size={48}
          />
          <div className="partner-card-text">
            <p className="partner-card-name">{user!.partnerName}</p>
            <p className="partner-card-meta">Current partner</p>
          </div>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void removePartner()}
          >
            Remove
          </Button>
        </div>
      ) : inviting ? (
        <form className="card form" onSubmit={invitePartner}>
          <p className="muted small" style={{ margin: 0 }}>
            They’ll get their own login to earn points and redeem prizes.
          </p>
          <input
            value={inviteForm.name}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, name: e.target.value })
            }
            placeholder="Partner’s name"
            aria-label="Partner name"
            required
          />
          <input
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, email: e.target.value })
            }
            placeholder="Partner’s email"
            aria-label="Partner email"
            required
          />
          <input
            value={inviteForm.password}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, password: e.target.value })
            }
            placeholder="Starter password"
            aria-label="Partner password"
          />
          <div className="row gap">
            <Button
              type="button"
              variant="secondary"
              block
              disabled={busy}
              onClick={() => setInviting(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              block
              disabled={busy || !inviteForm.name || !inviteForm.email}
            >
              Send invite
            </Button>
          </div>
        </form>
      ) : (
        <div className="partner-card partner-card-empty">
          <div className="partner-card-text">
            <p className="partner-card-name">No partner linked</p>
            <p className="partner-card-meta">
              Invite someone to earn and redeem with you.
            </p>
            {inviteHint && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Last invite: <b>{inviteHint.email}</b> / <b>{inviteHint.password}</b>
              </p>
            )}
          </div>
          <Button
            onClick={() => {
              setInviting(true);
              setError(null);
            }}
          >
            Invite partner
          </Button>
        </div>
      )}

      <p className="section-label">Friends</p>
      <div className="list">
        {friends.map((f) => (
          <div key={f.id} className="mini-row">
            <span className="row gap center-y">
              <Avatar
                name={f.name}
                color={f.color}
                src={f.avatarUrl}
                size={32}
              />
              <span>{f.name}</span>
            </span>
            <span className="muted small">on your feed</span>
          </div>
        ))}
      </div>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await api.addFriend(friendForm.name, friendForm.email);
            setFriendForm({ name: '', email: '' });
            haptic(10);
            await load();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <p className="muted small" style={{ margin: 0 }}>
          Add friends so their household wins show up on your Home feed.
        </p>
        <input
          value={friendForm.name}
          onChange={(e) =>
            setFriendForm({ ...friendForm, name: e.target.value })
          }
          placeholder="Friend’s name"
          aria-label="Friend name"
        />
        <input
          type="email"
          value={friendForm.email}
          onChange={(e) =>
            setFriendForm({ ...friendForm, email: e.target.value })
          }
          placeholder="Friend’s email"
          aria-label="Friend email"
          required
        />
        <Button type="submit" block disabled={!friendForm.email}>
          Add friend
        </Button>
      </form>

      <p className="section-label">Prizes they can redeem</p>
      <div className="list">
        {prizes.map((p) => (
          <div key={p.id} className="mini-row">
            <span>
              {p.emoji} {p.title}
            </span>
            <span className="row gap center-y">
              <Xp value={p.cost} size={12} />
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

      <p className="section-label">Ways they can earn</p>
      <div className="list">
        {tasks.map((t) => (
          <div key={t.id} className="mini-row">
            <span>
              {t.emoji} {t.title}
            </span>
            <span className="row gap center-y">
              <Xp value={t.points} sign="+" size={12} />
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
