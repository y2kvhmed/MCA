import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import { hapticFeedback } from '../lib/haptics';
import AnimatedCard from '../components/AnimatedCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export const ATTENDANCE_STATUS = [
  { value: 'present', label: 'Present', fullLabel: 'Present', icon: 'checkmark-circle', color: Colors.success },
  { value: 'absent', label: 'Absent', fullLabel: 'Absent', icon: 'close-circle', color: Colors.error },
  { value: 'excused', label: 'Excused', fullLabel: 'Absent with Excuse', icon: 'document-text', color: Colors.warning },
  { value: 'late', label: 'Late', fullLabel: 'Late', icon: 'time', color: '#8B5CF6' },
];

export const getStatusMeta = (val: string) => {
  if (val === 'present') return { label: 'Present', color: Colors.success, icon: 'checkmark-circle' };
  if (val === 'absent') return { label: 'Absent', color: Colors.error, icon: 'close-circle' };
  if (val === 'excused' || val === 'kicked') return { label: 'Absent with Excuse', color: Colors.warning, icon: 'document-text' };
  if (val === 'late' || val === 'punished') return { label: 'Late', color: '#8B5CF6', icon: 'time' };
  return { label: val || 'Present', color: Colors.success, icon: 'checkmark-circle' };
};

export default function Attendance() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [attendanceSheets, setAttendanceSheets] = useState<any[]>([]);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Viewer state
  const [viewingSheet, setViewingSheet] = useState<any>(null);
  const [viewingRecords, setViewingRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSheet, setEditingSheet] = useState<any>(null);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Map<string, { status: string; note: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'admin')) {
        router.replace('/');
        return;
      }
      setUser(currentUser);

      // Load schools
      let schoolsList: any[] = [];
      if (currentUser.role === 'admin') {
        const { data } = await supabase.from('schools').select('id, name');
        schoolsList = data || [];
      } else {
        const { data: teacherSchools } = await supabase
          .from('teacher_schools')
          .select('school_id, schools(id, name)')
          .eq('teacher_id', currentUser.id);

        if (teacherSchools && teacherSchools.length > 0) {
          schoolsList = teacherSchools.map((ts: any) => ts.schools).filter(Boolean);
        } else if (currentUser.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('id, name')
            .eq('id', currentUser.school_id)
            .single();
          if (schoolData) schoolsList = [schoolData];
        }
      }

      setSchools(schoolsList);
      if (schoolsList.length > 0 && !selectedSchool) {
        setSelectedSchool(schoolsList[0].id);
      }

      await loadAttendanceSheets(currentUser.id, currentUser.role);
    } catch (error) {
      handleError(error, 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAttendanceSheets = async (userId: string, role: string) => {
    try {
      let query = supabase
        .from('attendance_sheets')
        .select(`
          *,
          school:schools(id, name)
        `)
        .order('date', { ascending: false });

      if (role !== 'admin') {
        query = query.eq('teacher_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.log('Attendance sheets query error:', error.message);
        setAttendanceSheets([]);
      } else {
        setAttendanceSheets(data || []);
      }
    } catch (err) {
      console.log('Could not load attendance sheets:', err);
      setAttendanceSheets([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openEditor = async (sheet?: any) => {
    hapticFeedback.light();
    if (sheet) {
      setEditingSheet(sheet);
      setSelectedSchool(sheet.school_id);
      setSelectedDate(sheet.date);
      await loadSheetAttendance(sheet.id);
      await loadStudents(sheet.school_id);
    } else {
      setEditingSheet(null);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setAttendance(new Map());
      const targetSchool = selectedSchool || (schools[0]?.id || '');
      if (targetSchool) {
        setSelectedSchool(targetSchool);
        await loadStudents(targetSchool);
      }
    }
    setShowEditor(true);
  };

  const loadStudents = async (schoolId: string) => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, email')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .eq('is_active', true)
      .order('name');

    if (!error) {
      setStudents(data || []);
      // Prepopulate unassigned with present
      setAttendance(prev => {
        const next = new Map(prev);
        data?.forEach((s: any) => {
          if (!next.has(s.id)) {
            next.set(s.id, { status: 'present', note: '' });
          }
        });
        return next;
      });
    }
  };

  const loadSheetAttendance = async (sheetId: string) => {
    const { data } = await supabase
      .from('attendance_records')
      .select('student_id, status, note')
      .eq('sheet_id', sheetId);

    const map = new Map();
    data?.forEach((r: any) => {
      // normalize old kicked/punished to excused/late
      let st = r.status;
      if (st === 'kicked') st = 'excused';
      if (st === 'punished') st = 'late';
      map.set(r.student_id, { status: st, note: r.note || '' });
    });
    setAttendance(map);
  };

  const closeEditor = () => {
    hapticFeedback.light();
    setShowEditor(false);
    setEditingSheet(null);
    setAttendance(new Map());
  };

  const markAttendance = (studentId: string, status: string) => {
    hapticFeedback.selection();
    const current = attendance.get(studentId) || { status: 'present', note: '' };
    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, { ...current, status });
    setAttendance(newAttendance);
  };

  const setStudentNote = (studentId: string, note: string) => {
    const current = attendance.get(studentId) || { status: 'present', note: '' };
    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, { ...current, note });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!selectedSchool || !selectedDate) {
      Alert.alert('Error', 'Please select a school and date');
      return;
    }

    setSaving(true);
    try {
      hapticFeedback.medium();
      let sheetId = editingSheet?.id;

      if (!sheetId) {
        const { data: newSheet, error: sheetError } = await supabase
          .from('attendance_sheets')
          .insert({
            teacher_id: user.id,
            school_id: selectedSchool,
            date: selectedDate,
          })
          .select()
          .single();

        if (sheetError) throw sheetError;
        sheetId = newSheet.id;
      }

      await supabase.from('attendance_records').delete().eq('sheet_id', sheetId);

      const records = Array.from(attendance.entries()).map(([studentId, data]) => ({
        sheet_id: sheetId,
        student_id: studentId,
        status: data.status || 'present',
        note: data.note || null,
      }));

      if (records.length > 0) {
        const { error: recordsError } = await supabase
          .from('attendance_records')
          .insert(records);

        if (recordsError) throw recordsError;
      }

      hapticFeedback.success();
      showSuccess('Attendance saved successfully!');
      closeEditor();
      if (user) {
        await loadAttendanceSheets(user.id, user.role);
      }
    } catch (error) {
      hapticFeedback.error();
      handleError(error, 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const deleteSheet = async (sheet: any) => {
    const proceed = async () => {
      try {
        hapticFeedback.warning();
        await supabase.from('attendance_records').delete().eq('sheet_id', sheet.id);
        const { error: sheetError } = await supabase
          .from('attendance_sheets')
          .delete()
          .eq('id', sheet.id);

        if (sheetError) throw sheetError;

        setAttendanceSheets(prev => prev.filter(s => s.id !== sheet.id));
        if (viewingSheet?.id === sheet.id) {
          setViewingSheet(null);
        }
        hapticFeedback.success();
        showSuccess('Attendance sheet deleted');
      } catch (error) {
        hapticFeedback.error();
        console.error('Delete attendance error:', error);
        handleError(error, 'Failed to delete attendance sheet');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to delete the attendance sheet for ${sheet.date}?`)) {
        proceed();
      }
    } else {
      Alert.alert(
        'Delete Attendance',
        `Are you sure you want to delete the attendance sheet for ${sheet.date}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: proceed },
        ]
      );
    }
  };

  const viewSheet = async (sheet: any) => {
    hapticFeedback.light();
    setViewingSheet(sheet);
    setLoadingRecords(true);
    try {
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          student:app_users!attendance_records_student_id_fkey(id, name, email)
        `)
        .eq('sheet_id', sheet.id);

      if (!error && records) {
        setViewingRecords(records);
      } else {
        // Fallback join
        const { data: rawRecords } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('sheet_id', sheet.id);

        if (rawRecords && rawRecords.length > 0) {
          const ids = rawRecords.map((r: any) => r.student_id);
          const { data: studentsData } = await supabase
            .from('app_users')
            .select('id, name, email')
            .in('id', ids);

          const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));
          setViewingRecords(rawRecords.map((r: any) => ({
            ...r,
            student: studentMap.get(r.student_id) || { name: 'Student', email: '' }
          })));
        } else {
          setViewingRecords([]);
        }
      }
    } catch (err) {
      console.error('Failed to load sheet records:', err);
      setViewingRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const exportSheetCSV = (sheet: any, records: any[]) => {
    try {
      const csv = [
        ['Date', 'School', 'Student Name', 'Email', 'Status', 'Note'].join(','),
        ...records.map((r: any) => [
          sheet.date,
          sheet.school?.name || '',
          r.student?.name || '',
          r.student?.email || '',
          getStatusMeta(r.status).label,
          r.note || '',
        ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      if (typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${sheet.date}-${sheet.school?.name || 'school'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('Attendance sheet exported successfully!');
      }
    } catch (error) {
      handleError(error, 'Failed to export');
    }
  };

  if (loading) return <LoadingSpinner />;

  // Editor View
  if (showEditor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={closeEditor} style={styles.headerBackBtn}>
            <Ionicons name="close" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingSheet ? 'Edit Attendance' : 'New Attendance'}</Text>
          <TouchableOpacity onPress={saveAttendance} disabled={saving} style={styles.headerSaveBtn}>
            <Ionicons name="checkmark" size={24} color={saving ? Colors.text.tertiary : Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.editorContent}>
          {/* School Selector */}
          <Text style={styles.label}>School</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schoolList}>
            {schools.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[styles.schoolChip, selectedSchool === school.id && styles.schoolChipSelected]}
                onPress={() => {
                  setSelectedSchool(school.id);
                  loadStudents(school.id);
                }}
              >
                <Text style={[styles.schoolChipText, selectedSchool === school.id && styles.schoolChipTextSelected]}>
                  {school.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Date Selector */}
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.dateInput}
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.text.tertiary}
          />

          {/* Students List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.label}>Students ({students.length})</Text>
            <View style={styles.quickMarkRow}>
              <TouchableOpacity
                style={styles.quickMarkBtn}
                onPress={() => {
                  const updated = new Map(attendance);
                  students.forEach((s) => {
                    const cur = updated.get(s.id) || { status: 'present', note: '' };
                    updated.set(s.id, { ...cur, status: 'present' });
                  });
                  setAttendance(updated);
                  showSuccess('Marked all as Present');
                }}
              >
                <Text style={styles.quickMarkBtnText}>All Present</Text>
              </TouchableOpacity>
            </View>
          </View>

          {students.length === 0 ? (
            <View style={styles.emptyStudentsBox}>
              <Text style={styles.emptyStudentsText}>No active students found in this school.</Text>
            </View>
          ) : (
            students.map((student) => {
              const record = attendance.get(student.id) || { status: 'present', note: '' };
              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentHeader}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentInitial}>{student.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentEmail}>{student.email}</Text>
                    </View>
                  </View>

                  {/* Clear status buttons: Present, Absent, Absent with Excuse, Late */}
                  <View style={styles.statusPillsRow}>
                    {ATTENDANCE_STATUS.map((status) => {
                      const isSelected = record.status === status.value;
                      return (
                        <TouchableOpacity
                          key={status.value}
                          style={[
                            styles.statusPill,
                            isSelected && { backgroundColor: status.color, borderColor: status.color },
                          ]}
                          onPress={() => markAttendance(student.id, status.value)}
                        >
                          <Ionicons
                            name={status.icon as any}
                            size={14}
                            color={isSelected ? '#FFFFFF' : status.color}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              isSelected ? { color: '#FFFFFF', fontWeight: 'bold' } : { color: Colors.text.secondary },
                            ]}
                          >
                            {status.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    style={styles.noteInput}
                    value={record.note}
                    onChangeText={(text) => setStudentNote(student.id, text)}
                    placeholder="Add note or reason (optional)"
                    placeholderTextColor={Colors.text.tertiary}
                  />
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button title={saving ? 'Saving...' : 'Save Attendance Sheet'} onPress={saveAttendance} loading={saving} />
        </View>
      </SafeAreaView>
    );
  }

  // Calculate stats for viewing sheet
  const viewStats = { present: 0, absent: 0, excused: 0, late: 0 };
  viewingRecords.forEach((r) => {
    const meta = getStatusMeta(r.status);
    if (meta.label === 'Present') viewStats.present++;
    else if (meta.label === 'Absent') viewStats.absent++;
    else if (meta.label === 'Absent with Excuse') viewStats.excused++;
    else if (meta.label === 'Late') viewStats.late++;
  });

  const filteredSheets = selectedSchoolFilter && selectedSchoolFilter !== 'all'
    ? attendanceSheets.filter(sheet => sheet.school_id === selectedSchoolFilter)
    : attendanceSheets;

  // Main List View
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Sheets</Text>
        <TouchableOpacity onPress={() => openEditor()} style={styles.headerAddBtn}>
          <Ionicons name="add" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* School Category Filter Pills */}
      {schools.length > 1 && (
        <View style={styles.schoolFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schoolFilterScroll}>
            <TouchableOpacity
              style={[styles.schoolPill, (!selectedSchoolFilter || selectedSchoolFilter === 'all') && styles.schoolPillActive]}
              onPress={() => setSelectedSchoolFilter('all')}
            >
              <Text style={[styles.schoolPillText, (!selectedSchoolFilter || selectedSchoolFilter === 'all') && styles.schoolPillTextActive]}>
                All Schools ({attendanceSheets.length})
              </Text>
            </TouchableOpacity>
            {schools.map((sc) => {
              const count = attendanceSheets.filter(s => s.school_id === sc.id).length;
              return (
                <TouchableOpacity
                  key={sc.id}
                  style={[styles.schoolPill, selectedSchoolFilter === sc.id && styles.schoolPillActive]}
                  onPress={() => setSelectedSchoolFilter(sc.id)}
                >
                  <Text style={[styles.schoolPillText, selectedSchoolFilter === sc.id && styles.schoolPillTextActive]}>
                    {sc.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredSheets.length === 0 ? (
          <View>
            <EmptyState icon="calendar" message="No attendance sheets yet" />
            <View style={styles.emptyActions}>
              <TouchableOpacity style={styles.createButton} onPress={() => openEditor()}>
                <Ionicons name="add-circle" size={24} color={Colors.text.inverse} />
                <Text style={styles.createButtonText}>Create Attendance Sheet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          filteredSheets.map((sheet, index) => (
            <AnimatedCard key={sheet.id} delay={50 * (index + 1)} style={styles.sheetCard}>
              <TouchableOpacity
                style={styles.sheetCardTouchable}
                onPress={() => viewSheet(sheet)}
                activeOpacity={0.7}
              >
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetInfo}>
                    <Text style={styles.sheetDate}>
                      {new Date(sheet.date).toLocaleDateString('en-US', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </Text>
                    <Text style={styles.sheetSchool}>{sheet.school?.name || 'Assigned School'}</Text>
                  </View>

                  <View style={styles.sheetActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openEditor(sheet);
                      }}
                      style={styles.actionButton}
                      accessibilityLabel="Edit Sheet"
                    >
                      <Ionicons name="create-outline" size={20} color={Colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        deleteSheet(sheet);
                      }}
                      style={[styles.actionButton, styles.deleteActionButton]}
                      accessibilityLabel="Delete Sheet"
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      {/* Sheet Details Viewer Modal */}
      <Modal
        visible={!!viewingSheet}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setViewingSheet(null)}
      >
        {viewingSheet && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setViewingSheet(null)} style={styles.headerBackBtn}>
                <Ionicons name="close" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalHeaderTitle}>
                  {new Date(viewingSheet.date).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </Text>
                <Text style={styles.modalHeaderSubtitle}>{viewingSheet.school?.name || 'School'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => exportSheetCSV(viewingSheet, viewingRecords)}
                style={styles.headerExportBtn}
              >
                <Ionicons name="download-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Attendance Stats Overview */}
            <View style={styles.statsSummaryBar}>
              <View style={[styles.statBox, { borderColor: Colors.success }]}>
                <Text style={[styles.statNumber, { color: Colors.success }]}>{viewStats.present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statBox, { borderColor: Colors.error }]}>
                <Text style={[styles.statNumber, { color: Colors.error }]}>{viewStats.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={[styles.statBox, { borderColor: Colors.warning }]}>
                <Text style={[styles.statNumber, { color: Colors.warning }]}>{viewStats.excused}</Text>
                <Text style={styles.statLabel}>Excused</Text>
              </View>
              <View style={[styles.statBox, { borderColor: '#8B5CF6' }]}>
                <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>{viewStats.late}</Text>
                <Text style={styles.statLabel}>Late</Text>
              </View>
            </View>

            {loadingRecords ? (
              <LoadingSpinner />
            ) : (
              <ScrollView style={styles.recordsScroll}>
                <Text style={styles.recordsCountHeader}>
                  Total Students: {viewingRecords.length}
                </Text>

                {viewingRecords.length === 0 ? (
                  <EmptyState icon="people" message="No student records in this sheet" />
                ) : (
                  viewingRecords.map((record) => {
                    const meta = getStatusMeta(record.status);
                    return (
                      <View key={record.id || record.student_id} style={styles.recordRow}>
                        <View style={styles.recordLeft}>
                          <View style={styles.recordAvatar}>
                            <Text style={styles.recordAvatarText}>
                              {(record.student?.name || 'S').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.recordDetails}>
                            <Text style={styles.recordName}>{record.student?.name || 'Student'}</Text>
                            <Text style={styles.recordEmail}>{record.student?.email || ''}</Text>
                            {record.note ? (
                              <Text style={styles.recordNote}>Note: {record.note}</Text>
                            ) : null}
                          </View>
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: meta.color + '20', borderColor: meta.color }]}>
                          <Ionicons name={meta.icon as any} size={14} color={meta.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            {/* Viewer Bottom Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalEditBtn}
                onPress={() => {
                  const target = viewingSheet;
                  setViewingSheet(null);
                  openEditor(target);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalEditBtnText}>Edit Sheet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalExportBtn}
                onPress={() => exportSheetCSV(viewingSheet, viewingRecords)}
              >
                <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalExportBtnText}>Export CSV</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.card.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  headerBackBtn: { padding: Spacing.xs },
  headerAddBtn: { padding: Spacing.xs },
  headerSaveBtn: { padding: Spacing.xs },
  headerExportBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary },
  content: { flex: 1, padding: Spacing.lg },
  editorContent: { flex: 1, padding: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  schoolList: { flexDirection: 'row', marginBottom: Spacing.md },
  schoolChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: 20,
    backgroundColor: Colors.card.background, marginRight: Spacing.sm, borderWidth: 1, borderColor: Colors.border.medium,
  },
  schoolChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  schoolChipText: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' },
  schoolChipTextSelected: { color: Colors.text.inverse },
  dateInput: {
    backgroundColor: Colors.card.background, borderRadius: 8, padding: Spacing.md,
    fontSize: 16, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border.light,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md,
  },
  quickMarkRow: { flexDirection: 'row' },
  quickMarkBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: 6, backgroundColor: Colors.primary + '15',
  },
  quickMarkBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  emptyStudentsBox: {
    padding: Spacing.xl, alignItems: 'center', backgroundColor: Colors.card.background, borderRadius: 12, marginTop: Spacing.md,
  },
  emptyStudentsText: { fontSize: 14, color: Colors.text.secondary },
  studentCard: {
    backgroundColor: Colors.card.background, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border.light,
  },
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  studentAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  studentInitial: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  studentEmail: { fontSize: 12, color: Colors.text.secondary },
  statusPillsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border.medium, backgroundColor: Colors.card.background,
  },
  statusPillText: { fontSize: 12, fontWeight: '500' },
  noteInput: {
    backgroundColor: Colors.background, borderRadius: 8, padding: Spacing.sm,
    fontSize: 13, color: Colors.text.primary, borderWidth: 1, borderColor: Colors.border.light,
  },
  footer: {
    padding: Spacing.lg, backgroundColor: Colors.card.background,
    borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
  sheetCard: { marginBottom: Spacing.md, padding: 0, overflow: 'hidden' },
  sheetCardTouchable: { padding: Spacing.lg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetInfo: { flex: 1, marginRight: Spacing.md },
  sheetDate: { fontSize: 16, fontWeight: 'bold', color: Colors.text.primary },
  sheetSchool: { fontSize: 14, color: Colors.text.secondary, marginTop: 2 },
  viewBadge: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    backgroundColor: Colors.primary + '15', alignSelf: 'flex-start',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, gap: 4,
  },
  viewBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  sheetActions: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  actionButton: {
    padding: Spacing.sm, borderRadius: 8, backgroundColor: Colors.card.background,
  },
  deleteActionButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  emptyActions: { alignItems: 'center', marginTop: Spacing.xl },
  createButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderRadius: 12,
  },
  createButtonText: { color: Colors.text.inverse, fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.card.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  modalTitleContainer: { flex: 1, marginHorizontal: Spacing.md },
  modalHeaderTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.text.primary },
  modalHeaderSubtitle: { fontSize: 13, color: Colors.text.secondary },
  statsSummaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md,
    backgroundColor: Colors.card.background, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
    gap: Spacing.xs,
  },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: 8, borderWidth: 1, backgroundColor: Colors.background,
  },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: Colors.text.secondary, marginTop: 2 },
  recordsScroll: { flex: 1, padding: Spacing.lg },
  recordsCountHeader: {
    fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: Spacing.md,
  },
  recordRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card.background, padding: Spacing.md, borderRadius: 10,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border.light,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.sm },
  recordAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  recordAvatarText: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
  recordDetails: { flex: 1 },
  recordName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  recordEmail: { fontSize: 12, color: Colors.text.secondary },
  recordNote: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2, fontStyle: 'italic' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row', padding: Spacing.lg, backgroundColor: Colors.card.background,
    borderTopWidth: 1, borderTopColor: Colors.border.light, gap: Spacing.md,
  },
  modalEditBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: 10, gap: Spacing.xs,
  },
  modalEditBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  modalExportBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: 10, gap: Spacing.xs,
  },
  modalExportBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  schoolFilterContainer: {
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    paddingVertical: Spacing.xs,
  },
  schoolFilterScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  schoolPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  schoolPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schoolPillText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  schoolPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
