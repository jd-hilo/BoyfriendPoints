import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EarnTask, Submission, Suggestion } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, EmojiField, PushNudgeModal, ReceiptModal, WhoPill, Xp } from '../ui';
import { colors, radius, shadow, TAB_BAR_FLOAT_HEIGHT } from '../theme';
import { APP_SHARE_URL, haptic, partnerWaitingShareMessage } from '../utils';
import { pickAndUploadPhoto } from '../pickImage';
import {
  dismissPushPrompt,
  enablePushNotifications,
  shouldOfferPushPrompt,
} from '../push';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  points: number;
  photos: number;
}

export default function Submit({
  onDone,
  onEnterCode,
}: {
  onDone: () => void;
  onEnterCode?: () => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [created, setCreated] = useState<EarnTask[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [sharing, setSharing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [busyTitle, setBusyTitle] = useState<string | null>(null);
  const [scope, setScope] = useState<'you' | 'them'>('you');
  const [loaded, setLoaded] = useState(false);
  const [pushPrompt, setPushPrompt] = useState(false);
  // The receipt is its own modal, so it can only be presented once the
  // compose sheet has finished dismissing.
  const queuedSuccess = useRef<SuccessInfo | null>(null);
  const queuedPushPrompt = useRef(false);

  async function maybeQueuePushPrompt() {
    if (!user || created.length > 0) return;
    if (!(await shouldOfferPushPrompt(user.id))) return;
    queuedPushPrompt.current = true;
  }

  function flushPushPrompt() {
    if (!queuedPushPrompt.current) return;
    queuedPushPrompt.current = false;
    setPushPrompt(true);
  }

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api.tasks(), api.submissions()]);
      const partnerId = user?.partnerId;
      setOptions(
        t
          .filter((task) => partnerId && task.wifeId === partnerId)
          .map((task) => ({ title: task.title, emoji: task.emoji, points: task.points })),
      );
      setCreated(t.filter((task) => task.wifeId === user?.id));
      setMine(s.filter((sub) => sub.boyfriendId === user?.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [user?.id, user?.partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitTask(task: Suggestion) {
    setError(null);
    setBusyTitle(task.title);
    try {
      const submission = await api.submit(task.title, task.points, task.emoji, '', []);
      haptic([10, 40, 10]);
      setSuccess({
        id: submission.id,
        title: task.title,
        emoji: task.emoji,
        points: task.points,
        photos: 0,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTitle(null);
    }
  }

  async function addPhoto() {
    setError(null);
    try {
      const url = await pickAndUploadPhoto();
      if (!url) return;
      setImages((p) => (p.length >= 4 ? p : [...p, url]));
      haptic(10);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function resetCompose() {
    setTitle('');
    setEmoji('⭐');
    setPoints('');
    setNote('');
    setImages([]);
  }

  function closeCompose() {
    setComposeOpen(false);
    resetCompose();
  }

  /** Show the queued receipt once the compose sheet is really gone. */
  function flushQueuedSuccess() {
    if (!queuedSuccess.current) return;
    setSuccess(queuedSuccess.current);
    queuedSuccess.current = null;
  }

  /** Also runs when the sheet is swiped away, so state can't drift open. */
  function onComposeDismissed() {
    setComposeOpen(false);
    if (queuedSuccess.current) flushQueuedSuccess();
    else resetCompose();
  }

  async function submit() {
    setError(null);
    try {
      const submission = await api.submit(title, Number(points), emoji, note, images);
      haptic([10, 40, 10]);
      queuedSuccess.current = {
        id: submission.id,
        title: title.trim(),
        emoji,
        points: Number(points),
        photos: images.length,
      };
      resetCompose();
      setComposeOpen(false);
      // onDismiss is iOS-only; everywhere else the sheet is already gone.
      if (Platform.OS !== 'ios') flushQueuedSuccess();
      else setTimeout(flushQueuedSuccess, 600);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function finish(share: boolean) {
    if (!success) return;
    setSharing(true);
    try {
      if (share) {
        await api.shareSubmission(success.id);
        haptic(12);
      }
      setSuccess(null);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  const partner = user?.partnerName ?? 'your partner';
  const partnerFirst = user?.partnerName?.trim().split(/\s+/)[0] ?? 'them';
  const canSubmit = title.trim().length > 0 && Number(points) > 0;

  async function invitePartner() {
    if (!user) return;
    haptic(10);
    const who = user.name.trim() || 'Your partner';
    await Share.share({
      message: partnerWaitingShareMessage(who, user.inviteCode),
      url: APP_SHARE_URL,
    });
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 24 + TAB_BAR_FLOAT_HEIGHT + Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Tasks</Text>
        <WhoPill
          value={scope}
          themLabel={`For ${partnerFirst}`}
          onChange={(next) => {
            haptic(8);
            setScope(next);
          }}
        />
      </View>

      <LoadFade ready={loaded} identity={scope}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {scope === 'you' ? (
        <>
          {options.length === 0 ? (
            <View style={styles.empty}>
              {user?.partnerId ? (
                <View style={[styles.tile, styles.emptyPreviewTile]}>
                  <Ionicons name="lock-closed" size={18} color={colors.inkMuted} />
                  <Text style={styles.tileEmoji}>⭐</Text>
                  <Text style={styles.tileTitle}>Thoughtful favor</Text>
                  <Xp value={25} sign="+" size={12} />
                </View>
              ) : null}
              <Text style={styles.emptyTitle}>
                {user?.partnerId
                  ? `${partner} hasn’t added any tasks yet`
                  : 'Add your partner first'}
              </Text>
              <Text style={styles.emptyBody}>
                {user?.partnerId
                  ? 'You can still send a custom request for points.'
                  : 'Invite them, or enter their code if they already signed up.'}
              </Text>
              {user?.partnerId ? (
                <Button
                  block
                  disabled={!!success}
                  onPress={() => {
                    haptic(10);
                    setError(null);
                    setComposeOpen(true);
                  }}
                >
                  Submit a task for points
                </Button>
              ) : (
                <>
                  <Button
                    block
                    disabled={!user?.inviteCode}
                    onPress={() => void invitePartner()}
                  >
                    Invite partner
                  </Button>
                  {onEnterCode ? (
                    <Pressable
                      onPress={() => {
                        haptic(8);
                        onEnterCode();
                      }}
                      hitSlop={8}
                      style={styles.codeLink}
                    >
                      <Text style={styles.codeLinkText}>Have their code?</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          ) : (
            <View style={styles.grid}>
              {options.map((t) => (
                <Pressable
                  key={t.title}
                  style={styles.tile}
                  disabled={!!busyTitle || !!success}
                  onPress={() => void submitTask(t)}
                >
                  <Text style={styles.tileEmoji}>{t.emoji}</Text>
                  <Text style={styles.tileTitle} numberOfLines={2}>
                    {t.title}
                  </Text>
                  <Xp value={t.points} sign="+" size={12} />
                  {busyTitle === t.title ? (
                    <Text style={styles.tileBusy}>Sending…</Text>
                  ) : null}
                </Pressable>
              ))}
              <Pressable
                style={[styles.tile, styles.tileAdd]}
                disabled={!!busyTitle || !!success}
                onPress={() => {
                  haptic(10);
                  setError(null);
                  setComposeOpen(true);
                }}
              >
                <View style={styles.tileAddInner}>
                  <Text style={styles.tileAddPlus}>+</Text>
                  <Text style={styles.tileAddLabel}>Something else</Text>
                </View>
              </Pressable>
            </View>
          )}

          {mine.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Your requests</Text>
              <View style={styles.list}>
                {mine.map((s) => (
                  <View key={s.id} style={styles.miniRow}>
                    <Text>
                      {s.emoji} {s.title}
                    </Text>
                    {s.status === 'approved' ? (
                      <View style={styles.rowGap}>
                        <Xp value={s.points} sign="+" size={11} />
                        {s.revised ? (
                          <Text style={styles.mutedSmall}>revised</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.status,
                          s.status === 'denied'
                            ? styles.statusDenied
                            : styles.statusPending,
                        ]}
                      >
                        {s.status}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.grid}>
            {created.map((t) => (
              <View key={t.id} style={styles.tile}>
                <Pressable
                  style={styles.tileRemove}
                  onPress={() => void api.removeTask(t.id).then(load)}
                  hitSlop={8}
                >
                  <Text style={styles.xBtn}>✕</Text>
                </Pressable>
                <Text style={styles.tileEmoji}>{t.emoji}</Text>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {t.title}
                </Text>
                <Xp value={t.points} sign="+" size={12} />
              </View>
            ))}
            <Pressable
              style={[styles.tile, styles.tileAdd]}
              onPress={() => {
                haptic(10);
                setError(null);
                setAddingTask(true);
              }}
            >
              <View style={styles.tileAddInner}>
                <Text style={styles.tileAddPlus}>+</Text>
                <Text style={styles.tileAddLabel}>Add a task</Text>
              </View>
            </Pressable>
          </View>
        </>
        )}
      </LoadFade>

      <Modal
        visible={addingTask}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setAddingTask(false);
          setTaskForm({ emoji: '⭐', title: '', points: '' });
        }}
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
              <View style={styles.grow}>
                <Text style={styles.modalTitle}>Add a task</Text>
                <Text style={styles.modalSub}>
                  {partnerFirst === 'them'
                    ? 'They submit this to earn points.'
                    : `${partnerFirst} submits this to earn points.`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setAddingTask(false);
                  setTaskForm({ emoji: '⭐', title: '', points: '' });
                }}
                hitSlop={8}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.row}>
              <EmojiField
                value={taskForm.emoji}
                onChange={(emoji) => setTaskForm({ ...taskForm, emoji })}
                autoFocus
              />
              <TextInput
                style={[styles.input, styles.grow]}
                value={taskForm.title}
                onChangeText={(v) => setTaskForm({ ...taskForm, title: v })}
                placeholder={`A task for ${partnerFirst}`}
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <TextInput
              style={styles.input}
              value={taskForm.points}
              onChangeText={(v) =>
                setTaskForm({ ...taskForm, points: v.replace(/[^0-9]/g, '') })
              }
              placeholder="Points they earn"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
            />
            <Button
              block
              disabled={!taskForm.title.trim() || !taskForm.points}
              onPress={async () => {
                setError(null);
                try {
                  await maybeQueuePushPrompt();
                  await api.addTask(
                    taskForm.title,
                    Number(taskForm.points),
                    taskForm.emoji,
                  );
                  setTaskForm({ emoji: '⭐', title: '', points: '' });
                  setAddingTask(false);
                  await load();
                  if (Platform.OS !== 'ios') flushPushPrompt();
                  else setTimeout(flushPushPrompt, 450);
                } catch (err) {
                  queuedPushPrompt.current = false;
                  setError((err as Error).message);
                }
              }}
            >
              Add task
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={composeOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCompose}
        onDismiss={onComposeDismissed}
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
              <View style={styles.grow}>
                <Text style={styles.modalTitle}>
                  {options.length === 0 ? 'Submit a task' : 'Something else'}
                </Text>
                <Text style={styles.modalSub}>
                  {options.length === 0
                    ? `Send ${partner} a point request.`
                    : `Log a win ${partner} hasn’t listed yet.`}
                </Text>
              </View>
              <Pressable onPress={closeCompose} hitSlop={8}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.row}>
              <EmojiField value={emoji} onChange={setEmoji} autoFocus />
              <TextInput
                style={[styles.input, styles.grow]}
                value={title}
                onChangeText={setTitle}
                placeholder="What did you do?"
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <TextInput
              style={styles.input}
              value={points}
              onChangeText={(v) => setPoints(v.replace(/[^0-9]/g, ''))}
              placeholder="Points requested"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.inkMuted}
            />

            <View style={styles.photoAttach}>
              {images.map((src) => (
                <View key={src} style={styles.photoThumb}>
                  <Image source={{ uri: src }} style={styles.photoThumbImg} />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => setImages((p) => p.filter((x) => x !== src))}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {images.length < 4 && (
                <Pressable style={styles.photoAdd} onPress={() => void addPhoto()}>
                  <Text style={styles.photoAddPlus}>＋</Text>
                  <Text style={styles.photoAddLabel}>Add photo</Text>
                </Pressable>
              )}
            </View>

            <Button block onPress={submit} disabled={!canSubmit}>
              Request points
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {success && user && (
        <ReceiptModal
          kind="request"
          subtitle={`${partner} will review this next.`}
          emoji={success.emoji}
          itemTitle={success.title}
          meta={
            success.photos > 0
              ? `${success.photos} photo${success.photos > 1 ? 's' : ''} attached`
              : undefined
          }
          points={success.points}
          fromName={user.name}
          toName={user.partnerName ?? 'Partner'}
          note="Uncheck below if you want this kept off the feed."
          shareLabel="Share receipt"
          skipLabel="Done"
          feedLabel="Post to feed when approved"
          busy={sharing}
          onShare={() => finish(true)}
          onSkip={() => void finish(false)}
        />
      )}

      <PushNudgeModal
        visible={pushPrompt}
        partnerFirst={partnerFirst}
        onSkip={() => {
          haptic(8);
          setPushPrompt(false);
          if (user) void dismissPushPrompt(user.id);
        }}
        onYes={() => {
          haptic(10);
          setPushPrompt(false);
          if (!user) return;
          void (async () => {
            // iOS will not show the system sheet while our modal is still up.
            await new Promise((r) => setTimeout(r, 700));
            await enablePushNotifications(user.id);
          })();
        }}
      />
    </ScrollView>
  );
}

function LoadFade({
  ready,
  identity,
  children,
}: {
  ready: boolean;
  identity: string;
  children: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!ready) return;
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [identity, opacity, ready, translateY]);

  if (!ready) return null;
  return (
    <Animated.View
      style={[styles.loadedContent, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingTop: 10, paddingBottom: 24 },
  loadedContent: { gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, marginTop: 4, marginBottom: 4 },
  empty: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingTop: 12,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 15,
    color: colors.inkMuted,
    lineHeight: 21,
    textAlign: 'center',
    marginHorizontal: 18,
  },
  codeLink: { paddingVertical: 6 },
  codeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47.5%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadow,
  },
  tileEmoji: { fontSize: 28 },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 17,
  },
  tileBusy: { fontSize: 11, fontWeight: '700', color: colors.blue },
  emptyPreviewTile: { opacity: 0.55 },
  tileAdd: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    padding: 16,
  },
  tileAddInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tileAddPlus: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.inkMuted,
    lineHeight: 34,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tileAddLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
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
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  emojiInput: {
    width: 52,
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bg,
    fontSize: 16,
  },
  input: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.bg,
    color: colors.ink,
  },
  photoAttach: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 10 },
  photoAdd: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c8ced5',
    borderStyle: 'dashed',
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddPlus: { fontSize: 18, color: colors.inkMuted },
  photoAddLabel: { fontSize: 9, fontWeight: '600', color: colors.inkMuted },
  error: { color: colors.red, fontSize: 13 },
  list: { gap: 10 },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    ...shadow,
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mutedSmall: { fontSize: 12, color: colors.inkMuted },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  statusPending: { color: '#b7791f' },
  statusDenied: { color: colors.red },
  tileRemove: { position: 'absolute', top: 8, right: 10, zIndex: 1 },
  xBtn: { color: colors.inkMuted, fontSize: 14 },
});
