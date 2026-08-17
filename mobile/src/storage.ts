import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from './types';

const TOKEN_KEY = 'bp_token';
const USER_KEY = 'bp_user';

/** Sync memory cache so API calls never race AsyncStorage after signup. */
let memoryToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  // Only trust a positive memory hit. Fast Refresh can keep `null` around
  // after a blip; always re-read storage in that case so a reload doesn't
  // look signed out.
  if (memoryToken) return memoryToken;
  try {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
    return memoryToken;
  } catch {
    return memoryToken ?? null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    }
  } catch {
    /* memory still holds the session for this JS runtime */
  }
}

/** Cache the last known user so incomplete onboarding survives API blips. */
export async function getCachedUser(): Promise<PublicUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: PublicUser | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
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
