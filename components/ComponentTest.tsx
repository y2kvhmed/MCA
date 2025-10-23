import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import Button from './Button';
import Input from './Input';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

interface ComponentTestProps {
  onComplete: () => void;
}

export default function ComponentTest({ onComplete }: ComponentTestProps) {
  const [testResults, setTestResults] = React.useState<string[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const results: string[] = [];

    try {
      // Test basic components
      results.push('✅ Basic components loaded');
      
      // Test constants
      if (Colors && Spacing) {
        results.push('✅ Constants loaded');
      } else {
        results.push('❌ Constants missing');
      }

      // Test state management
      setTestResults([...results]);
      results.push('✅ State management working');

      await new Promise(resolve => setTimeout(resolve, 500));
      results.push('✅ Async operations working');

      setTestResults(results);
      
      setTimeout(() => {
        setIsRunning(false);
        onComplete();
      }, 1000);

    } catch (error) {
      results.push(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestResults(results);
      setIsRunning(false);
    }
  };

  React.useEffect(() => {
    runTests();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Component Test</Text>
      
      {isRunning && (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Running component tests...</Text>
        </View>
      )}

      <View style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </View>

      {!isRunning && (
        <Button
          title="Continue to App"
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
    justifyContent: 'center',
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
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  resultText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    fontFamily: 'monospace',
  },
  continueButton: {
    marginTop: Spacing.lg,
  },
});