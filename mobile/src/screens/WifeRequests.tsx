import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function WifeRequests({ onChange }: { onChange: () => void }) {
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

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Requests</Text>
      <Text style={styles.subtitle}>Approve point requests and fulfill redemptions.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionLabel}>
        Point requests {subs.length > 0 && <Text style={styles.count}> {subs.length} </Text>}
      </Text>
      {subs.length === 0 ? (
        <Text style={styles.mutedSmall}>No pending requests. 🎉</Text>
      ) : (
        <View style={styles.list}>
          {subs.map((s) => (
            <View key={s.id} style={styles.requestCard}>
              <View style={styles.requestHead}>
                <Text style={styles.requestTitle}>
                  {s.emoji} {s.title}
                </Text>
                <Xp value={s.requestedPoints} sign="+" size={13} />
              </View>
              {s.note && <Text style={styles.requestNote}>"{s.note}"</Text>}
              <View style={styles.requestActions}>
                <TextInput
                  style={styles.reviseInput}
                  keyboardType="number-pad"
                  placeholder={`${s.requestedPoints}`}
                  value={revise[s.id] ?? ''}
                  onChangeText={(v) => setRevise((r) => ({ ...r, [s.id]: v }))}
                />
                <Button variant="secondary" disabled={!!receipt} onPress={() => void approve(s)}>
                  {revise[s.id] ? 'Revise & approve' : 'Approve'}
                </Button>
                <Button variant="danger" disabled={!!receipt} onPress={() => act(() => api.deny(s.id))}>
                  Deny
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>
        Redemptions to fulfill{' '}
        {redemptions.length > 0 && <Text style={styles.count}> {redemptions.length} </Text>}
      </Text>
      {redemptions.length === 0 ? (
        <Text style={styles.mutedSmall}>Nothing to hand out right now.</Text>
      ) : (
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingBottom: 24 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -8 },
  error: { color: colors.red, fontSize: 13 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, marginTop: 8 },
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
    gap: 12,
    ...shadow,
  },
  requestHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  requestTitle: { fontWeight: '700', flex: 1, color: colors.ink },
  requestNote: { color: colors.ink2, fontSize: 14, fontStyle: 'italic' },
  requestActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reviseInput: {
    width: 68,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
