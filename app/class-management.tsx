import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ClassManagement() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [className, setClassName] = useState('');
  const [classDescription, setClassDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load teacher's classes
      const { data: classesData, error } = await supabase
        .from('classes')
        .select(`
          *,
          enrollments(count),
          assignments(count)
        `)
        .eq('teacher_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(classesData || []);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!className.trim()) {
      Alert.alert('Error', 'Class name is required');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: className.trim(),
          description: classDescription.trim() || null,
          teacher_id: user.id,
          school_id: user.school_id,
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Class created successfully');
      setClassName('');
      setClassDescription('');
      setShowCreateForm(false);
      loadData();
    } catch (error) {
      console.error('Create class error:', error);
      handleError(error, 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClass = (classItem: any) => {
    Alert.alert(
      'Delete Class',
      `Are you sure you want to delete "${classItem.name}"? This will also delete all assignments and enrollments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', classItem.id);

              if (error) throw error;
              showSuccess('Class deleted successfully');
              loadData();
            } catch (error) {
              handleError(error, 'Failed to delete class');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Management</Text>
        <TouchableOpacity onPress={() => setShowCreateForm(!showCreateForm)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Create Class Form */}
        {showCreateForm && (
          <AnimatedCard style={styles.createForm} delay={100}>
            <Text style={styles.formTitle}>Create New Class</Text>
            
            <Input
              label="Class Name *"
              value={className}
              onChangeText={setClassName}
              placeholder="e.g., Physics 101"
            />
            
            <Input
              label="Description"
              value={classDescription}
              onChangeText={setClassDescription}
              placeholder="Brief description of the class"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.formActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowCreateForm(false);
                  setClassName('');
                  setClassDescription('');
                }}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title="Create Class"
                onPress={handleCreateClass}
                loading={creating}
                disabled={creating}
                style={styles.createButton}
              />
            </View>
          </AnimatedCard>
        )}

        {/* Classes List */}
        {classes.length === 0 ? (
          <EmptyState
            icon="school"
            title="No Classes Yet"
            description="Create your first class to start managing students and assignments."
            action={
              <Button
                title="Create First Class"
                onPress={() => setShowCreateForm(true)}
                style={styles.emptyActionButton}
              />
            }
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your Classes ({classes.length})</Text>
            {classes.map((classItem, index) => (
              <AnimatedCard key={classItem.id} style={styles.classCard} delay={200 + index * 100}>
                <View style={styles.classHeader}>
                  <View style={styles.classIcon}>
                    <Ionicons name="school" size={24} color={Colors.text.inverse} />
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{classItem.name}</Text>
                    {classItem.description && (
                      <Text style={styles.classDescription}>{classItem.description}</Text>
                    )}
                    <View style={styles.classStats}>
                      <Text style={styles.statText}>
                        {classItem.enrollments?.[0]?.count || 0} students
                      </Text>
                      <Text style={styles.statText}>
                        {classItem.assignments?.[0]?.count || 0} assignments
                      </Text>
                    </View>
                  </View>
                  <View style={styles.classActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.push(`/class-roster?classId=${classItem.id}`)}
                    >
                      <Ionicons name="people" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteClass(classItem)}
                    >
                      <Ionicons name="trash" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.classQuickActions}>
                  <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => router.push(`/create-assignment?classId=${classItem.id}`)}
                  >
                    <Ionicons name="add-circle" size={16} color={Colors.primary} />
                    <Text style={styles.quickActionText}>New Assignment</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => router.push(`/class-roster?classId=${classItem.id}`)}
                  >
                    <Ionicons name="people" size={16} color={Colors.info} />
                    <Text style={styles.quickActionText}>Manage Students</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => router.push(`/assignment-overview?classId=${classItem.id}`)}
                  >
                    <Ionicons name="document-text" size={16} color={Colors.success} />
                    <Text style={styles.quickActionText}>View Assignments</Text>
                  </TouchableOpacity>
                </View>
              </AnimatedCard>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  createForm: {
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  classCard: {
    marginBottom: Spacing.lg,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  classDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  classStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  classActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.text.primary,
    marginLeft: Spacing.xs,
    fontWeight: '500',
  },
  emptyActionButton: {
    marginTop: Spacing.lg,
  },
});