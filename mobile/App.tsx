import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PostHogErrorBoundary, PostHogProvider } from 'posthog-react-native';
import { AuthProvider, useAuth } from './src/auth';
import { api } from './src/api';
import { posthog } from './src/posthog';
import { isScreenshotMode } from './src/screenshot/mode';
import { screenshotRoute } from './src/screenshot/route';
import ScreenshotFrame from './src/screenshot/ScreenshotFrame';
import { getToken } from './src/storage';
import { colors } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingFlow from './src/screens/OnboardingFlow';
import MainApp, { type Tab } from './src/screens/MainApp';
import LinkPartner from './src/screens/LinkPartner';

function parseDemoUrl(url: string | null): {
  name: string;
  tab?: Tab;
  react?: boolean;
  receipt?: boolean;
} | null {
  if (!url || !url.includes('demo')) return null;
  const path = (url.split('--/')[1] ?? url.split('://')[1] ?? '').split('?')[0];
  const segs = path.split('/').filter(Boolean);
  const demoIdx = segs.findIndex((s) => s === 'demo');
  if (demoIdx < 0) return null;
  const name = segs[demoIdx + 1];
  const tab = segs[demoIdx + 2] as Tab | undefined;
  const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qs);
  if (!name) return null;
  return {
    name,
    tab,
    react: params.get('react') === '1',
    receipt: params.get('receipt') === '1',
  };
}

function Router() {
  const { user, loading, enterAs } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [demoShot, setDemoShot] = useState<{
    tab?: Tab;
    react?: boolean;
    receipt?: boolean;
  }>({});
  const marketing = screenshotRoute();

  useEffect(() => {
    async function apply(url: string | null) {
      if (isScreenshotMode()) return;
      const parsed = parseDemoUrl(url);
      if (!parsed) return;
      // A leftover screenshot/demo deep link must not replace a real session
      // on reload.
      if (await getToken()) return;
      const personas = await api.personas();
      const match = personas.find(
        (p) => p.name.toLowerCase() === parsed.name.toLowerCase(),
      );
      if (!match) return;
      await enterAs(match.id);
      // Set tab only after the session exists so Feed/Review don't 401.
      setDemoShot({ tab: parsed.tab, react: parsed.react, receipt: parsed.receipt });
    }
    void Linking.getInitialURL().then(apply);
    const sub = Linking.addEventListener('url', ({ url }) => void apply(url));
    return () => sub.remove();
  }, [enterAs]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.gem}>🧾</Text>
        <Text style={styles.wordmark}>LoveReceipts</Text>
        <ActivityIndicator color={colors.black} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!user && showSignIn) {
    return <AuthScreen onCreateAccount={() => setShowSignIn(false)} />;
  }

  if (marketing?.shot === 'onboarding') {
    return (
      <OnboardingFlow
        onSignIn={!user ? () => setShowSignIn(true) : undefined}
      />
    );
  }

  if (marketing?.shot === 'link' && user) {
    return (
      <SafeAreaView style={styles.linkShot} edges={['top', 'left', 'right']}>
        <LinkPartner />
      </SafeAreaView>
    );
  }

  if (!user || !user.onboarded) {
    return (
      <OnboardingFlow
        onSignIn={!user ? () => setShowSignIn(true) : undefined}
      />
    );
  }

  const tab: Tab | undefined =
    marketing?.shot === 'submit' || marketing?.shot === 'requests'
      ? 'submit'
      : marketing?.shot === 'redeem' || marketing?.shot === 'manage'
        ? 'redeem'
        : marketing?.shot === 'feed'
          ? 'feed'
          : demoShot.tab;

  return (
    <MainApp
      key={`${user.id}-${tab ?? 'default'}-${demoShot.react ? 'r' : ''}-${demoShot.receipt ? 'p' : ''}-${marketing?.shot ?? ''}`}
      initialTab={tab}
      openFirstReact={demoShot.react}
      openReceipt={demoShot.receipt}
      initialNotifications={marketing?.shot === 'notifications'}
      initialProfile={marketing?.shot === 'profile'}
      screenshotPane={
        marketing?.shot === 'requests'
          ? 'requests'
          : marketing?.shot === 'manage'
            ? 'manage'
            : undefined
      }
    />
  );
}

export default function App() {
  const tree = (
    <SafeAreaProvider>
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: false,
          // Touch heatmaps need react-native-svg native views, which Expo Go
          // may not have linked. Screens/lifecycle still capture without it.
          captureTouches: false,
        }}
      >
        <PostHogErrorBoundary>
          <AuthProvider>
            <StatusBar style="dark" />
            <Router />
          </AuthProvider>
        </PostHogErrorBoundary>
      </PostHogProvider>
    </SafeAreaProvider>
  );
  if (isScreenshotMode()) {
    return <ScreenshotFrame>{tree}</ScreenshotFrame>;
  }
  return tree;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#fffcf7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkShot: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14 },
  gem: { fontSize: 40, marginBottom: 8 },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: -0.8,
  },
});
