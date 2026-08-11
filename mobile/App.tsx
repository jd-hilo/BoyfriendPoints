import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingFlow from './src/screens/OnboardingFlow';
import MainApp from './src/screens/MainApp';

function Router() {
  const { user, loading } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.gem}>🧾</Text>
        <Text style={styles.wordmark}>LoveReceipts</Text>
        <ActivityIndicator color={colors.black} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!user) {
    return showSignIn ? (
      <AuthScreen onCreateAccount={() => setShowSignIn(false)} />
    ) : (
      <OnboardingFlow onSignIn={() => setShowSignIn(true)} />
    );
  }
  if (user.role === 'wife' && !user.onboarded) return <OnboardingFlow />;
  return <MainApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Router />
      </AuthProvider>
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
