import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import { getCoachSeen, setCoachSeen } from '../storage';
import { colors } from '../theme';
import { Avatar, Xp } from '../ui';
import { haptic } from '../utils';
import Feed from './Feed';
import Submit from './Submit';
import Redeem from './Redeem';
import WifeRequests from './WifeRequests';
import WifeManage from './WifeManage';
import Notifications from './Notifications';

type Tab = 'feed' | 'submit' | 'redeem' | 'requests' | 'manage';

export default function MainApp() {
  const { user, logout, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [booted, setBooted] = useState(false);

  const isWife = user?.role === 'wife';

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    void refresh();
  }, [refresh]);

  const loadPending = useCallback(async () => {
    if (!isWife) return;
    try {
      const [subs, redemptions] = await Promise.all([
        api.submissions(),
        api.redemptions(),
      ]);
      setPending(subs.length + redemptions.length);
    } catch {
      /* ignore — e.g. brief auth race */
    }
  }, [isWife]);

  useEffect(() => {
    void loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPending, tick]);

  useEffect(() => {
    if (!user || booted) return;
    let cancelled = false;
    void (async () => {
      if (user.role === 'wife') {
        const [subs, redemptions] = await Promise.all([
          api.submissions(),
          api.redemptions(),
        ]);
        if (cancelled) return;
        const count = subs.length + redemptions.length;
        setPending(count);
        if (count > 0) setTab('requests');
      } else {
        const seen = await getCoachSeen(user.id);
        if (!seen) {
          setCoachOpen(true);
          setTab('submit');
        }
      }
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, booted]);

  async function dismissCoach() {
    if (!user) return;
    await setCoachSeen(user.id);
    setCoachOpen(false);
  }

  if (!user) return null;

  const midTab: Tab = isWife ? 'requests' : 'submit';
  const rightTab: Tab = isWife ? 'manage' : 'redeem';
  const midLabel = isWife ? 'Review' : 'Submit';
  const rightLabel = isWife ? 'Manage' : 'Redeem';

  function go(next: Tab) {
    haptic(10);
    setTab(next);
    setTick((n) => n + 1);
  }

  return (
    <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <Text style={styles.brandGem}>🧾</Text>
          <Text style={styles.wordmarkSm}>LoveReceipts</Text>
        </View>
        <View style={styles.headerRight}>
          {!isWife && <Xp value={user.points} size={13} />}
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => {
              haptic(10);
              setNotifOpen(true);
            }}
            hitSlop={6}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {isWife && pending > 0 && (
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>{pending}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => void logout()} hitSlop={6}>
            <Avatar name={user.name} color={user.color} src={user.avatarUrl} size={28} />
          </Pressable>
        </View>
      </View>

      <View style={styles.main}>
        {tab === 'feed' && <Feed key={`feed-${tick}`} />}
        {tab === 'submit' && (
          <Submit
            key={`submit-${tick}`}
            onDone={bump}
            coachOpen={coachOpen}
            onCoachDismiss={dismissCoach}
          />
        )}
        {tab === 'redeem' && <Redeem key={`redeem-${tick}`} user={user} onChange={bump} />}
        {tab === 'requests' && <WifeRequests onChange={bump} />}
        {tab === 'manage' && <WifeManage key={`man-${tick}`} />}
      </View>

      <View style={styles.tabBar}>
        <TabItem
          glyph="⌂"
          label="Home"
          active={tab === 'feed'}
          onPress={() => go('feed')}
        />
        <TabItem
          glyph={isWife ? '✓' : '＋'}
          label={midLabel}
          active={tab === midTab}
          badge={isWife && pending > 0 ? pending : undefined}
          onPress={() => go(midTab)}
        />
        <TabItem
          glyph="🎁"
          label={rightLabel}
          active={tab === rightTab}
          onPress={() => go(rightTab)}
        />
      </View>

      {notifOpen && <Notifications onClose={() => setNotifOpen(false)} />}
    </SafeAreaView>
  );
}

function TabItem({
  glyph,
  label,
  active,
  badge,
  onPress,
}: {
  glyph: string;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
        <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
          {glyph}
        </Text>
        {badge !== undefined && (
          <View style={styles.iconBadge}>
            <Text style={styles.iconBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandGem: { fontSize: 17 },
  wordmarkSm: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  iconBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  iconBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  main: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    minHeight: 48,
    justifyContent: 'center',
  },
  tabIconWrap: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tabIconWrapActive: {
    backgroundColor: colors.panel,
  },
  tabIcon: { fontSize: 20, color: colors.inkMuted },
  tabIconActive: { color: colors.ink },
  tabLabel: { fontSize: 11, fontWeight: '500', color: colors.inkMuted },
  tabLabelActive: { color: colors.ink, fontWeight: '600' },
});
