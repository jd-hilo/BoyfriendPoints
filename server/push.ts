import type { User } from '../shared/types.ts';
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
