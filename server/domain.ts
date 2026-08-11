import type {
  EarnTask,
  FeedEvent,
  FeedEventView,
  NotificationItem,
  Prize,
  PublicUser,
  Redemption,
  Submission,
  Suggestion,
  User,
} from '../shared/types.ts';

export interface State {
  users: User[];
  prizes: Prize[];
  tasks: EarnTask[];
  submissions: Submission[];
  redemptions: Redemption[];
  feed: FeedEvent[];
}

export function createEmptyState(): State {
  return {
    users: [],
    prizes: [],
    tasks: [],
    submissions: [],
    redemptions: [],
    feed: [],
  };
}

const AVATAR_COLORS = [
  '#008CFF',
  '#0074DE',
  '#7C5CFF',
  '#F5A623',
  '#2EA84F',
  '#E0498A',
  '#00B8B8',
  '#FF6B6B',
];

export function id(prefix = ''): string {
  return (
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function token(): string {
  return id('tok_') + Math.random().toString(36).slice(2, 10);
}

function pickColor(state: State): string {
  return AVATAR_COLORS[state.users.length % AVATAR_COLORS.length];
}

/** Deterministic, playful profile image for a given seed (renders client-side). */
export function avatarFor(seed: string): string {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(
    seed,
  )}&backgroundType=gradientLinear&radius=50`;
}

/** Deterministic stock photo for attaching to posts (renders client-side). */
export function stockPhoto(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/720/480`;
}

export function publicUser(state: State, user: User): PublicUser {
  const partner = user.partnerId
    ? state.users.find((u) => u.id === user.partnerId)
    : undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    color: user.color,
    avatarUrl: user.avatarUrl ?? avatarFor(user.name),
    partnerId: user.partnerId,
    partnerName: partner?.name,
    partnerColor: partner?.color,
    partnerAvatar: partner
      ? (partner.avatarUrl ?? avatarFor(partner.name))
      : undefined,
    friendIds: user.friendIds,
    points: user.points,
    onboarded: user.onboarded,
    demo: user.demo,
  };
}

export const PRIZE_SUGGESTIONS: Suggestion[] = [
  { title: 'Movie night, my pick', emoji: '🍿', points: 100 },
  { title: 'Breakfast in bed', emoji: '🥞', points: 150 },
  { title: 'Get out of one chore', emoji: '🧹', points: 120 },
  { title: 'Full-body massage', emoji: '💆‍♀️', points: 300 },
  { title: 'Girls night, no questions', emoji: '💃', points: 250 },
  { title: 'Control the remote all weekend', emoji: '📺', points: 200 },
];

export const TASK_SUGGESTIONS: Suggestion[] = [
  { title: 'Mowed the lawn', emoji: '🌱', points: 50 },
  { title: 'Did the dishes', emoji: '🍽️', points: 30 },
  { title: 'Cooked dinner', emoji: '🍳', points: 60 },
  { title: 'Took out the trash', emoji: '🗑️', points: 20 },
  { title: 'Planned a date night', emoji: '🌹', points: 120 },
  { title: 'Folded the laundry', emoji: '🧺', points: 40 },
];

function requireUser(state: State, userId: string): User {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found');
  return user;
}

export function findByToken(state: State, tok?: string): User | undefined {
  if (!tok) return undefined;
  return state.users.find((u) => u.token === tok);
}

export function findByEmail(state: State, email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return state.users.find((u) => u.email.toLowerCase() === normalized);
}

export function signupWife(
  state: State,
  input: { name: string; email: string; password: string },
): User {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) throw new Error('Name is required');
  if (!email) throw new Error('Email is required');
  if (!input.password) throw new Error('Password is required');
  if (findByEmail(state, email)) throw new Error('That email is already taken');

  const wife: User = {
    id: id('u_'),
    name,
    email,
    password: input.password,
    role: 'wife',
    color: pickColor(state),
    friendIds: [],
    points: 0,
    token: token(),
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  state.users.push(wife);

  // Give her a starter table of earn tasks the boyfriend can pick from.
  for (const suggestion of TASK_SUGGESTIONS) {
    state.tasks.push({
      id: id('t_'),
      wifeId: wife.id,
      title: suggestion.title,
      emoji: suggestion.emoji,
      points: suggestion.points,
      createdAt: new Date().toISOString(),
    });
  }

  // Connect new sign-ups to the seeded demo community so the feed is alive.
  for (const demoWife of state.users.filter((u) => u.demo && u.role === 'wife')) {
    if (!wife.friendIds.includes(demoWife.id)) wife.friendIds.push(demoWife.id);
    if (!demoWife.friendIds.includes(wife.id)) demoWife.friendIds.push(wife.id);
  }
  return wife;
}

