import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/utils';
import AnimatedCard from '../components/AnimatedCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import RoleProtection from '../components/RoleProtection';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function AdminChats() {
  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        router.replace('/');
        return;
      }

      // Load all schools with message counts
      const { data: schoolsData, error } = await supabase
        .from('schools')
        .select('id, name, description')
        .order('name');

      if (error) throw error;

      // Get message counts for each school
      const schoolsWithCounts = await Promise.all(
        (schoolsData || []).map(async (school) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id);

          return {
            ...school,
            messageCount: count || 0,
          };
        })
      );

      setSchools(schoolsWithCounts);
    } catch (error) {
      handleError(error, 'Failed to load schools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <RoleProtection allowedRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>School Chats</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {schools.length === 0 ? (
            <EmptyState icon="chatbubbles" message="No schools found" />
          ) : (
            schools.map((school, index) => (
              <AnimatedCard key={school.id} delay={50 * (index + 1)} style={styles.schoolCard}>
                <TouchableOpacity
                  style={styles.schoolContent}
                  onPress={() => router.push(`/school-chat?schoolId=${school.id}&schoolName=${encodeURIComponent(school.name)}`)}
                >
                  <View style={styles.schoolIcon}>
                    <Ionicons name="school" size={28} color={Colors.primary} />
                  </View>
                  <View style={styles.schoolInfo}>
                    <Text style={styles.schoolName}>{school.name}</Text>
                    <Text style={styles.schoolDescription}>
                      {school.description || 'No description'}
                    </Text>
                    <Text style={styles.messageCount}>
                      {school.messageCount} messages
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={Colors.text.tertiary} />
                </TouchableOpacity>
              </AnimatedCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </RoleProtection>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, backgroundColor: Colors.card.background,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text.primary },
  content: { flex: 1, padding: Spacing.lg },
  schoolCard: { marginBottom: Spacing.md },
  schoolContent: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  schoolIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 18, fontWeight: '600', color: Colors.text.primary },
  schoolDescription: { fontSize: 14, color: Colors.text.secondary, marginTop: 2 },
  messageCount: { fontSize: 12, color: Colors.text.tertiary, marginTop: 4 },
});
