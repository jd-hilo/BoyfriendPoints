import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Submission, Suggestion } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, ReceiptModal, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';
import { pickAndUploadPhoto } from '../pickImage';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  points: number;
  photos: number;
}

export default function Submit({
  onDone,
}: {
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
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
  // The receipt is its own modal, so it can only be presented once the
  // compose sheet has finished dismissing.
  const queuedSuccess = useRef<SuccessInfo | null>(null);

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([api.tasks(), api.submissions()]);
    setOptions(t.map((task) => ({ title: task.title, emoji: task.emoji, points: task.points })));
    setMine(s);
  }, []);

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
  const canSubmit = title.trim().length > 0 && Number(points) > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Submit</Text>
      <Text style={styles.subtitle}>Tap a win. Your partner approves it.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {options.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {user?.partnerId
              ? `${partner} hasn’t added any tasks yet`
              : 'Add your partner first'}
          </Text>
          <Text style={styles.emptyBody}>
            {user?.partnerId
              ? 'You can still send a custom request for points.'
              : 'Once you’re linked, you can submit wins for points.'}
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
          ) : null}
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
              <TextInput
                style={styles.emojiInput}
                value={emoji}
                onChangeText={setEmoji}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.grow]}
                value={title}
                onChangeText={setTitle}
                placeholder="What did you do?"
                placeholderTextColor={colors.inkMuted}
                autoFocus
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
                    {s.revised ? <Text style={styles.mutedSmall}>revised</Text> : null}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.status,
                      s.status === 'denied' ? styles.statusDenied : styles.statusPending,
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingBottom: 24 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, marginTop: 4, marginBottom: 4 },
  empty: {
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    gap: 10,
    alignItems: 'stretch',
    ...shadow,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.ink2,
    lineHeight: 19,
    textAlign: 'center',
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
});
