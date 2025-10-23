import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import Card from './Card';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
  duration?: number;
}

export default function AnimatedCard({ 
  children, 
  style, 
  delay = 0, 
  duration = 600 
}: AnimatedCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration,
          useNativeDriver: false,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [fadeAnim, slideAnim, delay, duration]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Card style={style}>{children}</Card>
    </Animated.View>
  );
}