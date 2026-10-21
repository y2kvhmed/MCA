import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Colors } from '../../constants/Colors';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TabLayout() {
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // lazy-load auth utilities to avoid bundling native-only modules on web/server
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const auth = await import('../../lib/auth');
      const user = await auth.getCurrentUser();
      if (user) setRole(user.role);
    } catch (err) {
      // If auth module fails to load (eg. during server-side bundling), fallback to guest
      console.warn('Failed to load auth module:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (role === 'admin') {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary }}>
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="student-chat"
          options={{
            title: 'School Chat',
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="admin-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
          }}
        />
        <Tabs.Screen name="teacher-dashboard" options={{ href: null }} />
        <Tabs.Screen name="teacher-profile" options={{ href: null }} />
        <Tabs.Screen name="student-dashboard" options={{ href: null }} />
        <Tabs.Screen name="student-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  if (role === 'teacher') {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary }}>
        <Tabs.Screen
          name="teacher-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="student-chat"
          options={{
            title: 'School Chat',
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="teacher-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
          }}
        />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-profile" options={{ href: null }} />
        <Tabs.Screen name="student-dashboard" options={{ href: null }} />
        <Tabs.Screen name="student-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  if (role === 'student') {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary }}>
        <Tabs.Screen
          name="student-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="student-chat"
          options={{
            title: 'School Chat',
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="student-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
          }}
        />
        <Tabs.Screen name="admin-dashboard" options={{ href: null }} />
        <Tabs.Screen name="admin-profile" options={{ href: null }} />
        <Tabs.Screen name="teacher-dashboard" options={{ href: null }} />
        <Tabs.Screen name="teacher-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  // Fallback for any other/unassigned role during testing
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary }}>
      <Tabs.Screen
        name="student-dashboard"
        options={{
          title: 'Student',
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="teacher-dashboard"
        options={{
          title: 'Teacher',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="admin-dashboard"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="student-chat"
        options={{
          title: 'School Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
        }}
      />
      <Tabs.Screen name="student-profile" options={{ href: null }} />
      <Tabs.Screen name="teacher-profile" options={{ href: null }} />
      <Tabs.Screen name="admin-profile" options={{ href: null }} />
    </Tabs>
  );
}
