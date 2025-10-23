// Simple notification functions that work on both web and mobile
export function handleError(error: any, userMessage: string = 'An error occurred') {
  console.error('Error:', error);
  console.warn('User Error:', userMessage);
}

export function showSuccess(message: string) {
  console.log('Success:', message);
}

export function showConfirmation(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) {
  // For web, just confirm directly (no popup)
  if (typeof window !== 'undefined') {
    console.log('Confirmation:', title, message);
    onConfirm(); // Auto-confirm on web
  } else {
    // For mobile, still use Alert as fallback
    const { Alert } = require('react-native');
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Confirm', onPress: onConfirm },
      ]
    );
  }
}

export function formatError(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format date relative to now
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

// Format due date countdown
export function formatDueDate(dueDateString: string): string {
  const dueDate = new Date(dueDateString);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 7) return `Due in ${diffDays} days`;
  
  return `Due ${dueDate.toLocaleDateString()}`;
}

// Format file size in human readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if a date is overdue
export function isOverdue(dueDateString: string): boolean {
  const dueDate = new Date(dueDateString);
  const now = new Date();
  return now > dueDate;
}

// Generate a random password
export function generatePassword(length: number = 8): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Validate phone number format
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Truncate text to specified length
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Capitalize first letter of each word
export function capitalizeWords(text: string): string {
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}