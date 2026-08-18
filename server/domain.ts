import type {
  EarnTask,
  FeedEvent,
  FeedEventView,
  CoupleSearchResult,
  FriendRequest,
  FriendRequestView,
  NotificationItem,
  Prize,
  PublicUser,
  Redemption,
  Role,
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
  friendRequests: FriendRequest[];
}

export function createEmptyState(): State {
  return {
    users: [],
    prizes: [],
    tasks: [],
    submissions: [],
    redemptions: [],
    feed: [],
    friendRequests: [],
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
/**
 * Generated avatar for a name. PNG by default because React Native's `Image`
 * can't decode SVG; the web `<img>` renders either.
 */
export function avatarFor(seed: string, format: 'png' | 'svg' = 'png'): string {
  return `https://api.dicebear.com/9.x/adventurer/${format}?seed=${encodeURIComponent(
    seed,
  )}&backgroundType=gradientLinear&radius=50`;
}

/** Deterministic stock photo for attaching to posts (renders client-side). */
export function stockPhoto(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/720/480`;
}

/** Ambiguity-free alphabet for household invite codes. */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(state: State): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
    }
    if (
      !state.users.some(
        (u) => u.inviteCode === code || u.coupleCode === code,
      )
    ) {
      return code;
    }
  }
  return id('C').slice(-6).toUpperCase();
}

/** Household invite code for the partner who created (or still owns) the couple. */
export function ensureInviteCode(state: State, user: User): string {
  if (user.inviteCode) return user.inviteCode;
  user.inviteCode = generateInviteCode(state);
  return user.inviteCode;
}

export function ensureCoupleCode(state: State, wife: User): string {
  if (wife.coupleCode) return wife.coupleCode;
  wife.coupleCode = generateInviteCode(state);
  return wife.coupleCode;
}

export function normalizeCoupleUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

function availableCoupleUsername(state: State, seed: string): string {
  const normalized = normalizeCoupleUsername(seed);
  const base = (normalized.length >= 3 ? normalized : `${normalized}couple`).slice(
    0,
    20,
  );
  let candidate = base;
  let suffix = 2;
  while (
    state.users.some(
      (user) => user.coupleUsername?.toLowerCase() === candidate.toLowerCase(),
    )
  ) {
    candidate = `${base.slice(0, 20 - String(suffix).length)}${suffix++}`;
  }
  return candidate;
}

export function setCoupleUsername(
  state: State,
  wife: User,
  rawUsername: string,
): string {
  const username = normalizeCoupleUsername(rawUsername);
  if (username.length < 3) throw new Error('Couple username must be at least 3 characters');
  if (username.length > 24) throw new Error('Couple username must be 24 characters or less');
  const taken = state.users.some(
    (user) =>
      user.id !== wife.id &&
      user.coupleUsername?.toLowerCase() === username.toLowerCase(),
  );
  if (taken) throw new Error('That couple username is already taken');
  wife.coupleUsername = username;
  return username;
}

export function publicUser(state: State, user: User): PublicUser {
  const partner = user.partnerId
    ? state.users.find((u) => u.id === user.partnerId)
    : undefined;
  const household = householdAnchor(state, user);
  if (household && !household.coupleCode) ensureCoupleCode(state, household);
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
    inviteCode: user.inviteCode ?? household?.inviteCode,
    coupleCode: household?.coupleCode,
    coupleUsername: household?.coupleUsername,
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
  const value = tok?.trim();
  if (!value) return undefined;
  return state.users.find((u) => u.token === value);
}

export function findByEmail(state: State, email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return state.users.find((u) => u.email.toLowerCase() === normalized);
}

export function signup(
  state: State,
  input: {
    name: string;
    email: string;
    password: string;
    role?: 'wife' | 'boyfriend';
    coupleUsername?: string;
  },
): User {
  const name = input.name.trim();
  const email = input.email.trim();
  const role = input.role === 'boyfriend' ? 'boyfriend' : 'wife';
  if (!name) throw new Error('Name is required');
  if (!email) throw new Error('Email is required');
  if (!input.password) throw new Error('Password is required');
  if (findByEmail(state, email)) throw new Error('That email is already taken');
  const requestedCoupleUsername = input.coupleUsername
    ? normalizeCoupleUsername(input.coupleUsername)
    : role === 'wife'
      ? availableCoupleUsername(state, name)
      : undefined;
  if (requestedCoupleUsername && requestedCoupleUsername.length < 3) {
    throw new Error('Couple username must be at least 3 characters');
  }
  if (requestedCoupleUsername && requestedCoupleUsername.length > 24) {
    throw new Error('Couple username must be 24 characters or less');
  }
  if (
    requestedCoupleUsername &&
    state.users.some(
      (candidate) =>
        candidate.coupleUsername?.toLowerCase() === requestedCoupleUsername,
    )
  ) {
    throw new Error('That couple username is already taken');
  }

  const user: User = {
    id: id('u_'),
    name,
    email,
    password: input.password,
    role,
    color: pickColor(state),
    avatarUrl: avatarFor(name),
    inviteCode: role === 'wife' ? generateInviteCode(state) : undefined,
    coupleCode: role === 'wife' ? generateInviteCode(state) : undefined,
    coupleUsername: requestedCoupleUsername,
    friendIds: [],
    points: 0,
    token: token(),
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  state.users.push(user);
  return user;
}

/** @deprecated Prefer signup(..., { role: 'wife' }). */
export function signupWife(
  state: State,
  input: { name: string; email: string; password: string },
): User {
  return signup(state, { ...input, role: 'wife' });
}

/** Partner joins a household using the household invite code. */
export function joinWithInviteCode(
  state: State,
  joiner: User,
  rawCode: string,
): User {
  if (joiner.partnerId) throw new Error('You are already linked to a partner');

  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) throw new Error('Enter a valid invite code');

  const host = state.users.find((u) => u.inviteCode?.toUpperCase() === code);
  if (!host) throw new Error('Invite code not found');
  if (host.id === joiner.id) throw new Error('That is your own invite code');
  if (host.partnerId) throw new Error('That household already has a partner');

  joiner.inviteCode = undefined;
  joiner.coupleCode = undefined;
  joiner.coupleUsername = undefined;
  joiner.partnerId = host.id;
  host.partnerId = joiner.id;
  return host;
}

export function login(state: State, email: string, password: string): User {
  const user = findByEmail(state, email);
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }
  if (!user.token) user.token = token();
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
    if (!existing.token) existing.token = token();
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
  if (!user.token) user.token = token();
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
  // Empty string means "clear this token" in saveState. `undefined` is
  // treated as "this snapshot doesn't know" so a deploy can't wipe sessions.
  user.token = '';
}

export function inviteBoyfriend(
  state: State,
  wife: User,
  input: { name: string; email: string; password?: string },
): User {
  if (wife.partnerId) throw new Error('You already have a partner linked');
  ensureInviteCode(state, wife);
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

/** Unlink the current partner from both sides. The person who leaves
 *  loses their points. Tasks and prizes stay tagged to this pair so they
 *  come back if the same two people link again — not with someone else. */
export function removePartner(state: State, user: User): void {
  if (!user.partnerId) throw new Error('No partner to remove');
  const partner = state.users.find((u) => u.id === user.partnerId);
  stampCatalogForPair(state, user.id, user.partnerId);
  user.points = 0;
  if (partner?.partnerId === user.id) {
    partner.partnerId = undefined;
    partner.token = '';
  }
  user.partnerId = undefined;
}

function stampCatalogForPair(
  state: State,
  leftId: string,
  rightId: string,
): void {
  for (const task of state.tasks) {
    if (task.forPartnerId) continue;
    if (task.wifeId === leftId) task.forPartnerId = rightId;
    else if (task.wifeId === rightId) task.forPartnerId = leftId;
  }
  for (const prize of state.prizes) {
    if (prize.forPartnerId) continue;
    if (prize.wifeId === leftId) prize.forPartnerId = rightId;
    else if (prize.wifeId === rightId) prize.forPartnerId = leftId;
  }
}

export function listFriends(state: State, wife: User): PublicUser[] {
  const household = householdAnchor(state, wife) ?? wife;
  return household.friendIds
    .map((id) => state.users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u))
    .map((u) => publicUser(state, u));
}

/** The couple household for social features, or undefined when unlinked. */
export function findHousehold(state: State, user: User): User | undefined {
  return householdAnchor(state, user);
}

/** The couple household for social features — one person is enough. */
export function requireHousehold(state: State, user: User): User {
  const wife = findHousehold(state, user);
  if (!wife) {
    throw new Error(
      'Enter your partner’s invite code before connecting with other couples',
    );
  }
  return wife;
}

/** A social household must have both partners linked to each other. */
export function requireLinkedHousehold(state: State, user: User): User {
  const wife = requireHousehold(state, user);
  const partner = wife.partnerId
    ? state.users.find((candidate) => candidate.id === wife.partnerId)
    : undefined;
  if (!partner || partner.partnerId !== wife.id) {
    throw new Error('Link your partner before connecting with other couples');
  }
  return wife;
}

/** Friend-request payloads must never leak another household's invite code. */
function withoutInviteCode(user: PublicUser): PublicUser {
  return { ...user, inviteCode: undefined };
}

function friendRequestView(state: State, request: FriendRequest): FriendRequestView {
  return {
    ...request,
    from: withoutInviteCode(publicUser(state, requireUser(state, request.fromWifeId))),
    to: withoutInviteCode(publicUser(state, requireUser(state, request.toWifeId))),
  };
}

export function searchCouples(
  state: State,
  user: User,
  rawQuery: string,
): CoupleSearchResult[] {
  const me = requireHousehold(state, user);
  const query = normalizeCoupleUsername(rawQuery);
  if (query.length < 2) return [];

  return state.users
    .filter(
      (candidate) =>
        Boolean(candidate.inviteCode) &&
        candidate.id !== me.id &&
        Boolean(candidate.coupleUsername?.includes(query)),
    )
    .slice(0, 20)
    .map((candidate) => {
      const partner = candidate.partnerId
        ? state.users.find((person) => person.id === candidate.partnerId)
        : undefined;
      const pending = state.friendRequests.some(
        (request) =>
          request.status === 'pending' &&
          ((request.fromWifeId === me.id &&
            request.toWifeId === candidate.id) ||
            (request.fromWifeId === candidate.id &&
              request.toWifeId === me.id)),
      );
      return {
        id: candidate.id,
        coupleUsername: candidate.coupleUsername!,
        name: candidate.name,
        partnerName: partner?.name,
        color: candidate.color,
        avatarUrl: candidate.avatarUrl,
        partnerColor: partner?.color,
        partnerAvatar: partner?.avatarUrl,
        relationship: me.friendIds.includes(candidate.id)
          ? 'friends'
          : pending
            ? 'pending'
            : 'none',
      };
    });
}

export function requestFriendByCode(
  state: State,
  user: User,
  rawCode: string,
): FriendRequestView {
  const from = requireHousehold(state, user);
  const username = normalizeCoupleUsername(rawCode);
  const to = state.users.find(
    (candidate) =>
      Boolean(candidate.inviteCode) &&
      candidate.coupleUsername?.toLowerCase() === username,
  );
  if (!to) throw new Error('Couple not found');
  if (from.id === to.id) throw new Error('That is your own couple code');
  if (from.friendIds.includes(to.id)) throw new Error('You are already friends');
  const existing = state.friendRequests.find(
    (request) =>
      request.status === 'pending' &&
      ((request.fromWifeId === from.id && request.toWifeId === to.id) ||
        (request.fromWifeId === to.id && request.toWifeId === from.id)),
  );
  if (existing) {
    if (existing.fromWifeId === to.id) {
      existing.status = 'accepted';
      existing.resolvedAt = new Date().toISOString();
      from.friendIds.push(to.id);
      to.friendIds.push(from.id);
    }
    return friendRequestView(state, existing);
  }
  const request: FriendRequest = {
    id: id('fr_'),
    fromWifeId: from.id,
    toWifeId: to.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  state.friendRequests.push(request);
  return friendRequestView(state, request);
}

export function friendRequestsForUser(state: State, user: User): FriendRequestView[] {
  // An unlinked user has no household yet — that's an empty inbox, not an error.
  const wife = findHousehold(state, user);
  if (!wife) return [];
  return state.friendRequests
    .filter(
      (request) =>
        request.status === 'pending' &&
        (request.fromWifeId === wife.id || request.toWifeId === wife.id),
    )
    .map((request) => friendRequestView(state, request));
}

export function resolveFriendRequest(
  state: State,
  user: User,
  requestId: string,
  accept: boolean,
): FriendRequestView {
  const wife = requireHousehold(state, user);
  const request = state.friendRequests.find(
    (candidate) => candidate.id === requestId && candidate.status === 'pending',
  );
  if (!request) throw new Error('Friend request not found');
  if (request.toWifeId !== wife.id) throw new Error('This request is not for your couple');
  request.status = accept ? 'accepted' : 'declined';
  request.resolvedAt = new Date().toISOString();
  if (accept) {
    const from = requireUser(state, request.fromWifeId);
    if (!wife.friendIds.includes(from.id)) wife.friendIds.push(from.id);
    if (!from.friendIds.includes(wife.id)) from.friendIds.push(wife.id);
  }
  return friendRequestView(state, request);
}

export function addFriend(
  state: State,
  wife: User,
  input: { name: string; email: string },
): User {
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

/** Update display name during / after onboarding. */
export function updateProfile(
  user: User,
  input: { name?: string; avatarUrl?: string },
): User {
  const name = input.name?.trim();
  if (name) {
    // Only let the avatar follow the name while it's still the generated
    // default — a picked one shouldn't be thrown away by a rename.
    const usingDefault =
      !user.avatarUrl ||
      user.avatarUrl === avatarFor(user.name) ||
      user.avatarUrl === avatarFor(user.name, 'svg');
    user.name = name;
    if (usingDefault) user.avatarUrl = avatarFor(name);
  }

  const avatarUrl = input.avatarUrl?.trim();
  if (avatarUrl) {
    if (!/^https?:\/\//.test(avatarUrl)) {
      throw new Error('Avatar must be an image URL');
    }
    user.avatarUrl = avatarUrl;
  }
  return user;
}

export function setPushToken(user: User, token: string): User {
  const trimmed = token.trim();
  if (!trimmed) {
    delete user.pushToken;
    return user;
  }
  user.pushToken = trimmed;
  return user;
}

/**
 * Swap which side of the household a user is on. Only possible during setup:
 * once a partner is linked or points have moved, the role is load-bearing.
 */
export function switchRole(state: State, user: User, next: Role): User {
  if (user.role === next) return user;
  if (user.partnerId) throw new Error('Unlink your partner before switching roles');
  if (state.submissions.some((s) => s.boyfriendId === user.id)) {
    throw new Error('You already have point requests on this account');
  }

  if (next === 'boyfriend') {
    state.prizes = state.prizes.filter((prize) => prize.wifeId !== user.id);
    state.tasks = state.tasks.filter((task) => task.wifeId !== user.id);
    state.friendRequests = state.friendRequests.filter(
      (request) =>
        request.fromWifeId !== user.id && request.toWifeId !== user.id,
    );
    for (const other of state.users) {
      other.friendIds = other.friendIds.filter((id) => id !== user.id);
    }
    user.friendIds = [];
    user.inviteCode = undefined;
    user.coupleCode = undefined;
    user.coupleUsername = undefined;
  } else {
    user.inviteCode = generateInviteCode(state);
    user.coupleCode = generateInviteCode(state);
    user.coupleUsername = availableCoupleUsername(state, user.name);
    for (const suggestion of TASK_SUGGESTIONS) {
      state.tasks.push({
        id: id('t_'),
        wifeId: user.id,
        title: suggestion.title,
        emoji: suggestion.emoji,
        points: suggestion.points,
        createdAt: new Date().toISOString(),
      });
    }
  }

  user.role = next;
  user.points = 0;
  return user;
}

/** Partner who owns household codes — self if you created, else your partner. */
export function householdAnchor(state: State, user: User): User | undefined {
  if (user.inviteCode) return user;
  if (user.partnerId) {
    const partner = state.users.find((candidate) => candidate.id === user.partnerId);
    if (partner?.inviteCode) return partner;
  }
  return undefined;
}

/** @deprecated Prefer householdAnchor. Kept for feed/circle helpers. */
export function ownerWifeId(user: User): string | undefined {
  if (user.inviteCode) return user.id;
  return user.partnerId;
}

export function addPrize(
  state: State,
  wife: User,
  input: { title: string; emoji?: string; cost: number },
): Prize {
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
    forPartnerId: wife.partnerId,
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
    forPartnerId: wife.partnerId,
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
  return state.prizes.filter((p) => isCatalogVisible(user, p));
}

export function tasksForUser(state: State, user: User): EarnTask[] {
  return state.tasks.filter((t) => isCatalogVisible(user, t));
}

function isCatalogVisible(
  user: User,
  item: { wifeId: string; forPartnerId?: string },
): boolean {
  if (user.partnerId) {
    if (item.wifeId !== user.id && item.wifeId !== user.partnerId) return false;
    if (!item.forPartnerId) return true;
    return item.forPartnerId === user.id || item.forPartnerId === user.partnerId;
  }
  return item.wifeId === user.id;
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
  if (submission.boyfriendId === wife.id) {
    throw new Error('You cannot approve your own request');
  }
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
  if (submission.boyfriendId === wife.id) {
    throw new Error('You cannot deny your own request');
  }
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
  const prize = state.prizes.find((p) => p.id === prizeId);
  if (!prize) throw new Error('Prize not found');
  if (prize.wifeId === boyfriend.id) throw new Error('You cannot redeem your own prize');
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

/** Household members + friend households whose activity a user can see. */
export function circleWifeIds(state: State, user: User): Set<string> {
  const root = householdAnchor(state, user);
  const ids = new Set<string>();
  function addHousehold(person: User | undefined) {
    if (!person) return;
    ids.add(person.id);
    if (person.partnerId) ids.add(person.partnerId);
  }
  addHousehold(root);
  for (const fid of root?.friendIds ?? []) {
    addHousehold(state.users.find((candidate) => candidate.id === fid));
  }
  return ids;
}

export function feedForUser(state: State, user: User): FeedEventView[] {
  // A private household stays private until both partners have joined.
  let circle: Set<string>;
  try {
    requireLinkedHousehold(state, user);
    circle = circleWifeIds(state, user);
  } catch {
    return [];
  }
  return state.feed
    .filter((e) => {
      if (!circle.has(e.wifeId)) return false;
      const wife = state.users.find((u) => u.id === e.wifeId);
      const boyfriend = state.users.find((u) => u.id === e.boyfriendId);
      return Boolean(
        wife &&
          boyfriend &&
          wife.partnerId === boyfriend.id &&
          boyfriend.partnerId === wife.id,
      );
    })
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
        wifeColor: wife?.color ?? '#7C5CFF',
        wifeAvatar: wife ? (wife.avatarUrl ?? avatarFor(wife.name)) : undefined,
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

/**
 * Pending redemptions from either side of the household: the wife still owes
 * them, and the boyfriend has already paid for them out of his balance.
 */
export function pendingRedemptionsForUser(
  state: State,
  user: User,
): Redemption[] {
  return state.redemptions
    .filter(
      (r) =>
        (r.wifeId === user.id || r.boyfriendId === user.id) &&
        r.status === 'pending',
    )
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

/** Pending reviews you owe, plus requests you submitted. */
export function submissionsForUser(state: State, user: User): Submission[] {
  const byId = new Map<string, Submission>();
  for (const s of pendingSubmissionsForWife(state, user)) byId.set(s.id, s);
  for (const s of submissionsForBoyfriend(state, user)) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  for (const s of state.submissions) {
    if (s.boyfriendId === user.id && s.status !== 'pending') {
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
    if (s.wifeId === user.id && s.status === 'pending') {
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
  }

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

  const myHouseholdId = ownerWifeId(user);
  if (myHouseholdId) {
    for (const request of state.friendRequests) {
      const incoming =
        request.toWifeId === myHouseholdId && request.status === 'pending';
      const accepted =
        request.fromWifeId === myHouseholdId && request.status === 'accepted';
      if (!incoming && !accepted) continue;
      const otherId = incoming ? request.fromWifeId : request.toWifeId;
      const other = state.users.find((candidate) => candidate.id === otherId);
      if (!other) continue;
      const partner = other.partnerId
        ? state.users.find((candidate) => candidate.id === other.partnerId)
        : undefined;
      items.push({
        id: `n_friend_${request.id}_${incoming ? 'in' : 'accepted'}`,
        kind: incoming ? 'friend_request' : 'friend_accepted',
        emoji: incoming ? '👋' : '✓',
        title: incoming
          ? `@${other.coupleUsername ?? other.name} sent a friend request`
          : `@${other.coupleUsername ?? other.name} accepted your request`,
        body: partner ? `${other.name} & ${partner.name}` : other.name,
        actorName: `@${other.coupleUsername ?? other.name}`,
        actorColor: other.color,
        actorAvatar: other.avatarUrl,
        friendRequestId: incoming ? request.id : undefined,
        createdAt:
          accepted && request.resolvedAt
            ? request.resolvedAt
            : request.createdAt,
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
