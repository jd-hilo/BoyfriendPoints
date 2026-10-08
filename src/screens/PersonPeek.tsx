import { useEffect, useMemo, useState } from 'react';
import type { FeedEventView, PersonPeek } from '../../shared/types.ts';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { Avatar, Button, Xp } from '../ui.tsx';
import { haptic, timeAgo } from '../utils.ts';

export type PersonPreview = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  partnerId?: string;
  partnerName?: string;
  partnerColor?: string;
  partnerAvatar?: string;
};

export function activityFromFeed(
  events: FeedEventView[],
  personId: string,
): PersonPeek['activity'] {
  return events
    .filter((e) => e.boyfriendId === personId || e.wifeId === personId)
    .slice(0, 12)
    .map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      emoji: e.emoji,
      points: e.points,
      createdAt: e.createdAt,
      withId: e.boyfriendId === personId ? e.wifeId : e.boyfriendId,
      withName: e.boyfriendId === personId ? e.wifeName : e.boyfriendName,
      image: e.images?.[0],
    }));
}

export default function PersonPeekSheet({
  preview,
  events = [],
  onClose,
  onOpenPerson,
}: {
  preview: PersonPreview;
  events?: FeedEventView[];
  onClose: () => void;
  onOpenPerson: (next: PersonPreview) => void;
}) {
  const { user } = useAuth();
  const [peek, setPeek] = useState<PersonPeek | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .person(preview.id)
      .then((data) => {
        if (!cancelled) setPeek(data);
      })
      .catch(() => {
        if (!cancelled) setPeek(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview.id]);

  const name = peek?.name ?? preview.name;
  const color = peek?.color ?? preview.color;
  const avatar = peek?.avatarUrl ?? preview.avatarUrl;
  const partnerName = peek?.partnerName ?? preview.partnerName;
  const partnerColor = peek?.partnerColor ?? preview.partnerColor ?? '#7C5CFF';
  const partnerAvatar = peek?.partnerAvatar ?? preview.partnerAvatar;
  const partnerId = peek?.partnerId ?? preview.partnerId;
  const coupleUsername = peek?.coupleUsername;
  const mine = user?.id === preview.id;
  const isPartner = Boolean(user?.partnerId && user.partnerId === preview.id);
  const blocked = Boolean(peek?.blockedByMe);
  const activity = useMemo(() => {
    if (peek?.activity?.length) return peek.activity;
    return activityFromFeed(events, preview.id);
  }, [peek, events, preview.id]);

  function openPartner() {
    if (!partnerId || !partnerName) return;
    haptic(10);
    onOpenPerson({
      id: partnerId,
      name: partnerName,
      color: partnerColor,
      avatarUrl: partnerAvatar,
      partnerId: preview.id,
      partnerName: name,
      partnerColor: color,
      partnerAvatar: avatar,
    });
  }

  return (
    <div className="sheet-backdrop peek-backdrop" onClick={onClose}>
      <div className="sheet peek-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button
          type="button"
          className="sheet-close peek-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="peek-hero">
          <div className="peek-photo">
            <Avatar name={name} color={color} src={avatar} size={88} />
          </div>
          <h2 className="peek-name">{name}</h2>
          {mine ? <p className="peek-you">That&apos;s you</p> : null}
          {partnerName ? (
            <button
              type="button"
              className="peek-dating"
              onClick={openPartner}
            >
              <Avatar
                name={partnerName}
                color={partnerColor}
                src={partnerAvatar}
                size={22}
              />
              <span>
                Dating <strong>{partnerName}</strong>
              </span>
              <span className="peek-dating-heart" aria-hidden>
                ♥
              </span>
            </button>
          ) : null}
          {coupleUsername ? (
            <p className="peek-handle">@{coupleUsername}</p>
          ) : null}
          {!mine ? (
            <div className="peek-safety">
              <Button
                variant="secondary"
                onClick={() => {
                  const reason = window.prompt(
                    'Why are you reporting them? Harassment, Spam, Inappropriate, or Other',
                    'Harassment',
                  );
                  if (!reason) return;
                  void api.report('user', preview.id, reason).catch((err) => {
                    window.alert((err as Error).message);
                  });
                }}
              >
                Report
              </Button>
              {!isPartner ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const next = blocked ? 'Unblock' : 'Block';
                    if (!window.confirm(`${next} ${name}?`)) return;
                    const action = blocked
                      ? api.unblockUser(preview.id)
                      : api.blockUser(preview.id);
                    void action
                      .then(() => {
                        setPeek((current) =>
                          current ? { ...current, blockedByMe: !blocked } : current,
                        );
                      })
                      .catch((err) => window.alert((err as Error).message));
                  }}
                >
                  {blocked ? 'Unblock' : 'Block'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="peek-body">
          <p className="peek-label">Lately</p>
          {loading && activity.length === 0 ? (
            <div className="peek-skel" aria-hidden>
              <div className="peek-skel-row" />
              <div className="peek-skel-row" />
              <div className="peek-skel-row" />
            </div>
          ) : activity.length === 0 ? (
            <p className="peek-empty">No love receipts on the feed yet.</p>
          ) : (
            <ul className="peek-activity">
              {activity.map((row) => (
                <li key={row.id} className="peek-row">
                  {row.image ? (
                    <img className="peek-thumb" src={row.image} alt="" />
                  ) : (
                    <span className="peek-emoji">{row.emoji}</span>
                  )}
                  <div className="peek-row-copy">
                    <p className="peek-row-title">
                      {row.emoji} {row.title}
                    </p>
                    <p className="peek-row-meta">
                      {row.type === 'earn' ? 'from' : 'with'} {row.withName}
                      {' · '}
                      {timeAgo(row.createdAt)} ago
                    </p>
                  </div>
                  <Xp
                    value={row.points}
                    sign={row.type === 'earn' ? '+' : '−'}
                    size={12}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
