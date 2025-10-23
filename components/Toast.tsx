import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const { width } = Dimensions.get('window');

export default function Toast({ 
  message, 
  type, 
  visible, 
  onHide, 
  duration = 3000 
}: ToastProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: Colors.success, icon: 'checkmark-circle' };
      case 'error':
        return { backgroundColor: Colors.error, icon: 'close-circle' };
      case 'warning':
        return { backgroundColor: Colors.warning, icon: 'warning' };
      case 'info':
      default:
        return { backgroundColor: Colors.info, icon: 'information-circle' };
    }
  };

  const toastStyle = getToastStyle();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: toastStyle.backgroundColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Ionicons 
        name={toastStyle.icon as any} 
        size={20} 
        color={Colors.text.inverse} 
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.inverse,
  },
});