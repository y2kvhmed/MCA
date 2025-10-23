import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AssignmentOverview() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assignmentId) {
      loadAssignmentData();
    }
  }, [assignmentId]);

  const loadAssignmentData = async () => {
    try {
      // Load assignment details
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select(`
          *,
          class:classes(id, name, school_id)
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentData) {
        setAssignment(assignmentData);

        // Load student status using the view
        const { data: studentData } = await supabase
          .from('v_student_assignment_status')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('student_name');

        if (studentData) {
          setStudents(studentData);
        }
      }
    } catch (error) {
      console.error('Load assignment data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return Colors.success;
      case 'graded': return Colors.info;
      case 'missing': return Colors.error;
      case 'late': return Colors.warning;
      default: return Colors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return 'checkmark-circle';
      case 'graded': return 'star';
      case 'missing': return 'close-circle';
      case 'late': return 'time';
      default: return 'help-circle';
    }
  };

  const renderStudentRow = ({ item }: { item: any }) => (
    <View style={styles.studentRow}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student_name}</Text>
        <Text style={styles.studentEmail}>{item.student_email}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactText}>{item.student_phone || 'N/A'}</Text>
        <Text style={styles.contactText}>{item.parent_phone || 'N/A'}</Text>
      </View>
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.submission_status) }]}>
          <Ionicons 
            name={getStatusIcon(item.submission_status)} 
            size={16} 
            color={Colors.text.inverse} 
          />
          <Text style={styles.statusText}>
            {item.submission_status.toUpperCase()}
          </Text>
        </View>
        {item.is_late && (
          <Text style={styles.lateText}>
            {Math.round(item.hours_late)}h late
          </Text>
        )}
        {item.grade && (
          <Text style={styles.gradeText}>
            {item.grade}/{assignment?.max_score}
          </Text>
        )}
      </View>
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
        <Text style={styles.headerTitle}>Assignment Overview</Text>
        <View style={{ width: 24 }} />
      </View>

      {assignment && (
        <Card style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>{assignment.title}</Text>
          <Text style={styles.assignmentClass}>{assignment.class?.name}</Text>
          <Text style={styles.assignmentDue}>
            Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
          </Text>
          <Text style={styles.assignmentScore}>Max Score: {assignment.max_score}</Text>
        </Card>
      )}

      <View style={styles.tableHeader}>
        <Text style={styles.headerCell}>Student</Text>
        <Text style={styles.headerCell}>Contact</Text>
        <Text style={styles.headerCell}>Status</Text>
      </View>

      {students.length === 0 ? (
        <EmptyState icon="people-outline" message="No students found" />
      ) : (
        <FlatList
          data={students}
          renderItem={renderStudentRow}
          keyExtractor={(item) => item.student_id}
          style={styles.studentList}
        />
      )}
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
  assignmentCard: {
    margin: Spacing.lg,
    marginBottom: Spacing.md,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  assignmentClass: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  assignmentDue: {
    fontSize: 14,
    color: Colors.warning,
    marginBottom: Spacing.xs,
  },
  assignmentScore: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.inverse,
    textAlign: 'center',
  },
  studentList: {
    flex: 1,
  },
  studentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card.background,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  contactInfo: {
    flex: 1,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.inverse,
    marginLeft: 4,
  },
  lateText: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '500',
  },
  gradeText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
});