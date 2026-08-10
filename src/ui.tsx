import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
  return (
    <span className={`pill pill-${kind}`}>
      {kind === 'earn' ? '+' : '−'}
      {value} pts
    </span>
  );
}

