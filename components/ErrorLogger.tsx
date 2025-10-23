import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface ErrorLoggerProps {
  error: Error;
  errorInfo?: any;
  onRetry?: () => void;
}

export default function ErrorLogger({ error, errorInfo, onRetry }: ErrorLoggerProps) {
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
  };

  const handleCopyError = () => {
    const errorText = JSON.stringify(errorDetails, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(errorText);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Physics Learning App</Text>
        <Text style={styles.subtitle}>Something went wrong. Please restart the app.</Text>
      </View>

      <ScrollView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Details:</Text>
        <Text style={styles.errorText}>
          {error.message}
        </Text>
        
        {error.stack && (
          <>
            <Text style={styles.errorTitle}>Stack Trace:</Text>
            <Text style={styles.stackText}>
              {error.stack}
            </Text>
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity style={styles.button} onPress={onRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleCopyError}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Copy Error</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.error,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  stackText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  buttonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: Colors.text.primary,
  },
});