import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  getSeenApprovals,
  getSeenNotificationIds,
  setSeenApprovals,
} from '../storage';
import { colors } from '../theme';
import { Avatar, ReceiptIcon, ReceiptModal, Xp } from '../ui';
import { haptic } from '../utils';
import Feed from './Feed';
import Submit from './Submit';
import Redeem from './Redeem';
import Notifications from './Notifications';
import Profile from './Profile';
import type { Submission } from '../types';

export type Tab = 'feed' | 'submit' | 'redeem';

export default function MainApp({
  initialTab,
  openFirstReact,
  openReceipt,
}: {
  initialTab?: Tab;
  openFirstReact?: boolean;
  openReceipt?: boolean;
} = {}) {
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('feed');
  const [tick, setTick] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileFocusJoin, setProfileFocusJoin] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(false);
  const [approval, setApproval] = useState<Submission | null>(null);
  const [booted, setBooted] = useState(false);
  const notifOpenRef = useRef(false);

  const linked = Boolean(user?.partnerId);

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    void refresh();
  }, [refresh]);

  const loadPending = useCallback(async () => {
    if (!user) return;
    try {
      const items = await api.notifications();
      const seen = await getSeenNotificationIds(user.id);
      if (notifOpenRef.current) {
        setUnreadNotifs(false);
        return;
      }
      setUnreadNotifs(items.some((item) => !seen.includes(item.id)));
    } catch {
      /* ignore — e.g. brief auth race */
    }
  }, [user, user?.id]);

  useEffect(() => {
    void loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPending, tick]);

  useEffect(() => {
    if (!user || booted) return;
    if (initialTab) {
      setTab(initialTab);
      setBooted(true);
      return;
    }
    // Nothing to route to before a household exists — stay un-booted so this
    // runs for real the moment a partner links.
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, booted, initialTab]);

  useEffect(() => {
    if (!user || !user.partnerId) return;
    let cancelled = false;
    void (async () => {
      try {
        const subs = await api.submissions();
        const approved = subs.filter(
          (s) => s.status === 'approved' && s.boyfriendId === user.id,
        );
        const seen = await getSeenApprovals(user.id);
        if (seen === null) {
          await setSeenApprovals(
            user.id,
            approved.map((s) => s.id),
          );
          return;
        }
        const fresh = approved
          .filter((s) => !seen.includes(s.id))
          .sort((a, b) =>
            (b.resolvedAt ?? b.createdAt).localeCompare(
              a.resolvedAt ?? a.createdAt,
            ),
          );
        if (!cancelled && fresh[0]) setApproval(fresh[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  async function dismissApproval() {
    if (!user || !approval) {
      setApproval(null);
      return;
    }
    const seen = (await getSeenApprovals(user.id)) ?? [];
    await setSeenApprovals(user.id, [...new Set([...seen, approval.id])]);
    setApproval(null);
    void refresh();
  }

  if (!user) return null;

  function go(next: Tab) {
    haptic(10);
    setTab(next);
    setTick((n) => n + 1);
  }

  return (
    <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <ReceiptIcon size={18} color={colors.ink} />
          <Text style={styles.wordmarkSm}>LoveReceipts</Text>
        </View>
        <View style={styles.headerRight}>
          <Xp value={user.points} size={13} />
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => {
              haptic(10);
              notifOpenRef.current = true;
              setUnreadNotifs(false);
              setNotifOpen(true);
            }}
            hitSlop={6}
          >
            <Ionicons name="notifications-sharp" size={20} color={colors.ink} />
            {unreadNotifs && <View style={styles.unreadDot} />}
          </Pressable>
          <Pressable
            onPress={() => {
              haptic(10);
              setProfileFocusJoin(false);
              setProfileOpen(true);
            }}
            hitSlop={6}
          >
            <Avatar name={user.name} color={user.color} src={user.avatarUrl} size={28} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.main, tab === 'feed' && styles.homeMain]}>
        {tab === 'feed' && (
          <Feed
            key={`feed-${tick}`}
            openFirstReact={openFirstReact}
            onInvitePartner={linked ? undefined : () => go('submit')}
            onEnterCode={
              linked
                ? undefined
                : () => {
                    haptic(10);
                    setProfileFocusJoin(true);
                    setProfileOpen(true);
                  }
            }
          />
        )}
        {tab === 'submit' && (
          <Submit
            key={`submit-${tick}`}
            onDone={bump}
            onEnterCode={() => {
              haptic(10);
              setProfileFocusJoin(true);
              setProfileOpen(true);
            }}
          />
        )}
        {tab === 'redeem' && (
          <Redeem
            key={`redeem-${tick}`}
            user={user}
            onChange={bump}
            onEnterCode={() => {
              haptic(10);
              setProfileFocusJoin(true);
              setProfileOpen(true);
            }}
          />
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.tabBarDock,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        <View style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            <TabItem
              icon="home-sharp"
              label="Home"
              active={tab === 'feed'}
              onPress={() => go('feed')}
            />
            <TabItem
              icon="checkbox-sharp"
              label="Tasks"
              active={tab === 'submit'}
              onPress={() => go('submit')}
            />
            <TabItem
              icon="gift-sharp"
              label="Rewards"
              active={tab === 'redeem'}
              onPress={() => go('redeem')}
            />
          </View>
        </View>
      </View>

      {notifOpen && (
        <Notifications
          onClose={() => {
            notifOpenRef.current = false;
            setNotifOpen(false);
            setUnreadNotifs(false);
            void loadPending();
          }}
          onChanged={() => void loadPending()}
        />
      )}
      {profileOpen && (
        <Profile
          focusJoin={profileFocusJoin}
          onClose={() => {
            setProfileOpen(false);
            setProfileFocusJoin(false);
          }}
        />
      )}
      {approval && user && (
        <ReceiptModal
          kind="approve"
          subtitle={`${user.partnerName ?? 'Your partner'} just paid you +${approval.points} 💎.`}
          emoji={approval.emoji}
          itemTitle={approval.title}
          points={approval.points}
          fromName={user.partnerName ?? 'Partner'}
          toName={user.name}
          note="Your diamonds just landed."
          shareLabel="Share receipt"
          skipLabel="Done"
          onSkip={() => void dismissApproval()}
        />
      )}
    </SafeAreaView>
  );
}

function TabItem({
  icon,
  iconNode,
  label,
  active,
  badge,
  onPress,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconNode?: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const color = active ? colors.ink : colors.inkMuted;
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <View style={styles.tabIconWrap}>
        {iconNode ?? (
          <Ionicons name={icon ?? 'ellipse'} size={24} color={color} />
        )}
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
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  main: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  homeMain: { backgroundColor: '#f3f3f2' },
  tabBarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tabBarWrap: {
    borderRadius: 28,
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8,
    overflow: 'hidden',
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
  },
  tabLabel: { fontSize: 11, fontWeight: '500', color: colors.inkMuted },
  tabLabelActive: { color: colors.ink, fontWeight: '600' },
});
