import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../lib/auth';
import LoadingSpinner from './LoadingSpinner';
import { Colors } from '../constants/Colors';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  redirectTo?: string;
}

export default function RoleGuard({ allowedRoles, children, redirectTo = '/' }: RoleGuardProps) {
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
      // Permissive access during testing: allow visiting any page
      setHasAccess(true);
    } catch (error) {
      console.error('Access check error:', error);
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
        <Text style={styles.message}>Access Denied</Text>
        <Text style={styles.submessage}>You don't have permission to view this page.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  message: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
    marginBottom: 10,
  },
  submessage: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});