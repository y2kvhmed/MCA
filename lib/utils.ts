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

// Format date/time displaying exact time
export function formatRelativeDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

// Format standard date
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format due date countdown including time
export function formatDueDate(dueDateString: string): string {
  if (!dueDateString) return 'No due date';
  const dueDate = new Date(dueDateString);
  if (isNaN(dueDate.getTime())) return 'Invalid date';

  const now = new Date();

  // Compare calendar days (local midnight boundaries), not elapsed milliseconds.
  // Using Math.ceil on the raw diff treated any due time later today as "tomorrow".
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(dueDate) - startOfDay(now)) / 86400000);

  const timeStr = dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  if (dueDate.getTime() < now.getTime()) {
    return `Overdue (was due ${dateStr} at ${timeStr})`;
  }
  if (diffDays === 0) {
    return `Due today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Due tomorrow at ${timeStr}`;
  }
  if (diffDays < 7) {
    return `Due in ${diffDays} days (${dateStr} at ${timeStr})`;
  }
  
  return `Due ${dateStr} at ${timeStr}`;
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