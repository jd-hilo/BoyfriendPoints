import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

const apiKey =
  process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
  (Constants.expoConfig?.extra?.posthogProjectToken as string | undefined)?.trim();
const host =
  process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ||
  (Constants.expoConfig?.extra?.posthogHost as string | undefined)?.trim() ||
  'https://us.i.posthog.com';

export const posthog = new PostHog(apiKey || 'placeholder_key', {
  host,
  disabled: !apiKey,
  captureAppLifecycleEvents: true,
  // Expo Go has AsyncStorage; skip expo-file-system persistence so we don't
  // pull a native path that isn't needed for product analytics.
  customStorage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  },
  errorTracking: {
    autocapture: {
      uncaughtExceptions: true,
      unhandledRejections: true,
      console: ['error'],
    },
  },
});
