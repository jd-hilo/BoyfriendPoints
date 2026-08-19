import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublicUser } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Avatar, Xp } from '../ui';
import {
  PrimaryButton,
  SkipLink,
  StepHeader,
  StepShell,
  stepStyles,
} from '../stepChrome';

type Step = 'email' | 'password' | 'reset-code' | 'new-password';

export default function AuthScreen({
  onCreateAccount,
}: {
  onCreateAccount?: () => void;
}) {
  const { enterAs, signInWithPassword } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [personas, setPersonas] = useState<PublicUser[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api
      .personas()
      .then(setPersonas)
      .catch(() => undefined);
  }, []);

  function goToPassword() {
    if (!email.includes('@')) return;
    setError(null);
    setStep('password');
  }

  function backToEmail() {
    setError(null);
    setPassword('');
    setOtp('');
    setStep('email');
  }

  function backFromReset() {
    setError(null);
    setOtp('');
    setPassword('');
    setStep(step === 'new-password' ? 'reset-code' : 'password');
  }

  async function sendResetCode() {
    setError(null);
    setBusy('reset');
    try {
      await api.forgotPassword(email);
      setOtp('');
      setPassword('');
      setStep('reset-code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setError(null);
    setBusy('signin');
    try {
      await signInWithPassword(email, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function onReset() {
    setError(null);
    setBusy('reset');
    try {
      await api.resetPassword(email, otp, password);
      await signInWithPassword(email, password);
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

  return (
    <SafeAreaView style={stepStyles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={stepStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StepHeader
          step={step === 'email' || step === 'reset-code' ? 0 : 1}
          totalSteps={2}
          onBack={
            step === 'password'
              ? backToEmail
              : step === 'reset-code' || step === 'new-password'
                ? backFromReset
                : undefined
          }
        />

        {step === 'email' ? (
          <StepShell
            title="What's your email?"
            sub="You'll use this to sign in."
            error={error}
          >
            <TextInput
              style={stepStyles.bigInput}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              placeholder="you@email.com"
              placeholderTextColor="#b9b7b3"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={goToPassword}
            />
            <PrimaryButton
              label="Continue"
              disabled={!email.includes('@') || !!busy}
              onPress={goToPassword}
            />
            {onCreateAccount ? (
              <Text style={stepStyles.switchText}>
                New here?{' '}
                <Text style={stepStyles.link} onPress={onCreateAccount}>
                  Create an account
                </Text>
              </Text>
            ) : null}
            <SkipLink
              label={showDemo ? 'Hide demo' : 'Try the demo'}
              onPress={() => setShowDemo((v) => !v)}
            />
            {showDemo ? (
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
                {community.length > 0 ? (
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
                ) : null}
              </View>
            ) : null}
          </StepShell>
        ) : step === 'password' ? (
          <StepShell
            title="Enter your password"
            sub={email.trim()}
            error={error}
          >
            <TextInput
              style={stepStyles.bigInput}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor="#b9b7b3"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => {
                if (password.length >= 8 && !busy) void onSubmit();
              }}
            />
            <PrimaryButton
              label={busy === 'signin' ? undefined : 'Sign in'}
              busy={busy === 'signin'}
              disabled={password.length < 8 || !!busy}
              onPress={() => void onSubmit()}
            />
            <Pressable
              onPress={() => void sendResetCode()}
              disabled={!!busy}
              hitSlop={8}
              style={stepStyles.skipWrap}
            >
              <Text style={stepStyles.link}>
                {busy === 'reset' ? 'Sending code…' : 'Forgot password?'}
              </Text>
            </Pressable>
          </StepShell>
        ) : step === 'reset-code' ? (
          <StepShell
            title="Enter the code we emailed"
            sub={email.trim()}
            error={error}
          >
            <TextInput
              style={[stepStyles.bigInput, styles.otpInput]}
              value={otp}
              onChangeText={(t) => {
                setOtp(t.replace(/\D/g, '').slice(0, 6));
                if (error) setError(null);
              }}
              placeholder="123456"
              placeholderTextColor="#b9b7b3"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => {
                if (otp.length >= 4) setStep('new-password');
              }}
            />
            <PrimaryButton
              label="Continue"
              disabled={otp.length < 4 || !!busy}
              onPress={() => {
                setError(null);
                setPassword('');
                setStep('new-password');
              }}
            />
            <Pressable
              onPress={() => void sendResetCode()}
              disabled={!!busy}
              hitSlop={8}
              style={stepStyles.skipWrap}
            >
              <Text style={stepStyles.link}>
                {busy === 'reset' ? 'Sending…' : 'Resend code'}
              </Text>
            </Pressable>
          </StepShell>
        ) : (
          <StepShell
            title="Choose a new password"
            sub={email.trim()}
            error={error}
          >
            <TextInput
              style={stepStyles.bigInput}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              placeholderTextColor="#b9b7b3"
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => {
                if (password.length >= 8 && !busy) void onReset();
              }}
            />
            <PrimaryButton
              label={busy === 'reset' ? undefined : 'Reset password'}
              busy={busy === 'reset'}
              disabled={password.length < 8 || !!busy}
              onPress={() => void onReset()}
            />
          </StepShell>
        )}
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
        busy && stepStyles.btnMuted,
      ]}
      onPress={onPick}
      disabled={!!busy}
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
  otpInput: {
    letterSpacing: 6,
    textAlign: 'center',
  },
  demoBlock: {
    marginTop: 12,
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
    borderRadius: 14,
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
