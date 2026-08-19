import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationItem } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { markNotificationsSeen } from '../storage';
import { colors } from '../theme';
import { Avatar, Xp } from '../ui';
import { timeAgo } from '../utils';

/** A new prize carries a price tag, not a debit — showing it signed reads as
 *  if the balance was just charged for it. */
function amountSign(kind: NotificationItem['kind']): '+' | '−' | '' | null {
  if (kind === 'approved' || kind === 'request') return '+';
  if (kind === 'redeem') return '−';
  if (kind === 'prize') return '';
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
    case 'friend_request':
      return 'sent a friend request';
    case 'friend_accepted':
      return 'accepted your friend request';
    default:
      return '';
  }
}

export default function Notifications({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const slide = useRef(new Animated.Value(width)).current;
  const closing = useRef(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    return api
      .notifications()
      .then(async (next) => {
        setItems(next);
        if (user) {
          await markNotificationsSeen(
            user.id,
            next.map((n) => n.id),
          );
          onChanged?.();
        }
      })
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide]);

  function close() {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slide, {
      toValue: width,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
      else closing.current = false;
    });
  }

  async function resolveFriend(id: string, accept: boolean) {
    setActingId(id);
    setError(null);
    try {
      if (accept) await api.acceptFriendRequest(id);
      else await api.declineFriendRequest(id);
      await load();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <Animated.View
      style={[styles.panel, { transform: [{ translateX: slide }] }]}
    >
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} onPress={close} hitSlop={6}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.wordmarkSm}>Notifications</Text>
          <View style={styles.headerIconBtn} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {items !== null ? (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
              <Text style={styles.emptyBody}>
                Reactions, approvals, and prizes will show up here.
              </Text>
            </View>
          }
          renderItem={({ item: n }) => {
            const sign = amountSign(n.kind);
            const actor = n.actorName ?? 'Someone';
            const reason = n.title || n.body;
            return (
              <View style={styles.feedCard}>
                <View style={styles.feedCardTop}>
                  <Text style={styles.feedTime}>{timeAgo(n.createdAt)} ago</Text>
                  {typeof n.points === 'number' && sign !== null ? (
                    <Xp value={n.points} sign={sign} size={13} />
                  ) : null}
                </View>
                <View style={styles.storyLine}>
                  <View style={styles.storyPerson}>
                    <Avatar
                      name={actor}
                      color={n.actorColor ?? colors.blue}
                      src={n.actorAvatar}
                      size={22}
                    />
                    <Text style={styles.name}>{actor}</Text>
                  </View>
                  <Text style={styles.verb}>{verbFor(n.kind)}</Text>
                  {reason ? (
                    <Text style={styles.storyReason}>
                      {n.emoji ? `${n.emoji} ` : ''}
                      {reason}
                    </Text>
                  ) : null}
                </View>
                <View>
                    {n.kind === 'request' && n.id.startsWith('n_req_') ? (
                      <View style={styles.friendActions}>
                        <Pressable
                          style={styles.acceptButton}
                          disabled={actingId === n.id}
                          onPress={() =>
                            void (async () => {
                              setActingId(n.id);
                              setError(null);
                              try {
                                await api.approve(n.id.slice('n_req_'.length));
                                await load();
                                onChanged?.();
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setActingId(null);
                              }
                            })()
                          }
                        >
                          <Text style={styles.acceptText}>
                            {actingId === n.id ? 'Working…' : 'Approve'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.declineButton}
                          disabled={actingId === n.id}
                          onPress={() =>
                            void (async () => {
                              setActingId(n.id);
                              setError(null);
                              try {
                                await api.deny(n.id.slice('n_req_'.length));
                                await load();
                                onChanged?.();
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setActingId(null);
                              }
                            })()
                          }
                        >
                          <Text style={styles.declineText}>Pass</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {n.kind === 'redeem' && n.id.startsWith('n_redeem_') ? (
                      <View style={styles.friendActions}>
                        <Pressable
                          style={styles.acceptButton}
                          disabled={actingId === n.id}
                          onPress={() =>
                            void (async () => {
                              setActingId(n.id);
                              setError(null);
                              try {
                                await api.fulfill(n.id.slice('n_redeem_'.length));
                                await load();
                                onChanged?.();
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setActingId(null);
                              }
                            })()
                          }
                        >
                          <Text style={styles.acceptText}>
                            {actingId === n.id ? 'Working…' : 'Mark as given'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                    {n.friendRequestId ? (
                      <View style={styles.friendActions}>
                        <Pressable
                          style={styles.acceptButton}
                          disabled={actingId === n.friendRequestId}
                          onPress={() =>
                            void resolveFriend(n.friendRequestId!, true)
                          }
                        >
                          <Text style={styles.acceptText}>
                            {actingId === n.friendRequestId ? 'Working…' : 'Accept'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.declineButton}
                          disabled={actingId === n.friendRequestId}
                          onPress={() =>
                            void resolveFriend(n.friendRequestId!, false)
                          }
                        >
                          <Text style={styles.declineText}>Decline</Text>
                        </Pressable>
                      </View>
                    ) : null}
                </View>
              </View>
            );
          }}
        />
        ) : null}
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f3f3f2',
    zIndex: 55,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#f3f3f2',
  },
  headerIconBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkSm: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  error: { color: colors.red, padding: 16 },
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
  feedCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 18,
    paddingBottom: 16,
    marginBottom: 12,
  },
  feedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  feedTime: { fontSize: 13, color: colors.inkMuted, fontWeight: '500' },
  storyLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 8,
  },
  storyPerson: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyReason: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    fontWeight: '500',
  },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  verb: { color: colors.inkMuted, fontWeight: '500', fontSize: 16, lineHeight: 22 },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 18,
    gap: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyBody: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  friendActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  acceptButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  acceptText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  declineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  declineText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
});
