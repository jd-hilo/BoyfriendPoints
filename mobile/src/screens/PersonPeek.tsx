import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FeedEventView, PersonPeek } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { Avatar, Xp } from '../ui';
import { haptic, timeAgo } from '../utils';

export type PersonPreview = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  partnerId?: string;
  partnerName?: string;
  partnerColor?: string;
  partnerAvatar?: string;
};

function activityFromFeed(
  events: FeedEventView[],
  personId: string,
): PersonPeek['activity'] {
  return events
    .filter((e) => e.boyfriendId === personId || e.wifeId === personId)
    .slice(0, 12)
    .map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      emoji: e.emoji,
      points: e.points,
      createdAt: e.createdAt,
      withId: e.boyfriendId === personId ? e.wifeId : e.boyfriendId,
      withName: e.boyfriendId === personId ? e.wifeName : e.boyfriendName,
      image: e.images?.[0],
    }));
}

export default function PersonPeekSheet({
  preview,
  events = [],
  onClose,
  onOpenPerson,
}: {
  preview: PersonPreview;
  events?: FeedEventView[];
  onClose: () => void;
  onOpenPerson: (next: PersonPreview) => void;
}) {
  const { user } = useAuth();
  const [peek, setPeek] = useState<PersonPeek | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .person(preview.id)
      .then((data) => {
        if (!cancelled) setPeek(data);
      })
      .catch(() => {
        if (!cancelled) setPeek(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview.id]);

  const name = peek?.name ?? preview.name;
  const color = peek?.color ?? preview.color;
  const avatar = peek?.avatarUrl ?? preview.avatarUrl;
  const partnerName = peek?.partnerName ?? preview.partnerName;
  const partnerColor = peek?.partnerColor ?? preview.partnerColor ?? '#7C5CFF';
  const partnerAvatar = peek?.partnerAvatar ?? preview.partnerAvatar;
  const partnerId = peek?.partnerId ?? preview.partnerId;
  const coupleUsername = peek?.coupleUsername;
  const mine = user?.id === preview.id;
  const activity = useMemo(() => {
    if (peek?.activity?.length) return peek.activity;
    return activityFromFeed(events, preview.id);
  }, [peek, events, preview.id]);

  function openPartner() {
    if (!partnerId || !partnerName) return;
    haptic(10);
    onOpenPerson({
      id: partnerId,
      name: partnerName,
      color: partnerColor,
      avatarUrl: partnerAvatar,
      partnerId: preview.id,
      partnerName: name,
      partnerColor: color,
      partnerAvatar: avatar,
    });
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.hero}>
              <View style={styles.photo}>
                <Avatar name={name} color={color} src={avatar} size={88} />
              </View>
              <Text style={styles.name}>{name}</Text>
              {mine ? <Text style={styles.you}>That&apos;s you</Text> : null}
              {partnerName ? (
                <Pressable style={styles.dating} onPress={openPartner}>
                  <Avatar
                    name={partnerName}
                    color={partnerColor}
                    src={partnerAvatar}
                    size={22}
                  />
                  <Text style={styles.datingText}>
                    Dating <Text style={styles.datingStrong}>{partnerName}</Text>
                  </Text>
                  <Text style={styles.heart}>♥</Text>
                </Pressable>
              ) : null}
              {coupleUsername ? (
                <Text style={styles.handleText}>@{coupleUsername}</Text>
              ) : null}
            </View>

            <Text style={styles.label}>Lately</Text>
            {loading && activity.length === 0 ? (
              <View>
                <View style={styles.skel} />
                <View style={styles.skel} />
                <View style={styles.skel} />
              </View>
            ) : activity.length === 0 ? (
              <Text style={styles.empty}>No love receipts on the feed yet.</Text>
            ) : (
              activity.map((row) => (
                <View key={row.id} style={styles.row}>
                  {row.image ? (
                    <Image source={{ uri: row.image }} style={styles.thumb} />
                  ) : (
                    <View style={styles.emojiWrap}>
                      <Text style={styles.emoji}>{row.emoji}</Text>
                    </View>
                  )}
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.emoji} {row.title}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {row.type === 'earn' ? 'from' : 'with'} {row.withName}
                      {' · '}
                      {timeAgo(row.createdAt)} ago
                    </Text>
                  </View>
                  <Xp
                    value={row.points}
                    sign={row.type === 'earn' ? '+' : '−'}
                    size={12}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d7dbe0',
    alignSelf: 'center',
    marginVertical: 8,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.ink2, fontSize: 14 },
  scroll: { paddingBottom: 12 },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  photo: { marginBottom: 12, marginTop: 4 },
  name: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  you: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  dating: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f0dce3',
  },
  datingText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  datingStrong: { fontWeight: '800' },
  heart: { color: '#e85a7a', fontSize: 13 },
  handleText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  label: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  empty: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 14,
    paddingVertical: 20,
  },
  skel: {
    height: 58,
    borderRadius: 16,
    backgroundColor: '#f3f3f2',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#faf9f7',
    borderRadius: 16,
    marginBottom: 8,
  },
  thumb: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eee' },
  emojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 20 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowMeta: { marginTop: 2, fontSize: 12, color: colors.inkMuted },
});
