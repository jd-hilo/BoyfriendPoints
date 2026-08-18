/** Public install link included in every native share. */
export const APP_SHARE_URL = 'https://testflight.apple.com/join/aM6xgrsc';

/** Partner invite: what the app is + the household code to join. */
export function partnerWaitingShareMessage(
  sharerName: string,
  code?: string,
): string {
  const who = sharerName.trim() || 'Your partner';
  const how = code
    ? `Get the app and use code ${code} so we can link up.`
    : `Get the app so we can link up.`;
  return (
    `${who} is waiting to start LoveReceipts with you.\n\n` +
    `It's a couples app: reward each other for helping out, then cash it in for date night.\n\n` +
    `${how}\n\n` +
    APP_SHARE_URL
  );
}

export async function sharePartnerInvite(
  sharerName: string,
  code?: string,
): Promise<void> {
  const text = partnerWaitingShareMessage(sharerName, code);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    if (code) await navigator.clipboard.writeText(code);
  } catch {
    /* user cancelled share */
  }
}

export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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
