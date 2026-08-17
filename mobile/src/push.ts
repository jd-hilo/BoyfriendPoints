import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');

    Notifications.default.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const existing = await Notifications.default.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.default.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return;

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
        ?.projectId;
    const token = await Notifications.default.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (token.data) await api.setPushToken(token.data);
  } catch {
    /* Expo Go / simulator / missing native module — skip */
  }
}
