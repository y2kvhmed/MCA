import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getSchoolById, updateSchool, getClassesBySchool, getUsersBySchool } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ManageSchool() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

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

      // Load school details
      const { data: schoolData } = await getSchoolById(currentUser.school_id);
      if (schoolData) {
        setSchool(schoolData);
        setName(schoolData.name || '');
        setDescription(schoolData.description || '');
      }

      // Load school classes
      const { data: classesData } = await getClassesBySchool(currentUser.school_id);
      if (classesData) setClasses(classesData);

      // Load school users
      const { data: usersData } = await getUsersBySchool(currentUser.school_id);
      if (usersData) {
        setTeachers(usersData.filter((u: any) => u.role === 'teacher'));
        setStudents(usersData.filter((u: any) => u.role === 'student'));
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load school data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'School name is required');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        description: description.trim(),
      };

      const { error } = await updateSchool(school.id, updates);
      
      if (error) {
        handleError(error, 'Failed to update school');
      } else {
        showSuccess('School updated successfully');
        setEditing(false);
        loadData(); // Reload data
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setName(school?.name || '');
    setDescription(school?.description || '');
    setEditing(false);
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
        <Text style={styles.headerTitle}>Manage School</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Ionicons 
            name={editing ? "close" : "create"} 
            size={24} 
            color={Colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* School Information */}
        <Card style={styles.schoolCard}>
          <View style={styles.schoolHeader}>
            <View style={styles.schoolIcon}>
              <Ionicons name="school" size={32} color={Colors.primary} />
            </View>
            <View style={styles.schoolInfo}>
              <Text style={styles.schoolName}>{school?.name}</Text>
              <Text style={styles.schoolMeta}>
                {teachers.length} Teachers • {students.length} Students • {classes.length} Classes
              </Text>
            </View>
          </View>
        </Card>

        {/* Edit School Form */}
        {editing && (
          <Card style={styles.editCard}>
            <Text style={styles.sectionTitle}>Edit School Details</Text>
            
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
              placeholder="Enter school description"
              multiline
              numberOfLines={3}
            />

            <View style={styles.editActions}>
              <Button
                title="Cancel"
                onPress={cancelEdit}
                variant="outline"
                style={styles.editButton}
              />
              <Button
                title="Save Changes"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                style={styles.editButton}
              />
            </View>
          </Card>
        )}

        {/* Statistics */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>School Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={Colors.info} />
              <Text style={styles.statValue}>{teachers.length}</Text>
              <Text style={styles.statLabel}>Teachers</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="person" size={24} color={Colors.success} />
              <Text style={styles.statValue}>{students.length}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="book" size={24} color={Colors.warning} />
              <Text style={styles.statValue}>{classes.length}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
          </View>
        </Card>

        {/* Classes */}
        <Card style={styles.classesCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Classes</Text>
            <TouchableOpacity onPress={() => router.push('/create-class')}>
              <Ionicons name="add" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          {classes.length === 0 ? (
            <EmptyState
              icon="book"
              title="No Classes Yet"
              description="Create your first class to get started."
            />
          ) : (
            classes.map((classItem) => (
              <TouchableOpacity
                key={classItem.id}
                style={styles.classItem}
                onPress={() => router.push(`/group-management?groupId=${classItem.id}`)}
              >
                <View style={styles.classIcon}>
                  <Ionicons name="book" size={20} color={Colors.text.inverse} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{classItem.name}</Text>
                  <Text style={styles.classDescription}>
                    {classItem.description || 'Physics Class'}
                  </Text>
                  <Text style={styles.classTeacher}>
                    Teacher: {classItem.teacher?.name || 'Not assigned'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => router.push('/create-class')}
          >
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Create New Class</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => router.push('/view-users')}
          >
            <Ionicons name="people" size={24} color={Colors.info} />
            <Text style={styles.actionText}>View All Users</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => router.push('/school-reports')}
          >
            <Ionicons name="bar-chart" size={24} color={Colors.success} />
            <Text style={styles.actionText}>View Reports</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
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
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  schoolMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  editCard: {
    marginBottom: Spacing.lg,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  editButton: {
    flex: 1,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  classesCard: {
    marginBottom: Spacing.lg,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  classDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  classTeacher: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  actionsCard: {
    marginBottom: Spacing.xl,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
});