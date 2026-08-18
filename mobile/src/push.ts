import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';
import {
  getPushOptIn,
  getPushPrompted,
  setPushOptIn,
  setPushPrompted,
} from './storage';

let handlerReady = false;

async function notificationsModule() {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    return Notifications.default;
  } catch {
    return null;
  }
}

export async function configurePushHandler(): Promise<void> {
  if (handlerReady) return;
  const Notifications = await notificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerReady = true;
}

type PermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
};

async function readPermission(): Promise<PermissionSnapshot | null> {
  const Notifications = await notificationsModule();
  if (!Notifications) return null;
  const existing = await Notifications.getPermissionsAsync();
  return {
    granted: existing.granted || existing.status === 'granted',
    canAskAgain: existing.canAskAgain !== false,
  };
}

/** Shows the OS notifications permission sheet when iOS/Android will still present it. */
async function requestPermission(): Promise<PermissionSnapshot | null> {
  const Notifications = await notificationsModule();
  if (!Notifications) return null;
  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return {
    granted: asked.granted || asked.status === 'granted',
    canAskAgain: asked.canAskAgain !== false,
  };
}

async function registerToken(): Promise<boolean> {
  const Notifications = await notificationsModule();
  if (!Notifications) return false;
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (!token.data) return false;
  await api.setPushToken(token.data);
  return true;
}

export async function isPushEnabled(userId: string): Promise<boolean> {
  if (!(await getPushOptIn(userId))) return false;
  const permission = await readPermission();
  return Boolean(permission?.granted);
}

/** Refresh the token if this user already opted in. Never shows a system prompt. */
export async function refreshPushTokenIfEnabled(userId: string): Promise<void> {
  await configurePushHandler();
  if (!(await getPushOptIn(userId))) return;
  const permission = await readPermission();
  if (!permission?.granted) return;
  try {
    await registerToken();
  } catch {
    /* Expo Go / simulator / missing native module — skip */
  }
}

export type PushEnableResult = 'on' | 'denied' | 'blocked' | 'unavailable';

/**
 * Ask for permission (OS sheet if it hasn't been decided), then store the
 * Expo token. Permission success still counts if token registration fails.
 */
export async function enablePushNotifications(
  userId: string,
): Promise<PushEnableResult> {
  await configurePushHandler();
  const Notifications = await notificationsModule();
  if (!Notifications) return 'unavailable';
  try {
    let permission = await readPermission();
    if (!permission) return 'unavailable';

    if (!permission.granted) {
      if (!permission.canAskAgain) return 'blocked';
      permission = (await requestPermission()) ?? permission;
    }

    if (!permission.granted) {
      await setPushOptIn(userId, false);
      return permission.canAskAgain ? 'denied' : 'blocked';
    }

    await setPushOptIn(userId, true);
    await setPushPrompted(userId);
    try {
      await registerToken();
    } catch {
      /* Keep the toggle on — we'll retry the token next launch. */
    }
    return 'on';
  } catch {
    await setPushOptIn(userId, false);
    return 'unavailable';
  }
}

export async function disablePushNotifications(userId: string): Promise<void> {
  await setPushOptIn(userId, false);
  try {
    await api.setPushToken('');
  } catch {
    /* ignore — local opt-out still stands */
  }
}

export async function shouldOfferPushPrompt(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (await getPushPrompted(userId)) return false;
  if (await getPushOptIn(userId)) return false;
  const permission = await readPermission();
  if (permission?.granted) {
    await enablePushNotifications(userId);
    return false;
  }
  return true;
}

export async function dismissPushPrompt(userId: string): Promise<void> {
  await setPushPrompted(userId);
}
