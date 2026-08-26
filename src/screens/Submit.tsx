import { useCallback, useEffect, useState } from 'react';
import type { EarnTask, Submission, Suggestion } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Button, EmojiField, ReceiptModal, TASK_EMOJIS, WhoPill, Xp } from '../ui.tsx';
import { haptic, sharePartnerInvite } from '../utils.ts';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  points: number;
  photos: number;
  granted?: boolean;
}

export default function Submit({
  onDone,
  onEnterCode,
}: {
  onDone: () => void;
  onEnterCode?: () => void;
}) {
  const { user } = useAuth();
  const [scope, setScope] = useState<'you' | 'them'>('you');
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [created, setCreated] = useState<EarnTask[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [taskForm, setTaskForm] = useState<{
    emoji: string;
    title: string;
    points: string;
  }>({
    emoji: TASK_EMOJIS[0],
    title: '',
    points: '',
  });
  const [addingTask, setAddingTask] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [busyGrant, setBusyGrant] = useState<string | null>(null);
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
    if (savingTask) return;
    haptic(10);
    setSavingTask(true);
    setError(null);
    try {
      await api.addTask(
        taskForm.title,
        Number(taskForm.points),
        taskForm.emoji,
      );
      setTaskForm({ emoji: TASK_EMOJIS[0], title: '', points: '' });
      setAddingTask(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTask(false);
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

  async function grantTask(task: EarnTask) {
    if (busyGrant) return;
    setError(null);
    setBusyGrant(task.id);
    try {
      const { submission } = await api.grant(
        task.title,
        task.points,
        task.emoji,
      );
      haptic([10, 40, 10]);
      setSuccess({
        id: submission.id,
        title: task.title,
        emoji: task.emoji,
        points: task.points,
        photos: 0,
        granted: true,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyGrant(null);
    }
  }

  async function grantCustom(e: React.FormEvent) {
    e.preventDefault();
    if (busyGrant) return;
    setError(null);
    setBusyGrant('custom');
    try {
      const { submission } = await api.grant(
        title,
        Number(points),
        emoji,
        note,
      );
      haptic([10, 40, 10]);
      setSuccess({
        id: submission.id,
        title: title.trim(),
        emoji,
        points: Number(points),
        photos: 0,
        granted: true,
      });
      setTitle('');
      setEmoji('⭐');
      setPoints('');
      setNote('');
      setGrantOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyGrant(null);
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
                Invite them, or enter their code if they already signed up.
              </p>
              <Button
                block
                disabled={!user?.inviteCode}
                onClick={() =>
                  void sharePartnerInvite(user?.name ?? '', user?.inviteCode)
                }
              >
                Invite partner
              </Button>
              {onEnterCode ? (
                <button
                  type="button"
                  className="quiet-link"
                  onClick={onEnterCode}
                >
                  Have their code?
                </button>
              ) : null}
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
            {user?.partnerId
              ? `Tap a task to send ${partnerFirst} those points.`
              : 'Add your partner first to send them points.'}
          </p>

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
                <button
                  type="button"
                  className="chip-grant"
                  disabled={Boolean(busyGrant) || !user?.partnerId}
                  onClick={() => void grantTask(t)}
                >
                  <span className="chip-emoji">{t.emoji}</span>
                  <span className="chip-title">{t.title}</span>
                  <span className="chip-points">
                    <Xp value={t.points} sign="+" size={11} />
                  </span>
                  {busyGrant === t.id ? (
                    <span className="muted small">Sending…</span>
                  ) : null}
                </button>
              </div>
            ))}
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
          </div>
          {user?.partnerId ? (
            <button
              type="button"
              className="grant-banner"
              onClick={() => {
                haptic(10);
                setError(null);
                setTitle('');
                setEmoji('⭐');
                setPoints('');
                setNote('');
                setGrantOpen(true);
              }}
            >
              <span className="grant-banner-icon" aria-hidden>
                <SparkleIcon />
              </span>
              <span className="grant-banner-copy">
                <span className="grant-banner-title">
                  Did they do something not listed?
                </span>
                <span className="grant-banner-sub">Send them points.</span>
              </span>
            </button>
          ) : null}
        </>
      )}

      {grantOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setGrantOpen(false);
            setTitle('');
            setEmoji('⭐');
            setPoints('');
            setNote('');
          }}
        >
          <form
            className="modal compose-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={grantCustom}
          >
            <div className="compose-modal-head">
              <div>
                <p className="modal-title">Reward them</p>
                <p className="modal-sub">
                  Send {partnerFirst} points for something that wasn’t a listed task.
                </p>
              </div>
              <button
                type="button"
                className="compose-modal-cancel"
                onClick={() => {
                  setGrantOpen(false);
                  setTitle('');
                  setEmoji('⭐');
                  setPoints('');
                  setNote('');
                }}
              >
                Cancel
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <EmojiField value={emoji} onChange={setEmoji} />
              <input
                className="grow"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What did they do?"
                aria-label="What they did"
                autoFocus
              />
            </div>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Points to send"
              aria-label="Points to send"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              aria-label="Note"
            />
            <Button
              type="submit"
              block
              disabled={busyGrant === 'custom' || !title.trim() || !points}
            >
              {busyGrant === 'custom' ? 'Sending…' : 'Send points'}
            </Button>
          </form>
        </div>
      )}

      {addingTask && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setAddingTask(false);
            setTaskForm({ emoji: TASK_EMOJIS[0], title: '', points: '' });
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
                  setTaskForm({ emoji: TASK_EMOJIS[0], title: '', points: '' });
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
              disabled={savingTask || !taskForm.title.trim() || !taskForm.points}
            >
              {savingTask ? 'Submitting…' : 'Add task'}
            </Button>
          </form>
        </div>
      )}

      {success && user && (
        <ReceiptModal
          kind={success.granted ? 'grant' : 'request'}
          subtitle={
            success.granted
              ? `${partnerFirst} already has the points. Posted to your feed.`
              : `${partner} will review this next.`
          }
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
          note={
            success.granted
              ? undefined
              : 'Uncheck below if you want this kept off the feed.'
          }
          shareLabel="Share receipt"
          skipLabel="Done"
          feedLabel="Post to feed when approved"
          busy={sharing}
          onShare={success.granted ? undefined : () => finish(true)}
          onSkip={() => void finish(false)}
        />
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2 13.4 8.6 18.8 10 13.4 11.4 12 16.8 10.6 11.4 5.2 10 10.6 8.6 12 3.2Z"
        fill="currentColor"
      />
      <path
        d="m18.2 14.4.7 2.5 2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7.7-2.5Z"
        fill="currentColor"
      />
      <path
        d="m6.4 14.8.55 1.9 1.9.55-1.9.55-.55 1.9-.55-1.9-1.9-.55 1.9-.55.55-1.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
