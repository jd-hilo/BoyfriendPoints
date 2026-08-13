import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import type { EarnTask, Prize, PublicUser } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Button, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';
import AddCouplesModal from '../AddCouplesModal';

export default function WifeManage() {
  const { user, refresh } = useAuth();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasks, setTasks] = useState<EarnTask[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [addingPrize, setAddingPrize] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addCouplesOpen, setAddCouplesOpen] = useState(false);

  const hasPartner = Boolean(user?.partnerId && user.partnerName);

  const load = useCallback(async () => {
    const [p, t, f] = await Promise.all([api.prizes(), api.tasks(), api.friends()]);
    setPrizes(p);
    setTasks(t);
    setFriends(f);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPrize() {
    setError(null);
    try {
      await api.addPrize(prizeForm.title, Number(prizeForm.cost), prizeForm.emoji);
      setPrizeForm({ emoji: '🎁', title: '', cost: '' });
      setAddingPrize(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function closePrizeModal() {
    setAddingPrize(false);
    setPrizeForm({ emoji: '🎁', title: '', cost: '' });
  }

  async function addTask() {
    setError(null);
    try {
      await api.addTask(taskForm.title, Number(taskForm.points), taskForm.emoji);
      setTaskForm({ emoji: '⭐', title: '', points: '' });
      setAddingTask(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function confirmRemovePartner() {
    if (!user?.partnerName) return;
    Alert.alert(
      'Remove partner?',
      `Remove ${user.partnerName} as your partner? They’ll lose access to this household.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void removePartner() },
      ],
    );
  }

  async function removePartner() {
    setError(null);
    setBusy(true);
    try {
      await api.removePartner();
      haptic(12);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sharePartnerInvite() {
    const code = user?.inviteCode;
    if (!code) {
      setError('Invite code isn’t ready yet. Try again in a moment.');
      return;
    }
    const link = `lovereceipts://join/${code}`;
    const who = user.name.trim() || 'Your partner';
    await Share.share({
      message:
        `${who} invited you to LoveReceipts!\n\n` +
        `Use code ${code} to link our household and start earning points.\n\n` +
        `${link}`,
      url: link,
    });
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionLabel}>Partner</Text>
      {hasPartner ? (
        <View style={styles.partnerCard}>
          <Avatar name={user!.partnerName!} color={user!.partnerColor ?? colors.blue} src={user!.partnerAvatar} size={48} />
          <View style={styles.partnerCardText}>
            <Text style={styles.partnerCardName}>{user!.partnerName}</Text>
            <Text style={styles.partnerCardMeta}>Current partner</Text>
          </View>
          <Button variant="danger" disabled={busy} onPress={confirmRemovePartner}>
            Remove
          </Button>
        </View>
      ) : (
        <View style={[styles.partnerCard, styles.partnerCardEmpty]}>
          <View style={styles.partnerCardText}>
            <Text style={styles.partnerCardName}>No partner linked</Text>
            <Text style={styles.partnerCardMeta}>
              Share your invite so they can join and start earning.
            </Text>
            {user?.inviteCode ? (
              <Text style={styles.inviteCode} selectable>
                {user.inviteCode}
              </Text>
            ) : null}
          </View>
          <Button disabled={!user?.inviteCode} onPress={() => void sharePartnerInvite()}>
            Invite partner
          </Button>
        </View>
      )}

      <Text style={styles.sectionLabel}>Friends</Text>
      <View style={styles.list}>
        {friends.map((f) => (
          <View key={f.id} style={styles.miniRow}>
            <View style={styles.rowGap}>
              <Avatar name={f.name} color={f.color} src={f.avatarUrl} size={32} />
              <Text>{f.name}</Text>
            </View>
            <Text style={styles.mutedSmall}>on your feed</Text>
          </View>
        ))}
      </View>
      <Button block onPress={() => setAddCouplesOpen(true)}>
        Add couples
      </Button>

      <View style={styles.block}>
        <Text style={styles.blockKicker}>EARN</Text>
        <Text style={styles.blockTitle}>Ways they can earn</Text>
        <Text style={styles.blockSub}>
          Tasks your partner does to get points.
        </Text>
        <View style={styles.grid}>
          {tasks.map((t) => (
            <SquareTile
              key={t.id}
              emoji={t.emoji}
              title={t.title}
              points={t.points}
              sign="+"
              onRemove={() => api.removeTask(t.id).then(load)}
            />
          ))}
          <AddTile
            label="Add task"
            onPress={() => {
              setAddingTask(true);
              setAddingPrize(false);
            }}
          />
        </View>
        {addingTask && (
          <View style={styles.card}>
            <View style={styles.row}>
              <TextInput
                style={styles.emojiInput}
                value={taskForm.emoji}
                onChangeText={(v) => setTaskForm({ ...taskForm, emoji: v })}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.grow]}
                value={taskForm.title}
                onChangeText={(v) => setTaskForm({ ...taskForm, title: v })}
                placeholder="New task"
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.grow]}
                value={taskForm.points}
                onChangeText={(v) => setTaskForm({ ...taskForm, points: v })}
                placeholder="Points they earn"
                keyboardType="number-pad"
              />
              <Button disabled={!taskForm.title || !taskForm.points} onPress={addTask}>
                Add
              </Button>
            </View>
            <Pressable onPress={() => setAddingTask(false)}>
              <Text style={styles.cancelAdd}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockKicker}>REDEEM</Text>
        <Text style={styles.blockTitle}>Prizes they can get</Text>
        <Text style={styles.blockSub}>
          Rewards they cash points in for.
        </Text>
        <View style={styles.grid}>
          {prizes.map((p) => (
            <SquareTile
              key={p.id}
              emoji={p.emoji}
              title={p.title}
              points={p.cost}
              sign="−"
              onRemove={() => api.removePrize(p.id).then(load)}
            />
          ))}
        </View>
        <Button
          block
          onPress={() => {
            setAddingPrize(true);
            setAddingTask(false);
            setError(null);
          }}
        >
          New prize
        </Button>
      </View>
      <AddCouplesModal
        visible={addCouplesOpen}
        onClose={() => setAddCouplesOpen(false)}
        onChanged={() => void load()}
      />
      <Modal
        visible={addingPrize}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePrizeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>New prize</Text>
              <Text style={styles.modalSub}>
                Something they can cash points in for.
              </Text>
            </View>
            <Pressable onPress={closePrizeModal} hitSlop={8}>
              <Text style={styles.modalClose}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <TextInput
              style={styles.emojiInput}
              value={prizeForm.emoji}
              onChangeText={(v) => setPrizeForm({ ...prizeForm, emoji: v })}
              maxLength={2}
            />
            <TextInput
              style={[styles.input, styles.grow]}
              value={prizeForm.title}
              onChangeText={(v) => {
                setPrizeForm({ ...prizeForm, title: v });
                if (error) setError(null);
              }}
              placeholder="Prize name"
              autoFocus
            />
          </View>
          <TextInput
            style={styles.input}
            value={prizeForm.cost}
            onChangeText={(v) => setPrizeForm({ ...prizeForm, cost: v })}
            placeholder="Cost in points"
            keyboardType="number-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            block
            disabled={!prizeForm.title.trim() || !prizeForm.cost}
            onPress={() => void addPrize()}
          >
            Add prize
          </Button>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function SquareTile({
  emoji,
  title,
  points,
  sign,
  onRemove,
}: {
  emoji: string;
  title: string;
  points: number;
  sign: '+' | '−';
  onRemove: () => void;
}) {
  return (
    <View style={styles.tile}>
      <Pressable style={styles.tileRemove} onPress={onRemove} hitSlop={8}>
        <Text style={styles.xBtn}>✕</Text>
      </Pressable>
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {title}
      </Text>
      <Xp value={points} sign={sign} size={12} />
    </View>
  );
}

function AddTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.tile, styles.tileAdd]} onPress={onPress}>
      <Text style={styles.tileAddPlus}>+</Text>
      <Text style={styles.tileAddLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingBottom: 32 },
  error: { color: colors.red, fontSize: 13 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, marginTop: 8 },
  mutedSmall: { fontSize: 13, color: colors.inkMuted },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, gap: 10, ...shadow },
  row: { flexDirection: 'row', gap: 8 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  list: { gap: 10 },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    ...shadow,
  },
  xBtn: { color: colors.inkMuted, fontSize: 14 },
  block: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  blockKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.inkMuted,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  blockSub: {
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: 6,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  tileRemove: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 1,
  },
  tileEmoji: { fontSize: 28 },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 17,
  },
  tileAdd: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tileAddPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.inkMuted,
    lineHeight: 32,
  },
  tileAddLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  cancelAdd: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  modalSheet: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  modalSub: {
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: 4,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkMuted,
    paddingTop: 4,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    ...shadow,
  },
  partnerCardEmpty: { alignItems: 'flex-start' },
  partnerCardText: { flex: 1, gap: 2 },
  partnerCardName: { fontWeight: '800', fontSize: 16, letterSpacing: -0.2, color: colors.ink },
  partnerCardMeta: { fontSize: 13, color: colors.inkMuted },
  inviteCode: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.ink,
  },
});
