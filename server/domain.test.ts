import { beforeEach, describe, expect, it } from 'vitest';
import {
  addFriend,
  addPrize,
  addTask,
  approveSubmission,
  buildNotifications,
  circleWifeIds,
  createEmptyState,
  createSubmission,
  feedForUser,
  friendRequestsForUser,
  avatarFor,
  inviteBoyfriend,
  pendingRedemptionsForUser,
  prizesForUser,
  redeemPrize,
  setPushToken,
  updateProfile,
  requestFriendByCode,
  removePartner,
  shareRedemption,
  shareSubmission,
  searchCouples,
  signupWife,
  signup,
  switchRole,
  isCoupleUsernameTaken,
  tasksForUser,
  joinWithInviteCode,
  login,
  loginOrCreateFromIdentity,
  completeOnboarding,
  type State,
} from './domain.ts';

function bootstrap() {
  const state = createEmptyState();
  const wife = signupWife(state, {
    name: 'Wanda',
    email: 'wanda@example.com',
    password: 'secret',
  });
  const boyfriend = inviteBoyfriend(state, wife, {
    name: 'Ben',
    email: 'ben@example.com',
  });
  return { state, wife, boyfriend };
}

describe('accounts', () => {
  it('signs up a wife and rejects duplicate emails', () => {
    const state = createEmptyState();
    signupWife(state, { name: 'A', email: 'a@x.com', password: 'p' });
    expect(() =>
      signupWife(state, { name: 'B', email: 'a@x.com', password: 'p' }),
    ).toThrow(/already taken/i);
  });

  it('links a boyfriend as the wife partner', () => {
    const { state, wife, boyfriend } = bootstrap();
    expect(boyfriend.role).toBe('boyfriend');
    expect(boyfriend.partnerId).toBe(wife.id);
    expect(wife.partnerId).toBe(boyfriend.id);
    expect(state.users).toHaveLength(2);
  });

  it('gives prize-setters an invite code and lets partners join with it', () => {
    const state = createEmptyState();
    const wife = signup(state, {
      name: 'Emma',
      email: 'emma@x.com',
      password: 'secret',
      role: 'wife',
    });
    expect(wife.inviteCode).toMatch(/^[A-Z0-9]{6}$/);

    const bf = signup(state, {
      name: 'Noah',
      email: 'noah@x.com',
      password: 'secret',
      role: 'boyfriend',
    });
    const linked = joinWithInviteCode(state, bf, wife.inviteCode!);
    expect(linked.id).toBe(wife.id);
    expect(bf.partnerId).toBe(wife.id);
    expect(wife.partnerId).toBe(bf.id);
  });

  it('rejects a second partner joining the same invite code', () => {
    const state = createEmptyState();
    const wife = signup(state, {
      name: 'Emma',
      email: 'emma@x.com',
      password: 'secret',
      role: 'wife',
    });
    const first = signup(state, {
      name: 'Noah',
      email: 'noah@x.com',
      password: 'secret',
      role: 'boyfriend',
    });
    joinWithInviteCode(state, first, wife.inviteCode!);
    const second = signup(state, {
      name: 'Other',
      email: 'other@x.com',
      password: 'secret',
      role: 'boyfriend',
    });
    expect(() => joinWithInviteCode(state, second, wife.inviteCode!)).toThrow(
      /already has a partner/i,
    );
  });

  it('unlinks both sides when a partner is removed', () => {
    const { state, wife, boyfriend } = bootstrap();
    removePartner(state, wife);
    expect(wife.partnerId).toBeUndefined();
    expect(boyfriend.partnerId).toBeUndefined();
  });

  it('zeros the leaver’s points and keeps tasks for the same pair', () => {
    const { state, wife, boyfriend } = bootstrap();
    wife.points = 80;
    boyfriend.points = 40;
    addTask(state, wife, { title: 'Dishes', points: 10 });
    addPrize(state, wife, { title: 'Date night', cost: 50 });
    removePartner(state, boyfriend);
    expect(boyfriend.points).toBe(0);
    expect(wife.points).toBe(80);
    expect(tasksForUser(state, wife)).toHaveLength(1);
    expect(prizesForUser(state, wife)).toHaveLength(1);

    joinWithInviteCode(state, boyfriend, wife.inviteCode!);
    expect(tasksForUser(state, boyfriend).map((t) => t.title)).toEqual(['Dishes']);
    expect(prizesForUser(state, boyfriend).map((p) => p.title)).toEqual([
      'Date night',
    ]);
  });

  it('hides saved tasks when you join a different partner', () => {
    const { state, wife } = bootstrap();
    addTask(state, wife, { title: 'Dishes', points: 10 });
    removePartner(state, wife);
    const other = signup(state, {
      name: 'Alex',
      email: 'alex@x.com',
      password: 'secret',
      role: 'boyfriend',
    });
    joinWithInviteCode(state, other, wife.inviteCode!);
    expect(state.tasks.map((t) => t.title)).toEqual(['Dishes']);
    expect(tasksForUser(state, wife)).toEqual([]);
    expect(tasksForUser(state, other)).toEqual([]);
  });

  it('allows inviting again after a partner is removed', () => {
    const { state, wife, boyfriend } = bootstrap();
    removePartner(state, wife);
    const next = inviteBoyfriend(state, wife, {
      name: 'Alex',
      email: 'alex@x.com',
    });
    expect(wife.partnerId).toBe(next.id);
    expect(next.partnerId).toBe(wife.id);
    expect(boyfriend.partnerId).toBeUndefined();
  });
});

