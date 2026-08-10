import { useState } from 'react';
import { useAuth } from '../auth.tsx';
import { Button } from '../ui.tsx';

export default function AuthScreen() {
  const { signup, login } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') await signup(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <span className="wordmark big">boyfriendpoints</span>
        <p className="auth-tag">Reward the good. Redeem the perks. 💖</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
        />
        {error && <p className="error">{error}</p>}
        <Button type="submit" block disabled={busy}>
          {busy
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create my account'
              : 'Sign in'}
        </Button>
      </form>

      <p className="auth-switch">
        {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup');
            setError(null);
          }}
        >
          {mode === 'signup' ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="auth-note">
        Wives &amp; girlfriends sign up here. Boyfriends sign in with the invite
        their partner sends.
      </p>
    </div>
  );
}
