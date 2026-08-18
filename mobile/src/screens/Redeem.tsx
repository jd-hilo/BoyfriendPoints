import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Prize, PublicUser, Redemption } from '../types';
import { api } from '../api';
import { Button, CoupleLockup, EmojiField, ReceiptModal, WhoPill, Xp } from '../ui';
import { colors, radius, shadow, TAB_BAR_FLOAT_HEIGHT } from '../theme';
import { APP_SHARE_URL, haptic, partnerWaitingShareMessage } from '../utils';

interface SuccessInfo {
  id: string;
  title: string;
  emoji: string;
  cost: number;
}

export default function Redeem({
  user,
  onChange,
  onEnterCode,
}: {
  user: PublicUser;
  onChange: () => void;
  onEnterCode?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [created, setCreated] = useState<Prize[]>([]);
  const [pending, setPending] = useState<Redemption[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [addingPrize, setAddingPrize] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [sharing, setSharing] = useState(false);
  const [scope, setScope] = useState<'you' | 'them'>('you');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api.prizes();
      setPrizes(all.filter((p) => user.partnerId && p.wifeId === user.partnerId));
      setCreated(all.filter((p) => p.wifeId === user.id));
      const redemptions = await api.redemptions();
      setPending(redemptions.filter((r) => r.boyfriendId === user.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [user.id, user.partnerId]);

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
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  const held = pending.reduce((sum, r) => sum + r.cost, 0);
  const partner = user.partnerName ?? 'your partner';
  const partnerFirst = user.partnerName?.trim().split(/\s+/)[0] ?? 'them';
  const linked = Boolean(user.partnerId);

  async function invitePartner() {
    haptic(10);
    const who = user.name.trim() || 'Your partner';
    await Share.share({
      message: partnerWaitingShareMessage(who, user.inviteCode),
      url: APP_SHARE_URL,
    });
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 24 + TAB_BAR_FLOAT_HEIGHT + Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Rewards</Text>
        <WhoPill
          value={scope}
          themLabel={`For ${partnerFirst}`}
          onChange={(next) => {
            haptic(8);
            setScope(next);
          }}
        />
      </View>
      <LoadFade ready={loaded} identity={scope}>
        {scope === 'you' && (
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <View>
            <Text style={styles.balanceLabel}>Your balance</Text>
            <View style={styles.balanceValue}>
              <Xp value={user.points} size={18} large />
            </View>
          </View>
          <CoupleLockup
            leftName={user.name}
            leftColor={user.color}
            leftSrc={user.avatarUrl}
            rightName={user.partnerName}
            rightColor={user.partnerColor}
            rightSrc={user.partnerAvatar}
            size={44}
          />
        </View>
        {held > 0 && (
          <View style={styles.holdRow}>
            <Ionicons name="time-outline" size={13} color={colors.inkMuted} />
            <Text style={styles.holdText}>
              {held} 💎 already spent on{' '}
              {pending.length === 1
                ? `${pending[0].emoji} ${pending[0].prizeTitle}`
                : `${pending.length} prizes`}
              , waiting on {partner}.
            </Text>
          </View>
        )}
      </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {scope === 'you' && (prizes.length === 0 ? (
        <View style={styles.empty}>
          {linked ? (
            <View style={[styles.tile, styles.tileLocked]}>
              <Ionicons name="lock-closed" size={18} color={colors.inkMuted} />
              <Text style={styles.tileEmoji}>🎁</Text>
              <Text style={styles.tileTitle}>Movie night</Text>
              <Xp value={40} size={12} />
            </View>
          ) : null}
          <Text style={styles.emptyTitle}>
            {linked ? 'No prizes yet' : 'Add your partner first'}
          </Text>
          <Text style={styles.emptyBody}>
            {linked
              ? `Ask ${partner} to add rewards you can cash points in for.`
              : 'Invite them, or enter their code if they already signed up.'}
          </Text>
          {linked ? null : (
            <>
              <Button
                block
                disabled={!user.inviteCode}
                onPress={() => void invitePartner()}
              >
                Invite partner
              </Button>
              {onEnterCode ? (
                <Pressable
                  onPress={() => {
                    haptic(8);
                    onEnterCode();
                  }}
                  hitSlop={8}
                  style={styles.codeLink}
                >
                  <Text style={styles.codeLinkText}>Have their code?</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <View style={styles.grid}>
          {prizes.map((p) => {
            const heldPrize = pending.find(
              (r) => r.prizeTitle === p.title && r.emoji === p.emoji,
            );
            const affordable = user.points >= p.cost;
            const locked = Boolean(heldPrize) || !affordable;
            return (
              <Pressable
                key={p.id}
                style={[styles.tile, locked && styles.tileLocked]}
                disabled={locked || busy === p.id || !!success}
                onPress={() => void redeem(p)}
              >
                {locked && (
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
                  {heldPrize
                    ? `Waiting on ${partner}`
                    : affordable
                      ? busy === p.id
                        ? 'Redeeming…'
                        : 'Tap to redeem'
                      : `Need ${p.cost - user.points} more`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

        {scope === 'them' && (
      <>
      <View style={styles.grid}>
        {created.map((p) => (
          <View key={p.id} style={styles.tile}>
            <Pressable
              style={styles.tileRemove}
              onPress={() => void api.removePrize(p.id).then(load)}
              hitSlop={8}
            >
              <Text style={styles.xBtn}>✕</Text>
            </Pressable>
            <Text style={styles.tileEmoji}>{p.emoji}</Text>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {p.title}
            </Text>
            <Xp value={p.cost} size={12} />
          </View>
        ))}
        <Pressable
          style={[styles.tile, styles.tileAdd]}
          onPress={() => {
            haptic(10);
            setError(null);
            setAddingPrize(true);
          }}
        >
          <View style={styles.tileAddInner}>
            <Ionicons name="gift-outline" size={30} color={colors.inkMuted} />
            <View style={styles.tileAddCopy}>
              <Text style={styles.tileAddLabel}>Add a prize</Text>
              <Text style={styles.tileAddSub}>For {partnerFirst}</Text>
            </View>
          </View>
        </Pressable>
      </View>
      </>
        )}
      </LoadFade>

      <Modal
        visible={addingPrize}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setAddingPrize(false);
          setPrizeForm({ emoji: '🎁', title: '', cost: '' });
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <View style={styles.grow}>
                <Text style={styles.modalTitle}>Add a prize</Text>
                <Text style={styles.modalSub}>
                  {partnerFirst === 'them'
                    ? 'They can cash points in for this.'
                    : `${partnerFirst} can cash points in for this.`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setAddingPrize(false);
                  setPrizeForm({ emoji: '🎁', title: '', cost: '' });
                }}
                hitSlop={8}
              >
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.row}>
              <EmojiField
                value={prizeForm.emoji}
                onChange={(emoji) => setPrizeForm({ ...prizeForm, emoji })}
                autoFocus
              />
              <TextInput
                style={[styles.input, styles.grow]}
                value={prizeForm.title}
                onChangeText={(v) => setPrizeForm({ ...prizeForm, title: v })}
                placeholder={`A prize for ${partnerFirst}`}
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            <TextInput
              style={styles.input}
              value={prizeForm.cost}
              onChangeText={(v) =>
                setPrizeForm({ ...prizeForm, cost: v.replace(/[^0-9]/g, '') })
              }
              placeholder="Cost in points"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
            />
            <Button
              block
              disabled={!prizeForm.title.trim() || !prizeForm.cost}
              onPress={async () => {
                setError(null);
                try {
                  await api.addPrize(
                    prizeForm.title,
                    Number(prizeForm.cost),
                    prizeForm.emoji,
                  );
                  setPrizeForm({ emoji: '🎁', title: '', cost: '' });
                  setAddingPrize(false);
                  await load();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Add prize
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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

function LoadFade({
  ready,
  identity,
  children,
}: {
  ready: boolean;
  identity: string;
  children: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!ready) return;
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [identity, opacity, ready, translateY]);

  if (!ready) return null;
  return (
    <Animated.View
      style={[styles.loadedContent, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingTop: 10, paddingBottom: 24 },
  loadedContent: { gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 18,
    gap: 2,
    marginBottom: 4,
    ...shadow,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  balanceLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  balanceValue: { marginTop: 8, alignSelf: 'flex-start' },
  holdRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 10,
  },
  holdText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.inkMuted, fontSize: 13, marginTop: -8 },
  error: { color: colors.red, fontSize: 13 },
  empty: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingTop: 12,
    gap: 8,
  },
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
  codeLink: { paddingVertical: 6 },
  codeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    marginTop: 4,
  },
  tileRemove: { position: 'absolute', top: 8, right: 10, zIndex: 1 },
  xBtn: { color: colors.inkMuted, fontSize: 14 },
  tileAdd: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tileAddInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tileAddCopy: {
    alignItems: 'center',
    gap: 3,
  },
  tileAddLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  tileAddSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    textAlign: 'center',
  },
  modalSheet: { flex: 1, backgroundColor: colors.bg },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  modalSub: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkMuted,
    paddingTop: 4,
  },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  input: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.bg,
    color: colors.ink,
  },
  emojiInput: {
    width: 52,
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bg,
    fontSize: 16,
  },
});
