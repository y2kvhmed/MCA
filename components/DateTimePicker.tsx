import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface DateTimePickerProps {
  label?: string;
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  required?: boolean;
}

export default function DateTimePicker({
  label = 'Due Date & Time',
  value,
  onChange,
  required = false,
}: DateTimePickerProps) {
  // Format dates for HTML date and time inputs: YYYY-MM-DD and HH:MM
  const getDatePart = (d: Date | null | undefined): string => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTimePart = (d: Date | null | undefined): string => {
    if (!d) return '23:59';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [dateStr, setDateStr] = useState<string>(getDatePart(value));
  const [timeStr, setTimeStr] = useState<string>(getTimePart(value));

  useEffect(() => {
    if (value) {
      setDateStr(getDatePart(value));
      setTimeStr(getTimePart(value));
    }
  }, [value]);

  const updateDateTime = (newDateStr: string, newTimeStr: string) => {
    if (!newDateStr) {
      onChange(null);
      return;
    }
    const [year, month, day] = newDateStr.split('-').map(Number);
    const [hours, minutes] = (newTimeStr || '23:59').split(':').map(Number);
    
    const combined = new Date(year, month - 1, day, hours || 0, minutes || 0);
    onChange(combined);
  };

  const handleDateChange = (newDate: string) => {
    setDateStr(newDate);
    updateDateTime(newDate, timeStr);
  };

  const handleTimeChange = (newTime: string) => {
    setTimeStr(newTime);
    updateDateTime(dateStr, newTime);
  };

  // Quick preset helpers
  const setPreset = (daysFromNow: number, hour: number = 23, minute: number = 59) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    target.setHours(hour, minute, 0, 0);

    const d = getDatePart(target);
    const t = getTimePart(target);
    setDateStr(d);
    setTimeStr(t);
    onChange(target);
  };

  const formattedDisplay = value ? (
    value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  ) : null;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      ) : null}

      {/* Inputs container */}
      <View style={styles.pickerRow}>
        {/* Date Chooser */}
        <View style={styles.pickerField}>
          <Text style={styles.fieldSubLabel}>Date</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={dateStr}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: Colors.text.primary,
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  padding: '10px 4px',
                  cursor: 'pointer',
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.mobilePicker}
                onPress={() => {
                  // Fallback for native
                  setPreset(1);
                }}
              >
                <Text style={styles.pickerText}>{dateStr || 'Select Date'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Time Chooser */}
        <View style={styles.pickerField}>
          <Text style={styles.fieldSubLabel}>Time</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
            {Platform.OS === 'web' ? (
              <input
                type="time"
                value={timeStr}
                onChange={(e) => handleTimeChange(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: Colors.text.primary,
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  padding: '10px 4px',
                  cursor: 'pointer',
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.mobilePicker}
                onPress={() => setPreset(0, 23, 59)}
              >
                <Text style={styles.pickerText}>{timeStr || 'Select Time'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Quick presets */}
      <View style={styles.presetRow}>
        <Text style={styles.presetLabel}>Quick Select:</Text>
        <TouchableOpacity style={styles.presetChip} onPress={() => setPreset(1, 23, 59)}>
          <Text style={styles.presetChipText}>Tomorrow 11:59 PM</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetChip} onPress={() => setPreset(3, 23, 59)}>
          <Text style={styles.presetChipText}>In 3 Days</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetChip} onPress={() => setPreset(7, 23, 59)}>
          <Text style={styles.presetChipText}>In 1 Week</Text>
        </TouchableOpacity>
      </View>

      {/* Display selected state */}
      {formattedDisplay && (
        <View style={styles.selectedBox}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.selectedText}>Due: {formattedDisplay}</Text>
          <TouchableOpacity onPress={() => { setDateStr(''); setTimeStr('23:59'); onChange(null); }}>
            <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  required: {
    color: Colors.error,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pickerField: {
    flex: 1,
  },
  fieldSubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
  },
  fieldIcon: {
    marginRight: 6,
  },
  mobilePicker: {
    flex: 1,
    paddingVertical: 10,
  },
  pickerText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  presetLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginRight: 2,
  },
  presetChip: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    marginTop: Spacing.sm,
  },
  selectedText: {
    flex: 1,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600',
  },
});