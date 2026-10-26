import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getStudentTestResults } from '../lib/database';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface TestResult {
  id: string;
  title: string;
  test_date: string;
  score: number;
  max_score: number;
  percentage: number;
  notes?: string | null;
}

const gradeColor = (pct: number) => {
  if (pct >= 80) return Colors.success;
  if (pct >= 60) return Colors.warning;
  return Colors.error;
};

export default function StudentGrades() {
  const router = useRouter();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }

      const { data } = await getStudentTestResults(currentUser.id);

      const rows: TestResult[] = (data || []).map((t: any) => {
        const max = Number(t.max_score) > 0 ? Number(t.max_score) : 100;
        const score = Number(t.score) || 0;
        const pct =
          t.percentage !== null && t.percentage !== undefined
            ? Number(t.percentage)
            : max > 0
            ? (score / max) * 100
            : 0;
        return {
          id: t.id,
          title: t.title,
          test_date: t.test_date,
          score,
          max_score: max,
          percentage: Math.round(pct),
          notes: t.notes,
        };
      });

      // Newest first
      rows.sort((a, b) => {
        const da = a.test_date ? new Date(a.test_date).getTime() : 0;
        const db = b.test_date ? new Date(b.test_date).getTime() : 0;
        return db - da;
      });

      setTests(rows);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load test grades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatTestDate = (value?: string | null) => {
    if (!value) return '';
    // Date-only strings are parsed as local time to avoid off-by-one day.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const testCount = tests.length;
  const avgGrade = testCount > 0
    ? Math.round(tests.reduce((sum, t) => sum + t.percentage, 0) / testCount)
    : 0;
  const bestGrade = testCount > 0 ? Math.max(...tests.map(t => t.percentage)) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test Grades</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Card */}
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Grade Summary</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{testCount}</Text>
              <Text style={styles.statLabel}>Tests Taken</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: gradeColor(bestGrade) }]}>
                {bestGrade}%
              </Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          </View>

          <View style={styles.percentageContainer}>
            <Text style={styles.percentageLabel}>Average Grade</Text>
            <Text style={[styles.percentageValue, { color: gradeColor(avgGrade) }]}>
              {avgGrade}%
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(avgGrade, 100)}%`, backgroundColor: gradeColor(avgGrade) },
                ]}
              />
            </View>
          </View>
        </Card>

        {/* Test Results List */}
        {tests.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="No Test Grades Yet"
            description="Your test scores will appear here once your teachers add them."
          />
        ) : (
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Test Results</Text>

            {tests.map((test) => (
              <Card key={test.id} style={styles.testCard}>
                <View style={styles.testHeader}>
                  <View style={styles.testInfo}>
                    <Text style={styles.testTitle}>{test.title}</Text>
                    <View style={styles.testMeta}>
                      <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                      <Text style={styles.testDate}>{formatTestDate(test.test_date)}</Text>
                    </View>
                    <View style={styles.scoreRow}>
                      <Ionicons name="ribbon" size={15} color={gradeColor(test.percentage)} />
                      <Text style={styles.scoreText}>
                        Score: {test.score} / {test.max_score}
                      </Text>
                    </View>

                    {test.notes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>Teacher Note:</Text>
                        <Text style={styles.notesContent}>{test.notes}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.gradeBadge}>
                    <Text style={[styles.gradeBadgeValue, { color: gradeColor(test.percentage) }]}>
                      {test.percentage}%
                    </Text>
                    <Text style={styles.gradeBadgeLabel}>Grade</Text>
                  </View>
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
  percentageContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  percentageLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  percentageValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: Colors.border.light,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  listContainer: {
    flex: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  testCard: {
    marginBottom: Spacing.md,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  testInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  testMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  testDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  scoreText: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  gradeBadge: {
    alignItems: 'center',
  },
  gradeBadgeValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gradeBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  notesBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  notesContent: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
});
