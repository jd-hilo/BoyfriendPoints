import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Prize, PublicUser } from '../types';
import { api } from '../api';
import { Button, ReceiptModal, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export default function Redeem({
  user,
  onChange,
}: {
  user: PublicUser;
  onChange: () => void;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setPrizes(await api.prizes());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(prize: Prize) {
    setError(null);
    setBusy(prize.id);
    haptic([12, 30, 12]);
    try {
      const { redemption } = await api.redeem(prize.id);
      setSuccess({ id: redemption.id, title: prize.title, emoji: prize.emoji, cost: prize.cost });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function finish(share: boolean) {
    if (!success) return;
    setSharing(true);
    try {
      if (share) {
        await api.shareRedemption(success.id);
        haptic(12);
      }
      setSuccess(null);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <View style={styles.balanceValue}>
          <Xp value={user.points} size={18} large />
        </View>
      </View>

      <Text style={styles.screenTitle}>Redeem</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {prizes.length === 0 ? (
        <Text style={styles.centerMuted}>
          {user.partnerName ?? 'Your partner'} hasn&apos;t added prizes yet.
        </Text>
      ) : (
        <View style={styles.grid}>
          {prizes.map((p) => {
            const affordable = user.points >= p.cost;
            return (
              <View key={p.id} style={[styles.prize, !affordable && styles.prizeLocked]}>
                <Text style={styles.prizeEmoji}>{p.emoji}</Text>
                <Text style={styles.prizeTitle}>{p.title}</Text>
                <View style={styles.prizeCost}>
                  <Xp value={p.cost} size={12} />
                </View>
                <Button
                  variant={affordable ? 'primary' : 'secondary'}
                  block
                  disabled={!affordable || busy === p.id || !!success}
                  onPress={() => redeem(p)}
                >
                  {affordable
                    ? busy === p.id
                      ? 'Redeeming…'
                      : 'Redeem'
                    : `Need ${p.cost - user.points} more`}
                </Button>
              </View>
            );
          })}
        </View>
      )}

      {success && (
        <ReceiptModal
          kind="redeem"
          subtitle={`${user.partnerName ?? 'Your partner'} was alerted to fulfill it.`}
          emoji={success.emoji}
          itemTitle={success.title}
          points={success.cost}
          fromName={user.name}
          toName={user.partnerName ?? 'Partner'}
          note="Uncheck below if you want this kept off the feed."
          shareLabel="Share receipt"
          skipLabel="Done"
          feedLabel="Post to feed"
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
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 18,
    gap: 2,
    marginBottom: 4,
    ...shadow,
  },
  balanceLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  balanceValue: { marginTop: 8, alignSelf: 'flex-start' },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  error: { color: colors.red, fontSize: 13 },
  centerMuted: { textAlign: 'center', color: colors.inkMuted, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  prize: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    ...shadow,
  },
  prizeLocked: { opacity: 0.72 },
  prizeEmoji: { fontSize: 30 },
  prizeTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', minHeight: 32 },
  prizeCost: { marginBottom: 6 },
});
