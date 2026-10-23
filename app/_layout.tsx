import React, { useState, useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import NetworkStatus from '../components/NetworkStatus';
import { registerForPushNotificationsAsync, savePushToken } from '../lib/notifications';
import { getCurrentUser, checkUserActiveStatus } from '../lib/auth';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';


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
    console.group('App Crash Details');
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
      
      // For production, show error message
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f9fa' }}>
          <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 10, color: '#333', fontWeight: 'bold' }}>
            Physics Learning App
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 12 }}>
            Something went wrong. Please restart the app.
          </Text>
          {this.state.error?.message && (
            <Text style={{ fontSize: 12, color: '#FF3B30', marginBottom: 16, textAlign: 'center', maxWidth: 450, padding: 8, backgroundColor: '#FFF0F0', borderRadius: 6, borderWidth: 1, borderColor: '#FFD2D2' }}>
              {this.state.error.message}
            </Text>
          )}
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
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (__DEV__) {
      console.log('Starting Physics Learning App...');
    }
    
    initializeNotifications();
    startUserStatusChecker();
    checkMaintenance();

    // Poll maintenance status every 15 seconds
    const maintenanceInterval = setInterval(checkMaintenance, 15000);
    return () => clearInterval(maintenanceInterval);
  }, []);

  const checkMaintenance = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setUserRole(user.role);
        if (user.role === 'admin') {
          setMaintenanceActive(false);
          return;
        }
      }
      const { checkMaintenanceStatus } = await import('../lib/auth');
      const { isMaintenance, message } = await checkMaintenanceStatus(user?.role);
      setMaintenanceActive(isMaintenance);
      setMaintenanceMessage(message);
    } catch (e) {
      // non-blocking
    }
  };

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
    // Check user status every 5 minutes
    const interval = setInterval(async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          const isActive = await checkUserActiveStatus();
          if (!isActive) {
            console.log('User deactivated, redirecting to welcome');
            router.replace('/welcome');
          }
        }
      } catch (error) {
        console.error('User status check error:', error);
      }
    }, 300000);

    return () => clearInterval(interval);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <SafeAreaProvider>
              <NetworkStatus />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="create-school" />
                <Stack.Screen name="create-user" />
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
                <Stack.Screen name="attendance" />
                <Stack.Screen name="notes" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="add-recording" />
                <Stack.Screen name="change-password" />
              </Stack>

              {/* Maintenance Mode Full Screen Blocker for Logged-In Non-Admins Only */}
              {maintenanceActive && userRole && userRole !== 'admin' && (
                <View style={layoutStyles.maintenanceOverlay}>
                  <View style={layoutStyles.maintenanceCard}>
                    <Ionicons name="construct-outline" size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
                    <Text style={layoutStyles.maintenanceTitle}>System Maintenance</Text>
                    <Text style={layoutStyles.maintenanceMessage}>
                      {maintenanceMessage || 'The app is currently undergoing scheduled maintenance. Please check back shortly.'}
                    </Text>

                    <TouchableOpacity
                      style={layoutStyles.maintenanceRefreshBtn}
                      onPress={checkMaintenance}
                    >
                      <Text style={layoutStyles.maintenanceRefreshBtnText}>Check Again</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={layoutStyles.maintenanceSignOutBtn}
                      onPress={async () => {
                        const { signOut } = await import('../lib/auth');
                        await signOut();
                        setMaintenanceActive(false);
                        router.replace('/welcome');
                      }}
                    >
                      <Text style={layoutStyles.maintenanceSignOutBtnText}>Sign Out</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </SafeAreaProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const layoutStyles = StyleSheet.create({
  maintenanceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999999,
  },
  maintenanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 32,
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
  },
  maintenanceIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  maintenanceTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  maintenanceMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  maintenanceRefreshBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  maintenanceRefreshBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  maintenanceSignOutBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  maintenanceSignOutBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
