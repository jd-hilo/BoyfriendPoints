import { useEffect, useState } from 'react';
import type { PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar } from '../ui.tsx';

export default function AuthScreen() {
  const { enterAs } = useAuth();
  const [personas, setPersonas] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api
      .personas()
      .then(setPersonas)
      .catch((err) => setError((err as Error).message));
  }, []);

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
        <span className="wordmark big">boyfriendpoints</span>
        <p className="auth-tag">Tap who you are. No password needed.</p>
      </div>

      {error && <p className="error">{error}</p>}

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

      {personas.length === 0 && !error && (
        <p className="muted center">Loading personas…</p>
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
        ? `Wife · partner of ${persona.partnerName}`
        : 'Wife'
      : persona.partnerName
        ? `Boyfriend · ${persona.points} pts · with ${persona.partnerName}`
        : `Boyfriend · ${persona.points} pts`;

  return (
    <button className="persona" onClick={onPick} disabled={busy}>
      <Avatar name={persona.name} color={persona.color} size={48} />
      <span className="persona-copy">
        <span className="persona-name">{persona.name}</span>
        <span className="persona-sub">{subtitle}</span>
      </span>
      <span className="persona-go">{busy ? '…' : '→'}</span>
    </button>
  );
}
