import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/Colors';

interface PendulumLoaderProps {
  size?: number;
  color?: string;
  duration?: number;
}

export default function PendulumLoader({ 
  size = 60, 
  color = Colors.primary,
  duration = 400 
}: PendulumLoaderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]).start(() => startAnimation());
    };

    startAnimation();
  }, [rotateAnim, duration]);

  const rotation = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-45deg', '45deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Fixed Pivot Point */}
      <View style={[styles.pivot, { backgroundColor: color }]} />
      
      {/* Animated Pendulum Group - rotates around the pivot */}
      <Animated.View
        style={[
          styles.pendulumGroup,
          {
            transform: [
              { translateY: 4 }, // Move to pivot point
              { rotate: rotation },
              { translateY: -4 }, // Move back
            ],
          },
        ]}
      >
        {/* Pendulum String - connects pivot to bob */}
        <View style={[styles.string, { height: size * 0.6, backgroundColor: color }]} />
        
        {/* Pendulum Bob - at the end of the string */}
        <View
          style={[
            styles.bob,
            {
              width: size * 0.25,
              height: size * 0.25,
              backgroundColor: color,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
  },
  pivot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 4,
    left: '50%',
    marginLeft: -4, // Center the pivot
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pendulumGroup: {
    position: 'absolute',
    top: 4, // Start from pivot point
    alignItems: 'center',
    transformOrigin: 'top center', // Rotate around the top (pivot)
  },
  string: {
    width: 1.5,
    alignSelf: 'center',
    opacity: 0.8,
  },
  bob: {
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
});