describe('redeemers without a household', () => {
  function loneRedeemer() {
    const state = createEmptyState();
    const bf = signup(state, {
      name: 'Noah',
      email: 'noah@x.com',
      password: 'secret',
      role: 'boyfriend',
    });
    return { state, bf };
  }

  it('cannot submit for points', () => {
    const { state, bf } = loneRedeemer();
    expect(() =>
      createSubmission(state, bf, { title: 'Did the dishes', points: 10 }),
    ).toThrow(/not linked to a partner/i);
  });

  it('has an empty feed and an empty friend request inbox', () => {
    const { state, bf } = loneRedeemer();
    expect(feedForUser(state, bf)).toEqual([]);
    expect(friendRequestsForUser(state, bf)).toEqual([]);
  });

  it('is told to enter a code when reaching for other couples', () => {
    const { state, bf } = loneRedeemer();
    expect(() => searchCouples(state, bf, 'emma')).toThrow(/invite code/i);
  });

  it('can switch to setting prizes, which builds them a household', () => {
    const { state, bf } = loneRedeemer();
    switchRole(state, bf, 'wife');
    expect(bf.role).toBe('wife');
    expect(bf.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(bf.coupleUsername).toBeTruthy();
    expect(tasksForUser(state, bf).length).toBeGreaterThan(0);
  });

  it('cannot switch roles once a partner is linked', () => {
    const { state, wife } = bootstrap();
    expect(() => switchRole(state, wife, 'boyfriend')).toThrow(/unlink/i);
  });

  it('drops household data when a prize-setter becomes a redeemer', () => {
    const state = createEmptyState();
    const wife = signupWife(state, {
      name: 'Emma',
      email: 'emma@x.com',
      password: 'secret',
    });
    addPrize(state, wife, { title: 'Movie night', cost: 50 });
    switchRole(state, wife, 'boyfriend');
    expect(wife.role).toBe('boyfriend');
    expect(wife.inviteCode).toBeUndefined();
    expect(wife.coupleUsername).toBeUndefined();
    expect(state.prizes).toEqual([]);
    expect(state.tasks).toEqual([]);
  });
});

describe('earning points', () => {
  let ctx: ReturnType<typeof bootstrap>;
  beforeEach(() => {
    ctx = bootstrap();
  });

  it('credits the boyfriend when a submission is approved', () => {
    const { state, wife, boyfriend } = ctx;
    createSubmission(state, boyfriend, { title: 'Mowed the lawn', points: 50 });
    const [submission] = state.submissions;
    shareSubmission(state, boyfriend, submission.id);
    approveSubmission(state, wife, submission.id);
    expect(boyfriend.points).toBe(50);
    expect(state.feed.some((f) => f.type === 'earn')).toBe(true);
  });

  it('keeps private approvals off the feed when not shared', () => {
    const { state, wife, boyfriend } = ctx;
    createSubmission(state, boyfriend, { title: 'Quiet chore', points: 20 });
    approveSubmission(state, wife, state.submissions[0].id);
    expect(boyfriend.points).toBe(20);
    expect(state.feed.some((f) => f.type === 'earn')).toBe(false);
  });

  it('lets the wife revise the awarded points', () => {
    const { state, wife, boyfriend } = ctx;
    createSubmission(state, boyfriend, { title: 'Vacuumed', points: 100 });
    const [submission] = state.submissions;
    const { submission: resolved } = approveSubmission(
      state,
      wife,
      submission.id,
      40,
    );
    expect(resolved.points).toBe(40);
    expect(resolved.revised).toBe(true);
    expect(boyfriend.points).toBe(40);
  });

  it('rejects approving someone else\'s request', () => {
    const { state, boyfriend } = ctx;
    const otherWife = signupWife(state, {
      name: 'Other',
      email: 'other@x.com',
      password: 'p',
    });
    createSubmission(state, boyfriend, { title: 'Cleaned', points: 10 });
    const [submission] = state.submissions;
    expect(() => approveSubmission(state, otherWife, submission.id)).toThrow(
      /not your request/i,
    );
  });
});

describe('redeeming prizes', () => {
  it('spends points and alerts the wife with a pending redemption', () => {
    const { state, wife, boyfriend } = bootstrap();
    const prize = addPrize(state, wife, { title: 'Movie night', cost: 100 });
    createSubmission(state, boyfriend, { title: 'Chores', points: 150 });
    approveSubmission(state, wife, state.submissions[0].id);
    expect(boyfriend.points).toBe(150);

    const { redemption } = redeemPrize(state, boyfriend, prize.id);
    expect(boyfriend.points).toBe(50);
    expect(state.redemptions).toHaveLength(1);
    expect(state.redemptions[0].status).toBe('pending');
    expect(state.feed.some((f) => f.type === 'redeem')).toBe(false);

    shareRedemption(state, boyfriend, redemption.id);
    expect(state.feed.some((f) => f.type === 'redeem')).toBe(true);
  });

  it('blocks redemption without enough points', () => {
    const { state, wife, boyfriend } = bootstrap();
    const prize = addPrize(state, wife, { title: 'Spa day', cost: 500 });
    expect(() => redeemPrize(state, boyfriend, prize.id)).toThrow(
      /not enough points/i,
    );
  });

  it('lets the boyfriend see the redemption holding his points', () => {
    const { state, wife, boyfriend } = bootstrap();
    const prize = addPrize(state, wife, { title: 'Movie night', cost: 100 });
    createSubmission(state, boyfriend, { title: 'Chores', points: 150 });
    approveSubmission(state, wife, state.submissions[0].id);
    redeemPrize(state, boyfriend, prize.id);

    const held = pendingRedemptionsForUser(state, boyfriend);
    expect(held).toHaveLength(1);
    expect(held[0].prizeTitle).toBe('Movie night');
    expect(held[0].cost).toBe(100);
    expect(pendingRedemptionsForUser(state, wife)).toHaveLength(1);
  });

  it('leaves the balance alone when the wife adds a prize', () => {
    const { state, wife, boyfriend } = bootstrap();
    createSubmission(state, boyfriend, { title: 'Chores', points: 150 });
    approveSubmission(state, wife, state.submissions[0].id);

    addPrize(state, wife, { title: 'Night out', cost: 500 });
    expect(boyfriend.points).toBe(150);

    // The notification is a price tag, so it must not read as a debit.
    const notif = buildNotifications(state, boyfriend).find(
      (n) => n.kind === 'prize',
    );
    expect(notif?.points).toBe(500);
  });
});

describe('profile', () => {
  it('keeps a picked avatar when the name changes', () => {
    const { boyfriend } = bootstrap();
    const custom = 'https://api.dicebear.com/9.x/adventurer/png?seed=custom';
    updateProfile(boyfriend, { avatarUrl: custom });
    updateProfile(boyfriend, { name: 'Jordan' });
    expect(boyfriend.name).toBe('Jordan');
    expect(boyfriend.avatarUrl).toBe(custom);
  });

  it('refreshes the default avatar when the name changes', () => {
    const { boyfriend } = bootstrap();
    boyfriend.avatarUrl = avatarFor(boyfriend.name);
    updateProfile(boyfriend, { name: 'Jordan' });
    expect(boyfriend.avatarUrl).toBe(avatarFor('Jordan'));
  });

  it('stores a push token', () => {
    const { boyfriend } = bootstrap();
    setPushToken(boyfriend, 'ExponentPushToken[abc]');
    expect(boyfriend.pushToken).toBe('ExponentPushToken[abc]');
  });

  it('clears a push token', () => {
    const { boyfriend } = bootstrap();
    setPushToken(boyfriend, 'ExponentPushToken[abc]');
    setPushToken(boyfriend, '  ');
    expect(boyfriend.pushToken).toBeUndefined();
  });
});

describe('the social feed', () => {
  it('shows a friend network as one community', () => {
    const { state, wife } = bootstrap();
    const friend = addFriend(state, wife, {
      name: 'Fran',
      email: 'fran@x.com',
    });
    const friendBf = inviteBoyfriend(state, friend, {
      name: 'Fred',
      email: 'fred@x.com',
    });
    addTask(state, friend, { title: 'Cooked', points: 20 });
    createSubmission(state, friendBf, { title: 'Cooked', points: 20 });
    shareSubmission(state, friendBf, state.submissions[0].id);
    approveSubmission(state, friend, state.submissions[0].id);

    const circle = circleWifeIds(state, wife);
    expect(circle.has(friend.id)).toBe(true);

    const feed = feedForUser(state, wife);
    expect(feed.some((f) => f.boyfriendName === 'Fred')).toBe(true);
  });
});

describe('couple discovery', () => {
  it('rejects a couple username that is already taken', () => {
    const state = createEmptyState();
    signup(state, {
      name: 'Emma',
      email: 'emma@x.com',
      password: 'secret',
      role: 'wife',
      coupleUsername: 'emmaandnoah',
    });
    expect(isCoupleUsernameTaken(state, 'EmmaAndNoah')).toBe(true);
    expect(() =>
      signup(state, {
        name: 'Mia',
        email: 'mia@x.com',
        password: 'secret',
        role: 'wife',
        coupleUsername: 'emmaandnoah',
      }),
    ).toThrow(/already taken/i);
  });

  it('lets one person search and request before their partner joins', () => {
    const state = createEmptyState();
    const wife = signup(state, {
      name: 'Emma',
      email: 'emma@x.com',
      password: 'secret',
      role: 'wife',
      coupleUsername: 'emmaandnoah',
    });
    const otherWife = signup(state, {
      name: 'Mia',
      email: 'mia@x.com',
      password: 'secret',
      role: 'wife',
      coupleUsername: 'miaandjake',
    });

    const results = searchCouples(state, wife, 'miaand');
    expect(results).toHaveLength(1);
    expect(results[0].coupleUsername).toBe('miaandjake');

    const request = requestFriendByCode(state, wife, 'miaandjake');
    expect(request.to.inviteCode).toBeUndefined();
    expect(request.from.inviteCode).toBeUndefined();

    const notifications = buildNotifications(state, otherWife);
    expect(notifications[0]).toMatchObject({
      kind: 'friend_request',
      friendRequestId: request.id,
    });
  });
});

describe('social privacy via signup', () => {
  it('does not auto-connect a new household to seeded demo users', () => {
    const state: State = createEmptyState();
    const demoWife = signupWife(state, {
      name: 'Demo',
      email: 'demo@x.com',
      password: 'p',
    });
    demoWife.demo = true;
    const realWife = signupWife(state, {
      name: 'Real',
      email: 'real@x.com',
      password: 'p',
    });
    expect(realWife.friendIds).not.toContain(demoWife.id);
  });
});

describe('session', () => {
  it('reuses an existing session token on login', () => {
    const state = createEmptyState();
    const user = signup(state, {
      name: 'A',
      email: 'a@x.com',
      password: 'secret',
      role: 'wife',
    });
    const token = user.token;
    const again = login(state, 'a@x.com', 'secret');
    expect(again.token).toBe(token);
  });

  it('marks onboarding complete', () => {
    const state = createEmptyState();
    const user = signup(state, {
      name: 'A',
      email: 'a@x.com',
      password: 'secret',
      role: 'wife',
    });
    expect(user.onboarded).toBe(false);
    completeOnboarding(user);
    expect(user.onboarded).toBe(true);
  });
});

describe('symmetric partners', () => {
  it('lets either partner create tasks, submit, and approve the other', () => {
    const { state, wife, boyfriend } = bootstrap();
    addTask(state, boyfriend, { title: 'Plan date night', emoji: '🌙', points: 40 });
    const task = tasksForUser(state, wife).find((t) => t.wifeId === boyfriend.id);
    expect(task?.title).toBe('Plan date night');

    createSubmission(state, wife, { title: 'Plan date night', points: 40 });
    expect(() =>
      approveSubmission(state, wife, state.submissions.at(-1)!.id),
    ).toThrow(/your own request/i);
    approveSubmission(state, boyfriend, state.submissions.at(-1)!.id);
    expect(wife.points).toBe(40);
  });

  it('lets either partner add prizes and blocks self-redeem', () => {
    const { state, wife, boyfriend } = bootstrap();
    const prize = addPrize(state, boyfriend, { title: 'Breakfast in bed', cost: 30 });
    expect(() => redeemPrize(state, boyfriend, prize.id)).toThrow(/your own prize/i);

    createSubmission(state, wife, { title: 'Took out trash', points: 30 });
    approveSubmission(state, boyfriend, state.submissions.at(-1)!.id);
    const { redemption } = redeemPrize(state, wife, prize.id);
    expect(redemption.wifeId).toBe(boyfriend.id);
    expect(wife.points).toBe(0);
    expect(pendingRedemptionsForUser(state, boyfriend)).toHaveLength(1);
    expect(pendingRedemptionsForUser(state, wife)).toHaveLength(1);
  });
});

describe('loginOrCreateFromIdentity', () => {
  it('creates a wife on first identity login and reuses on second', () => {
    const state = createEmptyState();
    const first = loginOrCreateFromIdentity(state, {
      email: 'new@example.com',
      name: 'New',
      provider: 'neon',
    });
    expect(first.role).toBe('wife');
    expect(first.email).toBe('new@example.com');
    const second = loginOrCreateFromIdentity(state, {
      email: 'new@example.com',
      name: 'New',
      provider: 'neon',
    });
    expect(second.id).toBe(first.id);
    expect(second.token).toBeTruthy();
  });
});
