import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Redemption, Submission } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, ReceiptModal, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';
import type { ReceiptKind } from '../receipt';

interface ReceiptState {
  kind: ReceiptKind;
  emoji: string;
  title: string;
  points: number;
  subtitle: string;
  fromName: string;
  toName: string;
  note: string;
}

export default function WifeRequests({
  onChange,
  onAddPrizes,
  openReceipt,
}: {
  onChange: () => void;
  onAddPrizes?: () => void;
  openReceipt?: boolean;
}) {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [revise, setRevise] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.submissions(), api.redemptions()]);
    setSubs(s);
    setRedemptions(r);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openReceipt || receipt || subs.length === 0 || !user) return;
    const s = subs[0];
    setReceipt({
      kind: 'approve',
      emoji: s.emoji,
      title: s.title,
      points: s.requestedPoints,
      subtitle: `You just paid out +${s.requestedPoints} XP.`,
      fromName: user.name,
      toName: user.partnerName ?? 'Partner',
      note: 'Share the receipt — it’s the best part.',
    });
  }, [openReceipt, receipt, subs, user]);

  function closeReceipt() {
    setReceipt(null);
    onChange();
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function approve(s: Submission) {
    setError(null);
    try {
      const revised = revise[s.id] ? Number(revise[s.id]) : undefined;
      const res = await api.approve(s.id, revised);
      haptic([10, 40, 10]);
      await load();
      setReceipt({
        kind: 'approve',
        emoji: s.emoji,
        title: s.title,
        points: res.submission.points,
        subtitle: `You just paid out +${res.submission.points} XP.`,
        fromName: user?.name ?? 'You',
        toName: user?.partnerName ?? 'Partner',
        note: 'Share the receipt — it’s the best part.',
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function fulfill(r: Redemption) {
    setError(null);
    try {
      await api.fulfill(r.id);
      haptic([10, 30, 10]);
      await load();
      setReceipt({
        kind: 'fulfill',
        emoji: r.emoji,
        title: r.prizeTitle,
        points: r.cost,
        subtitle: `Marked as given to ${user?.partnerName ?? 'your partner'}.`,
        fromName: user?.name ?? 'You',
        toName: user?.partnerName ?? 'Partner',
        note: 'Share a receipt for the prize handoff.',
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const empty = subs.length === 0 && redemptions.length === 0;

  if (empty) {
    return (
      <View style={styles.emptyScreen}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <EmptyReview
          hasPartner={Boolean(user?.partnerId && user.partnerName)}
          onAddPrizes={onAddPrizes}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Review</Text>
      <Text style={styles.subtitle}>A quick look at what your partner is asking for.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {subs.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>POINT REQUESTS</Text>
          <View style={styles.list}>
            {subs.map((s) => (
              <View key={s.id} style={styles.requestCard}>
                <View style={styles.requestHead}>
                  <Text style={styles.requestTitle}>
                    {s.emoji} {s.title}
                  </Text>
                  <Xp value={s.requestedPoints} sign="+" size={13} />
                </View>
                {s.note ? <Text style={styles.requestNote}>"{s.note}"</Text> : null}
                <Text style={styles.adjustLabel}>Approve points</Text>
                <View style={styles.requestActions}>
                  <TextInput
                    style={styles.reviseInput}
                    keyboardType="number-pad"
                    placeholder={`${s.requestedPoints}`}
                    value={revise[s.id] ?? ''}
                    onChangeText={(v) => setRevise((r) => ({ ...r, [s.id]: v }))}
                  />
                  <Button
                    disabled={!!receipt}
                    onPress={() => void approve(s)}
                    style={styles.approveBtn}
                  >
                    {revise[s.id]
                      ? `Approve +${revise[s.id]}`
                      : `Approve +${s.requestedPoints}`}
                  </Button>
                </View>
                <Button
                  block
                  variant="ghost"
                  disabled={!!receipt}
                  onPress={() => act(() => api.deny(s.id))}
                >
                  Pass for now
                </Button>
              </View>
            ))}
          </View>
        </>
      )}

      {redemptions.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PRIZES TO FULFILL</Text>
          <View style={styles.list}>
            {redemptions.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={styles.requestHead}>
                  <Text style={styles.requestTitle}>
                    {r.emoji} {r.prizeTitle}
                  </Text>
                  <Xp value={r.cost} sign="−" size={13} />
                </View>
                <Button block variant="secondary" disabled={!!receipt} onPress={() => void fulfill(r)}>
                  Mark as given
                </Button>
              </View>
            ))}
          </View>
        </>
      )}

      {receipt && (
        <ReceiptModal
          kind={receipt.kind}
          subtitle={receipt.subtitle}
          emoji={receipt.emoji}
          itemTitle={receipt.title}
          points={receipt.points}
          fromName={receipt.fromName}
          toName={receipt.toName}
          note={receipt.note}
          shareLabel="Share receipt"
          skipLabel="Done"
          onSkip={closeReceipt}
        />
      )}
    </ScrollView>
  );
}

function EmptyReview({
  hasPartner,
  onAddPrizes,
}: {
  hasPartner: boolean;
  onAddPrizes?: () => void;
}) {
  return (
    <View style={styles.emptyHome}>
      <DemoRequest />
      <Text style={styles.emptyTitle}>Nothing to review yet</Text>
      <Text style={styles.emptyBody}>
        {hasPartner
          ? 'Add prizes so your partner has something to send you.'
          : 'Invite your partner so they can send you things to review.'}
      </Text>
      <Pressable style={styles.addButton} onPress={onAddPrizes}>
        <Text style={styles.addButtonText}>{hasPartner ? 'Add prizes' : 'Add partner'}</Text>
      </Pressable>
    </View>
  );
}

function DemoRequest() {
  const check = useRef(new Animated.Value(0)).current;
  const stamp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.spring(check, {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.delay(120),
        Animated.timing(stamp, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.parallel([
          Animated.timing(check, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(stamp, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [check, stamp]);

  return (
    <View style={styles.demoWrap}>
      <View style={styles.demoCard}>
        <View style={styles.requestHead}>
          <Text style={styles.requestTitle}>☕ Morning coffee run</Text>
          <Xp value={15} sign="+" size={13} />
        </View>
        <Text style={styles.requestNote}>“Picked up her usual.”</Text>
        <View style={styles.demoApprove}>
          <Text style={styles.demoApproveText}>Approve +15</Text>
          <Animated.View
            style={[
              styles.demoCheck,
              {
                opacity: check,
                transform: [
                  {
                    scale: check.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.demoCheckMark}>✓</Text>
          </Animated.View>
        </View>
      </View>
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.demoBurst,
          {
            opacity: stamp.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateY: stamp.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, -40],
                }),
              },
              {
                scale: stamp.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0.6, 1.2, 1],
                }),
              },
            ],
          },
        ]}
      >
        ✓
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 14, paddingBottom: 24, paddingTop: 8 },
  emptyScreen: { flex: 1 },
  emptyHome: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 22,
    marginHorizontal: 12,
    lineHeight: 28,
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 18,
  },
  addButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 18,
    marginHorizontal: 24,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  demoWrap: {
    marginHorizontal: 4,
    paddingTop: 28,
    overflow: 'visible',
  },
  demoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  demoApprove: {
    marginTop: 4,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  demoApproveText: { color: colors.inkMuted, fontSize: 15, fontWeight: '700' },
  demoCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoCheckMark: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  demoBurst: {
    position: 'absolute',
    right: 28,
    bottom: 44,
    fontSize: 22,
    color: colors.green,
    fontWeight: '800',
  },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -8 },
  error: { color: colors.red, fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: colors.inkMuted,
    marginTop: 12,
  },
  mutedSmall: { fontSize: 13, color: colors.inkMuted },
  count: {
    backgroundColor: colors.red,
    color: '#fff',
    borderRadius: 999,
    fontSize: 11,
    overflow: 'hidden',
  },
  list: { gap: 10 },
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  requestHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  requestTitle: { fontWeight: '700', flex: 1, color: colors.ink },
  requestNote: { color: colors.ink2, fontSize: 14, fontStyle: 'italic' },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  approveBtn: { flex: 1, minWidth: 0 },
  adjustLabel: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginTop: 2 },
  reviseInput: {
    width: 68,
    flexShrink: 0,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
