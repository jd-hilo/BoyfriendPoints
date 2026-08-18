import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FeedComment,
  FeedEventView,
  FriendRequestView,
} from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar, Xp } from '../ui.tsx';
import { haptic, timeAgo } from '../utils.ts';
import AddFriends from './AddFriends.tsx';

const REACTION_CHOICES = ['❤️', '🔥', '😂', '😍', '👏', '💪', '🎉', '🥹'];

function PhotoCarousel({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(images.length - 1, idx)));
  }

  return (
    <div className="carousel">
      <div className="carousel-track" ref={trackRef} onScroll={onScroll}>
        {images.map((src, i) => (
          <img
            key={src}
            className="carousel-img"
            src={src}
            alt={`Photo ${i + 1}`}
            loading="lazy"
          />
        ))}
      </div>
      {images.length > 1 && (
        <div className="carousel-dots">
          {images.map((src, i) => (
            <span key={src} className={`dot ${i === active ? 'on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedEventView[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [popped, setPopped] = useState<string | null>(null);
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [feed, requests] = await Promise.all([
        api.feed(),
        api.friendRequests().catch(() => [] as FriendRequestView[]),
      ]);
      setEvents(feed);
      setFriendRequests(requests);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function like(id: string) {
    haptic(12);
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

  async function react(id: string, emoji: string) {
    haptic([8, 20, 8]);
    setPickerFor(null);
    setPopped(`${id}:${emoji}`);
    setTimeout(() => setPopped(null), 450);
    const res = await api.react(id, emoji);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, reactions: res.reactions } : e)),
    );
  }

  const activeCommentEvent = events.find((e) => e.id === commentsFor) ?? null;

  async function addComment(id: string, text: string) {
    haptic(12);
    const res = await api.comment(id, text);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, comments: res.comments } : e)),
    );
  }

  async function resolveFriendRequest(id: string, accept: boolean) {
    try {
      if (accept) await api.acceptFriendRequest(id);
      else await api.declineFriendRequest(id);
      setFriendRequests((requests) =>
        requests.filter((request) => request.id !== id),
      );
      if (accept) await load();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  const incomingRequests = friendRequests.filter(
    (request) =>
      request.to.id === (user?.inviteCode ? user.id : user?.partnerId),
  );

  if (loading) return null;

  return (
    <div className="feed feed-ready">
      {incomingRequests.length > 0 ? (
        <div className="friend-request-list">
          {incomingRequests.map((request) => (
            <div key={request.id} className="friend-request-card">
              <div className="add-friends-avatars">
                <Avatar
                  name={request.from.partnerName ?? 'Partner'}
                  color={request.from.partnerColor ?? '#008cff'}
                  src={request.from.partnerAvatar}
                  size={35}
                />
                <span className="add-friends-partner">
                  <Avatar
                    name={request.from.name}
                    color={request.from.color}
                    src={request.from.avatarUrl}
                    size={35}
                  />
                </span>
              </div>
              <div className="friend-request-text">
                <strong>
                  {request.from.name} & {request.from.partnerName ?? 'partner'}
                </strong>
                <span>want to connect couples</span>
              </div>
              <button
                type="button"
                className="add-friends-add"
                onClick={() => void resolveFriendRequest(request.id, true)}
              >
                Accept
              </button>
              <button
                type="button"
                className="friend-request-decline"
                onClick={() => void resolveFriendRequest(request.id, false)}
                aria-label="Decline"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {events.length === 0 ? (
        <div className="feed-card">
          <p className="muted center" style={{ margin: 12 }}>
            No activity yet. Add friends to fill up your feed!
          </p>
        </div>
      ) : (
        events.map((e) => (
          <article key={e.id} className="feed-card">
            <div className="feed-card-top">
              <span className="feed-time">{timeAgo(e.createdAt)} ago</span>
              <Xp
                value={e.points}
                sign={e.type === 'earn' ? '+' : '−'}
                size={13}
              />
            </div>

            <p className="story-line">
              <span className="story-person">
                <Avatar
                  name={e.boyfriendName}
                  color={e.boyfriendColor}
                  src={e.boyfriendAvatar}
                  size={22}
                />
                <span className="name">{e.boyfriendName}</span>
              </span>
              <span className="verb">
                {e.type === 'earn' ? 'earned from' : 'redeemed with'}
              </span>
              <span className="story-person">
                <Avatar
                  name={e.wifeName}
                  color={e.wifeColor}
                  src={e.wifeAvatar}
                  size={22}
                />
                <span className="name">{e.wifeName}</span>
              </span>
              <span className="story-reason">
                {e.emoji} {e.title}
                {e.note ? ` — ${e.note}` : ''}
              </span>
            </p>

            {e.type === 'earn' && e.images.length > 0 && (
              <PhotoCarousel images={e.images} />
            )}

            <ReactionRow
              event={e}
              meId={user?.id}
              poppedKey={popped}
              onToggle={(emoji) => react(e.id, emoji)}
            />

            <div className="feed-actions">
              <button
                className="action-circle"
                aria-label="Comment"
                type="button"
                onClick={() => {
                  haptic(10);
                  setCommentsFor(e.id);
                }}
              >
                💬
                {e.comments.length > 0 && (
                  <span className="action-count">{e.comments.length}</span>
                )}
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
              <button
                className="action-circle"
                aria-label="React"
                type="button"
                onClick={() => {
                  haptic(10);
                  setPickerFor(pickerFor === e.id ? null : e.id);
                }}
              >
                ☺
              </button>
              {pickerFor === e.id && (
                <EmojiPicker
                  onPick={(emoji) => react(e.id, emoji)}
                  onClose={() => setPickerFor(null)}
                />
              )}
            </div>
          </article>
        ))
      )}

      {activeCommentEvent && (
        <CommentSheet
          event={activeCommentEvent}
          onClose={() => setCommentsFor(null)}
          onSubmitComment={(text) => addComment(activeCommentEvent.id, text)}
        />
      )}

      <button
        type="button"
        className="add-friend-pill"
        aria-label="Add friends"
        onClick={() => {
          haptic(10);
          setAddFriendsOpen(true);
        }}
      >
        <PersonAddIcon />
      </button>

      {addFriendsOpen ? (
        <AddFriends
          onClose={() => setAddFriendsOpen(false)}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}

function PersonAddIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

function ReactionRow({
  event,
  meId,
  poppedKey,
  onToggle,
}: {
  event: FeedEventView;
  meId?: string;
  poppedKey: string | null;
  onToggle: (emoji: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of event.reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (meId && r.userId === meId) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return [...map.entries()];
  }, [event.reactions, meId]);

  if (grouped.length === 0) return null;

  return (
    <div className="reaction-row">
      {grouped.map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          className={`reaction-pill ${mine ? 'mine' : ''} ${
            poppedKey === `${event.id}:${emoji}` ? 'pop' : ''
          }`}
          onClick={() => onToggle(emoji)}
        >
          <span className="reaction-emoji">{emoji}</span>
          <span className="reaction-count">{count}</span>
        </button>
      ))}
    </div>
  );
}

function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="picker-backdrop" onClick={onClose} />
      <div className="emoji-picker" role="menu">
        {REACTION_CHOICES.map((emoji) => (
          <button
            key={emoji}
            className="emoji-choice"
            onClick={() => onPick(emoji)}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

function CommentSheet({
  event,
  onClose,
  onSubmitComment,
}: {
  event: FeedEventView;
  onClose: () => void;
  onSubmitComment: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const comments: FeedComment[] = event.comments;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    await onSubmitComment(value);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>Comments</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-body">
          {comments.length === 0 ? (
            <p className="muted center" style={{ padding: '24px 0' }}>
              No comments yet. Be the first 💬
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment">
                <Avatar name={c.name} color="#008CFF" src={c.avatarUrl} size={34} />
                <div className="comment-body">
                  <p className="comment-meta">
                    <span className="comment-name">{c.name}</span>
                    <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  </p>
                  <p className="comment-text">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="sheet-input" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            autoFocus
          />
          <button type="submit" className="sheet-send" disabled={!text.trim()}>
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
