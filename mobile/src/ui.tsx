import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { colors, gradients, radius, shadow } from './theme';
import {
  RECEIPT_HEADLINE,
  shareReceiptImage,
  signFor,
  type ReceiptData,
  type ReceiptKind,
} from './receipt';

export function XpIcon({ size = 14 }: { size?: number }) {
  return <Text style={{ fontSize: size, lineHeight: size + 2 }}>💎</Text>;
}

/** Minimal receipt mark — the LoveReceipts brand icon. */
export function ReceiptIcon({
  size = 28,
  color = colors.black,
}: {
  size?: number;
  color?: string;
}) {
  const w = size * 0.72;
  const h = size;
  const lineW = w * 0.55;
  const stroke = Math.max(1.4, size * 0.06);
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 3,
        borderWidth: stroke,
        borderColor: color,
        backgroundColor: 'transparent',
        paddingTop: h * 0.18,
        paddingHorizontal: w * 0.18,
        gap: h * 0.08,
      }}
    >
      <View
        style={{
          width: lineW,
          height: stroke,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          width: lineW * 0.72,
          height: stroke,
          backgroundColor: color,
          borderRadius: 1,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          width: lineW * 0.9,
          height: stroke,
          backgroundColor: color,
          borderRadius: 1,
          opacity: 0.35,
        }}
      />
      <View
        style={{
          marginTop: 'auto',
          marginBottom: h * 0.12,
          width: lineW * 0.45,
          height: stroke,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

/** Points value in the shared blue gradient XP banner. */
export function Xp({
  value,
  size = 13,
  sign,
  large,
}: {
  value: number;
  size?: number;
  sign?: '+' | '-' | '−' | '';
  large?: boolean;
}) {
  return (
    <LinearGradient
      colors={gradients.xp}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.xp, large && styles.xpLarge]}
    >
      <XpIcon size={large ? Math.max(size, 18) : size} />
      <Text
        style={[
          styles.xpValue,
          { fontSize: large ? 22 : size, marginLeft: large ? 6 : 4 },
        ]}
      >
        {sign ?? ''}
        {value}
      </Text>
    </LinearGradient>
  );
}

const XP_PER_LEVEL = 100;

export function levelFor(points: number): number {
  return Math.floor(Math.max(0, points) / XP_PER_LEVEL) + 1;
}

/** Compact level + XP bar for the in-app HUD. */
export function LevelBar({ points }: { points: number }) {
  const xp = Math.max(0, points);
  const level = levelFor(xp);
  const into = xp % XP_PER_LEVEL;
  return (
    <View style={styles.levelBar}>
      <View style={styles.levelBadge}>
        <Text style={styles.levelBadgeText}>Lv {level}</Text>
      </View>
      <View style={styles.levelTrack}>
        <View style={[styles.levelFill, { width: `${into}%` }]} />
      </View>
      <Xp value={xp} size={11} />
    </View>
  );
}

export function PointsPill({
  value,
  kind,
}: {
  value: number;
  kind: 'earn' | 'redeem';
}) {
  return <Xp value={value} sign={kind === 'earn' ? '+' : '−'} />;
}

