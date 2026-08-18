import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { pickAndUploadPhoto } from '../pickImage';
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushEnabled,
} from '../push';
import { colors, radius, shadow } from '../theme';
import { Avatar, Button, CoupleLockup } from '../ui';
import { haptic } from '../utils';

export default function Profile({
  onClose,
  focusJoin,
}: {
  onClose: () => void;
  focusJoin?: boolean;
}) {
  const { user, applyUser, logout, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  // A rename elsewhere (or a pull-to-refresh) shouldn't leave a stale draft.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    if (!user) return;
    void isPushEnabled(user.id).then(setPushOn);
  }, [user?.id]);

  if (!user) return null;
  const me = user;
  const partnered = Boolean(me.partnerId && me.partnerName);
  const dirty = name.trim() !== me.name && name.trim().length > 0;

  async function saveName() {
    const next = name.trim();
    if (!next || next === me.name) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateProfile({ name: next });
      await applyUser(updated);
      setSaved(true);
      haptic(10);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pickFromLibrary() {
    setSaving(true);
    setError(null);
    try {
      const url = await pickAndUploadPhoto({ square: true });
      if (!url) return;
      const updated = await api.updateProfile({ avatarUrl: url });
      await applyUser(updated);
      haptic(10);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmSignOut() {
    haptic(10);
    Alert.alert(
      'Sign out?',
      'You’ll need your email and password to get back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  }

  async function leaveRelationship() {
    if (leaveBusy) return;
    setLeaveBusy(true);
    setError(null);
    try {
      const updated = await api.removePartner();
      await applyUser(updated);
      await refresh();
      setLeaveOpen(false);
      haptic(12);
    } catch (err) {
      setError((err as Error).message);
      setLeaveOpen(false);
    } finally {
      setLeaveBusy(false);
    }
  }

  async function togglePush(next: boolean) {
    if (pushBusy) return;
    haptic(10);
    setPushBusy(true);
    try {
      if (!next) {
        await disablePushNotifications(me.id);
        setPushOn(false);
        return;
      }
      // Let the switch settle so iOS will actually present the system sheet.
      await new Promise((r) => setTimeout(r, 250));
      const result = await enablePushNotifications(me.id);
      setPushOn(result === 'on');
      if (result === 'blocked') {
        Alert.alert(
          'Notifications are off',
          'LoveReceipts is blocked in iPhone Settings. Open Settings → Notifications → LoveReceipts and turn Allow Notifications on.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
      }
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} onPress={onClose}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={[styles.headerIconBtn, styles.spacer]} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              {partnered ? (
                <CoupleLockup
                  leftName={user.name}
                  leftColor={user.color}
                  leftSrc={user.avatarUrl}
                  rightName={user.partnerName}
                  rightColor={user.partnerColor}
                  rightSrc={user.partnerAvatar}
                  size={72}
                />
              ) : (
                <Avatar
                  name={user.name}
                  color={user.color}
                  src={user.avatarUrl}
                  size={88}
                />
              )}
              <Text style={styles.coupleName}>
                {partnered
                  ? `${user.name} & ${user.partnerName}`
                  : user.name}
              </Text>
              {user.coupleUsername ? (
                <Text style={styles.handle}>@{user.coupleUsername}</Text>
              ) : null}
              <Pressable
                style={styles.editPhoto}
                disabled={saving}
                onPress={() => void pickFromLibrary()}
              >
                <Text style={styles.editPhotoText}>
                  {saving ? 'Uploading…' : 'Change photo'}
                </Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.section}>YOUR NAME</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setSaved(false);
                }}
                placeholder="Your name"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
              />
              <Button
                block
                disabled={saving || !dirty}
                onPress={() => void saveName()}
              >
                {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save name'}
              </Button>
            </View>

            <Text style={styles.section}>ACCOUNT</Text>
            <View style={styles.card}>
              <Row label="Email" value={user.email} />
              {user.inviteCode ? (
                <Row label="Household code" value={user.inviteCode} />
              ) : null}
              {partnered ? (
                <>
                  <Row label="Partner" value={user.partnerName ?? ''} />
                  <Button
                    block
                    variant="ghost"
                    onPress={() => {
                      haptic(10);
                      setLeaveOpen(true);
                    }}
                  >
                    Leave relationship
                  </Button>
                </>
              ) : (
                <>
                  <Text style={styles.muted}>
                    If they already signed up, enter their household code.
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={joinCode}
                    onChangeText={(t) =>
                      setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder="Their household code"
                    placeholderTextColor={colors.inkMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus={focusJoin}
                    maxLength={8}
                  />
                  <Button
                    block
                    disabled={saving || joinCode.length < 4}
                    onPress={() =>
                      void (async () => {
                        setSaving(true);
                        setError(null);
                        try {
                          await api.joinWithCode(joinCode);
                          await refresh();
                          haptic(10);
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setSaving(false);
                        }
                      })()
                    }
                  >
                    Join household
                  </Button>
                </>
              )}
            </View>

            <Text style={styles.section}>SETTINGS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text style={styles.rowValueLeft}>Push notifications</Text>
                  <Text style={styles.muted}>
                    A ping whenever something lands in your inbox.
                  </Text>
                </View>
                <Switch
                  value={pushOn}
                  disabled={pushBusy}
                  onValueChange={(value) => void togglePush(value)}
                  trackColor={{ false: colors.border, true: colors.blue }}
                  thumbColor={colors.white}
                />
              </View>
              <Button
                block
                variant="ghost"
                onPress={() => void refresh()}
              >
                Refresh
              </Button>
              <Button block variant="danger" onPress={confirmSignOut}>
                Sign out
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        visible={leaveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveOpen(false)}
      >
        <Pressable style={styles.leaveBackdrop} onPress={() => setLeaveOpen(false)}>
          <Pressable style={styles.leaveCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.leaveTitle}>Leave this relationship?</Text>
            <Text style={styles.leaveBody}>
              You’ll lose all {user.points} of your points. Tasks and prizes stay
              saved if you and {user.partnerName} link back up — not if you join
              someone else.
            </Text>
            <Button
              block
              variant="danger"
              disabled={leaveBusy}
              onPress={() => void leaveRelationship()}
            >
              {leaveBusy ? 'Leaving…' : 'Leave and lose points'}
            </Button>
            <Button
              block
              variant="ghost"
              disabled={leaveBusy}
              onPress={() => setLeaveOpen(false)}
            >
              Stay
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
    zIndex: 60,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 12, gap: 8 },
  coupleName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: 8,
  },
  handle: { fontSize: 14, fontWeight: '600', color: colors.inkMuted },
  editPhoto: {
    marginTop: 4,
    backgroundColor: colors.panel,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editPhotoText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  error: { color: colors.red, fontSize: 13 },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: colors.inkMuted,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 14,
    gap: 10,
    ...shadow,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  rowLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  rowValue: { fontSize: 14, color: colors.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  rowValueLeft: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  grow: { flex: 1, minWidth: 0, gap: 2, paddingRight: 12 },
  muted: { fontSize: 13, color: colors.inkMuted },
  leaveBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,30,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  leaveCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 22,
    gap: 12,
  },
  leaveTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  leaveBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink2,
    marginBottom: 4,
  },
});