export function login(state: State, email: string, password: string): User {
  const user = findByEmail(state, email);
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }
  user.token = token();
  return user;
}

/** Link a verified identity (Neon Auth / Apple) to an app user. */
export function loginOrCreateFromIdentity(
  state: State,
  input: { email: string; name: string; provider: string },
): User {
  const email = input.email.trim();
  if (!email) throw new Error('Email is required');
  const existing = findByEmail(state, email);
  if (existing) {
    existing.token = token();
    if (input.name.trim() && existing.name !== input.name.trim()) {
      // Keep the household name they already chose; only fill blanks.
      if (!existing.name.trim()) existing.name = input.name.trim();
    }
    return existing;
  }
  return signupWife(state, {
    name: input.name.trim() || email.split('@')[0] || 'Partner',
    email,
    password: `oauth:${input.provider}:${token()}`,
  });
}

/** Device-based sign-in: enter as an existing persona, no password. */
export function deviceLogin(state: State, userId: string): User {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('Persona not found');
  user.token = token();
  return user;
}

/** Personas the device can tap to enter as, primary household first. */
export function listPersonas(state: State): PublicUser[] {
  return [...state.users]
    .sort((a, b) => {
      const rank = (u: User) => (u.demo ? 1 : 0);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map((u) => publicUser(state, u));
}

export function logout(user: User): void {
  user.token = undefined;
}

export function inviteBoyfriend(
  state: State,
  wife: User,
  input: { name: string; email: string; password?: string },
): User {
  if (wife.role !== 'wife') throw new Error('Only a partner manager can invite');
  if (wife.partnerId) throw new Error('You already have a partner linked');
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) throw new Error('Name is required');
  if (!email) throw new Error('Email is required');
  if (findByEmail(state, email)) throw new Error('That email is already taken');

  const boyfriend: User = {
    id: id('u_'),
    name,
    email,
    password: input.password?.trim() || 'points',
    role: 'boyfriend',
    color: pickColor(state),
    avatarUrl: avatarFor(name),
    partnerId: wife.id,
    friendIds: [],
    points: 0,
    onboarded: true,
    createdAt: new Date().toISOString(),
  };
  state.users.push(boyfriend);
  wife.partnerId = boyfriend.id;
  return boyfriend;
}

/** Unlink the current partner from both sides. */
export function removePartner(state: State, wife: User): void {
  if (wife.role !== 'wife') throw new Error('Only a partner manager can remove');
  if (!wife.partnerId) throw new Error('No partner to remove');
  const partner = state.users.find((u) => u.id === wife.partnerId);
  if (partner?.partnerId === wife.id) {
    partner.partnerId = undefined;
    partner.token = undefined;
  }
  wife.partnerId = undefined;
}

export function listFriends(state: State, wife: User): PublicUser[] {
  return wife.friendIds
    .map((id) => state.users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u))
    .map((u) => publicUser(state, u));
}

export function addFriend(
  state: State,
  wife: User,
  input: { name: string; email: string },
): User {
  if (wife.role !== 'wife') throw new Error('Only a wife can add friends');
  const email = input.email.trim();
  if (!email) throw new Error('Email is required');

  let friend = findByEmail(state, email);
  if (!friend) {
    friend = {
      id: id('u_'),
      name: input.name.trim() || email.split('@')[0],
      email,
      password: 'points',
      role: 'wife',
      color: pickColor(state),
      friendIds: [],
      points: 0,
      onboarded: false,
      createdAt: new Date().toISOString(),
    };
    state.users.push(friend);
  }
  if (friend.id === wife.id) throw new Error('You cannot add yourself');
  if (!wife.friendIds.includes(friend.id)) wife.friendIds.push(friend.id);
  if (!friend.friendIds.includes(wife.id)) friend.friendIds.push(wife.id);
  return friend;
}

