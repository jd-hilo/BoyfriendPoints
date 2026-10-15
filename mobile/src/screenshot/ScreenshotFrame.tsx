import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** iPhone 16 Pro Max-class chrome: 54pt status bar, 34pt home indicator. */
export const SCREENSHOT_STATUS_BAR = 54;
export const SCREENSHOT_HOME_INDICATOR = 34;

/**
 * Pads the live app so a composited 9:41 status bar and home indicator
 * sit on the app background without covering header/tab content.
 */
export default function ScreenshotFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.phone}>
      <View style={styles.statusSlot} />
      <View style={styles.body}>{children}</View>
      <View style={styles.homeSlot} />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  statusSlot: {
    height: SCREENSHOT_STATUS_BAR,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
  homeSlot: {
    height: SCREENSHOT_HOME_INDICATOR,
    backgroundColor: colors.bg,
  },
});
