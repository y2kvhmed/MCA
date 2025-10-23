import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { getCurrentUser } from '../lib/auth';
import { getSchoolStats, getStudentStats, getAdminStats } from '../lib/database';

interface DashboardTestProps {
  onComplete: () => void;
}

export default function DashboardTest({ onComplete }: DashboardTestProps) {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDashboardTests = async () => {
    setIsRunning(true);
    const results: string[] = [];

    try {
      results.push('🧪 Starting dashboard tests...');
      setTestResults([...results]);

      // Test user authentication
      const user = await getCurrentUser();
      if (user) {
        results.push(`✅ User authenticated: ${user.name} (${user.role})`);
      } else {
        results.push('❌ No user found');
      }
      setTestResults([...results]);

      // Test dashboard functions based on user role
      if (user) {
        switch (user.role) {
          case 'admin':
            try {
              const adminStats = await getAdminStats();
              results.push(`✅ Admin stats loaded: ${JSON.stringify(adminStats)}`);
            } catch (error) {
              results.push(`❌ Admin stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'teacher':
            if (user.school_id) {
              try {
                const schoolStats = await getSchoolStats(user.school_id);
                results.push(`✅ School stats loaded: ${JSON.stringify(schoolStats)}`);
              } catch (error) {
                results.push(`❌ School stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            } else {
              results.push('⚠️ Teacher has no school assigned');
            }
            break;

          case 'student':
            try {
              const studentStats = await getStudentStats(user.id);
              results.push(`✅ Student stats loaded: ${JSON.stringify(studentStats)}`);
            } catch (error) {
              results.push(`❌ Student stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          default:
            results.push(`⚠️ Unknown user role: ${user.role}`);
        }
      }

      setTestResults([...results]);
      results.push('🎉 Dashboard tests completed');
      setTestResults(results);

    } catch (error) {
      results.push(`❌ Dashboard test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestResults(results);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDashboardTests();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard Test</Text>
      
      {isRunning && (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Testing dashboard components...</Text>
        </View>
      )}

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </ScrollView>

      {!isRunning && (
        <Button
          title="Continue to Dashboard"
          onPress={onComplete}
          style={styles.continueButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  resultText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  continueButton: {
    marginTop: Spacing.lg,
  },
});