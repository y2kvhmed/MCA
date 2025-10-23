import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface DateTimePickerProps {
  label?: string;
  value?: Date | null;
  onChange: (date: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  placeholder?: string;
  required?: boolean;
}

export default function DateTimePicker({
  label,
  value,
  onChange,
  mode = 'datetime',
  placeholder = 'e.g., 18/10 6:00 or Dec 25 2:30 PM',
  required = false,
}: DateTimePickerProps) {
  const [inputText, setInputText] = useState('');

  const formatDateTime = (date: Date) => {
    if (!date) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${day}/${month} ${displayHours}:${minutes} ${ampm}`;
  };

  const parseDateTime = (text: string): Date | null => {
    if (!text.trim() || text.trim().length < 4) return null; // Don't parse very short inputs
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Clean the input
    const cleanText = text.trim().toLowerCase();
    
    try {
      // Pattern 1: DD/MM HH:MM or DD/MM H:MM (must have time)
      const pattern1 = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i;
      const match1 = cleanText.match(pattern1);
      
      if (match1) {
        const day = parseInt(match1[1]);
        const month = parseInt(match1[2]) - 1; // JS months are 0-indexed
        let hours = parseInt(match1[3]);
        const minutes = parseInt(match1[4]);
        const ampm = match1[5];
        
        // Validate ranges
        if (day < 1 || day > 31 || month < 0 || month > 11 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return null;
        }
        
        // Handle AM/PM
        if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours !== 12) {
            hours += 12;
          } else if (ampm.toLowerCase() === 'am' && hours === 12) {
            hours = 0;
          }
        }
        
        const date = new Date(currentYear, month, day, hours, minutes);
        
        // If the date is in the past, assume next year
        if (date < now) {
          date.setFullYear(currentYear + 1);
        }
        
        return date;
      }
      
      // Pattern 2: Only try more complex parsing for longer inputs
      if (text.length > 8) {
        const date = new Date(text);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
          return date;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    
    // Only try to parse and update if the text looks complete enough
    if (text.trim() === '') {
      onChange(null);
    } else {
      // Don't auto-parse while typing, only when it looks complete
      const parsedDate = parseDateTime(text);
      if (parsedDate) {
        onChange(parsedDate);
      }
    }
  };

  const handleBlur = () => {
    // Try to parse when user finishes typing (on blur)
    const parsedDate = parseDateTime(inputText);
    if (parsedDate) {
      onChange(parsedDate);
    }
  };

  // Prevent feedback loop - only update input text if it's different from current
  React.useEffect(() => {
    if (value && !inputText) {
      // Only set formatted text if input is empty (to avoid overriding user input)
      setInputText(formatDateTime(value));
    } else if (!value && inputText) {
      // Clear input if value is cleared externally
      setInputText('');
    }
  }, [value]);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.tertiary}
        />
        <Ionicons name="calendar" size={20} color={Colors.text.secondary} />
      </View>
      
      {value && (
        <Text style={styles.parsedDate}>
          Parsed as: {value.toLocaleString()}
        </Text>
      )}
      
      <Text style={styles.helpText}>
        Examples: "18/10 6:00", "25/12 14:30", "Dec 25 2:30 PM"
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    backgroundColor: Colors.card.background,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  parsedDate: {
    fontSize: 12,
    color: Colors.success,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
});