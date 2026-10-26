import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getTestById, saveBulkTestResults, getTestResultsByTestId, supabase } from '../lib/database';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RoleGuard from '../components/RoleGuard';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function EnterMarks() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const testId = params.testId as string;

  const [user, setUser] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { score: string; notes: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (testId) {
      loadData();
    }
  }, [testId]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      setUser(currentUser);

      // 1. Get Test Details
      const { data: testData, error: testError } = await getTestById(testId);
      if (testError) throw testError;
      setTest(testData);

      // 2. Get Students in the school
      const { data: studentsData, error: studentsError } = await supabase
        .from('app_users')
        .select('*')
        .eq('school_id', testData.school_id)
        .eq('role', 'student')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // 3. Get Existing Results
      const { data: existingResults } = await getTestResultsByTestId(testId);
      const marksMap: Record<string, { score: string; notes: string }> = {};
      
      // Initialize marks for all students
      studentsData?.forEach(s => {
        marksMap[s.id] = { score: '', notes: '' };
      });

      // Fill in existing marks
      existingResults?.forEach(r => {
        marksMap[r.student_id] = {
          score: r.score.toString(),
          notes: r.notes || '',
        };
      });

      setMarks(marksMap);
    } catch (error) {
      handleError(error, 'Failed to load test data');
    } finally {
      setLoading(false);
    }
  };

  const updateMark = (studentId: string, field: 'score' | 'notes', value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const handleSave = async () => {
    const resultsToSave = Object.entries(marks)
      .filter(([_, data]) => data.score.trim() !== '')
      .map(([studentId, data]) => {
        const scoreNum = parseFloat(data.score);
        return {
          test_id: testId,
          student_id: studentId,
          teacher_id: user.id,
          school_id: test.school_id,
          title: test.title,
          test_date: test.test_date,
          score: isNaN(scoreNum) ? 0 : scoreNum,
          max_score: test.max_score,
          notes: data.notes.trim() || null,
        };
      });

    if (resultsToSave.length === 0) {
      Alert.alert('No Marks', 'Please enter at least one score before saving.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await saveBulkTestResults(resultsToSave);
      if (error) throw error;

      // Alert button callbacks are not supported on web, so navigate back directly.
      router.back();
    } catch (error) {
      handleError(error, 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(s => (s.name || '').toLowerCase().includes(term));
  }, [students, search]);

  if (loading) return <LoadingSpinner />;

  return (
    <RoleGuard allowedRoles={['teacher', 'admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{test?.title}</Text>
            <Text style={styles.headerSub}>Enter Student Marks</Text>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color={Colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <ScrollView style={styles.content}>
          {filteredStudents.length === 0 ? (
            <EmptyState
              icon="people"
              title="No Students"
              description="No students found for this test."
            />
          ) : (
            filteredStudents.map((student) => (
              <Card key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <View style={styles.scoreInputWrapper}>
                    <TextInput
                      style={styles.scoreInput}
                      placeholder="Score"
                      keyboardType="numeric"
                      value={marks[student.id]?.score || ''}
                      onChangeText={(val) => updateMark(student.id, 'score', val)}
                    />
                    <Text style={styles.maxScore}>/ {test?.max_score}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Notes/Feedback (Optional)"
                  value={marks[student.id]?.notes || ''}
                  onChangeText={(val) => updateMark(student.id, 'notes', val)}
                  multiline
                />
              </Card>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={saving ? 'Saving...' : 'Save All Marks'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
      </SafeAreaView>
    </RoleGuard>
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
    marginHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  searchContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  studentCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  scoreInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  maxScore: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  notesInput: {
    fontSize: 13,
    color: Colors.text.secondary,
    backgroundColor: Colors.background,
    borderRadius: 6,
    padding: 8,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
});
