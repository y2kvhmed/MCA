import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { Recording, RecordingDependency } from '../lib/recordingService';
import Button from './Button';
import { PhysicsAnimations } from '../lib/animations';

interface RecordingDeleteDialogProps {
  visible: boolean;
  recording: Recording | null;
  dependencies?: RecordingDependency[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function RecordingDeleteDialog({
  visible,
  recording,
  dependencies = [],
  onConfirm,
  onCancel,
  isLoading = false,
}: RecordingDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const hasDependencies = dependencies.length > 0;
  const requiresConfirmation = hasDependencies;
  const isConfirmDisabled = requiresConfirmation && confirmText.toUpperCase() !== 'DELETE';

  useEffect(() => {
    if (visible) {
      // Physics-based entrance animation
      Animated.parallel([
        PhysicsAnimations.springBounce(scaleAnim, 1),
        PhysicsAnimations.fadeInPhysics(opacityAnim),
      ]).start();
    } else {
      // Reset state
      setConfirmText('');
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      shakeAnim.setValue(0);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (isConfirmDisabled) {
      // Shake animation for invalid confirmation
      PhysicsAnimations.shake(shakeAnim, 5).start();
      return;
    }

    try {
      await onConfirm();
    } catch (error) {
      console.error('Delete confirmation error:', error);
    }
  };

  const handleCancel = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCancel();
    });
  };

  if (!recording) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={handleCancel}
        />
        
        <Animated.View 
          style={[
            styles.dialog,
            {
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="trash" size={32} color={Colors.error} />
            </View>
            <Text style={styles.title}>Delete Recording</Text>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.message}>
              Are you sure you want to delete "{recording.title}"?
            </Text>

            {/* Recording Details */}
            <View style={styles.recordingDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="videocam" size={16} color={Colors.text.secondary} />
                <Text style={styles.detailText}>{recording.title}</Text>
              </View>
              
              {recording.school && (
                <View style={styles.detailRow}>
                  <Ionicons name="school" size={16} color={Colors.text.secondary} />
                  <Text style={styles.detailText}>{recording.school.name}</Text>
                </View>
              )}
              
              {recording.teacher && (
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={16} color={Colors.text.secondary} />
                  <Text style={styles.detailText}>by {recording.teacher.name}</Text>
                </View>
              )}
              
              {recording.duration_minutes && (
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={16} color={Colors.text.secondary} />
                  <Text style={styles.detailText}>{recording.duration_minutes} minutes</Text>
                </View>
              )}
            </View>

            {/* Dependencies Warning */}
            {hasDependencies && (
              <View style={styles.warningContainer}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning" size={20} color={Colors.warning} />
                  <Text style={styles.warningTitle}>Dependencies Found</Text>
                </View>
                
                <Text style={styles.warningMessage}>
                  This recording is referenced by the following items. Deleting it may affect these resources:
                </Text>
                
                <View style={styles.dependenciesList}>
                  {dependencies.map((dep, index) => (
                    <View key={`${dep.type}-${dep.id}`} style={styles.dependencyItem}>
                      <Ionicons 
                        name={getDependencyIcon(dep.type)} 
                        size={16} 
                        color={Colors.warning} 
                      />
                      <Text style={styles.dependencyText}>
                        {dep.title} ({dep.type})
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Confirmation Input */}
            {requiresConfirmation && (
              <View style={styles.confirmationContainer}>
                <Text style={styles.confirmationLabel}>
                  Type "DELETE" to confirm this action:
                </Text>
                <TextInput
                  style={[
                    styles.confirmationInput,
                    isConfirmDisabled && confirmText.length > 0 && styles.confirmationInputError,
                  ]}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="DELETE"
                  autoCapitalize="characters"
                  autoFocus
                />
              </View>
            )}

            <Text style={styles.warningFooter}>
              ⚠️ This action cannot be undone.
            </Text>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Cancel"
              onPress={handleCancel}
              variant="outline"
              style={styles.cancelButton}
              disabled={isLoading}
            />
            
            <Button
              title="Delete Recording"
              onPress={handleConfirm}
              loading={isLoading}
              disabled={isConfirmDisabled}
              style={[
                styles.deleteButton,
                isConfirmDisabled && styles.disabledButton,
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function getDependencyIcon(type: string): string {
  switch (type) {
    case 'assignment':
      return 'document-text';
    case 'lesson_plan':
      return 'book';
    case 'material':
      return 'folder';
    default:
      return 'link';
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialog: {
    backgroundColor: Colors.card.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  content: {
    padding: Spacing.xl,
    maxHeight: 300,
  },
  message: {
    fontSize: 16,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  recordingDetails: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  warningContainer: {
    backgroundColor: Colors.warning + '10',
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.warning,
    marginLeft: Spacing.sm,
  },
  warningMessage: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  dependenciesList: {
    gap: Spacing.sm,
  },
  dependencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 6,
  },
  dependencyText: {
    fontSize: 13,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  confirmationContainer: {
    marginBottom: Spacing.lg,
  },
  confirmationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.background,
    color: Colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmationInputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  warningFooter: {
    fontSize: 12,
    color: Colors.error,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
  },
  disabledButton: {
    backgroundColor: Colors.border.light,
    opacity: 0.6,
  },
});