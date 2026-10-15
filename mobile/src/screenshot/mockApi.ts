import type {
  CoupleSearchResult,
  EarnTask,
  FeedComment,
  FeedEventView,
  FeedReaction,
  FriendRequestView,
  NotificationItem,
  PersonPeek,
  Prize,
  PublicUser,
  Redemption,
  Submission,
} from '../types';

interface AuthResult {
  token: string;
  user: PublicUser;
}
import { parseScreenshotRoute } from './route';
import {
  createScreenshotState,
  feedViews,
  notificationsFor,
  PRIZE_SUGGESTIONS,
  publicUser,
  TASK_SUGGESTIONS,
  userByPersona,
  type ScreenshotState,
} from './seed';

const TOKEN = 'screenshot';

let state: ScreenshotState = createScreenshotState();

function viewer(): PublicUser {
  const { persona } = parseScreenshotRoute();
  const user = userByPersona(state, persona);
  if (!user) {
    throw Object.assign(new Error('Not signed in'), { status: 401 });
  }
  return publicUser(state, user);
}

function rawViewer() {
  const { persona } = parseScreenshotRoute();
  const user = userByPersona(state, persona);
  if (!user) {
    throw Object.assign(new Error('Not signed in'), { status: 401 });
  }
  return user;
}

function okUser(): AuthResult {
  return { token: TOKEN, user: viewer() };
}

/** Reset in-memory seed (full page loads also start fresh). */
export function resetScreenshotState(): void {
  state = createScreenshotState();
}

export function screenshotToken(): string | null {
  const { persona } = parseScreenshotRoute();
  return persona ? TOKEN : null;
}

export function screenshotCachedUser(): PublicUser | null {
  const { persona } = parseScreenshotRoute();
  const user = userByPersona(state, persona);
  return user ? publicUser(state, user) : null;
}

