import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatDate, handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface Student {
  id: string;
  name: string;
  email: string;
  status?: 'present' | 'absent' | 'late';
}

export default function Attendance() {
  const router = useRouter();
  const { classId, date } = useLocalSearchParams();
  const [classInfo, setClassInfo] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(date ? new Date(date as string) : new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      // Load class info
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classError) throw classError;
      setClassInfo(classData);

      // Load enrolled students
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          student:app_users!enrollments_student_id_fkey(id, name, email)
        `)
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (enrollmentError) throw enrollmentError;

      const studentList = enrollmentData.map(e => e.student);

      // Load existing attendance for this date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .eq('date', formatDate(attendanceDate));

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      // Merge students with their attendance status
      const studentsWithAttendance = studentList.map(student => {
        const attendance = attendanceData?.find(a => a.student_id === student.id);
        return {
          ...student,
          status: attendance?.status || 'present'
        };
      });

      setStudents(studentsWithAttendance);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const updateStudentStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setStudents(prev => prev.map(student => 
      student.id === studentId ? { ...student, status } : student
    ));
  };

  const handleSaveAttendance = async () => {
    if (!user || !classInfo) return;

    setSaving(true);
    try {
      const dateStr = formatDate(attendanceDate);

      // Delete existing attendance for this date
      await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId)
        .eq('date', dateStr);

      // Insert new attendance records
      const attendanceRecords = students.map(student => ({
        class_id: classId,
        student_id: student.id,
        date: dateStr,
        status: student.status,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('attendance')
        .insert(attendanceRecords);

      if (error) throw error;

      showSuccess('Attendance saved successfully!');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return Colors.success;
      case 'absent': return Colors.error;
      case 'late': return Colors.warning;
      default: return Colors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return 'checkmark-circle';
      case 'absent': return 'close-circle';
      case 'late': return 'time';
      default: return 'help-circle';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Class Info Card */}
        <Card style={styles.classCard}>
          <Text style={styles.className}>{classInfo?.name}</Text>
          <Text style={styles.attendanceDate}>{formatDate(attendanceDate)}</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={[styles.summaryText, { color: Colors.success }]}>
                Present: {presentCount}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={20} color={Colors.error} />
              <Text style={[styles.summaryText, { color: Colors.error }]}>
                Absent: {absentCount}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="time" size={20} color={Colors.warning} />
              <Text style={[styles.summaryText, { color: Colors.warning }]}>
                Late: {lateCount}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.quickActionsCard}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: Colors.success + '20' }]}
              onPress={() => setStudents(prev => prev.map(s => ({ ...s, status: 'present' })))}
            >
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={[styles.quickActionText, { color: Colors.success }]}>Mark All Present</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: Colors.error + '20' }]}
              onPress={() => setStudents(prev => prev.map(s => ({ ...s, status: 'absent' })))}
            >
              <Ionicons name="close-circle" size={20} color={Colors.error} />
              <Text style={[styles.quickActionText, { color: Colors.error }]}>Mark All Absent</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Students List */}
        <Card style={styles.studentsCard}>
          <Text style={styles.studentsTitle}>Students ({students.length})</Text>
          
          {students.map((student, index) => (
            <View key={student.id} style={[styles.studentRow, index > 0 && styles.studentRowBorder]}>
              <View style={styles.studentInfo}>
                <View style={styles.studentAvatar}>
                  <Ionicons name="person" size={20} color={Colors.text.inverse} />
                </View>
                <View style={styles.studentDetails}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentEmail}>{student.email}</Text>
                </View>
              </View>
              
              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    student.status === 'present' && styles.statusButtonActive,
                    { backgroundColor: student.status === 'present' ? Colors.success + '20' : 'transparent' }
                  ]}
                  onPress={() => updateStudentStatus(student.id, 'present')}
                >
                  <Ionicons 
                    name="checkmark-circle" 
                    size={24} 
                    color={student.status === 'present' ? Colors.success : Colors.text.tertiary} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    student.status === 'late' && styles.statusButtonActive,
                    { backgroundColor: student.status === 'late' ? Colors.warning + '20' : 'transparent' }
                  ]}
                  onPress={() => updateStudentStatus(student.id, 'late')}
                >
                  <Ionicons 
                    name="time" 
                    size={24} 
                    color={student.status === 'late' ? Colors.warning : Colors.text.tertiary} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    student.status === 'absent' && styles.statusButtonActive,
                    { backgroundColor: student.status === 'absent' ? Colors.error + '20' : 'transparent' }
                  ]}
                  onPress={() => updateStudentStatus(student.id, 'absent')}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={24} 
                    color={student.status === 'absent' ? Colors.error : Colors.text.tertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>

        <Button
          title="Save Attendance"
          onPress={handleSaveAttendance}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />
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
  classCard: {
    marginBottom: Spacing.lg,
  },
  className: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  attendanceDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  quickActionsCard: {
    marginBottom: Spacing.lg,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  studentsCard: {
    marginBottom: Spacing.lg,
  },
  studentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  studentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  studentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
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
  },
  studentEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusButton: {
    padding: Spacing.sm,
    borderRadius: 8,
  },
  statusButtonActive: {
    // Active styles handled by backgroundColor in component
  },
  saveButton: {
    marginBottom: Spacing.xl,
  },
});