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
import PersonPeekSheet, { type PersonPreview } from './PersonPeek.tsx';

const REACTION_CHOICES = ['❤️', '🔥', '😂', '😍', '👏', '💪', '🎉', '🥹'];

function liveComment(
  comment: FeedComment,
  me:
    | {
        id: string;
        name: string;
        avatarUrl?: string;
      }
    | null
    | undefined,
): FeedComment {
  if (!me) return comment;
  if (comment.userId === me.id) {
    return {
      ...comment,
      name: me.name,
      avatarUrl: me.avatarUrl ?? comment.avatarUrl,
      replyToName:
        comment.replyToUserId === me.id ? me.name : comment.replyToName,
    };
  }
  if (comment.replyToUserId === me.id) {
    return { ...comment, replyToName: me.name };
  }
  return comment;
}

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
  const [peek, setPeek] = useState<PersonPreview | null>(null);

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

  async function addComment(id: string, text: string, replyToId?: string) {
    haptic(12);
    const res = await api.comment(id, text, replyToId);
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

            <div className="story-line">
              <button
                type="button"
                className="story-person story-person-btn"
                onClick={() => {
                  haptic(8);
                  setPeek({
                    id: e.boyfriendId,
                    name: e.boyfriendName,
                    color: e.boyfriendColor,
                    avatarUrl: e.boyfriendAvatar,
                    partnerId: e.wifeId,
                    partnerName: e.wifeName,
                    partnerColor: e.wifeColor,
                    partnerAvatar: e.wifeAvatar,
                  });
                }}
              >
                <Avatar
                  name={e.boyfriendName}
                  color={e.boyfriendColor}
                  src={e.boyfriendAvatar}
                  size={22}
                />
                <span className="name">{e.boyfriendName}</span>
              </button>
              <span className="verb">
                {e.type === 'earn' ? 'earned from' : 'redeemed with'}
              </span>
              <button
                type="button"
                className="story-person story-person-btn"
                onClick={() => {
                  haptic(8);
                  setPeek({
                    id: e.wifeId,
                    name: e.wifeName,
                    color: e.wifeColor,
                    avatarUrl: e.wifeAvatar,
                    partnerId: e.boyfriendId,
                    partnerName: e.boyfriendName,
                    partnerColor: e.boyfriendColor,
                    partnerAvatar: e.boyfriendAvatar,
                  });
                }}
              >
                <Avatar
                  name={e.wifeName}
                  color={e.wifeColor}
                  src={e.wifeAvatar}
                  size={22}
                />
                <span className="name">{e.wifeName}</span>
              </button>
              <span className="story-reason">
                {e.emoji} {e.title}
                {e.note ? ` — ${e.note}` : ''}
              </span>
            </div>

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
          onSubmitComment={(text, replyToId) =>
            addComment(activeCommentEvent.id, text, replyToId)
          }
          onOpenPerson={(next) => {
            haptic(8);
            setPeek(next);
          }}
        />
      )}

      {peek && (
        <PersonPeekSheet
          preview={peek}
          events={events}
          onClose={() => setPeek(null)}
          onOpenPerson={setPeek}
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

function threadedComments(comments: FeedComment[]): FeedComment[] {
  const ids = new Set(comments.map((c) => c.id));
  const roots = comments.filter((c) => !c.replyToId || !ids.has(c.replyToId));
  const children = new Map<string, FeedComment[]>();
  for (const c of comments) {
    if (!c.replyToId || !ids.has(c.replyToId)) continue;
    let root = c.replyToId;
    const seen = new Set<string>();
    while (root && ids.has(root) && !seen.has(root)) {
      seen.add(root);
      const parent = comments.find((item) => item.id === root);
      if (!parent?.replyToId || !ids.has(parent.replyToId)) break;
      root = parent.replyToId;
    }
    const list = children.get(root) ?? [];
    list.push(c);
    children.set(root, list);
  }
  const out: FeedComment[] = [];
  for (const root of roots) {
    out.push(root);
    const kids = (children.get(root.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    out.push(...kids);
  }
  return out;
}

function CommentSheet({
  event,
  onClose,
  onSubmitComment,
  onOpenPerson,
}: {
  event: FeedEventView;
  onClose: () => void;
  onSubmitComment: (text: string, replyToId?: string) => void | Promise<void>;
  onOpenPerson: (next: PersonPreview) => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const comments = threadedComments(event.comments);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const parentId = replyTo?.id;
    setText('');
    setReplyTo(null);
    await onSubmitComment(value, parentId);
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
            comments.map((c) => {
              const shown = liveComment(c, user);
              return (
              <div
                key={c.id}
                className={`comment${c.replyToId ? ' comment-reply' : ''}`}
              >
              <button
                type="button"
                className="comment-avatar-btn"
                onClick={() =>
                  onOpenPerson({
                    id: shown.userId,
                    name: shown.name,
                    color: '#008CFF',
                    avatarUrl: shown.avatarUrl,
                  })
                }
              >
                <Avatar name={shown.name} color="#008CFF" src={shown.avatarUrl} size={34} />
              </button>
                <div className="comment-body">
                  <div className="comment-meta">
                    <button
                      type="button"
                      className="comment-name-btn"
                      onClick={() =>
                        onOpenPerson({
                          id: shown.userId,
                          name: shown.name,
                          color: '#008CFF',
                          avatarUrl: shown.avatarUrl,
                        })
                      }
                    >
                      {shown.name}
                    </button>
                    <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  </div>
                  {shown.replyToName ? (
                    <p className="comment-reply-to">@{shown.replyToName}</p>
                  ) : null}
                  <p className="comment-text">{c.text}</p>
                  <button
                    type="button"
                    className="comment-reply-btn"
                    onClick={() => setReplyTo(c)}
                  >
                    Reply
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>

        {replyTo ? (
          <div className="reply-bar">
            <span>Replying to {liveComment(replyTo, user).name}</span>
            <button
              type="button"
              className="reply-bar-clear"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        ) : null}

        <form className="sheet-input" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              replyTo
                ? `Reply to ${liveComment(replyTo, user).name}…`
                : 'Add a comment…'
            }
            aria-label={
              replyTo
                ? `Reply to ${liveComment(replyTo, user).name}`
                : 'Add a comment'
            }
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
