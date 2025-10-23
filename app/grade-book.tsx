import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface GradeData {
  student: any;
  assignments: { [key: string]: any };
  average: number;
}

export default function GradeBook() {
  const router = useRouter();
  const { classId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<GradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'average'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

      // Load assignments for this class
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .eq('class_id', classId)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Load enrolled students
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          *,
          student:app_users!enrollments_student_id_fkey(id, name, email, grade_level)
        `)
        .eq('class_id', classId);

      if (enrollmentsError) throw enrollmentsError;

      // Load all submissions for these assignments
      const assignmentIds = assignmentsData?.map(a => a.id) || [];
      const studentIds = enrollmentsData?.map(e => e.student_id) || [];

      if (assignmentIds.length > 0 && studentIds.length > 0) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('submissions')
          .select('*')
          .in('assignment_id', assignmentIds)
          .in('student_id', studentIds);

        if (submissionsError) throw submissionsError;

        // Process grade data
        const processedGradeData = enrollmentsData.map(enrollment => {
          const student = enrollment.student;
          const studentSubmissions = submissionsData?.filter(s => s.student_id === student.id) || [];
          
          const assignmentGrades: { [key: string]: any } = {};
          let totalPoints = 0;
          let maxPoints = 0;

          assignmentsData?.forEach(assignment => {
            const submission = studentSubmissions.find(s => s.assignment_id === assignment.id);
            assignmentGrades[assignment.id] = submission || null;
            
            if (submission?.grade !== null && submission?.grade !== undefined) {
              totalPoints += submission.grade;
              maxPoints += assignment.max_score;
            }
          });

          const average = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

          return {
            student,
            assignments: assignmentGrades,
            average,
          };
        });

        setGradeData(processedGradeData);
      } else {
        setGradeData(enrollmentsData?.map(e => ({
          student: e.student,
          assignments: {},
          average: 0,
        })) || []);
      }

    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load gradebook');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return Colors.success;
    if (percentage >= 80) return Colors.info;
    if (percentage >= 70) return Colors.warning;
    return Colors.error;
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const sortedGradeData = [...gradeData].sort((a, b) => {
    if (sortBy === 'name') {
      const comparison = a.student.name.localeCompare(b.student.name);
      return sortOrder === 'asc' ? comparison : -comparison;
    } else {
      const comparison = a.average - b.average;
      return sortOrder === 'asc' ? comparison : -comparison;
    }
  });

  const handleSort = (newSortBy: 'name' | 'average') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
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
          <Text style={styles.headerTitle}>Gradebook</Text>
          <Text style={styles.headerSubtitle}>{classInfo?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/grade-analytics?classId=${classId}`)}>
          <Ionicons name="analytics" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </FadeInView>

      {gradeData.length === 0 ? (
        <EmptyState
          icon="school"
          title="No Students Enrolled"
          description="Add students to this class to start tracking grades."
        />
      ) : (
        <ScrollView horizontal style={styles.horizontalScroll}>
          <View style={styles.gradeTable}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={[styles.studentNameHeader, styles.headerCell]}
                onPress={() => handleSort('name')}
              >
                <Text style={styles.headerText}>Student</Text>
                <Ionicons 
                  name={sortBy === 'name' ? (sortOrder === 'asc' ? 'chevron-up' : 'chevron-down') : 'swap-vertical'} 
                  size={16} 
                  color={Colors.text.secondary} 
                />
              </TouchableOpacity>
              
              {assignments.map(assignment => (
                <View key={assignment.id} style={[styles.assignmentHeader, styles.headerCell]}>
                  <Text style={styles.headerText} numberOfLines={2}>
                    {assignment.title}
                  </Text>
                  <Text style={styles.maxScoreText}>/{assignment.max_score}</Text>
                </View>
              ))}
              
              <TouchableOpacity
                style={[styles.averageHeader, styles.headerCell]}
                onPress={() => handleSort('average')}
              >
                <Text style={styles.headerText}>Average</Text>
                <Ionicons 
                  name={sortBy === 'average' ? (sortOrder === 'asc' ? 'chevron-up' : 'chevron-down') : 'swap-vertical'} 
                  size={16} 
                  color={Colors.text.secondary} 
                />
              </TouchableOpacity>
            </View>

            {/* Student Rows */}
            {sortedGradeData.map((studentData, index) => (
              <AnimatedCard key={studentData.student.id} style={styles.studentRow} delay={index * 50}>
                <TouchableOpacity
                  style={styles.studentNameCell}
                  onPress={() => router.push(`/student-details?studentId=${studentData.student.id}`)}
                >
                  <Text style={styles.studentName}>{studentData.student.name}</Text>
                  {studentData.student.grade_level && (
                    <Text style={styles.studentGrade}>Grade {studentData.student.grade_level}</Text>
                  )}
                </TouchableOpacity>

                {assignments.map(assignment => {
                  const submission = studentData.assignments[assignment.id];
                  return (
                    <TouchableOpacity
                      key={assignment.id}
                      style={styles.gradeCell}
                      onPress={() => {
                        if (submission) {
                          router.push(`/grade-submission?submissionId=${submission.id}`);
                        } else {
                          router.push(`/grade-assignment?assignmentId=${assignment.id}&studentId=${studentData.student.id}`);
                        }
                      }}
                    >
                      {submission ? (
                        submission.grade !== null ? (
                          <View style={styles.gradeContainer}>
                            <Text style={[styles.gradeText, { color: getGradeColor((submission.grade / assignment.max_score) * 100) }]}>
                              {submission.grade}
                            </Text>
                            <Text style={styles.gradePercentage}>
                              {Math.round((submission.grade / assignment.max_score) * 100)}%
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.submittedContainer}>
                            <Ionicons name="document" size={16} color={Colors.info} />
                            <Text style={styles.submittedText}>Submitted</Text>
                          </View>
                        )
                      ) : (
                        <View style={styles.noSubmissionContainer}>
                          <Text style={styles.noSubmissionText}>-</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.averageCell}>
                  <Text style={[styles.averageText, { color: getGradeColor(studentData.average) }]}>
                    {studentData.average}%
                  </Text>
                  <Text style={[styles.letterGrade, { color: getGradeColor(studentData.average) }]}>
                    {getGradeLetter(studentData.average)}
                  </Text>
                </View>
              </AnimatedCard>
            ))}
          </View>
        </ScrollView>
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
  horizontalScroll: {
    flex: 1,
  },
  gradeTable: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  headerCell: {
    padding: Spacing.md,
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
    marginRight: Spacing.sm,
  },
  studentNameHeader: {
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentHeader: {
    width: 100,
    alignItems: 'center',
  },
  averageHeader: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  maxScoreText: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  studentRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  studentNameCell: {
    width: 150,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentGrade: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  gradeCell: {
    width: 100,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  gradeContainer: {
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  gradePercentage: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  submittedContainer: {
    alignItems: 'center',
  },
  submittedText: {
    fontSize: 10,
    color: Colors.info,
    marginTop: 2,
  },
  noSubmissionContainer: {
    alignItems: 'center',
  },
  noSubmissionText: {
    fontSize: 16,
    color: Colors.text.tertiary,
  },
  averageCell: {
    width: 80,
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  averageText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  letterGrade: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
});