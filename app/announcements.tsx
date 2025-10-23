import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getAnnouncements, createAnnouncement, getSchools, getUsers } from '../lib/database';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Spacing } from '../constants/Styles';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  sender: {
    name: string;
    role: string;
  };
  target_type: 'all_schools' | 'specific_school' | 'specific_user';
  target_id?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export default function Announcements() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all_schools' | 'specific_school' | 'specific_user'>('all_schools');
  const [targetId, setTargetId] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load announcements
      const { data: announcementsData } = await getAnnouncements(currentUser.id);
      if (announcementsData) {
        setAnnouncements(announcementsData);
      }

      // Load schools and users if admin/teacher
      if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        const [schoolsResult, usersResult] = await Promise.all([
          getSchools(),
          getUsers()
        ]);
        
        if (schoolsResult.data) setSchools(schoolsResult.data);
        if (usersResult.data) setUsers(usersResult.data);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const createNewAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }

    if (targetType !== 'all_schools' && !targetId) {
      Alert.alert('Error', 'Please select a target');
      return;
    }

    setCreating(true);
    try {
      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        sender_id: user.id,
        target_type: targetType,
        target_id: targetType === 'all_schools' ? null : targetId,
        priority,
        message_type: 'announcement',
      };

      const { error } = await createAnnouncement(announcementData);
      
      if (error) {
        handleError(error, 'Failed to create announcement');
      } else {
        showSuccess('Announcement created successfully');
        setTitle('');
        setContent('');
        setTargetType('all_schools');
        setTargetId('');
        setPriority('normal');
        setShowCreateForm(false);
        loadData();
      }
    } catch (error) {
      handleError(error, 'Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return colors.error;
      case 'high': return colors.warning;
      case 'normal': return colors.info;
      case 'low': return colors.text.secondary;
      default: return colors.text.secondary;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'alert-circle';
      case 'high': return 'warning';
      case 'normal': return 'information-circle';
      case 'low': return 'chatbubble';
      default: return 'chatbubble';
    }
  };

  const styles = createStyles(colors);

  if (loading) {
    return <LoadingSpinner />;
  }

  const canCreateAnnouncements = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        {canCreateAnnouncements && (
          <TouchableOpacity onPress={() => setShowCreateForm(!showCreateForm)}>
            <Ionicons name={showCreateForm ? "close" : "add"} size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Create Announcement Form */}
        {showCreateForm && canCreateAnnouncements && (
          <AnimatedCard style={styles.createCard} delay={100}>
            <Text style={styles.sectionTitle}>Create Announcement</Text>
            
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter announcement title"
            />
            
            <Input
              label="Content"
              value={content}
              onChangeText={setContent}
              placeholder="Enter announcement content"
              multiline
              numberOfLines={4}
            />

            {/* Target Selection */}
            <Text style={styles.label}>Send To:</Text>
            <View style={styles.targetSelector}>
              <TouchableOpacity
                style={[
                  styles.targetButton,
                  targetType === 'all_schools' && styles.targetButtonSelected,
                ]}
                onPress={() => setTargetType('all_schools')}
              >
                <Text style={[
                  styles.targetButtonText,
                  targetType === 'all_schools' && styles.targetButtonTextSelected,
                ]}>
                  All Schools
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetButton,
                  targetType === 'specific_school' && styles.targetButtonSelected,
                ]}
                onPress={() => setTargetType('specific_school')}
              >
                <Text style={[
                  styles.targetButtonText,
                  targetType === 'specific_school' && styles.targetButtonTextSelected,
                ]}>
                  Specific School
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetButton,
                  targetType === 'specific_user' && styles.targetButtonSelected,
                ]}
                onPress={() => setTargetType('specific_user')}
              >
                <Text style={[
                  styles.targetButtonText,
                  targetType === 'specific_user' && styles.targetButtonTextSelected,
                ]}>
                  Specific User
                </Text>
              </TouchableOpacity>
            </View>

            {/* Target Selection Dropdown */}
            {targetType === 'specific_school' && (
              <View style={styles.dropdownContainer}>
                <Text style={styles.label}>Select School:</Text>
                {schools.map(school => (
                  <TouchableOpacity
                    key={school.id}
                    style={[
                      styles.dropdownItem,
                      targetId === school.id && styles.dropdownItemSelected,
                    ]}
                    onPress={() => setTargetId(school.id)}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      targetId === school.id && styles.dropdownItemTextSelected,
                    ]}>
                      {school.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {targetType === 'specific_user' && (
              <View style={styles.dropdownContainer}>
                <Text style={styles.label}>Select User:</Text>
                {users.slice(0, 10).map(userItem => (
                  <TouchableOpacity
                    key={userItem.id}
                    style={[
                      styles.dropdownItem,
                      targetId === userItem.id && styles.dropdownItemSelected,
                    ]}
                    onPress={() => setTargetId(userItem.id)}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      targetId === userItem.id && styles.dropdownItemTextSelected,
                    ]}>
                      {userItem.name} ({userItem.role})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Priority Selection */}
            <Text style={styles.label}>Priority:</Text>
            <View style={styles.prioritySelector}>
              {['low', 'normal', 'high', 'urgent'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    priority === p && styles.priorityButtonSelected,
                    { borderColor: getPriorityColor(p) }
                  ]}
                  onPress={() => setPriority(p as any)}
                >
                  <Ionicons 
                    name={getPriorityIcon(p) as any} 
                    size={16} 
                    color={priority === p ? colors.text.inverse : getPriorityColor(p)} 
                  />
                  <Text style={[
                    styles.priorityButtonText,
                    priority === p && styles.priorityButtonTextSelected,
                    { color: priority === p ? colors.text.inverse : getPriorityColor(p) }
                  ]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Create Announcement"
              onPress={createNewAnnouncement}
              loading={creating}
              disabled={creating}
              style={styles.createButton}
            />
          </AnimatedCard>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <EmptyState
            icon="megaphone"
            message="No announcements yet. Check back later for updates."
          />
        ) : (
          announcements.map((announcement, index) => (
            <AnimatedCard key={announcement.id} style={styles.announcementCard} delay={200 + (index * 50)}>
              <View style={styles.announcementHeader}>
                <View style={styles.announcementInfo}>
                  <Text style={styles.announcementTitle}>{announcement.title}</Text>
                  <Text style={styles.announcementMeta}>
                    By {announcement.sender.name} • {formatRelativeDate(announcement.created_at)}
                  </Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(announcement.priority) }]}>
                  <Ionicons 
                    name={getPriorityIcon(announcement.priority) as any} 
                    size={12} 
                    color={colors.text.inverse} 
                  />
                  <Text style={styles.priorityBadgeText}>
                    {announcement.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.announcementContent}>{announcement.content}</Text>
              
              <View style={styles.announcementFooter}>
                <Text style={styles.targetInfo}>
                  {announcement.target_type === 'all_schools' 
                    ? 'Sent to all schools' 
                    : `Sent to ${announcement.target_type.replace('_', ' ')}`
                  }
                </Text>
              </View>
            </AnimatedCard>
          ))
        )}
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
  createCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  targetSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  targetButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  targetButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetButtonText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  targetButtonTextSelected: {
    color: colors.text.inverse,
  },
  dropdownContainer: {
    marginBottom: Spacing.md,
  },
  dropdownItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background,
    marginBottom: Spacing.xs,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  dropdownItemTextSelected: {
    color: colors.text.inverse,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.background,
    gap: 4,
  },
  priorityButtonSelected: {
    backgroundColor: colors.primary,
  },
  priorityButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priorityButtonTextSelected: {
    color: colors.text.inverse,
  },
  createButton: {
    marginTop: Spacing.md,
  },
  announcementCard: {
    marginBottom: Spacing.lg,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  announcementInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  announcementMeta: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  announcementContent: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  announcementFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: Spacing.sm,
  },
  targetInfo: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
});