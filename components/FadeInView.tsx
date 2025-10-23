import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
  duration?: number;
}

export default function FadeInView({ 
  children, 
  style, 
  delay = 0, 
  duration = 500 
}: FadeInViewProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [fadeAnim, delay, duration]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
}