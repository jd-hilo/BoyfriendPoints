import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Prize, PublicUser } from '../types';
import { api } from '../api';
import { ReceiptModal, Xp } from '../ui';
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
      <Text style={styles.subtitle}>Tap a prize you can afford.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {prizes.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.tile, styles.tileLocked]}>
            <Ionicons name="lock-closed" size={18} color={colors.inkMuted} />
            <Text style={styles.tileEmoji}>🎁</Text>
            <Text style={styles.tileTitle}>Movie night</Text>
            <Xp value={40} size={12} />
          </View>
          <Text style={styles.emptyTitle}>No prizes yet</Text>
          <Text style={styles.emptyBody}>
            Ask {user.partnerName ?? 'your partner'} to add rewards you can cash points in for.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {prizes.map((p) => {
            const affordable = user.points >= p.cost;
            return (
              <Pressable
                key={p.id}
                style={[styles.tile, !affordable && styles.tileLocked]}
                disabled={!affordable || busy === p.id || !!success}
                onPress={() => void redeem(p)}
              >
                {!affordable && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={12} color={colors.inkMuted} />
                  </View>
                )}
                <Text style={styles.tileEmoji}>{p.emoji}</Text>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {p.title}
                </Text>
                <Xp value={p.cost} size={12} />
                <Text style={styles.tileHint}>
                  {affordable
                    ? busy === p.id
                      ? 'Redeeming…'
                      : 'Tap to redeem'
                    : `Need ${p.cost - user.points} more`}
                </Text>
              </Pressable>
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
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -8 },
  error: { color: colors.red, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 12, gap: 8 },
  emptyTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginHorizontal: 18,
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
  tileLocked: { opacity: 0.55 },
  tileEmoji: { fontSize: 28 },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 17,
  },
  tileHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  lockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
