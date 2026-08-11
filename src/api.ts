import type {
  EarnTask,
  FeedComment,
  FeedEventView,
  FeedReaction,
  NotificationItem,
  Prize,
  PublicUser,
  Redemption,
  Submission,
  Suggestion,
} from '../shared/types.ts';

const TOKEN_KEY = 'bp_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export const api = {
  personas: () => request<PublicUser[]>('/personas'),
  enterAs: (userId: string) =>
    request<AuthResult>('/auth/device', {
      method: 'POST',
      body: { userId },
    }),
  neonSession: (idToken: string) =>
    request<AuthResult>('/auth/neon', {
      method: 'POST',
      body: { idToken },
    }),
  appleSession: (idToken: string, name?: string) =>
    request<AuthResult>('/auth/apple', {
      method: 'POST',
      body: { idToken, name },
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<PublicUser>('/me'),

  suggestions: () =>
    request<{ prizes: Suggestion[]; tasks: Suggestion[] }>('/suggestions'),

  inviteBoyfriend: (name: string, email: string, password: string) =>
    request<{
      boyfriend: PublicUser;
      partner: PublicUser;
      loginHint: { email: string; password: string };
    }>('/onboarding/boyfriend', {
      method: 'POST',
      body: { name, email, password },
    }),
  removePartner: () =>
    request<PublicUser>('/partner', { method: 'DELETE' }),
  addFriend: (name: string, email: string) =>
    request<PublicUser>('/friends', {
      method: 'POST',
      body: { name, email },
    }),
  friends: () => request<PublicUser[]>('/friends'),
  completeOnboarding: () =>
    request<PublicUser>('/onboarding/complete', { method: 'POST' }),

  prizes: () => request<Prize[]>('/prizes'),
  addPrize: (title: string, cost: number, emoji?: string) =>
    request<Prize>('/prizes', { method: 'POST', body: { title, cost, emoji } }),
  removePrize: (id: string) =>
    request<void>(`/prizes/${id}`, { method: 'DELETE' }),

  tasks: () => request<EarnTask[]>('/tasks'),
  addTask: (title: string, points: number, emoji?: string) =>
    request<EarnTask>('/tasks', {
      method: 'POST',
      body: { title, points, emoji },
    }),
  removeTask: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  submissions: () => request<Submission[]>('/submissions'),
  submit: (
    title: string,
    points: number,
    emoji?: string,
    note?: string,
    images?: string[],
  ) =>
    request<Submission>('/submissions', {
      method: 'POST',
      body: { title, points, emoji, note, images },
    }),
  approve: (id: string, points?: number) =>
    request<{ submission: Submission }>(`/submissions/${id}/approve`, {
      method: 'POST',
      body: points === undefined ? {} : { points },
    }),
  deny: (id: string) =>
    request<Submission>(`/submissions/${id}/deny`, { method: 'POST' }),
  shareSubmission: (id: string) =>
    request<Submission>(`/submissions/${id}/share`, { method: 'POST' }),

  redemptions: () => request<Redemption[]>('/redemptions'),
  redeem: (prizeId: string) =>
    request<{ redemption: Redemption }>('/redemptions', {
      method: 'POST',
      body: { prizeId },
    }),
  shareRedemption: (id: string) =>
    request<{ redemption: Redemption }>(`/redemptions/${id}/share`, {
      method: 'POST',
    }),
  fulfill: (id: string) =>
    request<Redemption>(`/redemptions/${id}/fulfill`, { method: 'POST' }),

  feed: () => request<FeedEventView[]>('/feed'),
  notifications: () => request<NotificationItem[]>('/notifications'),
  like: (id: string) =>
    request<{ id: string; likes: number; likedByMe: boolean }>(
      `/feed/${id}/like`,
      { method: 'POST' },
    ),
  react: (id: string, emoji: string) =>
    request<{ id: string; reactions: FeedReaction[] }>(`/feed/${id}/react`, {
      method: 'POST',
      body: { emoji },
    }),
  comment: (id: string, text: string) =>
    request<{ id: string; comments: FeedComment[] }>(`/feed/${id}/comment`, {
      method: 'POST',
      body: { text },
    }),
};