export function completeOnboarding(user: User): void {
  user.onboarded = true;
}

/** The wife who owns a given user's economy (self if wife, else partner). */
export function ownerWifeId(user: User): string | undefined {
  if (user.role === 'wife') return user.id;
  return user.partnerId;
}

export function addPrize(
  state: State,
  wife: User,
  input: { title: string; emoji?: string; cost: number },
): Prize {
  if (wife.role !== 'wife') throw new Error('Only a wife can add prizes');
  const title = input.title.trim();
  if (!title) throw new Error('Prize title is required');
  if (!Number.isFinite(input.cost) || input.cost <= 0) {
    throw new Error('Prize cost must be a positive number');
  }
  const prize: Prize = {
    id: id('p_'),
    wifeId: wife.id,
    title,
    emoji: input.emoji?.trim() || '🎁',
    cost: Math.round(input.cost),
    createdAt: new Date().toISOString(),
  };
  state.prizes.push(prize);
  return prize;
}

export function removePrize(state: State, wife: User, prizeId: string): boolean {
  const before = state.prizes.length;
  state.prizes = state.prizes.filter(
    (p) => !(p.id === prizeId && p.wifeId === wife.id),
  );
  return state.prizes.length < before;
}

export function addTask(
  state: State,
  wife: User,
  input: { title: string; emoji?: string; points: number },
): EarnTask {
  if (wife.role !== 'wife') throw new Error('Only a wife can add tasks');
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required');
  if (!Number.isFinite(input.points) || input.points <= 0) {
    throw new Error('Task points must be a positive number');
  }
  const task: EarnTask = {
    id: id('t_'),
    wifeId: wife.id,
    title,
    emoji: input.emoji?.trim() || '⭐',
    points: Math.round(input.points),
    createdAt: new Date().toISOString(),
  };
  state.tasks.push(task);
  return task;
}

export function removeTask(state: State, wife: User, taskId: string): boolean {
  const before = state.tasks.length;
  state.tasks = state.tasks.filter(
    (t) => !(t.id === taskId && t.wifeId === wife.id),
  );
  return state.tasks.length < before;
}

export function prizesForUser(state: State, user: User): Prize[] {
  const wifeId = ownerWifeId(user);
  return state.prizes.filter((p) => p.wifeId === wifeId);
}

export function tasksForUser(state: State, user: User): EarnTask[] {
  const wifeId = ownerWifeId(user);
  return state.tasks.filter((t) => t.wifeId === wifeId);
}

export function createSubmission(
  state: State,
  boyfriend: User,
  input: {
    title: string;
    emoji?: string;
    points: number;
    note?: string;
    images?: string[];
  },
): Submission {
  if (boyfriend.role !== 'boyfriend') {
    throw new Error('Only a boyfriend can submit for points');
  }
  if (!boyfriend.partnerId) throw new Error('You are not linked to a partner');
  const title = input.title.trim();
  if (!title) throw new Error('Describe what you did');
  if (!Number.isFinite(input.points) || input.points <= 0) {
    throw new Error('Points must be a positive number');
  }
  const submission: Submission = {
    id: id('s_'),
    boyfriendId: boyfriend.id,
    wifeId: boyfriend.partnerId,
    title,
    emoji: input.emoji?.trim() || '⭐',
    points: Math.round(input.points),
    requestedPoints: Math.round(input.points),
    note: input.note?.trim() ?? '',
    images: (input.images ?? []).filter(Boolean).slice(0, 4),
    status: 'pending',
    revised: false,
    shared: false,
    createdAt: new Date().toISOString(),
  };
  state.submissions.push(submission);
  return submission;
}

