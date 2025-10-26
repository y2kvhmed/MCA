import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SchoolReports() {
  const router = useRouter();
  const { schoolId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      const targetSchoolId = schoolId || currentUser.school_id;
      if (!targetSchoolId) return;

      // Load school info
      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .eq('id', targetSchoolId)
        .single();
      
      if (schoolData) setSchool(schoolData);

      // Load school statistics
      const [
        { data: students },
        { data: teachers },
        { data: assignments },
        { data: materials }
      ] = await Promise.all([
        supabase.from('app_users').select('id').eq('school_id', targetSchoolId).eq('role', 'student'),
        supabase.from('app_users').select('id').eq('school_id', targetSchoolId).eq('role', 'teacher'),
        supabase.from('assignments').select('id').eq('school_id', targetSchoolId),
        supabase.from('study_materials').select('id').eq('school_id', targetSchoolId)
      ]);

      // Load submissions separately
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, grade')
        .in('assignment_id', assignments?.map(a => a.id) || []);

      const avgGrade = submissions?.length > 0 
        ? submissions.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.filter(s => s.grade !== null).length
        : 0;

      setStats({
        totalStudents: students?.length || 0,
        totalTeachers: teachers?.length || 0,
        totalAssignments: assignments?.length || 0,
        totalMaterials: materials?.length || 0,
        totalSubmissions: submissions?.length || 0,
        averageGrade: Math.round(avgGrade * 100) / 100,
      });

    } catch (error) {
      handleError(error, 'Failed to load school reports');
    } finally {
      setLoading(false);
    }
  };

  const exportStudentsReport = async () => {
    try {
      const targetSchoolId = schoolId || user?.school_id;
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('school_id', targetSchoolId)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csvData = data?.map(student => ({
        'Name': student.name,
        'Email': student.email,
        'Grade Level': student.grade_level || 'N/A',
        'Phone': student.phone || 'N/A',
        'Parent Phone': student.parent_phone || 'N/A',
        'Active': student.is_active ? 'Yes' : 'No',
        'Created Date': new Date(student.created_at).toLocaleDateString(),
      })) || [];

      await exportToCSV(csvData, `${school?.name || 'school'}-students-report`);
      showSuccess('Students report exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export students report');
    }
  };

  const exportAssignmentsReport = async () => {
    try {
      const targetSchoolId = schoolId || user?.school_id;
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          teacher:app_users!assignments_teacher_id_fkey(name),
          submissions(id, grade, submitted_at)
        `)
        .eq('school_id', targetSchoolId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csvData = data?.map(assignment => ({
        'Assignment Title': assignment.title,
        'Teacher': assignment.teacher?.name || 'Unknown',
        'Due Date': assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date',
        'Max Score': assignment.max_score || 'N/A',
        'Total Submissions': assignment.submissions?.length || 0,
        'Graded Submissions': assignment.submissions?.filter((s: any) => s.grade !== null).length || 0,
        'Average Grade': assignment.submissions?.length > 0 
          ? Math.round((assignment.submissions.filter((s: any) => s.grade !== null).reduce((sum: number, s: any) => sum + (s.grade || 0), 0) / assignment.submissions.filter((s: any) => s.grade !== null).length) * 100) / 100
          : 'N/A',
        'Created Date': new Date(assignment.created_at).toLocaleDateString(),
      })) || [];

      await exportToCSV(csvData, `${school?.name || 'school'}-assignments-report`);
      showSuccess('Assignments report exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export assignments report');
    }
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
        <Text style={styles.headerTitle}>School Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {school && (
          <Card style={styles.schoolCard}>
            <Text style={styles.schoolName}>{school.name}</Text>
            <Text style={styles.schoolAddress}>{school.address}</Text>
          </Card>
        )}

        {/* Statistics Overview */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>School Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={Colors.primary} />
              <Text style={styles.statValue}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="person" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{stats.totalTeachers}</Text>
              <Text style={styles.statLabel}>Teachers</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={24} color={Colors.warning} />
              <Text style={styles.statValue}>{stats.totalAssignments}</Text>
              <Text style={styles.statLabel}>Assignments</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="folder" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{stats.totalMaterials}</Text>
              <Text style={styles.statLabel}>Materials</Text>
            </View>
          </View>
        </Card>

        {/* Performance Overview */}
        <Card style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Total Submissions:</Text>
            <Text style={styles.performanceValue}>{stats.totalSubmissions}</Text>
          </View>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Average Grade:</Text>
            <Text style={[styles.performanceValue, { color: stats.averageGrade >= 70 ? Colors.success : Colors.warning }]}>
              {stats.averageGrade > 0 ? `${stats.averageGrade}%` : 'N/A'}
            </Text>
          </View>
        </Card>

        {/* Export Reports */}
        <Card style={styles.exportCard}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          
          <Button
            title="Export Students Report"
            onPress={exportStudentsReport}
            icon="people"
            variant="outline"
            style={styles.exportButton}
          />
          
          <Button
            title="Export Assignments Report"
            onPress={exportAssignmentsReport}
            icon="document-text"
            variant="outline"
            style={styles.exportButton}
          />
        </Card>
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
  schoolCard: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  schoolAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  performanceCard: {
    marginBottom: Spacing.lg,
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  performanceLabel: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  exportCard: {
    marginBottom: Spacing.xl,
  },
  exportButton: {
    marginBottom: Spacing.md,
  },
});