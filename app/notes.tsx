import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert, Modal, Platform } from 'react-native';
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

export default function NotesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reader state (for students & teachers to read full note)
  const [readingNote, setReadingNote] = useState<any>(null);

  // Student specific
  const [studentNotes, setStudentNotes] = useState<any[]>([]);

  // Teacher / Admin specific
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

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
      setUser(currentUser);

      if (currentUser.role === 'student') {
        // Students can only view notes teachers left about them
        await loadNotesForStudent(currentUser.id);
      } else {
        // Teachers and admins can select a student and add/edit notes
        let accessibleSchools: any[] = [];
        try {
          if (currentUser.role === 'admin') {
            const { getSchools } = await import('../lib/database');
            const { data } = await getSchools();
            accessibleSchools = data || [];
          } else {
            const { getTeacherSchools } = await import('../lib/database');
            const { data } = await getTeacherSchools(currentUser.id);
            accessibleSchools = data || [];
            if (accessibleSchools.length === 0 && currentUser.school_id) {
              const { data: dSchool } = await supabase.from('schools').select('*').eq('id', currentUser.school_id).single();
              if (dSchool) accessibleSchools = [dSchool];
            }
          }
        } catch (e) {
          console.warn('Error loading schools in notes:', e);
        }
        setSchools(accessibleSchools);

        let initialSchool = 'all';
        if (currentUser.role !== 'admin') {
          if (currentUser.school_id && accessibleSchools.some(s => s.id === currentUser.school_id)) {
            initialSchool = currentUser.school_id;
          } else if (accessibleSchools.length > 0) {
            initialSchool = accessibleSchools[0].id;
          }
        }
        setSelectedSchoolFilter(initialSchool);
        await loadStudentsList(currentUser, accessibleSchools, initialSchool);
      }
    } catch (error) {
      handleError(error, 'Failed to load notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadNotesForStudent = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('student_notes')
        .select('*')
        .eq('student_id', studentId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Student notes query error:', error.message);
        setStudentNotes([]);
      } else {
        setStudentNotes(data || []);
      }
    } catch (err) {
      console.warn('Error loading notes:', err);
      setStudentNotes([]);
    }
  };

  const loadStudentsList = async (currentUser: any, accessibleSchools: any[], preferredSchool?: string) => {
    try {
      let query = supabase
        .from('app_users')
        .select('id, name, email, school_id')
        .eq('role', 'student')
        .eq('is_active', true)
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

      const { data, error } = await query;
      if (error) throw error;

      const list = data || [];
      setStudents(list);
      if (list.length > 0) {
        const targetSchool = preferredSchool || selectedSchoolFilter;
        const initialStudent = (targetSchool && targetSchool !== 'all')
          ? list.find(s => s.school_id === targetSchool) || list[0]
          : list[0];

        setSelectedStudent(initialStudent);
        await loadNotesForStudent(initialStudent.id);
      } else {
        setSelectedStudent(null);
        setStudentNotes([]);
      }
    } catch (error) {
      console.warn('Failed to load students:', error);
    }
  };

  const handleSchoolChange = (schoolId: string) => {
    hapticFeedback.selection();
    setSelectedSchoolFilter(schoolId);
    setShowSchoolModal(false);

    const inSchool = students.filter(s => schoolId === 'all' || s.school_id === schoolId);
    if (inSchool.length > 0) {
      if (!selectedStudent || (schoolId !== 'all' && selectedStudent.school_id !== schoolId)) {
        setSelectedStudent(inSchool[0]);
        loadNotesForStudent(inSchool[0].id);
      }
    } else {
      setSelectedStudent(null);
      setStudentNotes([]);
    }
  };

  const onSelectStudent = async (student: any) => {
    hapticFeedback.selection();
    setSelectedStudent(student);
    await loadNotesForStudent(student.id);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.role === 'student') {
      await loadNotesForStudent(user.id);
    } else if (selectedStudent) {
      await loadNotesForStudent(selectedStudent.id);
    } else {
      await loadData();
    }
    setRefreshing(false);
  };

  const openEditor = (note?: any) => {
    hapticFeedback.light();
    if (note) {
      setEditingNote(note);
      setNoteTitle(note.title);
      setNoteContent(note.content || '');
      setIsPinned(note.is_pinned || false);
    } else {
      setEditingNote(null);
      setNoteTitle('');
      setNoteContent('');
      setIsPinned(false);
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setIsPinned(false);
  };

  const saveNote = async () => {
    const targetStudentId = selectedStudent?.id || editingNote?.student_id || user?.id;
    if (!targetStudentId) {
      Alert.alert('Select Student', 'Please select a student to add this note for.');
      return;
    }
    if (!noteTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for this note.');
      return;
    }

    setSavingNote(true);
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('student_notes')
          .update({
            title: noteTitle.trim(),
            content: noteContent.trim(),
            is_pinned: isPinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNote.id);

        if (error) throw error;
        showSuccess('Note updated successfully!');
      } else {
        const { error } = await supabase
          .from('student_notes')
          .insert({
            student_id: targetStudentId,
            teacher_id: user?.id || null,
            title: noteTitle.trim(),
            content: noteContent.trim(),
            is_pinned: isPinned,
          });

        if (error) throw error;
        showSuccess('Note added successfully!');
      }

      closeEditor();
      await loadNotesForStudent(targetStudentId);
    } catch (error) {
      handleError(error, 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = (noteId: string) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase
          .from('student_notes')
          .delete()
          .eq('id', noteId);

        if (error) throw error;
        showSuccess('Note deleted successfully');
        const targetStudentId = selectedStudent?.id || user?.id;
        if (targetStudentId) {
          await loadNotesForStudent(targetStudentId);
        }
      } catch (error) {
        handleError(error, 'Failed to delete note');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const togglePin = async (note: any) => {
    try {
      const { error } = await supabase
        .from('student_notes')
        .update({ is_pinned: !note.is_pinned })
        .eq('id', note.id);

      if (error) throw error;
      if (user?.role === 'student') {
        await loadNotesForStudent(user.id);
      } else if (selectedStudent) {
        await loadNotesForStudent(selectedStudent.id);
      }
    } catch (error) {
      handleError(error, 'Failed to update pin');
    }
  };

  if (loading) return <LoadingSpinner />;

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  const selectedSchoolObj = schools.find(s => s.id === selectedSchoolFilter);
  const selectedSchoolDisplayName = selectedSchoolFilter === 'all'
    ? 'All Schools'
    : (selectedSchoolObj?.name || 'Choose School');

  const currentSchoolStudents = students.filter(s => {
    if (!selectedSchoolFilter || selectedSchoolFilter === 'all') return true;
    return s.school_id === selectedSchoolFilter;
  });

  const displayedStudents = currentSchoolStudents.filter(s => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const emailMatch = (s.email || '').toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>
            {isTeacherOrAdmin ? 'Student Notes' : 'Teacher Notes'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isTeacherOrAdmin 
              ? 'Notes & feedback about students' 
              : 'Feedback left for you by your teacher'}
          </Text>
        </View>
        {isTeacherOrAdmin ? (
          <TouchableOpacity onPress={() => openEditor()} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={Colors.text.inverse} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Teacher/Admin School & Student Dropdown Selector */}
      {isTeacherOrAdmin && (
        <View style={styles.selectorCardContainer}>
          <View style={styles.dropdownsWrapper}>
            {/* School Dropdown */}
            <View style={styles.dropdownField}>
              <Text style={styles.dropdownFieldLabel}>School</Text>
              <TouchableOpacity
                style={styles.dropdownSelectorBtn}
                onPress={() => setShowSchoolModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownSelectorLeft}>
                  <Ionicons name="business" size={17} color={Colors.primary} />
                  <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                    {selectedSchoolDisplayName}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Student Dropdown */}
            <View style={styles.dropdownField}>
              <Text style={styles.dropdownFieldLabel}>Student</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownSelectorBtn,
                  !selectedStudent && styles.dropdownSelectorBtnEmpty,
                ]}
                onPress={() => {
                  setStudentSearchQuery('');
                  setShowStudentModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownSelectorLeft}>
                  <Ionicons 
                    name="person" 
                    size={17} 
                    color={selectedStudent ? Colors.primary : Colors.text.tertiary} 
                  />
                  <Text 
                    style={[
                      styles.dropdownSelectorText,
                      !selectedStudent && styles.dropdownSelectorPlaceholder,
                    ]} 
                    numberOfLines={1}
                  >
                    {selectedStudent ? selectedStudent.name : 'Select a student...'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Student Summary Bar */}
          {selectedStudent ? (
            <View style={styles.selectedStudentCard}>
              <View style={styles.studentAvatarBadge}>
                <Text style={styles.studentAvatarText}>
                  {(selectedStudent.name || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfoCol}>
                <Text style={styles.studentInfoName} numberOfLines={1}>
                  {selectedStudent.name}
                </Text>
                <Text style={styles.studentInfoSub} numberOfLines={1}>
                  {selectedStudent.email} • {studentNotes.length} {studentNotes.length === 1 ? 'note' : 'notes'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => openEditor()}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.text.inverse} />
                <Text style={styles.quickAddBtnText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            currentSchoolStudents.length === 0 && (
              <View style={styles.noStudentsNotice}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.text.secondary} />
                <Text style={styles.noStudentsNoticeText}>No students registered in this school yet.</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* Notes List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {studentNotes.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            message={
              isTeacherOrAdmin
                ? `No notes written yet for ${selectedStudent?.name || 'this student'}. Tap '+' to add a note about them!`
                : 'No notes from your teachers yet. When your teacher writes feedback or observations about your progress, they will appear here.'
            }
          />
        ) : (
          studentNotes.map((note, index) => {
            return (
              <AnimatedCard
                key={note.id}
                delay={index * 50}
                style={styles.noteCard}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setReadingNote(note)}
                  style={styles.noteCardTouchable}
                >
                  <View style={styles.noteTopRow}>
                    <View style={styles.noteBadge}>
                      <Ionicons name="ribbon-outline" size={14} color={Colors.primary} />
                      <Text style={styles.noteBadgeText}>Teacher Note</Text>
                    </View>

                    <View style={styles.noteActions}>
                      {note.is_pinned && (
                        <Ionicons name="pin" size={16} color={Colors.warning} style={{ marginRight: 6 }} />
                      )}
                      {isTeacherOrAdmin && (
                        <>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              togglePin(note);
                            }}
                            style={styles.iconBtn}
                          >
                            <Ionicons 
                              name={note.is_pinned ? "pin" : "pin-outline"} 
                              size={18} 
                              color={note.is_pinned ? Colors.warning : Colors.text.secondary} 
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              openEditor(note);
                            }}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="pencil" size={16} color={Colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              deleteNote(note.id);
                            }}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>

                  <Text style={styles.noteTitle}>{note.title}</Text>
                  {note.content ? (
                    <Text style={styles.noteBody} numberOfLines={3}>{note.content}</Text>
                  ) : null}

                  <View style={styles.noteFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
                      <Text style={styles.noteDate}>
                        {new Date(note.created_at || note.updated_at).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    <View style={styles.tapToReadBadge}>
                      <Text style={styles.tapToReadText}>Tap to read</Text>
                      <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedCard>
            );
          })
        )}
      </ScrollView>

      {/* Note Reader Modal (for Students & Teachers) */}
      <Modal
        visible={!!readingNote}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReadingNote(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.noteBadge}>
                <Ionicons name="ribbon-outline" size={14} color={Colors.primary} />
                <Text style={styles.noteBadgeText}>Teacher Note</Text>
              </View>
              <TouchableOpacity onPress={() => setReadingNote(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.readerTitle}>{readingNote?.title}</Text>
              <View style={styles.readerMetaRow}>
                <Ionicons name="time-outline" size={14} color={Colors.text.tertiary} />
                <Text style={styles.readerDate}>
                  {readingNote && new Date(readingNote.created_at || readingNote.updated_at).toLocaleDateString([], {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.readerDivider} />

              <Text style={styles.readerContent}>
                {readingNote?.content || 'No text content in this note.'}
              </Text>
            </ScrollView>

            <View style={styles.readerFooter}>
              <Button
                title="Close"
                variant="outline"
                onPress={() => setReadingNote(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Teacher / Admin Note Editor Modal */}
      <Modal
        visible={showEditor}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditor}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNote ? 'Edit Note' : `New Note for ${selectedStudent?.name || 'Student'}`}
              </Text>
              <TouchableOpacity onPress={closeEditor} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="e.g. Needs help with mechanics problems"
                placeholderTextColor={Colors.text.tertiary}
              />

              <Text style={styles.formLabel}>Note Content</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write detailed observations, feedback, or reminders for this student..."
                placeholderTextColor={Colors.text.tertiary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <TouchableOpacity 
                style={styles.pinToggleRow}
                onPress={() => setIsPinned(!isPinned)}
              >
                <Ionicons 
                  name={isPinned ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={isPinned ? Colors.primary : Colors.text.secondary} 
                />
                <Text style={styles.pinToggleText}>Pin this note to the top</Text>
              </TouchableOpacity>

              <Button
                title={savingNote ? 'Saving...' : editingNote ? 'Update Note' : 'Add Note to Student'}
                onPress={saveNote}
                loading={savingNote}
                disabled={savingNote || !noteTitle.trim()}
                style={styles.modalSaveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* School Dropdown Modal */}
      <Modal
        visible={showSchoolModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSchoolModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Choose School</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSchoolModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {(user?.role === 'admin' || schools.length > 1) && (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedSchoolFilter === 'all' && styles.dropdownItemSelected,
                  ]}
                  onPress={() => handleSchoolChange('all')}
                >
                  <View style={styles.dropdownItemIcon}>
                    <Ionicons 
                      name="globe-outline" 
                      size={20} 
                      color={selectedSchoolFilter === 'all' ? Colors.primary : Colors.text.secondary} 
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={[
                      styles.dropdownItemTitle,
                      selectedSchoolFilter === 'all' && styles.dropdownItemTitleSelected,
                    ]}>
                      All Schools
                    </Text>
                    <Text style={styles.dropdownItemSubtitle}>
                      {students.length} total students
                    </Text>
                  </View>
                  {selectedSchoolFilter === 'all' && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}

              {schools.map((school) => {
                const count = students.filter(s => s.school_id === school.id).length;
                const isSelected = selectedSchoolFilter === school.id;
                return (
                  <TouchableOpacity
                    key={school.id}
                    style={[
                      styles.dropdownItem,
                      isSelected && styles.dropdownItemSelected,
                    ]}
                    onPress={() => handleSchoolChange(school.id)}
                  >
                    <View style={styles.dropdownItemIcon}>
                      <Ionicons 
                        name="business-outline" 
                        size={20} 
                        color={isSelected ? Colors.primary : Colors.text.secondary} 
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={[
                        styles.dropdownItemTitle,
                        isSelected && styles.dropdownItemTitleSelected,
                      ]}>
                        {school.name}
                      </Text>
                      <Text style={styles.dropdownItemSubtitle}>
                        {count} {count === 1 ? 'student' : 'students'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Student Dropdown Modal */}
      <Modal
        visible={showStudentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStudentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Choose Student</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStudentModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.dropdownSearchBox}>
              <Ionicons name="search" size={18} color={Colors.text.tertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.dropdownSearchInput}
                placeholder="Search student by name or email..."
                placeholderTextColor={Colors.text.tertiary}
                value={studentSearchQuery}
                onChangeText={setStudentSearchQuery}
                autoCorrect={false}
              />
              {studentSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStudentSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <ScrollView style={{ maxHeight: 360 }}>
              {displayedStudents.length === 0 ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Ionicons name="person-outline" size={36} color={Colors.text.tertiary} />
                  <Text style={{ marginTop: 8, fontSize: 14, color: Colors.text.secondary, textAlign: 'center' }}>
                    {studentSearchQuery.trim()
                      ? 'No students found matching your search.'
                      : 'No students registered in this school.'}
                  </Text>
                </View>
              ) : (
                displayedStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id;
                  const schoolName = schools.find(s => s.id === student.school_id)?.name;
                  return (
                    <TouchableOpacity
                      key={student.id}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        onSelectStudent(student);
                        setShowStudentModal(false);
                      }}
                    >
                      <View style={styles.dropdownStudentAvatar}>
                        <Text style={styles.dropdownStudentAvatarText}>
                          {(student.name || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={[
                          styles.dropdownItemTitle,
                          isSelected && styles.dropdownItemTitleSelected,
                        ]}>
                          {student.name}
                        </Text>
                        <Text style={styles.dropdownItemSubtitle} numberOfLines={1}>
                          {student.email}{schoolName && selectedSchoolFilter === 'all' ? ` • ${schoolName}` : ''}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backBtn: { padding: Spacing.xs },
  headerTitles: { flex: 1, marginLeft: Spacing.sm },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  headerSubtitle: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorCardContainer: {
    backgroundColor: Colors.card.background,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  dropdownsWrapper: {
    gap: Spacing.sm,
  },
  dropdownField: {
    width: '100%',
  },
  dropdownFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownSelectorBtnEmpty: {
    borderColor: Colors.border.light,
  },
  dropdownSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  dropdownSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dropdownSelectorPlaceholder: {
    color: Colors.text.tertiary,
    fontWeight: '400',
  },
  selectedStudentCard: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  studentAvatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  studentInfoCol: {
    flex: 1,
  },
  studentInfoName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  studentInfoSub: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noStudentsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  noStudentsNoticeText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  dropdownModalContent: {
    backgroundColor: Colors.card.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.primary + '12',
  },
  dropdownItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownStudentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownStudentAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dropdownItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dropdownItemTitleSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dropdownItemSubtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.lg },
  noteCardTouchable: {
    padding: Spacing.lg,
  },
  noteCard: {
    borderRadius: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.card.background,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  noteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  noteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  noteBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  noteActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 4 },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  noteBody: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  noteDate: { fontSize: 11, color: Colors.text.tertiary },
  tapToReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tapToReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Reader Modal Styles
  readerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  readerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  readerDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  readerDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginBottom: Spacing.md,
  },
  readerContent: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text.primary,
  },
  readerFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.card.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
  modalCloseBtn: { padding: 4 },
  modalBody: { padding: Spacing.lg },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  modalTextArea: { minHeight: 120 },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: Spacing.md,
  },
  pinToggleText: { fontSize: 13, color: Colors.text.primary },
  modalSaveBtn: { marginVertical: Spacing.md },
});
