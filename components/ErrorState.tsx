import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface ErrorStateProps {
  title?: string;
  message: string;
  type?: 'network' | 'permission' | 'notFound' | 'server' | 'validation' | 'generic';
  actionText?: string;
  onAction?: () => void;
  showIcon?: boolean;
}

export default function ErrorState({
  title,
  message,
  type = 'generic',
  actionText,
  onAction,
  showIcon = true,
}: ErrorStateProps) {
  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          icon: 'wifi-off',
          defaultTitle: 'Connection Problem',
          color: Colors.warning,
          suggestions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Contact support if the problem persists',
          ],
        };
      case 'permission':
        return {
          icon: 'lock-closed',
          defaultTitle: 'Access Denied',
          color: Colors.error,
          suggestions: [
            'You don\'t have permission for this action',
            'Contact your teacher or admin',
            'Make sure you\'re logged in correctly',
          ],
        };
      case 'notFound':
        return {
          icon: 'search',
          defaultTitle: 'Not Found',
          color: Colors.info,
          suggestions: [
            'The item you\'re looking for doesn\'t exist',
            'It might have been moved or deleted',
            'Try going back and searching again',
          ],
        };
      case 'server':
        return {
          icon: 'server',
          defaultTitle: 'Server Error',
          color: Colors.error,
          suggestions: [
            'Something went wrong on our end',
            'Please try again in a few minutes',
            'Contact support if this keeps happening',
          ],
        };
      case 'validation':
        return {
          icon: 'alert-circle',
          defaultTitle: 'Invalid Input',
          color: Colors.warning,
          suggestions: [
            'Please check your input and try again',
            'Make sure all required fields are filled',
            'Follow the format requirements',
          ],
        };
      default:
        return {
          icon: 'alert-triangle',
          defaultTitle: 'Something Went Wrong',
          color: Colors.error,
          suggestions: [
            'An unexpected error occurred',
            'Please try again',
            'Contact support if the problem continues',
          ],
        };
    }
  };

  const config = getErrorConfig();
  const displayTitle = title || config.defaultTitle;

  return (
    <View style={styles.container}>
      {showIcon && (
        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon as any} size={48} color={config.color} />
        </View>
      )}
      
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{message}</Text>
      
      <View style={styles.suggestions}>
        {config.suggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionItem}>
            <View style={[styles.bullet, { backgroundColor: config.color }]} />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ))}
      </View>
      
      {onAction && actionText && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: config.color }]}
          onPress={onAction}
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  suggestions: {
    width: '100%',
    maxWidth: 400,
    marginBottom: Spacing.xl,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: Spacing.md,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    minWidth: 120,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.inverse,
    textAlign: 'center',
  },
});