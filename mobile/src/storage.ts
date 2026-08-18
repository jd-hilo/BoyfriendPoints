import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from './types';

const TOKEN_KEY = 'bp_token';
const USER_KEY = 'bp_user';
const SESSION_KEY = 'lovereceipts_session_v1';

interface StoredSession {
  token: string | null;
  user: PublicUser | null;
}

/** Sync memory cache so API calls never race AsyncStorage after signup. */
let memoryToken: string | null | undefined;
let memoryUser: PublicUser | null | undefined;

/**
 * AsyncStorage 3.x replaced `multiSet`/`multiRemove` with `setMany`/`removeMany`.
 * Older installs only have the legacy pair, so probe before falling back to
 * per-key writes — a missing method used to throw and silently drop the session.
 */
interface LegacyMultiStorage {
  multiSet?: (entries: [string, string][]) => Promise<void>;
  multiRemove?: (keys: string[]) => Promise<void>;
}

async function writeMany(entries: Record<string, string>): Promise<void> {
  if (typeof AsyncStorage.setMany === 'function') {
    await AsyncStorage.setMany(entries);
    return;
  }
  const legacy = AsyncStorage as unknown as LegacyMultiStorage;
  if (typeof legacy.multiSet === 'function') {
    await legacy.multiSet(Object.entries(entries));
    return;
  }
  await Promise.all(
    Object.entries(entries).map(([key, value]) => AsyncStorage.setItem(key, value)),
  );
}

async function clearMany(keys: string[]): Promise<void> {
  if (typeof AsyncStorage.removeMany === 'function') {
    await AsyncStorage.removeMany(keys);
    return;
  }
  const legacy = AsyncStorage as unknown as LegacyMultiStorage;
  if (typeof legacy.multiRemove === 'function') {
    await legacy.multiRemove(keys);
    return;
  }
  await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
}

async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return {
      token: typeof parsed.token === 'string' ? parsed.token : null,
      user: parsed.user && typeof parsed.user === 'object'
        ? (parsed.user as PublicUser)
        : null,
    };
  } catch {
    return null;
  }
}

async function readStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  // Only trust a positive memory hit. Fast Refresh / a native-module blip
  // can leave `null` in memory while AsyncStorage still has the session.
  if (memoryToken) return memoryToken;
  const session = await readStoredSession();
  let stored = session?.token ?? await readStoredToken();
  if (!stored) {
    await new Promise((r) => setTimeout(r, 80));
    const retrySession = await readStoredSession();
    stored = retrySession?.token ?? await readStoredToken();
  }
  if (stored) memoryToken = stored;
  return stored ?? memoryToken ?? null;
}

export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (token) {
      const session = await readStoredSession();
      const user = memoryUser ?? session?.user ?? await getLegacyCachedUser();
      await writeMany({
        [TOKEN_KEY]: token,
        [SESSION_KEY]: JSON.stringify({ token, user }),
      });
    }
    else {
      await clearMany([TOKEN_KEY, USER_KEY, SESSION_KEY]);
      memoryUser = null;
    }
  } catch {
    /* memory still holds the session for this JS runtime */
  }
}

/** Cache the last known user so incomplete onboarding survives API blips. */
async function getLegacyCachedUser(): Promise<PublicUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

export async function getCachedUser(): Promise<PublicUser | null> {
  if (memoryUser) return memoryUser;
  const session = await readStoredSession();
  const user = session?.user ?? await getLegacyCachedUser();
  if (user) memoryUser = user;
  return user;
}

export async function setCachedUser(user: PublicUser | null): Promise<void> {
  memoryUser = user;
  try {
    if (user) {
      const session = await readStoredSession();
      const token = memoryToken ?? session?.token ?? await readStoredToken();
      await writeMany({
        [USER_KEY]: JSON.stringify(user),
        [SESSION_KEY]: JSON.stringify({ token, user }),
      });
    } else {
      await AsyncStorage.removeItem(USER_KEY);
      const session = await readStoredSession();
      if (session?.token) {
        await AsyncStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ token: session.token, user: null }),
        );
      } else {
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Persist credentials and user together so reload cannot observe half a session. */
export async function setSession(
  token: string,
  user: PublicUser,
): Promise<void> {
  memoryToken = token;
  memoryUser = user;
  const encodedUser = JSON.stringify(user);
  try {
    await writeMany({
      [TOKEN_KEY]: token,
      [USER_KEY]: encodedUser,
      [SESSION_KEY]: JSON.stringify({ token, user }),
    });
  } catch (err) {
    // Memory still holds the session for this JS runtime, but the next reload
    // will look logged out — make that loud instead of silent.
    console.warn('Failed to persist session', err);
  }
}

function notifSeenKey(userId: string): string {
  return `lr_notif_seen_${userId}`;
}

export async function getSeenNotificationIds(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(notifSeenKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function setSeenNotificationIds(
  userId: string,
  ids: string[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(notifSeenKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function approvalSeenKey(userId: string): string {
  return `lr_approval_seen_${userId}`;
}

/** null means this device has never checked — seed without replaying history. */
export async function getSeenApprovals(userId: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(approvalSeenKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return null;
  }
}

export async function setSeenApprovals(userId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(approvalSeenKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function pushOptInKey(userId: string): string {
  return `lr_push_opt_in_${userId}`;
}

function pushPromptedKey(userId: string): string {
  return `lr_push_prompted_${userId}`;
}

export async function getPushOptIn(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(pushOptInKey(userId))) === '1';
  } catch {
    return false;
  }
}

export async function setPushOptIn(userId: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(pushOptInKey(userId), '1');
    else await AsyncStorage.removeItem(pushOptInKey(userId));
  } catch {
    /* ignore */
  }
}

export async function getPushPrompted(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(pushPromptedKey(userId))) === '1';
  } catch {
    return false;
  }
}

export async function setPushPrompted(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(pushPromptedKey(userId), '1');
  } catch {
    /* ignore */
  }
}
