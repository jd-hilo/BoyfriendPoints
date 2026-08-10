import { useCallback, useEffect, useState } from 'react';
import type { Redemption, Submission } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Button } from '../ui.tsx';

export default function WifeRequests({ onChange }: { onChange: () => void }) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [revise, setRevise] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.submissions(), api.redemptions()]);
    setSubs(s);
    setRedemptions(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="pad screen-scroll">
      <h2 className="screen-title">Requests</h2>
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
                <span className="request-points">+{s.requestedPoints}</span>
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
                  onClick={() =>
                    act(() =>
                      api.approve(
                        s.id,
                        revise[s.id] ? Number(revise[s.id]) : undefined,
                      ),
                    )
                  }
                >
                  {revise[s.id] ? 'Revise & approve' : 'Approve'}
                </Button>
                <Button variant="danger" onClick={() => act(() => api.deny(s.id))}>
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
                <span className="request-points redeem">−{r.cost}</span>
              </div>
              <Button
                block
                variant="secondary"
                onClick={() => act(() => api.fulfill(r.id))}
              >
                Mark as given
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
