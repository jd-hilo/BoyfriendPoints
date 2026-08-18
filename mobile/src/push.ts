import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import {
  getPushOptIn,
  getPushPrompted,
  setPushOptIn,
  setPushPrompted,
} from './storage';

let handlerReady = false;

function canUseNotifications(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function configurePushHandler(): Promise<void> {
  if (handlerReady || !canUseNotifications()) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'LoveReceipts',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    handlerReady = true;
  } catch {
    /* native module missing */
  }
}

type PermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
};

function snapshotFrom(
  existing: Notifications.NotificationPermissionsStatus,
): PermissionSnapshot {
  const iosStatus = existing.ios?.status;
  const undetermined =
    existing.status === 'undetermined' ||
    iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED;
  const granted =
    existing.granted ||
    existing.status === 'granted' ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
  return {
    granted,
    // iOS will not show the sheet again after Don't Allow.
    canAskAgain: undetermined || existing.canAskAgain !== false,
  };
}

async function readPermission(): Promise<PermissionSnapshot | null> {
  if (!canUseNotifications()) return null;
  try {
    return snapshotFrom(await Notifications.getPermissionsAsync());
  } catch {
    return null;
  }
}

/** Shows the OS notifications permission sheet when the OS will still present it. */
async function requestPermission(): Promise<PermissionSnapshot | null> {
  if (!canUseNotifications()) return null;
  try {
    return snapshotFrom(
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      }),
    );
  } catch {
    return null;
  }
}

async function registerToken(): Promise<boolean> {
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
  if (!canUseNotifications()) return 'unavailable';
  try {
    let permission = await readPermission();
    if (!permission) return 'unavailable';

    if (!permission.granted) {
      // Always try the OS sheet unless iOS has already recorded Don't Allow.
      if (permission.canAskAgain) {
        permission = (await requestPermission()) ?? permission;
      } else {
        return 'blocked';
      }
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
  if (!canUseNotifications()) return false;
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
