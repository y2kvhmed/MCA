import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function NetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [showStatus, setShowStatus] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // For web, we'll use a simple online/offline detection
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsConnected(true);
        showStatusBriefly();
      };
      
      const handleOffline = () => {
        setIsConnected(false);
        setShowStatus(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Initial state
      setIsConnected(navigator.onLine);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // For mobile, we would use NetInfo but it's not installed
      // For now, assume connected
      setIsConnected(true);
    }
  }, []);

  const showStatusBriefly = () => {
    setShowStatus(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowStatus(false);
    });
  };

  if (!showStatus && isConnected) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isConnected ? Colors.success : Colors.error,
          opacity: showStatus ? (isConnected ? fadeAnim : 1) : 1,
        },
      ]}
    >
      <Ionicons
        name={isConnected ? 'wifi' : 'wifi-outline'}
        size={16}
        color={Colors.text.inverse}
      />
      <Text style={styles.text}>
        {isConnected ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    zIndex: 1000,
  },
  text: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
});