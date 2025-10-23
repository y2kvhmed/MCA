import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import PendulumLoader from './PendulumLoader';

interface LoadingSkeletonProps {
  height?: number;
  width?: number | string;
  borderRadius?: number;
  style?: any;
  variant?: 'shimmer' | 'pendulum' | 'pulse';
}

export function SkeletonLine({ 
  height = 20, 
  width = '100%', 
  borderRadius = 4, 
  style, 
  variant = 'shimmer' 
}: LoadingSkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant === 'pendulum') return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: variant === 'pulse' ? 800 : 1200,
          useNativeDriver: variant === 'pulse',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: variant === 'pulse' ? 800 : 1200,
          useNativeDriver: variant === 'pulse',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [variant]);

  if (variant === 'pendulum') {
    return (
      <View style={[styles.pendulumContainer, { height, width }, style]}>
        <PendulumLoader size={Math.min(height * 0.8, 40)} />
      </View>
    );
  }

  const animatedStyle = variant === 'pulse' 
    ? {
        opacity: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        }),
        backgroundColor: Colors.border.medium,
      }
    : {
        backgroundColor: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.border.light, Colors.border.medium],
        }),
      };

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ variant = 'shimmer' }: { variant?: 'shimmer' | 'pendulum' | 'pulse' }) {
  if (variant === 'pendulum') {
    return (
      <View style={styles.card}>
        <View style={styles.pendulumCardContainer}>
          <PendulumLoader size={60} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLine height={40} width={40} borderRadius={20} variant={variant} />
        <View style={styles.cardContent}>
          <SkeletonLine height={16} width="70%" variant={variant} />
          <SkeletonLine height={12} width="50%" style={{ marginTop: 8 }} variant={variant} />
        </View>
      </View>
      <SkeletonLine height={12} width="90%" style={{ marginTop: 16 }} variant={variant} />
      <SkeletonLine height={12} width="60%" style={{ marginTop: 8 }} variant={variant} />
    </View>
  );
}

export function SkeletonList({ 
  count = 5, 
  variant = 'shimmer' 
}: { 
  count?: number; 
  variant?: 'shimmer' | 'pendulum' | 'pulse' 
}) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} variant={variant} />
      ))}
    </View>
  );
}

// New specialized skeleton components
export function PendulumPageLoader() {
  return (
    <View style={styles.pageLoader}>
      <PendulumLoader size={80} />
    </View>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, variant = 'shimmer' }: {
  rows?: number;
  columns?: number;
  variant?: 'shimmer' | 'pendulum' | 'pulse';
}) {
  return (
    <View style={styles.table}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLine
              key={colIndex}
              height={16}
              width={`${90 / columns}%`}
              variant={variant}
              style={styles.tableCell}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  pendulumContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendulumCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  pageLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    minHeight: 200,
  },
  table: {
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  tableCell: {
    marginHorizontal: Spacing.xs,
  },
});