import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getMaterialsByTeacher } from '../lib/database';
import { formatRelativeDate, handleError, showSuccess } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function MaterialsList() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load materials created by this teacher
      const { data: materialsData } = await getMaterialsByTeacher(currentUser.id);
      if (materialsData) setMaterials(materialsData);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const exportMaterialsCSV = async () => {
    try {
      const csvData = materials.map(material => ({
        'Material Title': material.title,
        'Description': material.description || 'No description',
        'Type': material.assignment_type,
        'Created Date': new Date(material.created_at).toLocaleDateString(),
        'School': material.school?.name || 'All Schools',
        'File Attached': material.file_path ? 'Yes' : 'No',
        'Published': material.is_published ? 'Yes' : 'No',
      }));

      await exportToCSV(csvData, 'materials-list');
      showSuccess('Materials list exported successfully');
    } catch (error) {
      handleError(error, 'Failed to export CSV');
    }
  };

  const viewMaterialDetails = (material: any) => {
    router.push(`/material-details?materialId=${material.id}`);
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
        <Text style={styles.headerTitle}>Materials ({materials.length})</Text>
        <TouchableOpacity onPress={exportMaterialsCSV}>
          <Ionicons name="download" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {materials.length === 0 ? (
          <EmptyState
            icon="folder"
            title="No Materials Found"
            description="You haven't shared any materials yet. Create your first material to get started."
          />
        ) : (
          materials.map((material) => (
            <Card key={material.id} style={styles.materialCard}>
              <TouchableOpacity
                style={styles.materialButton}
                onPress={() => viewMaterialDetails(material)}
              >
                <View style={styles.materialIcon}>
                  <Ionicons name="folder" size={24} color={Colors.text.inverse} />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialTitle}>{material.title}</Text>
                  {material.description && (
                    <Text style={styles.materialDescription} numberOfLines={2}>
                      {material.description}
                    </Text>
                  )}
                  <View style={styles.materialMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar" size={14} color={Colors.text.secondary} />
                      <Text style={styles.metaText}>
                        {formatRelativeDate(material.created_at)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="school" size={14} color={Colors.text.secondary} />
                      <Text style={styles.metaText}>
                        {material.school?.name || 'All Schools'}
                      </Text>
                    </View>
                    {material.file_path && (
                      <View style={styles.metaItem}>
                        <Ionicons name="attach" size={14} color={Colors.text.secondary} />
                        <Text style={styles.metaText}>File attached</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.materialStatus}>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: material.is_published ? Colors.success : Colors.warning }
                  ]}>
                    <Text style={styles.statusText}>
                      {material.is_published ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-assignment')}
      >
        <Ionicons name="add" size={24} color={Colors.text.inverse} />
      </TouchableOpacity>
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
  materialCard: {
    marginBottom: Spacing.md,
  },
  materialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  materialIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  materialDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  materialMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
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
  materialStatus: {
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
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});