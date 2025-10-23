import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../lib/auth';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Add a small delay to ensure app is fully loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const user = await getCurrentUser();
      if (user && user.is_active) {
        // Navigate based on role
        switch (user.role) {
          case 'admin':
            router.replace('/(tabs)/admin-dashboard');
            break;
          case 'teacher':
            router.replace('/(tabs)/teacher-dashboard');
            break;
          case 'student':
            router.replace('/(tabs)/student-dashboard');
            break;
          default:
            router.replace('/welcome');
        }
      } else {
        router.replace('/welcome');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // Always fallback to welcome screen on error
      setTimeout(() => {
        router.replace('/welcome');
      }, 500);
    }
  };

  return <LoadingSpinner />;
}
