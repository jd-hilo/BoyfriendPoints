import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FeedComment, FeedEventView } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, radius, shadow } from '../theme';
import { Avatar, Xp } from '../ui';
import { haptic, timeAgo } from '../utils';

const REACTION_CHOICES = ['❤️', '🔥', '😂', '😍', '👏', '💪', '🎉', '🥹'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 28;

function PhotoCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  function onScroll(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActive(Math.max(0, Math.min(images.length - 1, idx)));
  }

  return (
    <View style={styles.carousel}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {images.map((src, i) => (
          <Image
            key={src + i}
            source={{ uri: src }}
            style={styles.carouselImg}
          />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.carouselDots}>
          {images.map((src, i) => (
            <View key={src + i} style={[styles.dot, i === active && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [popped, setPopped] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await api.feed());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function like(id: string) {
    haptic(12);
    const res = await api.like(id);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              likedByMe: res.likedByMe,
              likes: res.likedByMe
                ? e.likes.includes('me')
                  ? e.likes
                  : [...e.likes, 'me']
                : e.likes.filter((x) => x !== 'me').slice(0, res.likes),
            }
          : e,
      ),
    );
  }

  async function react(id: string, emoji: string) {
    haptic([8, 20, 8]);
    setPickerFor(null);
    setPopped(`${id}:${emoji}`);
    setTimeout(() => setPopped(null), 450);
    const res = await api.react(id, emoji);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, reactions: res.reactions } : e)),
    );
  }

  const activeCommentEvent = events.find((e) => e.id === commentsFor) ?? null;

  async function addComment(id: string, text: string) {
    haptic(12);
    const res = await api.comment(id, text);
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, comments: res.comments } : e)),
    );
  }

  if (loading) {
    return (
      <Text style={styles.centerMuted}>Loading feed…</Text>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.feedList}
        ListEmptyComponent={
          <View style={styles.feedCard}>
            <Text style={[styles.centerMuted, { margin: 12 }]}>
              No activity yet. Invite friends to fill up your feed!
            </Text>
          </View>
        }
        renderItem={({ item: e }) => (
          <View style={styles.feedCard}>
            <View style={styles.feedCardTop}>
              <Text style={styles.feedTime}>{timeAgo(e.createdAt)} ago</Text>
            </View>

            <View style={styles.feedStory}>
              <Avatar name={e.boyfriendName} color={e.boyfriendColor} src={e.boyfriendAvatar} size={40} />
              <View style={styles.feedStoryText}>
                <Text style={styles.feedLine}>
                  <Text style={styles.name}>{e.boyfriendName}</Text>
                  <Text style={styles.verb}>
                    {e.type === 'earn' ? ' earned from ' : ' redeemed with '}
                  </Text>
                  <Text style={styles.name}>{e.wifeName}</Text>
                </Text>
                <Text style={styles.feedNote}>
                  {e.emoji} {e.title}
                  {e.note ? ` — ${e.note}` : ''}
                </Text>
              </View>
              <View style={styles.feedAmount}>
                <Xp value={e.points} sign={e.type === 'earn' ? '+' : '−'} size={13} />
              </View>
            </View>

            {e.images.length > 0 && <PhotoCarousel images={e.images} />}

            <ReactionRow
              event={e}
              meId={user?.id}
              poppedKey={popped}
              onToggle={(emoji) => react(e.id, emoji)}
            />

            <View style={styles.feedActions}>
              <Pressable
                style={styles.actionCircle}
                onPress={() => {
                  haptic(10);
                  setCommentsFor(e.id);
                }}
              >
                <Text>💬</Text>
                {e.comments.length > 0 && (
                  <Text style={styles.actionCount}>{e.comments.length}</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionCircle, e.likedByMe && styles.actionCircleLiked]}
                onPress={() => like(e.id)}
              >
                <Text style={e.likedByMe ? styles.likedText : undefined}>
                  {e.likedByMe ? '♥' : '♡'}
                </Text>
                {e.likes.length > 0 && (
                  <Text style={styles.actionCount}>{e.likes.length}</Text>
                )}
              </Pressable>
              <View>
                <Pressable
                  style={styles.actionCircle}
                  onPress={() => {
                    haptic(10);
                    setPickerFor(pickerFor === e.id ? null : e.id);
                  }}
                >
                  <Text>☺</Text>
                </Pressable>
                {pickerFor === e.id && (
                  <EmojiPicker
                    onPick={(emoji) => react(e.id, emoji)}
                    onClose={() => setPickerFor(null)}
                  />
                )}
              </View>
            </View>
          </View>
        )}
      />

      {activeCommentEvent && (
        <CommentSheet
          event={activeCommentEvent}
          onClose={() => setCommentsFor(null)}
          onSubmitComment={(text) => addComment(activeCommentEvent.id, text)}
        />
      )}
    </View>
  );
}

