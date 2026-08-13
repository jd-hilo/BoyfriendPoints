import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Submission, Suggestion } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, ReceiptModal, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  points: number;
  photos: number;
}

export default function Submit({
  onDone,
  coachOpen,
  onCoachDismiss,
}: {
  onDone: () => void;
  coachOpen?: boolean;
  onCoachDismiss?: () => void;
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
  const [customOpen, setCustomOpen] = useState(false);
  const [busyTitle, setBusyTitle] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([api.tasks(), api.submissions()]);
    if (t.length > 0) {
      setOptions(t.map((task) => ({ title: task.title, emoji: task.emoji, points: task.points })));
    } else {
      const suggestions = await api.suggestions();
      setOptions(suggestions.tasks);
    }
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
      onCoachDismiss?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTitle(null);
    }
  }

  function addPlaceholderPhoto() {
    setImages((p) => [
      ...p,
      `https://picsum.photos/seed/lr-${Date.now()}-${p.length}/720/480`,
    ]);
  }

  async function submit() {
    setError(null);
    try {
      const submission = await api.submit(title, Number(points), emoji, note, images);
      haptic([10, 40, 10]);
      setSuccess({
        id: submission.id,
        title: title.trim(),
        emoji,
        points: Number(points),
        photos: images.length,
      });
      setTitle('');
      setEmoji('⭐');
      setPoints('');
      setNote('');
      setImages([]);
      setCustomOpen(false);
      await load();
      onCoachDismiss?.();
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
  const canSubmit = Boolean(title) && Boolean(points);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Submit</Text>
      <Text style={styles.subtitle}>Tap a win. Your partner approves it.</Text>

      {coachOpen && (
        <View style={styles.coachCard}>
          <Text style={styles.coachTitle}>Land your first win</Text>
          <Text style={styles.coachBody}>
            Tap something you already did. We&apos;ll send {partner} a point
            request — and you&apos;ll get a shareable receipt.
          </Text>
          {options[0] && (
            <Button
              block
              disabled={!!busyTitle}
              onPress={() => void submitTask(options[0])}
            >
              Quick start: {options[0].emoji} {options[0].title}
            </Button>
          )}
          <Button variant="ghost" block onPress={() => onCoachDismiss?.()}>
            I&apos;ll look around first
          </Button>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

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
            {busyTitle === t.title && (
              <Text style={styles.tileBusy}>Sending…</Text>
            )}
          </Pressable>
        ))}
        <Pressable
          style={[styles.tile, styles.tileAdd]}
          onPress={() => setCustomOpen((open) => !open)}
        >
          <Text style={styles.tileAddPlus}>+</Text>
          <Text style={styles.tileAddLabel}>Something else</Text>
        </Pressable>
      </View>

      {customOpen && (
        <View style={styles.card}>
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
            />
          </View>
          <TextInput
            style={styles.input}
            value={points}
            onChangeText={setPoints}
            placeholder="Points requested"
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
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
              <Pressable style={styles.photoAdd} onPress={addPlaceholderPhoto}>
                <Text style={styles.photoAddPlus}>＋</Text>
                <Text style={styles.photoAddLabel}>Add photo</Text>
              </Pressable>
            )}
          </View>

          <Button onPress={submit} disabled={!canSubmit}>
            Request points
          </Button>
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
  coachCard: {
    padding: 16,
    backgroundColor: '#eef7ff',
    borderRadius: radius.card,
    gap: 10,
    ...shadow,
  },
  coachTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  coachBody: { fontSize: 14, color: colors.ink2, lineHeight: 19 },
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
  },
  tileAddPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.inkMuted,
    lineHeight: 32,
  },
  tileAddLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, gap: 10, ...shadow },
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