export function Avatar({
  name,
  color,
  src,
  size = 44,
}: {
  name: string;
  color: string;
  src?: string | number;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <Image
        source={typeof src === 'number' ? src : { uri: src }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: '700',
          fontSize: size * 0.4,
          letterSpacing: -0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

/** Two avatars overlapping — the couple lockup used on profile and redeem. */
export function CoupleLockup({
  leftName,
  leftColor,
  leftSrc,
  rightName,
  rightColor,
  rightSrc,
  size = 56,
}: {
  leftName: string;
  leftColor: string;
  leftSrc?: string;
  rightName?: string;
  rightColor?: string;
  rightSrc?: string;
  size?: number;
}) {
  const overlap = Math.round(size * 0.38);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ zIndex: 2 }}>
        <Avatar name={leftName} color={leftColor} src={leftSrc} size={size} />
      </View>
      {rightName ? (
        <View style={{ marginLeft: -overlap, zIndex: 1 }}>
          <View
            style={{
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: colors.bg,
            }}
          >
            <Avatar
              name={rightName}
              color={rightColor ?? colors.blue}
              src={rightSrc}
              size={size}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  block,
  disabled,
  onPress,
  children,
  style,
}: {
  variant?: ButtonVariant;
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? colors.black
      : variant === 'secondary'
        ? colors.white
        : variant === 'danger'
          ? '#fbecec'
          : colors.blueSoft;
  const fg =
    variant === 'primary'
      ? '#fff'
      : variant === 'danger'
        ? colors.red
        : colors.ink;
  const bordered = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        bordered && styles.btnBordered,
        block && styles.btnBlock,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
        style,
      ]}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[styles.btnText, { color: fg }]}>{children}</Text>
      ) : Array.isArray(children) &&
        children.some((child) => typeof child === 'string' || typeof child === 'number') ? (
        <Text style={[styles.btnText, { color: fg }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  request: 'POINT REQUEST',
  earn: 'POINTS EARNED',
  redeem: 'PRIZE REDEEMED',
  fulfill: 'PRIZE GIVEN',
  approve: 'POINTS APPROVED',
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Deterministic pseudo-barcode bars from a seed string. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 7;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 100000;
    const out: number[] = [];
    for (let i = 0; i < 42; i++) {
      h = (h * 1103515245 + 12345) % 2147483647;
      out.push(1 + (h % 3));
    }
    return out;
  }, [seed]);
  return (
    <View style={styles.barcodeRow}>
      {bars.map((w, i) => (
        <View key={i} style={[styles.barcodeBar, { width: w }]} />
      ))}
    </View>
  );
}

/** Torn sawtooth bottom edge of the receipt paper. */
function TornEdge() {
  return (
    <View style={styles.tornRow} pointerEvents="none">
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={i} style={styles.tornTooth} />
      ))}
    </View>
  );
}

