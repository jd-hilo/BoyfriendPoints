import { useCallback, useEffect, useState } from 'react';
import type { FeedEventView } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Avatar } from '../ui.tsx';
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
                ? e.likes.includes('me')
                  ? e.likes
                  : [...e.likes, 'me']
                : e.likes.filter((x) => x !== 'me').slice(0, res.likes),
            }
          : e,
      ),
    );
  }

  if (loading) return <p className="muted center pad">Loading feed…</p>;

  return (
    <div className="feed">
      {events.length === 0 ? (
        <div className="feed-card">
          <p className="muted center" style={{ margin: 12 }}>
            No activity yet. Invite friends to fill up your feed!
          </p>
        </div>
      ) : (
        events.map((e) => (
          <article key={e.id} className="feed-card">
            <div className="feed-card-top">
              <span className="feed-time">{timeAgo(e.createdAt)} ago</span>
              <button className="feed-more" aria-label="More">
                ···
              </button>
            </div>

            <div className="feed-story">
              <Avatar name={e.boyfriendName} color={e.boyfriendColor} size={40} />
              <div className="feed-story-text">
                <p className="feed-line">
                  <span className="name">{e.boyfriendName}</span>
                  <span className="verb">
                    {e.type === 'earn' ? ' earned from ' : ' redeemed with '}
                  </span>
                  <span className="name">{e.wifeName}</span>
                </p>
                <p className="feed-note">
                  {e.emoji} {e.title}
                  {e.note ? ` — ${e.note}` : ''}
                </p>
              </div>
              <span
                className={`feed-amount ${e.type === 'earn' ? 'earn' : 'redeem'}`}
              >
                {e.type === 'earn' ? '+' : '−'}
                {e.points}
              </span>
            </div>

            <div className="feed-actions">
              <button className="action-circle" aria-label="Comment" type="button">
                💬
              </button>
              <button
                className={`action-circle ${e.likedByMe ? 'liked' : ''}`}
                onClick={() => like(e.id)}
                aria-label="Like"
                type="button"
              >
                {e.likedByMe ? '♥' : '♡'}
                {e.likes.length > 0 && (
                  <span className="action-count">{e.likes.length}</span>
                )}
              </button>
              <button className="action-circle" aria-label="React" type="button">
                ☺
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
