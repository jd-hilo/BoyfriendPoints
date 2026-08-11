import { beforeEach, describe, expect, it } from 'vitest';
import {
  addFriend,
  addPrize,
  addTask,
  approveSubmission,
  circleWifeIds,
  createEmptyState,
  createSubmission,
  feedForUser,
  inviteBoyfriend,
  redeemPrize,
  removePartner,
  shareRedemption,
  shareSubmission,
  signupWife,
  loginOrCreateFromIdentity,
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

describe('demo seeding via signup', () => {
  it('auto-connects a new wife to seeded demo wives', () => {
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
    expect(realWife.friendIds).toContain(demoWife.id);
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
