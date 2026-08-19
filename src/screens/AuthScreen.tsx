import { useEffect, useState, type FormEvent } from 'react';
import type { PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { neonSignIn, neonSignUp } from '../neonAuth.ts';
import { Avatar, Xp } from '../ui.tsx';

type Mode = 'signin' | 'signup';
type Step = 'email' | 'password' | 'reset-code' | 'new-password';

export default function AuthScreen() {
  const { enterAs, signInWithNeonToken } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [personas, setPersonas] = useState<PublicUser[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api
      .personas()
      .then(setPersonas)
      .catch(() => undefined);
  }, []);

  const resetting = step === 'reset-code' || step === 'new-password';
  const onPassword = mode === 'signin' && step === 'password';
  const totalSteps = mode === 'signup' ? 1 : 2;
  const stepIndex = onPassword || step === 'new-password' ? 1 : 0;

  function goToPassword() {
    if (!email.includes('@')) return;
    setError(null);
    setStep('password');
  }

  function backToEmail() {
    setError(null);
    setPassword('');
    setOtp('');
    setStep('email');
  }

  function backFromReset() {
    setError(null);
    setOtp('');
    setPassword('');
    setStep(step === 'new-password' ? 'reset-code' : 'password');
  }

  async function sendResetCode() {
    setError(null);
    setBusy('reset');
    try {
      await api.forgotPassword(email);
      setOtp('');
      setPassword('');
      setStep('reset-code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'signin' && step === 'email') {
      goToPassword();
      return;
    }
    if (step === 'reset-code') {
      if (otp.trim().length < 4) {
        setError('Enter the code from your email');
        return;
      }
      setError(null);
      setPassword('');
      setStep('new-password');
      return;
    }
    if (step === 'new-password') {
      setError(null);
      setBusy('reset');
      try {
        await api.resetPassword(email, otp, password);
        await neonSignIn({ email, password });
        await signInWithNeonToken();
      } catch (err) {
        setError((err as Error).message);
        setBusy(null);
      }
      return;
    }
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
  const title =
    mode === 'signup'
      ? 'Create your household account'
      : step === 'reset-code'
        ? 'Enter the code we emailed'
        : step === 'new-password'
          ? 'Choose a new password'
          : onPassword
            ? 'Enter your password'
            : "What's your email?";
  const sub =
    mode === 'signup'
      ? "You'll use this to sign in."
      : step === 'reset-code' || step === 'new-password' || onPassword
        ? email.trim()
        : "You'll use this to sign in.";

  return (
    <div className="auth auth-steps">
      <header className="ob-step-header">
        <div className="ob-step-header-row">
          {onPassword || resetting ? (
            <button
              type="button"
              className="ob-back"
              onClick={resetting ? backFromReset : backToEmail}
            >
              ←
            </button>
          ) : (
            <span className="ob-back-spacer" />
          )}
          <span className="ob-step-count">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <span className="ob-back-spacer" />
        </div>
        <div className="ob-progress-track">
          <div
            className="ob-progress-fill"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </header>

      <h1 className="ob-title">{title}</h1>
      <p className="ob-sub">{sub}</p>

      {error && <p className="error">{error}</p>}

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'signup' && (
          <input
            className="ob-big-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        )}
        {!onPassword && !resetting && (
          <input
            className="ob-big-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="you@email.com"
            autoComplete="username"
            autoFocus
            required
          />
        )}
        {step === 'reset-code' && (
          <input
            className="ob-big-input ob-otp-input"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        )}
        {(mode === 'signup' || onPassword || step === 'new-password') && (
          <input
            className="ob-big-input"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••"
            autoComplete={
              mode === 'signup' || step === 'new-password'
                ? 'new-password'
                : 'current-password'
            }
            minLength={8}
            autoFocus={onPassword || step === 'new-password'}
            required
          />
        )}
        {onPassword && (
          <p className="auth-forgot">
            <button
              type="button"
              className="linkish"
              disabled={!!busy}
              onClick={() => void sendResetCode()}
            >
              {busy === 'reset' ? 'Sending code…' : 'Forgot password?'}
            </button>
          </p>
        )}
        {step === 'reset-code' && (
          <p className="auth-forgot">
            <button
              type="button"
              className="linkish"
              disabled={!!busy}
              onClick={() => void sendResetCode()}
            >
              {busy === 'reset' ? 'Sending…' : 'Resend code'}
            </button>
          </p>
        )}
        <button className="btn primary auth-submit" type="submit" disabled={!!busy}>
          {busy === 'email' || busy === 'reset'
            ? '…'
            : mode === 'signup'
              ? 'Create account'
              : step === 'new-password'
                ? 'Reset password'
                : onPassword
                  ? 'Sign in'
                  : 'Continue'}
        </button>
      </form>

      {!onPassword && !resetting && (
        <>
          <p className="auth-switch">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setMode('signin');
                    setStep('email');
                    setError(null);
                  }}
                >
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
            {showDemo ? 'Hide demo' : 'Try the demo'}
          </button>
        </>
      )}

      {showDemo && !onPassword && !resetting && (
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
