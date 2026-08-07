import { describe, expect, it } from 'vitest';
import {
  addBoyfriend,
  awardPoints,
  createEmptyState,
  leaderboard,
  removeBoyfriend,
} from './points.ts';

describe('points logic', () => {
  it('adds a boyfriend starting at 0 points', () => {
    const state = createEmptyState();
    const bf = addBoyfriend(state, '  Alex  ');
    expect(bf.name).toBe('Alex');
    expect(bf.points).toBe(0);
    expect(state.boyfriends).toHaveLength(1);
  });

  it('rejects blank and duplicate names', () => {
    const state = createEmptyState();
    addBoyfriend(state, 'Sam');
    expect(() => addBoyfriend(state, '   ')).toThrow(/required/i);
    expect(() => addBoyfriend(state, 'sam')).toThrow(/already exists/i);
  });

  it('awards and deducts points, recording history', () => {
    const state = createEmptyState();
    const bf = addBoyfriend(state, 'Jordan');
    awardPoints(state, bf.id, 10, 'Did the dishes');
    awardPoints(state, bf.id, -3, 'Forgot anniversary');
    expect(bf.points).toBe(7);
    expect(state.events).toHaveLength(2);
  });

  it('rejects zero point changes and unknown boyfriends', () => {
    const state = createEmptyState();
    const bf = addBoyfriend(state, 'Casey');
    expect(() => awardPoints(state, bf.id, 0, '')).toThrow(/non-zero/i);
    expect(() => awardPoints(state, 'nope', 5, '')).toThrow(/not found/i);
  });

  it('sorts the leaderboard by points descending', () => {
    const state = createEmptyState();
    const a = addBoyfriend(state, 'A');
    const b = addBoyfriend(state, 'B');
    awardPoints(state, a.id, 5, '');
    awardPoints(state, b.id, 20, '');
    expect(leaderboard(state).map((x) => x.name)).toEqual(['B', 'A']);
  });

  it('removes a boyfriend and their events', () => {
    const state = createEmptyState();
    const bf = addBoyfriend(state, 'Riley');
    awardPoints(state, bf.id, 4, 'coffee');
    expect(removeBoyfriend(state, bf.id)).toBe(true);
    expect(state.boyfriends).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });
});
