import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { api } from './api';
import { useAuth } from './auth';
import type { CoupleSearchResult } from './types';
import { Avatar } from './ui';
import { colors } from './theme';
import { APP_SHARE_URL, coupleShareMessage } from './utils';

export default function AddCouplesModal({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoupleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const shareAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
      setHasSearched(false);
      setSearchFocused(false);
      shareAnim.setValue(1);
    }
  }, [shareAnim, visible]);

  useEffect(() => {
    Animated.timing(shareAnim, {
      toValue: searchFocused ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [searchFocused, shareAnim]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void api
        .searchCouples(q)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setHasSearched(true);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError((err as Error).message);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  async function requestFriend(couple: CoupleSearchResult) {
    setSendingId(couple.id);
    setError(null);
    try {
      await api.requestFriend(couple.coupleUsername);
      setResults((current) =>
        current.map((item) =>
          item.id === couple.id ? { ...item, relationship: 'pending' } : item,
        ),
      );
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingId(null);
    }
  }

  async function shareProfile() {
    if (!user?.coupleUsername) return;
    await Share.share({
      message: coupleShareMessage(user.coupleUsername),
      url: APP_SHARE_URL,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add your friends</Text>
            <Text style={styles.subtitle}>
              Search a couple username. They have to accept before they show up
              on your feed.
            </Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>SEARCH COUPLE USERNAMES</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.at}>@</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(value) => {
              setQuery(
                value
                  .toLowerCase()
                  .replace(/^@/, '')
                  .replace(/[^a-z0-9_]/g, ''),
              );
              setError(null);
            }}
            placeholder="emmaandnoah"
            placeholderTextColor="#aaa8a4"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searching ? <ActivityIndicator color={colors.inkMuted} /> : null}
        </View>

        <Animated.View
          pointerEvents={searchFocused ? 'none' : 'auto'}
          style={[
            styles.shareBlock,
            {
              opacity: shareAnim,
              maxHeight: shareAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 160],
              }),
              marginTop: shareAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 4],
              }),
              marginBottom: shareAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 8],
              }),
            },
          ]}
        >
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.or}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.shareCard}>
            <View style={styles.shareText}>
              <Text style={styles.shareTitle}>Share your couple username</Text>
              <Text style={styles.shareHandle}>
                @{user?.coupleUsername ?? 'yourcouple'}
              </Text>
            </View>
            <Pressable
              style={styles.shareButton}
              disabled={!user?.coupleUsername}
              onPress={() => void shareProfile()}
            >
              <Text style={styles.shareButtonText}>Share now</Text>
            </Pressable>
          </View>
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScrollView
          style={results.length > 0 ? styles.resultsScroll : undefined}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
        >
          {query.length >= 2 && hasSearched && results.length === 0 && !searching ? (
            <Text style={styles.emptyHint}>No couples found.</Text>
          ) : null}
          {results.map((couple) => (
            <View key={couple.id} style={styles.result}>
              <View style={styles.avatars}>
                <Avatar
                  name={couple.name}
                  color={couple.color}
                  src={couple.avatarUrl}
                  size={36}
                />
                {couple.partnerName ? (
                  <View style={styles.partnerAvatar}>
                    <Avatar
                      name={couple.partnerName}
                      color={couple.partnerColor ?? colors.blue}
                      src={couple.partnerAvatar}
                      size={36}
                    />
                  </View>
                ) : null}
              </View>
              <View style={styles.resultText}>
                <Text style={styles.handle}>@{couple.coupleUsername}</Text>
                <Text style={styles.names}>
                  {couple.partnerName
                    ? `${couple.name} & ${couple.partnerName}`
                    : couple.name}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.addButton,
                  couple.relationship !== 'none' && styles.addButtonMuted,
                ]}
                disabled={
                  couple.relationship !== 'none' || sendingId === couple.id
                }
                onPress={() => void requestFriend(couple)}
              >
                <Text style={styles.addButtonText}>
                  {couple.relationship === 'friends'
                    ? 'Friends'
                    : couple.relationship === 'pending'
                      ? 'Requested'
                      : sendingId === couple.id
                        ? 'Sending…'
                        : 'Add'}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 28,
  },
  headerText: { flex: 1, paddingRight: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.7 },
  subtitle: { color: colors.inkMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  close: { paddingTop: 4 },
  closeText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  label: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  at: { color: colors.inkMuted, fontSize: 16, fontWeight: '700' },
  input: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 14, paddingLeft: 4 },
  resultsScroll: { maxHeight: 220 },
  results: { gap: 8 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avatars: { width: 54, flexDirection: 'row' },
  partnerAvatar: { marginLeft: -18 },
  resultText: { flex: 1 },
  handle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  names: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  addButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonMuted: { backgroundColor: '#deddd9' },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  shareBlock: { overflow: 'hidden', gap: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7f6f3',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  shareText: { flex: 1 },
  shareTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  shareHandle: { color: colors.inkMuted, fontSize: 13, marginTop: 3 },
  shareButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shareButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  emptyHint: {
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
