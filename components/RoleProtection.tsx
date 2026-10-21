import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../lib/auth';
import LoadingSpinner from './LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface RoleProtectionProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallbackRoute?: string;
}

export default function RoleProtection({ allowedRoles, children, fallbackRoute = '/' }: RoleProtectionProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        router.replace('/login');
        return;
      }

      setUser(currentUser);

      // Check if user's role is allowed
      if (!allowedRoles.includes(currentUser.role)) {
        console.warn(`Access denied for role "${currentUser.role}". Allowed roles: ${allowedRoles.join(', ')}`);
        setHasAccess(false);
        // Redirect directly to their own role's dashboard
        if (currentUser.role === 'admin') {
          router.replace('/(tabs)/admin-dashboard');
        } else if (currentUser.role === 'teacher') {
          router.replace('/(tabs)/teacher-dashboard');
        } else if (currentUser.role === 'student') {
          router.replace('/(tabs)/student-dashboard');
        } else {
          router.replace('/welcome');
        }
        return;
      }

      setHasAccess(true);
    } catch (error) {
      console.error('Error checking access:', error);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Access Denied</Text>
          <Text style={styles.message}>
            You don't have permission to access this page.
          </Text>
          <Text style={styles.roleInfo}>
            Required role: {allowedRoles.join(' or ')}
          </Text>
          <Text style={styles.currentRole}>
            Your role: {user?.role || 'Unknown'}
          </Text>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  roleInfo: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  currentRole: {
    fontSize: 14,
    color: Colors.text.tertiary,
  },
});
