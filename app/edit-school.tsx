import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

type TabType = 'info' | 'teachers' | 'students';

export default function EditSchool() {
  const router = useRouter();
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // School fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Teachers
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [assignedTeacherIds, setAssignedTeacherIds] = useState<Set<string>>(new Set());
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);

  // Students
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [allSchools, setAllSchools] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [transferringStudent, setTransferringStudent] = useState<any | null>(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, [schoolId]);

  const checkAdminAndLoad = async () => {
    try {
      const user = await getCurrentUser();
      if (!user || user.role !== 'admin') {
        router.replace('/(tabs)/admin-dashboard');
        return;
      }
      await loadSchoolData();
    } catch (err) {
      console.error('Initialization error:', err);
      handleError(err, 'Failed to load school management');
    } finally {
      setLoading(false);
    }
  };

  const loadSchoolData = async () => {
    if (!schoolId) return;

    // 1. Fetch school info
    const { data: schoolData, error: schoolErr } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();

    if (schoolErr) throw schoolErr;
    setName(schoolData.name || '');
    setDescription(schoolData.description || '');

    // 2. Fetch all schools for transfer target
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id, name')
      .order('name');
    setAllSchools(schoolsData || []);

    // 3. Fetch all teachers and junction links
    const { data: teachersData } = await supabase
      .from('app_users')
      .select('id, name, email, phone')
      .eq('role', 'teacher')
      .order('name');
    setAllTeachers(teachersData || []);

    const { data: tsLinks } = await supabase
      .from('teacher_schools')
      .select('teacher_id')
      .eq('school_id', schoolId);
    const assignedSet = new Set<string>((tsLinks || []).map((l: any) => l.teacher_id));
    setAssignedTeacherIds(assignedSet);

    // 4. Fetch enrolled students
    const { data: studentsData } = await supabase
      .from('app_users')
      .select('id, name, email, phone, school_id')
      .eq('role', 'student')
      .eq('school_id', schoolId)
      .order('name');
    setEnrolledStudents(studentsData || []);
  };

  const handleSaveInfo = async () => {
    if (!name.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('School name is required');
      } else {
        Alert.alert('Error', 'School name is required');
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', schoolId);

      if (error) throw error;
      showSuccess('School updated successfully');
    } catch (error) {
      handleError(error, 'Failed to update school');
    } finally {
      setSaving(false);
    }
  };

  // Assign teacher
  const handleAssignTeacher = async (teacherId: string) => {
    try {
      const { error } = await supabase.from('teacher_schools').insert({
        teacher_id: teacherId,
        school_id: schoolId,
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate

      setAssignedTeacherIds((prev) => new Set([...prev, teacherId]));
      setShowAddTeacherModal(false);
      showSuccess('Teacher assigned to school');
    } catch (err) {
      handleError(err, 'Failed to assign teacher');
    }
  };

  // Remove teacher
  const handleRemoveTeacher = (teacher: any) => {
    const doRemove = async () => {
      try {
        const { error } = await supabase
          .from('teacher_schools')
          .delete()
          .eq('teacher_id', teacher.id)
          .eq('school_id', schoolId);
        if (error) throw error;

        setAssignedTeacherIds((prev) => {
          const updated = new Set(prev);
          updated.delete(teacher.id);
          return updated;
        });
        showSuccess(`${teacher.name} unassigned from this school`);
      } catch (err) {
        handleError(err, 'Failed to unassign teacher');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Remove ${teacher.name} from this school?`)) {
        doRemove();
      }
      return;
    }

    Alert.alert(
      'Remove Teacher',
      `Are you sure you want to unassign ${teacher.name} from this school?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ]
    );
  };

  // Open Add Student Modal
  const handleOpenAddStudent = async () => {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('id, name, email, school_id, schools:schools(name)')
        .eq('role', 'student')
        .or(`school_id.is.null,school_id.neq.${schoolId}`)
        .order('name');
      setAvailableStudents(data || []);
      setShowAddStudentModal(true);
    } catch (err) {
      handleError(err, 'Failed to load students');
    }
  };

  // Enroll student
  const handleEnrollStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ school_id: schoolId })
        .eq('id', studentId);
      if (error) throw error;

      setShowAddStudentModal(false);
      await loadSchoolData();
      showSuccess('Student enrolled in school');
    } catch (err) {
      handleError(err, 'Failed to enroll student');
    }
  };

  // Remove student from school
  const handleRemoveStudent = (student: any) => {
    const doRemove = async () => {
      try {
        const { error } = await supabase
          .from('app_users')
          .update({ school_id: null })
          .eq('id', student.id);
        if (error) throw error;

        setEnrolledStudents((prev) => prev.filter((s) => s.id !== student.id));
        showSuccess(`${student.name} removed from school`);
      } catch (err) {
        handleError(err, 'Failed to remove student');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Remove ${student.name} from this school?`)) {
        doRemove();
      }
      return;
    }

    Alert.alert(
      'Remove Student',
      `Are you sure you want to remove ${student.name} from this school?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ]
    );
  };

  // Transfer student to another school
  const handleTransferStudent = async (studentId: string, targetSchoolId: string) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ school_id: targetSchoolId })
        .eq('id', studentId);
      if (error) throw error;

      setTransferringStudent(null);
      setEnrolledStudents((prev) => prev.filter((s) => s.id !== studentId));
      showSuccess('Student transferred successfully');
    } catch (err) {
      handleError(err, 'Failed to transfer student');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const assignedTeachersList = allTeachers.filter((t) => assignedTeacherIds.has(t.id));
  const unassignedTeachersList = allTeachers.filter((t) => !assignedTeacherIds.has(t.id));

  const filteredStudents = enrolledStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q));
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/view-schools'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name || 'Edit School'}
          </Text>
          <Text style={styles.headerSubtitle}>Manage School, Teachers & Students</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'info' && styles.tabItemActive]}
          onPress={() => setActiveTab('info')}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={activeTab === 'info' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
            Info
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'teachers' && styles.tabItemActive]}
          onPress={() => setActiveTab('teachers')}
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={activeTab === 'teachers' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.tabTextActive]}>
            Teachers ({assignedTeachersList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'students' && styles.tabItemActive]}
          onPress={() => setActiveTab('students')}
        >
          <Ionicons
            name="school-outline"
            size={18}
            color={activeTab === 'students' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>
            Students ({enrolledStudents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'info' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>School Details</Text>
            <Input
              label="School Name *"
              value={name}
              onChangeText={setName}
              placeholder="Enter school name"
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter school description (optional)"
              multiline
              numberOfLines={4}
            />
            <Button
              title="Save Changes"
              onPress={handleSaveInfo}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            />
          </Card>
        )}

        {activeTab === 'teachers' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Assigned Teachers</Text>
                <Text style={styles.sectionSubtext}>
                  Teachers who have access to this school's classes and students
                </Text>
              </View>
              <Button
                title="Assign Teacher"
                onPress={() => setShowAddTeacherModal(true)}
                size="small"
                icon="add"
              />
            </View>

            {assignedTeachersList.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="people-outline" size={40} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No teachers assigned yet</Text>
                <Text style={styles.emptyText}>
                  Assign teachers so they can manage attendance, materials, and recordings for this school.
                </Text>
              </Card>
            ) : (
              assignedTeachersList.map((teacher) => (
                <Card key={teacher.id} style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(teacher.name || 'T').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{teacher.name}</Text>
                    <Text style={styles.userEmail}>{teacher.email}</Text>
                    {teacher.phone && (
                      <Text style={styles.userPhone}>Phone: {teacher.phone}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveTeacher(teacher)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === 'students' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>Enrolled Students</Text>
                <Text style={styles.sectionSubtext}>
                  Students currently registered to this school
                </Text>
              </View>
              <Button
                title="Enroll Student"
                onPress={handleOpenAddStudent}
                size="small"
                icon="add"
              />
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Colors.text.secondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students by name or email..."
                placeholderTextColor={Colors.text.tertiary}
                value={studentSearch}
                onChangeText={setStudentSearch}
              />
              {studentSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStudentSearch('')}>
                  <Ionicons name="close" size={18} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {filteredStudents.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="school-outline" size={40} color={Colors.text.tertiary} />
                <Text style={styles.emptyTitle}>
                  {studentSearch ? 'No matching students found' : 'No students enrolled yet'}
                </Text>
                <Text style={styles.emptyText}>
                  Enroll students to allow them to access assignments and materials for this school.
                </Text>
              </Card>
            ) : (
              filteredStudents.map((student) => (
                <Card key={student.id} style={styles.userCard}>
                  <View style={[styles.userAvatar, { backgroundColor: Colors.info + '25' }]}>
                    <Text style={[styles.userAvatarText, { color: Colors.info }]}>
                      {(student.name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{student.name}</Text>
                    <Text style={styles.userEmail}>{student.email}</Text>
                    {student.phone && (
                      <Text style={styles.userPhone}>Phone: {student.phone}</Text>
                    )}
                  </View>

                  <View style={styles.studentActions}>
                    <TouchableOpacity
                      style={styles.transferBtn}
                      onPress={() => setTransferringStudent(student)}
                    >
                      <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
                      <Text style={styles.transferBtnText}>Transfer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeStudentBtn}
                      onPress={() => handleRemoveStudent(student)}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Modal: Assign Teacher */}
      <Modal
        visible={showAddTeacherModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddTeacherModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Teacher</Text>
              <TouchableOpacity onPress={() => setShowAddTeacherModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Select a teacher to assign to this school:
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {unassignedTeachersList.length === 0 ? (
                <Text style={styles.modalEmptyText}>All registered teachers are already assigned to this school.</Text>
              ) : (
                unassignedTeachersList.map((teacher) => (
                  <TouchableOpacity
                    key={teacher.id}
                    style={styles.modalItem}
                    onPress={() => handleAssignTeacher(teacher.id)}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {(teacher.name || 'T').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userName}>{teacher.name}</Text>
                      <Text style={styles.userEmail}>{teacher.email}</Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setShowAddTeacherModal(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Enroll Student */}
      <Modal
        visible={showAddStudentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddStudentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enroll Student</Text>
              <TouchableOpacity onPress={() => setShowAddStudentModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Select a student to enroll into this school:
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {availableStudents.length === 0 ? (
                <Text style={styles.modalEmptyText}>No available students found.</Text>
              ) : (
                availableStudents.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={styles.modalItem}
                    onPress={() => handleEnrollStudent(st.id)}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: Colors.info + '25' }]}>
                      <Text style={[styles.userAvatarText, { color: Colors.info }]}>
                        {(st.name || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userName}>{st.name}</Text>
                      <Text style={styles.userEmail}>{st.email}</Text>
                      <Text style={styles.userPhone}>
                        Current: {st.schools?.name || 'Unassigned'}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setShowAddStudentModal(false)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Transfer Student */}
      <Modal
        visible={!!transferringStudent}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferringStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Student</Text>
              <TouchableOpacity onPress={() => setTransferringStudent(null)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtext}>
              Transfer {transferringStudent?.name} to another school:
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {allSchools
                .filter((s) => s.id !== schoolId)
                .map((target) => (
                  <TouchableOpacity
                    key={target.id}
                    style={styles.modalItem}
                    onPress={() => handleTransferStudent(transferringStudent.id, target.id)}
                  >
                    <Ionicons name="business-outline" size={22} color={Colors.primary} style={{ marginRight: 12 }} />
                    <Text style={[styles.userName, { flex: 1 }]}>{target.name}</Text>
                    <Ionicons name="arrow-forward-circle" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setTransferringStudent(null)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 6,
    marginRight: Spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 13,
  },
  studentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primary + '15',
  },
  transferBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  removeStudentBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: Colors.error + '15',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.card.background,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalSubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalEmptyText: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});