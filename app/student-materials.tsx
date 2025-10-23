import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getMaterialsForStudentFixed } from '../lib/database';
import { formatRelativeDate, formatFileSize, handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function StudentMaterials() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Load materials for this student
      const { data: materialsData, error } = await getMaterialsForStudentFixed(currentUser.id);
      if (error) {
        console.error('Materials error:', error);
        handleError(error, 'Failed to load materials');
      } else {
        console.log('Loaded materials:', materialsData?.length || 0);
        setMaterials(materialsData || []);
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load materials');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDownload = async (material: any) => {
    try {
      if (material.file_url) {
        await Linking.openURL(material.file_url);
      } else {
        handleError(null, 'Download link not available');
      }
    } catch (error) {
      console.error('Download error:', error);
      handleError(error, 'Failed to download material');
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return 'document-text';
      case 'video':
        return 'play-circle';
      case 'image':
        return 'image';
      case 'audio':
        return 'musical-notes';
      default:
        return 'document';
    }
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
        <Text style={styles.headerTitle}>Study Materials</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {materials.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="No Materials Available"
            description="Your teachers haven't uploaded any study materials yet. Check back later!"
          />
        ) : (
          materials.map((material) => (
            <Card key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <View style={styles.materialIcon}>
                  <Ionicons 
                    name={getMaterialIcon(material.material_type)} 
                    size={24} 
                    color={Colors.primary} 
                  />
                </View>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialTitle}>{material.title}</Text>
                  <Text style={styles.materialDescription}>
                    {material.description || 'No description available'}
                  </Text>
                  <View style={styles.materialMeta}>
                    <Text style={styles.materialTeacher}>
                      By: {material.uploaded_by_user?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.materialDate}>
                      {formatRelativeDate(material.created_at)}
                    </Text>
                  </View>
                  {material.file_size && (
                    <Text style={styles.materialSize}>
                      Size: {formatFileSize(material.file_size)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownload(material)}
                >
                  <Ionicons name="download" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
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
    marginBottom: Spacing.md,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
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
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  materialTeacher: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  materialDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  materialSize: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  downloadButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
  },
});