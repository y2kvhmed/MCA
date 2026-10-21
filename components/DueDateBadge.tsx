import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface DueDateBadgeProps {
  dueDate: string | Date;
  size?: 'small' | 'medium' | 'large';
}

export default function DueDateBadge({ dueDate, size = 'medium' }: DueDateBadgeProps) {
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  
  // Calculate time difference
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  
  let badgeText = '';
  let badgeColor = Colors.text.secondary;
  let backgroundColor = Colors.background;
  let iconName: any = 'time-outline';
  
  if (diffTime < 0) {
    // Overdue
    badgeText = 'Overdue';
    badgeColor = Colors.error;
    backgroundColor = Colors.error + '20';
    iconName = 'alert-circle';
  } else if (diffDays === 0) {
    // Due today
    badgeText = 'Due Today';
    badgeColor = Colors.warning;
    backgroundColor = Colors.warning + '20';
    iconName = 'today';
  } else if (diffDays === 1) {
    // Due tomorrow
    badgeText = 'Due Tomorrow';
    badgeColor = Colors.info;
    backgroundColor = Colors.info + '20';
    iconName = 'calendar';
  } else if (diffDays <= 3) {
    // Due soon (within 3 days)
    badgeText = `Due in ${diffDays} days`;
    badgeColor = Colors.info;
    backgroundColor = Colors.info + '20';
    iconName = 'calendar';
  } else if (diffDays <= 7) {
    // Due this week
    badgeText = `Due in ${diffDays} days`;
    badgeColor = Colors.success;
    backgroundColor = Colors.success + '20';
    iconName = 'calendar';
  } else {
    // Due later
    badgeText = date.toLocaleDateString();
    badgeColor = Colors.text.secondary;
    backgroundColor = Colors.background;
    iconName = 'calendar-outline';
  }
  
  const sizeStyles = {
    small: { fontSize: 10, iconSize: 12, padding: 4 },
    medium: { fontSize: 12, iconSize: 14, padding: 6 },
    large: { fontSize: 14, iconSize: 16, padding: 8 },
  };
  
  const currentSize = sizeStyles[size];
  
  return (
    <View style={[styles.badge, { backgroundColor, padding: currentSize.padding }]}>
      <Ionicons name={iconName} size={currentSize.iconSize} color={badgeColor} />
      <Text style={[styles.badgeText, { color: badgeColor, fontSize: currentSize.fontSize }]}>
        {badgeText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  badgeText: {
    fontWeight: '600',
  },
});
