import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
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
import WifeRequests from './WifeRequests';
import WifeManage from './WifeManage';
import Notifications from './Notifications';
import LinkPartner from './LinkPartner';
import Profile from './Profile';
import type { Submission } from '../types';

export type Tab = 'feed' | 'submit' | 'redeem' | 'requests' | 'manage';

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
  const [pending, setPending] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(false);
  const [approval, setApproval] = useState<Submission | null>(null);
  const [booted, setBooted] = useState(false);

  const isWife = user?.role === 'wife';
  // A prize-setter owns a household on their own; a redeemer only has one
  // once they've joined with an invite code.
  const linked = Boolean(user?.partnerId);
  const hasHousehold = isWife || linked;

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    void refresh();
  }, [refresh]);

  const loadPending = useCallback(async () => {
    if (!hasHousehold) {
      setPending(0);
      return;
    }
    try {
      if (isWife && linked) {
        const [subs, redemptions] = await Promise.all([
          api.submissions(),
          api.redemptions(),
        ]);
        setPending(subs.length + redemptions.length);
      } else {
        setPending(0);
      }
      if (user) {
        const items = await api.notifications();
        const seen = await getSeenNotificationIds(user.id);
        setUnreadNotifs(items.some((item) => !seen.includes(item.id)));
      }
    } catch {
      /* ignore — e.g. brief auth race */
    }
  }, [hasHousehold, isWife, linked, user, user?.id, user?.partnerId, user?.role]);

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
    if (!user.partnerId) return;
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
      }
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, booted, initialTab]);

  useEffect(() => {
    if (!user || user.role !== 'boyfriend' || !user.partnerId) return;
    let cancelled = false;
    void (async () => {
      try {
        const subs = await api.submissions();
        const approved = subs.filter((s) => s.status === 'approved');
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

  // A redeemer with no household has no tasks, prizes, or feed to show —
  // linking a partner is the only thing they can meaningfully do.
  if (!linked && !isWife) {
    return (
      <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.brandLockup}>
            <ReceiptIcon size={18} color={colors.ink} />
            <Text style={styles.wordmarkSm}>LoveReceipts</Text>
          </View>
          <Pressable
            onPress={() => {
              haptic(10);
              setProfileOpen(true);
            }}
            hitSlop={6}
          >
            <Avatar name={user.name} color={user.color} src={user.avatarUrl} size={28} />
          </Pressable>
        </View>
        <View style={styles.main}>
          <LinkPartner />
        </View>
        {profileOpen && <Profile onClose={() => setProfileOpen(false)} />}
      </SafeAreaView>
    );
  }

  const midTab: Tab = isWife ? 'requests' : 'submit';
  const rightTab: Tab = isWife ? 'manage' : 'redeem';
  const midLabel = isWife ? 'Review' : 'Submit';
  const rightLabel = isWife ? 'Manage' : 'Redeem';

  function go(next: Tab) {
    haptic(10);
    setTab(next);
    setTick((n) => n + 1);
    void refresh();
  }

  return (
    <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.brandLockup}>
          <ReceiptIcon size={18} color={colors.ink} />
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
            <Ionicons name="notifications-sharp" size={20} color={colors.ink} />
            {unreadNotifs && <View style={styles.unreadDot} />}
          </Pressable>
          <Pressable
            onPress={() => {
              haptic(10);
              setProfileOpen(true);
            }}
            hitSlop={6}
          >
            <Avatar name={user.name} color={user.color} src={user.avatarUrl} size={28} />
          </Pressable>
        </View>
      </View>

      <View style={styles.main}>
        {tab === 'feed' && (
          <Feed
            key={`feed-${tick}`}
            openFirstReact={openFirstReact}
            onInvitePartner={linked ? undefined : () => go('manage')}
          />
        )}
        {tab === 'submit' && (
          <Submit key={`submit-${tick}`} onDone={bump} />
        )}
        {tab === 'redeem' && <Redeem key={`redeem-${tick}`} user={user} onChange={bump} />}
        {tab === 'requests' && (
          <WifeRequests
            onChange={bump}
            onAddPrizes={() => go('manage')}
            openReceipt={openReceipt}
          />
        )}
        {tab === 'manage' && <WifeManage key={`man-${tick}`} />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
        <TabItem
          icon="home-sharp"
          label="Home"
          active={tab === 'feed'}
          onPress={() => go('feed')}
        />
        <TabItem
          icon={isWife ? undefined : 'add-sharp'}
          iconNode={
            isWife ? <ReceiptIcon size={22} color="#fff" /> : undefined
          }
          label={midLabel}
          active={tab === midTab}
          badge={isWife && pending > 0 ? pending : undefined}
          primary
          onPress={() => go(midTab)}
        />
        <TabItem
          icon={isWife ? 'grid-sharp' : 'gift-sharp'}
          label={rightLabel}
          active={tab === rightTab}
          onPress={() => go(rightTab)}
        />
      </View>

      {notifOpen && (
        <Notifications
          onClose={() => {
            setNotifOpen(false);
            setUnreadNotifs(false);
            void loadPending();
          }}
          onChanged={() => void loadPending()}
        />
      )}
      {profileOpen && <Profile onClose={() => setProfileOpen(false)} />}
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
  primary,
  onPress,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconNode?: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  primary?: boolean;
  onPress: () => void;
}) {
  const color = primary
    ? '#fff'
    : active
      ? colors.ink
      : colors.inkMuted;
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <View
        style={[
          styles.tabIconWrap,
          active && styles.tabIconWrapActive,
          primary && styles.tabPrimaryIconWrap,
        ]}
      >
        {iconNode ?? (
          <Ionicons
            name={icon ?? 'ellipse'}
            size={primary ? 28 : 24}
            color={color}
            style={primary ? styles.tabPrimaryIcon : undefined}
          />
        )}
        {badge !== undefined && (
          <View style={styles.iconBadge}>
            <Text style={styles.iconBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive, primary && styles.tabPrimaryLabel]}>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
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
  tabPrimaryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    // The base wrap's padding would shrink the content box to 28pt and shove
    // the glyph off-centre inside the circle.
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginTop: -26,
    borderWidth: 4,
    borderColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  // Default line height leaves descender space under the glyph, which reads as
  // the icon sitting low in the circle.
  tabPrimaryIcon: {
    lineHeight: 28,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabPrimaryLabel: { marginTop: 2 },
  tabLabel: { fontSize: 11, fontWeight: '500', color: colors.inkMuted },
  tabLabelActive: { color: colors.ink, fontWeight: '600' },
});
