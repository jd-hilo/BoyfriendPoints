import { useCallback, useEffect, useState } from 'react';
import type { Prize, PublicUser } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Button, EmojiField, ReceiptModal, WhoPill, Xp } from '../ui.tsx';
import { haptic, sharePartnerInvite } from '../utils.ts';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export default function Redeem({
  user,
  onChange,
  onEnterCode,
}: {
  user: PublicUser;
  onChange: () => void;
  onEnterCode?: () => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [created, setCreated] = useState<Prize[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [addingPrize, setAddingPrize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [sharing, setSharing] = useState(false);
  const [scope, setScope] = useState<'you' | 'them'>('you');

  const load = useCallback(async () => {
    const all = await api.prizes();
    setPrizes(all.filter((p) => user.partnerId && p.wifeId === user.partnerId));
    setCreated(all.filter((p) => p.wifeId === user.id));
  }, [user.id, user.partnerId]);

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

  async function addPrize(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addPrize(prizeForm.title, Number(prizeForm.cost), prizeForm.emoji);
      setPrizeForm({ emoji: '🎁', title: '', cost: '' });
      setAddingPrize(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removePrize(id: string) {
    setError(null);
    try {
      await api.removePrize(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
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

  const partnerFirst = user.partnerName?.trim().split(/\s+/)[0] ?? 'them';
  const linked = Boolean(user.partnerId);

  return (
    <div className="screen">
      <div className="title-row">
        <h2 className="screen-title flush">Rewards</h2>
        <WhoPill
          value={scope}
          themLabel={`For ${partnerFirst}`}
          onChange={(next) => {
            haptic(10);
            setScope(next);
          }}
        />
      </div>

      {scope === 'you' && (
        <div className="balance-card">
          <span className="balance-label">Your balance</span>
          <span className="balance-value">
            <Xp value={user.points} size={18} large />
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {scope === 'you' ? (
        prizes.length === 0 ? (
          linked ? (
            <p className="muted center pad">
              {user.partnerName ?? 'Your partner'} hasn&apos;t added prizes yet.
            </p>
          ) : (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="coach-title">Add your partner first</p>
              <p className="muted small">
                Invite them, or enter their code if they already signed up.
              </p>
              <Button
                block
                disabled={!user.inviteCode}
                onClick={() =>
                  void sharePartnerInvite(user.name, user.inviteCode)
                }
              >
                Invite partner
              </Button>
              {onEnterCode ? (
                <button
                  type="button"
                  className="quiet-link"
                  onClick={onEnterCode}
                >
                  Have their code?
                </button>
              ) : null}
            </div>
          )
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
        )
      ) : (
        <>
          {created.length > 0 && (
            <div className="chip-grid">
              {created.map((p) => (
                <div key={p.id} className="chip chip-static">
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Remove ${p.title}`}
                    onClick={() => void removePrize(p.id)}
                  >
                    ✕
                  </button>
                  <span className="chip-emoji">{p.emoji}</span>
                  <span className="chip-title">{p.title}</span>
                  <span className="chip-points">
                    <Xp value={p.cost} size={11} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="chip chip-add"
            onClick={() => {
              haptic(10);
              setError(null);
              setAddingPrize(true);
            }}
          >
            <span className="chip-emoji">＋</span>
            <span className="chip-title">Add a prize</span>
            <span className="chip-points">For {partnerFirst}</span>
          </button>
        </>
      )}

      {addingPrize && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setAddingPrize(false);
            setPrizeForm({ emoji: '🎁', title: '', cost: '' });
          }}
        >
          <form
            className="modal compose-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={addPrize}
          >
            <div className="compose-modal-head">
              <div>
                <p className="modal-title">Add a prize</p>
                <p className="modal-sub">
                  {partnerFirst === 'them'
                    ? 'They can cash points in for this.'
                    : `${partnerFirst} can cash points in for this.`}
                </p>
              </div>
              <button
                type="button"
                className="compose-modal-cancel"
                onClick={() => {
                  setAddingPrize(false);
                  setPrizeForm({ emoji: '🎁', title: '', cost: '' });
                }}
              >
                Cancel
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row gap">
              <EmojiField
                value={prizeForm.emoji}
                onChange={(next) => setPrizeForm({ ...prizeForm, emoji: next })}
                autoFocus
              />
              <input
                className="grow"
                value={prizeForm.title}
                onChange={(e) =>
                  setPrizeForm({ ...prizeForm, title: e.target.value })
                }
                placeholder={`A prize for ${partnerFirst}`}
                aria-label="Prize title"
                autoFocus
              />
            </div>
            <input
              type="number"
              value={prizeForm.cost}
              onChange={(e) =>
                setPrizeForm({ ...prizeForm, cost: e.target.value })
              }
              placeholder="Cost in points"
              aria-label="Cost in points"
            />
            <Button
              type="submit"
              block
              disabled={!prizeForm.title.trim() || !prizeForm.cost}
            >
              Add prize
            </Button>
          </form>
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
