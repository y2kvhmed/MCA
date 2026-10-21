import { Platform } from 'react-native'

/**
 * Haptic feedback utilities for better UX
 *
 * Uses a lazy dynamic import of `expo-haptics` so the web bundler
 * doesn't fail when the native module isn't installed or available.
 */

let _Haptics: any = null;
async function getHaptics() {
  if (_Haptics) return _Haptics;
  if (Platform.OS === 'web') return null;
  try {
    // @ts-ignore
    _Haptics = await import('expo-haptics');
    return _Haptics;
  } catch (error) {
    // module not available (eg. in web or not installed) — silently fall back
    _Haptics = null;
    return null;
  }
}

export const hapticFeedback = {
  /**
   * Light tap feedback for button presses
   */
  light: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Silently fail if haptics not supported
    }
  },

  /**
   * Medium impact for important actions
   */
  medium: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Heavy impact for critical actions
   */
  heavy: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Success feedback
   */
  success: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Warning feedback
   */
  warning: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Error feedback
   */
  error: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Selection changed feedback (for pickers, toggles)
   */
  selection: async () => {
    const Haptics = await getHaptics();
    if (!Haptics) return;
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      // Silently fail
    }
  },
};
