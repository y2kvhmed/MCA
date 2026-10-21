import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSchools, deleteSchoolCompletely } from '../lib/database';
import { handleError } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ViewSchools() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      const { data } = await getSchools();
      if (data) {
        setSchools(data);
      }
    } catch (error) {
      console.error('Load schools error:', error);
      handleError(error, 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchool = (schoolId: string, schoolName: string) => {
    const doDelete = async () => {
      setLoading(true);
      try {
        console.log('Attempting to delete school:', schoolId, schoolName);
        const result = await deleteSchoolCompletely(schoolId);
        console.log('Delete result:', result);

        if (result.success) {
          showSuccess(result.message || `School "${schoolName}" deleted successfully`);
          await loadSchools();
        } else {
          console.error('School deletion failed:', result.error);
          showError(result.error || 'Failed to delete school');
        }
      } catch (error: any) {
        console.error('School deletion error:', error);
        showError(error?.message || 'Failed to delete school');
      } finally {
        setLoading(false);
      }
    };

    const confirmMessage = `Are you sure you want to permanently delete "${schoolName}"?\n\nThis will remove the school and unassign all associated teachers and students. This action cannot be undone.`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(confirmMessage)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete School',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const handleEditSchool = (schoolId: string) => {
    router.push(`/edit-school?schoolId=${schoolId}`);
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
        <Text style={styles.headerTitle}>Manage Schools</Text>
        <TouchableOpacity onPress={() => router.push('/create-school')}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {schools.length === 0 ? (
          <EmptyState
            icon="school"
            title="No Schools"
            description="Create your first school to get started."
          />
        ) : (
          schools.map((school) => (
            <Card key={school.id} style={styles.schoolCard}>
              <View style={styles.schoolHeader}>
                <View style={styles.schoolIcon}>
                  <Ionicons name="school" size={24} color={Colors.text.inverse} />
                </View>
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>{school.name}</Text>
                  {school.description && (
                    <Text style={styles.schoolDescription}>{school.description}</Text>
                  )}
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: Colors.info + '20' }]}
                    onPress={() => handleEditSchool(school.id)}
                  >
                    <Ionicons name="create" size={16} color={Colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: Colors.error + '20' }]}
                    onPress={() => handleDeleteSchool(school.id, school.name)}
                  >
                    <Ionicons name="trash" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.schoolFooter}>
                <Text style={styles.schoolDate}>
                  Created {new Date(school.created_at).toLocaleDateString()}
                </Text>
              </View>
            </Card>
          ))
        )}

        <Button
          title="Create New School"
          onPress={() => router.push('/create-school')}
          style={styles.createButton}
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
  schoolCard: {
    marginBottom: Spacing.md,
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  schoolIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  schoolDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolFooter: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  schoolDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  createButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
});