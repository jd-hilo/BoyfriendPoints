import * as Haptics from 'expo-haptics';

/** Public install link included in every native share. */
export const APP_SHARE_URL = 'https://testflight.apple.com/join/aM6xgrsc';

/** Best-effort haptic feedback (no-op if unavailable). Accepts a duration or pattern like the web version, but only uses it to pick an impact style. */
export function haptic(pattern: number | number[] = 12): void {
  try {
    const total = Array.isArray(pattern)
      ? pattern.reduce((a, b) => a + b, 0)
      : pattern;
    const style =
      total > 30
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
    void Haptics.impactAsync(style);
  } catch {
    /* ignore */
  }
}

export function timeAgo(iso: string): string {
  const normalized = iso.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const then = Date.parse(normalized);
  const diff = Date.now() - (Number.isNaN(then) ? Date.now() : then);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  return `${weeks}w`;
}
