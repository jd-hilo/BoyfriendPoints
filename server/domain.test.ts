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
  inviteBoyfriend,
  redeemPrize,
  requestFriendByCode,
  removePartner,
  shareRedemption,
  shareSubmission,
  searchCouples,
  signupWife,
  signup,
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
