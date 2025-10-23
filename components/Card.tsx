import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';
import { BorderRadius, Spacing, Shadow } from '../constants/Styles';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function Card({ children, onPress, style }: CardProps) {
  const Container = onPress ? TouchableOpacity : View;
  
  return (
    <Container
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.medium,
  },
});