export const screenshotApi = {
  personas: async () =>
    state.users
      .filter((u) => u.name === 'Emma' || u.name === 'Noah' || u.demo)
      .map((u) => publicUser(state, u)),
  enterAs: async (_userId: string) => okUser(),
  emailAvailable: async () => ({ available: true }),
  coupleUsernameAvailable: async () => ({ available: true }),
  signup: async () => okUser(),
  login: async () => okUser(),
  appleSession: async () => okUser(),
  forgotPassword: async () => ({ ok: true as const }),
  resetPassword: async () => ({ ok: true as const }),
  logout: async () => undefined,
  me: async () => viewer(),
  updateProfile: async (input: { name?: string; avatarUrl?: string }) => {
    const user = rawViewer();
    if (input.name) user.name = input.name;
    if (input.avatarUrl) user.avatarUrl = input.avatarUrl;
    return publicUser(state, user);
  },
  setRole: async (role: 'wife' | 'boyfriend') => {
    const user = rawViewer();
    user.role = role;
    return publicUser(state, user);
  },
  setPushToken: async () => undefined,
  uploadMedia: async () => ({ id: 'media_shot', url: '' }),

  suggestions: async () => ({
    prizes: PRIZE_SUGGESTIONS,
    tasks: TASK_SUGGESTIONS,
  }),

  joinWithCode: async () => {
    const user = viewer();
    const emma = state.users.find((u) => u.name === 'Emma')!;
    const noah = state.users.find((u) => u.name === 'Noah')!;
    return { user, partner: publicUser(state, user.id === emma.id ? noah : emma) };
  },
  inviteBoyfriend: async () => {
    const user = viewer();
    const noah = state.users.find((u) => u.name === 'Noah')!;
    return {
      boyfriend: publicUser(state, noah),
      partner: user,
      loginHint: { email: noah.email, password: 'points' },
    };
  },
  removePartner: async () => viewer(),
  addFriend: async () => viewer(),
  friends: async () => {
    const user = rawViewer();
    const anchor =
      state.users.find((u) => u.id === (user.inviteCode ? user.id : user.partnerId)) ??
      user;
    return anchor.friendIds
      .map((id) => state.users.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => publicUser(state, u));
  },
  searchCouples: async (_query: string): Promise<CoupleSearchResult[]> => [],
  friendRequests: async (): Promise<FriendRequestView[]> => [],
  requestFriend: async () => {
    throw new Error('Not available in screenshot mode');
  },
  acceptFriendRequest: async () => {
    throw new Error('Not available in screenshot mode');
  },
  declineFriendRequest: async () => {
    throw new Error('Not available in screenshot mode');
  },
  completeOnboarding: async () => viewer(),

  prizes: async (): Promise<Prize[]> => {
    const user = rawViewer();
    return state.prizes.filter(
      (p) => p.wifeId === user.id || p.wifeId === user.partnerId,
    );
  },
  addPrize: async (title: string, cost: number, emoji?: string) => {
    const user = rawViewer();
    const prize: Prize = {
      id: `p_${state.prizes.length + 1}`,
      wifeId: user.id,
      title,
      emoji: emoji ?? '🎁',
      cost,
      createdAt: new Date().toISOString(),
    };
    state.prizes.push(prize);
    return prize;
  },
  removePrize: async (id: string) => {
    state.prizes = state.prizes.filter((p) => p.id !== id);
  },

  tasks: async (): Promise<EarnTask[]> => {
    const user = rawViewer();
    return state.tasks.filter(
      (t) => t.wifeId === user.id || t.wifeId === user.partnerId,
    );
  },
  addTask: async (title: string, points: number, emoji?: string) => {
    const user = rawViewer();
    const task: EarnTask = {
      id: `t_${state.tasks.length + 1}`,
      wifeId: user.id,
      title,
      emoji: emoji ?? '⭐',
      points,
      createdAt: new Date().toISOString(),
    };
    state.tasks.push(task);
    return task;
  },
  removeTask: async (id: string) => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
  },

  submissions: async (): Promise<Submission[]> => {
    const user = rawViewer();
    if (user.role === 'wife') {
      return state.submissions.filter(
        (s) => s.wifeId === user.id && s.status === 'pending',
      );
    }
    return state.submissions.filter((s) => s.boyfriendId === user.id);
  },
  submit: async (
    title: string,
    points: number,
    emoji?: string,
    note?: string,
    images?: string[],
  ) => {
    const user = rawViewer();
    const submission: Submission = {
      id: `s_${state.submissions.length + 1}`,
      boyfriendId: user.id,
      wifeId: user.partnerId ?? user.id,
      title,
      emoji: emoji ?? '⭐',
      points,
      requestedPoints: points,
      note: note ?? '',
      images: images ?? [],
      status: 'pending',
      revised: false,
      shared: false,
      createdAt: new Date().toISOString(),
    };
    state.submissions.push(submission);
    return submission;
  },
  grant: async (title: string, points: number, emoji?: string, note?: string) => {
    const submission = await screenshotApi.submit(title, points, emoji, note);
    submission.granted = true;
    submission.status = 'approved';
    return { submission };
  },
  approve: async (id: string, points?: number) => {
    const submission = state.submissions.find((s) => s.id === id);
    if (!submission) throw new Error('Not found');
    submission.status = 'approved';
    if (points !== undefined) {
      submission.points = points;
      submission.revised = points !== submission.requestedPoints;
    }
    submission.resolvedAt = new Date().toISOString();
    return { submission };
  },
  deny: async (id: string) => {
    const submission = state.submissions.find((s) => s.id === id);
    if (!submission) throw new Error('Not found');
    submission.status = 'denied';
    submission.resolvedAt = new Date().toISOString();
    return submission;
  },
  shareSubmission: async (id: string) => {
    const submission = state.submissions.find((s) => s.id === id);
    if (!submission) throw new Error('Not found');
    submission.shared = true;
    return submission;
  },

  redemptions: async (): Promise<Redemption[]> => {
    const user = rawViewer();
    return state.redemptions.filter(
      (r) => r.boyfriendId === user.id || r.wifeId === user.id,
    );
  },
  redeem: async (prizeId: string) => {
    const user = rawViewer();
    const prize = state.prizes.find((p) => p.id === prizeId);
    if (!prize) throw new Error('Prize not found');
    const redemption: Redemption = {
      id: `r_${state.redemptions.length + 1}`,
      boyfriendId: user.id,
      wifeId: prize.wifeId,
      prizeTitle: prize.title,
      emoji: prize.emoji,
      cost: prize.cost,
      status: 'pending',
      shared: false,
      createdAt: new Date().toISOString(),
    };
    state.redemptions.push(redemption);
    return { redemption };
  },
  shareRedemption: async (id: string) => {
    const redemption = state.redemptions.find((r) => r.id === id);
    if (!redemption) throw new Error('Not found');
    redemption.shared = true;
    return { redemption };
  },
  fulfill: async (id: string) => {
    const redemption = state.redemptions.find((r) => r.id === id);
    if (!redemption) throw new Error('Not found');
    redemption.status = 'fulfilled';
    redemption.resolvedAt = new Date().toISOString();
    return redemption;
  },

  feed: async (): Promise<FeedEventView[]> => feedViews(state, rawViewer()),
  person: async (id: string): Promise<PersonPeek> => {
    const viewerUser = rawViewer();
    const person = state.users.find((u) => u.id === id);
    if (!person) throw new Error('Person not found');
    const partner = person.partnerId
      ? state.users.find((u) => u.id === person.partnerId)
      : undefined;
    const activity = feedViews(state, viewerUser)
      .filter((e) => e.boyfriendId === person.id || e.wifeId === person.id)
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        emoji: e.emoji,
        points: e.points,
        createdAt: e.createdAt,
        withId: e.boyfriendId === person.id ? e.wifeId : e.boyfriendId,
        withName: e.boyfriendId === person.id ? e.wifeName : e.boyfriendName,
        image: e.images?.[0],
      }));
    return {
      id: person.id,
      name: person.name,
      color: person.color,
      avatarUrl: person.avatarUrl,
      partnerId: partner?.id,
      partnerName: partner?.name,
      partnerColor: partner?.color,
      partnerAvatar: partner?.avatarUrl,
      coupleUsername: person.coupleUsername,
      activity,
    };
  },
  notifications: async (): Promise<NotificationItem[]> =>
    notificationsFor(state, rawViewer()),
  deleteAccount: async () => ({ ok: true as const }),
  blocks: async (): Promise<PublicUser[]> => [],
  blockUser: async () => ({ blocked: true }),
  unblockUser: async () => ({ blocked: false }),
  report: async () => ({ ok: true as const }),
  like: async (id: string) => {
    const event = state.feed.find((e) => e.id === id);
    if (!event) throw new Error('Post not found');
    const user = rawViewer();
    const idx = event.likes.indexOf(user.id);
    if (idx >= 0) event.likes.splice(idx, 1);
    else event.likes.push(user.id);
    return {
      id,
      likes: event.likes.length,
      likedByMe: event.likes.includes(user.id),
    };
  },
  react: async (id: string, emoji: string) => {
    const event = state.feed.find((e) => e.id === id);
    if (!event) throw new Error('Post not found');
    const user = rawViewer();
    const idx = event.reactions.findIndex(
      (r) => r.userId === user.id && r.emoji === emoji,
    );
    if (idx >= 0) event.reactions.splice(idx, 1);
    else event.reactions.push({ emoji, userId: user.id });
    return { id, reactions: event.reactions as FeedReaction[] };
  },
  comment: async (id: string, text: string, replyToId?: string) => {
    const event = state.feed.find((e) => e.id === id);
    if (!event) throw new Error('Post not found');
    const user = rawViewer();
    const comment: FeedComment = {
      id: `c_${event.comments.length + 1}`,
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      text,
      createdAt: new Date().toISOString(),
      replyToId,
    };
    event.comments.push(comment);
    return { id, comments: event.comments };
  },
};
