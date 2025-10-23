import { Animated, Haptics, Platform } from 'react-native';
import { PhysicsAnimations } from './animations';

// Micro-interaction utilities for enhanced user experience
export class MicroInteractions {
  // Button press feedback with haptics and animation
  static buttonPress(scaleValue: Animated.Value, onPress?: () => void) {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Visual feedback
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress?.();
    });
  }

  // Card tap with physics-based feedback
  static cardTap(scaleValue: Animated.Value, onTap?: () => void) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    PhysicsAnimations.elasticCollision(scaleValue).start(() => {
      onTap?.();
    });
  }

  // Success feedback with celebration animation
  static successFeedback(scaleValue: Animated.Value, onComplete?: () => void) {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 300,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
    });
  }

  // Error feedback with shake animation
  static errorFeedback(translateX: Animated.Value, onComplete?: () => void) {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    Animated.sequence([
      Animated.timing(translateX, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      onComplete?.();
    });
  }

  // Loading state with pendulum animation
  static loadingState(rotationValue: Animated.Value) {
    return PhysicsAnimations.pendulumSwing(rotationValue);
  }

  // Hover effect for web
  static hoverEffect(scaleValue: Animated.Value, isHovered: boolean) {
    Animated.timing(scaleValue, {
      toValue: isHovered ? 1.05 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // Focus effect for form inputs
  static focusEffect(scaleValue: Animated.Value, isFocused: boolean) {
    Animated.timing(scaleValue, {
      toValue: isFocused ? 1.02 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // Swipe gesture feedback
  static swipeFeedback(translateX: Animated.Value, direction: 'left' | 'right') {
    const targetValue = direction === 'left' ? -50 : 50;
    
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: targetValue,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }

  // Pull to refresh animation
  static pullToRefresh(scaleValue: Animated.Value, rotationValue: Animated.Value) {
    return Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 1.1,
        duration: 300,
        useNativeDriver: true,
      }),
      PhysicsAnimations.rotate360(rotationValue, 800),
    ]);
  }
}

// Predefined interaction patterns
export const InteractionPatterns = {
  // Quick tap for buttons
  quickTap: {
    scale: { from: 1, to: 0.95, duration: 100 },
    haptic: 'light' as const,
  },

  // Long press for context menus
  longPress: {
    scale: { from: 1, to: 1.05, duration: 300 },
    haptic: 'medium' as const,
  },

  // Success confirmation
  success: {
    scale: { from: 1, to: 1.2, duration: 200 },
    haptic: 'success' as const,
  },

  // Error indication
  error: {
    shake: { intensity: 10, duration: 500 },
    haptic: 'error' as const,
  },

  // Loading indication
  loading: {
    pendulum: { duration: 2000 },
    continuous: true,
  },
};