import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import LoadingSpinner from './LoadingSpinner';
import { getCurrentUserCached } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';

type AppRole = 'admin' | 'teacher' | 'student' | 'parent';

const PUBLIC_ROUTES = new Set(['/', '/index', '/welcome', '/login']);

const ALL_ROLES: readonly AppRole[] = ['admin', 'teacher', 'student', 'parent'];
const STAFF_ROLES: readonly AppRole[] = ['admin', 'teacher'];
const STUDENT_AND_STAFF: readonly AppRole[] = ['admin', 'teacher', 'student'];
const STAFF_AND_STUDENT_CHAT: readonly AppRole[] = ['admin', 'teacher', 'student'];

// Keep every private Expo route in this closed map. A missing route is denied,
// rather than implicitly exposed to every authenticated role.
const ROUTE_ROLES: Record<string, readonly AppRole[]> = {
  '/add-recording': STAFF_ROLES,
  '/admin-chats': ['admin'],
  '/admin-controls': ['admin'],
  '/admin-dashboard': ['admin'],
  '/admin-profile': ['admin'],
  '/announcements': STUDENT_AND_STAFF,
  '/assignment-details': STUDENT_AND_STAFF,
  '/assignment-manager': ['teacher'],
  '/assignment-overview': STAFF_ROLES,
  '/assignment-reports': STAFF_ROLES,
  '/assignment-submissions': STAFF_ROLES,
  '/attendance': STAFF_ROLES,
  '/broadcast': STAFF_ROLES,
  '/calendar': ALL_ROLES,
  '/change-password': ALL_ROLES,
  '/compose-email': STAFF_ROLES,
  '/create-assignment': STAFF_ROLES,
  '/create-material': STAFF_ROLES,
  '/create-material-simple': STAFF_ROLES,
  '/create-school': ['admin'],
  '/create-test': STAFF_ROLES,
  '/create-user': ['admin'],
  '/dashboard-analytics': STUDENT_AND_STAFF,
  '/delete-assignment': STAFF_ROLES,
  '/delete-material': STAFF_ROLES,
  '/edit-assignment': STAFF_ROLES,
  '/edit-recording': STAFF_ROLES,
  '/edit-school': ['admin'],
  '/edit-teacher-profile': STAFF_ROLES,
  '/edit-user': ['admin'],
  '/enter-marks': STAFF_ROLES,
  '/grade-assignment': STAFF_ROLES,
  '/grade-submission': STAFF_ROLES,
  '/help-support': ALL_ROLES,
  '/manage-school': ['admin'],
  '/manage-users': ['admin'],
  '/material-details': STUDENT_AND_STAFF,
  '/materials-list': STAFF_ROLES,
  '/notification-center': ALL_ROLES,
  '/notification-settings': ALL_ROLES,
  '/notifications': ALL_ROLES,
  '/notes': STUDENT_AND_STAFF,
  '/private-chat': ALL_ROLES,
  '/recordings': STUDENT_AND_STAFF,
  '/school-chat': STAFF_AND_STUDENT_CHAT,
  '/school-chooser': STAFF_AND_STUDENT_CHAT,
  '/school-reports': STAFF_ROLES,
  '/settings': ALL_ROLES,
  '/student-assignment-list': ['student'],
  '/student-assignments': ['student'],
  '/student-dashboard': ['student'],
  '/student-details': STAFF_ROLES,
  '/student-grades': ['student'],
  '/student-materials': ['student'],
  '/student-profile': ['student'],
  '/student-profile-management': STAFF_ROLES,
  '/student-progress': STUDENT_AND_STAFF,
  '/student-chat': STAFF_AND_STUDENT_CHAT,
  '/submit-assignment': ['student'],
  '/students-list': STAFF_ROLES,
  '/submission-details': STUDENT_AND_STAFF,
  '/teacher-assignments': ['teacher'],
  '/teacher-dashboard': ['teacher'],
  '/teacher-profile': ['teacher'],
  '/test-scores': STAFF_ROLES,
  '/view-schools': ['admin'],
  '/view-users': ['admin'],
};

const ROLE_HOME: Record<AppRole, string> = {
  admin: '/(tabs)/admin-dashboard',
  teacher: '/(tabs)/teacher-dashboard',
  student: '/(tabs)/student-dashboard',
  parent: '/welcome',
};

function normalizeRoute(pathname: string): string {
  const withoutGroups = pathname.replace(/\/\([^/]+\)/g, '');
  const normalized = withoutGroups.replace(/\/+$/, '');
  return normalized || '/';
}

function isRole(value: string): value is AppRole {
  return value === 'admin' || value === 'teacher' || value === 'student' || value === 'parent';
}

function isAllowedOnRoute(route: string, role: AppRole): boolean {
  return ROUTE_ROLES[route]?.includes(role) === true;
}

export default function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const route = normalizeRoute(pathname);
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = Boolean(rootNavigationState?.key);

  // undefined = identity not verified yet for this app session.
  // null      = verified and signed out.
  const [role, setRole] = useState<AppRole | null | undefined>(undefined);

  const loadRole = useCallback(async (force: boolean) => {
    const user = await getCurrentUserCached(force);
    const value = String(user?.role || '').toLowerCase().trim();
    setRole(isRole(value) ? value : null);
  }, []);

  // Subscribe to auth changes once. Navigation must never re-subscribe.
  useEffect(() => {
    if (!navigationReady) return;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setRole(null);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void loadRole(true);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [navigationReady, loadRole]);

  // Re-check on navigation, but read the cached session: this is synchronous in
  // practice, so switching tabs no longer shows a spinner or hits the network.
  // The cache expires every few minutes, so a real re-verification still happens
  // periodically without blocking navigation.
  useEffect(() => {
    if (!navigationReady) return;
    void loadRole(false);
  }, [navigationReady, route, loadRole]);

  const isPublic = PUBLIC_ROUTES.has(route);
  const allowed =
    isPublic || (role !== undefined && role !== null && isAllowedOnRoute(route, role));

  // Redirect only once the answer is known; role keeps its previous value during
  // a re-verification, so an allowed page never flashes the blocker.
  useEffect(() => {
    if (!navigationReady || isPublic || role === undefined) return;
    if (role === null) {
      router.replace('/login');
      return;
    }
    if (!isAllowedOnRoute(route, role)) {
      router.replace(ROLE_HOME[role]);
    }
  }, [navigationReady, isPublic, route, role, router]);

  return (
    <>
      {children}
      {!allowed && (
        <View style={styles.blocker}>
          <LoadingSpinner />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  blocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: Colors.background,
  },
});
