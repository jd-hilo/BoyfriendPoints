import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EarnTask, Prize, Role, Suggestion } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Button, EmojiField, Xp } from '../ui';
import AddCouplesModal from '../AddCouplesModal';
import {
  PrimaryButton,
  SkipLink,
  StepHeader,
  StepShell,
  stepStyles,
} from '../stepChrome';
import { APP_SHARE_URL, partnerWaitingShareMessage } from '../utils';

const SLIDE_MS = 5000;
const TOTAL_STEPS = 8;

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

/**
 * Steps: 0=email 1=password 2=name 3=skipped 4=couple username
 * 5=partner 6=tasks 7=prizes 8=friends.
 */
function resumeStepFor(user: {
  partnerId?: string;
} | null): number {
  if (!user) return 0;
  if (!user.partnerId) return 5;
  return 6;
}

export default function OnboardingFlow({ onSignIn }: { onSignIn?: () => void }) {
  const { user, signUpWithPassword, refresh, applyUser } = useAuth();

  // Resume mid-flow if they already have an account but aren't onboarded.
  const [phase, setPhase] = useState<Phase>(user ? 'steps' : 'slides');
  const [step, setStep] = useState(() => resumeStepFor(user));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role | null>(user?.role ?? 'wife');
  const [name, setName] = useState(user?.name ?? '');
  const [coupleUsername, setCoupleUsername] = useState(
    user?.coupleUsername ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep signed-in incomplete users on setup (never bounce to the slideshow).
  // If this screen mounted before the session hydrated, resume the right step.
  useEffect(() => {
    if (!user || user.onboarded) return;
    setPhase('steps');
    setRole((r) => r ?? user.role);
    setName((n) => n || user.name);
    setCoupleUsername((current) => current || user.coupleUsername || '');
    setStep((current) => (current < 5 ? resumeStepFor(user) : current));
  }, [user]);

  useEffect(() => {
    if (step !== 4 || coupleUsername.length < 3) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      void api
        .coupleUsernameAvailable(coupleUsername)
        .then(({ available }) => {
          if (cancelled || available) return;
          setError('That couple username is already taken');
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [coupleUsername, step]);

  const totalSteps = TOTAL_STEPS;
  const progressStep =
    step <= 2
      ? step
      : step === 4
        ? 3
        : step === 5
          ? 4
          : step === 6
            ? 5
            : step === 7
              ? 6
              : 7;

  async function continueFromEmail() {
    setError(null);
    setBusy(true);
    try {
      const { available } = await api.emailAvailable(email);
      if (!available) {
        setError('That email is already taken');
        return;
      }
      setStep(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Create the account after name + couple username. */
  async function createAccount() {
    setError(null);
    setBusy(true);
    try {
      if (coupleUsername.trim().length >= 3) {
        try {
          const { available } = await api.coupleUsernameAvailable(coupleUsername);
          if (!available) {
            setError('That couple username is already taken');
            setStep(4);
            return;
          }
        } catch {
          // Signup still rejects duplicates if this endpoint is unavailable.
        }
      }
      await signUpWithPassword(
        name.trim(),
        email.trim(),
        password,
        'wife',
        coupleUsername,
      );
      await api.me();
      setStep(5);
    } catch (err) {
      const message = (err as Error).message;
      if (/already taken/i.test(message)) {
        setError(message);
        setStep(/couple username/i.test(message) ? 4 : 0);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const me = await api.completeOnboarding();
      await applyUser(me);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function afterPartner() {
    setError(null);
    setStep(6);
  }

  /** Let people fix a mis-picked role while setup is still reversible. */
  async function changeRole(next: Role) {
    setError(null);
    setBusy(true);
    try {
      const me = await api.setRole(next);
      await applyUser(me);
      setRole(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
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
          step={progressStep}
          totalSteps={totalSteps}
          onBack={
            user
              ? undefined
              : step > 0 && step <= 3
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
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              placeholder="you@email.com"
              placeholderTextColor="#b9b7b3"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              autoFocus
            />
            <PrimaryButton
              label={busy ? undefined : 'Continue'}
              busy={busy}
              disabled={!email.includes('@') || busy}
              onPress={() => void continueFromEmail()}
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
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
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
              label="Continue"
              disabled={!name.trim()}
              onPress={() => {
                setError(null);
                setStep(4);
              }}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="What will you do?"
            sub="Pick your role in the household. You can always invite the other later."
            error={error}
          >
            <RoleCard
              emoji="🎁"
              title="I'll set the prizes"
              body="Approve receipts, invent rewards, and invite your partner with a code."
              selected={role === 'wife'}
              onPress={() => setRole('wife')}
            />
            <RoleCard
              emoji="💪"
              title="I'll redeem points"
              body="Do the tasks, stack points, and cash them in for prizes."
              selected={role === 'boyfriend'}
              onPress={() => setRole('boyfriend')}
            />
            <PrimaryButton
              label={
                busy
                  ? undefined
                  : role === 'wife'
                    ? 'Choose our username'
                    : 'Create account & continue'
              }
              busy={busy}
              disabled={!role || busy}
              onPress={() => {
                if (role === 'wife') {
                  setError(null);
                  setStep(4);
                } else {
                  void createAccount();
                }
              }}
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Choose your couple username"
            sub="Friends will see this when you share your couple profile."
            error={error}
          >
            <View style={styles.usernameInputWrap}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={coupleUsername}
                onChangeText={(value) => {
                  setCoupleUsername(
                    value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24),
                  );
                  if (error) setError(null);
                }}
                placeholder="emmaandnoah"
                placeholderTextColor="#b9b7b3"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={24}
              />
            </View>
            <Text style={styles.usernamePreview}>{APP_SHARE_URL}</Text>
            <PrimaryButton
              label={busy ? undefined : 'Create our couple'}
              busy={busy}
              disabled={
                coupleUsername.length < 3 ||
                busy ||
                /already taken/i.test(error ?? '')
              }
              onPress={() => void createAccount()}
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepInvitePartner
            onNext={afterPartner}
            inviteCode={user?.inviteCode}
            partnerName={user?.partnerName}
            sharerName={user?.name ?? name}
            refresh={refresh}
          />
        )}

        {step === 6 && (
          <StepCatalog
            kind="task"
            onNext={() => {
              setError(null);
              setStep(7);
            }}
          />
        )}

        {step === 7 && (
          <StepCatalog
            kind="prize"
            onNext={() => {
              setError(null);
              setStep(8);
            }}
          />
        )}

        {step === 8 && <StepFriends busy={busy} onDone={() => void finish()} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  emoji,
  title,
  body,
  selected,
  onPress,
}: {
  emoji: string;
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.roleCard, selected && styles.roleCardOn]}
    >
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <View style={styles.roleTextCol}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleBody}>{body}</Text>
      </View>
      <View style={[styles.roleCheck, selected && styles.roleCheckOn]}>
        {selected ? <Text style={styles.roleCheckMark}>✓</Text> : null}
      </View>
    </Pressable>
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

/* -------------------------------------------------------- account steps */

/** Prize-setter shares a household invite code with a big Share CTA. */
function StepInvitePartner({
  onNext,
  inviteCode,
  partnerName,
  sharerName,
  refresh,
}: {
  onNext: () => void;
  inviteCode?: string;
  partnerName?: string;
  sharerName: string;
  refresh: () => Promise<void>;
}) {
  const code = inviteCode ?? '······';
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = Boolean(partnerName);

  async function share() {
    if (!inviteCode) return;
    await Share.share({
      message: partnerWaitingShareMessage(sharerName, inviteCode),
      url: APP_SHARE_URL,
    });
  }

  async function join() {
    setError(null);
    setBusy(true);
    try {
      await api.joinWithCode(joinCode);
      await refresh();
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title="Add your partner"
      sub="Share your code, or enter theirs if they already started a household."
      error={error}
    >
      <Pop>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your household code</Text>
          <Text style={styles.codeValue} selectable>
            {code}
          </Text>
          <Text style={styles.codeHint}>
            They sign up and enter this code to link with you.
          </Text>
        </View>
      </Pop>

      {linked ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>{partnerName} is linked 🎉</Text>
          <Text style={styles.successBody}>
            You're set — keep the code handy if they need to reinstall.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.bigInput, styles.codeInput]}
            value={joinCode}
            onChangeText={(t) =>
              setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            placeholder="Or enter their code"
            placeholderTextColor="#b9b7b3"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <PrimaryButton
            label={busy ? undefined : 'Join with their code'}
            busy={busy}
            disabled={joinCode.trim().length < 4 || busy}
            onPress={() => void join()}
          />
        </>
      )}

      <PrimaryButton
        label="Share invite"
        disabled={!inviteCode}
        onPress={() => void share()}
      />
      {linked ? (
        <PrimaryButton label="Continue" onPress={onNext} />
      ) : (
        <SkipLink label="Continue — I'll share later" onPress={onNext} />
      )}
    </StepShell>
  );
}

/** Redeemer enters the prize-setter's invite code to link the household. */
function StepEnterCode({
  onNext,
  refresh,
  partnerName,
  onSwitchRole,
}: {
  onNext: () => void;
  refresh: () => Promise<void>;
  partnerName?: string;
  onSwitchRole?: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = Boolean(partnerName);

  async function join() {
    setError(null);
    setBusy(true);
    try {
      await api.joinWithCode(code);
      await refresh();
      onNext();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepShell
      title="Enter their code"
      sub="Your partner who sets the prizes shared a 6-character household code with you."
      error={error}
    >
      {linked ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Linked with {partnerName} 🎉</Text>
          <Text style={styles.successBody}>
            You're in the same household — go earn some points.
          </Text>
        </View>
      ) : (
        <TextInput
          style={[styles.bigInput, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="ABC123"
          placeholderTextColor="#b9b7b3"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          autoFocus
        />
      )}

      {linked ? (
        <PrimaryButton label="Continue" onPress={onNext} />
      ) : (
        <>
          <PrimaryButton
            label={busy ? undefined : 'Join household'}
            busy={busy}
            disabled={code.trim().length < 4 || busy}
            onPress={() => void join()}
          />
          <SkipLink label="I don't have a code yet" onPress={onNext} />
          {onSwitchRole && (
            <SkipLink
              label="Actually, I'll set the prizes"
              onPress={onSwitchRole}
            />
          )}
        </>
      )}
    </StepShell>
  );
}

function StepCatalog({
  kind,
  onNext,
}: {
  kind: 'prize' | 'task';
  onNext: () => void;
}) {
  const { user } = useAuth();
  const isPrize = kind === 'prize';
  const noun = isPrize ? 'prize' : 'task';
  const nouns = isPrize ? 'prizes' : 'tasks';
  const defaultEmoji = isPrize ? '🎁' : '⭐';
  const partnerFirst = user?.partnerName?.split(' ')[0] || 'them';

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Titles already saved in the household (e.g. resuming onboarding).
  const [existing, setExisting] = useState<Set<string>>(new Set());
  // Selection is local + instant; items are created in one go on Continue.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<Suggestion[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ emoji: defaultEmoji, title: '', points: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .suggestions()
      .then((s) => setSuggestions(isPrize ? s.prizes : s.tasks))
      .catch(() => undefined);
    const loadExisting = isPrize
      ? api.prizes().then((p: Prize[]) => p.map((x) => x.title))
      : api.tasks().then((t: EarnTask[]) => t.map((x) => x.title));
    void loadExisting
      .then((titles) => setExisting(new Set(titles)))
      .catch(() => undefined);
  }, [isPrize]);

  function resetForm() {
    setForm({ emoji: defaultEmoji, title: '', points: '' });
  }

  function closeModal() {
    setAdding(false);
    resetForm();
  }

  function toggle(title: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  const customPoints = Number(form.points);
  const customValid =
    form.title.trim().length > 0 &&
    Number.isFinite(customPoints) &&
    customPoints > 0;

  function addCustom() {
    if (!customValid) return;
    setCustom((c) => [
      ...c,
      {
        title: form.title.trim(),
        points: Math.round(customPoints),
        emoji: form.emoji || defaultEmoji,
      },
    ]);
    closeModal();
  }

  const picked = [
    ...suggestions.filter((s) => selected.has(s.title)),
    ...custom,
  ].filter((p) => !existing.has(p.title));
  const count = picked.length;

  async function saveAndContinue() {
    if (count === 0) {
      onNext();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Confirm session before writing — never silently 401 on select.
      await api.me();
      for (const p of picked) {
        if (isPrize) await api.addPrize(p.title, p.points, p.emoji);
        else await api.addTask(p.title, p.points, p.emoji);
      }
      onNext();
    } catch (err) {
      const message = (err as Error).message;
      setError(
        /not signed in/i.test(message)
          ? 'Session expired — go back and sign in with your email & password.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <StepShell
      title={isPrize ? 'Pick a few prizes' : 'Pick a few tasks'}
      sub={
        isPrize
          ? 'What can your partner cash points in for? Tap to select — you can edit later.'
          : 'Tasks your partner can submit to earn points when they join. Tap to select — you can edit later.'
      }
      error={error}
    >
      <View style={styles.chipGrid}>
        {suggestions.map((s) => {
          const saved = existing.has(s.title);
          const on = saved || selected.has(s.title);
          return (
            <Pressable
              key={s.title}
              style={[styles.chip, on && styles.chipOn]}
              disabled={saved}
              onPress={() => toggle(s.title)}
            >
              <View style={styles.chipTopRow}>
                <Text style={styles.chipEmoji}>{s.emoji}</Text>
                <View style={[styles.chipCheck, on && styles.chipCheckOn]}>
                  {on ? <Text style={styles.chipCheckMark}>✓</Text> : null}
                </View>
              </View>
              <Text style={styles.chipTitle}>{s.title}</Text>
              <Text style={styles.chipPts}>
                {saved ? 'Added ✓' : `${s.points} pts`}
              </Text>
            </Pressable>
          );
        })}
        {custom.map((p, i) => (
          <Pressable
            key={`${p.title}-${i}`}
            style={[styles.chip, styles.chipOn]}
            onPress={() => setCustom((c) => c.filter((_, j) => j !== i))}
          >
            <View style={styles.chipTopRow}>
              <Text style={styles.chipEmoji}>{p.emoji}</Text>
              <View style={[styles.chipCheck, styles.chipCheckOn]}>
                <Text style={styles.chipCheckMark}>✓</Text>
              </View>
            </View>
            <Text style={styles.chipTitle}>{p.title}</Text>
            <Text style={styles.chipPts}>{p.points} pts · tap to remove</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.customPrizeBtn} onPress={() => setAdding(true)}>
        <Text style={styles.customPrizeText}>＋ Add a custom {noun}</Text>
      </Pressable>

      <PrimaryButton
        label={
          busy
            ? undefined
            : count > 0
              ? `Add ${count} ${count > 1 ? nouns : noun} & continue`
              : `Continue without ${nouns}`
        }
        busy={busy}
        disabled={busy}
        onPress={() => void saveAndContinue()}
      />
      {count === 0 && !busy && <SkipLink onPress={onNext} />}
    </StepShell>

      <Modal
        visible={adding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalGrow}>
                <Text style={styles.modalTitle}>
                  {isPrize ? 'Add a prize' : 'Add a task'}
                </Text>
                <Text style={styles.modalSub}>
                  {isPrize
                    ? partnerFirst === 'them'
                      ? 'They can cash points in for this.'
                      : `${partnerFirst} can cash points in for this.`
                    : partnerFirst === 'them'
                      ? 'They submit this to earn points when they join.'
                      : `${partnerFirst} submits this to earn points when they join.`}
                </Text>
              </View>
              <Pressable onPress={closeModal} hitSlop={8}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            <View style={styles.modalRow}>
              <EmojiField
                value={form.emoji}
                onChange={(emoji) => setForm({ ...form, emoji })}
                autoFocus
              />
              <TextInput
                style={[styles.modalInput, styles.modalGrow]}
                value={form.title}
                onChangeText={(title) => setForm({ ...form, title })}
                placeholder={
                  isPrize
                    ? `A prize for ${partnerFirst}`
                    : `A task for ${partnerFirst}`
                }
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <TextInput
              style={styles.modalInput}
              value={form.points}
              onChangeText={(v) =>
                setForm({ ...form, points: v.replace(/[^0-9]/g, '') })
              }
              placeholder={isPrize ? 'Cost in points' : 'Points they earn'}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
            />
            <Button block disabled={!customValid} onPress={addCustom}>
              {isPrize ? 'Add prize' : 'Add task'}
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function StepFriends({
  onDone,
  busy,
}: {
  onDone: () => void;
  busy: boolean;
}) {
  const [addCouplesOpen, setAddCouplesOpen] = useState(false);

  return (
    <View style={styles.friendsPage}>
      <View style={styles.friendsCopy}>
        <Text style={styles.stepTitle}>Add your friends</Text>
        <Text style={styles.friendsSub}>
          Search a couple username, or share yours so they can find you.
        </Text>
      </View>

      <Pop>
        <Pressable
          style={styles.shareCard}
          onPress={() => setAddCouplesOpen(true)}
        >
          <Text style={styles.shareCardEmoji}>👋</Text>
          <View style={styles.flex}>
            <Text style={styles.shareCardTitle}>Find your friends</Text>
            <Text style={styles.shareCardBody}>
              Search @coupleusernames or share your profile.
            </Text>
          </View>
          <Text style={styles.shareCardArrow}>›</Text>
        </Pressable>
      </Pop>

      <View style={styles.friendsSpacer} />

      <View style={styles.friendsFooter}>
        <PrimaryButton
          label={busy ? undefined : 'Enter LoveReceipts'}
          busy={busy}
          disabled={busy}
          onPress={onDone}
        />
        {!busy && <SkipLink label="Skip for now" onPress={onDone} />}
      </View>

      <AddCouplesModal
        visible={addCouplesOpen}
        onClose={() => setAddCouplesOpen(false)}
      />
    </View>
  );
}

/* ------------------------------------------------------------- styles */

const styles = {
  ...stepStyles,
  ...StyleSheet.create({
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  demoReceipt: {
    alignSelf: 'center',
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

  usernameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  usernameAt: { fontSize: 20, fontWeight: '700', color: '#787774' },
  usernameInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 4,
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
  },
  usernamePreview: {
    color: '#9b9a97',
    fontSize: 12,
    textAlign: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  secondaryBtnText: { color: colors.black, fontWeight: '600', fontSize: 15 },

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
    borderColor: colors.black,
  },
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chipEmoji: { fontSize: 22 },
  chipCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d3d1cb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCheckOn: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipCheckMark: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chipTitle: { fontSize: 13, fontWeight: '600', color: colors.black },
  chipPts: { fontSize: 12, color: '#9b9a97', fontWeight: '500' },
  addedNote: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
    textAlign: 'center',
  },
  customPrizeBtn: {
    borderWidth: 1.5,
    borderColor: '#d3d1cb',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  customPrizeText: { fontSize: 14, fontWeight: '600', color: '#787774' },
  modalSheet: { flex: 1, backgroundColor: colors.bg },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  modalSub: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkMuted,
    paddingTop: 4,
  },
  modalRow: { flexDirection: 'row', gap: 8 },
  modalGrow: { flex: 1 },
  modalInput: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.panel,
    color: colors.ink,
  },

  /* friends share */
  friendsPage: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 8,
  },
  friendsCopy: { marginBottom: 24 },
  friendsSub: {
    fontSize: 15,
    lineHeight: 22,
    color: '#787774',
    marginTop: 8,
  },
  friendsSpacer: { flex: 1, minHeight: 24 },
  friendsFooter: { gap: 4, paddingBottom: 8 },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.black,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.black,
  },
  shareCardEmoji: { fontSize: 26 },
  shareCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  shareCardBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  shareCardArrow: { fontSize: 24, color: 'rgba(255,255,255,0.6)' },

  /* role picker */
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  roleCardOn: {
    borderColor: colors.black,
    backgroundColor: '#f7f6f3',
  },
  roleEmoji: { fontSize: 28 },
  roleTextCol: { flex: 1, gap: 3 },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: -0.2,
  },
  roleBody: { fontSize: 13, lineHeight: 18, color: '#787774' },
  roleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#d3d1cb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckOn: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  roleCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },

  /* invite code */
  codeCard: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: '#f7f6f3',
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b9a97',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.black,
  },
  codeHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#787774',
    textAlign: 'center',
    marginTop: 4,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: '700',
    fontSize: 22,
    textAlign: 'center',
  },
  }),
};
