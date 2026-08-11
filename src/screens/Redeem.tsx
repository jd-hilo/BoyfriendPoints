import { useCallback, useEffect, useState } from 'react';
import type { Prize, PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Button, ReceiptModal, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export default function Redeem({
  user,
  onChange,
}: {
  user: PublicUser;
  onChange: () => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [sharing, setSharing] = useState(false);

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
      const { redemption } = await api.redeem(prize.id);
      setSuccess({
        id: redemption.id,
        title: prize.title,
        emoji: prize.emoji,
        cost: prize.cost,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function finish(share: boolean) {
    if (!success) return;
    setSharing(true);
    try {
      if (share) {
        await api.shareRedemption(success.id);
        haptic(12);
      }
      setSuccess(null);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="screen">
      <div className="balance-card">
        <span className="balance-label">Your balance</span>
        <span className="balance-value">
          <Xp value={user.points} size={18} large />
        </span>
      </div>

      <h2 className="screen-title flush">Redeem</h2>
      {error && <p className="error">{error}</p>}

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
                  <Xp value={p.cost} size={12} />
                </span>
                <Button
                  variant={affordable ? 'primary' : 'secondary'}
                  block
                  disabled={!affordable || busy === p.id || !!success}
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

      {success && (
        <ReceiptModal
          kind="redeem"
          subtitle={`${user.partnerName ?? 'Your partner'} was alerted to fulfill it.`}
          emoji={success.emoji}
          itemTitle={success.title}
          points={success.cost}
          fromName={user.name}
          toName={user.partnerName ?? 'Partner'}
          note="Uncheck below if you want this kept off the feed."
          shareLabel="Share receipt"
          skipLabel="Done"
          feedLabel="Post to feed"
          busy={sharing}
          onShare={() => finish(true)}
          onSkip={() => void finish(false)}
        />
      )}
    </div>
  );
}
