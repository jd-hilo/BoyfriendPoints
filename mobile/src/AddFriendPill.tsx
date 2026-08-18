import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors } from './theme';
import { haptic } from './utils';

export default function AddFriendPill({
  onPress,
  bottom = 16,
}: {
  onPress: () => void;
  bottom?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add friends"
      onPress={() => {
        haptic(10);
        onPress();
      }}
      style={({ pressed }) => [
        styles.hit,
        { bottom },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.shadow}>
        <View style={styles.clip}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 52 : 36}
            tint="systemChromeMaterialLight"
            blurMethod="dimezisBlurView"
            style={styles.glass}
          >
            <View style={styles.fill} pointerEvents="none" />
            <View style={styles.sheen} pointerEvents="none" />
            <Ionicons name="person-add" size={20} color={colors.ink} />
          </BlurView>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    position: 'absolute',
    right: 10,
    zIndex: 20,
  },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  shadow: {
    shadowColor: '#1a2433',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  clip: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  glass: {
    width: 62,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 13,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
