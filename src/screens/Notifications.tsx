import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Avatar, Button, Xp } from '../ui.tsx';
import { timeAgo } from '../utils.ts';

/** A new prize carries a price tag, not a debit — showing it signed reads as
 *  if the balance was just charged for it. */
function amountSign(kind: NotificationItem['kind']): '+' | '−' | '' | null {
  if (kind === 'approved' || kind === 'request') return '+';
  if (kind === 'redeem') return '−';
  if (kind === 'prize') return '';
  return null;
}

function verbFor(kind: NotificationItem['kind']): string {
  switch (kind) {
    case 'approved':
      return 'approved your request';
    case 'denied':
      return 'passed on your request';
    case 'request':
      return 'requested points';
    case 'redeem':
      return 'redeemed a prize';
    case 'prize':
      return 'added a new prize';
    case 'reaction':
      return 'reacted';
    case 'comment':
      return 'commented';
    default:
      return '';
  }
}

export default function Notifications({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .notifications()
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div className="notif-panel">
      <header className="app-header notif-header">
        <button
          className="header-icon-btn"
          onClick={onClose}
          aria-label="Back"
          title="Back"
        >
          <BackIcon />
        </button>
        <span className="wordmark sm">Notifications</span>
        <span className="header-icon-btn header-icon-spacer" aria-hidden />
      </header>

      <div className="notif-list feed">
        {error && <p className="error pad">{error}</p>}
        {items && items.length === 0 && (
          <div className="notif-empty">
            <p className="notif-empty-title">You&apos;re all caught up</p>
            <p className="muted">
              Reactions, approvals, and prizes will show up here.
            </p>
          </div>
        )}
        {items?.map((n) => {
          const sign = amountSign(n.kind);
          const actor = n.actorName ?? 'Someone';
          const reason = n.title || n.body;
          return (
            <article key={n.id} className="feed-card">
              <div className="feed-card-top">
                <span className="feed-time">{timeAgo(n.createdAt)} ago</span>
                {typeof n.points === 'number' && sign !== null && (
                  <Xp value={n.points} sign={sign} size={13} />
                )}
              </div>

              <p className="story-line">
                <span className="story-person">
                  <Avatar
                    name={actor}
                    color={n.actorColor ?? '#008CFF'}
                    src={n.actorAvatar}
                    size={22}
                  />
                  <span className="name">{actor}</span>
                </span>
                <span className="verb">{verbFor(n.kind)}</span>
                {reason && (
                  <span className="story-reason">
                    {n.emoji ? `${n.emoji} ` : ''}
                    {reason}
                  </span>
                )}
              </p>
              <>
                  {n.kind === 'request' && n.id.startsWith('n_req_') && (
                    <div className="row gap" style={{ marginTop: 10 }}>
                      <Button
                        onClick={() =>
                          void api
                            .approve(n.id.slice('n_req_'.length))
                            .then(() => api.notifications().then(setItems))
                            .catch((err) => setError((err as Error).message))
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void api
                            .deny(n.id.slice('n_req_'.length))
                            .then(() => api.notifications().then(setItems))
                            .catch((err) => setError((err as Error).message))
                        }
                      >
                        Pass
                      </Button>
                    </div>
                  )}
                  {n.kind === 'redeem' && n.id.startsWith('n_redeem_') && (
                    <div className="row gap" style={{ marginTop: 10 }}>
                      <Button
                        onClick={() =>
                          void api
                            .fulfill(n.id.slice('n_redeem_'.length))
                            .then(() => api.notifications().then(setItems))
                            .catch((err) => setError((err as Error).message))
                        }
                      >
                        Mark as given
                      </Button>
                    </div>
                  )}
              </>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
