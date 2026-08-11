import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
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
  src?: string;
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
        source={{ uri: src }}
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
      {typeof children === 'string' ? (
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
        <View style={styles.receiptModal}>
          <Text style={styles.receiptKicker}>{RECEIPT_HEADLINE[kind]}</Text>
          <Text style={styles.receiptSub}>{subtitle}</Text>

          <View ref={paperRef} collapsable={false} style={styles.receiptPaper}>
            <View style={styles.receiptBrand}>
              <Text style={{ fontSize: 15 }}>🧾 </Text>
              <Text style={styles.receiptBrandText}>LoveReceipts</Text>
            </View>
            <Text style={styles.receiptKindLabel}>
              {RECEIPT_KIND_LABEL[kind]}
            </Text>
            <View style={styles.receiptDash} />
            <View style={styles.receiptParty}>
              <Text style={styles.receiptPartyLabel}>FROM</Text>
              <Text style={styles.receiptPartyName}>{fromName}</Text>
            </View>
            <View style={styles.receiptParty}>
              <Text style={styles.receiptPartyLabel}>TO</Text>
              <Text style={styles.receiptPartyName}>{toName}</Text>
            </View>
            <View style={styles.receiptDash} />
            <View style={styles.receiptItem}>
              <Text style={styles.receiptEmoji}>{emoji}</Text>
              <Text style={styles.receiptItemTitle}>{itemTitle}</Text>
              {meta && <Text style={styles.receiptMeta}>{meta}</Text>}
            </View>
            <View style={styles.receiptXp}>
              <Xp value={points} sign={sign} size={14} />
            </View>
            <View style={styles.receiptDash} />
            <Text style={styles.receiptThanks}>Thank you for the love 💕</Text>
          </View>

          {note && <Text style={styles.modalNote}>{note}</Text>}

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

          <View style={styles.modalActions}>
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
          </View>
        </View>
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
    backgroundColor: 'rgba(15,20,30,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  receiptModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    paddingBottom: 16,
    alignItems: 'center',
    ...shadow,
  },
  receiptKicker: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  receiptSub: {
    color: colors.ink2,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  receiptPaper: {
    width: '100%',
    backgroundColor: '#fffcf7',
    borderWidth: 1,
    borderColor: '#ebe4d8',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  receiptBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptBrandText: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  receiptKindLabel: {
    fontWeight: '600',
    fontSize: 12,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  receiptDash: {
    width: '100%',
    borderTopWidth: 1.5,
    borderColor: '#d5d0c6',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  receiptParty: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
  },
  receiptPartyLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  receiptPartyName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.blueName,
  },
  receiptItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  receiptEmoji: {
    fontSize: 28,
  },
  receiptItemTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  receiptMeta: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  receiptXp: {
    marginVertical: 2,
  },
  receiptThanks: {
    fontSize: 12,
    color: colors.ink2,
    fontWeight: '600',
  },
  modalNote: {
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
    marginBottom: 12,
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
    color: colors.ink2,
  },
  modalActions: {
    width: '100%',
    gap: 8,
  },
  receiptShareBtn: {
    minHeight: 52,
    borderRadius: radius.pill,
  },
});
