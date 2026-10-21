import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getTeacherSchools, getSchools, getStudentSubmissions } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentsList() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.back();
        return;
      }
      setUser(currentUser);

      // Load schools
      let accessibleSchools: any[] = [];
      if (currentUser.role === 'admin') {
        const { data: allSchools } = await getSchools();
        accessibleSchools = allSchools || [];
      } else {
        const { data: teacherSchools } = await getTeacherSchools(currentUser.id);
        accessibleSchools = teacherSchools || [];
        if (accessibleSchools.length === 0 && currentUser.school_id) {
          const { data: directSchool } = await supabase.from('schools').select('*').eq('id', currentUser.school_id).single();
          if (directSchool) accessibleSchools = [directSchool];
        }
      }
      setSchools(accessibleSchools);

      // Query students
      let query = supabase
        .from('app_users')
        .select('*, school:schools(id, name)')
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (currentUser.role !== 'admin') {
        const schoolIds = accessibleSchools.map(s => s.id);
        if (currentUser.school_id && !schoolIds.includes(currentUser.school_id)) {
          schoolIds.push(currentUser.school_id);
        }
        if (schoolIds.length > 0) {
          query = query.in('school_id', schoolIds);
        }
      }

      const { data: usersData, error } = await query;
      if (error) throw error;

      if (usersData) {
        // Get submission data for each student
        const studentsWithSubmissions = await Promise.all(
          usersData.map(async (student: any) => {
            const { data: submissions } = await getStudentSubmissions(student.id);
            return {
              ...student,
              totalSubmissions: submissions?.length || 0,
              lastSubmission: submissions?.[0] || null,
            };
          })
        );
        setStudents(studentsWithSubmissions);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const exportStudentsCSV = async () => {
    try {
      const csvData = filteredStudents.map(student => ({
        'Student Name': student.name,
        'School': student.school?.name || 'Unassigned',
        'Email': student.email || 'No email',
        'Phone': student.phone || 'No phone',
        'Total Submissions': student.totalSubmissions,
        'Last Submission': student.lastSubmission 
          ? `${student.lastSubmission.assignment?.title || 'Assignment'} - ${new Date(student.lastSubmission.submitted_at).toLocaleDateString()}`
          : 'No submissions',
        'Status': student.is_active ? 'Active' : 'Inactive',
        'Joined': student.created_at ? new Date(student.created_at).toLocaleDateString() : 'Unknown',
      }));

      await exportToCSV(csvData, 'students-list');
      showSuccess('Students list exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export CSV');
    }
  };

  const viewStudentDetails = (student: any) => {
    router.push(`/student-details?studentId=${student.id}`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const filteredStudents = selectedSchoolFilter && selectedSchoolFilter !== 'all'
    ? students.filter(s => s.school_id === selectedSchoolFilter)
    : students;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Students ({filteredStudents.length})</Text>
        <TouchableOpacity onPress={exportStudentsCSV}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* School Category Filter Pills */}
      {schools.length > 1 && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterPill, (!selectedSchoolFilter || selectedSchoolFilter === 'all') && styles.filterPillActive]}
              onPress={() => setSelectedSchoolFilter('all')}
            >
              <Text style={[styles.filterPillText, (!selectedSchoolFilter || selectedSchoolFilter === 'all') && styles.filterPillTextActive]}>
                All Schools ({students.length})
              </Text>
            </TouchableOpacity>
            {schools.map((sc) => {
              const count = students.filter(s => s.school_id === sc.id).length;
              return (
                <TouchableOpacity
                  key={sc.id}
                  style={[styles.filterPill, selectedSchoolFilter === sc.id && styles.filterPillActive]}
                  onPress={() => setSelectedSchoolFilter(sc.id)}
                >
                  <Text style={[styles.filterPillText, selectedSchoolFilter === sc.id && styles.filterPillTextActive]}>
                    {sc.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={7}
        ListEmptyComponent={
          <EmptyState
            icon="people"
            title="No Students Found"
            description={selectedSchoolFilter !== 'all' ? "No students in this school." : "No students found."}
          />
        }
        renderItem={({ item: student }) => (
          <Card style={styles.studentCard}>
            <TouchableOpacity
              style={styles.studentButton}
              onPress={() => viewStudentDetails(student)}
            >
              <View style={styles.studentIcon}>
                {student.avatar_url ? (
                  <Image source={{ uri: student.avatar_url }} style={styles.studentPfpImage} />
                ) : (
                  <Ionicons name="person" size={24} color={Colors.text.inverse} />
                )}
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentEmail}>{student.email || 'No email'}</Text>
                {student.school?.name && (
                  <Text style={styles.studentSchoolName}>{student.school.name}</Text>
                )}
                <View style={styles.studentMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="document-text" size={14} color={Colors.text.secondary} />
                    <Text style={styles.metaText}>
                      {student.totalSubmissions} submissions
                    </Text>
                  </View>
                  {student.lastSubmission && (
                    <View style={styles.metaItem}>
                      <Ionicons name="time" size={14} color={Colors.text.secondary} />
                      <Text style={styles.metaText}>
                        Last: {new Date(student.lastSubmission.submitted_at).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.studentStatus}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: student.is_active ? Colors.success : Colors.error }
                ]}>
                  <Text style={styles.statusText}>
                    {student.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </Card>
        )}
      />
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
  studentCard: {
    marginBottom: Spacing.md,
  },
  studentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  studentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  studentEmail: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  studentMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  studentStatus: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  statusText: {
    fontSize: 10,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  studentPfpImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentSchoolName: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  filterBar: {
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    paddingVertical: Spacing.xs,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});