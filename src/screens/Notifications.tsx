import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Avatar, XpIcon } from '../ui.tsx';
import { timeAgo } from '../utils.ts';

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
      <header className="notif-header">
        <button className="notif-back" onClick={onClose} aria-label="Back">
          ‹
        </button>
        <h2>Notifications</h2>
        <span className="notif-spacer" />
      </header>

      <div className="notif-list">
        {error && <p className="error pad">{error}</p>}
        {items === null && !error && (
          <p className="muted center pad">Loading…</p>
        )}
        {items && items.length === 0 && (
          <div className="notif-empty">
            <span className="notif-empty-emoji">🔔</span>
            <p className="notif-empty-title">You&apos;re all caught up</p>
            <p className="muted small">
              Reactions, approvals, new requests and prizes will show up here.
            </p>
          </div>
        )}
        {items?.map((n) => (
          <div key={n.id} className="notif-row">
            <div className="notif-avatar">
              {n.actorAvatar ? (
                <Avatar
                  name={n.actorName ?? '?'}
                  color={n.actorColor ?? '#008CFF'}
                  src={n.actorAvatar}
                  size={42}
                />
              ) : (
                <span className="notif-emoji-bubble">{n.emoji}</span>
              )}
              <span className="notif-kind-badge">{n.emoji}</span>
            </div>
            <div className="notif-body">
              <p className="notif-title">{n.title}</p>
              {n.body && <p className="notif-sub">{n.body}</p>}
              <span className="notif-time">{timeAgo(n.createdAt)} ago</span>
            </div>
            {typeof n.points === 'number' && (
              <span className={`notif-points ${n.kind}`}>
                {n.kind === 'redeem' || n.kind === 'prize' ? '' : '+'}
                {n.points}
                <XpIcon size={14} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
