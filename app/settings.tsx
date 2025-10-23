import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, signOut } from '../lib/auth';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import { Spacing } from '../constants/Styles';

export default function Settings() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Load user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/welcome');
          },
        },
      ]
    );
  };

  const styles = createStyles(colors);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* User Info */}
        <AnimatedCard style={styles.userCard} delay={100}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={colors.text.inverse} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={[styles.roleBadge, { backgroundColor: colors.role[user?.role as keyof typeof colors.role] }]}>
                <Text style={styles.roleBadgeText}>{user?.role?.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Appearance Settings */}
        <AnimatedCard style={styles.settingsCard} delay={200}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon" size={20} color={colors.text.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDescription}>
                  Switch between light and dark themes
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border.medium, true: colors.primary }}
              thumbColor={isDarkMode ? colors.accent : colors.card.background}
            />
          </View>
        </AnimatedCard>

        {/* Notification Settings */}
        <AnimatedCard style={styles.settingsCard} delay={300}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={20} color={colors.text.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive notifications for assignments and messages
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border.medium, true: colors.primary }}
              thumbColor={notificationsEnabled ? colors.accent : colors.card.background}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high" size={20} color={colors.text.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Sound</Text>
                <Text style={styles.settingDescription}>
                  Play sounds for notifications
                </Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: colors.border.medium, true: colors.primary }}
              thumbColor={soundEnabled ? colors.accent : colors.card.background}
            />
          </View>
        </AnimatedCard>

        {/* Account Settings */}
        <AnimatedCard style={styles.settingsCard} delay={400}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push(`/(tabs)/${user?.role}-profile`)}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="person-circle" size={20} color={colors.text.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Edit Profile</Text>
                <Text style={styles.settingDescription}>
                  Update your personal information
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Alert.alert('Privacy Policy', 'Privacy policy content would go here.')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark" size={20} color={colors.text.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Privacy Policy</Text>
                <Text style={styles.settingDescription}>
                  View our privacy policy
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </AnimatedCard>

        {/* Sign Out */}
        <AnimatedCard style={styles.settingsCard} delay={500}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Physics Learning Platform</Text>
          <Text style={styles.appInfoText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: colors.card.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  userCard: {
    marginBottom: Spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  userEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  roleBadgeText: {
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.error,
    marginLeft: Spacing.sm,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  appInfoText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
});