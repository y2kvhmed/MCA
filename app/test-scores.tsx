import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getTeacherSchools } from '../lib/database';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RoleGuard from '../components/RoleGuard';
import StudentPerformanceAnalytics from '../components/StudentPerformanceAnalytics';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function TestScores() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      setUser(currentUser);

      let query = supabase
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
          query = query.in('school_id', schoolIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      handleError(error, 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term)
    );
  }, [students, search]);

  if (loading) {
    return <LoadingSpinner />;
  }

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
          <View style={{ width: 24 }} />
        </View>

        {selectedStudent ? (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
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
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <StudentPerformanceAnalytics
              student={selectedStudent}
              isTeacherOrAdmin={true}
              onRefreshParent={loadStudents}
            />
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={18} color={Colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students..."
                placeholderTextColor={Colors.text.tertiary}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {filteredStudents.length === 0 ? (
              <EmptyState
                icon="people"
                title="No Students Found"
                description={
                  students.length === 0
                    ? 'There are no students in your school yet.'
                    : 'No student matches your search.'
                }
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
          </ScrollView>
        )}
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
    minHeight: 44,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    paddingVertical: 10,
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
