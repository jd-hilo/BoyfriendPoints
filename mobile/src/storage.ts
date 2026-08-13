import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from './types';

const TOKEN_KEY = 'bp_token';
const USER_KEY = 'bp_user';

/** Sync memory cache so API calls never race AsyncStorage after signup. */
let memoryToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (memoryToken !== undefined) return memoryToken;
  try {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
    return memoryToken;
  } catch {
    return null;
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

function coachKey(userId: string): string {
  return `lr_coach_${userId}`;
}

export async function getCoachSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(coachKey(userId))) === '1';
  } catch {
    return false;
  }
}

export async function setCoachSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(coachKey(userId), '1');
  } catch {
    /* ignore */
  }
}
