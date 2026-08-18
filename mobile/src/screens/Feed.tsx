import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeedComment, FeedEventView, FriendRequestView } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, shadow, TAB_BAR_FLOAT_HEIGHT } from '../theme';
import { Avatar, Xp } from '../ui';
import { haptic, timeAgo } from '../utils';
import AddCouplesModal from '../AddCouplesModal';
import AddFriendPill from '../AddFriendPill';
import { Ionicons } from '@expo/vector-icons';

const REACTION_CHOICES = ['❤️', '🔥', '😂', '😍', '👏', '💪', '🎉', '🥹'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 28;

function PhotoCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  function onScroll(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActive(Math.max(0, Math.min(images.length - 1, idx)));
  }

  if (images.length === 1) {
    return (
      <Image
        source={{ uri: images[0] }}
        style={styles.heroPhoto}
        resizeMode="cover"
      />
    );
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
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      <View style={styles.carouselDots}>
        {images.map((src, i) => (
          <View key={src + i} style={[styles.dot, i === active && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

export default function Feed({
  openFirstReact,
  onInvitePartner,
  onEnterCode,
}: {
  openFirstReact?: boolean;
  onInvitePartner?: () => void;
  onEnterCode?: () => void;
} = {}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabClearance = TAB_BAR_FLOAT_HEIGHT + Math.max(insets.bottom, 10);
  const [events, setEvents] = useState<FeedEventView[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [popped, setPopped] = useState<string | null>(null);
  const [addCouplesOpen, setAddCouplesOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [feed, requests] = await Promise.all([
        api.feed(),
        api.friendRequests().catch(() => [] as FriendRequestView[]),
      ]);
      setEvents(feed);
      setFriendRequests(requests);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openFirstReact || events.length === 0 || pickerFor) return;
    setPickerFor(events[0].id);
  }, [openFirstReact, events, pickerFor]);

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

  async function resolveFriendRequest(id: string, accept: boolean) {
    try {
      if (accept) await api.acceptFriendRequest(id);
      else await api.declineFriendRequest(id);
      setFriendRequests((requests) => requests.filter((request) => request.id !== id));
      if (accept) await load();
    } catch (err) {
      Alert.alert('Couldn’t update request', (err as Error).message);
    }
  }

  const incomingRequests = friendRequests.filter(
    (request) =>
      request.to.id === (user?.inviteCode ? user.id : user?.partnerId),
  );

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (loading) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [fade, loading]);

  if (loading) return <View style={styles.flex} />;

  const requestBanner = incomingRequests.length ? (
    <View style={styles.requestList}>
      {incomingRequests.map((request) => (
        <View key={request.id} style={styles.requestCard}>
          <CoupleAvatars
            boyfriendName={request.from.partnerName ?? 'Partner'}
            boyfriendColor={request.from.partnerColor ?? colors.blue}
            boyfriendAvatar={request.from.partnerAvatar}
            wifeName={request.from.name}
            wifeColor={request.from.color}
            wifeAvatar={request.from.avatarUrl}
          />
          <View style={styles.requestText}>
            <Text style={styles.requestTitle}>
              {request.from.name} & {request.from.partnerName ?? 'partner'}
            </Text>
            <Text style={styles.requestBody}>want to connect couples</Text>
          </View>
          <Pressable
            style={styles.requestAccept}
            onPress={() => void resolveFriendRequest(request.id, true)}
          >
            <Text style={styles.requestAcceptText}>Accept</Text>
          </Pressable>
          <Pressable onPress={() => void resolveFriendRequest(request.id, false)}>
            <Text style={styles.requestDecline}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  ) : null;

  if (events.length === 0) {
    return (
      <Animated.View style={[styles.flex, { opacity: fade }]}>
        {requestBanner}
        <EmptyHome
          onAddCouples={() => setAddCouplesOpen(true)}
          onInvitePartner={onInvitePartner}
          onEnterCode={onEnterCode}
          bottomClearance={tabClearance}
        />
        <AddFriendPill
          onPress={() => setAddCouplesOpen(true)}
          bottom={tabClearance + 8}
        />
        <AddCouplesModal
          visible={addCouplesOpen}
          onClose={() => setAddCouplesOpen(false)}
          onChanged={() => void load()}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.flex, { opacity: fade }]}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[
          styles.feedList,
          { paddingBottom: tabClearance + 56 },
        ]}
        ListHeaderComponent={requestBanner}
        renderItem={({ item: e }) => (
          <View style={styles.feedCard}>
            <View style={styles.feedCardTop}>
              <Text style={styles.feedTime}>{timeAgo(e.createdAt)} ago</Text>
              <Xp value={e.points} sign={e.type === 'earn' ? '+' : '−'} size={13} />
            </View>

            <StoryLine
              leftName={e.boyfriendName}
              leftColor={e.boyfriendColor}
              leftAvatar={e.boyfriendAvatar}
              verb={e.type === 'earn' ? 'earned from' : 'redeemed with'}
              rightName={e.wifeName}
              rightColor={e.wifeColor}
              rightAvatar={e.wifeAvatar}
              emoji={e.emoji}
              title={e.title}
              note={e.note}
            />

            {e.type === 'earn' && e.images.length > 0 && (
              <PhotoCarousel images={e.images} />
            )}

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
                <Ionicons name="chatbubble-outline" size={17} color={colors.ink} />
                {e.comments.length > 0 && (
                  <Text style={styles.actionCount}>{e.comments.length}</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionCircle, e.likedByMe && styles.actionCircleLiked]}
                onPress={() => like(e.id)}
              >
                <Ionicons
                  name={e.likedByMe ? 'heart' : 'heart-outline'}
                  size={18}
                  color={e.likedByMe ? '#ff5a8a' : colors.ink}
                />
                {e.likes.length > 0 && (
                  <Text style={styles.actionCount}>{e.likes.length}</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.actionCircle}
                onPress={() => {
                  haptic(10);
                  setPickerFor(pickerFor === e.id ? null : e.id);
                }}
              >
                <Ionicons name="happy-outline" size={18} color={colors.ink} />
              </Pressable>
              {pickerFor === e.id && (
                <EmojiPicker
                  onPick={(emoji) => react(e.id, emoji)}
                  onClose={() => setPickerFor(null)}
                />
              )}
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
      <AddFriendPill
        onPress={() => setAddCouplesOpen(true)}
        bottom={tabClearance + 8}
      />
      <AddCouplesModal
        visible={addCouplesOpen}
        onClose={() => setAddCouplesOpen(false)}
        onChanged={() => void load()}
      />
    </Animated.View>
  );
}

function StoryLine({
  leftName,
  leftColor,
  leftAvatar,
  verb,
  rightName,
  rightColor,
  rightAvatar,
  emoji,
  title,
  note,
}: {
  leftName: string;
  leftColor: string;
  leftAvatar?: string | number;
  verb: string;
  rightName: string;
  rightColor: string;
  rightAvatar?: string | number;
  emoji?: string;
  title?: string;
  note?: string;
}) {
  return (
    <View style={styles.storyLine}>
      <View style={styles.storyPerson}>
        <Avatar name={leftName} color={leftColor} src={leftAvatar} size={22} />
        <Text style={styles.name}>{leftName}</Text>
      </View>
      <Text style={styles.verb}>{verb}</Text>
      <View style={styles.storyPerson}>
        <Avatar name={rightName} color={rightColor} src={rightAvatar} size={22} />
        <Text style={styles.name}>{rightName}</Text>
      </View>
      {emoji || title ? (
        <Text style={styles.storyReason}>
          {emoji ? `${emoji} ` : ''}
          {title}
          {note ? ` — ${note}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

function CoupleAvatars({
  boyfriendName,
  boyfriendColor,
  boyfriendAvatar,
  wifeName,
  wifeColor,
  wifeAvatar,
}: {
  boyfriendName: string;
  boyfriendColor: string;
  boyfriendAvatar?: string | number;
  wifeName: string;
  wifeColor: string;
  wifeAvatar?: string | number;
}) {
  return (
    <View style={styles.coupleAvatars}>
      <Avatar
        name={boyfriendName}
        color={boyfriendColor}
        src={boyfriendAvatar}
        size={35}
      />
      <View style={styles.coupleSecondAvatar}>
        <Avatar name={wifeName} color={wifeColor} src={wifeAvatar} size={35} />
      </View>
    </View>
  );
}

function EmptyHome({
  onAddCouples,
  onInvitePartner,
  onEnterCode,
  bottomClearance,
}: {
  onAddCouples: () => void;
  onInvitePartner?: () => void;
  onEnterCode?: () => void;
  bottomClearance: number;
}) {
  // The feed stays empty until both partners are in, so say that instead of
  // pointing at friends they can't see yet.
  const unlinked = Boolean(onInvitePartner);
  return (
    <View style={[styles.emptyHome, { paddingBottom: bottomClearance + 24 }]}>
      <DemoPost />
      <Text style={styles.emptyTitle}>
        {unlinked
          ? 'Your feed starts when your partner joins'
          : 'See what other couples are up to'}
      </Text>
      <Pressable
        style={styles.addFriendButton}
        onPress={onInvitePartner ?? onAddCouples}
      >
        <Text style={styles.addFriendText}>
          {unlinked ? 'Invite partner' : 'Add couples'}
        </Text>
      </Pressable>
      {unlinked && onEnterCode ? (
        <Pressable onPress={onEnterCode} hitSlop={8} style={styles.codeLink}>
          <Text style={styles.codeLinkText}>Have their code?</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const DEMO_BURST = [
  { emoji: '❤️', x: 28 },
  { emoji: '🔥', x: 72 },
  { emoji: '😂', x: 116 },
  { emoji: '👏', x: 52 },
] as const;

function DemoPost() {
  const heart = useRef(new Animated.Value(0)).current;
  const fire = useRef(new Animated.Value(0)).current;
  const clap = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pop = (v: Animated.Value) =>
      Animated.spring(v, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      });

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(350),
        pop(heart),
        Animated.delay(160),
        pop(fire),
        Animated.delay(140),
        pop(clap),
        Animated.delay(120),
        Animated.timing(burst, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.parallel([
          Animated.timing(heart, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(fire, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(clap, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [burst, clap, fire, heart]);

  return (
    <View style={styles.demoWrap}>
      <View style={styles.demoCard}>
        <View style={styles.feedCardTop}>
          <Text style={styles.feedTime}>just now</Text>
          <Xp value={15} sign="+" size={13} />
        </View>
        <StoryLine
          leftName="Alex"
          leftColor="#2383e2"
          leftAvatar={require('../../assets/demo-alex.png')}
          verb="earned from"
          rightName="Maya"
          rightColor="#d9730d"
          rightAvatar={require('../../assets/demo-maya.png')}
          emoji="🌿"
          title="Mowed the lawn"
        />

        <View style={styles.demoReactions}>
          <DemoPill emoji="❤️" count="3" progress={heart} />
          <DemoPill emoji="🔥" count="2" progress={fire} />
          <DemoPill emoji="👏" count="1" progress={clap} />
        </View>
      </View>

      {DEMO_BURST.map((item) => (
        <Animated.Text
          key={item.emoji + item.x}
          pointerEvents="none"
          style={[
            styles.demoBurst,
            {
              left: item.x,
              opacity: burst.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateY: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, -46],
                  }),
                },
                {
                  scale: burst.interpolate({
                    inputRange: [0, 0.25, 1],
                    outputRange: [0.5, 1.2, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {item.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

function DemoPill({
  emoji,
  count,
  progress,
}: {
  emoji: string;
  count: string;
  progress: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        styles.reactionPill,
        styles.reactionPillMine,
        {
          opacity: progress,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.reactionEmoji}>{emoji}</Text>
      <Text style={styles.reactionCount}>{count}</Text>
    </Animated.View>
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
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [keyboardH, setKeyboardH] = useState(0);
  const comments: FeedComment[] = event.comments;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardH(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setText('');
    await onSubmitComment(value);
  }

  const lift = keyboardH > 0 ? keyboardH : Math.max(insets.bottom, 12);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.sheetBackdrop, { paddingBottom: lift }]}
        onPress={onClose}
      >
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sheetSend, !text.trim() && styles.sheetSendDisabled]}
              onPress={() => void submit()}
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
  flex: { flex: 1, backgroundColor: '#f3f3f2' },
  centerMuted: { textAlign: 'center', color: colors.inkMuted, padding: 16 },
  feedList: { gap: 12, paddingTop: 4, paddingBottom: 88 },
  requestList: { gap: 8, marginBottom: 8 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f7f6f3',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 10,
  },
  requestText: { flex: 1 },
  requestTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  requestBody: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  requestAccept: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestAcceptText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  requestDecline: { color: colors.inkMuted, fontSize: 17, paddingHorizontal: 3 },
  feedCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 18,
    paddingBottom: 16,
    marginBottom: 12,
    overflow: 'visible',
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
  storyPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storyReason: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    fontWeight: '500',
  },
  feedStory: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  coupleAvatars: {
    width: 58,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coupleSecondAvatar: {
    marginLeft: -12,
    borderWidth: 2,
    borderColor: colors.card,
    borderRadius: 20,
  },
  feedStoryText: { flex: 1 },
  feedLine: { fontSize: 16, lineHeight: 22, color: colors.ink },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  verb: { color: colors.inkMuted, fontWeight: '500', fontSize: 16, lineHeight: 22 },
  feedNote: { marginTop: 6, color: colors.ink, fontSize: 15, lineHeight: 20 },
  feedAmount: { paddingTop: 1 },
  emptyHome: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 80,
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
  addFriendButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 18,
    marginHorizontal: 24,
  },
  addFriendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  codeLink: { alignItems: 'center', marginTop: 10 },
  codeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  demoWrap: {
    marginHorizontal: 4,
    paddingTop: 28,
    overflow: 'visible',
  },
  demoCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 18,
    paddingBottom: 16,
  },
  demoReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    minHeight: 28,
  },
  demoBurst: {
    position: 'absolute',
    bottom: 36,
    fontSize: 22,
  },
  heroPhoto: {
    width: CARD_WIDTH,
    aspectRatio: 4 / 5,
    backgroundColor: '#eef1f4',
    marginTop: 14,
    marginHorizontal: -18,
  },
  carousel: { marginTop: 14, marginHorizontal: -18 },
  carouselImg: {
    width: CARD_WIDTH,
    aspectRatio: 4 / 5,
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
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    overflow: 'visible',
    zIndex: 2,
  },
  actionCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f3f2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  actionCircleLiked: { backgroundColor: '#fff0f5' },
  likedText: { color: '#ff5a8a' },
  actionCount: { fontSize: 12, fontWeight: '600', color: colors.ink2, marginLeft: 2 },
  pickerBackdrop: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000 },
  emojiPicker: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 6,
    ...shadow,
    zIndex: 10,
  },
  emojiChoice: {
    width: 34,
    height: 34,
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
