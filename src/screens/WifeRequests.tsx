import { useCallback, useEffect, useState } from 'react';
import type { Redemption, Submission } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, ReceiptModal, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';
import type { ReceiptKind } from '../receipt.ts';

interface ReceiptState {
  kind: ReceiptKind;
  emoji: string;
  title: string;
  points: number;
  subtitle: string;
  fromName: string;
  toName: string;
  note: string;
}

export default function WifeRequests({ onChange }: { onChange: () => void }) {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [revise, setRevise] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.submissions(), api.redemptions()]);
    setSubs(s);
    setRedemptions(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function closeReceipt() {
    setReceipt(null);
    onChange();
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function approve(s: Submission) {
    setError(null);
    try {
      const revised = revise[s.id] ? Number(revise[s.id]) : undefined;
      const res = await api.approve(s.id, revised);
      haptic([10, 40, 10]);
      await load();
      // Defer onChange until the receipt closes so remounts don't kill it.
      setReceipt({
        kind: 'approve',
        emoji: s.emoji,
        title: s.title,
        points: res.submission.points,
        subtitle: `You just paid out +${res.submission.points} XP.`,
        fromName: user?.name ?? 'You',
        toName: user?.partnerName ?? 'Partner',
        note: 'Share the receipt — it’s the best part.',
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function fulfill(r: Redemption) {
    setError(null);
    try {
      await api.fulfill(r.id);
      haptic([10, 30, 10]);
      await load();
      setReceipt({
        kind: 'fulfill',
        emoji: r.emoji,
        title: r.prizeTitle,
        points: r.cost,
        subtitle: `Marked as given to ${user?.partnerName ?? 'your partner'}.`,
        fromName: user?.name ?? 'You',
        toName: user?.partnerName ?? 'Partner',
        note: 'Share a receipt for the prize handoff.',
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="screen">
      <div>
        <h2 className="screen-title flush">Requests</h2>
        <p className="muted small" style={{ margin: '4px 2px 0' }}>
          Approve point requests and fulfill redemptions.
        </p>
      </div>
      {error && <p className="error">{error}</p>}

      <p className="section-label">
        Point requests {subs.length > 0 && <span className="count">{subs.length}</span>}
      </p>
      {subs.length === 0 ? (
        <p className="muted small">No pending requests. 🎉</p>
      ) : (
        <div className="list">
          {subs.map((s) => (
            <div key={s.id} className="request-card">
              <div className="request-head">
                <span className="request-title">
                  {s.emoji} {s.title}
                </span>
                <span className="request-points">
                  <Xp value={s.requestedPoints} sign="+" size={13} />
                </span>
              </div>
              {s.note && <p className="request-note">“{s.note}”</p>}
              <div className="request-actions">
                <input
                  className="revise-input"
                  type="number"
                  placeholder={`${s.requestedPoints}`}
                  value={revise[s.id] ?? ''}
                  onChange={(e) =>
                    setRevise((r) => ({ ...r, [s.id]: e.target.value }))
                  }
                  aria-label={`Revise points for ${s.title}`}
                />
                <Button
                  variant="secondary"
                  disabled={!!receipt}
                  onClick={() => void approve(s)}
                >
                  {revise[s.id] ? 'Revise & approve' : 'Approve'}
                </Button>
                <Button
                  variant="danger"
                  disabled={!!receipt}
                  onClick={() => act(() => api.deny(s.id))}
                >
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="section-label">
        Redemptions to fulfill{' '}
        {redemptions.length > 0 && (
          <span className="count">{redemptions.length}</span>
        )}
      </p>
      {redemptions.length === 0 ? (
        <p className="muted small">Nothing to hand out right now.</p>
      ) : (
        <div className="list">
          {redemptions.map((r) => (
            <div key={r.id} className="request-card">
              <div className="request-head">
                <span className="request-title">
                  {r.emoji} {r.prizeTitle}
                </span>
                <span className="request-points">
                  <Xp value={r.cost} sign="−" size={13} />
                </span>
              </div>
              <Button
                block
                variant="secondary"
                disabled={!!receipt}
                onClick={() => void fulfill(r)}
              >
                Mark as given
              </Button>
            </div>
          ))}
        </div>
      )}

      {receipt && (
        <ReceiptModal
          kind={receipt.kind}
          subtitle={receipt.subtitle}
          emoji={receipt.emoji}
          itemTitle={receipt.title}
          points={receipt.points}
          fromName={receipt.fromName}
          toName={receipt.toName}
          note={receipt.note}
          shareLabel="Share receipt"
          skipLabel="Done"
          onSkip={closeReceipt}
        />
      )}
    </div>
  );
}
