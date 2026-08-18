import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar, Button, Xp } from '../ui.tsx';
import { haptic } from '../utils.ts';

export default function Profile({ onClose }: { onClose: () => void }) {
  const { user, applyUser, logout, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // A rename elsewhere (or a refresh) shouldn't leave a stale draft in the box.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  if (!user) return null;
  const me = user;
  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== me.name;

  async function leaveRelationship() {
    if (leaveBusy) return;
    setLeaveBusy(true);
    setError(null);
    try {
      applyUser(await api.removePartner());
      await refresh();
      setLeaveOpen(false);
      haptic(12);
    } catch (err) {
      setError((err as Error).message);
      setLeaveOpen(false);
    } finally {
      setLeaveBusy(false);
    }
  }

  async function saveName() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      applyUser(await api.updateProfile({ name: trimmed }));
      setSaved(true);
      haptic(10);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="notif-panel">
      <header className="app-header">
        <button
          className="header-icon-btn"
          onClick={onClose}
          aria-label="Back"
          title="Back"
        >
          <BackIcon />
        </button>
        <div className="search-pill">
          <span className="brand-gem" aria-hidden>
            💎
          </span>
          <span className="wordmark sm">Profile</span>
          <span className="search-meta">
            <Xp value={me.points} size={15} />
          </span>
        </div>
        <span className="header-icon-btn header-icon-spacer" aria-hidden />
      </header>

      <div className="notif-list">
        <div className="center pad">
          <Avatar
            name={me.name}
            color={me.color}
            src={me.avatarUrl}
            size={88}
          />
          <h2 style={{ margin: '12px 0 0', letterSpacing: '-0.5px' }}>
            {me.partnerName ? `${me.name} & ${me.partnerName}` : me.name}
          </h2>
          {me.coupleUsername && (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              @{me.coupleUsername}
            </p>
          )}
        </div>

        <p className="section-label">YOUR NAME</p>
        <div className="card">
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder="Your name"
              aria-label="Your name"
              autoComplete="name"
              maxLength={40}
            />
            {error && <p className="error">{error}</p>}
            <Button type="submit" block disabled={!dirty || saving}>
              {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save name'}
            </Button>
          </form>
        </div>

        <p className="section-label">ACCOUNT</p>
        <div className="card">
          <Row label="Email" value={me.email} />
          {me.inviteCode && <Row label="Household code" value={me.inviteCode} />}
          {me.partnerName ? (
            <>
              <Row label="Partner" value={me.partnerName} />
              <Button
                variant="ghost"
                block
                onClick={() => {
                  haptic(10);
                  setLeaveOpen(true);
                }}
              >
                Leave relationship
              </Button>
            </>
          ) : (
            <p className="muted">No partner linked yet.</p>
          )}
        </div>

        <p className="section-label">SETTINGS</p>
        <div className="card">
          <Button variant="danger" block onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>

      {leaveOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setLeaveOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title" id="leave-title">
              Leave this relationship?
            </h3>
            <p className="modal-sub" style={{ textAlign: 'left' }}>
              You’ll lose all {me.points} of your points. Tasks and prizes stay
              saved if you and {me.partnerName} link back up — not if you join
              someone else.
            </p>
            <div className="modal-actions">
              <Button
                variant="danger"
                block
                disabled={leaveBusy}
                onClick={() => void leaveRelationship()}
              >
                {leaveBusy ? 'Leaving…' : 'Leave and lose points'}
              </Button>
              <Button
                variant="ghost"
                block
                disabled={leaveBusy}
                onClick={() => setLeaveOpen(false)}
              >
                Stay
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="row center-y"
      style={{ justifyContent: 'space-between', gap: 12, padding: '6px 0' }}
    >
      <span className="muted">{label}</span>
      <strong style={{ textAlign: 'right', minWidth: 0 }}>{value}</strong>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
