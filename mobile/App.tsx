import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogErrorBoundary, PostHogProvider } from 'posthog-react-native';
import { AuthProvider, useAuth } from './src/auth';
import { api } from './src/api';
import { posthog } from './src/posthog';
import { getToken } from './src/storage';
import { colors } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingFlow from './src/screens/OnboardingFlow';
import MainApp, { type Tab } from './src/screens/MainApp';

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
  const [shot, setShot] = useState<{
    tab?: Tab;
    react?: boolean;
    receipt?: boolean;
  }>({});

  useEffect(() => {
    async function apply(url: string | null) {
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
      setShot({ tab: parsed.tab, react: parsed.react, receipt: parsed.receipt });
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

  // Signed-out sign-in screen (separate from create-account onboarding).
  if (!user && showSignIn) {
    return <AuthScreen onCreateAccount={() => setShowSignIn(false)} />;
  }

  // Keep ONE OnboardingFlow instance across signup so the session isn't
  // remounted away right after email/password creates the account.
  if (!user || !user.onboarded) {
    return (
      <OnboardingFlow
        onSignIn={!user ? () => setShowSignIn(true) : undefined}
      />
    );
  }

  return (
    <MainApp
      key={`${user.id}-${shot.tab ?? 'default'}-${shot.react ? 'r' : ''}-${shot.receipt ? 'p' : ''}`}
      initialTab={shot.tab}
      openFirstReact={shot.react}
      openReceipt={shot.receipt}
    />
  );
}

export default function App() {
  return (
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
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gem: { fontSize: 40, marginBottom: 8 },
  wordmark: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: -0.8,
  },
});
