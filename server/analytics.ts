import { PostHog } from 'posthog-node';

export type AnalyticsEnv = {
  POSTHOG_PROJECT_TOKEN?: string;
  POSTHOG_HOST?: string;
  VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?: string;
  VITE_PUBLIC_POSTHOG_HOST?: string;
};

type HeaderGetter = (name: string) => string | undefined;

let cached: { token: string; client: PostHog } | null = null;

export function posthogClient(env: AnalyticsEnv): PostHog | null {
  if (typeof process !== 'undefined' && process.env.VITEST) return null;
  const token =
    env.POSTHOG_PROJECT_TOKEN?.trim() ||
    env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!token) return null;
  const host =
    env.POSTHOG_HOST?.trim() ||
    env.VITE_PUBLIC_POSTHOG_HOST?.trim() ||
    'https://us.i.posthog.com';
  if (cached?.token === token) return cached.client;
  cached = {
    token,
    client: new PostHog(token, { host, enableExceptionAutocapture: false }),
  };
  return cached.client;
}

export function captureEvent(
  env: AnalyticsEnv,
  getHeader: HeaderGetter,
  userId: string | undefined,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const client = posthogClient(env);
  if (!client) return;
  const distinctId = getHeader('x-posthog-distinct-id')?.trim() || userId;
  if (!distinctId) return;
  const sessionId = getHeader('x-posthog-session-id')?.trim();
  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      ...(sessionId ? { $session_id: sessionId } : {}),
    },
  });
}

export function captureException(
  env: AnalyticsEnv,
  error: unknown,
  distinctId?: string,
  properties?: Record<string, unknown>,
): void {
  posthogClient(env)?.captureException(
    error,
    distinctId ?? 'anonymous',
    properties,
  );
}

export async function flushAnalytics(env: AnalyticsEnv): Promise<void> {
  await posthogClient(env)?.flush();
}
