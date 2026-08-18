import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
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

function latestEmoji(next: string, fallback: string): string {
  const cleaned = next.replace(/[0-9A-Za-z\s]/g, '');
  if (!cleaned) return fallback;
  const parts = Array.from(cleaned);
  return parts[parts.length - 1] ?? fallback;
}

/** Opens the system emoji keyboard (Apple Character Viewer / iOS emoji panel). */
export function EmojiField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="emoji-field">
      <span className="emoji-field-glyph" aria-hidden>
        {value || '⭐'}
      </span>
      <input
        className="emoji-field-input"
        value=""
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Choose emoji"
        onChange={(e) => {
          onChange(latestEmoji(e.target.value, value));
          e.target.value = '';
        }}
      />
    </label>
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

