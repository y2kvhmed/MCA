import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess, formatFileSize } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function MaterialDetails() {
  const router = useRouter();
  const { materialId } = useLocalSearchParams();
  const [material, setMaterial] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const { data, error } = await supabase
        .from('study_materials')
        .select(`
          *,
          uploaded_by_user:app_users!study_materials_uploaded_by_fkey(name, email)
        `)
        .eq('id', materialId)
        .single();

      if (error) throw error;
      setMaterial(data);
    } catch (error) {
      handleError(error, 'Failed to load material');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!material?.file_url) {
      Alert.alert('Error', 'No file available for download');
      return;
    }

    try {
      await Linking.openURL(material.file_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const handleDelete = async () => {
    if (user?.role !== 'teacher' && user?.role !== 'admin' && user?.id !== material?.uploaded_by) {
      Alert.alert('Error', 'You do not have permission to delete this material');
      return;
    }

    Alert.alert(
      'Delete Material',
      `Are you sure you want to delete "${material?.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: confirmDelete
        }
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      // Delete from storage if file exists
      if (material?.file_path) {
        const bucketName = material.file_path.includes('study-materials') ? 'study-materials' : 'materials';
        await supabase.storage
          .from(bucketName)
          .remove([material.file_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', materialId);

      if (error) throw error;

      showSuccess('Material deleted successfully');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to delete material');
    } finally {
      setDeleting(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type?.includes('video')) return 'videocam';
    if (type?.includes('image')) return 'image';
    if (type?.includes('pdf')) return 'document-text';
    return 'document';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!material) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Material not found</Text>
      </SafeAreaView>
    );
  }

  const canDelete = user?.role === 'admin' || user?.role === 'teacher' || user?.id === material?.uploaded_by;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Material Details</Text>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash" size={24} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        <Card style={styles.materialCard}>
          <View style={styles.materialHeader}>
            <View style={styles.fileIcon}>
              <Ionicons 
                name={getFileIcon(material.material_type)} 
                size={32} 
                color={Colors.primary} 
              />
            </View>
            <View style={styles.materialInfo}>
              <Text style={styles.materialTitle}>{material.title}</Text>
              <Text style={styles.materialSubject}>{material.subject}</Text>
              {material.grade_level && (
                <Text style={styles.gradeLevel}>{material.grade_level}</Text>
              )}
            </View>
          </View>

          {material.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{material.description}</Text>
            </View>
          )}

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Details</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="person" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>
                Uploaded by: {material.uploaded_by_user?.name || 'Unknown'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>
                Created: {new Date(material.created_at).toLocaleDateString()}
              </Text>
            </View>

            {material.file_size && (
              <View style={styles.detailRow}>
                <Ionicons name="document" size={16} color={Colors.text.secondary} />
                <Text style={styles.detailText}>
                  File size: {formatFileSize(material.file_size)}
                </Text>
              </View>
            )}

            {material.file_name && (
              <View style={styles.detailRow}>
                <Ionicons name="attach" size={16} color={Colors.text.secondary} />
                <Text style={styles.detailText}>
                  File: {material.file_name}
                </Text>
              </View>
            )}
          </View>

          {material.file_url && (
            <Button
              title="Download Material"
              onPress={handleDownload}
              icon="download"
              style={styles.downloadButton}
            />
          )}

          {canDelete && (
            <Button
              title="Delete Material"
              onPress={handleDelete}
              loading={deleting}
              variant="danger"
              icon="trash"
              style={styles.deleteButton}
            />
          )}
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
  materialCard: {
    marginBottom: Spacing.lg,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  fileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  materialSubject: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  gradeLevel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  descriptionSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  detailsSection: {
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  downloadButton: {
    marginBottom: Spacing.md,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
});