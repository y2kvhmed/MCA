import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createSchool } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function CreateSchool() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'School name is required');
      return;
    }

    setLoading(true);
    try {
      const { error } = await createSchool(name, description);
      
      if (error) {
        handleError(error, 'Failed to create school');
      } else {
        showSuccess('School created successfully');
        router.back();
      }
    } catch (error) {
      handleError(error, 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create School</Text>
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
          title="Create School"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
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
});