function receiptStamp(): { order: string; date: string } {
  const now = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    order: `LR-${1000 + Math.floor(Math.random() * 9000)}`,
    date: `${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()} · ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

/** In-app prime before the OS notifications permission sheet. */
export function PushNudgeModal({
  visible,
  partnerFirst,
  onYes,
  onSkip,
}: {
  visible: boolean;
  partnerFirst: string;
  onYes: () => void;
  onSkip: () => void;
}) {
  const name = partnerFirst.trim() || 'they';
  const who = name === 'them' || name === 'they' ? 'they' : name;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onSkip}>
      <Pressable style={styles.pushNudgeBackdrop} onPress={onSkip}>
        <Pressable style={styles.pushNudgeCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.pushNudgeIcon}>
            <Text style={styles.pushNudgeBell}>🔔</Text>
          </View>
          <Text style={styles.pushNudgeTitle}>
            {who === 'they'
              ? 'Want to be notified when they complete it?'
              : `Want to be notified when ${who} completes it?`}
          </Text>
          <Text style={styles.pushNudgeBody}>
            We’ll ping you when this task is done — and whenever something new
            lands in your inbox.
          </Text>
          <Button block onPress={onYes}>
            Notify me
          </Button>
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text style={styles.pushNudgeSkip}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Paper-receipt success sheet with native image share (captured via view-shot). */
export function ReceiptModal({
  kind,
  subtitle,
  emoji,
  itemTitle,
  meta,
  points,
  fromName,
  toName,
  note,
  shareLabel = 'Share receipt',
  skipLabel = 'Done',
  feedLabel = 'Post to feed',
  busy,
  onShare,
  onSkip,
}: {
  kind: ReceiptKind;
  subtitle: string;
  emoji: string;
  itemTitle: string;
  meta?: string;
  points: number;
  fromName: string;
  toName: string;
  note?: string;
  shareLabel?: string;
  skipLabel?: string;
  feedLabel?: string;
  busy?: boolean;
  onShare?: () => void | Promise<void>;
  onSkip: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [postToFeed, setPostToFeed] = useState(true);
  const canPostToFeed = Boolean(onShare);
  const sign = signFor(kind);
  const paperRef = useRef<View>(null);

  // Printing animation: paper slides out of the printer slot once measured.
  const [paperH, setPaperH] = useState(0);
  const print = useRef(new Animated.Value(0)).current;
  const actionsIn = useRef(new Animated.Value(0)).current;
  const stamp = useRef(receiptStamp()).current;
  const { height: windowH } = useWindowDimensions();

  // The printer head and the buttons have to stay reachable, so the paper only
  // gets the height that's left over and the mask crops the tail.
  const maxPaperH = Math.max(170, windowH - 380);

  useEffect(() => {
    if (paperH <= 0) return;
    Animated.sequence([
      Animated.delay(160),
      Animated.timing(print, {
        toValue: 1,
        duration: Math.min(1400, Math.max(800, paperH * 2.2)),
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionsIn, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [paperH, print, actionsIn]);

  const receipt: ReceiptData = {
    kind,
    emoji,
    title: itemTitle,
    points,
    fromName,
    toName,
    meta,
    note,
  };

  async function complete(withFeed: boolean) {
    if (withFeed && onShare) await onShare();
    else onSkip();
  }

  async function handleShare() {
    setSharing(true);
    try {
      if (paperRef.current) {
        const uri = await captureRef(paperRef, {
          format: 'png',
          quality: 1,
        });
        await shareReceiptImage(uri, receipt);
      }
      await complete(canPostToFeed && postToFeed);
    } catch {
      await complete(canPostToFeed && postToFeed);
    } finally {
      setSharing(false);
    }
  }

  const locked = busy || sharing;

  return (
    <Modal transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.modalBackdrop}>
        <ScrollView
          contentContainerStyle={styles.printerScroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.printerWrap}>
          {/* Printer body */}
          <View style={styles.printer}>
            <View style={styles.printerTopRow}>
              <View style={styles.printerLogo}>
                <Text style={{ fontSize: 14 }}>🧾</Text>
              </View>
              <Text style={styles.printerBrand}>LoveReceipts</Text>
            </View>
            <View style={styles.printerSummaryRow}>
              <View style={styles.printerSummaryLeft}>
                <Text style={styles.printerTitle} numberOfLines={1}>
                  {itemTitle}
                </Text>
                <Text style={styles.printerSub} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <View style={styles.printerTotal}>
                <Text style={styles.printerTotalLabel}>Total</Text>
                <Text style={styles.printerTotalValue}>
                  {sign}{points} 💎
                </Text>
              </View>
            </View>
            <View style={styles.printerStatusRow}>
              <View style={styles.printerCheck}>
                <Text style={styles.printerCheckMark}>✓</Text>
              </View>
              <Text style={styles.printerStatus}>{RECEIPT_HEADLINE[kind]}</Text>
            </View>
            <View style={styles.printerSlot} />
          </View>

          {/* Paper printing out of the slot */}
          <View
            style={[
              styles.paperMask,
              paperH > 0
                ? { height: Math.min(paperH + 10, maxPaperH) }
                : null,
            ]}
          >
            <Animated.View
              onLayout={(e) => {
                const h = Math.round(e.nativeEvent.layout.height);
                if (h > 0 && h !== paperH) setPaperH(h);
              }}
              style={[
                styles.paperShift,
                paperH > 0
                  ? {
                      transform: [
                        {
                          translateY: print.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-paperH, 0],
                          }),
                        },
                      ],
                    }
                  : { opacity: 0 },
              ]}
            >
              <View ref={paperRef} collapsable={false} style={styles.receiptPaper}>
                <View style={styles.receiptLogoBox}>
                  <Text style={{ fontSize: 20 }}>🧾</Text>
                </View>
                <View style={styles.receiptDash} />

                <View style={styles.receiptLineRow}>
                  <Text style={styles.receiptLineKey}>
                    {RECEIPT_KIND_LABEL[kind]}
                  </Text>
                  <Text style={styles.receiptLineVal}>
                    {sign}{points} pts
                  </Text>
                </View>
                <Text style={styles.receiptMutedLine} numberOfLines={2}>
                  {emoji} {itemTitle}
                  {meta ? ` · ${meta}` : ''}
                </Text>

                <View style={styles.receiptDash} />
                <View style={styles.receiptLineRow}>
                  <Text style={styles.receiptMutedKey}>From</Text>
                  <Text style={styles.receiptLineVal}>{fromName}</Text>
                </View>
                <View style={styles.receiptLineRow}>
                  <Text style={styles.receiptMutedKey}>To</Text>
                  <Text style={styles.receiptLineVal}>{toName}</Text>
                </View>

                <View style={styles.receiptDash} />
                <View style={styles.receiptLineRow}>
                  <Text style={styles.receiptTotalKey}>TOTAL {sign === '+' ? 'EARNED' : 'SPENT'}</Text>
                  <Text style={styles.receiptTotalVal}>
                    {sign}{points}
                  </Text>
                </View>

                <View style={styles.receiptDash} />
                <View style={styles.receiptLineRow}>
                  <Text style={styles.receiptMutedKey}>Date</Text>
                  <Text style={styles.receiptLineVal}>{stamp.date}</Text>
                </View>
                <Text style={styles.receiptThanks}>Thank you for the love 💕</Text>

                <Barcode seed={`${itemTitle}${points}${fromName}`} />
                <Text style={styles.barcodeCaption}>{stamp.order}</Text>
              </View>
              <TornEdge />
            </Animated.View>
          </View>

          {note ? <Text style={styles.modalNote}>{note}</Text> : null}

          <Animated.View
            style={[
              styles.modalActions,
              {
                opacity: actionsIn,
                transform: [
                  {
                    translateY: actionsIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {canPostToFeed && (
              <Pressable
                onPress={() => setPostToFeed((v) => !v)}
                disabled={locked}
                style={styles.receiptFeedCheck}
              >
                <View
                  style={[
                    styles.receiptFeedBox,
                    !postToFeed && styles.receiptFeedBoxOff,
                  ]}
                >
                  {postToFeed && <Text style={styles.receiptFeedCheckMark}>✓</Text>}
                </View>
                <Text style={styles.receiptFeedLabel}>{feedLabel}</Text>
              </Pressable>
            )}
            <Button
              block
              disabled={locked}
              onPress={() => void handleShare()}
              style={styles.receiptShareBtn}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: '#fff', fontSize: 17 }]}>
                  {shareLabel}
                </Text>
              )}
            </Button>
            <Button
              block
              variant="ghost"
              onPress={() => void complete(canPostToFeed && postToFeed)}
              disabled={locked}
            >
              {skipLabel}
            </Button>
          </Animated.View>
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: radius.pill,
  },
  xpLarge: {
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 14,
  },
  xpValue: {
    color: '#fff',
    fontWeight: '800',
  },
  levelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  levelBadge: {
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  levelTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    minWidth: 48,
  },
  levelFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnBlock: {
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,18,16,0.72)',
    justifyContent: 'center',
  },
  pushNudgeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18,18,16,0.55)',
    justifyContent: 'center',
    padding: 28,
  },
  pushNudgeCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    gap: 12,
    alignItems: 'center',
  },
  pushNudgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pushNudgeBell: { fontSize: 26 },
  pushNudgeTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 28,
  },
  pushNudgeBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  pushNudgeSkip: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.inkMuted,
    paddingVertical: 8,
  },
  printerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  printerWrap: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  printer: {
    width: '100%',
    backgroundColor: '#232320',
    borderRadius: 22,
    padding: 14,
    paddingBottom: 10,
    zIndex: 2,
    ...shadow,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  printerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  printerLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerBrand: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  printerSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  printerSummaryLeft: {
    flex: 1,
  },
  printerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  printerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  printerTotal: {
    alignItems: 'flex-end',
  },
  printerTotalLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  printerTotalValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  printerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  printerCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2f9e63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerCheckMark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  printerStatus: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  printerSlot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#121210',
    marginTop: 10,
    marginHorizontal: 2,
  },
  paperMask: {
    width: '86%',
    alignSelf: 'center',
    overflow: 'hidden',
    marginTop: -10,
    zIndex: 1,
    paddingTop: 10,
  },
  paperShift: {
    width: '100%',
  },
  receiptPaper: {
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    gap: 4,
  },
  receiptLogoBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#191918',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 2,
  },
  receiptDash: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#d9d5cc',
    borderStyle: 'dashed',
    marginVertical: 3,
  },
  receiptLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  receiptLineKey: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#191918',
  },
  receiptLineVal: {
    fontFamily: MONO,
    fontSize: 12,
    color: '#191918',
  },
  receiptMutedKey: {
    fontFamily: MONO,
    fontSize: 12,
    color: '#9b988f',
  },
  receiptMutedLine: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#9b988f',
    marginTop: -2,
  },
  receiptTotalKey: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#191918',
  },
  receiptTotalVal: {
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: '800',
    color: '#191918',
  },
  receiptThanks: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#9b988f',
    textAlign: 'center',
    marginTop: 4,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 6,
    height: 26,
  },
  barcodeBar: {
    height: 26,
    backgroundColor: '#191918',
    marginRight: 1.5,
  },
  barcodeCaption: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 3,
    color: '#9b988f',
    textAlign: 'center',
    marginTop: 4,
  },
  tornRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    height: 8,
    overflow: 'hidden',
  },
  tornTooth: {
    width: 14,
    height: 14,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 1,
    marginTop: -9,
  },
  modalNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  receiptFeedCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    alignSelf: 'center',
  },
  receiptFeedBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.blue,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptFeedBoxOff: {
    backgroundColor: '#fff',
  },
  receiptFeedCheckMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  receiptFeedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  modalActions: {
    width: '100%',
    gap: 8,
    marginTop: 12,
  },
  receiptShareBtn: {
    minHeight: 50,
    borderRadius: radius.pill,
  },
});

function latestEmoji(next: string, fallback: string): string {
  const cleaned = next.replace(/[0-9A-Za-z\s]/g, '');
  if (!cleaned) return fallback;
  const parts = Array.from(cleaned);
  return parts[parts.length - 1] ?? fallback;
}

/** Opens the system emoji keyboard (Apple emoji panel on iOS). */
export function EmojiField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable
      style={emojiStyles.wrap}
      onPress={() => ref.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel="Choose emoji"
    >
      <Text style={emojiStyles.glyph} pointerEvents="none">
        {value || '⭐'}
      </Text>
      <TextInput
        ref={ref}
        value=""
        onChangeText={(text) => onChange(latestEmoji(text, value))}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        caretHidden
        contextMenuHidden
        keyboardType="default"
        textContentType="none"
        importantForAutofill="no"
        style={emojiStyles.input}
        accessibilityLabel="Emoji keyboard"
      />
    </Pressable>
  );
}

const emojiStyles = StyleSheet.create({
  wrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: { fontSize: 26, lineHeight: 32 },
  input: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
    fontSize: 1,
  },
});

/** Compact segmented pill: For you / For {partner}. */
export function WhoPill({
  value,
  themLabel,
  onChange,
}: {
  value: 'you' | 'them';
  themLabel: string;
  onChange: (next: 'you' | 'them') => void;
}) {
  return (
    <View style={whoStyles.track}>
      <Pressable
        style={[whoStyles.seg, value === 'you' && whoStyles.segOn]}
        onPress={() => {
          if (value !== 'you') onChange('you');
        }}
      >
        <Text style={[whoStyles.segText, value === 'you' && whoStyles.segTextOn]}>
          For you
        </Text>
      </Pressable>
      <Pressable
        style={[whoStyles.seg, value === 'them' && whoStyles.segOn]}
        onPress={() => {
          if (value !== 'them') onChange('them');
        }}
      >
        <Text
          style={[whoStyles.segText, value === 'them' && whoStyles.segTextOn]}
          numberOfLines={1}
        >
          {themLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const whoStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    padding: 3,
    maxWidth: 220,
  },
  seg: {
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  segOn: {
    backgroundColor: colors.card,
    ...shadow,
  },
  segText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  segTextOn: {
    color: colors.ink,
  },
});