/** Mark a pending submission to appear on the feed once approved. */
export function shareSubmission(
  state: State,
  boyfriend: User,
  submissionId: string,
): Submission {
  const submission = state.submissions.find((s) => s.id === submissionId);
  if (!submission) throw new Error('Request not found');
  if (submission.boyfriendId !== boyfriend.id) {
    throw new Error('Not your request');
  }
  submission.shared = true;
  return submission;
}

export function approveSubmission(
  state: State,
  wife: User,
  submissionId: string,
  revisedPoints?: number,
): { submission: Submission; feed?: FeedEvent } {
  const submission = state.submissions.find((s) => s.id === submissionId);
  if (!submission) throw new Error('Request not found');
  if (submission.wifeId !== wife.id) throw new Error('Not your request');
  if (submission.status !== 'pending') {
    throw new Error('Request already resolved');
  }
  if (revisedPoints !== undefined) {
    if (!Number.isFinite(revisedPoints) || revisedPoints <= 0) {
      throw new Error('Revised points must be positive');
    }
    submission.points = Math.round(revisedPoints);
    submission.revised = submission.points !== submission.requestedPoints;
  }
  submission.status = 'approved';
  submission.resolvedAt = new Date().toISOString();

  const boyfriend = requireUser(state, submission.boyfriendId);
  boyfriend.points += submission.points;

  if (!submission.shared) {
    return { submission };
  }

  const feed: FeedEvent = {
    id: id('f_'),
    type: 'earn',
    boyfriendId: boyfriend.id,
    wifeId: wife.id,
    title: submission.title,
    emoji: submission.emoji,
    points: submission.points,
    note: submission.note,
    images: submission.images ?? [],
    likes: [],
    reactions: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  state.feed.push(feed);
  return { submission, feed };
}

export function denySubmission(
  state: State,
  wife: User,
  submissionId: string,
): Submission {
  const submission = state.submissions.find((s) => s.id === submissionId);
  if (!submission) throw new Error('Request not found');
  if (submission.wifeId !== wife.id) throw new Error('Not your request');
  if (submission.status !== 'pending') {
    throw new Error('Request already resolved');
  }
  submission.status = 'denied';
  submission.resolvedAt = new Date().toISOString();
  return submission;
}

export function redeemPrize(
  state: State,
  boyfriend: User,
  prizeId: string,
): { redemption: Redemption; feed?: FeedEvent } {
  if (boyfriend.role !== 'boyfriend') {
    throw new Error('Only a boyfriend can redeem prizes');
  }
  const prize = state.prizes.find((p) => p.id === prizeId);
  if (!prize) throw new Error('Prize not found');
  if (prize.wifeId !== boyfriend.partnerId) throw new Error('Not your prize');
  if (boyfriend.points < prize.cost) {
    throw new Error('Not enough points for this prize');
  }
  boyfriend.points -= prize.cost;

  const redemption: Redemption = {
    id: id('r_'),
    boyfriendId: boyfriend.id,
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
}

/** Post a redemption to the social feed (Venmo-style share). */
export function shareRedemption(
  state: State,
  boyfriend: User,
  redemptionId: string,
): { redemption: Redemption; feed: FeedEvent } {
  const redemption = state.redemptions.find((r) => r.id === redemptionId);
  if (!redemption) throw new Error('Redemption not found');
  if (redemption.boyfriendId !== boyfriend.id) {
    throw new Error('Not your redemption');
  }
  if (redemption.shared) {
    const existing = state.feed.find(
      (e) =>
        e.type === 'redeem' &&
        e.boyfriendId === redemption.boyfriendId &&
        e.title === redemption.prizeTitle &&
        e.points === redemption.cost &&
        e.createdAt === redemption.createdAt,
    );
    if (existing) return { redemption, feed: existing };
  }
  redemption.shared = true;
  const feed: FeedEvent = {
    id: id('f_'),
    type: 'redeem',
    boyfriendId: boyfriend.id,
    wifeId: redemption.wifeId,
    title: redemption.prizeTitle,
    emoji: redemption.emoji,
    points: redemption.cost,
    note: '',
    images: [],
    likes: [],
    reactions: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  state.feed.push(feed);
  return { redemption, feed };
}

export function fulfillRedemption(
  state: State,
  wife: User,
  redemptionId: string,
): Redemption {
  const redemption = state.redemptions.find((r) => r.id === redemptionId);
  if (!redemption) throw new Error('Redemption not found');
  if (redemption.wifeId !== wife.id) throw new Error('Not your redemption');
  redemption.status = 'fulfilled';
  redemption.resolvedAt = new Date().toISOString();
  return redemption;
}

/** The set of wife ids whose activity a user can see in their feed. */
export function circleWifeIds(state: State, user: User): Set<string> {
  const rootWifeId = ownerWifeId(user);
  const ids = new Set<string>();
  if (!rootWifeId) return ids;
  ids.add(rootWifeId);
  const rootWife = state.users.find((u) => u.id === rootWifeId);
  for (const fid of rootWife?.friendIds ?? []) ids.add(fid);
  return ids;
}

export function feedForUser(state: State, user: User): FeedEventView[] {
  const circle = circleWifeIds(state, user);
  return state.feed
    .filter((e) => circle.has(e.wifeId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => {
      const boyfriend = state.users.find((u) => u.id === e.boyfriendId);
      const wife = state.users.find((u) => u.id === e.wifeId);
      return {
        ...e,
        boyfriendName: boyfriend?.name ?? 'Someone',
        boyfriendColor: boyfriend?.color ?? '#008CFF',
        boyfriendAvatar: boyfriend
          ? (boyfriend.avatarUrl ?? avatarFor(boyfriend.name))
          : undefined,
        wifeName: wife?.name ?? 'their partner',
        likedByMe: e.likes.includes(user.id),
      };
    });
}

export function toggleLike(
  state: State,
  user: User,
  feedId: string,
): FeedEvent {
  const event = state.feed.find((e) => e.id === feedId);
  if (!event) throw new Error('Post not found');
  const idx = event.likes.indexOf(user.id);
  if (idx >= 0) event.likes.splice(idx, 1);
  else event.likes.push(user.id);
  return event;
}

/** Toggle an emoji reaction from a user on a post. */
export function reactToFeed(
  state: State,
  user: User,
  feedId: string,
  emoji: string,
): FeedEvent {
  const event = state.feed.find((e) => e.id === feedId);
  if (!event) throw new Error('Post not found');
  const clean = emoji.trim().slice(0, 8);
  if (!clean) throw new Error('Pick an emoji');
  if (!event.reactions) event.reactions = [];
  const idx = event.reactions.findIndex(
    (r) => r.userId === user.id && r.emoji === clean,
  );
  if (idx >= 0) event.reactions.splice(idx, 1);
  else event.reactions.push({ emoji: clean, userId: user.id });
  return event;
}

export function addComment(
  state: State,
  user: User,
  feedId: string,
  text: string,
): FeedEvent {
  const event = state.feed.find((e) => e.id === feedId);
  if (!event) throw new Error('Post not found');
  const clean = text.trim().slice(0, 400);
  if (!clean) throw new Error('Write a comment');
  if (!event.comments) event.comments = [];
  event.comments.push({
    id: id('c_'),
    userId: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? avatarFor(user.name),
    text: clean,
    createdAt: new Date().toISOString(),
  });
  return event;
}

export function pendingSubmissionsForWife(
  state: State,
  wife: User,
): Submission[] {
  return state.submissions
    .filter((s) => s.wifeId === wife.id && s.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pendingRedemptionsForWife(
  state: State,
  wife: User,
): Redemption[] {
  return state.redemptions
    .filter((r) => r.wifeId === wife.id && r.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function submissionsForBoyfriend(
  state: State,
  boyfriend: User,
): Submission[] {
  return state.submissions
    .filter((s) => s.boyfriendId === boyfriend.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function displayUser(state: State, userId: string) {
  const u = state.users.find((x) => x.id === userId);
  return {
    name: u?.name ?? 'Someone',
    color: u?.color ?? '#008CFF',
    avatar: u ? (u.avatarUrl ?? avatarFor(u.name)) : undefined,
  };
}

/** Derive a notifications feed for a user from existing activity. */
export function buildNotifications(
  state: State,
  user: User,
): NotificationItem[] {
  const items: NotificationItem[] = [];

  if (user.role === 'boyfriend') {
    // Results of your own requests.
    for (const s of state.submissions) {
      if (s.boyfriendId !== user.id || s.status === 'pending') continue;
      const wife = displayUser(state, s.wifeId);
      if (s.status === 'approved') {
        items.push({
          id: `n_appr_${s.id}`,
          kind: 'approved',
          emoji: '✅',
          title: `${wife.name} approved your request`,
          body: `${s.emoji} ${s.title}${s.revised ? ' · revised' : ''}`,
          points: s.points,
          actorName: wife.name,
          actorColor: wife.color,
          actorAvatar: wife.avatar,
          createdAt: s.resolvedAt ?? s.createdAt,
        });
      } else {
        items.push({
          id: `n_deny_${s.id}`,
          kind: 'denied',
          emoji: '🙈',
          title: `${wife.name} passed on your request`,
          body: `${s.emoji} ${s.title}`,
          actorName: wife.name,
          actorColor: wife.color,
          actorAvatar: wife.avatar,
          createdAt: s.resolvedAt ?? s.createdAt,
        });
      }
    }
    // New prizes your partner added.
    for (const p of state.prizes) {
      if (p.wifeId !== user.partnerId) continue;
      const wife = displayUser(state, p.wifeId);
      items.push({
        id: `n_prize_${p.id}`,
        kind: 'prize',
        emoji: p.emoji,
        title: `${wife.name} added a new prize`,
        body: p.title,
        points: p.cost,
        actorName: wife.name,
        actorColor: wife.color,
        actorAvatar: wife.avatar,
        createdAt: p.createdAt,
      });
    }
  } else {
    // Wife: incoming point requests to review.
    for (const s of state.submissions) {
      if (s.wifeId !== user.id || s.status !== 'pending') continue;
      const bf = displayUser(state, s.boyfriendId);
      items.push({
        id: `n_req_${s.id}`,
        kind: 'request',
        emoji: s.emoji,
        title: `${bf.name} requested points`,
        body: s.title,
        points: s.requestedPoints,
        actorName: bf.name,
        actorColor: bf.color,
        actorAvatar: bf.avatar,
        createdAt: s.createdAt,
      });
    }
    // Wife: redemptions to fulfill.
    for (const r of state.redemptions) {
      if (r.wifeId !== user.id || r.status !== 'pending') continue;
      const bf = displayUser(state, r.boyfriendId);
      items.push({
        id: `n_redeem_${r.id}`,
        kind: 'redeem',
        emoji: r.emoji,
        title: `${bf.name} redeemed a prize`,
        body: r.prizeTitle,
        points: r.cost,
        actorName: bf.name,
        actorColor: bf.color,
        actorAvatar: bf.avatar,
        createdAt: r.createdAt,
      });
    }
  }

  // Reactions + comments on posts that belong to this user's household.
  const myWifeId = ownerWifeId(user);
  for (const e of state.feed) {
    const mine =
      e.boyfriendId === user.id || (myWifeId && e.wifeId === myWifeId);
    if (!mine) continue;

    const others = e.reactions.filter((r) => r.userId !== user.id);
    if (others.length > 0) {
      const first = displayUser(state, others[0].userId);
      const extra = others.length - 1;
      items.push({
        id: `n_react_${e.id}`,
        kind: 'reaction',
        emoji: others[0].emoji,
        title:
          extra > 0
            ? `${first.name} & ${extra} other${extra > 1 ? 's' : ''} reacted`
            : `${first.name} reacted`,
        body: `${e.emoji} ${e.title}`,
        actorName: first.name,
        actorColor: first.color,
        actorAvatar: first.avatar,
        createdAt: e.createdAt,
      });
    }

    for (const c of e.comments) {
      if (c.userId === user.id) continue;
      items.push({
        id: `n_comment_${c.id}`,
        kind: 'comment',
        emoji: '💬',
        title: `${c.name} commented`,
        body: `“${c.text}”`,
        actorName: c.name,
        actorAvatar: c.avatarUrl,
        createdAt: c.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
