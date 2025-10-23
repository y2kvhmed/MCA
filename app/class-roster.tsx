import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ClassRoster() {
  const router = useRouter();
  const { classId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudents, setShowAddStudents] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      // Load enrolled students
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          *,
          student:app_users!enrollments_student_id_fkey(id, name, email, grade_level)
        `)
        .eq('class_id', classId);

      if (enrollmentsError) throw enrollmentsError;
      setEnrolledStudents(enrollmentsData || []);

      // Load available students (not enrolled in this class)
      const enrolledStudentIds = enrollmentsData?.map(e => e.student_id) || [];
      
      let availableQuery = supabase
        .from('app_users')
        .select('id, name, email, grade_level')
        .eq('role', 'student')
        .eq('school_id', currentUser.school_id)
        .eq('is_active', true);

      if (enrolledStudentIds.length > 0) {
        availableQuery = availableQuery.not('id', 'in', `(${enrolledStudentIds.join(',')})`);
      }

      const { data: availableData, error: availableError } = await availableQuery;
      
      if (availableError) throw availableError;
      setAvailableStudents(availableData || []);

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load class roster');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert({
          class_id: classId,
          student_id: studentId,
        });

      if (error) throw error;
      showSuccess('Student enrolled successfully');
      loadData();
    } catch (error) {
      handleError(error, 'Failed to enroll student');
    }
  };

  const handleUnenrollStudent = (enrollment: any) => {
    Alert.alert(
      'Remove Student',
      `Are you sure you want to remove ${enrollment.student.name} from this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('enrollments')
                .delete()
                .eq('id', enrollment.id);

              if (error) throw error;
              showSuccess('Student removed from class');
              loadData();
            } catch (error) {
              handleError(error, 'Failed to remove student');
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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{classInfo?.name || 'Class Roster'}</Text>
          <Text style={styles.headerSubtitle}>{enrolledStudents.length} students enrolled</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddStudents(!showAddStudents)}>
          <Ionicons name="person-add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Add Students Section */}
        {showAddStudents && (
          <AnimatedCard style={styles.addStudentsCard} delay={100}>
            <Text style={styles.sectionTitle}>Add Students to Class</Text>
            
            {availableStudents.length === 0 ? (
              <Text style={styles.noStudentsText}>
                All available students are already enrolled in this class.
              </Text>
            ) : (
              availableStudents.map((student) => (
                <View key={student.id} style={styles.availableStudentItem}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentEmail}>{student.email}</Text>
                    {student.grade_level && (
                      <Text style={styles.studentGrade}>Grade {student.grade_level}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.enrollButton}
                    onPress={() => handleEnrollStudent(student.id)}
                  >
                    <Ionicons name="add" size={20} color={Colors.success} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </AnimatedCard>
        )}

        {/* Enrolled Students */}
        <Text style={styles.sectionTitle}>Enrolled Students</Text>
        
        {enrolledStudents.length === 0 ? (
          <EmptyState
            icon="people"
            title="No Students Enrolled"
            description="Add students to this class to get started."
            action={
              <Button
                title="Add Students"
                onPress={() => setShowAddStudents(true)}
                style={styles.emptyActionButton}
              />
            }
          />
        ) : (
          enrolledStudents.map((enrollment, index) => (
            <AnimatedCard key={enrollment.id} style={styles.studentCard} delay={200 + index * 50}>
              <View style={styles.studentHeader}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {enrollment.student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.studentDetails}>
                  <Text style={styles.studentName}>{enrollment.student.name}</Text>
                  <Text style={styles.studentEmail}>{enrollment.student.email}</Text>
                  {enrollment.student.grade_level && (
                    <Text style={styles.studentGrade}>Grade {enrollment.student.grade_level}</Text>
                  )}
                  <Text style={styles.enrolledDate}>
                    Enrolled {new Date(enrollment.joined_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.studentActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/student-details?studentId=${enrollment.student.id}`)}
                  >
                    <Ionicons name="eye" size={20} color={Colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleUnenrollStudent(enrollment)}
                  >
                    <Ionicons name="remove-circle" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.studentQuickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push(`/student-grades?studentId=${enrollment.student.id}&classId=${classId}`)}
                >
                  <Ionicons name="trophy" size={16} color={Colors.warning} />
                  <Text style={styles.quickActionText}>Grades</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push(`/attendance?studentId=${enrollment.student.id}&classId=${classId}`)}
                >
                  <Ionicons name="calendar" size={16} color={Colors.info} />
                  <Text style={styles.quickActionText}>Attendance</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push(`/student-progress?studentId=${enrollment.student.id}&classId=${classId}`)}
                >
                  <Ionicons name="trending-up" size={16} color={Colors.success} />
                  <Text style={styles.quickActionText}>Progress</Text>
                </TouchableOpacity>
              </View>
            </AnimatedCard>
          ))
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  addStudentsCard: {
    marginBottom: Spacing.lg,
  },
  noStudentsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    padding: Spacing.lg,
  },
  availableStudentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  studentGrade: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  enrollButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentCard: {
    marginBottom: Spacing.lg,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
  studentDetails: {
    flex: 1,
  },
  enrolledDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
  studentActions: {
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
  studentQuickActions: {
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