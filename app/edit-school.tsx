import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function EditSchool() {
  const router = useRouter();
  const { schoolId } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchool();
  }, []);

  const loadSchool = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

      if (error) throw error;

      setName(data.name);
      setDescription(data.description || '');
    } catch (error) {
      console.error('Load school error:', error);
      handleError(error, 'Failed to load school');
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
      const { error } = await supabase
        .from('schools')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', schoolId);

      if (error) throw error;

      showSuccess('School updated successfully');
      router.back();
    } catch (error) {
      handleError(error, 'Failed to update school');
    } finally {
      setSaving(false);
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
        <Text style={styles.headerTitle}>Edit School</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
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
          numberOfLines={4}
        />

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
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
  saveButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
});