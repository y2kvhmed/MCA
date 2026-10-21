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
      Alert.alert('Error', 'Please enter a school name');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await createSchool({
        name: name.trim(),
        description: description.trim()
      });

      if (error) {
        handleError(error);
        return;
      }

      showSuccess('School created successfully!');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/view-schools');
      }
    } catch (error) {
      handleError('Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/view-schools')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Create School</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          placeholder="Enter school description (optional)"
          multiline
          numberOfLines={3}
        />

        <Button
          title="Create School"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || !name.trim()}
          style={styles.submitButton}
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
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    marginRight: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  submitButton: {
    marginTop: Spacing.xl,
  },
});

