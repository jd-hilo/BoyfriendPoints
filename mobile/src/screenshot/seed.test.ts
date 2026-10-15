import { describe, expect, it } from 'vitest';
import {
  createScreenshotState,
  feedViews,
  notificationsFor,
  publicUser,
  userByPersona,
} from './seed';

describe('screenshot seed', () => {
  const state = createScreenshotState();
  const emma = userByPersona(state, 'emma')!;
  const noah = userByPersona(state, 'noah')!;

  it('seeds Emma with pending requests and a redemption alert', () => {
    expect(emma.role).toBe('wife');
    const pending = state.submissions.filter(
      (s) => s.wifeId === emma.id && s.status === 'pending',
    );
    expect(pending.map((s) => s.title)).toEqual([
      'Fixed the leaky sink',
      'Washed & vacuumed the car',
    ]);
    expect(
      state.redemptions.some(
        (r) =>
          r.wifeId === emma.id &&
          r.status === 'pending' &&
          r.prizeTitle === 'Breakfast in bed',
      ),
    ).toBe(true);
  });

  it('seeds Noah with 240 points and redeemable prizes', () => {
    expect(noah.role).toBe('boyfriend');
    expect(noah.points).toBe(240);
    expect(noah.partnerId).toBe(emma.id);
    const prizes = state.prizes.filter((p) => p.wifeId === emma.id);
    expect(prizes.length).toBeGreaterThanOrEqual(3);
    expect(prizes.some((p) => p.cost <= 240)).toBe(true);
  });

  it('fills the social feed with other couples', () => {
    const feed = feedViews(state, noah);
    expect(feed.length).toBeGreaterThan(6);
    expect(feed.some((e) => e.boyfriendName === 'Jake')).toBe(true);
    expect(feed.some((e) => e.boyfriendName === 'Dev')).toBe(true);
    expect(publicUser(state, noah).partnerName).toBe('Emma');
  });

  it('builds Emma notifications for requests and redemptions', () => {
    const notes = notificationsFor(state, emma);
    expect(notes.some((n) => n.kind === 'request')).toBe(true);
    expect(notes.some((n) => n.kind === 'redeem')).toBe(true);
  });
});
