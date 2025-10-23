import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess, formatRelativeDate } from '../lib/utils';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import Card from '../components/Card';

interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  parent_phone?: string;
  enrollment_date: string;
  enrollment_status: string;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  max_score: number;
  submission_count: number;
  graded_count: number;
}

export default function GroupManagement() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'assignments' | 'settings'>('students');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load group info
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroupInfo(groupData);

      // Load enrolled students
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          enrollment_date,
          enrollment_status,
          student:app_users!enrollments_student_id_fkey(id, name, email, phone, parent_phone)
        `)
        .eq('group_id', groupId)
        .order('enrollment_date', { ascending: false });

      if (enrollmentError) throw enrollmentError;

      const studentList = enrollmentData.map(e => ({
        ...e.student,
        enrollment_date: e.enrollment_date,
        enrollment_status: e.enrollment_status,
      }));
      setStudents(studentList);

      // Load assignments with submission counts
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          max_score,
          submissions:submissions(id, status)
        `)
        .eq('group_id', groupId)
        .order('due_date', { ascending: false });

      if (assignmentError) throw assignmentError;

      const assignmentList = assignmentData.map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.due_date,
        max_score: a.max_score,
        submission_count: a.submissions.length,
        graded_count: a.submissions.filter((s: any) => s.status === 'graded').length,
      }));
      setAssignments(assignmentList);

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    Alert.alert(
      'Remove Student',
      `Are you sure you want to remove ${studentName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('enrollments')
                .update({ enrollment_status: 'inactive' })
                .eq('group_id', groupId)
                .eq('student_id', studentId);

              if (error) throw error;

              showSuccess('Student removed from group');
              loadData(); // Reload data
            } catch (error) {
              handleError(error, 'Failed to remove student');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAssignment = async (assignmentId: string, assignmentTitle: string) => {
    Alert.alert(
      'Delete Assignment',
      `Are you sure you want to delete "${assignmentTitle}"? This will also delete all submissions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', assignmentId);

              if (error) throw error;

              showSuccess('Assignment deleted');
              loadData(); // Reload data
            } catch (error) {
              handleError(error, 'Failed to delete assignment');
            }
          },
        },
      ]
    );
  };

  const renderStudentsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Students ({students.length})</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push(`/add-student?groupId=${groupId}`)}
        >
          <Ionicons name="add" size={20} color={Colors.primary} />
          <Text style={styles.addButtonText}>Add Student</Text>
        </TouchableOpacity>
      </View>

      {students.length === 0 ? (
        <EmptyState
          icon="people"
          title="No Students Enrolled"
          description="Add students to this group to get started."
        />
      ) : (
        students.map((student) => (
          <Card key={student.id} style={styles.studentCard}>
            <View style={styles.studentHeader}>
              <View style={styles.studentAvatar}>
                <Ionicons name="person" size={24} color={Colors.text.inverse} />
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
                {student.phone && (
                  <Text style={styles.studentPhone}>📱 {student.phone}</Text>
                )}
                {student.parent_phone && (
                  <Text style={styles.parentPhone}>👨‍👩‍👧‍👦 {student.parent_phone}</Text>
                )}
              </View>
              <View style={styles.studentActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/student-details?studentId=${student.id}&groupId=${groupId}`)}
                >
                  <Ionicons name="eye" size={20} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleRemoveStudent(student.id, student.name)}
                >
                  <Ionicons name="remove-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.studentMeta}>
              <Text style={styles.enrollmentDate}>
                Enrolled {formatRelativeDate(student.enrollment_date)}
              </Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: student.enrollment_status === 'active' ? Colors.success + '20' : Colors.error + '20' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: student.enrollment_status === 'active' ? Colors.success : Colors.error }
                ]}>
                  {student.enrollment_status}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
  );

  const renderAssignmentsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Assignments ({assignments.length})</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push(`/create-assignment?groupId=${groupId}`)}
        >
          <Ionicons name="add" size={20} color={Colors.primary} />
          <Text style={styles.addButtonText}>New Assignment</Text>
        </TouchableOpacity>
      </View>

      {assignments.length === 0 ? (
        <EmptyState
          icon="document-text"
          title="No Assignments"
          description="Create assignments for your students to complete."
        />
      ) : (
        assignments.map((assignment) => (
          <Card key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentHeader}>
              <View style={styles.assignmentInfo}>
                <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                <Text style={styles.assignmentDue}>
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                </Text>
                <Text style={styles.assignmentScore}>Max Score: {assignment.max_score}</Text>
              </View>
              <View style={styles.assignmentActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/assignment-overview?assignmentId=${assignment.id}`)}
                >
                  <Ionicons name="eye" size={20} color={Colors.info} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/edit-assignment?assignmentId=${assignment.id}`)}
                >
                  <Ionicons name="create" size={20} color={Colors.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteAssignment(assignment.id, assignment.title)}
                >
                  <Ionicons name="trash" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.assignmentStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{assignment.submission_count}</Text>
                <Text style={styles.statLabel}>Submissions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{assignment.graded_count}</Text>
                <Text style={styles.statLabel}>Graded</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {assignment.submission_count > 0 
                    ? Math.round((assignment.graded_count / assignment.submission_count) * 100)
                    : 0}%
                </Text>
                <Text style={styles.statLabel}>Progress</Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Group Settings</Text>
      
      <Card style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Group Information</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Group Name:</Text>
          <Text style={styles.settingValue}>{groupInfo?.name}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Description:</Text>
          <Text style={styles.settingValue}>{groupInfo?.description || 'No description'}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Group Code:</Text>
          <Text style={styles.settingValue}>{groupInfo?.group_code}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Created:</Text>
          <Text style={styles.settingValue}>
            {formatRelativeDate(groupInfo?.created_at)}
          </Text>
        </View>
      </Card>

      <Card style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.settingAction}
          onPress={() => router.push(`/attendance?groupId=${groupId}`)}
        >
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
          <Text style={styles.settingActionText}>Take Attendance</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingAction}
          onPress={() => router.push(`/group-analytics?groupId=${groupId}`)}
        >
          <Ionicons name="analytics" size={24} color={Colors.info} />
          <Text style={styles.settingActionText}>View Analytics</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingAction}
          onPress={() => router.push(`/edit-group?groupId=${groupId}`)}
        >
          <Ionicons name="create" size={24} color={Colors.warning} />
          <Text style={styles.settingActionText}>Edit Group Details</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
      </Card>
    </View>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupInfo?.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'students' && styles.activeTabButton]}
          onPress={() => setActiveTab('students')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'students' ? Colors.primary : Colors.text.secondary} 
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'students' && styles.activeTabButtonText
          ]}>
            Students
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'assignments' && styles.activeTabButton]}
          onPress={() => setActiveTab('assignments')}
        >
          <Ionicons 
            name="document-text" 
            size={20} 
            color={activeTab === 'assignments' ? Colors.primary : Colors.text.secondary} 
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'assignments' && styles.activeTabButtonText
          ]}>
            Assignments
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'settings' && styles.activeTabButton]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons 
            name="settings" 
            size={20} 
            color={activeTab === 'settings' ? Colors.primary : Colors.text.secondary} 
          />
          <Text style={[
            styles.tabButtonText,
            activeTab === 'settings' && styles.activeTabButtonText
          ]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'students' && renderStudentsTab()}
        {activeTab === 'assignments' && renderAssignmentsTab()}
        {activeTab === 'settings' && renderSettingsTab()}
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
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  activeTabButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  tabContent: {
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  studentCard: {
    marginBottom: Spacing.md,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  studentPhone: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  parentPhone: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  studentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  studentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enrollmentDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  assignmentCard: {
    marginBottom: Spacing.md,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  assignmentInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  assignmentDue: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  assignmentScore: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  assignmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  settingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingActionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
});