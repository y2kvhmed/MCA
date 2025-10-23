import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getUsersBySchool, getStudentSubmissions } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentsList() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || !currentUser.school_id) {
        Alert.alert('Error', 'No school assigned to your account');
        router.back();
        return;
      }
      
      setUser(currentUser);

      // Load students from the teacher's school
      const { data: usersData } = await getUsersBySchool(currentUser.school_id);
      if (usersData) {
        const studentsOnly = usersData.filter((u: any) => u.role === 'student');
        
        // Get submission data for each student
        const studentsWithSubmissions = await Promise.all(
          studentsOnly.map(async (student: any) => {
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
      const csvData = students.map(student => ({
        'Student Name': student.name,
        'Email': student.email || 'No email',
        'Phone': student.phone || 'No phone',
        'Total Submissions': student.totalSubmissions,
        'Last Submission': student.lastSubmission 
          ? `${student.lastSubmission.assignment?.title} - ${new Date(student.lastSubmission.submitted_at).toLocaleDateString()}`
          : 'No submissions',
        'Status': student.is_active ? 'Active' : 'Inactive',
        'Joined': new Date(student.created_at).toLocaleDateString(),
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Students ({students.length})</Text>
        <TouchableOpacity onPress={exportStudentsCSV}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {students.length === 0 ? (
          <EmptyState
            icon="people"
            title="No Students Found"
            description="No students are enrolled in your school yet."
          />
        ) : (
          students.map((student) => (
            <Card key={student.id} style={styles.studentCard}>
              <TouchableOpacity
                style={styles.studentButton}
                onPress={() => viewStudentDetails(student)}
              >
                <View style={styles.studentIcon}>
                  <Ionicons name="person" size={24} color={Colors.text.inverse} />
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentEmail}>{student.email || 'No email'}</Text>
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
          ))
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
});