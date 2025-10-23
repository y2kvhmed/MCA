import React from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import NetworkStatus from '../components/NetworkStatus';
import { useEffect } from 'react';
import { registerForPushNotificationsAsync, savePushToken } from '../lib/notifications';
import { getCurrentUser, checkUserActiveStatus } from '../lib/auth';
import { useRouter } from 'expo-router';
import { logDiagnostics } from '../lib/diagnostics';
import { logStartupValidation } from '../lib/startupValidator';
import { logHealthCheck } from '../lib/healthCheck';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  {children: React.ReactNode}, 
  {hasError: boolean; error?: Error; errorInfo?: any}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    console.error('App Error Boundary:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('App crashed:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to console with more details
    console.group('🚨 App Crash Details');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo?.componentStack);
    console.groupEnd();
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // For development, show detailed error
      if (__DEV__) {
        const ErrorLogger = require('../components/ErrorLogger').default;
        return (
          <ErrorLogger 
            error={this.state.error || new Error('Unknown error')}
            errorInfo={this.state.errorInfo}
            onRetry={this.handleRetry}
          />
        );
      }
      
      // For production, show simple error message
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f9fa' }}>
          <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20, color: '#333' }}>
            Physics Learning App
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 20 }}>
            Something went wrong. Please restart the app.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={this.handleRetry}
          >
            <Text style={{ color: 'white', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Import web polyfills for web platform
if (Platform.OS === 'web') {
  require('../web-polyfills');
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Run diagnostics in development
    if (__DEV__) {
      console.log('🚀 Starting Physics Learning App...');
      logDiagnostics();
      logStartupValidation();
      logHealthCheck();
    }
    
    initializeNotifications();
    startUserStatusChecker();
  }, []);

  const initializeNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        const user = await getCurrentUser();
        if (user) {
          await savePushToken(user.id, token);
        }
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const startUserStatusChecker = () => {
    // Check user status every 5 minutes (less aggressive)
    const interval = setInterval(async () => {
      try {
        // Only check if user is currently logged in
        const currentUser = await getCurrentUser();
        if (currentUser) {
          // Only check active status for logged-in users
          const isActive = await checkUserActiveStatus();
          if (!isActive) {
            // User has been deactivated, redirect to welcome
            console.log('User deactivated, redirecting to welcome');
            router.replace('/welcome');
          }
        }
        // If no user is logged in, don't redirect (let them stay on login/welcome)
      } catch (error) {
        console.error('User status check error:', error);
        // Don't redirect on errors - could be network issues
      }
    }, 300000); // 5 minutes instead of 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SafeAreaProvider>
            <NetworkStatus />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="create-school" />
              <Stack.Screen name="create-user" />
              <Stack.Screen name="group-management" />
              <Stack.Screen name="view-users" />
              <Stack.Screen name="student-materials" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="student-assignments" />
              <Stack.Screen name="create-assignment" />
              <Stack.Screen name="materials-list" />
              <Stack.Screen name="assignment-details" />
              <Stack.Screen name="edit-assignment" />
              <Stack.Screen name="delete-assignment" />
              <Stack.Screen name="assignment-submissions" />
              <Stack.Screen name="teacher-assignments" />
              <Stack.Screen name="student-assignment-list" />
              <Stack.Screen name="submit-assignment" />
            </Stack>
          </SafeAreaProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
