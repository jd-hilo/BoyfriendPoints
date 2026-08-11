import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import type { Prize, Suggestion } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Xp } from '../ui';

const SLIDE_MS = 5000;
const TOTAL_STEPS = 6;

type Phase = 'slides' | 'steps';

/** Springs children in with a staggerable delay (fade + rise + settle). */
function Pop({
  delay = 0,
  from = 26,
  children,
  style,
}: {
  delay?: number;
  from?: number;
  children: React.ReactNode;
  style?: object;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.spring(v, {
      toValue: 1,
      delay,
      friction: 7,
      tension: 55,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [from, 0],
              }),
            },
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Slide 1 — a real receipt card springs in. */
function ReceiptDemo() {
  return (
    <Pop>
      <View style={styles.demoReceipt}>
        <View style={styles.demoReceiptBrand}>
          <Text style={{ fontSize: 13 }}>🧾 </Text>
          <Text style={styles.demoReceiptBrandText}>LoveReceipts</Text>
        </View>
        <View style={styles.demoDash} />
        <Text style={styles.demoReceiptEmoji}>🍽️</Text>
        <Text style={styles.demoReceiptTitle}>Did the dishes</Text>
        <Text style={styles.demoReceiptMeta}>FROM Noah · TO Emma</Text>
        <View style={styles.demoDash} />
        <Pop delay={550} from={10}>
          <Xp value={15} sign="+" size={14} />
        </Pop>
      </View>
    </Pop>
  );
}

/** Slide 2 — receipts stack up into a weekly total. */
function PointsDemo() {
  const rows = [
    { emoji: '🍽️', title: 'Did the dishes', pts: 15 },
    { emoji: '🌹', title: 'Surprise flowers', pts: 30 },
    { emoji: '🧺', title: 'Laundry day', pts: 10 },
  ];
  return (
    <View style={styles.demoStack}>
      {rows.map((r, i) => (
        <Pop key={r.title} delay={i * 260}>
          <View style={styles.demoRow}>
            <Text style={styles.demoRowEmoji}>{r.emoji}</Text>
            <Text style={styles.demoRowTitle}>{r.title}</Text>
            <Xp value={r.pts} sign="+" size={12} />
          </View>
        </Pop>
      ))}
      <Pop delay={rows.length * 260 + 250} from={12}>
        <View style={styles.demoTotalRow}>
          <Text style={styles.demoTotalLabel}>This week</Text>
          <Xp value={55} size={16} large />
        </View>
      </Pop>
    </View>
  );
}

/** Slide 3 — the prize shelf, one freshly redeemed. */
function PrizesDemo() {
  const prizes = [
    { emoji: '🎬', title: 'Pick the movie', pts: 50, redeemed: false },
    { emoji: '💆', title: 'Massage night', pts: 120, redeemed: true },
    { emoji: '😴', title: 'Sleep in Saturday', pts: 80, redeemed: false },
  ];
  return (
    <View style={styles.demoStack}>
      {prizes.map((p, i) => (
        <Pop key={p.title} delay={i * 260}>
          <View style={styles.demoRow}>
            <Text style={styles.demoRowEmoji}>{p.emoji}</Text>
            <Text style={styles.demoRowTitle}>{p.title}</Text>
            {p.redeemed ? (
              <Pop delay={prizes.length * 260 + 200} from={6}>
                <View style={styles.demoRedeemed}>
                  <Text style={styles.demoRedeemedText}>Redeemed ✓</Text>
                </View>
              </Pop>
            ) : (
              <Text style={styles.demoRowPts}>{p.pts} pts</Text>
            )}
          </View>
        </Pop>
      ))}
    </View>
  );
}

const SLIDES = [
  {
    title: 'Every favor,\non the record',
    body: 'Did the dishes? Planned date night? It becomes a receipt your partner can see.',
    Demo: ReceiptDemo,
  },
  {
    title: 'Points that\nactually add up',
    body: 'Your partner approves each receipt and the points stack — like Venmo, but for love.',
    Demo: PointsDemo,
  },
  {
    title: 'Cash out for\nreal rewards',
    body: 'Massage night. Pick the movie. Sleep in Saturday. You set the prizes together.',
    Demo: PrizesDemo,
  },
];

export default function OnboardingFlow({ onSignIn }: { onSignIn?: () => void }) {
  const { user, signUpWithPassword, refresh } = useAuth();

  // If the account already exists (wife, not onboarded), resume at partner step.
  const [phase, setPhase] = useState<Phase>(user ? 'steps' : 'slides');
  const [step, setStep] = useState(user ? 3 : 0); // 0=email 1=password 2=name 3=partner 4=prizes 5=friends

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createAccount() {
    setError(null);
    setBusy(true);
    try {
      await signUpWithPassword(name.trim() || email.split('@')[0], email, password);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await api.completeOnboarding();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (phase === 'slides') {
    return (
      <Slideshow
        onDone={() => setPhase('steps')}
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StepHeader
          step={step}
          onBack={
            step > 0 && step < 3
              ? () => setStep((s) => s - 1)
              : step === 0
                ? () => setPhase('slides')
                : undefined
          }
        />

        {step === 0 && (
          <StepShell
            title="What's your email?"
            sub="You'll use this to sign in."
            error={error}
          >
            <TextInput
              style={styles.bigInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#b9b7b3"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              autoFocus
            />
            <PrimaryButton
              label="Continue"
              disabled={!email.includes('@')}
              onPress={() => {
                setError(null);
                setStep(1);
              }}
            />
            {onSignIn && (
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.link} onPress={onSignIn}>
                  Sign in
                </Text>
              </Text>
            )}
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Create a password"
            sub="At least 8 characters."
            error={error}
          >
            <TextInput
              style={styles.bigInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#b9b7b3"
              secureTextEntry
              autoComplete="password-new"
              autoFocus
            />
            <PrimaryButton
              label="Continue"
              disabled={password.length < 8}
              onPress={() => {
                setError(null);
                setStep(2);
              }}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="What should we call you?"
            sub="Your partner and friends will see this."
            error={error}
          >
            <TextInput
              style={styles.bigInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#b9b7b3"
              autoCapitalize="words"
              autoComplete="name"
              autoFocus
            />
            <PrimaryButton
              label={busy ? undefined : 'Create my account'}
              busy={busy}
              disabled={!name.trim() || busy}
              onPress={() => void createAccount()}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepPartner
            onNext={() => {
              setError(null);
              setStep(4);
            }}
            refresh={refresh}
            partnerName={user?.partnerName}
          />
        )}

        {step === 4 && (
          <StepPrizes
            onNext={() => {
              setError(null);
              setStep(5);
            }}
          />
        )}

        {step === 5 && <StepFriends busy={busy} onDone={() => void finish()} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------------- slides */

function Slideshow({
  onDone,
  onSignIn,
}: {
  onDone: () => void;
  onSignIn?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const advance = useCallback(
    (next: number) => {
      if (next >= SLIDES.length) {
        onDone();
        return;
      }
      setIndex(Math.max(0, next));
    },
    [onDone],
  );

  useEffect(() => {
    fill.setValue(0);
    anim.current?.stop();
    anim.current = Animated.timing(fill, {
      toValue: 1,
      duration: SLIDE_MS,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) advance(index + 1);
    });
    return () => anim.current?.stop();
  }, [index, fill, advance]);

  const slide = SLIDES[index];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.slideBars}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={styles.slideBarTrack}>
            {i < index ? (
              <View style={[styles.slideBarFill, { width: '100%' }]} />
            ) : i === index ? (
              <Animated.View
                style={[
                  styles.slideBarFill,
                  {
                    width: fill.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.slideTapRow}>
        <Pressable style={styles.flex} onPress={() => advance(index - 1)} />
        <Pressable style={styles.flex} onPress={() => advance(index + 1)} />
      </View>

      <View style={styles.slideBody} pointerEvents="none">
        <View key={index} style={styles.slideDemo}>
          <slide.Demo />
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideSub}>{slide.body}</Text>
      </View>

      <View style={styles.slideFooter}>
        <PrimaryButton label="Get started" onPress={onDone} />
        {onSignIn && (
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.link} onPress={onSignIn}>
              Sign in
            </Text>
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------- chrome */

function StepHeader({ step, onBack }: { step: number; onBack?: () => void }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepHeaderRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.stepCount}>
          Step {step + 1} of {TOTAL_STEPS}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function StepShell({
  title,
  sub,
  error,
  children,
}: {
  title: string;
  sub?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>{title}</Text>
      {sub ? <Text style={styles.stepSub}>{sub}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.stepForm}>{children}</View>
    </ScrollView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || pressed) && styles.btnMuted,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

function SkipLink({ label = "I'll do this later", onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.skipWrap}>
      <Text style={styles.skipText}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------- account steps */

function StepPartner({
  onNext,
  refresh,
  partnerName,
}: {
  onNext: () => void;
  refresh: () => Promise<void>;
  partnerName?: string;
}) {
  const [pname, setPname] = useState('');
  const [pemail, setPemail] = useState('');
  const [hint, setHint] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invited = Boolean(partnerName || hint);

  async function invite() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.inviteBoyfriend(pname, pemail, 'points');
      setHint(res.loginHint);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title="Invite your partner"
      sub="They earn the points — you approve the receipts. It takes two."
      error={error}
    >
      {invited ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>
            {pname || partnerName} is in 🎉
          </Text>
          {hint && (
            <Text style={styles.successBody}>
              They sign in with <Text style={styles.bold}>{hint.email}</Text> ·
              password <Text style={styles.bold}>{hint.password}</Text>
            </Text>
          )}
        </View>
      ) : (
        <>
          <TextInput
            style={styles.bigInput}
            value={pname}
            onChangeText={setPname}
            placeholder="Partner's name"
            placeholderTextColor="#b9b7b3"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.bigInput}
            value={pemail}
            onChangeText={setPemail}
            placeholder="Partner's email"
            placeholderTextColor="#b9b7b3"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </>
      )}

      {invited ? (
        <PrimaryButton label="Continue" onPress={onNext} />
      ) : (
        <>
          <PrimaryButton
            label={busy ? undefined : 'Send invite'}
            busy={busy}
            disabled={!pname || !pemail.includes('@') || busy}
            onPress={() => void invite()}
          />
          <SkipLink onPress={onNext} />
        </>
      )}
    </StepShell>
  );
}

function StepPrizes({ onNext }: { onNext: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);

  useEffect(() => {
    void api.suggestions().then((s) => setSuggestions(s.prizes)).catch(() => undefined);
    void api.prizes().then(setPrizes).catch(() => undefined);
  }, []);

  async function quickAdd(s: Suggestion) {
    try {
      const prize = await api.addPrize(s.title, s.points, s.emoji);
      setPrizes((p) => [...p, prize]);
    } catch {
      /* duplicate or network — ignore in onboarding */
    }
  }

  const chosen = new Set(prizes.map((p) => p.title));

  return (
    <StepShell
      title="Pick a few prizes"
      sub="What can your partner cash points in for? Tap to add — you can edit later."
    >
      <View style={styles.chipGrid}>
        {suggestions.map((s) => {
          const on = chosen.has(s.title);
          return (
            <Pressable
              key={s.title}
              style={[styles.chip, on && styles.chipOn]}
              disabled={on}
              onPress={() => void quickAdd(s)}
            >
              <Text style={styles.chipEmoji}>{s.emoji}</Text>
              <Text style={[styles.chipTitle, on && styles.chipTitleOn]}>
                {s.title}
              </Text>
              <Text style={styles.chipPts}>
                {on ? 'Added ✓' : `${s.points} pts`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {prizes.length > 0 && (
        <Text style={styles.addedNote}>
          {prizes.length} prize{prizes.length > 1 ? 's' : ''} ready
        </Text>
      )}

      <PrimaryButton
        label={prizes.length > 0 ? 'Continue' : 'Continue without prizes'}
        onPress={onNext}
      />
      {prizes.length === 0 && <SkipLink onPress={onNext} />}
    </StepShell>
  );
}

function StepFriends({
  onDone,
  busy,
}: {
  onDone: () => void;
  busy: boolean;
}) {
  const [fname, setFname] = useState('');
  const [femail, setFemail] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      const friend = await api.addFriend(fname, femail);
      setAdded((a) => [...a, friend.name]);
      setFname('');
      setFemail('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <StepShell
      title="Fill your feed"
      sub="Add friends so their household wins show up on your Home feed."
      error={error}
    >
      <TextInput
        style={styles.bigInput}
        value={fname}
        onChangeText={setFname}
        placeholder="Friend's name"
        placeholderTextColor="#b9b7b3"
        autoCapitalize="words"
      />
      <TextInput
        style={styles.bigInput}
        value={femail}
        onChangeText={setFemail}
        placeholder="Friend's email"
        placeholderTextColor="#b9b7b3"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Pressable
        style={({ pressed }) => [
          styles.secondaryBtn,
          (!femail.includes('@') || pressed) && styles.btnMuted,
        ]}
        onPress={() => void add()}
        disabled={!femail.includes('@')}
      >
        <Text style={styles.secondaryBtnText}>Add friend</Text>
      </Pressable>

      {added.length > 0 && (
        <Text style={styles.addedNote}>
          {added.join(', ')} added ✓
        </Text>
      )}

      <PrimaryButton
        label={busy ? undefined : 'Enter LoveReceipts'}
        busy={busy}
        disabled={busy}
        onPress={onDone}
      />
      {added.length === 0 && !busy && (
        <SkipLink label="Skip for now" onPress={onDone} />
      )}
    </StepShell>
  );
}

/* ------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },

  /* slides */
  slideBars: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  slideBarTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ececea',
    overflow: 'hidden',
  },
  slideBarFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.black,
  },
  slideTapRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  slideBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 2,
  },
  slideDemo: {
    minHeight: 230,
    justifyContent: 'flex-end',
    marginBottom: 30,
  },
  demoReceipt: {
    alignSelf: 'flex-start',
    minWidth: 220,
    backgroundColor: '#fffcf7',
    borderWidth: 1,
    borderColor: '#ebe4d8',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 7,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  demoReceiptBrand: { flexDirection: 'row', alignItems: 'center' },
  demoReceiptBrandText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  demoDash: {
    width: '100%',
    borderTopWidth: 1.5,
    borderColor: '#d5d0c6',
    borderStyle: 'dashed',
    marginVertical: 3,
  },
  demoReceiptEmoji: { fontSize: 30 },
  demoReceiptTitle: { fontWeight: '700', fontSize: 16, color: colors.ink },
  demoReceiptMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.inkMuted,
  },
  demoStack: { gap: 10, alignSelf: 'stretch' },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9e9e7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  demoRowEmoji: { fontSize: 22 },
  demoRowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  demoRowPts: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  demoTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  demoTotalLabel: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  demoRedeemed: {
    backgroundColor: '#eaf3ee',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  demoRedeemedText: { fontSize: 12, fontWeight: '700', color: colors.green },
  slideTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.black,
    marginBottom: 14,
  },
  slideSub: {
    fontSize: 16,
    lineHeight: 24,
    color: '#787774',
  },
  slideFooter: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    gap: 4,
    zIndex: 2,
  },

  /* step chrome */
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: { fontSize: 20, color: colors.black, width: 24 },
  stepCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9b9a97',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ececea',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.black,
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.black,
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 15,
    lineHeight: 22,
    color: '#787774',
    marginBottom: 28,
  },
  stepForm: { gap: 14 },

  bigInput: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: '#ffffff',
    color: colors.black,
  },
  primaryBtn: {
    marginTop: 6,
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryBtnText: { color: colors.black, fontWeight: '600', fontSize: 15 },
  btnMuted: { opacity: 0.45 },

  switchText: {
    marginTop: 16,
    fontSize: 14,
    color: '#787774',
    textAlign: 'center',
  },
  link: {
    color: colors.black,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  skipWrap: { alignItems: 'center', marginTop: 8 },
  skipText: { fontSize: 14, color: '#9b9a97', fontWeight: '500' },
  error: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },

  /* partner success */
  successCard: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    padding: 18,
    backgroundColor: '#f7f6f3',
    gap: 6,
  },
  successTitle: { fontSize: 16, fontWeight: '600', color: colors.black },
  successBody: { fontSize: 13, lineHeight: 19, color: '#787774' },
  bold: { fontWeight: '600', color: colors.black },

  /* prizes */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '47.5%',
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    padding: 14,
    backgroundColor: '#ffffff',
    gap: 3,
  },
  chipOn: {
    backgroundColor: '#f7f6f3',
    borderColor: '#d3d1cb',
  },
  chipEmoji: { fontSize: 22, marginBottom: 2 },
  chipTitle: { fontSize: 13, fontWeight: '600', color: colors.black },
  chipTitleOn: { color: '#787774' },
  chipPts: { fontSize: 12, color: '#9b9a97', fontWeight: '500' },
  addedNote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
    textAlign: 'center',
  },
});
