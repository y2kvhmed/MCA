import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function NotFoundScreen() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setRole(user.role);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleReturn = () => {
    if (!role) {
      router.replace('/login');
      return;
    }

    switch (role) {
      case 'admin':
        router.replace('/(tabs)/admin-dashboard');
        break;
      case 'teacher':
        router.replace('/(tabs)/teacher-dashboard');
        break;
      case 'student':
        router.replace('/(tabs)/student-dashboard');
        break;
      default:
        router.replace('/login');
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="help-outline" size={48} color={Colors.primary} />
        </View>

        <Text style={styles.errorCode}>404</Text>
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.message}>
          The page or screen you are looking for does not exist or may have been moved.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleReturn} activeOpacity={0.8}>
          <Ionicons name="home-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>
            {role ? 'Return to Dashboard' : 'Return to Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
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
    maxWidth: 400,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorCode: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
