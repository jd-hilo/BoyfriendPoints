import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublicUser } from '../types';
import { api } from '../api';
import { isAppleSignInAvailable, signInWithApple } from '../appleAuth';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Avatar, Xp, ReceiptIcon } from '../ui';

type Mode = 'signin' | 'signup';

export default function AuthScreen({
  onCreateAccount,
}: {
  onCreateAccount?: () => void;
}) {
  const { enterAs, signInWithPassword, signUpWithPassword, signInWithAppleToken } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personas, setPersonas] = useState<PublicUser[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    void api
      .personas()
      .then(setPersonas)
      .catch(() => undefined);
    void isAppleSignInAvailable().then(setAppleReady);
  }, []);

  async function onSubmit() {
    setError(null);
    setBusy('email');
    try {
      if (mode === 'signup') {
        await signUpWithPassword(
          name.trim() || email.split('@')[0],
          email,
          password,
        );
      } else {
        await signInWithPassword(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function onApple() {
    setError(null);
    setBusy('apple');
    try {
      const { idToken, name: appleName } = await signInWithApple();
      await signInWithAppleToken(idToken, appleName);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function pick(id: string) {
    setError(null);
    setBusy(id);
    try {
      await enterAs(id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const household = personas.filter((p) => !p.demo);
  const community = personas.filter((p) => p.demo);
  const canSubmit = email.length > 0 && password.length >= 8 && !busy;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.hero}>
              <View style={styles.brandLockup}>
                <ReceiptIcon size={30} />
                <Text style={styles.wordmark}>LoveReceipts</Text>
              </View>
              <Text style={styles.tag}>
                {mode === 'signup'
                  ? 'Create your household account'
                  : 'Sign in to your household'}
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.form}>
              {mode === 'signup' && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.inkMuted}
                    autoComplete="name"
                    autoCapitalize="words"
                  />
                </View>
              )}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.inkMuted}
                  autoComplete="email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.inkMuted}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'password-new' : 'password'}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!canSubmit || pressed) && styles.btnMuted,
                ]}
                onPress={() => void onSubmit()}
                disabled={!canSubmit}
              >
                {busy === 'email' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === 'signup' ? 'Continue' : 'Sign in'}
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.appleBtn,
                (!!busy || !appleReady || pressed) && styles.btnMuted,
              ]}
              onPress={() => void onApple()}
              disabled={!!busy || !appleReady}
            >
              {busy === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.appleBtnText}>
                  {appleReady ? 'Continue with Apple' : 'Apple Sign In unavailable'}
                </Text>
              )}
            </Pressable>

            <Text style={styles.switchText}>
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <Text style={styles.link} onPress={() => setMode('signin')}>
                    Sign in
                  </Text>
                </>
              ) : (
                <>
                  New here?{' '}
                  <Text
                    style={styles.link}
                    onPress={() =>
                      onCreateAccount ? onCreateAccount() : setMode('signup')
                    }
                  >
                    Create an account
                  </Text>
                </>
              )}
            </Text>

            <Pressable
              onPress={() => setShowDemo((v) => !v)}
              hitSlop={8}
              style={styles.demoToggleWrap}
            >
              <Text style={styles.demoToggle}>
                {showDemo ? 'Hide demo' : 'Try the demo'}
              </Text>
            </Pressable>

            {showDemo && (
              <View style={styles.demoBlock}>
                <Text style={styles.sectionLabel}>This household</Text>
                <View style={styles.personaList}>
                  {household.map((p) => (
                    <PersonaCard
                      key={p.id}
                      persona={p}
                      busy={busy === p.id}
                      onPick={() => pick(p.id)}
                    />
                  ))}
                </View>

                {community.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                      Community
                    </Text>
                    <View style={styles.personaList}>
                      {community.map((p) => (
                        <PersonaCard
                          key={p.id}
                          persona={p}
                          busy={busy === p.id}
                          onPick={() => pick(p.id)}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PersonaCard({
  persona,
  busy,
  onPick,
}: {
  persona: PublicUser;
  busy: boolean;
  onPick: () => void;
}) {
  const subtitle =
    persona.role === 'wife'
      ? persona.partnerName
        ? `Partner of ${persona.partnerName}`
        : 'Household manager'
      : persona.partnerName
        ? `With ${persona.partnerName}`
        : 'Partner';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.persona,
        pressed && !busy && styles.personaPressed,
        busy && styles.btnMuted,
      ]}
      onPress={onPick}
      disabled={busy}
    >
      <Avatar
        name={persona.name}
        color={persona.color}
        src={persona.avatarUrl}
        size={40}
      />
      <View style={styles.personaCopy}>
        <Text style={styles.personaName}>{persona.name}</Text>
        <Text style={styles.personaSub}>{subtitle}</Text>
      </View>
      {persona.role !== 'wife' && <Xp value={persona.points} size={11} />}
      <Text style={styles.personaGo}>{busy ? '…' : '→'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: -0.8,
    // SF Pro on iOS / Roboto on Android — system default
    fontFamily: Platform.select({ ios: 'System', default: undefined }),
  },
  tag: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#787774',
    textAlign: 'center',
    fontWeight: '400',
  },
  error: {
    color: colors.red,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#37352f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#ffffff',
    color: colors.black,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  btnMuted: {
    opacity: 0.45,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e3e2e0',
  },
  dividerText: {
    color: '#9b9a97',
    fontSize: 12,
    fontWeight: '500',
  },
  appleBtn: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  appleBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  switchText: {
    marginTop: 22,
    fontSize: 14,
    color: '#787774',
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    color: colors.black,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  demoToggleWrap: {
    marginTop: 18,
    alignItems: 'center',
  },
  demoToggle: {
    fontSize: 13,
    color: '#9b9a97',
    fontWeight: '500',
  },
  demoBlock: {
    marginTop: 28,
    width: '100%',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b9a97',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  personaList: {
    gap: 8,
  },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e3e2e0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  personaPressed: {
    backgroundColor: '#f7f6f3',
  },
  personaCopy: {
    flex: 1,
    gap: 2,
  },
  personaName: {
    fontWeight: '600',
    fontSize: 15,
    color: colors.black,
  },
  personaSub: {
    fontSize: 13,
    color: '#787774',
  },
  personaGo: {
    color: '#9b9a97',
    fontSize: 18,
    fontWeight: '500',
  },
});
