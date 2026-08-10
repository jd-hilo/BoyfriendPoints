import { useCallback, useEffect, useState } from 'react';
import type { Submission, Suggestion } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, XpIcon } from '../ui.tsx';
import { haptic } from '../utils.ts';

interface SuccessInfo {
  title: string;
  emoji: string;
  points: number;
  photos: number;
}

export default function Submit({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([api.tasks(), api.submissions()]);
    if (t.length > 0) {
      setOptions(
        t.map((task) => ({
          title: task.title,
          emoji: task.emoji,
          points: task.points,
        })),
      );
    } else {
      const suggestions = await api.suggestions();
      setOptions(suggestions.tasks);
    }
    setMine(s);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function pickTask(task: Suggestion) {
    setTitle(task.title);
    setEmoji(task.emoji);
    setPoints(String(task.points));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.submit(title, Number(points), emoji, note, images);
      haptic([10, 40, 10]);
      setSuccess({
        title: title.trim(),
        emoji,
        points: Number(points),
        photos: images.length,
      });
      setTitle('');
      setEmoji('⭐');
      setPoints('');
      setNote('');
      setImages([]);
      await load();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="screen">
      <div>
        <h2 className="screen-title flush">Submit</h2>
        <p className="muted small" style={{ margin: '4px 2px 0' }}>
          Pick something you did or write your own. Your partner approves it.
        </p>
      </div>

      {options.length > 0 && (
        <>
          <p className="section-label">Quick submit</p>
          <div className="chip-grid">
            {options.map((t) => (
              <button key={t.title} className="chip" onClick={() => pickTask(t)}>
                <span className="chip-emoji">{t.emoji}</span>
                <span className="chip-title">{t.title}</span>
                <span className="chip-points">+{t.points}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <form className="card form" onSubmit={submit}>
        <p className="section-label">Or submit your own</p>
        <div className="row gap">
          <input
            className="emoji-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            aria-label="Emoji"
            maxLength={2}
          />
          <input
            className="grow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What did you do?"
            aria-label="What did you do?"
          />
        </div>
        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="Points requested"
          aria-label="Points requested"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          aria-label="Note"
        />

        <div className="photo-attach">
          {images.map((src) => (
            <span key={src} className="photo-thumb">
              <img src={src} alt="Attached" />
              <button
                type="button"
                className="photo-remove"
                aria-label="Remove photo"
                onClick={() => setImages((p) => p.filter((x) => x !== src))}
              >
                ✕
              </button>
            </span>
          ))}
          {images.length < 4 && (
            <button
              type="button"
              className="photo-add"
              onClick={() =>
                setImages((p) => [
                  ...p,
                  `https://picsum.photos/seed/bp-${Date.now()}-${p.length}/720/480`,
                ])
              }
            >
              <span className="photo-add-plus">＋</span>
              <span>Add photo</span>
            </button>
          )}
        </div>

        {error && <p className="error">{error}</p>}
        <Button type="submit" block disabled={!title || !points}>
          Request points
        </Button>
      </form>

      {mine.length > 0 && (
        <>
          <p className="section-label">Your requests</p>
          <div className="list">
            {mine.map((s) => (
              <div key={s.id} className="mini-row">
                <span>
                  {s.emoji} {s.title}
                </span>
                <span className={`status status-${s.status}`}>
                  {s.status === 'approved'
                    ? `+${s.points}${s.revised ? ' (revised)' : ''}`
                    : s.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {success && (
        <SuccessModal
          info={success}
          partnerName={user?.partnerName}
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  );
}

function SuccessModal({
  info,
  partnerName,
  onClose,
}: {
  info: SuccessInfo;
  partnerName?: string;
  onClose: () => void;
}) {
  const partner = partnerName ?? 'your partner';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Request sent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-check">
          <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
            <path
              d="m5 12 5 5L19 7"
              fill="none"
              stroke="#fff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h3 className="modal-title">Request sent! 🎉</h3>
        <p className="modal-sub">
          {partner} will get a notification to review it.
        </p>

        <div className="modal-summary">
          <span className="modal-summary-emoji">{info.emoji}</span>
          <div className="modal-summary-text">
            <span className="modal-summary-title">{info.title}</span>
            {info.photos > 0 && (
              <span className="modal-summary-meta">
                {info.photos} photo{info.photos > 1 ? 's' : ''} attached
              </span>
            )}
          </div>
          <span className="modal-summary-points">
            +{info.points}
            <XpIcon size={16} />
          </span>
        </div>

        <p className="modal-note">
          Once {partner} approves, the points land in your balance and the win
          shows up on the feed. They can also revise the amount before approving.
        </p>

        <Button block onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
