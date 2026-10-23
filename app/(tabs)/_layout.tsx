import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Colors } from '../../constants/Colors';
import { getCurrentUser } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('student');

  useEffect(() => {
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await loadUser();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const loadUser = async () => {
    try {
      const user = await getCurrentUser();
      if (user && user.role) {
        const normalized = user.role.toLowerCase().trim() as 'admin' | 'teacher' | 'student';
        if (['admin', 'teacher', 'student'].includes(normalized)) {
          setRole(normalized);
        }
      }
    } catch (err) {
      console.warn('Failed to load user in tab layout:', err);
    }
  };

  const hiddenOptions = { href: null };

  if (role === 'admin') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.text.tertiary,
        }}
      >
        <Tabs.Screen
          name="admin-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="student-chat"
          options={{
            title: 'School Chat',
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="admin-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="teacher-dashboard" options={hiddenOptions} />
        <Tabs.Screen name="teacher-profile" options={hiddenOptions} />
        <Tabs.Screen name="student-dashboard" options={hiddenOptions} />
        <Tabs.Screen name="student-profile" options={hiddenOptions} />
      </Tabs>
    );
  }

  if (role === 'teacher') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.text.tertiary,
        }}
      >
        <Tabs.Screen
          name="teacher-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="student-chat"
          options={{
            title: 'School Chat',
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="teacher-profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="admin-dashboard" options={hiddenOptions} />
        <Tabs.Screen name="admin-profile" options={hiddenOptions} />
        <Tabs.Screen name="student-dashboard" options={hiddenOptions} />
        <Tabs.Screen name="student-profile" options={hiddenOptions} />
      </Tabs>
    );
  }

  // Student tabs (also used as safe default while role loads, so Admin tab is NEVER leaked)
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
      }}
    >
      <Tabs.Screen
        name="student-dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="student-chat"
        options={{
          title: 'School Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="student-profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="admin-dashboard" options={hiddenOptions} />
      <Tabs.Screen name="admin-profile" options={hiddenOptions} />
      <Tabs.Screen name="teacher-dashboard" options={hiddenOptions} />
      <Tabs.Screen name="teacher-profile" options={hiddenOptions} />
    </Tabs>
  );
}
