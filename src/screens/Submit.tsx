import { useCallback, useEffect, useState } from 'react';
import type { Submission, Suggestion } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, ReceiptModal, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  points: number;
  photos: number;
}

export default function Submit({
  onDone,
  coachOpen,
  onCoachDismiss,
}: {
  onDone: () => void;
  coachOpen?: boolean;
  onCoachDismiss?: () => void;
}) {
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
  const [sharing, setSharing] = useState(false);

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
    onCoachDismiss?.();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const submission = await api.submit(
        title,
        Number(points),
        emoji,
        note,
        images,
      );
      haptic([10, 40, 10]);
      setSuccess({
        id: submission.id,
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
      onCoachDismiss?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function finish(share: boolean) {
    if (!success) return;
    setSharing(true);
    try {
      if (share) {
        await api.shareSubmission(success.id);
        haptic(12);
      }
      setSuccess(null);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  const partner = user?.partnerName ?? 'your partner';

  return (
    <div className="screen">
      <div>
        <h2 className="screen-title flush">Submit</h2>
        <p className="muted small" style={{ margin: '4px 2px 0' }}>
          Pick something you did or write your own. Your partner approves it.
        </p>
      </div>

      {coachOpen && (
        <div className="coach-card">
          <p className="coach-title">Land your first win 💎</p>
          <p className="coach-body">
            Tap something you already did. We&apos;ll send {partner} a point
            request — and you&apos;ll get a shareable receipt.
          </p>
          {options[0] && (
            <Button block onClick={() => pickTask(options[0])}>
              Quick start: {options[0].emoji} {options[0].title}
            </Button>
          )}
          <Button variant="ghost" block onClick={() => onCoachDismiss?.()}>
            I&apos;ll look around first
          </Button>
        </div>
      )}

      {options.length > 0 && (
        <>
          <p className="section-label">Quick submit</p>
          <div className="chip-grid">
            {options.map((t) => (
              <button key={t.title} className="chip" onClick={() => pickTask(t)}>
                <span className="chip-emoji">{t.emoji}</span>
                <span className="chip-title">{t.title}</span>
                <span className="chip-points">
                  <Xp value={t.points} sign="+" size={11} />
                </span>
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
                <span className={`status status-${s.status} row gap center-y`}>
                  {s.status === 'approved' ? (
                    <>
                      <Xp value={s.points} sign="+" size={11} />
                      {s.revised ? <span>revised</span> : null}
                    </>
                  ) : (
                    s.status
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {success && user && (
        <ReceiptModal
          kind="request"
          subtitle={`${partner} will review this next.`}
          emoji={success.emoji}
          itemTitle={success.title}
          meta={
            success.photos > 0
              ? `${success.photos} photo${success.photos > 1 ? 's' : ''} attached`
              : undefined
          }
          points={success.points}
          fromName={user.name}
          toName={user.partnerName ?? 'Partner'}
          note="Uncheck below if you want this kept off the feed."
          shareLabel="Share receipt"
          skipLabel="Done"
          feedLabel="Post to feed when approved"
          busy={sharing}
          onShare={() => finish(true)}
          onSkip={() => void finish(false)}
        />
      )}
    </div>
  );
}
