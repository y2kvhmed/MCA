import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (text: string) => void;
  destructive?: boolean;
  autoClose?: number; // Auto close after X seconds
  requireConfirmation?: boolean; // Require typing "CONFIRM" to proceed
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  icon,
  onConfirm,
  onCancel,
  showInput = false,
  inputPlaceholder = '',
  inputValue = '',
  onInputChange,
  destructive = false,
  autoClose,
  requireConfirmation = false,
}: ConfirmDialogProps) {
  const [internalInputValue, setInternalInputValue] = useState(inputValue);
  const [countdown, setCountdown] = useState(autoClose || 0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close countdown
      if (autoClose && autoClose > 0) {
        setCountdown(autoClose);
        const interval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              onCancel();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(interval);
      }
    } else {
      // Reset state when dialog closes
      setInternalInputValue('');
      setCountdown(0);
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, autoClose]);

  const handleInputChange = (text: string) => {
    setInternalInputValue(text);
    onInputChange?.(text);
  };

  const isConfirmDisabled = () => {
    if (requireConfirmation) {
      return internalInputValue.toUpperCase() !== 'CONFIRM';
    }
    return false;
  };
  const getTypeConfig = () => {
    switch (type) {
      case 'danger':
        return {
          color: Colors.error,
          icon: icon || 'warning',
          confirmStyle: { backgroundColor: Colors.error },
        };
      case 'warning':
        return {
          color: Colors.warning,
          icon: icon || 'alert-circle',
          confirmStyle: { backgroundColor: Colors.warning },
        };
      case 'success':
        return {
          color: Colors.success,
          icon: icon || 'checkmark-circle',
          confirmStyle: { backgroundColor: Colors.success },
        };
      default:
        return {
          color: Colors.info,
          icon: icon || 'information-circle',
          confirmStyle: { backgroundColor: Colors.primary },
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onCancel}
        />
        
        <Animated.View 
          style={[
            styles.dialog,
            { transform: [{ scale: scaleAnim }] },
            destructive && styles.destructiveDialog,
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon as any} size={32} color={config.color} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {countdown > 0 && (
              <Text style={styles.countdown}>Auto close in {countdown}s</Text>
            )}
          </View>
          
          <Text style={styles.message}>{message}</Text>
          
          {showInput && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={requireConfirmation ? 'Type "CONFIRM" to proceed' : inputPlaceholder}
                value={internalInputValue}
                onChangeText={handleInputChange}
                autoFocus
                autoCapitalize={requireConfirmation ? 'characters' : 'none'}
              />
            </View>
          )}
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.confirmButton, 
                config.confirmStyle,
                isConfirmDisabled() && styles.disabledButton,
                destructive && styles.destructiveButton,
              ]}
              onPress={onConfirm}
              disabled={isConfirmDisabled()}
            >
              <Text style={[
                styles.confirmText,
                isConfirmDisabled() && styles.disabledText,
              ]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Utility functions for common dialog patterns
export function showQuickConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger' | 'success';
  }
) {
  Alert.alert(
    title,
    message,
    [
      {
        text: options?.cancelText || 'Cancel',
        style: 'cancel',
      },
      {
        text: options?.confirmText || 'Confirm',
        onPress: onConfirm,
        style: options?.type === 'danger' ? 'destructive' : 'default',
      },
    ]
  );
}

export function showDestructiveConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  requireTyping: boolean = false
) {
  // This would need to be implemented with a state management solution
  // For now, using Alert as fallback
  Alert.alert(
    title,
    message + (requireTyping ? '\n\nThis action cannot be undone.' : ''),
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: onConfirm, style: 'destructive' },
    ]
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  destructiveDialog: {
    borderColor: Colors.error,
    borderWidth: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  countdown: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.background,
    color: Colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  destructiveButton: {
    backgroundColor: Colors.error,
  },
  disabledButton: {
    backgroundColor: Colors.border.light,
    opacity: 0.6,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  disabledText: {
    color: Colors.text.disabled,
  },
});