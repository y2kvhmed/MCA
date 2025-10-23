import { Animated, Easing } from 'react-native';

export class PhysicsAnimations {
  // Pendulum swing animation
  static pendulumSwing(animatedValue: Animated.Value, duration = 2000) {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: -1,
          duration: duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
  }

  // Spring bounce (like a ball bouncing)
  static springBounce(animatedValue: Animated.Value, toValue = 1) {
    return Animated.spring(animatedValue, {
      toValue,
      tension: 300,
      friction: 8,
      useNativeDriver: true,
    });
  }

  // Wave motion animation
  static waveMotion(animatedValue: Animated.Value, amplitude = 1, frequency = 1000) {
    return Animated.loop(
      Animated.timing(animatedValue, {
        toValue: amplitude,
        duration: frequency,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    );
  }

  // Gravity fall animation
  static gravityFall(animatedValue: Animated.Value, distance = 100, duration = 1000) {
    return Animated.timing(animatedValue, {
      toValue: distance,
      duration,
      easing: Easing.in(Easing.quad), // Accelerating like gravity
      useNativeDriver: true,
    });
  }

  // Elastic collision animation
  static elasticCollision(animatedValue: Animated.Value) {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 0.8,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(animatedValue, {
        toValue: 1,
        tension: 400,
        friction: 6,
        useNativeDriver: true,
      }),
    ]);
  }

  // Orbital motion animation
  static orbitalMotion(rotationValue: Animated.Value, duration = 3000) {
    return Animated.loop(
      Animated.timing(rotationValue, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
  }

  // Fade in with physics-based easing
  static fadeInPhysics(animatedValue: Animated.Value, duration = 500) {
    return Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    });
  }

  // Scale with momentum
  static scaleWithMomentum(animatedValue: Animated.Value, targetScale = 1.1) {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: targetScale,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(animatedValue, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]);
  }

  // Stagger animation for lists
  static staggeredEntrance(animatedValues: Animated.Value[], delay = 100) {
    return Animated.stagger(
      delay,
      animatedValues.map(value =>
        Animated.spring(value, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        })
      )
    );
  }

  // Magnetic attraction animation
  static magneticAttraction(animatedValue: Animated.Value, targetValue = 1) {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: targetValue * 0.3,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(animatedValue, {
        toValue: targetValue,
        tension: 400,
        friction: 4,
        useNativeDriver: true,
      }),
    ]);
  }

  // Ripple effect animation
  static rippleEffect(scaleValue: Animated.Value, opacityValue: Animated.Value) {
    return Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 2,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
  }
}

// Preset animation configurations
export const AnimationPresets = {
  // Quick tap feedback
  quickTap: {
    scale: { from: 1, to: 0.95, duration: 100 },
    spring: { tension: 400, friction: 10 },
  },

  // Card entrance
  cardEntrance: {
    opacity: { from: 0, to: 1, duration: 300 },
    translateY: { from: 20, to: 0, duration: 300 },
    easing: Easing.out(Easing.quad),
  },

  // Button press
  buttonPress: {
    scale: { from: 1, to: 0.98, duration: 100 },
    opacity: { from: 1, to: 0.8, duration: 100 },
  },

  // Loading pulse
  loadingPulse: {
    scale: { from: 1, to: 1.05, duration: 1000 },
    loop: true,
    easing: Easing.inOut(Easing.sin),
  },

  // Success celebration
  successCelebration: {
    scale: { from: 1, to: 1.2, duration: 200 },
    spring: { tension: 300, friction: 6 },
  },

  // Error shake
  errorShake: {
    translateX: { values: [0, -10, 10, -10, 10, 0], duration: 500 },
    easing: Easing.bounce,
  },
};

// Utility functions for common animations
export const AnimationUtils = {
  // Create a spring animation with physics-based parameters
  createSpring: (animatedValue: Animated.Value, toValue: number, config = {}) => {
    const defaultConfig = {
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    };
    
    return Animated.spring(animatedValue, {
      toValue,
      ...defaultConfig,
      ...config,
    });
  },

  // Create a timing animation with physics-based easing
  createTiming: (animatedValue: Animated.Value, toValue: number, duration = 300, easing = Easing.out(Easing.quad)) => {
    return Animated.timing(animatedValue, {
      toValue,
      duration,
      easing,
      useNativeDriver: true,
    });
  },

  // Create a sequence of animations
  createSequence: (animations: Animated.CompositeAnimation[]) => {
    return Animated.sequence(animations);
  },

  // Create parallel animations
  createParallel: (animations: Animated.CompositeAnimation[]) => {
    return Animated.parallel(animations);
  },

  // Create a loop animation
  createLoop: (animation: Animated.CompositeAnimation, iterations = -1) => {
    return Animated.loop(animation, { iterations });
  },
};