import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { getSchools, getAllClasses } from '../lib/database';
import { sendCustomEmail, getUserEmails } from '../lib/emailService';
import { handleError, showSuccess } from '../lib/utils';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function ComposeEmail() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [recipient, setRecipient] = useState<'school' | 'class' | 'role' | 'custom'>('school');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRole, setSelectedRole] = useState('student');
  const [customEmails, setCustomEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.role === 'admin' || currentUser?.role === 'teacher') {
        const [schoolsResult, classesResult] = await Promise.all([
          getSchools(),
          getAllClasses()
        ]);

        if (schoolsResult.data) setSchools(schoolsResult.data);
        if (classesResult.data) setClasses(classesResult.data);
      }
    } catch (error) {
      handleError(error, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      handleError(null, 'Subject and message are required');
      return;
    }

    setSending(true);
    try {
      let emails: string[] = [];

      switch (recipient) {
        case 'school':
          if (!selectedSchool) {
            handleError(null, 'Please select a school');
            return;
          }
          emails = await getUserEmails({ schoolId: selectedSchool });
          break;

        case 'class':
          if (!selectedClass) {
            handleError(null, 'Please select a class');
            return;
          }
          emails = await getUserEmails({ classId: selectedClass });
          break;

        case 'role':
          emails = await getUserEmails({ role: selectedRole });
          break;

        case 'custom':
          if (!customEmails.trim()) {
            handleError(null, 'Please enter email addresses');
            return;
          }
          emails = customEmails.split(',').map(email => email.trim()).filter(email => email);
          break;
      }

      if (emails.length === 0) {
        handleError(null, 'No email addresses found for the selected criteria');
        return;
      }

      const result = await sendCustomEmail(emails, subject, message);
      
      if (result.success) {
        showSuccess(`Email sent to ${emails.length} recipient(s)`);
        router.back();
      } else {
        handleError(result.error, 'Failed to send email');
      }
    } catch (error) {
      handleError(error, 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user?.role !== 'admin' && user?.role !== 'teacher') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Access Denied</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>Only administrators and teachers can send emails.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compose Email</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Recipients</Text>
        
        <View style={styles.recipientSelector}>
          {['school', 'class', 'role', 'custom'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.recipientButton,
                recipient === type && styles.recipientButtonSelected,
              ]}
              onPress={() => setRecipient(type as any)}
            >
              <Text
                style={[
                  styles.recipientButtonText,
                  recipient === type && styles.recipientButtonTextSelected,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {recipient === 'school' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>Select School</Text>
            {schools.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[
                  styles.optionButton,
                  selectedSchool === school.id && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedSchool(school.id)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedSchool === school.id && styles.optionButtonTextSelected,
                  ]}
                >
                  {school.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recipient === 'class' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>Select Class</Text>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.optionButton,
                  selectedClass === cls.id && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedClass(cls.id)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedClass === cls.id && styles.optionButtonTextSelected,
                  ]}
                >
                  {cls.name} {cls.school && `(${cls.school.name})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recipient === 'role' && (
          <View style={styles.selectorContainer}>
            <Text style={styles.label}>Select Role</Text>
            {['student', 'teacher', 'admin'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.optionButton,
                  selectedRole === role && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedRole === role && styles.optionButtonTextSelected,
                  ]}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recipient === 'custom' && (
          <Input
            label="Email Addresses (comma separated)"
            value={customEmails}
            onChangeText={setCustomEmails}
            placeholder="email1@example.com, email2@example.com"
            multiline
            numberOfLines={3}
          />
        )}

        <Input
          label="Subject *"
          value={subject}
          onChangeText={setSubject}
          placeholder="Enter email subject"
        />

        <Input
          label="Message *"
          value={message}
          onChangeText={setMessage}
          placeholder="Enter your message"
          multiline
          numberOfLines={6}
        />

        <Button
          title="Send Email"
          onPress={handleSendEmail}
          loading={sending}
          disabled={sending}
          style={styles.sendButton}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  recipientSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  recipientButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
  },
  recipientButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  recipientButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  recipientButtonTextSelected: {
    color: Colors.text.inverse,
  },
  selectorContainer: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  optionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.card.background,
    marginBottom: Spacing.sm,
  },
  optionButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  optionButtonTextSelected: {
    color: Colors.text.inverse,
  },
  sendButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing.xxxl,
  },
});