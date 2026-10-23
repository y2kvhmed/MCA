import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Colors } from '../../constants/Colors';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getCurrentUser } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await loadUser();
      } else if (event === 'SIGNED_OUT') {
        setRole(null);
        router.replace('/login');
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
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    } catch (err) {
      console.warn('Failed to load user in tab layout:', err);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !role) {
    return <LoadingSpinner />;
  }

  // Strict helper to completely erase forbidden tabs from the navigation bar across all platforms & browsers
  const hiddenTabOptions = {
    href: null,
    tabBarItemStyle: { display: 'none' as const },
    tabBarButton: () => null,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
      }}
    >
      {/* Admin Tabs */}
      <Tabs.Screen
        name="admin-dashboard"
        options={role === 'admin' ? {
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        } : hiddenTabOptions}
      />
      <Tabs.Screen
        name="admin-profile"
        options={role === 'admin' ? {
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        } : hiddenTabOptions}
      />

      {/* Teacher Tabs */}
      <Tabs.Screen
        name="teacher-dashboard"
        options={role === 'teacher' ? {
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        } : hiddenTabOptions}
      />
      <Tabs.Screen
        name="teacher-profile"
        options={role === 'teacher' ? {
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        } : hiddenTabOptions}
      />

      {/* Student Tabs */}
      <Tabs.Screen
        name="student-dashboard"
        options={role === 'student' ? {
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        } : hiddenTabOptions}
      />
      <Tabs.Screen
        name="student-profile"
        options={role === 'student' ? {
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        } : hiddenTabOptions}
      />

      {/* Shared School Chat Tab (Strictly visible to all 3 roles) */}
      <Tabs.Screen
        name="student-chat"
        options={{
          title: 'School Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
