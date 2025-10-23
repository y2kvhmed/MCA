import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import PendulumLoader from './PendulumLoader';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  usePendulum?: boolean;
}

export default function LoadingSpinner({ 
  size = 60, 
  color = Colors.primary,
  usePendulum = true 
}: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <PendulumLoader size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
