import type { Boyfriend, PointEvent } from '../shared/types.ts';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function listBoyfriends(): Promise<Boyfriend[]> {
  return fetch('/api/boyfriends').then((r) => handle<Boyfriend[]>(r));
}

export function createBoyfriend(name: string): Promise<Boyfriend> {
  return fetch('/api/boyfriends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((r) => handle<Boyfriend>(r));
}

export function awardPoints(
  id: string,
  delta: number,
  reason: string,
): Promise<{ boyfriend: Boyfriend; event: PointEvent }> {
  return fetch(`/api/boyfriends/${id}/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta, reason }),
  }).then((r) => handle(r));
}

export function getHistory(id: string): Promise<PointEvent[]> {
  return fetch(`/api/boyfriends/${id}/history`).then((r) =>
    handle<PointEvent[]>(r),
  );
}

export function deleteBoyfriend(id: string): Promise<void> {
  return fetch(`/api/boyfriends/${id}`, { method: 'DELETE' }).then((r) =>
    handle<void>(r),
  );
}
