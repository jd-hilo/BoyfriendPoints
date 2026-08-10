import { useCallback, useEffect, useState } from 'react';
import type { FeedEventView } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Avatar, PointsPill } from '../ui.tsx';
import { timeAgo } from '../utils.ts';

export default function Feed() {
  const [events, setEvents] = useState<FeedEventView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEvents(await api.feed());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function like(id: string) {
    const res = await api.like(id);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              likedByMe: res.likedByMe,
              likes: res.likedByMe
                ? [...e.likes, 'me']
                : e.likes.slice(0, Math.max(0, res.likes)),
            }
          : e,
      ),
    );
  }

  if (loading) return <p className="muted center pad">Loading feed…</p>;

  return (
    <div className="feed">
      {events.length === 0 ? (
        <p className="muted center pad">
          No activity yet. Invite friends to fill up your feed!
        </p>
      ) : (
        events.map((e) => (
          <article key={e.id} className="feed-row">
            <Avatar name={e.boyfriendName} color={e.boyfriendColor} />
            <div className="feed-body">
              <p className="feed-line">
                <span className="name">{e.boyfriendName}</span>
                <span className="verb">
                  {e.type === 'earn' ? ' earned points from ' : ' redeemed with '}
                </span>
                <span className="name">{e.wifeName}</span>
              </p>
              <p className="feed-note">
                {e.emoji} {e.title}
                {e.note ? ` — ${e.note}` : ''}
              </p>
              <div className="feed-meta">
                <span className="time">{timeAgo(e.createdAt)}</span>
                <button
                  className={`like ${e.likedByMe ? 'liked' : ''}`}
                  onClick={() => like(e.id)}
                >
                  {e.likedByMe ? '♥' : '♡'} {e.likes.length || ''}
                </button>
              </div>
            </div>
            <PointsPill value={e.points} kind={e.type} />
          </article>
        ))
      )}
    </div>
  );
}
