import { useEffect, useState } from 'react';
import type { CoupleSearchResult } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar } from '../ui.tsx';

export default function AddFriends({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoupleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void api
        .searchCouples(q)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setHasSearched(true);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError((err as Error).message);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function requestFriend(couple: CoupleSearchResult) {
    setSendingId(couple.id);
    setError(null);
    try {
      await api.requestFriend(couple.coupleUsername);
      setResults((current) =>
        current.map((item) =>
          item.id === couple.id ? { ...item, relationship: 'pending' } : item,
        ),
      );
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  async function shareProfile() {
    if (!user?.coupleUsername) return;
    const text =
      `We're on LoveReceipts — we give each other points for the little things, then cash them in for date night.\n\n` +
      `Find us: @${user.coupleUsername} 🧾\n\n` +
      `https://testflight.apple.com/join/aM6xgrsc`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(`@${user.coupleUsername}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="notif-panel add-friends-panel">
      <header className="add-friends-header">
        <div>
          <h2>Add your friends</h2>
          <p>Search a couple username. They have to accept before they show up on your feed.</p>
        </div>
        <button className="add-friends-done" onClick={onClose} type="button">
          Done
        </button>
      </header>

      <p className="section-label">SEARCH COUPLE USERNAMES</p>
      <label className="add-friends-search">
        <span>@</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(
              e.target.value
                .toLowerCase()
                .replace(/^@/, '')
                .replace(/[^a-z0-9_]/g, ''),
            );
            setError(null);
          }}
          placeholder="emmaandnoah"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search couple username"
        />
        {searching ? <span className="muted small">…</span> : null}
      </label>

      {user?.coupleUsername ? (
        <div className="add-friends-share">
          <div>
            <p className="add-friends-share-title">Share your couple username</p>
            <p className="add-friends-share-handle">@{user.coupleUsername}</p>
          </div>
          <button type="button" onClick={() => void shareProfile()}>
            {copied ? 'Copied' : 'Share now'}
          </button>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="add-friends-results">
        {query.length >= 2 && hasSearched && results.length === 0 && !searching ? (
          <p className="muted center">No couples found.</p>
        ) : null}
        {results.map((couple) => (
          <div key={couple.id} className="add-friends-result">
            <div className="add-friends-avatars">
              <Avatar
                name={couple.name}
                color={couple.color}
                src={couple.avatarUrl}
                size={36}
              />
              {couple.partnerName ? (
                <span className="add-friends-partner">
                  <Avatar
                    name={couple.partnerName}
                    color={couple.partnerColor ?? '#008cff'}
                    src={couple.partnerAvatar}
                    size={36}
                  />
                </span>
              ) : null}
            </div>
            <div className="add-friends-meta">
              <strong>@{couple.coupleUsername}</strong>
              <span>
                {couple.partnerName
                  ? `${couple.name} & ${couple.partnerName}`
                  : couple.name}
              </span>
            </div>
            <button
              type="button"
              className={
                couple.relationship === 'none'
                  ? 'add-friends-add'
                  : 'add-friends-add muted-btn'
              }
              disabled={
                couple.relationship !== 'none' || sendingId === couple.id
              }
              onClick={() => void requestFriend(couple)}
            >
              {couple.relationship === 'friends'
                ? 'Friends'
                : couple.relationship === 'pending'
                  ? 'Requested'
                  : sendingId === couple.id
                    ? 'Sending…'
                    : 'Add'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
