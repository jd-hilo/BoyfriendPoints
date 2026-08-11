import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'bp_token';

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
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
