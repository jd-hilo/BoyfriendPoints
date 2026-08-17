import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, radius, shadow } from '../theme';
import { APP_SHARE_URL, haptic } from '../utils';

/**
 * Everything a redeemer can do lives inside a household, so an unlinked
 * redeemer gets this instead of the tab bar until they enter a code.
 */
export default function LinkPartner() {
  const { user, refresh } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'join' | 'role' | null>(null);

  async function join() {
    setError(null);
    setBusy('join');
    try {
      await api.joinWithCode(code);
      haptic([10, 40, 10]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function becomePrizeSetter() {
    setError(null);
    setBusy('role');
    try {
      await api.setRole('wife');
      haptic(12);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function nudgePartner() {
    const who = user?.name.trim() || 'Your partner';
    await Share.share({
      message:
        `${who} is waiting for you on LoveReceipts!\n\n` +
        `Sign up, pick “I'll set the prizes”, and send me the 6-character ` +
        `household code so we can link up.\n\n${APP_SHARE_URL}`,
      url: APP_SHARE_URL,
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Link your partner</Text>
        <Text style={styles.subtitle}>
          LoveReceipts only works as a pair. The partner who sets the prizes has
          a 6-character household code — enter it to start earning.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            if (error) setError(null);
          }}
          placeholder="ABC123"
          placeholderTextColor="#b9b7b3"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (code.length < 4 || !!busy || pressed) && styles.btnMuted,
          ]}
          disabled={code.length < 4 || !!busy}
          onPress={() => void join()}
        >
          {busy === 'join' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Join household</Text>
          )}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>No code yet?</Text>
          <Text style={styles.cardBody}>
            Your partner needs to sign up first and choose “I&apos;ll set the
            prizes”. Their code is on their Manage tab.
          </Text>
          <Pressable style={styles.secondaryBtn} onPress={() => void nudgePartner()}>
            <Text style={styles.secondaryBtnText}>Send them the app</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.switchRole}
          disabled={!!busy}
          onPress={() => void becomePrizeSetter()}
        >
          <Text style={styles.switchRoleText}>
            {busy === 'role'
              ? 'Switching…'
              : 'Actually, I’m the one setting the prizes'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 40, gap: 14 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.ink,
  },
  subtitle: {
    color: colors.ink2,
    fontSize: 15,
    lineHeight: 21,
    marginTop: -8,
  },
  error: { color: colors.red, fontSize: 13 },
  codeInput: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    backgroundColor: colors.panel,
    color: colors.ink,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnMuted: { opacity: 0.45 },
  card: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
    gap: 8,
    ...shadow,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  secondaryBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  switchRole: { alignItems: 'center', paddingVertical: 12 },
  switchRoleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
    textDecorationLine: 'underline',
  },
});
