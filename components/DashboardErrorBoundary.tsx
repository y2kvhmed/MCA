import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import Button from './Button';

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={48} color={Colors.error} />
            <Text style={styles.errorTitle}>Dashboard Error</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'Something went wrong loading the dashboard'}
            </Text>
            
            <Button
              title="Try Again"
              onPress={this.handleRetry}
              style={styles.retryButton}
            />
            
            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.stack}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  retryButton: {
    marginBottom: Spacing.lg,
  },
  debugContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.md,
    borderRadius: 8,
    width: '100%',
    maxHeight: 200,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  debugText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
});