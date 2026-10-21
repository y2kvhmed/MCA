import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, signOut } from '../../lib/auth';
import { getStudentStats } from '../../lib/database';
import { handleError } from '../../lib/utils';
import Card from '../../components/Card';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function StudentProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      const avatar = currentUser.avatar_url || (await AsyncStorage.getItem(`@student_avatar_${currentUser.id}`));
      if (avatar) setAvatarUri(avatar);

      // Load real student statistics from database
      const { supabase } = await import('../../lib/supabase');
      
      // Get total assignments for student's school
      let totalAssignments = 0;
      if (currentUser.school_id) {
        const { count } = await supabase
          .from('assignments')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', currentUser.school_id);
        totalAssignments = count || 0;
      }
      
      // Get student's submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, grade, assignment:assignments(max_score)')
        .eq('student_id', currentUser.id);
      
      const completedAssignments = submissions?.length || 0;
      
      // Calculate average grade from submissions that have grades
      let averageGrade = 0;
      if (submissions && submissions.length > 0) {
        const gradedSubmissions = submissions.filter((s: any) => s.grade !== null && s.assignment?.max_score);
        if (gradedSubmissions.length > 0) {
          const totalPercentage = gradedSubmissions.reduce((sum: number, s: any) => {
            return sum + (s.grade / s.assignment.max_score) * 100;
          }, 0);
          averageGrade = Math.round(totalPercentage / gradedSubmissions.length);
        }
      }
      
      setStats({
        totalAssignments,
        completedAssignments,
        averageGrade,
      });
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // Strict limit: 3MB

        if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE) {
          Alert.alert('Image Too Large', 'Profile picture must be under 3MB. Please choose a smaller image.');
          return;
        }

        setUploadingAvatar(true);
        let blob: Blob;
        if ((asset as any).file instanceof Blob) {
          blob = (asset as any).file;
        } else {
          const response = await fetch(asset.uri);
          blob = await response.blob();
        }

        if (blob.size > MAX_AVATAR_SIZE) {
          Alert.alert('Image Too Large', 'Profile picture must be under 3MB. Please choose a smaller image.');
          setUploadingAvatar(false);
          return;
        }

        setAvatarUri(asset.uri);
        if (user?.id) {
          await AsyncStorage.setItem(`@student_avatar_${user.id}`, asset.uri);
        }

        try {
          const { supabase } = await import('../../lib/supabase');
          const fileName = `avatars/${user?.id || 'student'}-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('materials')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('materials')
              .getPublicUrl(fileName);
            if (urlData?.publicUrl) {
              setAvatarUri(urlData.publicUrl);
              const updatedUser = { ...user, avatar_url: urlData.publicUrl };
              setUser(updatedUser);
              await AsyncStorage.setItem('current_user', JSON.stringify(updatedUser));
              await AsyncStorage.setItem(`@student_avatar_${user.id}`, urlData.publicUrl);
              await supabase.from('app_users').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
            }
          }
        } catch (e) {
          console.log('Online avatar note:', e);
        }

        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error changing avatar:', error);
      Alert.alert('Error', 'Failed to update profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {

    try {
      // Clear all storage
      await AsyncStorage.clear();
      
      // Force navigation
      if (typeof window !== 'undefined') {
        window.location.href = '/welcome';
      } else {
        router.dismissAll();
        router.replace('/welcome');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to navigate
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Profile Header */}
        <AnimatedCard style={styles.profileCard} delay={100}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              onPress={handlePickAvatar} 
              activeOpacity={0.8}
              style={styles.avatarTouchable}
              disabled={uploadingAvatar}
            >
              <View style={styles.avatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={32} color={Colors.text.inverse} />
                )}
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={13} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRole}>Student</Text>
            </View>
          </View>
        </AnimatedCard>

        {/* Academic Stats */}
        <AnimatedCard style={styles.statsCard} delay={200}>
          <Text style={styles.sectionTitle}>Academic Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.totalAssignments || 0}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{stats.completedAssignments || 0}</Text>
              <Text style={styles.statLabel}>Submitted</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={24} color={Colors.error} />
              <Text style={[styles.statValue, { color: Colors.error }]}>
                {Math.max(0, (stats.totalAssignments || 0) - (stats.completedAssignments || 0))}
              </Text>
              <Text style={styles.statLabel}>Missing</Text>
            </View>
          </View>
        </AnimatedCard>

        {/* Contact Information */}
        <AnimatedCard style={styles.contactCard} delay={300}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.contactItem}>
            <Ionicons name="mail" size={20} color={Colors.text.secondary} />
            <Text style={styles.contactText}>{user?.email}</Text>
          </View>
          
          {user?.phone && (
            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color={Colors.text.secondary} />
              <Text style={styles.contactText}>{user.phone}</Text>
            </View>
          )}
          
        </AnimatedCard>



        {/* Change Password */}
        <Button
          title="Change Password"
          onPress={() => router.push('/change-password')}
          variant="outline"
          icon="key-outline"
          style={{ marginBottom: Spacing.md }}
        />

        {/* Logout Button */}
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarTouchable: {
    marginRight: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  profileRole: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  editButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  contactCard: {
    marginBottom: Spacing.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  contactText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  actionsCard: {
    marginBottom: Spacing.lg,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  settingLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  settingValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  logoutButton: {
    marginBottom: Spacing.xl,
  },
});
