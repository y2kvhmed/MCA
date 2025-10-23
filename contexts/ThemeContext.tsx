import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
}

const lightColors = {
  primary: '#001F3F',
  accent: '#ffe164',
  background: '#f8f9fa',
  backgroundDark: '#000000',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#007AFF',
  
  text: {
    primary: '#333333',
    secondary: '#666666',
    tertiary: '#999999',
    inverse: '#FFFFFF',
  },
  
  border: {
    light: '#e0e0e0',
    medium: '#cccccc',
    dark: '#999999',
  },
  
  card: {
    background: '#FFFFFF',
    shadow: '#000000',
  },
  
  role: {
    admin: '#001F3F',
    teacher: '#007AFF',
    student: '#34C759',
  },
  
  status: {
    submitted: '#007AFF',
    graded: '#34C759',
    pending: '#FF9500',
    overdue: '#FF3B30',
  },
};

const darkColors = {
  primary: '#4A90E2',
  accent: '#FFD700',
  background: '#121212',
  backgroundDark: '#000000',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
    tertiary: '#808080',
    inverse: '#000000',
  },
  
  border: {
    light: '#333333',
    medium: '#555555',
    dark: '#777777',
  },
  
  card: {
    background: '#1E1E1E',
    shadow: '#000000',
  },
  
  role: {
    admin: '#4A90E2',
    teacher: '#2196F3',
    student: '#4CAF50',
  },
  
  status: {
    submitted: '#2196F3',
    graded: '#4CAF50',
    pending: '#FF9800',
    overdue: '#F44336',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};