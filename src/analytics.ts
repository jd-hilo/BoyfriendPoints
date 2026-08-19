import posthog from 'posthog-js';
import type { PublicUser } from '../shared/types.ts';

export function identifyPerson(user: PublicUser): void {
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    role: user.role,
    onboarded: user.onboarded,
    demo: Boolean(user.demo),
    has_partner: Boolean(user.partnerId),
  });
}

export function resetPerson(): void {
  posthog.capture('user_logged_out');
  posthog.reset();
}

export function posthogHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const distinctId = posthog.get_distinct_id();
    const sessionId = posthog.get_session_id();
    if (distinctId) headers['X-POSTHOG-DISTINCT-ID'] = distinctId;
    if (sessionId) headers['X-POSTHOG-SESSION-ID'] = sessionId;
  } catch {
    /* SDK not initialized (tests) */
  }
  return headers;
}

export function captureAppException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  try {
    posthog.captureException(error, extra);
  } catch {
    /* ignore */
  }
}
