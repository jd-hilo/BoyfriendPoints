import type { Boyfriend, PointEvent } from '../shared/types.ts';

export interface AppState {
  boyfriends: Boyfriend[];
  events: PointEvent[];
}

export function createEmptyState(): AppState {
  return { boyfriends: [], events: [] };
}

function makeId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function addBoyfriend(state: AppState, name: string): Boyfriend {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name is required');
  }
  const exists = state.boyfriends.some(
    (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) {
    throw new Error(`"${trimmed}" already exists`);
  }
  const boyfriend: Boyfriend = {
    id: makeId(),
    name: trimmed,
    points: 0,
    createdAt: new Date().toISOString(),
  };
  state.boyfriends.push(boyfriend);
  return boyfriend;
}

export function awardPoints(
  state: AppState,
  boyfriendId: string,
  delta: number,
  reason: string,
): { boyfriend: Boyfriend; event: PointEvent } {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Point change must be a non-zero number');
  }
  const boyfriend = state.boyfriends.find((b) => b.id === boyfriendId);
  if (!boyfriend) {
    throw new Error('Boyfriend not found');
  }
  boyfriend.points += Math.trunc(delta);
  const event: PointEvent = {
    id: makeId(),
    boyfriendId,
    delta: Math.trunc(delta),
    reason: reason.trim() || (delta > 0 ? 'Good deed' : 'Oops'),
    createdAt: new Date().toISOString(),
  };
  state.events.push(event);
  return { boyfriend, event };
}

export function removeBoyfriend(state: AppState, boyfriendId: string): boolean {
  const before = state.boyfriends.length;
  state.boyfriends = state.boyfriends.filter((b) => b.id !== boyfriendId);
  state.events = state.events.filter((e) => e.boyfriendId !== boyfriendId);
  return state.boyfriends.length < before;
}

export function historyFor(state: AppState, boyfriendId: string): PointEvent[] {
  return state.events
    .filter((e) => e.boyfriendId === boyfriendId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function leaderboard(state: AppState): Boyfriend[] {
  return [...state.boyfriends].sort((a, b) => b.points - a.points);
}
