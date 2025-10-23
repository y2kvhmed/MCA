import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatRelativeDate, handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface GradeData {
  id: string;
  grade: number;
  percentage: number;
  feedback: string | null;
  graded_at: string;
  assignment: {
    id: string;
    title: string;
    max_score: number;
    class: {
      id: string;
      name: string;
    };
  };
}

export default function StudentGrades() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    gradedAssignments: 0,
    averageGrade: 0,
    averagePercentage: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load student's graded submissions
      const { data: gradesData, error } = await supabase
        .from('submissions')
        .select(`
          id,
          grade,
          percentage,
          feedback,
          graded_at,
          assignment:assignments(
            id,
            title,
            max_score,
            class:classes(id, name)
          )
        `)
        .eq('student_id', currentUser.id)
        .eq('status', 'graded')
        .order('graded_at', { ascending: false });

      if (error) throw error;

      setGrades(gradesData || []);

      // Calculate statistics
      if (gradesData && gradesData.length > 0) {
        const totalGrades = gradesData.reduce((sum, g) => sum + g.grade, 0);
        const totalPercentages = gradesData.reduce((sum, g) => sum + g.percentage, 0);
        
        setStats({
          totalAssignments: gradesData.length,
          gradedAssignments: gradesData.length,
          averageGrade: totalGrades / gradesData.length,
          averagePercentage: totalPercentages / gradesData.length,
        });
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load grades');
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Grades</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Statistics Card */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Grade Summary</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.gradedAssignments}</Text>
              <Text style={styles.statLabel}>Graded</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getGradeColor(stats.averagePercentage) }]}>
                {stats.averagePercentage.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getGradeColor(stats.averagePercentage) }]}>
                {getGradeLetter(stats.averagePercentage)}
              </Text>
              <Text style={styles.statLabel}>Grade</Text>
            </View>
          </View>

          {stats.averagePercentage > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(stats.averagePercentage, 100)}%`,
                      backgroundColor: getGradeColor(stats.averagePercentage)
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </Card>

        {/* Grades List */}
        {grades.length === 0 ? (
          <EmptyState
            icon="school"
            title="No Grades Yet"
            description="Your graded assignments will appear here once teachers have reviewed your submissions."
          />
        ) : (
          <View style={styles.gradesContainer}>
            <Text style={styles.gradesTitle}>Recent Grades</Text>
            
            {grades.map((grade) => (
              <Card key={grade.id} style={styles.gradeCard}>
                <View style={styles.gradeHeader}>
                  <View style={styles.gradeInfo}>
                    <Text style={styles.assignmentTitle}>{grade.assignment.title}</Text>
                    <Text style={styles.className}>{grade.assignment.class.name}</Text>
                  </View>
                  
                  <View style={styles.gradeScore}>
                    <Text style={[styles.gradeValue, { color: getGradeColor(grade.percentage) }]}>
                      {grade.grade}/{grade.assignment.max_score}
                    </Text>
                    <Text style={[styles.gradePercentage, { color: getGradeColor(grade.percentage) }]}>
                      {grade.percentage}%
                    </Text>
                    <Text style={[styles.gradeLetter, { color: getGradeColor(grade.percentage) }]}>
                      {getGradeLetter(grade.percentage)}
                    </Text>
                  </View>
                </View>

                <View style={styles.gradeDetails}>
                  <View style={styles.gradeDetailRow}>
                    <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                    <Text style={styles.gradeDate}>
                      Graded {formatRelativeDate(grade.graded_at)}
                    </Text>
                  </View>

                  {grade.feedback && (
                    <View style={styles.feedbackContainer}>
                      <View style={styles.feedbackHeader}>
                        <Ionicons name="chatbubble" size={14} color={Colors.text.secondary} />
                        <Text style={styles.feedbackTitle}>Teacher Feedback:</Text>
                      </View>
                      <Text style={styles.feedbackText}>{grade.feedback}</Text>
                    </View>
                  )}
                </View>

                {/* Grade Breakdown Bar */}
                <View style={styles.gradeBreakdown}>
                  <View style={styles.gradeBar}>
                    <View 
                      style={[
                        styles.gradeBarFill, 
                        { 
                          width: `${grade.percentage}%`,
                          backgroundColor: getGradeColor(grade.percentage)
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.gradeBarLabel}>{grade.percentage}% of total points</Text>
                </View>
              </Card>
            ))}
          </View>
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
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  gradesContainer: {
    flex: 1,
  },
  gradesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  gradeCard: {
    marginBottom: Spacing.lg,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  gradeInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  className: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  gradeScore: {
    alignItems: 'flex-end',
  },
  gradeValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gradePercentage: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  gradeLetter: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  gradeDetails: {
    marginBottom: Spacing.md,
  },
  gradeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gradeDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  feedbackContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  gradeBreakdown: {
    marginTop: Spacing.sm,
  },
  gradeBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  gradeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  gradeBarLabel: {
    fontSize: 11,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});