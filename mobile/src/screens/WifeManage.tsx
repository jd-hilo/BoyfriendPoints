import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EarnTask, Prize, PublicUser } from '../types';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Button, Xp } from '../ui';
import { colors, radius, shadow } from '../theme';
import { haptic } from '../utils';

export default function WifeManage() {
  const { user, refresh } = useAuth();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tasks, setTasks] = useState<EarnTask[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [prizeForm, setPrizeForm] = useState({ emoji: '🎁', title: '', cost: '' });
  const [taskForm, setTaskForm] = useState({ emoji: '⭐', title: '', points: '' });
  const [friendForm, setFriendForm] = useState({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: 'points' });
  const [inviteHint, setInviteHint] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

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
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function addTask() {
    setError(null);
    try {
      await api.addTask(taskForm.title, Number(taskForm.points), taskForm.emoji);
      setTaskForm({ emoji: '⭐', title: '', points: '' });
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
      setInviteHint(null);
      setInviting(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invitePartner() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.inviteBoyfriend(inviteForm.name, inviteForm.email, inviteForm.password);
      haptic([10, 30, 10]);
      setInviteHint(res.loginHint);
      setInviteForm({ name: '', email: '', password: 'points' });
      setInviting(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Manage</Text>
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
      ) : inviting ? (
        <View style={styles.card}>
          <Text style={styles.mutedSmall}>
            They’ll get their own login to earn points and redeem prizes.
          </Text>
          <TextInput
            style={styles.input}
            value={inviteForm.name}
            onChangeText={(v) => setInviteForm({ ...inviteForm, name: v })}
            placeholder="Partner’s name"
          />
          <TextInput
            style={styles.input}
            value={inviteForm.email}
            onChangeText={(v) => setInviteForm({ ...inviteForm, email: v })}
            placeholder="Partner’s email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={inviteForm.password}
            onChangeText={(v) => setInviteForm({ ...inviteForm, password: v })}
            placeholder="Starter password"
          />
          <View style={styles.row}>
            <Button variant="secondary" block disabled={busy} onPress={() => setInviting(false)}>
              Cancel
            </Button>
            <Button
              block
              disabled={busy || !inviteForm.name || !inviteForm.email}
              onPress={invitePartner}
            >
              Send invite
            </Button>
          </View>
        </View>
      ) : (
        <View style={[styles.partnerCard, styles.partnerCardEmpty]}>
          <View style={styles.partnerCardText}>
            <Text style={styles.partnerCardName}>No partner linked</Text>
            <Text style={styles.partnerCardMeta}>Invite someone to earn and redeem with you.</Text>
            {inviteHint && (
              <Text style={styles.mutedSmall}>
                Last invite: <Text style={styles.bold}>{inviteHint.email}</Text> /{' '}
                <Text style={styles.bold}>{inviteHint.password}</Text>
              </Text>
            )}
          </View>
          <Button
            onPress={() => {
              setInviting(true);
              setError(null);
            }}
          >
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
      <View style={styles.card}>
        <Text style={styles.mutedSmall}>
          Add friends so their household wins show up on your Home feed.
        </Text>
        <TextInput
          style={styles.input}
          value={friendForm.name}
          onChangeText={(v) => setFriendForm({ ...friendForm, name: v })}
          placeholder="Friend’s name"
        />
        <TextInput
          style={styles.input}
          value={friendForm.email}
          onChangeText={(v) => setFriendForm({ ...friendForm, email: v })}
          placeholder="Friend’s email"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button
          disabled={!friendForm.email}
          onPress={async () => {
            setError(null);
            try {
              await api.addFriend(friendForm.name, friendForm.email);
              setFriendForm({ name: '', email: '' });
              haptic(10);
              await load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          Add friend
        </Button>
      </View>

      <Text style={styles.sectionLabel}>Prizes they can redeem</Text>
      <View style={styles.list}>
        {prizes.map((p) => (
          <View key={p.id} style={styles.miniRow}>
            <Text>
              {p.emoji} {p.title}
            </Text>
            <View style={styles.rowGap}>
              <Xp value={p.cost} size={12} />
              <Pressable onPress={() => api.removePrize(p.id).then(load)}>
                <Text style={styles.xBtn}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.card}>
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
            onChangeText={(v) => setPrizeForm({ ...prizeForm, title: v })}
            placeholder="New prize"
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.grow]}
            value={prizeForm.cost}
            onChangeText={(v) => setPrizeForm({ ...prizeForm, cost: v })}
            placeholder="Cost in points"
            keyboardType="number-pad"
          />
          <Button disabled={!prizeForm.title || !prizeForm.cost} onPress={addPrize}>
            Add
          </Button>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Ways they can earn</Text>
      <View style={styles.list}>
        {tasks.map((t) => (
          <View key={t.id} style={styles.miniRow}>
            <Text>
              {t.emoji} {t.title}
            </Text>
            <View style={styles.rowGap}>
              <Xp value={t.points} sign="+" size={12} />
              <Pressable onPress={() => api.removeTask(t.id).then(load)}>
                <Text style={styles.xBtn}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
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
            placeholder="Points"
            keyboardType="number-pad"
          />
          <Button disabled={!taskForm.title || !taskForm.points} onPress={addTask}>
            Add
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 12, paddingBottom: 32 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  error: { color: colors.red, fontSize: 13 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.inkMuted, marginTop: 8 },
  mutedSmall: { fontSize: 13, color: colors.inkMuted },
  bold: { fontWeight: '700' },
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
});
