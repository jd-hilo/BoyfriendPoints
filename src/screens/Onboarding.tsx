import { useEffect, useState } from 'react';
import type {
  EarnTask,
  Prize,
  PublicUser,
  Suggestion,
} from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, EmojiField, Xp } from '../ui.tsx';

const STEPS = ['Tasks', 'Prizes', 'Partner', 'Friends'] as const;

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);

  return (
    <div className="onboarding">
      <header className="ob-header">
        <span className="brand-lockup">
          <span className="brand-gem" aria-hidden>
            💎
          </span>
          <span className="wordmark">LoveReceipts</span>
        </span>
        <div className="ob-progress">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`dot ${i <= step ? 'on' : ''}`}
              aria-label={label}
            />
          ))}
        </div>
      </header>

      {step === 0 && <StepCatalog kind="task" onNext={() => setStep(1)} />}
      {step === 1 && <StepCatalog kind="prize" onNext={() => setStep(2)} />}
      {step === 2 && (
        <StepPartner
          partnerName={user?.partnerName}
          onNext={() => setStep(3)}
          refresh={refresh}
        />
      )}
      {step === 3 && (
        <StepFriends
          onDone={async () => {
            await api.completeOnboarding();
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function StepCatalog({
  kind,
  onNext,
}: {
  kind: 'prize' | 'task';
  onNext: () => void;
}) {
  const { user } = useAuth();
  const isPrize = kind === 'prize';
  const noun = isPrize ? 'prize' : 'task';
  const nouns = isPrize ? 'prizes' : 'tasks';
  const defaultEmoji = isPrize ? '🎁' : '⭐';
  const partnerFirst = user?.partnerName?.split(' ')[0] || 'them';

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [items, setItems] = useState<{ title: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    emoji: defaultEmoji,
    title: '',
    points: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .suggestions()
      .then((s) => setSuggestions(isPrize ? s.prizes : s.tasks));
    void (isPrize ? api.prizes() : api.tasks()).then(
      (list: Prize[] | EarnTask[]) => setItems(list),
    );
  }, [isPrize]);

  function resetForm() {
    setForm({ emoji: defaultEmoji, title: '', points: '' });
  }

  function closeModal() {
    setAdding(false);
    resetForm();
    setError(null);
  }

  async function quickAdd(s: Suggestion) {
    if (isPrize) {
      const prize = await api.addPrize(s.title, s.points, s.emoji);
      setItems((p) => [...p, prize]);
    } else {
      const task = await api.addTask(s.title, s.points, s.emoji);
      setItems((p) => [...p, task]);
    }
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.points) return;
    setError(null);
    try {
      if (isPrize) {
        const prize = await api.addPrize(
          form.title.trim(),
          Number(form.points),
          form.emoji,
        );
        setItems((p) => [...p, prize]);
      } else {
        const task = await api.addTask(
          form.title.trim(),
          Number(form.points),
          form.emoji,
        );
        setItems((p) => [...p, task]);
      }
      closeModal();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const chosen = new Set(items.map((p) => p.title));

  return (
    <div className="ob-step">
      <h1 className="ob-title">
        {isPrize ? 'Create your prizes' : 'Create your tasks'}
      </h1>
      <p className="ob-sub">
        {isPrize
          ? 'These are the rewards your partner can redeem with points. Tap a suggestion or add your own.'
          : 'These are tasks your partner can submit to earn points when they join. Tap a suggestion or add your own.'}
      </p>

      <div className="chip-grid">
        {suggestions.map((s) => (
          <button
            key={s.title}
            className={`chip ${chosen.has(s.title) ? 'chosen' : ''}`}
            onClick={() => void quickAdd(s)}
            disabled={chosen.has(s.title)}
          >
            <span className="chip-emoji">{s.emoji}</span>
            <span className="chip-title">{s.title}</span>
            <span className="chip-points">
              <Xp value={s.points} size={11} />
            </span>
          </button>
        ))}
        <button
          type="button"
          className="chip chip-add"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => setAdding(true)}
        >
          <span className="chip-emoji">＋</span>
          <span className="chip-title">Add a custom {noun}</span>
          <span className="chip-points">Your own</span>
        </button>
      </div>

      {items.length > 0 && (
        <p className="ob-added">
          {items.length} {items.length > 1 ? nouns : noun} added ✓
        </p>
      )}

      <div className="ob-footer">
        <Button block onClick={onNext}>
          {items.length === 0 ? 'Skip for now' : 'Continue'}
        </Button>
      </div>

      {adding && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <form
            className="modal compose-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void addCustom(e)}
          >
            <div className="compose-modal-head">
              <div>
                <p className="modal-title">
                  {isPrize ? 'Add a prize' : 'Add a task'}
                </p>
                <p className="modal-sub">
                  {isPrize
                    ? partnerFirst === 'them'
                      ? 'They can cash points in for this.'
                      : `${partnerFirst} can cash points in for this.`
                    : partnerFirst === 'them'
                      ? 'They submit this to earn points when they join.'
                      : `${partnerFirst} submits this to earn points when they join.`}
                </p>
              </div>
              <button
                type="button"
                className="compose-modal-cancel"
                onClick={closeModal}
              >
                Cancel
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row gap">
              <EmojiField
                value={form.emoji}
                onChange={(emoji) => setForm({ ...form, emoji })}
                autoFocus
              />
              <input
                className="grow"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={
                  isPrize
                    ? `A prize for ${partnerFirst}`
                    : `A task for ${partnerFirst}`
                }
                aria-label={isPrize ? 'Prize title' : 'Task title'}
              />
            </div>
            <input
              type="number"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              placeholder={isPrize ? 'Cost in points' : 'Points they earn'}
              aria-label={isPrize ? 'Cost in points' : 'Points they earn'}
            />
            <Button
              type="submit"
              block
              disabled={!form.title.trim() || !form.points}
            >
              {isPrize ? 'Add prize' : 'Add task'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function StepPartner({
  partnerName,
  onNext,
  refresh,
}: {
  partnerName?: string;
  onNext: () => void;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('points');
  const [joinCode, setJoinCode] = useState('');
  const [hint, setHint] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.inviteBoyfriend(name, email, password);
      setHint(res.loginHint);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.joinWithCode(joinCode);
      await refresh();
      onNext();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="ob-step">
      <h1 className="ob-title">Add your partner</h1>
      <p className="ob-sub">
        Invite them with a login, or enter their household code if they already signed up.
      </p>

      {partnerName || hint ? (
        <div className="card success-card">
          <p className="success-title">🎉 {name || partnerName} is invited!</p>
          {hint && (
            <p className="muted small">
              They can sign in with <b>{hint.email}</b> / <b>{hint.password}</b>
            </p>
          )}
        </div>
      ) : (
        <form className="card form" onSubmit={invite}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Partner’s name"
            aria-label="Partner name"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Partner’s email"
            aria-label="Partner email"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="A starter password"
            aria-label="Partner password"
          />
          {error && <p className="error">{error}</p>}
          <Button type="submit" block disabled={!name || !email}>
            Send invite
          </Button>
        </form>
      )}

      {!partnerName && !hint && (
        <form className="card form" onSubmit={join}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Or enter their code"
            aria-label="Partner invite code"
            autoCapitalize="characters"
          />
          <Button type="submit" block disabled={joinCode.trim().length < 4}>
            Join with their code
          </Button>
        </form>
      )}

      <div className="ob-footer">
        <Button block onClick={onNext}>
          {partnerName || hint ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}

function StepFriends({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const friend = await api.addFriend(name, email);
      setFriends((f) => [...f, friend]);
      setName('');
      setEmail('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="ob-step">
      <h1 className="ob-title">Add your friends</h1>
      <p className="ob-sub">
        Follow friends so their household wins show up on your Home feed.
      </p>

      <form className="card form" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friend's name"
          aria-label="Friend name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Friend's email"
          aria-label="Friend email"
        />
        {error && <p className="error">{error}</p>}
        <Button variant="secondary" type="submit" block disabled={!email}>
          Add friend
        </Button>
      </form>

      {friends.length > 0 && (
        <div className="list">
          {friends.map((f) => (
            <div key={f.id} className="mini-row">
              <span>👭 {f.name}</span>
              <span className="status status-approved">added</span>
            </div>
          ))}
        </div>
      )}

      <div className="ob-footer">
        <Button
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDone();
          }}
        >
          {busy ? 'Setting up…' : 'Enter LoveReceipts'}
        </Button>
      </div>
    </div>
  );
}
