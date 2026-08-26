import type { FeedComment, FeedEvent, User } from '../shared/types.ts';
import type { State } from './domain.ts';

export function userById(state: State, id?: string): User | undefined {
  if (!id) return undefined;
  return state.users.find((user) => user.id === id);
}

/** Best-effort Expo push. Never throws — a missed ping must not fail the API. */
export async function notifyUser(
  user: User | undefined,
  title: string,
  body: string,
): Promise<void> {
  const to = user?.pushToken?.trim();
  if (!to) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        title,
        body,
        sound: 'default',
        channelId: 'default',
      }),
    });
  } catch {
    /* ignore */
  }
}

/** Ping both people on a household post, except the person who just acted. */
export function notifyOwners(
  state: State,
  event: { wifeId: string; boyfriendId: string },
  exceptUserId: string,
  title: string,
  body: string,
): void {
  for (const id of [event.wifeId, event.boyfriendId]) {
    if (!id || id === exceptUserId) continue;
    void notifyUser(userById(state, id), title, body);
  }
}

/** Top-level comments ping the couple. Replies ping the parent author first. */
export function notifyCommentActivity(
  state: State,
  event: Pick<FeedEvent, 'wifeId' | 'boyfriendId'>,
  actor: User,
  comment: FeedComment,
): void {
  const body = `“${comment.text}”`;
  const seen = new Set([actor.id]);
  if (comment.replyToUserId && !seen.has(comment.replyToUserId)) {
    seen.add(comment.replyToUserId);
    void notifyUser(
      userById(state, comment.replyToUserId),
      `${actor.name} replied`,
      body,
    );
  }
  for (const id of [event.wifeId, event.boyfriendId]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    void notifyUser(
      userById(state, id),
      `${actor.name} commented`,
      body,
    );
  }
}
