import { eq } from 'drizzle-orm';
import { sessions } from './schema.ts';
import type { Database } from './client.ts';

function newSessionToken(): string {
  return (
    'ses_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12)
  );
}

/** Mint a per-device session token and persist it immediately. */
export async function createSession(
  db: Database,
  userId: string,
): Promise<string> {
  const token = newSessionToken();
  await db.insert(sessions).values({ token, userId });
  return token;
}

/** Remove one device's session. Other devices stay signed in. */
export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function sessionUserId(
  db: Database,
  token: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  return row?.userId;
}
