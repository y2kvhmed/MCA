import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getSchools } from '../lib/database';
import { handleError } from '../lib/utils';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SchoolChooser() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      const { data } = await getSchools();
      if (data) setSchools(data);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  const selectSchool = (school: any) => {
    // Store selected school in user context or navigation params
    router.push(`/(tabs)/student-chat?schoolId=${school.id}&schoolName=${school.name}`);
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
        <Text style={styles.headerTitle}>Choose School</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.subtitle}>
          Select a school to access its chat groups
        </Text>

        {schools.length === 0 ? (
          <EmptyState
            icon="school"
            title="No Schools Available"
            description="No schools found in the system."
          />
        ) : (
          schools.map((school) => (
            <Card key={school.id} style={styles.schoolCard}>
              <TouchableOpacity
                style={styles.schoolButton}
                onPress={() => selectSchool(school)}
              >
                <View style={styles.schoolIcon}>
                  <Ionicons name="school" size={32} color={Colors.primary} />
                </View>
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>{school.name}</Text>
                  {school.description && (
                    <Text style={styles.schoolDescription}>{school.description}</Text>
                  )}
                  <Text style={styles.schoolMeta}>
                    Tap to access chat groups
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
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
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  schoolCard: {
    marginBottom: Spacing.md,
  },
  schoolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  schoolIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  schoolDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  schoolMeta: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
});