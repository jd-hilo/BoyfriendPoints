import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationItem } from '../types';
import { api } from '../api';
import { colors, radius, shadow } from '../theme';
import { Avatar, Xp } from '../ui';
import { timeAgo } from '../utils';

function amountKind(kind: NotificationItem['kind']): 'earn' | 'redeem' | null {
  if (kind === 'approved' || kind === 'request') return 'earn';
  if (kind === 'redeem' || kind === 'prize') return 'redeem';
  return null;
}

function verbFor(kind: NotificationItem['kind']): string {
  switch (kind) {
    case 'approved':
      return 'approved your request';
    case 'denied':
      return 'passed on your request';
    case 'request':
      return 'requested points';
    case 'redeem':
      return 'redeemed a prize';
    case 'prize':
      return 'added a new prize';
    case 'reaction':
      return 'reacted';
    case 'comment':
      return 'commented';
    default:
      return '';
  }
}

export default function Notifications({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .notifications()
      .then(setItems)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <View style={styles.panel}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} onPress={onClose}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.searchPill}>
            <Text style={styles.brandGem}>🔔</Text>
            <Text style={styles.wordmarkSm}>Notifications</Text>
          </View>
          <View style={[styles.headerIconBtn, styles.spacer]} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {items === null && !error && <Text style={styles.centerMuted}>Loading…</Text>}

        <FlatList
          data={items ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            items !== null ? (
              <View style={styles.feedCard}>
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🔔</Text>
                  <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
                  <Text style={styles.centerMuted}>
                    Reactions, approvals, new requests and prizes will show up here.
                  </Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item: n }) => {
            const amount = amountKind(n.kind);
            const actor = n.actorName ?? 'Someone';
            return (
              <View style={styles.feedCard}>
                <View style={styles.feedCardTop}>
                  <Text style={styles.feedTime}>{timeAgo(n.createdAt)} ago</Text>
                </View>
                <View style={styles.feedStory}>
                  {n.actorAvatar || n.actorName ? (
                    <Avatar name={actor} color={n.actorColor ?? colors.blue} src={n.actorAvatar} size={40} />
                  ) : (
                    <View style={styles.notifBubble}>
                      <Text style={{ fontSize: 20 }}>{n.emoji}</Text>
                    </View>
                  )}
                  <View style={styles.feedStoryText}>
                    <Text style={styles.feedLine}>
                      <Text style={styles.name}>{actor}</Text>
                      <Text> {verbFor(n.kind)}</Text>
                    </Text>
                    {(n.body || n.emoji) && (
                      <Text style={styles.feedNote}>
                        {n.emoji} {n.body ?? ''}
                      </Text>
                    )}
                  </View>
                  {typeof n.points === 'number' && amount && (
                    <Xp value={n.points} sign={amount === 'earn' ? '+' : '−'} size={13} />
                  )}
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    zIndex: 55,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  spacer: { opacity: 0 },
  backIcon: { fontSize: 24, color: colors.ink2 },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...shadow,
  },
  brandGem: { fontSize: 16 },
  wordmarkSm: { fontSize: 15, fontWeight: '800', color: colors.blue, letterSpacing: -0.3 },
  error: { color: colors.red, padding: 16 },
  centerMuted: { textAlign: 'center', color: colors.inkMuted },
  list: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  feedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    paddingBottom: 12,
    marginBottom: 12,
    ...shadow,
  },
  feedCardTop: { marginBottom: 12 },
  feedTime: { fontSize: 13, color: colors.inkMuted, fontWeight: '500' },
  feedStory: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feedStoryText: { flex: 1 },
  feedLine: { fontSize: 15, lineHeight: 20, color: colors.ink },
  name: { color: colors.blueName, fontWeight: '700' },
  feedNote: { marginTop: 6, color: colors.ink, fontSize: 15, lineHeight: 20 },
  notifBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', padding: 20, gap: 4 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontWeight: '700', color: colors.ink },
});
