import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../lib/auth';
import { Colors } from '../../constants/Colors';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function TabLayout() {
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await getCurrentUser();
    if (user) setRole(user.role);
    setLoading(false);
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
            title: 'Chat',
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
            title: 'Chat',
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
            title: 'Chat',
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

  return <LoadingSpinner />;
}
