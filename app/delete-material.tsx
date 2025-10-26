import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function DeleteMaterial() {
  const router = useRouter();
  const { materialId } = useLocalSearchParams();
  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const { data: materialData, error } = await supabase
        .from('study_materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (error) throw error;
      setMaterial(materialData);

    } catch (error) {
      handleError(error, 'Failed to load material');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
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
      // Delete file from storage if exists
      if (material?.file_path) {
        // Try multiple bucket names
        const buckets = ['study-materials', 'materials'];
        for (const bucketName of buckets) {
          try {
            const { error: storageError } = await supabase.storage
              .from(bucketName)
              .remove([material.file_path]);
            
            if (!storageError) {
              console.log(`File deleted from ${bucketName}`);
              break;
            }
          } catch (e) {
            console.warn(`Failed to delete from ${bucketName}:`, e);
          }
        }
      }

      // Delete the material from database
      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', materialId);

      if (error) throw error;

      showSuccess('Material deleted successfully');
      
      // Navigate back after a short delay
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Delete error:', error);
      handleError(error, 'Failed to delete material');
      setDeleting(false);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Material</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={48} color={Colors.error} />
          <Text style={styles.warningTitle}>Delete Material</Text>
          <Text style={styles.warningText}>
            You are about to delete the material "{material.title}".
          </Text>
        </View>

        <View style={styles.impactContainer}>
          <Text style={styles.impactTitle}>This will permanently remove:</Text>
          <View style={styles.impactItem}>
            <Ionicons name="document" size={20} color={Colors.text.secondary} />
            <Text style={styles.impactText}>The material and its description</Text>
          </View>
          {material.file_path && (
            <View style={styles.impactItem}>
              <Ionicons name="attach" size={20} color={Colors.text.secondary} />
              <Text style={styles.impactText}>The attached file</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="outline"
            style={styles.cancelButton}
          />
          <Button
            title="Delete Material"
            onPress={handleDelete}
            loading={deleting}
            disabled={deleting}
            style={styles.deleteButton}
          />
        </View>
      </View>
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
    justifyContent: 'center',
  },
  warningContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.error,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  warningText: {
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
  },
  impactContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  impactText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
  },
});