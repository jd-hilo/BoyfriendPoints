import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EMOJI_CATEGORIES } from './emojiCatalog.ts';
import {
  shareReceiptImage,
  type ReceiptData,
  type ReceiptKind,
} from './receipt.ts';

export function XpIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      className="xp-icon"
      role="img"
      aria-label="gems"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      💎
    </span>
  );
}

/** Points value in the shared blue gradient XP banner. */
export function Xp({
  value,
  size = 13,
  sign,
  large,
}: {
  value: number;
  size?: number;
  sign?: '+' | '-' | '−' | '';
  large?: boolean;
}) {
  return (
    <span className={`xp${large ? ' xp-lg' : ''}`}>
      <XpIcon size={large ? Math.max(size, 18) : size} />
      <span className="xp-value">
        {sign ?? ''}
        {value}
      </span>
    </span>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="device-bg">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">{children}</div>
      </div>
    </div>
  );
}

export function Avatar({
  name,
  color,
  src,
  size = 44,
}: {
  name: string;
  color: string;
  src?: string;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if (src) {
    return (
      <img
        key={src}
        className="avatar avatar-img"
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ background: color, width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="avatar"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Two overlapping avatars — the couple lockup used on profile. */
export function CoupleLockup({
  leftName,
  leftColor,
  leftSrc,
  rightName,
  rightColor,
  rightSrc,
  size = 56,
}: {
  leftName: string;
  leftColor: string;
  leftSrc?: string;
  rightName?: string;
  rightColor?: string;
  rightSrc?: string;
  size?: number;
}) {
  const overlap = Math.round(size * 0.38);
  return (
    <div className="couple-lockup">
      <div className="couple-lockup-left">
        <Avatar name={leftName} color={leftColor} src={leftSrc} size={size} />
      </div>
      {rightName ? (
        <div
          className="couple-lockup-right"
          style={{ marginLeft: -overlap }}
        >
          <Avatar
            name={rightName}
            color={rightColor ?? '#008CFF'}
            src={rightSrc}
            size={size}
          />
        </div>
      ) : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
};

export function Button({
  variant = 'primary',
  block,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${className}`}
      {...rest}
    />
  );
}

export function PointsPill({
  value,
  kind,
}: {
  value: number;
  kind: 'earn' | 'redeem';
}) {
  return <Xp value={value} sign={kind === 'earn' ? '+' : '−'} />;
}

/** Household-task picker — same tap pattern as feed reactions. */
export const TASK_EMOJIS = [
  '🍽️',
  '🍳',
  '🧺',
  '🗑️',
  '🌱',
  '🛒',
  '🚗',
  '🐕',
  '🌹',
  '🧹',
] as const;

export function TaskEmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return <EmojiField value={value} onChange={onChange} />;
}

/** Apple-style emoji sheet — categories, search, not the ABC keyboard. */
export function EmojiField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0].id);

  const category =
    EMOJI_CATEGORIES.find((item) => item.id === categoryId) ?? EMOJI_CATEGORIES[0];
  const q = query.trim().toLowerCase();
  const shown = q
    ? EMOJI_CATEGORIES.flatMap((item) => item.emojis).filter((emoji) =>
        emoji.includes(q),
      )
    : category.emojis;

  const host =
    typeof document !== 'undefined'
      ? document.querySelector('.phone-screen') ?? document.body
      : null;

  const sheet = open ? (
    <div
      className="emoji-sheet-backdrop"
      role="presentation"
      onClick={() => {
        setOpen(false);
        setQuery('');
      }}
    >
      <div
        className="emoji-sheet"
        role="dialog"
        aria-label="Choose emoji"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="emoji-sheet-handle" />
        <div className="emoji-sheet-search-wrap">
          {query ? null : (
            <span className="emoji-sheet-search-placeholder" aria-hidden>
              <svg
                className="emoji-sheet-search-icon"
                viewBox="0 0 16 16"
                width="15"
                height="15"
              >
                <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 10l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Search Emoji
            </span>
          )}
          <input
            className="emoji-sheet-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder=""
            aria-label="Search emoji"
          />
        </div>
        <p className="emoji-sheet-label">
          {q ? 'Search' : category.label}
        </p>
        <div className="emoji-sheet-grid">
          {shown.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              className={`emoji-sheet-cell${value === emoji ? ' on' : ''}`}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
                setQuery('');
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="emoji-sheet-cats" role="tablist" aria-label="Emoji categories">
          {EMOJI_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === categoryId}
              className={`emoji-sheet-cat${item.id === categoryId ? ' on' : ''}`}
              onClick={() => {
                setCategoryId(item.id);
                setQuery('');
              }}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="emoji-field-wrap">
      <button
        type="button"
        className={`emoji-field${open ? ' open' : ''}`}
        aria-label="Choose emoji"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {value || '⭐'}
      </button>
      {sheet && host ? createPortal(sheet, host) : sheet}
    </div>
  );
}

/** Compact segmented pill: For you / For {partner}. */
export function WhoPill({
  value,
  themLabel,
  onChange,
}: {
  value: 'you' | 'them';
  themLabel: string;
  onChange: (next: 'you' | 'them') => void;
}) {
  return (
    <div className="who-pill" role="tablist" aria-label="Whose list">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'you'}
        className={`who-pill-seg${value === 'you' ? ' on' : ''}`}
        onClick={() => {
          if (value !== 'you') onChange('you');
        }}
      >
        For you
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'them'}
        className={`who-pill-seg${value === 'them' ? ' on' : ''}`}
        onClick={() => {
          if (value !== 'them') onChange('them');
        }}
      >
        {themLabel}
      </button>
    </div>
  );
}

const RECEIPT_HEADLINE: Record<ReceiptKind, string> = {
  request: 'Request sent',
  earn: 'Points earned',
  redeem: 'Prize redeemed',
  fulfill: 'Prize given',
  approve: 'You approved it',
  grant: 'Points sent',
};

/** Paper-receipt success sheet with native image share. */
export function ReceiptModal({
  kind,
  subtitle,
  emoji,
  itemTitle,
  meta,
  points,
  fromName,
  toName,
  note,
  shareLabel = 'Share receipt',
  skipLabel = 'Done',
  feedLabel = 'Post to feed',
  busy,
  onShare,
  onSkip,
}: {
  kind: ReceiptKind;
  subtitle: string;
  emoji: string;
  itemTitle: string;
  meta?: string;
  points: number;
  fromName: string;
  toName: string;
  note?: string;
  shareLabel?: string;
  skipLabel?: string;
  feedLabel?: string;
  busy?: boolean;
  /** Called when the feed checkbox is checked on complete. */
  onShare?: () => void | Promise<void>;
  onSkip: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [postToFeed, setPostToFeed] = useState(true);
  const canPostToFeed = Boolean(onShare);
  const sign = kind === 'redeem' || kind === 'fulfill' ? '−' : '+';
  const receipt: ReceiptData = {
    kind,
    emoji,
    title: itemTitle,
    points,
    fromName,
    toName,
    meta,
    note,
  };

  async function complete(withFeed: boolean) {
    if (withFeed && onShare) await onShare();
    else onSkip();
  }

  async function handleShare() {
    setSharing(true);
    try {
      await shareReceiptImage(receipt);
      await complete(canPostToFeed && postToFeed);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      await complete(canPostToFeed && postToFeed);
    } finally {
      setSharing(false);
    }
  }

  const locked = busy || sharing;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={RECEIPT_HEADLINE[kind]}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="receipt-kicker">{RECEIPT_HEADLINE[kind]}</p>
        <p className="modal-sub receipt-sub">{subtitle}</p>

        <div className="receipt-paper">
          <div className="receipt-brand">
            <span aria-hidden>💎</span> LoveReceipts
          </div>
          <div className="receipt-dash" />
          <div className="receipt-party">
            <span>FROM</span>
            <strong>{fromName}</strong>
          </div>
          <div className="receipt-party">
            <span>TO</span>
            <strong>{toName}</strong>
          </div>
          <div className="receipt-dash" />
          <div className="receipt-item">
            <span className="receipt-emoji">{emoji}</span>
            <span className="receipt-item-title">{itemTitle}</span>
            {meta && <span className="receipt-meta">{meta}</span>}
          </div>
          <div className="receipt-xp">
            <Xp value={points} sign={sign} size={14} />
          </div>
          <div className="receipt-dash" />
          <p className="receipt-thanks">Thank you for the love 💕</p>
          <div className="receipt-perforation" />
        </div>

        {note && <p className="modal-note">{note}</p>}

        {canPostToFeed && (
          <label className="receipt-feed-check">
            <input
              type="checkbox"
              checked={postToFeed}
              disabled={locked}
              onChange={(e) => setPostToFeed(e.target.checked)}
            />
            <span className="receipt-feed-box" aria-hidden>
              {postToFeed ? '✓' : ''}
            </span>
            <span>{feedLabel}</span>
          </label>
        )}

        <div className="modal-actions">
          <Button
            block
            className="receipt-share-btn"
            disabled={locked}
            onClick={() => void handleShare()}
          >
            {sharing ? 'Sharing…' : shareLabel}
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => void complete(canPostToFeed && postToFeed)}
            disabled={locked}
          >
            {skipLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

