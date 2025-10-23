import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function CreateMaterialSimple() {
  const router = useRouter();
  const { showSuccess } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: 'Physics',
    grade_level: '',
    file_url: '', // Manual URL input for now
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);
    } catch (error) {
      handleError(error, 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!user?.school_id) {
      Alert.alert('Error', 'No school assigned to user');
      return;
    }

    setSaving(true);
    try {
      const materialData = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        grade_level: formData.grade_level || null,
        school_id: user.school_id,
        teacher_id: user.id,
        file_url: formData.file_url || null,
        file_name: formData.file_url ? 'External Link' : null,
        file_size: null,
        file_type: 'link',
      };

      const { data, error } = await supabase
        .from('study_materials')
        .insert(materialData)
        .select()
        .single();

      if (error) throw error;

      showSuccess('Material created successfully!');
      router.back();
    } catch (error) {
      console.error('Save error:', error);
      handleError(error, 'Failed to create material');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Material (Simple)</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Input
          label="Title *"
          value={formData.title}
          onChangeText={(value) => setFormData(prev => ({ ...prev, title: value }))}
          placeholder="Enter material title"
        />

        <Input
          label="Description"
          value={formData.description}
          onChangeText={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Enter material description"
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        <Input
          label="Grade Level"
          value={formData.grade_level}
          onChangeText={(value) => setFormData(prev => ({ ...prev, grade_level: value }))}
          placeholder="e.g., Grade 9, Grade 10"
        />

        <Input
          label="File URL (Optional)"
          value={formData.file_url}
          onChangeText={(value) => setFormData(prev => ({ ...prev, file_url: value }))}
          placeholder="https://example.com/document.pdf"
          keyboardType="url"
          autoCapitalize="none"
        />

        <View style={styles.noteContainer}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.noteText}>
            This is a simplified version. You can add a link to an external file or document.
          </Text>
        </View>

        <Button
          title="Create Material"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.info + '10',
    padding: Spacing.md,
    borderRadius: 8,
    marginVertical: Spacing.md,
  },
  noteText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
});