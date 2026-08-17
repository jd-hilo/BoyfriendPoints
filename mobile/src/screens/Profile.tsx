import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { pickAndUploadPhoto } from '../pickImage';
import { colors, radius, shadow } from '../theme';
import { Avatar, Button, CoupleLockup } from '../ui';
import { haptic } from '../utils';

export default function Profile({ onClose }: { onClose: () => void }) {
  const { user, applyUser, logout, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const me = user;

  const partnered = Boolean(me.partnerId && me.partnerName);
  const dirty = name.trim() !== me.name && name.trim().length > 0;

  async function saveName() {
    const next = name.trim();
    if (!next || next === me.name) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile({ name: next });
      await applyUser(updated);
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

  const roleLabel =
    user.role === 'wife' ? 'Sets the prizes' : 'Earns and redeems';

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
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
              />
              {dirty && (
                <Button
                  block
                  disabled={saving}
                  onPress={() => void saveName()}
                >
                  {saving ? 'Saving…' : 'Save name'}
                </Button>
              )}
            </View>

            <Text style={styles.section}>ACCOUNT</Text>
            <View style={styles.card}>
              <Row label="Role" value={roleLabel} />
              <Row label="Email" value={user.email} />
              {user.role === 'wife' && user.inviteCode ? (
                <Row label="Household code" value={user.inviteCode} />
              ) : null}
              {partnered ? (
                <Row label="Partner" value={user.partnerName ?? ''} />
              ) : (
                <Text style={styles.muted}>
                  No partner linked yet.
                </Text>
              )}
            </View>

            <Text style={styles.section}>SETTINGS</Text>
            <View style={styles.card}>
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
  muted: { fontSize: 13, color: colors.inkMuted },
});
