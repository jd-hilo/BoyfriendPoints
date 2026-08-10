import { useEffect, useState } from 'react';
import type { Prize, PublicUser, Suggestion } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button } from '../ui.tsx';

const STEPS = ['Prizes', 'Partner', 'Friends'] as const;

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);

  return (
    <div className="onboarding">
      <header className="ob-header">
        <span className="wordmark">Love Receipts</span>
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

      {step === 0 && (
        <StepPrizes onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <StepPartner
          partnerName={user?.partnerName}
          onNext={() => setStep(2)}
          refresh={refresh}
        />
      )}
      {step === 2 && (
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

function StepPrizes({ onNext }: { onNext: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [emoji, setEmoji] = useState('🎁');

  useEffect(() => {
    void api.suggestions().then((s) => setSuggestions(s.prizes));
    void api.prizes().then(setPrizes);
  }, []);

  async function quickAdd(s: Suggestion) {
    const prize = await api.addPrize(s.title, s.points, s.emoji);
    setPrizes((p) => [...p, prize]);
  }

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !cost) return;
    const prize = await api.addPrize(title, Number(cost), emoji);
    setPrizes((p) => [...p, prize]);
    setTitle('');
    setCost('');
    setEmoji('🎁');
  }

  const chosen = new Set(prizes.map((p) => p.title));

  return (
    <div className="ob-step">
      <h1 className="ob-title">Create your prizes</h1>
      <p className="ob-sub">
        These are the rewards your boyfriend can redeem with points. Tap a
        suggestion or add your own.
      </p>

      <div className="chip-grid">
        {suggestions.map((s) => (
          <button
            key={s.title}
            className={`chip ${chosen.has(s.title) ? 'chosen' : ''}`}
            onClick={() => quickAdd(s)}
            disabled={chosen.has(s.title)}
          >
            <span className="chip-emoji">{s.emoji}</span>
            <span className="chip-title">{s.title}</span>
            <span className="chip-points">{s.points}</span>
          </button>
        ))}
      </div>

      <form className="card form" onSubmit={addCustom}>
        <div className="row gap">
          <input
            className="emoji-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={2}
            aria-label="Prize emoji"
          />
          <input
            className="grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your own prize"
            aria-label="Prize title"
          />
          <input
            type="number"
            className="cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="pts"
            aria-label="Prize cost"
          />
        </div>
        <Button variant="secondary" type="submit" disabled={!title || !cost}>
          Add prize
        </Button>
      </form>

      {prizes.length > 0 && (
        <p className="ob-added">{prizes.length} prize{prizes.length > 1 ? 's' : ''} added ✓</p>
      )}

      <div className="ob-footer">
        <Button block onClick={onNext} disabled={prizes.length === 0}>
          Continue
        </Button>
      </div>
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

  return (
    <div className="ob-step">
      <h1 className="ob-title">Invite your boyfriend</h1>
      <p className="ob-sub">
        He&apos;ll get his own login to submit chores and redeem prizes.
      </p>

      {partnerName || hint ? (
        <div className="card success-card">
          <p className="success-title">🎉 {name || partnerName} is invited!</p>
          {hint && (
            <p className="muted small">
              He can sign in with <b>{hint.email}</b> / <b>{hint.password}</b>
            </p>
          )}
        </div>
      ) : (
        <form className="card form" onSubmit={invite}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="His name"
            aria-label="Boyfriend name"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="His email"
            aria-label="Boyfriend email"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="A starter password"
            aria-label="Boyfriend password"
          />
          {error && <p className="error">{error}</p>}
          <Button type="submit" block disabled={!name || !email}>
            Send invite
          </Button>
        </form>
      )}

      <div className="ob-footer">
        <Button block onClick={onNext} disabled={!partnerName && !hint}>
          Continue
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
        Follow your friends and other wives to see their boyfriends&apos; points
        roll in on your feed.
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
          {busy ? 'Setting up…' : 'Enter BoyfriendPoints'}
        </Button>
      </div>
    </div>
  );
}