function ReactionRow({
  event,
  meId,
  poppedKey,
  onToggle,
}: {
  event: FeedEventView;
  meId?: string;
  poppedKey: string | null;
  onToggle: (emoji: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of event.reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (meId && r.userId === meId) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return [...map.entries()];
  }, [event.reactions, meId]);

  if (grouped.length === 0) return null;

  return (
    <View style={styles.reactionRow}>
      {grouped.map(([emoji, { count, mine }]) => (
        <Pressable
          key={emoji}
          style={[
            styles.reactionPill,
            mine && styles.reactionPillMine,
            poppedKey === `${event.id}:${emoji}` && styles.reactionPop,
          ]}
          onPress={() => onToggle(emoji)}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={styles.reactionCount}>{count}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <Pressable style={styles.pickerBackdrop} onPress={onClose} />
      <View style={styles.emojiPicker}>
        {REACTION_CHOICES.map((emoji) => (
          <Pressable key={emoji} style={styles.emojiChoice} onPress={() => onPick(emoji)}>
            <Text style={styles.emojiChoiceText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function CommentSheet({
  event,
  onClose,
  onSubmitComment,
}: {
  event: FeedEventView;
  onClose: () => void;
  onSubmitComment: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState('');
  const comments: FeedComment[] = event.comments;

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setText('');
    await onSubmitComment(value);
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Comments</Text>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Text>✕</Text>
            </Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={styles.sheetBody}
            ListEmptyComponent={
              <Text style={[styles.centerMuted, { paddingVertical: 24 }]}>
                No comments yet. Be the first 💬
              </Text>
            }
            renderItem={({ item: c }) => (
              <View style={styles.comment}>
                <Avatar name={c.name} color={colors.blue} src={c.avatarUrl} size={34} />
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentName}>{c.name}</Text>
                    <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.sheetInput}>
            <TextInput
              style={styles.sheetTextInput}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              autoFocus
            />
            <Pressable
              style={[styles.sheetSend, !text.trim() && styles.sheetSendDisabled]}
              onPress={submit}
              disabled={!text.trim()}
            >
              <Text style={styles.sheetSendText}>Post</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerMuted: { textAlign: 'center', color: colors.inkMuted, padding: 16 },
  feedList: { gap: 12, paddingTop: 4, paddingBottom: 24 },
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
  verb: { color: colors.ink },
  feedNote: { marginTop: 6, color: colors.ink, fontSize: 15, lineHeight: 20 },
  feedAmount: { paddingTop: 1 },
  carousel: { marginTop: 12, marginBottom: 4 },
  carouselImg: {
    width: CARD_WIDTH,
    aspectRatio: 3 / 2,
    borderRadius: 16,
    backgroundColor: '#eef1f4',
  },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cdd3da' },
  dotOn: { backgroundColor: colors.blue },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  reactionPillMine: { backgroundColor: colors.blueSoft, borderColor: '#bfe0ff' },
  reactionPop: { transform: [{ scale: 1.08 }] },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontWeight: '700', color: colors.ink2, fontSize: 12 },
  feedActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#d7d7d7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  actionCircleLiked: { borderColor: '#ff5a8a', backgroundColor: '#fff0f5' },
  likedText: { color: '#ff5a8a' },
  actionCount: { fontSize: 12, fontWeight: '600', color: colors.ink2, marginLeft: 2 },
  pickerBackdrop: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000 },
  emojiPicker: {
    position: 'absolute',
    bottom: 46,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 176,
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    ...shadow,
    zIndex: 10,
  },
  emojiChoice: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChoiceText: { fontSize: 20 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,30,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d7dbe0',
    alignSelf: 'center',
    marginVertical: 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { gap: 14, paddingVertical: 4, maxHeight: 360 },
  comment: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  commentName: { fontWeight: '700', fontSize: 14 },
  commentTime: { fontSize: 12, color: colors.inkMuted },
  commentText: { fontSize: 14, lineHeight: 19 },
  sheetInput: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetTextInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  sheetSend: {
    backgroundColor: colors.blue,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSendDisabled: { opacity: 0.4 },
  sheetSendText: { color: '#fff', fontWeight: '700' },
});
