import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getCalendarEvents, createCalendarEvent, getAssignmentsByStudent } from '../lib/database';
import { formatDate, handleError, showSuccess } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import AnimatedCard from '../components/AnimatedCard';
import FadeInView from '../components/FadeInView';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { Spacing } from '../constants/Styles';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type: 'assignment' | 'exam' | 'class' | 'personal' | 'school';
  is_editable: boolean;
  color: string;
}

export default function Calendar() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);
      await loadEvents(currentUser);
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (currentUser: any) => {
    try {
      const allEvents: CalendarEvent[] = [];

      // Load assignments as events (for students)
      if (currentUser.role === 'student') {
        const { data: assignments } = await getAssignmentsByStudent(currentUser.id);
        if (assignments) {
          const assignmentEvents = assignments
            .filter((a: any) => a.due_date)
            .map((assignment: any) => ({
              id: `assignment-${assignment.id}`,
              title: assignment.title,
              description: `Due: ${assignment.class?.name}`,
              date: assignment.due_date,
              type: 'assignment' as const,
              is_editable: false,
              color: colors.warning,
            }));
          allEvents.push(...assignmentEvents);
        }
      }

      // Load personal calendar events
      const { data: personalEvents } = await getCalendarEvents(currentUser.id);
      if (personalEvents) {
        const personalCalendarEvents = personalEvents.map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          type: event.type,
          is_editable: event.created_by === currentUser.id,
          color: getEventColor(event.type),
        }));
        allEvents.push(...personalCalendarEvents);
      }

      // Sort events by date
      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error('Load events error:', error);
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'assignment': return colors.warning;
      case 'exam': return colors.error;
      case 'class': return colors.primary;
      case 'school': return colors.info;
      case 'personal': return colors.success;
      default: return colors.text.secondary;
    }
  };

  const addPersonalEvent = async () => {
    if (!newEventTitle.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    setAdding(true);
    try {
      const eventData = {
        title: newEventTitle.trim(),
        description: newEventDescription.trim() || null,
        date: selectedDate.toISOString().split('T')[0],
        time: newEventTime || null,
        type: 'personal',
        created_by: user.id,
        user_id: user.id,
      };

      const { error } = await createCalendarEvent(eventData);
      
      if (error) {
        handleError(error, 'Failed to add event');
      } else {
        showSuccess('Event added successfully');
        setNewEventTitle('');
        setNewEventDescription('');
        setNewEventTime('');
        setShowAddEvent(false);
        loadEvents(user);
      }
    } catch (error) {
      handleError(error, 'Failed to add event');
    } finally {
      setAdding(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.date.startsWith(dateString));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelectedDate = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const styles = createStyles(colors);

  if (loading) {
    return <LoadingSpinner />;
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth(selectedDate);
  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      <FadeInView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <TouchableOpacity onPress={() => setShowAddEvent(true)}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </FadeInView>

      <ScrollView style={styles.content}>
        {/* Month Navigation */}
        <AnimatedCard style={styles.monthCard} delay={100}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
            >
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Day Names */}
          <View style={styles.dayNamesRow}>
            {dayNames.map(day => (
              <Text key={day} style={styles.dayName}>{day}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              if (day === null) {
                return <View key={index} style={styles.emptyDay} />;
              }

              const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
              const dayEvents = getEventsForDate(date);
              const isCurrentDay = isToday(date);
              const isSelected = isSelectedDate(date);

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    isCurrentDay && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[
                    styles.dayNumber,
                    isCurrentDay && styles.todayText,
                    isSelected && styles.selectedText,
                  ]}>
                    {day}
                  </Text>
                  {dayEvents.length > 0 && (
                    <View style={styles.eventDots}>
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <View
                          key={i}
                          style={[styles.eventDot, { backgroundColor: event.color }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </AnimatedCard>

        {/* Selected Date Events */}
        <AnimatedCard style={styles.eventsCard} delay={200}>
          <Text style={styles.sectionTitle}>
            Events for {formatDate(selectedDate.toISOString())}
          </Text>
          
          {selectedDateEvents.length === 0 ? (
            <Text style={styles.noEventsText}>No events for this date</Text>
          ) : (
            selectedDateEvents.map((event, index) => (
              <View key={event.id} style={styles.eventItem}>
                <View style={[styles.eventColorBar, { backgroundColor: event.color }]} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.description && (
                    <Text style={styles.eventDescription}>{event.description}</Text>
                  )}
                  {event.time && (
                    <Text style={styles.eventTime}>{event.time}</Text>
                  )}
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventType}>{event.type.toUpperCase()}</Text>
                    {!event.is_editable && (
                      <Ionicons name="lock-closed" size={12} color={colors.text.tertiary} />
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </AnimatedCard>

        {/* Add Event Modal */}
        {showAddEvent && (
          <AnimatedCard style={styles.addEventCard} delay={300}>
            <Text style={styles.sectionTitle}>Add Personal Event</Text>
            
            <Input
              label="Event Title"
              value={newEventTitle}
              onChangeText={setNewEventTitle}
              placeholder="Enter event title"
            />
            
            <Input
              label="Description (Optional)"
              value={newEventDescription}
              onChangeText={setNewEventDescription}
              placeholder="Enter description"
              multiline
              numberOfLines={3}
            />
            
            <Input
              label="Time (Optional)"
              value={newEventTime}
              onChangeText={setNewEventTime}
              placeholder="e.g., 2:00 PM"
            />

            <View style={styles.addEventButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowAddEvent(false)}
                style={[styles.button, styles.cancelButton]}
              />
              <Button
                title="Add Event"
                onPress={addPersonalEvent}
                loading={adding}
                disabled={adding}
                style={[styles.button, styles.addButton]}
              />
            </View>
          </AnimatedCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: colors.card.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  monthCard: {
    marginBottom: Spacing.lg,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    paddingVertical: Spacing.sm,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyDay: {
    width: '14.28%',
    height: 50,
  },
  dayCell: {
    width: '14.28%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  todayCell: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  selectedCell: {
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 14,
    color: colors.text.primary,
  },
  todayText: {
    color: colors.text.inverse,
    fontWeight: 'bold',
  },
  selectedText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  eventDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: Spacing.lg,
  },
  noEventsText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  eventItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.md,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  eventDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  eventTime: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  eventType: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  addEventCard: {
    marginBottom: Spacing.xl,
  },
  addEventButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: colors.text.tertiary,
  },
  addButton: {
    backgroundColor: colors.primary,
  },
});