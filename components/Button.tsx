import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { BorderRadius, Spacing } from '../constants/Styles';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export default function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  style,
}: ButtonProps) {
  const buttonStyle = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    (disabled || loading) && styles.buttonDisabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.text.inverse} />
      ) : (
        <Text 
          style={textStyle} 
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.8}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    minHeight: 44, // Ensure minimum touch target
    flexDirection: 'row', // Allow for better text layout
  },
  
  // Variants
  button_primary: {
    backgroundColor: Colors.primary,
  },
  button_secondary: {
    backgroundColor: Colors.accent,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  button_danger: {
    backgroundColor: Colors.error,
  },
  
  // Sizes
  button_small: {
    minHeight: 36,
    paddingHorizontal: Spacing.lg, // Increased padding
    paddingVertical: Spacing.sm,
  },
  button_medium: {
    minHeight: 44,
    paddingHorizontal: Spacing.xl, // Increased padding
    paddingVertical: Spacing.md,
  },
  button_large: {
    minHeight: 52,
    paddingHorizontal: Spacing.xxl, // Increased padding
    paddingVertical: Spacing.lg,
  },
  
  buttonDisabled: {
    opacity: 0.5,
  },
  
  text: {
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 0, // Prevent text from shrinking
    includeFontPadding: false, // Remove extra padding on Android
  },
  
  // Text variants
  text_primary: {
    color: Colors.text.inverse,
  },
  text_secondary: {
    color: Colors.text.primary,
  },
  text_outline: {
    color: Colors.primary,
  },
  text_danger: {
    color: Colors.text.inverse,
  },
  
  // Text sizes - Responsive font sizes
  text_small: {
    fontSize: 13,
    lineHeight: 18,
  },
  text_medium: {
    fontSize: 15,
    lineHeight: 20,
  },
  text_large: {
    fontSize: 17,
    lineHeight: 22,
  },
});
