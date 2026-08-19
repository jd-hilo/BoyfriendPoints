import type {
  EarnTask,
  CoupleSearchResult,
  FeedComment,
  FeedEventView,
  FeedReaction,
  FriendRequestView,
  NotificationItem,
  Prize,
  PublicUser,
  Redemption,
  Submission,
  Suggestion,
} from './types';
import Constants from 'expo-constants';
import { getToken } from './storage';
import { captureAppException, posthogHeaders } from './analytics';

const LOCAL_API = 'https://api-production-bae8.up.railway.app/api';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim() ||
  LOCAL_API;

export class ApiError extends Error {
  status?: number;
  unreachable?: boolean;
  constructor(
    message: string,
    opts?: { status?: number; unreachable?: boolean },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.unreachable = opts?.unreachable;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...posthogHeaders() };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  let res: Response | undefined;
  const retryAuth = Boolean(token) && !path.startsWith('/auth/');
  const delays = retryAuth ? [0, 600, 1_400] : [0];

  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
      });
    } catch (err) {
      if (delay !== delays.at(-1)) continue;
      captureAppException(err, { path, kind: 'network' });
      throw new ApiError(
        `Could not reach API at ${API_BASE_URL}.`,
        { unreachable: true },
      );
    }
    if (res.status !== 401 || delay === delays.at(-1)) break;
  }

  if (!res) {
    throw new ApiError(`Could not reach API at ${API_BASE_URL}.`, {
      unreachable: true,
    });
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const error = new ApiError(data.error ?? `Request failed (${res.status})`, {
      status: res.status,
    });
    if (res.status >= 500) {
      captureAppException(error, { path, status: res.status });
    }
    throw error;
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
  emailAvailable: (email: string) =>
    request<{ available: boolean }>(
      `/auth/email-available?email=${encodeURIComponent(email.trim())}`,
    ),
  coupleUsernameAvailable: (username: string) =>
    request<{ available: boolean }>(
      `/auth/couple-username-available?username=${encodeURIComponent(username.trim())}`,
    ),
  signup: (
    name: string,
    email: string,
    password: string,
    role: 'wife' | 'boyfriend' = 'wife',
    coupleUsername?: string,
  ) =>
    request<AuthResult>('/auth/signup', {
      method: 'POST',
      body: { name, email, password, role, coupleUsername },
    }),
  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  appleSession: (idToken: string, name?: string) =>
    request<AuthResult>('/auth/apple', {
      method: 'POST',
      body: { idToken, name },
    }),
  forgotPassword: (email: string) =>
    request<{ ok: true }>('/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim() },
    }),
  resetPassword: (email: string, otp: string, password: string) =>
    request<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      body: { email: email.trim(), otp: otp.trim(), password },
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<PublicUser>('/me'),
  updateProfile: (input: { name?: string; avatarUrl?: string }) =>
    request<PublicUser>('/me', {
      method: 'PATCH',
      body: input,
    }),
  setRole: (role: 'wife' | 'boyfriend') =>
    request<PublicUser>('/me', {
      method: 'PATCH',
      body: { role },
    }),
  setPushToken: (token: string) =>
    request<void>('/me/push-token', {
      method: 'POST',
      body: { token },
    }),
  uploadMedia: (contentType: string, data: string) =>
    request<{ id: string; url: string }>('/media', {
      method: 'POST',
      body: { contentType, data },
    }),

  suggestions: () =>
    request<{ prizes: Suggestion[]; tasks: Suggestion[] }>('/suggestions'),

  joinWithCode: (code: string) =>
    request<{ user: PublicUser; partner: PublicUser }>('/onboarding/join', {
      method: 'POST',
      body: { code },
    }),
  inviteBoyfriend: (name: string, email: string, password: string) =>
    request<{
      boyfriend: PublicUser;
      partner: PublicUser;
      loginHint: { email: string; password: string };
    }>('/onboarding/boyfriend', {
      method: 'POST',
      body: { name, email, password },
    }),
  removePartner: () => request<PublicUser>('/partner', { method: 'DELETE' }),
  addFriend: (name: string, email: string) =>
    request<PublicUser>('/friends', {
      method: 'POST',
      body: { name, email },
    }),
  friends: () => request<PublicUser[]>('/friends'),
  searchCouples: (query: string) =>
    request<CoupleSearchResult[]>(
      `/couples/search?q=${encodeURIComponent(query.trim())}`,
    ),
  friendRequests: () => request<FriendRequestView[]>('/friend-requests'),
  requestFriend: (code: string) =>
    request<FriendRequestView>('/friend-requests', {
      method: 'POST',
      body: { code },
    }),
  acceptFriendRequest: (id: string) =>
    request<FriendRequestView>(`/friend-requests/${id}/accept`, {
      method: 'POST',
    }),
  declineFriendRequest: (id: string) =>
    request<FriendRequestView>(`/friend-requests/${id}/decline`, {
      method: 'POST',
    }),
  completeOnboarding: () =>
    request<PublicUser>('/onboarding/complete', { method: 'POST' }),

  prizes: () => request<Prize[]>('/prizes'),
  addPrize: (title: string, cost: number, emoji?: string) =>
    request<Prize>('/prizes', { method: 'POST', body: { title, cost, emoji } }),
  removePrize: (id: string) => request<void>(`/prizes/${id}`, { method: 'DELETE' }),

  tasks: () => request<EarnTask[]>('/tasks'),
  addTask: (title: string, points: number, emoji?: string) =>
    request<EarnTask>('/tasks', {
      method: 'POST',
      body: { title, points, emoji },
    }),
  removeTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),

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
