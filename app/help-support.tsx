import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { handleError, showSuccess } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function HelpSupport() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const helpCategories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: 'rocket',
      color: Colors.primary,
      items: [
        'How to create your first assignment',
        'Setting up your profile',
        'Understanding user roles',
        'Navigating the dashboard',
        'Basic app features overview'
      ]
    },
    {
      id: 'assignments',
      title: 'Assignments & Grading',
      icon: 'document-text',
      color: Colors.info,
      items: [
        'Creating and editing assignments',
        'Setting due dates and scoring',
        'Grading student submissions',
        'Providing feedback to students',
        'Managing assignment files'
      ]
    },
    {
      id: 'students',
      title: 'Student Management',
      icon: 'people',
      color: Colors.success,
      items: [
        'Adding and managing students',
        'Viewing student progress',

        'Parent communication',
        'Student performance reports'
      ]
    },
    {
      id: 'materials',
      title: 'Study Materials',
      icon: 'folder',
      color: Colors.warning,
      items: [
        'Uploading study materials',
        'Organizing course content',
        'Sharing resources with students',
        'Managing file permissions',
        'Video and multimedia content'
      ]
    },
    {
      id: 'technical',
      title: 'Technical Issues',
      icon: 'settings',
      color: Colors.error,
      items: [
        'Login and authentication problems',
        'File upload issues',
        'App performance problems',
        'Browser compatibility',
        'Mobile app troubleshooting'
      ]
    },
    {
      id: 'account',
      title: 'Account & Settings',
      icon: 'person',
      color: Colors.text.secondary,
      items: [
        'Changing password',
        'Updating profile information',
        'Notification settings',
        'Privacy and security',
        'Account deactivation'
      ]
    }
  ];

  const quickActions = [
    {
      title: 'Contact Support',
      description: 'Get help from our support team',
      icon: 'mail',
      action: () => {
        Linking.openURL('mailto:support@physicslearning.com?subject=Support Request');
      }
    },
    {
      title: 'Video Tutorials',
      description: 'Watch step-by-step guides',
      icon: 'play-circle',
      action: () => {
        Alert.alert('Coming Soon', 'Video tutorials will be available soon!');
      }
    },
    {
      title: 'User Manual',
      description: 'Download the complete guide',
      icon: 'document',
      action: () => {
        Alert.alert('User Manual', 'The user manual will be available for download soon.');
      }
    },
    {
      title: 'Report a Bug',
      description: 'Help us improve the app',
      icon: 'bug',
      action: () => {
        setSelectedCategory('feedback');
      }
    }
  ];

  const faqItems = [
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login screen and tap "Forgot Password". Enter your email address and follow the instructions sent to your email.'
    },
    {
      question: 'Can students submit assignments after the due date?',
      answer: 'Yes, students can submit assignments after the due date, but they will be marked as late. Teachers can see how many days late each submission is.'
    },
    {
      question: 'How do I add students to my class?',
      answer: 'Go to Class Management, select your class, and use the "Add Students" button. You can add students individually or import from a CSV file.'
    },
    {
      question: 'What file types are supported for assignments?',
      answer: 'We support PDF, DOC, DOCX, JPG, PNG, and most common file formats. Maximum file size is 50MB per file.'
    },
    {
      question: 'How do I export grades?',
      answer: 'Go to the Gradebook, select the assignments you want to export, and click the "Export" button. You can download grades as a CSV file.'
    },
    {
      question: 'Can parents see their child\'s grades?',
      answer: 'Currently, parents need to check with their child directly. Parent portal access is planned for a future update.'
    }
  ];

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please enter your feedback before submitting.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const user = await getCurrentUser();
      
      // In a real app, you would send this to your support system
      console.log('Feedback submitted:', {
        user: user?.name,
        email: user?.email,
        feedback: feedbackText,
        timestamp: new Date().toISOString()
      });

      showSuccess('Thank you for your feedback! We\'ll review it and get back to you if needed.');
      setFeedbackText('');
      setSelectedCategory(null);
    } catch (error) {
      handleError(error, 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {selectedCategory === 'feedback' ? (
          // Feedback Form
          <Card style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Ionicons name="arrow-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.feedbackTitle}>Send Feedback</Text>
            </View>
            
            <Text style={styles.feedbackDescription}>
              Help us improve the app by sharing your thoughts, reporting bugs, or suggesting new features.
            </Text>
            
            <Input
              label="Your Feedback"
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Describe your issue, suggestion, or feedback..."
              multiline
              numberOfLines={6}
              style={styles.feedbackInput}
            />
            
            <View style={styles.feedbackActions}>
              <Button
                title="Cancel"
                onPress={() => setSelectedCategory(null)}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title="Submit Feedback"
                onPress={submitFeedback}
                loading={submittingFeedback}
                style={styles.submitButton}
              />
            </View>
          </Card>
        ) : selectedCategory ? (
          // Category Details
          <Card style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Ionicons name="arrow-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.categoryTitle}>
                {helpCategories.find(c => c.id === selectedCategory)?.title}
              </Text>
            </View>
            
            <View style={styles.categoryContent}>
              {helpCategories.find(c => c.id === selectedCategory)?.items.map((item, index) => (
                <TouchableOpacity key={index} style={styles.helpItem}>
                  <Ionicons name="help-circle" size={20} color={Colors.primary} />
                  <Text style={styles.helpItemText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        ) : (
          // Main Help Screen
          <>
            {/* Quick Actions */}
            <Card style={styles.quickActionsCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                {quickActions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickActionItem}
                    onPress={action.action}
                  >
                    <Ionicons name={action.icon as any} size={24} color={Colors.primary} />
                    <Text style={styles.quickActionTitle}>{action.title}</Text>
                    <Text style={styles.quickActionDescription}>{action.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* Help Categories */}
            <Card style={styles.categoriesCard}>
              <Text style={styles.sectionTitle}>Browse Help Topics</Text>
              <View style={styles.categoriesGrid}>
                {helpCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryItem}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                      <Ionicons name={category.icon as any} size={24} color={category.color} />
                    </View>
                    <Text style={styles.categoryItemTitle}>{category.title}</Text>
                    <Text style={styles.categoryItemCount}>{category.items.length} topics</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* FAQ */}
            <Card style={styles.faqCard}>
              <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
              {faqItems.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                </View>
              ))}
            </Card>

            {/* Contact Information */}
            <Card style={styles.contactCard}>
              <Text style={styles.sectionTitle}>Still Need Help?</Text>
              <Text style={styles.contactDescription}>
                Our support team is here to help you with any questions or issues.
              </Text>
              
              <View style={styles.contactMethods}>
                <TouchableOpacity 
                  style={styles.contactMethod}
                  onPress={() => Linking.openURL('mailto:support@physicslearning.com')}
                >
                  <Ionicons name="mail" size={20} color={Colors.primary} />
                  <Text style={styles.contactMethodText}>support@physicslearning.com</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contactMethod}
                  onPress={() => Linking.openURL('tel:+1234567890')}
                >
                  <Ionicons name="call" size={20} color={Colors.success} />
                  <Text style={styles.contactMethodText}>+1 (234) 567-8900</Text>
                </TouchableOpacity>
                
                <View style={styles.contactMethod}>
                  <Ionicons name="time" size={20} color={Colors.info} />
                  <Text style={styles.contactMethodText}>Mon-Fri, 9 AM - 5 PM EST</Text>
                </View>
              </View>
            </Card>
          </>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  quickActionsCard: {
    marginBottom: Spacing.lg,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  quickActionDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  categoriesCard: {
    marginBottom: Spacing.lg,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  categoryItemCount: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  categoryCard: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  categoryContent: {
    gap: Spacing.sm,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  helpItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  faqCard: {
    marginBottom: Spacing.lg,
  },
  faqItem: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  contactCard: {
    marginBottom: Spacing.xl,
  },
  contactDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  contactMethods: {
    gap: Spacing.md,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  contactMethodText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  feedbackCard: {
    marginBottom: Spacing.lg,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  feedbackDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  feedbackInput: {
    marginBottom: Spacing.lg,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
});