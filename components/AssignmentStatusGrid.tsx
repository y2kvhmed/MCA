import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface Student {
  id: string;
  name: string;
  email: string;
  submission?: {
    submitted_at: string;
    grade?: number;
  };
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  max_score: number;
}

interface AssignmentStatusGridProps {
  assignment: Assignment;
  students: Student[];
  onStudentPress?: (studentId: string) => void;
}

export default function AssignmentStatusGrid({ 
  assignment, 
  students, 
  onStudentPress 
}: AssignmentStatusGridProps) {
  
  const getStatusColor = (student: Student) => {
    if (!student.submission?.submitted_at) {
      return Colors.error; // Not submitted - red
    }
    
    const submissionDate = new Date(student.submission.submitted_at);
    const dueDate = new Date(assignment.due_date);
    
    if (submissionDate <= dueDate) {
      return Colors.success; // On time - green
    } else {
      return Colors.warning; // Late - yellow
    }
  };

  const getStatusIcon = (student: Student) => {
    if (!student.submission?.submitted_at) {
      return 'close-circle';
    }
    
    const submissionDate = new Date(student.submission.submitted_at);
    const dueDate = new Date(assignment.due_date);
    
    if (submissionDate <= dueDate) {
      return 'checkmark-circle';
    } else {
      return 'time';
    }
  };

  const getStatusText = (student: Student) => {
    if (!student.submission?.submitted_at) {
      return 'Not Submitted';
    }
    
    const submissionDate = new Date(student.submission.submitted_at);
    const dueDate = new Date(assignment.due_date);
    
    if (submissionDate <= dueDate) {
      return 'Submitted On Time';
    } else {
      const daysLate = Math.ceil((submissionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return `Late (${daysLate} day${daysLate > 1 ? 's' : ''})`;
    }
  };

  const submittedCount = students.filter(s => s.submission?.submitted_at).length;
  const onTimeCount = students.filter(s => {
    if (!s.submission?.submitted_at) return false;
    return new Date(s.submission.submitted_at) <= new Date(assignment.due_date);
  }).length;
  const lateCount = students.filter(s => {
    if (!s.submission?.submitted_at) return false;
    return new Date(s.submission.submitted_at) > new Date(assignment.due_date);
  }).length;
  const notSubmittedCount = students.length - submittedCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.dueDate}>
          Due: {new Date(assignment.due_date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: Colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
          <Text style={styles.statNumber}>{onTimeCount}</Text>
          <Text style={styles.statLabel}>On Time</Text>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: Colors.warning + '20' }]}>
            <Ionicons name="time" size={20} color={Colors.warning} />
          </View>
          <Text style={styles.statNumber}>{lateCount}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: Colors.error + '20' }]}>
            <Ionicons name="close-circle" size={20} color={Colors.error} />
          </View>
          <Text style={styles.statNumber}>{notSubmittedCount}</Text>
          <Text style={styles.statLabel}>Missing</Text>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: Colors.info + '20' }]}>
            <Ionicons name="people" size={20} color={Colors.info} />
          </View>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <ScrollView style={styles.studentsContainer}>
        {students.map((student) => (
          <TouchableOpacity
            key={student.id}
            style={styles.studentRow}
            onPress={() => onStudentPress?.(student.id)}
          >
            <View style={styles.studentInfo}>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(student) }]}>
                <Ionicons 
                  name={getStatusIcon(student)} 
                  size={16} 
                  color={Colors.text.inverse} 
                />
              </View>
              <View style={styles.studentDetails}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.statusText}>{getStatusText(student)}</Text>
                {student.submission?.grade !== undefined && (
                  <Text style={styles.gradeText}>
                    Grade: {student.submission.grade}/{assignment.max_score} 
                    ({((student.submission.grade / assignment.max_score) * 100).toFixed(1)}%)
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  dueDate: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  studentsContainer: {
    maxHeight: 400,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  studentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  gradeText: {
    fontSize: 12,
    color: Colors.info,
    fontWeight: '500',
  },
});