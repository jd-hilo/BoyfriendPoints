/**
 * Marketing-screenshot mode. Off unless EXPO_PUBLIC_SCREENSHOT_MODE=1.
 * Production / TestFlight / App Store builds must leave this unset so
 * mocked auth never ships to real users.
 */
export function isScreenshotMode(): boolean {
  return process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';
}
