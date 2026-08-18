import { useCallback, useEffect, useState } from 'react';
import type { EarnTask, Submission, Suggestion } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, EmojiField, ReceiptModal, WhoPill, Xp } from '../ui.tsx';
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
}: {
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [scope, setScope] = useState<'you' | 'them'>('you');
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [created, setCreated] = useState<EarnTask[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [addingTask, setAddingTask] = useState(false);
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
    setOptions(
      t
        .filter((task) => user?.partnerId && task.wifeId === user.partnerId)
        .map((task) => ({
          title: task.title,
          emoji: task.emoji,
          points: task.points,
        })),
    );
    setCreated(t.filter((task) => task.wifeId === user?.id));
    setMine(s.filter((sub) => sub.boyfriendId === user?.id));
  }, [user?.id, user?.partnerId]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addTask(
        taskForm.title,
        Number(taskForm.points),
        taskForm.emoji,
      );
      setTaskForm({ emoji: '⭐', title: '', points: '' });
      setAddingTask(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeTask(id: string) {
    setError(null);
    try {
      await api.removeTask(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
  const partnerFirst = user?.partnerName?.trim().split(/\s+/)[0] ?? 'them';

  return (
    <div className="screen">
      <div className="title-row">
        <h2 className="screen-title flush">Tasks</h2>
        <WhoPill
          value={scope}
          themLabel={`For ${partnerFirst}`}
          onChange={(next) => {
            haptic(10);
            setScope(next);
          }}
        />
      </div>

      {error && <p className="error">{error}</p>}

      {scope === 'you' ? (
        <>
          <p className="muted small" style={{ margin: '0 2px' }}>
            {user?.partnerId
              ? `Tasks ${partner} set for you — submit one for points.`
              : 'Once you’re linked, their tasks show up here.'}
          </p>

          {options.length === 0 && !user?.partnerId && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="coach-title">Add your partner first</p>
              <p className="muted small">
                Once you’re linked, you can submit wins for points.
              </p>
            </div>
          )}

          {options.length > 0 && (
            <>
              <p className="section-label">Quick submit</p>
              <div className="chip-grid">
                {options.map((t) => (
                  <button
                    key={t.title}
                    className="chip"
                    onClick={() => pickTask(t)}
                  >
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

          {(options.length > 0 || user?.partnerId) && (
            <form className="card form" onSubmit={submit}>
              <p className="section-label">
                {options.length > 0
                  ? 'Or submit your own'
                  : 'Submit a task for points'}
              </p>
              <div className="row gap">
                <EmojiField value={emoji} onChange={setEmoji} />
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

              <Button type="submit" block disabled={!title || !points}>
                Request points
              </Button>
            </form>
          )}

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
        </>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 2px' }}>
            Tasks you set for {partnerFirst} — they submit these to earn points.
          </p>

          {created.length > 0 && (
            <div className="chip-grid">
              {created.map((t) => (
                <div key={t.id} className="chip chip-static">
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Remove ${t.title}`}
                    onClick={() => void removeTask(t.id)}
                  >
                    ✕
                  </button>
                  <span className="chip-emoji">{t.emoji}</span>
                  <span className="chip-title">{t.title}</span>
                  <span className="chip-points">
                    <Xp value={t.points} sign="+" size={11} />
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="chip chip-add"
            onClick={() => {
              haptic(10);
              setError(null);
              setAddingTask(true);
            }}
          >
            <span className="chip-emoji">＋</span>
            <span className="chip-title">Add a task</span>
            <span className="chip-points">For {partnerFirst}</span>
          </button>
        </>
      )}

      {addingTask && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setAddingTask(false);
            setTaskForm({ emoji: '⭐', title: '', points: '' });
          }}
        >
          <form
            className="modal compose-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={addTask}
          >
            <div className="compose-modal-head">
              <div>
                <p className="modal-title">Add a task</p>
                <p className="modal-sub">
                  {partnerFirst === 'them'
                    ? 'They submit this to earn points.'
                    : `${partnerFirst} submits this to earn points.`}
                </p>
              </div>
              <button
                type="button"
                className="compose-modal-cancel"
                onClick={() => {
                  setAddingTask(false);
                  setTaskForm({ emoji: '⭐', title: '', points: '' });
                }}
              >
                Cancel
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row gap">
              <EmojiField
                value={taskForm.emoji}
                onChange={(next) => setTaskForm({ ...taskForm, emoji: next })}
                autoFocus
              />
              <input
                className="grow"
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
                placeholder={`A task for ${partnerFirst}`}
                aria-label="Task title"
                autoFocus
              />
            </div>
            <input
              type="number"
              value={taskForm.points}
              onChange={(e) =>
                setTaskForm({ ...taskForm, points: e.target.value })
              }
              placeholder="Points they earn"
              aria-label="Points they earn"
            />
            <Button
              type="submit"
              block
              disabled={!taskForm.title.trim() || !taskForm.points}
            >
              Add task
            </Button>
          </form>
        </div>
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
