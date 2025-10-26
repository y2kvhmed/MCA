import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSchools } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ViewSchools() {
  const router = useRouter();
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

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    Alert.alert(
      'Delete School',
      `Are you sure you want to delete "${schoolName}"?\n\nThis will permanently delete:\n• All students and teachers (except admins)\n• All classes and assignments\n• All submissions and files\n• All school data\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('Attempting to delete school:', schoolId, schoolName);
              
              // Import the new delete function
              const { deleteSchoolCompletely } = await import('../lib/database');
              const result = await deleteSchoolCompletely(schoolId);

              console.log('Delete result:', result);

              if (result.success) {
                showSuccess(result.message || `School "${schoolName}" deleted successfully`);
                loadSchools(); // Reload schools
              } else {
                console.error('School deletion failed:', result.error);
                Alert.alert(
                  'Deletion Failed', 
                  result.error || 'Failed to delete school. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('School deletion error:', error);
              Alert.alert(
                'Error', 
                `Failed to delete school: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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