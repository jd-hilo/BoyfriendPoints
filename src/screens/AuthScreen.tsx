import { useEffect, useState, type FormEvent } from 'react';
import type { PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { isAppleSignInAvailable, signInWithApple } from '../appleAuth.ts';
import { useAuth } from '../auth.tsx';
import { neonSignIn, neonSignUp } from '../neonAuth.ts';
import { Avatar, Xp } from '../ui.tsx';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const { enterAs, signInWithNeonToken, signInWithAppleToken } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personas, setPersonas] = useState<PublicUser[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const appleReady = isAppleSignInAvailable();

  useEffect(() => {
    void api
      .personas()
      .then(setPersonas)
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy('email');
    try {
      if (mode === 'signup') {
        await neonSignUp({ name: name.trim() || email.split('@')[0], email, password });
      } else {
        await neonSignIn({ email, password });
      }
      await signInWithNeonToken();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function onApple() {
    setError(null);
    setBusy('apple');
    try {
      const { idToken, name: appleName } = await signInWithApple();
      await signInWithAppleToken(idToken, appleName);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function pick(id: string) {
    setError(null);
    setBusy(id);
    try {
      await enterAs(id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const household = personas.filter((p) => !p.demo);
  const community = personas.filter((p) => p.demo);

  return (
    <div className="auth">
      <div className="auth-hero">
        <span className="brand-lockup">
          <span className="brand-gem big" aria-hidden>
            💎
          </span>
          <span className="wordmark big">LoveReceipts</span>
        </span>
        <p className="auth-tag">
          {mode === 'signup'
            ? 'Create your household account.'
            : 'Sign in to your household.'}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <label className="auth-field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
        )}
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        <button className="btn primary auth-submit" type="submit" disabled={!!busy}>
          {busy === 'email'
            ? '…'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="btn apple-btn"
        onClick={() => void onApple()}
        disabled={!!busy || !appleReady}
        title={
          appleReady
            ? 'Continue with Apple'
            : 'Add VITE_APPLE_CLIENT_ID to enable Apple Sign In'
        }
      >
        <AppleMark />
        {busy === 'apple'
          ? '…'
          : appleReady
            ? 'Continue with Apple'
            : 'Apple Sign In (configure .env)'}
      </button>

      <p className="auth-switch">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button type="button" className="linkish" onClick={() => setMode('signin')}>
              Sign in
            </button>
          </>
        ) : (
          <>
            New here?{' '}
            <button type="button" className="linkish" onClick={() => setMode('signup')}>
              Create an account
            </button>
          </>
        )}
      </p>

      <button
        type="button"
        className="linkish demo-toggle"
        onClick={() => setShowDemo((v) => !v)}
      >
        {showDemo ? 'Hide demo personas' : 'Try the demo instead'}
      </button>

      {showDemo && (
        <>
          <p className="section-label">This household</p>
          <div className="persona-list">
            {household.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                busy={busy === p.id}
                onPick={() => pick(p.id)}
              />
            ))}
          </div>

          {community.length > 0 && (
            <>
              <p className="section-label">Community (demo)</p>
              <div className="persona-list">
                {community.map((p) => (
                  <PersonaCard
                    key={p.id}
                    persona={p}
                    busy={busy === p.id}
                    onPick={() => pick(p.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M12.7 8.3c0-1.7 1.4-2.5 1.4-2.5s-1.1-1.7-2.9-1.7c-1.2 0-1.7.6-2.6.6-.9 0-1.7-.6-2.6-.6C4 4.1 2.4 5.4 2.4 7.9c0 2.9 2.3 6.3 4.1 6.3.7 0 1.2-.5 2.1-.5.9 0 1.3.5 2.1.5 1.8 0 3.3-3.2 3.3-3.2s-2.1-.8-2.1-2.7zM10.4 3.4c.7-.8 1.1-1.8 1-2.9-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.8-1 2.8 1.1.1 2.1-.7 2.7z"
      />
    </svg>
  );
}

function PersonaCard({
  persona,
  busy,
  onPick,
}: {
  persona: PublicUser;
  busy: boolean;
  onPick: () => void;
}) {
  const subtitle =
    persona.role === 'wife'
      ? persona.partnerName
        ? `Partner of ${persona.partnerName}`
        : 'Household manager'
      : persona.partnerName
        ? `With ${persona.partnerName}`
        : 'Partner';

  return (
    <button className="persona" onClick={onPick} disabled={busy}>
      <Avatar
        name={persona.name}
        color={persona.color}
        src={persona.avatarUrl}
        size={48}
      />
      <span className="persona-copy">
        <span className="persona-name">{persona.name}</span>
        <span className="persona-sub">{subtitle}</span>
      </span>
      {persona.role !== 'wife' && <Xp value={persona.points} size={11} />}
      <span className="persona-go">{busy ? '…' : '→'}</span>
    </button>
  );
}
