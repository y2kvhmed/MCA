import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  message?: string;
  title?: string;
  description?: string;
}

export default function EmptyState({ icon, message, title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={Colors.text.tertiary} />
      {title && <Text style={styles.title}>{title}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  description: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
