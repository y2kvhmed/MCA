import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../components/Input';
import Button from '../components/Button';
import GeometricBackground from '../components/GeometricBackground';
import { signIn } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [maintenanceInfo, setMaintenanceInfo] = useState<{ active: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('maintenance_mode, maintenance_message')
          .eq('id', 1)
          .single();
        if (data?.maintenance_mode) {
          setMaintenanceInfo({
            active: true,
            message: data.maintenance_message || 'System maintenance in progress.',
          });
        }
      } catch (e) {
        // non-blocking
      }
    })();
  }, []);

  const handleLogin = async () => {
    setErrorMessage(''); // Clear previous errors
    
    if (!email || !password) {
      setErrorMessage('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const { user, error } = await signIn(email.trim().toLowerCase(), password);
      
      if (error || !user) {
        // Show the specific error message from the auth system
        setErrorMessage(error || 'Invalid email or password');
        return;
      }

      // Navigate based on role
      if (user.role === 'admin') {
        router.replace('/(tabs)/admin-dashboard');
      } else if (user.role === 'teacher') {
        router.replace('/(tabs)/teacher-dashboard');
      } else if (user.role === 'student') {
        router.replace('/(tabs)/student-dashboard');
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <GeometricBackground opacity={0.25} patternSize={70} />
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.primary} />
      </TouchableOpacity>

      <View style={styles.centerContainer}>
        <View style={styles.loginPanel}>
          <Text style={styles.title}>Welcome Back</Text>
          
          {maintenanceInfo?.active && (
            <View style={styles.maintenanceBanner}>
              <Ionicons name="construct-outline" size={20} color="#D97706" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.maintenanceBannerTitle}>System Under Maintenance</Text>
                <Text style={styles.maintenanceBannerText}>{maintenanceInfo.message}</Text>
              </View>
            </View>
          )}

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
          />

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Button
            title="Login"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: Spacing.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loginPanel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.card.background,
    borderRadius: 16,
    padding: Spacing.xxxl,
    shadowColor: Colors.card.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Spacing.xxxl,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  maintenanceBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  maintenanceBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 2,
  },
  maintenanceBannerText: {
    fontSize: 13,
    color: Colors.text.primary,
    marginBottom: 4,
    lineHeight: 18,
  },
  maintenanceBannerSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
});
