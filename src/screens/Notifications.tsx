import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Avatar, Xp } from '../ui.tsx';
import { timeAgo } from '../utils.ts';

function amountKind(kind: NotificationItem['kind']): 'earn' | 'redeem' | null {
  if (kind === 'approved' || kind === 'request') return 'earn';
  if (kind === 'redeem' || kind === 'prize') return 'redeem';
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
      <header className="app-header">
        <button
          className="header-icon-btn"
          onClick={onClose}
          aria-label="Back"
          title="Back"
        >
          <BackIcon />
        </button>
        <div className="search-pill">
          <span className="brand-gem" aria-hidden>
            🔔
          </span>
          <span className="wordmark sm">Notifications</span>
        </div>
        <span className="header-icon-btn header-icon-spacer" aria-hidden />
      </header>

      <div className="notif-list feed">
        {error && <p className="error pad">{error}</p>}
        {items === null && !error && (
          <p className="muted center pad">Loading…</p>
        )}
        {items && items.length === 0 && (
          <div className="feed-card">
            <div className="notif-empty">
              <span className="notif-empty-emoji">🔔</span>
              <p className="notif-empty-title">You&apos;re all caught up</p>
              <p className="muted small">
                Reactions, approvals, new requests and prizes will show up here.
              </p>
            </div>
          </div>
        )}
        {items?.map((n) => {
          const amount = amountKind(n.kind);
          const actor = n.actorName ?? 'Someone';
          return (
            <article key={n.id} className="feed-card">
              <div className="feed-card-top">
                <span className="feed-time">{timeAgo(n.createdAt)} ago</span>
                <span className="feed-more" aria-hidden>
                  ···
                </span>
              </div>

              <div className="feed-story">
                {n.actorAvatar || n.actorName ? (
                  <Avatar
                    name={actor}
                    color={n.actorColor ?? '#008CFF'}
                    src={n.actorAvatar}
                    size={40}
                  />
                ) : (
                  <span className="notif-emoji-bubble" aria-hidden>
                    {n.emoji}
                  </span>
                )}
                <div className="feed-story-text">
                  <p className="feed-line">
                    <span className="name">{actor}</span>
                    <span className="verb"> {verbFor(n.kind)}</span>
                  </p>
                  {(n.body || n.emoji) && (
                    <p className="feed-note">
                      {n.emoji} {n.body ?? ''}
                    </p>
                  )}
                </div>
                {typeof n.points === 'number' && amount && (
                  <span className="feed-amount">
                    <Xp
                      value={n.points}
                      sign={amount === 'earn' ? '+' : '−'}
                      size={13}
                    />
                  </span>
                )}
              </div>
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
