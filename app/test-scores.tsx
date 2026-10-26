import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getTeacherSchools, getTestsByTeacherSchools, deleteTest } from '../lib/database';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RoleGuard from '../components/RoleGuard';
import StudentPerformanceAnalytics from '../components/StudentPerformanceAnalytics';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

type TabType = 'students' | 'tests';

export default function TestScores() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('tests');
  const [user, setUser] = useState<any>(null);
  
  // Students Tab State
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState('');
  
  // Tests Tab State
  const [tests, setTests] = useState<any[]>([]);
  const [testSearch, setTestSearch] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reload on focus so newly created tests (and their marks) appear immediately
  // when returning from the marks screen.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      setUser(currentUser);

      // Load Students
      let studentQuery = supabase
        .from('app_users')
        .select('*, school:schools(id, name)')
        .eq('role', 'student')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (currentUser.role !== 'admin') {
        const { data: teacherSchools } = await getTeacherSchools(currentUser.id);
        const schoolIds = (teacherSchools || []).map((s: any) => s.id);
        if (currentUser.school_id && !schoolIds.includes(currentUser.school_id)) {
          schoolIds.push(currentUser.school_id);
        }
        if (schoolIds.length > 0) {
          studentQuery = studentQuery.in('school_id', schoolIds);
        }
      }
      const { data: studentsData } = await studentQuery;
      setStudents(studentsData || []);

      // Load Tests
      const { data: testsData } = await getTestsByTeacherSchools(currentUser.id);
      setTests(testsData || []);

    } catch (error) {
      handleError(error, 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteTest = async (test: any) => {
    const message = `Delete "${test.title}"? All student marks for this test will be permanently removed.`;

    // Alert button callbacks are ignored on web, so a native Alert can never confirm.
    let confirmed = false;
    if (typeof window !== 'undefined') {
      confirmed = window.confirm(message);
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete Test',
          message,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ],
          { onDismiss: () => resolve(false) }
        );
      });
    }

    if (!confirmed) return;

    try {
      const { error } = await deleteTest(test.id);
      if (error) throw new Error(error);
      setTests(prev => prev.filter(t => t.id !== test.id));
    } catch (error) {
      handleError(error, 'Failed to delete test');
    }
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter(s => (s.name || '').toLowerCase().includes(term));
  }, [students, studentSearch]);

  const filteredTests = useMemo(() => {
    const term = testSearch.trim().toLowerCase();
    if (!term) return tests;
    return tests.filter(t => (t.title || '').toLowerCase().includes(term));
  }, [tests, testSearch]);

  if (loading) return <LoadingSpinner />;

  return (
    <RoleGuard allowedRoles={['teacher', 'admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (selectedStudent ? setSelectedStudent(null) : router.back())}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test Scores</Text>
          {activeTab === 'tests' && !selectedStudent ? (
            <TouchableOpacity onPress={() => router.push('/create-test')}>
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        {!selectedStudent && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'tests' && styles.activeTab]}
              onPress={() => setActiveTab('tests')}
            >
              <Text style={[styles.tabText, activeTab === 'tests' && styles.activeTabText]}>
                Manage Tests
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'students' && styles.activeTab]}
              onPress={() => setActiveTab('students')}
            >
              <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
                By Student
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {selectedStudent ? (
            <View>
              <Card style={styles.selectedCard}>
                <View style={styles.selectedRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={20} color={Colors.text.inverse} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{selectedStudent.name}</Text>
                    <Text style={styles.selectedSub}>
                      {selectedStudent.school?.name || selectedStudent.email || 'Student'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                    <Text style={styles.changeText}>Back to List</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              <StudentPerformanceAnalytics
                student={selectedStudent}
                isTeacherOrAdmin={true}
                onRefreshParent={loadData}
              />
            </View>
          ) : activeTab === 'tests' ? (
            <View>
              <View style={styles.searchWrapper}>
                <Ionicons name="search" size={18} color={Colors.text.secondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tests..."
                  value={testSearch}
                  onChangeText={setTestSearch}
                />
              </View>

              {filteredTests.length === 0 ? (
                <EmptyState
                  icon="trophy"
                  title="No Tests Created"
                  description="Create a test to start entering marks for students."
                  action={{ label: 'Create Test', onPress: () => router.push('/create-test') }}
                />
              ) : (
                filteredTests.map((test) => (
                  <Card key={test.id} style={styles.testCard}>
                    <View style={styles.testRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.testTitle}>{test.title}</Text>
                        <Text style={styles.testSub}>
                          {new Date(test.test_date).toLocaleDateString()} • Max: {test.max_score}
                        </Text>
                      </View>
                      <View style={styles.testActions}>
                        <TouchableOpacity
                          style={styles.enterMarksBtn}
                          onPress={() => router.push(`/enter-marks?testId=${test.id}`)}
                        >
                          <Ionicons name="create" size={16} color={Colors.text.inverse} />
                          <Text style={styles.enterMarksText}>Marks</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleDeleteTest(test)}
                        >
                          <Ionicons name="trash" size={22} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : (
            <View>
              <View style={styles.searchWrapper}>
                <Ionicons name="search" size={18} color={Colors.text.secondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search students..."
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                />
              </View>

              {filteredStudents.length === 0 ? (
                <EmptyState
                  icon="people"
                  title="No Students Found"
                  description="No students match your search criteria."
                />
              ) : (
                <Card style={styles.listCard}>
                  {filteredStudents.map((student) => (
                    <TouchableOpacity
                      key={student.id}
                      style={styles.studentRow}
                      onPress={() => setSelectedStudent(student)}
                    >
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color={Colors.text.inverse} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentSub}>
                          {student.school?.name || student.email || 'Student'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                  ))}
                </Card>
              )}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card.background,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  testCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  testSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  testActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  enterMarksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enterMarksText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  actionBtn: {
    padding: 4,
  },
  listCard: {
    marginBottom: Spacing.lg,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  selectedCard: {
    marginBottom: Spacing.lg,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  selectedSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
