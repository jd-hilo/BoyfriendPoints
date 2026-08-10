import { useCallback, useEffect, useState } from 'react';
import type { Prize, PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Button, Xp, XpIcon } from '../ui.tsx';
import { haptic } from '../utils.ts';

export default function Redeem({
  user,
  onChange,
}: {
  user: PublicUser;
  onChange: () => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPrizes(await api.prizes());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(prize: Prize) {
    setError(null);
    setBusy(prize.id);
    haptic([12, 30, 12]);
    try {
      await api.redeem(prize.id);
      setFlash(`Redeemed "${prize.title}"! ${user.partnerName ?? 'Your partner'} was alerted.`);
      onChange();
      setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="screen">
      <div className="balance-card">
        <span className="balance-label">Your balance</span>
        <span className="balance-value">
          <XpIcon size={30} />
          {user.points}
        </span>
      </div>

      <h2 className="screen-title flush">Redeem</h2>
      {error && <p className="error">{error}</p>}
      {flash && <p className="flash">{flash}</p>}

      {prizes.length === 0 ? (
        <p className="muted center pad">
          {user.partnerName ?? 'Your partner'} hasn&apos;t added prizes yet.
        </p>
      ) : (
        <div className="prize-grid">
          {prizes.map((p) => {
            const affordable = user.points >= p.cost;
            return (
              <div key={p.id} className={`prize ${affordable ? '' : 'locked'}`}>
                <span className="prize-emoji">{p.emoji}</span>
                <span className="prize-title">{p.title}</span>
                <span className="prize-cost">
                  <Xp value={p.cost} size={14} />
                </span>
                <Button
                  variant={affordable ? 'primary' : 'secondary'}
                  block
                  disabled={!affordable || busy === p.id}
                  onClick={() => redeem(p)}
                >
                  {affordable
                    ? busy === p.id
                      ? 'Redeeming…'
                      : 'Redeem'
                    : `Need ${p.cost - user.points} more`}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
